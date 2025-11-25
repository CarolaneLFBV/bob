import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { Command } from '../../types/command';
import { VoiceConfig } from '../../database/models/VoiceConfig';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embeds';

export default {
  data: new SlashCommandBuilder()
    .setName('voice-panel')
    .setDescription('Configure le panneau de création de salons vocaux temporaires')
    .addChannelOption(option =>
      option
        .setName('panel-channel')
        .setDescription('Canal où afficher le panneau')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addChannelOption(option =>
      option
        .setName('category')
        .setDescription('Catégorie où créer les salons vocaux')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('user-limit')
        .setDescription('Limite d\'utilisateurs par défaut (0 = illimité)')
        .setMinValue(0)
        .setMaxValue(99)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const panelChannel = interaction.options.getChannel('panel-channel', true);
      const category = interaction.options.getChannel('category', true);
      const userLimit = interaction.options.getInteger('user-limit') ?? 0;

      // Validate channel types
      if (panelChannel.type !== ChannelType.GuildText) {
        return interaction.editReply({
          embeds: [createErrorEmbed('Erreur', 'Le canal du panneau doit être un canal textuel.')],
        });
      }

      if (category.type !== ChannelType.GuildCategory) {
        return interaction.editReply({
          embeds: [createErrorEmbed('Erreur', 'Vous devez sélectionner une catégorie.')],
        });
      }

      // Save configuration to database
      await VoiceConfig.findOneAndUpdate(
        { guildId: interaction.guildId! },
        {
          guildId: interaction.guildId!,
          panelChannelId: panelChannel.id,
          categoryId: category.id,
          defaultUserLimit: userLimit,
        },
        { upsert: true, new: true }
      );

      // Create the voice panel embed
      const panelEmbed = new EmbedBuilder()
        .setColor('#1ABC9C')
        .setTitle('🎤 Salons Vocaux Temporaires')
        .setDescription(
          '**Crée ton propre salon vocal !**\n\n' +
          'Clique sur le bouton ci-dessous pour créer un salon vocal personnalisé.\n' +
          'Le salon sera automatiquement supprimé quand il sera vide.\n\n' +
          '**Fonctionnement:**\n' +
          '• Choisis un nom pour ton salon\n' +
          '• Le salon est créé instantanément\n' +
          '• Il disparaît automatiquement quand tout le monde part'
        )
        .setFooter({ text: 'Salons vocaux temporaires • Clique pour commencer' })
        .setTimestamp();

      // Create the button
      const button = new ButtonBuilder()
        .setCustomId('create_voice')
        .setLabel('Créer un Salon Vocal')
        .setEmoji('🎤')
        .setStyle(ButtonStyle.Success);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

      // Send the panel to the specified channel
      const channel = await interaction.client.channels.fetch(panelChannel.id);
      if (channel?.isTextBased()) {
        await channel.send({
          embeds: [panelEmbed],
          components: [row],
        });
      }

      // Confirm to the admin
      const confirmEmbed = createSuccessEmbed(
        'Panneau vocal créé',
        `Le panneau a été créé dans ${panelChannel}\n\n` +
        `**Catégorie:** ${category.name}\n` +
        `**Limite utilisateurs:** ${userLimit === 0 ? 'Illimitée' : userLimit}`
      );

      await interaction.editReply({ embeds: [confirmEmbed] });
    } catch (error) {
      console.error('Error in voice-panel command:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Erreur', 'Une erreur est survenue lors de la création du panneau.')],
      });
    }
  },
} satisfies Command;
