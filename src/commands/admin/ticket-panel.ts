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
import { TicketConfig } from '../../database/models/TicketConfig';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embeds';

export default {
  data: new SlashCommandBuilder()
    .setName('ticket-panel')
    .setDescription('Configure et affiche le panneau de ticketing')
    .addChannelOption(option =>
      option
        .setName('panel-channel')
        .setDescription('Canal où afficher le panneau de tickets')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addChannelOption(option =>
      option
        .setName('category')
        .setDescription('Catégorie où créer les tickets')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true)
    )
    .addRoleOption(option =>
      option
        .setName('support-role')
        .setDescription('Rôle du support (sera pingé dans chaque ticket)')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const panelChannel = interaction.options.getChannel('panel-channel', true);
      const category = interaction.options.getChannel('category', true);
      const supportRole = interaction.options.getRole('support-role');

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
      await TicketConfig.findOneAndUpdate(
        { guildId: interaction.guildId! },
        {
          guildId: interaction.guildId!,
          panelChannelId: panelChannel.id,
          categoryId: category.id,
          supportRoleId: supportRole?.id,
          ticketCounter: 0,
        },
        { upsert: true, new: true }
      );

      // Create the ticket panel embed
      const panelEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🎫 Support Tickets')
        .setDescription(
          '**Besoin d\'aide ?**\n\n' +
          'Cliquez sur le bouton ci-dessous pour créer un ticket de support.\n' +
          'Notre équipe vous répondra dès que possible.\n\n' +
          '**Règles:**\n' +
          '• Un seul ticket ouvert par personne\n' +
          '• Soyez patient et respectueux\n' +
          '• Décrivez clairement votre problème'
        )
        .setFooter({ text: 'Système de tickets • Cliquez sur le bouton pour commencer' })
        .setTimestamp();

      // Create the button
      const button = new ButtonBuilder()
        .setCustomId('create_ticket')
        .setLabel('Créer un Ticket')
        .setEmoji('🎫')
        .setStyle(ButtonStyle.Primary);

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
        'Panneau de tickets créé',
        `Le panneau a été créé dans ${panelChannel}\n\n` +
        `**Catégorie:** ${category.name}\n` +
        `**Rôle Support:** ${supportRole ? supportRole.name : 'Non défini'}`
      );

      await interaction.editReply({ embeds: [confirmEmbed] });
    } catch (error) {
      console.error('❌ Error in ticket-panel command:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Erreur', 'Une erreur est survenue lors de la création du panneau.')],
      });
    }
  },
} satisfies Command;
