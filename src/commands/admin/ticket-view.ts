import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { Command } from '../../types/command';
import { TicketConfig } from '../../database/models/TicketConfig';
import { Ticket } from '../../database/models/Ticket';
import { createErrorEmbed } from '../../utils/embeds';

export default {
  data: new SlashCommandBuilder()
    .setName('ticket-view')
    .setDescription('Voir la configuration et les statistiques du système de tickets')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const config = await TicketConfig.findOne({ guildId: interaction.guildId! });

      if (!config) {
        return interaction.editReply({
          embeds: [createErrorEmbed(
            'Configuration introuvable',
            'Aucune configuration de tickets n\'existe. Utilise `/ticket-panel` d\'abord.'
          )],
        });
      }

      // Get stats
      const totalTickets = await Ticket.countDocuments({ guildId: interaction.guildId! });
      const openTickets = await Ticket.countDocuments({ guildId: interaction.guildId!, status: 'open' });
      const closedTickets = await Ticket.countDocuments({ guildId: interaction.guildId!, status: 'closed' });

      const panelChannel = interaction.guild?.channels.cache.get(config.panelChannelId);
      const category = interaction.guild?.channels.cache.get(config.categoryId);
      const supportRole = config.supportRoleId ? interaction.guild?.roles.cache.get(config.supportRoleId) : null;

      const embed = new EmbedBuilder()
        .setColor('#1ABC9C')
        .setTitle('🎫 Configuration du Système de Tickets')
        .addFields(
          { name: 'Canal du Panneau', value: panelChannel ? `${panelChannel}` : 'Canal introuvable', inline: true },
          { name: 'Catégorie', value: category ? category.name : 'Catégorie introuvable', inline: true },
          { name: 'Rôle Support', value: supportRole ? `${supportRole}` : 'Non configuré', inline: true },
          { name: '\u200B', value: '\u200B', inline: false },
          { name: '📊 Statistiques', value:
            `**Total de tickets:** ${totalTickets}\n` +
            `**Tickets ouverts:** ${openTickets} 🟢\n` +
            `**Tickets fermés:** ${closedTickets} 🔴\n` +
            `**Prochain numéro:** #${config.ticketCounter + 1}`,
            inline: false
          }
        )
        .setFooter({ text: 'Système de tickets Bob' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('❌ Error in ticket-view command:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Erreur', 'Une erreur est survenue.')],
      });
    }
  },
} satisfies Command;
