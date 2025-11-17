import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { Command } from '../../types/command';
import { WelcomeConfig } from '../../database/models/WelcomeConfig';
import { createErrorEmbed } from '../../utils/embeds';

export default {
  data: new SlashCommandBuilder()
    .setName('welcome-view')
    .setDescription('Voir la configuration actuelle du système de bienvenue')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const config = await WelcomeConfig.findOne({ guildId: interaction.guildId! });

      if (!config) {
        return interaction.editReply({
          embeds: [createErrorEmbed(
            'Configuration introuvable',
            'Aucune configuration de bienvenue n\'existe. Utilise `/welcome-setup` d\'abord.'
          )],
        });
      }

      const channel = interaction.guild?.channels.cache.get(config.channelId);
      const status = config.enabled ? '✅ Activé' : '❌ Désactivé';

      const embed = new EmbedBuilder()
        .setColor(config.embedColor as any)
        .setTitle('🎉 Configuration du Système de Bienvenue')
        .addFields(
          { name: 'Statut', value: status, inline: true },
          { name: 'Canal', value: channel ? `${channel}` : 'Canal introuvable', inline: true },
          { name: 'Mention', value: config.mentionUser ? 'Oui' : 'Non', inline: true },
          { name: 'Titre', value: `\`\`\`${config.title}\`\`\``, inline: false },
          { name: 'Description', value: `\`\`\`${config.description}\`\`\``, inline: false },
          { name: 'Couleur', value: config.embedColor, inline: true },
          { name: 'Image', value: config.imageUrl || 'Aucune', inline: true }
        )
        .setFooter({ text: 'Utilise /welcome-edit pour modifier' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('❌ Error in welcome-view command:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Erreur', 'Une erreur est survenue.')],
      });
    }
  },
} satisfies Command;
