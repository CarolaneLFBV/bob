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

const ITUNES_SEARCH = 'https://itunes.apple.com/search';
const ITUNES_LOOKUP = 'https://itunes.apple.com/lookup';

const COUNTRY_CHOICES = [
  { name: '🇫🇷 France', value: 'fr' },
  { name: '🇺🇸 États-Unis', value: 'us' },
  { name: '🇬🇧 Royaume-Uni', value: 'gb' },
  { name: '🇨🇦 Canada', value: 'ca' },
  { name: '🇯🇵 Japon', value: 'jp' },
  { name: '🇩🇪 Allemagne', value: 'de' },
];

interface AppResult {
  trackId: number;
  trackName: string;
  artistName: string;
  sellerName?: string;
  trackViewUrl: string;
  artworkUrl512?: string;
  artworkUrl100?: string;
  averageUserRating?: number;
  userRatingCount?: number;
  formattedPrice?: string;
  price?: number;
  currency?: string;
  primaryGenreName?: string;
  version?: string;
  description?: string;
  releaseNotes?: string;
  screenshotUrls?: string[];
  ipadScreenshotUrls?: string[];
  bundleId?: string;
  releaseDate?: string;
  currentVersionReleaseDate?: string;
  fileSizeBytes?: string;
  minimumOsVersion?: string;
  contentAdvisoryRating?: string;
  languageCodesISO2A?: string[];
}

async function fetchITunes(url: string, timeoutMs = 4000): Promise<any | null> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'KeepOS-Bot/1.0' },
      signal: controller.signal,
    });
    clearTimeout(id);
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    clearTimeout(id);
    console.error('iTunes fetch error:', error);
    return null;
  }
}

function formatSize(bytes?: string): string {
  if (!bytes) return 'N/A';
  const n = parseInt(bytes, 10);
  if (Number.isNaN(n)) return 'N/A';
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatRating(rating?: number, count?: number): string {
  if (!rating) return '*Pas encore de note*';
  const stars = '⭐'.repeat(Math.round(rating));
  const countStr = count ? ` (${count.toLocaleString('fr-FR')})` : '';
  return `${stars} **${rating.toFixed(1)}**/5${countStr}`;
}

function formatDate(iso?: string): string {
  if (!iso) return 'N/A';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function truncate(text: string | undefined, max: number): string {
  if (!text) return '';
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
}

function buildEmbed(app: AppResult, country: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor('#0a84ff')
    .setTitle(app.trackName)
    .setURL(app.trackViewUrl)
    .setAuthor({ name: app.artistName, url: app.trackViewUrl })
    .setThumbnail(app.artworkUrl512 ?? app.artworkUrl100 ?? null)
    .setDescription(truncate(app.description, 400) || '*Pas de description*')
    .addFields(
      { name: '⭐ Note', value: formatRating(app.averageUserRating, app.userRatingCount), inline: true },
      { name: '💰 Prix', value: app.formattedPrice ?? 'N/A', inline: true },
      { name: '📂 Catégorie', value: app.primaryGenreName ?? 'N/A', inline: true },
      { name: '📦 Taille', value: formatSize(app.fileSizeBytes), inline: true },
      { name: '🆚 Version', value: app.version ?? 'N/A', inline: true },
      { name: '📱 iOS min', value: app.minimumOsVersion ?? 'N/A', inline: true },
      { name: '🚀 Sortie', value: formatDate(app.releaseDate), inline: true },
      { name: '🔄 MAJ', value: formatDate(app.currentVersionReleaseDate), inline: true },
      { name: '🔞 Âge', value: app.contentAdvisoryRating ?? 'N/A', inline: true }
    );

  if (app.bundleId) {
    embed.addFields({ name: '🧬 Bundle ID', value: `\`${app.bundleId}\``, inline: false });
  }

  const screenshots = app.screenshotUrls ?? app.ipadScreenshotUrls ?? [];
  if (screenshots[0]) embed.setImage(screenshots[0]);

  embed.setFooter({ text: `App Store ${country.toUpperCase()} • iTunes Search API` }).setTimestamp();
  return embed;
}

export default {
  data: new SlashCommandBuilder()
    .setName('appstore')
    .setDescription('Affiche la fiche complète d\'une app sur l\'App Store')
    .addStringOption(opt =>
      opt
        .setName('nom')
        .setDescription('Nom de l\'app (ex: Spotify, Things 3)')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(opt =>
      opt
        .setName('pays')
        .setDescription('Store régional (défaut: France)')
        .setRequired(false)
        .addChoices(...COUNTRY_CHOICES)
    ),

  async autocomplete(interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused();
    if (!focused || focused.trim().length < 2) {
      return interaction.respond([]);
    }

    const country =
      (interaction.options.getString('pays') as string | null) ?? 'fr';

    const url = `${ITUNES_SEARCH}?term=${encodeURIComponent(focused)}&country=${country}&entity=software&limit=8`;
    const data = await fetchITunes(url, 2200);
    const results: AppResult[] = data?.results ?? [];

    const choices = results.slice(0, 25).map(app => ({
      name: truncate(`${app.trackName} — ${app.artistName}`, 100),
      value: String(app.trackId),
    }));

    await interaction.respond(choices);
  },

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const input = interaction.options.getString('nom', true).trim();
    const country = (interaction.options.getString('pays') ?? 'fr').toLowerCase();

    let app: AppResult | null = null;

    if (/^\d+$/.test(input)) {
      const data = await fetchITunes(
        `${ITUNES_LOOKUP}?id=${input}&country=${country}&entity=software`
      );
      app = data?.results?.[0] ?? null;
    }

    if (!app) {
      const data = await fetchITunes(
        `${ITUNES_SEARCH}?term=${encodeURIComponent(input)}&country=${country}&entity=software&limit=1`
      );
      app = data?.results?.[0] ?? null;
    }

    if (!app) {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            'Aucune app trouvée',
            `Aucune app ne correspond à **${input}** sur l\'App Store ${country.toUpperCase()}.`
          ),
        ],
      });
    }

    const linkButton = new ButtonBuilder()
      .setLabel('Voir sur l\'App Store')
      .setStyle(ButtonStyle.Link)
      .setURL(app.trackViewUrl)
      .setEmoji('📲');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(linkButton);

    await interaction.editReply({
      embeds: [buildEmbed(app, country)],
      components: [row],
    });
  },
} satisfies Command;
