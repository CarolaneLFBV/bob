import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { Command } from '../../types/command';
import { createErrorEmbed } from '../../utils/embeds';

const FEED_URL = 'https://download.swift.org/swift-evolution/v1/evolution.json';
const PROPOSAL_BASE = 'https://github.com/swiftlang/swift-evolution/blob/main/proposals/';
const CACHE_TTL_MS = 60 * 60 * 1000;

interface SEAuthor {
  name: string;
  link?: string;
}

interface SEProposal {
  id: string;
  title: string;
  summary: string;
  authors: SEAuthor[];
  status: { state: string; version?: string; end?: string; start?: string };
  link: string;
  trackingBugs?: { id: string; link: string }[];
}

interface SEFeed {
  creationDate: string;
  proposals: SEProposal[];
}

let cache: { fetchedAt: number; data: SEFeed } | null = null;

async function loadFeed(): Promise<SEFeed | null> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(FEED_URL, {
      headers: { Accept: 'application/json', 'User-Agent': 'KeepOS-Bot/1.0' },
      signal: controller.signal,
    });
    clearTimeout(id);
    if (!res.ok) return cache?.data ?? null;
    const data = (await res.json()) as SEFeed;
    cache = { fetchedAt: Date.now(), data };
    return data;
  } catch (error) {
    clearTimeout(id);
    console.error('Swift Evolution fetch error:', error);
    return cache?.data ?? null;
  }
}

const STATE_META: Record<string, { label: string; emoji: string; color: number }> = {
  accepted: { label: 'Accepté', emoji: '✅', color: 0x2ecc71 },
  acceptedWithRevisions: { label: 'Accepté avec révisions', emoji: '✅', color: 0x27ae60 },
  activeReview: { label: 'En review', emoji: '🔍', color: 0x3498db },
  implemented: { label: 'Implémenté', emoji: '🚀', color: 0x16a085 },
  previewing: { label: 'En preview', emoji: '👁️', color: 0x9b59b6 },
  rejected: { label: 'Rejeté', emoji: '❌', color: 0xe74c3c },
  returnedForRevision: { label: 'Retourné pour révision', emoji: '↩️', color: 0xe67e22 },
  withdrawn: { label: 'Retiré', emoji: '🗑️', color: 0x95a5a6 },
};

function normalizeId(input: string): string {
  const cleaned = input.trim().toUpperCase().replace(/^SE[-\s]?/, '');
  const num = parseInt(cleaned, 10);
  if (Number.isNaN(num)) return '';
  return `SE-${num.toString().padStart(4, '0')}`;
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
}

function formatAuthors(authors: SEAuthor[]): string {
  if (!authors?.length) return 'N/A';
  return authors.map(a => (a.link ? `[${a.name}](${a.link})` : a.name)).join(', ');
}

function buildEmbed(p: SEProposal): EmbedBuilder {
  const meta = STATE_META[p.status.state] ?? { label: p.status.state, emoji: '📝', color: 0x9333ea };
  const versionSuffix = p.status.version ? ` (Swift ${p.status.version})` : '';
  const link = PROPOSAL_BASE + p.link;

  const embed = new EmbedBuilder()
    .setColor(meta.color)
    .setTitle(`${p.id} — ${p.title}`)
    .setURL(link)
    .setDescription(truncate(p.summary?.replace(/\s+/g, ' ').trim() || '*Pas de résumé*', 1500))
    .addFields(
      { name: 'Statut', value: `${meta.emoji} ${meta.label}${versionSuffix}`, inline: true },
      { name: 'Auteur·rices', value: truncate(formatAuthors(p.authors), 200), inline: true }
    )
    .setFooter({ text: 'Swift Evolution • swift.org' })
    .setTimestamp();

  if (p.trackingBugs?.length) {
    embed.addFields({
      name: '🐛 Tracking',
      value: p.trackingBugs.map(b => `[${b.id}](${b.link})`).join(', '),
      inline: false,
    });
  }

  return embed;
}

export default {
  data: new SlashCommandBuilder()
    .setName('swift-evolution')
    .setDescription('Affiche une Swift Evolution Proposal (SE-XXXX)')
    .addStringOption(opt =>
      opt
        .setName('proposal')
        .setDescription('Numéro ou titre (ex: 401, SE-0401, "if let shorthand")')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused().toLowerCase().trim();
    const feed = await loadFeed();
    if (!feed) return interaction.respond([]);

    let matches: SEProposal[];
    if (!focused) {
      matches = feed.proposals.slice(-25).reverse();
    } else if (/^\d+$/.test(focused)) {
      const idPrefix = `SE-${focused.padStart(4, '0').slice(0, 4)}`;
      matches = feed.proposals.filter(p => p.id.startsWith(idPrefix.slice(0, 3 + focused.length)));
    } else {
      matches = feed.proposals.filter(
        p =>
          p.id.toLowerCase().includes(focused) ||
          p.title.toLowerCase().includes(focused)
      );
    }

    const choices = matches.slice(0, 25).map(p => ({
      name: truncate(`${p.id} — ${p.title}`, 100),
      value: p.id,
    }));

    await interaction.respond(choices);
  },

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const rawInput = interaction.options.getString('proposal', true);
    const feed = await loadFeed();

    if (!feed) {
      return interaction.editReply({
        embeds: [createErrorEmbed('Service indisponible', 'Impossible de joindre swift.org pour le moment.')],
      });
    }

    const normalized = normalizeId(rawInput);
    let proposal = normalized
      ? feed.proposals.find(p => p.id === normalized)
      : undefined;

    if (!proposal) {
      const q = rawInput.toLowerCase().trim();
      proposal = feed.proposals.find(p => p.title.toLowerCase().includes(q));
    }

    if (!proposal) {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            'Proposal introuvable',
            `Aucune Swift Evolution Proposal ne correspond à **${rawInput}**.`
          ),
        ],
      });
    }

    const linkButton = new ButtonBuilder()
      .setLabel('Lire la proposal complète')
      .setStyle(ButtonStyle.Link)
      .setURL(PROPOSAL_BASE + proposal.link)
      .setEmoji('📄');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(linkButton);

    await interaction.editReply({
      embeds: [buildEmbed(proposal)],
      components: [row],
    });
  },
} satisfies Command;
