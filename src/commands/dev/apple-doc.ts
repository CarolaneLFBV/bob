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
import {
  APPLE_FRAMEWORKS,
  AppleFramework,
  FRAMEWORK_META,
  findSymbolDoc,
  fetchByDocPath,
  flattenAbstract,
  flattenFragments,
  formatPlatforms,
  AppleDocResult,
} from '../../services/appleDoc';
import { searchSymbols, getIndexSize } from '../../services/appleDocIndex';

const FRAMEWORK_CHOICES = APPLE_FRAMEWORKS.map(fw => ({
  name: `${FRAMEWORK_META[fw].emoji} ${FRAMEWORK_META[fw].label}`,
  value: fw,
}));

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
}

function buildEmbed(result: AppleDocResult): EmbedBuilder {
  const { data, framework, webUrl } = result;
  const meta = FRAMEWORK_META[framework];

  const title = data.metadata?.title ?? result.symbolPath;
  const kind = data.metadata?.roleHeading ?? data.metadata?.symbolKind ?? '';
  const signature = flattenFragments(data.metadata?.fragments);
  const abstract = flattenAbstract(data.abstract) || '*Pas de description disponible.*';
  const platforms = formatPlatforms(data.metadata?.platforms);
  const module = data.metadata?.modules?.[0]?.name ?? meta.label;

  const embed = new EmbedBuilder()
    .setColor('#007aff') // bleu Apple
    .setAuthor({
      name: `${meta.emoji} ${meta.label}`,
      url: `https://developer.apple.com/documentation/${framework}`,
    })
    .setTitle(title)
    .setURL(webUrl)
    .setDescription(truncate(abstract, 1500));

  if (kind || signature) {
    embed.addFields({
      name: kind || 'Symbole',
      value: signature ? `\`\`\`swift\n${truncate(signature, 250)}\n\`\`\`` : '*signature non disponible*',
      inline: false,
    });
  }

  embed.addFields({ name: 'Module', value: `\`${module}\``, inline: true });

  if (platforms) {
    embed.addFields({ name: 'Disponibilité', value: truncate(platforms, 1024), inline: false });
  }

  const sections = data.topicSections?.filter(s => s.title).slice(0, 5);
  if (sections?.length) {
    embed.addFields({
      name: 'Sections',
      value: sections.map(s => `• ${s.title}`).join('\n'),
      inline: false,
    });
  }

  embed.setFooter({ text: 'Apple Developer Documentation' }).setTimestamp();
  return embed;
}

export default {
  data: new SlashCommandBuilder()
    .setName('apple-doc')
    .setDescription('Affiche la doc Apple d\'un symbole (SwiftUI, UIKit, Foundation…)')
    .addStringOption(opt =>
      opt
        .setName('symbole')
        .setDescription('Nom du symbole (ex: Text, Button, URLSession)')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(opt =>
      opt
        .setName('framework')
        .setDescription('Framework à interroger (par défaut: les 8 principaux en parallèle)')
        .setRequired(false)
        .addChoices(...FRAMEWORK_CHOICES)
    ),

  async autocomplete(interaction: AutocompleteInteraction) {
    if (getIndexSize() === 0) {
      return interaction.respond([
        {
          name: 'Index non chargé — lance `bun src/scripts/build-apple-doc-index.ts`',
          value: 'index-not-loaded',
        },
      ]);
    }

    const focused = interaction.options.getFocused().toString();
    const framework = interaction.options.getString('framework') as AppleFramework | null;

    let results = searchSymbols(focused, 50);
    if (framework) {
      results = results.filter(r => r.framework === framework);
    }
    results = results.slice(0, 25);

    // Le value ne doit pas dépasser 100 chars (limite Discord)
    const choices = results
      .filter(r => r.url.length <= 100)
      .map(r => ({
        name: truncate(
          `${r.name}${r.framework !== 'unknown' ? ` · ${r.framework}` : ''}${r.abstract ? ` — ${r.abstract}` : ''}`,
          100
        ),
        value: r.url,
      }));

    await interaction.respond(choices);
  },

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const symbol = interaction.options.getString('symbole', true);
    const framework = interaction.options.getString('framework') as AppleFramework | null;

    if (symbol === 'index-not-loaded') {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            'Index non disponible',
            'L\'index local des symboles Apple n\'est pas chargé.\n' +
              'Lance `bun src/scripts/build-apple-doc-index.ts` puis redémarre le bot.'
          ),
        ],
      });
    }

    // Si l'utilisateur a sélectionné une suggestion d'autocomplete, on a un path complet.
    let result: AppleDocResult | null = null;
    if (symbol.startsWith('/documentation/')) {
      result = await fetchByDocPath(symbol);
    } else {
      result = await findSymbolDoc(symbol, framework ?? undefined);
    }

    if (!result) {
      const where = framework
        ? `dans **${FRAMEWORK_META[framework].label}**`
        : 'dans les frameworks principaux (SwiftUI, UIKit, Foundation, SwiftData, Core Data, CloudKit, Swift, Combine)';

      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            'Symbole introuvable',
            `Aucun symbole **${symbol}** trouvé ${where}.\n\n` +
              '💡 Astuces :\n' +
              '• Vérifie la casse exacte du nom (ex: `URLSession`, pas `urlsession`)\n' +
              '• Pour une méthode, utilise la signature complète (ex: `text(_:)`)\n' +
              '• Précise le framework si tu sais où chercher'
          ),
        ],
      });
    }

    const linkButton = new ButtonBuilder()
      .setLabel('Voir la doc complète')
      .setStyle(ButtonStyle.Link)
      .setURL(result.webUrl)
      .setEmoji('📖');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(linkButton);

    await interaction.editReply({
      embeds: [buildEmbed(result)],
      components: [row],
    });
  },
} satisfies Command;
