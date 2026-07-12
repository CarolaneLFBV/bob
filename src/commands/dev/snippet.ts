import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { Command } from '../../types/command';
import { Snippet } from '../../database/models/Snippet';
import { createErrorEmbed } from '../../utils/embeds';

export const SNIPPET_LANGUAGES = [
  { name: 'Swift', value: 'swift' },
  { name: 'Kotlin', value: 'kotlin' },
  { name: 'Dart', value: 'dart' },
  { name: 'TypeScript', value: 'typescript' },
  { name: 'JavaScript', value: 'javascript' },
  { name: 'Objective-C', value: 'objectivec' },
  { name: 'Java', value: 'java' },
  { name: 'Python', value: 'python' },
  { name: 'JSON', value: 'json' },
  { name: 'YAML', value: 'yaml' },
  { name: 'Shell', value: 'shell' },
];

export function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
}

export function buildSnippetEmbed(snippet: {
  snippetNumber: number;
  title: string;
  language: string;
  code: string;
  authorTag: string;
  authorId: string;
  usageCount: number;
  createdAt: Date;
}): EmbedBuilder {
  const fence = '```';
  const codeBlock = `${fence}${snippet.language}\n${snippet.code}\n${fence}`;

  return new EmbedBuilder()
    .setColor('#9333ea')
    .setTitle(`📎 #${snippet.snippetNumber.toString().padStart(4, '0')} — ${snippet.title}`)
    .setDescription(codeBlock.length > 4000 ? truncate(codeBlock, 4000) : codeBlock)
    .addFields(
      { name: 'Langage', value: `\`${snippet.language}\``, inline: true },
      { name: 'Auteur', value: `<@${snippet.authorId}>`, inline: true },
      { name: 'Vu', value: `${snippet.usageCount}×`, inline: true }
    )
    .setFooter({ text: `Snippet ajouté` })
    .setTimestamp(snippet.createdAt);
}

export default {
  data: new SlashCommandBuilder()
    .setName('snippet')
    .setDescription('Bibliothèque de snippets de code de la communauté')
    .addSubcommand(sub =>
      sub.setName('save').setDescription('Sauvegarde un nouveau snippet (ouvre un formulaire)')
    )
    .addSubcommand(sub =>
      sub
        .setName('get')
        .setDescription('Affiche un snippet')
        .addIntegerOption(opt =>
          opt
            .setName('numero')
            .setDescription('Numéro du snippet')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('Liste les snippets récents (optionnellement filtré par langage)')
        .addStringOption(opt =>
          opt
            .setName('langage')
            .setDescription('Filtrer par langage')
            .setRequired(false)
            .addChoices(...SNIPPET_LANGUAGES)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('delete')
        .setDescription('Supprime un de tes snippets')
        .addIntegerOption(opt =>
          opt
            .setName('numero')
            .setDescription('Numéro du snippet à supprimer')
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),

  async autocomplete(interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused().toString().trim();
    const sub = interaction.options.getSubcommand();

    const query: any = { guildId: interaction.guildId };
    if (sub === 'delete') query.authorId = interaction.user.id;

    let results;
    if (/^\d+$/.test(focused) && focused.length > 0) {
      results = await Snippet.find({
        ...query,
        snippetNumber: { $gte: parseInt(focused, 10) },
      })
        .sort({ snippetNumber: 1 })
        .limit(25);
    } else if (focused.length === 0) {
      results = await Snippet.find(query).sort({ createdAt: -1 }).limit(25);
    } else {
      results = await Snippet.find({
        ...query,
        title: { $regex: focused, $options: 'i' },
      })
        .sort({ createdAt: -1 })
        .limit(25);
    }

    await interaction.respond(
      results.map(s => ({
        name: truncate(
          `#${s.snippetNumber.toString().padStart(4, '0')} — ${s.title} [${s.language}]`,
          100
        ),
        value: s.snippetNumber,
      }))
    );
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'save') {
      const modal = new ModalBuilder().setCustomId('snippet_save_modal').setTitle('📎 Nouveau snippet');

      const title = new TextInputBuilder()
        .setCustomId('title')
        .setLabel('Titre court')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(100)
        .setPlaceholder('ex: SwiftUI: TextField avec validation live')
        .setRequired(true);

      const language = new TextInputBuilder()
        .setCustomId('language')
        .setLabel('Langage (swift, kotlin, dart, typescript…)')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(30)
        .setPlaceholder('swift')
        .setRequired(true);

      const code = new TextInputBuilder()
        .setCustomId('code')
        .setLabel('Code')
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(3800)
        .setPlaceholder('Colle ton code ici…')
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(title),
        new ActionRowBuilder<TextInputBuilder>().addComponents(language),
        new ActionRowBuilder<TextInputBuilder>().addComponents(code)
      );

      await interaction.showModal(modal);
      return;
    }

    if (sub === 'get') {
      await interaction.deferReply();
      const number = interaction.options.getInteger('numero', true);

      const snippet = await Snippet.findOneAndUpdate(
        { guildId: interaction.guildId!, snippetNumber: number },
        { $inc: { usageCount: 1 } },
        { new: true }
      );

      if (!snippet) {
        return interaction.editReply({
          embeds: [createErrorEmbed('Introuvable', `Pas de snippet #${number} sur ce serveur.`)],
        });
      }

      return interaction.editReply({ embeds: [buildSnippetEmbed(snippet)] });
    }

    if (sub === 'list') {
      await interaction.deferReply();
      const language = interaction.options.getString('langage');

      const query: any = { guildId: interaction.guildId };
      if (language) query.language = language;

      const snippets = await Snippet.find(query).sort({ createdAt: -1 }).limit(15);

      if (snippets.length === 0) {
        return interaction.editReply({
          embeds: [
            createErrorEmbed(
              'Aucun snippet',
              language
                ? `Personne n\'a encore partagé de snippet en **${language}**. Lance \`/snippet save\` pour être le ou la première.`
                : 'Aucun snippet sur ce serveur. Lance `/snippet save` pour démarrer la collection.'
            ),
          ],
        });
      }

      const embed = new EmbedBuilder()
        .setColor('#9333ea')
        .setTitle(`📚 Snippets ${language ? `· ${language}` : ''}`)
        .setDescription(
          snippets
            .map(
              s =>
                `**#${s.snippetNumber.toString().padStart(4, '0')}** · \`${s.language}\` · ${s.title}\n` +
                `↳ par <@${s.authorId}> · ${s.usageCount}× vu`
            )
            .join('\n\n')
        )
        .setFooter({ text: `${snippets.length} snippet${snippets.length > 1 ? 's' : ''} affiché${snippets.length > 1 ? 's' : ''} • /snippet get <numéro> pour voir` })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'delete') {
      await interaction.deferReply({ ephemeral: true });
      const number = interaction.options.getInteger('numero', true);

      const snippet = await Snippet.findOne({
        guildId: interaction.guildId!,
        snippetNumber: number,
      });

      if (!snippet) {
        return interaction.editReply({
          embeds: [createErrorEmbed('Introuvable', `Pas de snippet #${number}.`)],
        });
      }

      if (snippet.authorId !== interaction.user.id) {
        return interaction.editReply({
          embeds: [createErrorEmbed('Non autorisé', 'Tu ne peux supprimer que tes propres snippets.')],
        });
      }

      const confirm = new ButtonBuilder()
        .setCustomId(`snippet_delete_confirm:${snippet.snippetNumber}`)
        .setLabel('Supprimer')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️');

      const cancel = new ButtonBuilder()
        .setCustomId('snippet_delete_cancel')
        .setLabel('Annuler')
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirm, cancel);

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('#FEE75C')
            .setTitle('⚠️ Confirmer la suppression')
            .setDescription(`Supprimer le snippet **#${number} — ${snippet.title}** ?`),
        ],
        components: [row],
      });
    }
  },
} satisfies Command;
