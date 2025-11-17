import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType } from 'discord.js';
import { Command } from '../../types/command';
import { WelcomeConfig } from '../../database/models/WelcomeConfig';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embeds';

export default {
  data: new SlashCommandBuilder()
    .setName('welcome-edit')
    .setDescription('Modifier la configuration du système de bienvenue')
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Nouveau canal de bienvenue')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('title')
        .setDescription('Nouveau titre')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('description')
        .setDescription('Nouvelle description')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('color')
        .setDescription('Nouvelle couleur (format hex)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('image')
        .setDescription('Nouvelle URL d\'image')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option
        .setName('mention')
        .setDescription('Mentionner l\'utilisateur ?')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option
        .setName('enabled')
        .setDescription('Activer/désactiver le système')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      // Check if config exists
      const config = await WelcomeConfig.findOne({ guildId: interaction.guildId! });

      if (!config) {
        return interaction.editReply({
          embeds: [createErrorEmbed(
            'Configuration introuvable',
            'Aucune configuration de bienvenue n\'existe. Utilise `/welcome-setup` d\'abord.'
          )],
        });
      }

      // Get options
      const channel = interaction.options.getChannel('channel');
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const color = interaction.options.getString('color');
      const image = interaction.options.getString('image');
      const mention = interaction.options.getBoolean('mention');
      const enabled = interaction.options.getBoolean('enabled');

      // Validate color if provided
      if (color && !/^#[0-9A-F]{6}$/i.test(color)) {
        return interaction.editReply({
          embeds: [createErrorEmbed('Erreur', 'La couleur doit être au format hexadécimal (ex: #2ECC71)')],
        });
      }

      // Update fields
      const updates: string[] = [];

      if (channel) {
        config.channelId = channel.id;
        updates.push(`Canal: ${channel}`);
      }
      if (title !== null) {
        config.title = title;
        updates.push(`Titre: ${title}`);
      }
      if (description !== null) {
        config.description = description;
        updates.push(`Description: ${description.substring(0, 50)}...`);
      }
      if (color !== null) {
        config.embedColor = color;
        updates.push(`Couleur: ${color}`);
      }
      if (image !== null) {
        config.imageUrl = image || undefined;
        updates.push(`Image: ${image ? 'Modifiée' : 'Supprimée'}`);
      }
      if (mention !== null) {
        config.mentionUser = mention;
        updates.push(`Mention: ${mention ? 'Activée' : 'Désactivée'}`);
      }
      if (enabled !== null) {
        config.enabled = enabled;
        updates.push(`Système: ${enabled ? 'Activé' : 'Désactivé'}`);
      }

      // Save changes
      await config.save();

      const embed = createSuccessEmbed(
        'Configuration modifiée',
        `**Modifications appliquées:**\n${updates.map(u => `• ${u}`).join('\n')}`
      );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('❌ Error in welcome-edit command:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Erreur', 'Une erreur est survenue lors de la modification.')],
      });
    }
  },
} satisfies Command;
