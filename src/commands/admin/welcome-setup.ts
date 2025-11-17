import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType } from 'discord.js';
import { Command } from '../../types/command';
import { WelcomeConfig } from '../../database/models/WelcomeConfig';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embeds';

export default {
  data: new SlashCommandBuilder()
    .setName('welcome-setup')
    .setDescription('Configure le système de messages de bienvenue')
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Canal où envoyer les messages de bienvenue')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('title')
        .setDescription('Titre du message (utilise {user}, {server}, {memberCount})')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('description')
        .setDescription('Description du message (utilise {user}, {user.mention}, {server}, {memberCount})')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('color')
        .setDescription('Couleur de l\'embed (format hex, ex: #5865F2)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('image')
        .setDescription('URL de l\'image de fond')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option
        .setName('mention')
        .setDescription('Mentionner l\'utilisateur dans le message ?')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option
        .setName('enabled')
        .setDescription('Activer ou désactiver le système de bienvenue')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const channel = interaction.options.getChannel('channel', true);
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const color = interaction.options.getString('color');
      const image = interaction.options.getString('image');
      const mention = interaction.options.getBoolean('mention');
      const enabled = interaction.options.getBoolean('enabled');

      // Validate channel type
      if (channel.type !== ChannelType.GuildText) {
        return interaction.editReply({
          embeds: [createErrorEmbed('Erreur', 'Le canal doit être un canal textuel.')],
        });
      }

      // Validate color format if provided
      if (color && !/^#[0-9A-F]{6}$/i.test(color)) {
        return interaction.editReply({
          embeds: [createErrorEmbed('Erreur', 'La couleur doit être au format hexadécimal (ex: #5865F2)')],
        });
      }

      // Update or create welcome configuration
      const updateData: any = {
        guildId: interaction.guildId!,
        channelId: channel.id,
      };

      if (title !== null) updateData.title = title;
      if (description !== null) updateData.description = description;
      if (color !== null) updateData.embedColor = color;
      if (image !== null) updateData.imageUrl = image;
      if (mention !== null) updateData.mentionUser = mention;
      if (enabled !== null) updateData.enabled = enabled;

      await WelcomeConfig.findOneAndUpdate(
        { guildId: interaction.guildId! },
        updateData,
        { upsert: true, new: true }
      );

      const statusText = enabled === false ? '❌ désactivé' : '✅ activé';
      const embed = createSuccessEmbed(
        'Configuration enregistrée',
        `Le système de bienvenue a été configuré et est ${statusText}.\n\n` +
        `**Canal:** ${channel}\n` +
        `**Variables disponibles:** {user}, {user.mention}, {server}, {memberCount}`
      );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('❌ Error in welcome-setup command:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Erreur', 'Une erreur est survenue lors de la configuration.')],
      });
    }
  },
} satisfies Command;
