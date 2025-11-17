import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { Command } from '../../types/command';
import { WelcomeConfig } from '../../database/models/WelcomeConfig';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embeds';

export default {
  data: new SlashCommandBuilder()
    .setName('welcome-toggle')
    .setDescription('Activer ou désactiver le système de bienvenue')
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

      // Toggle enabled status
      config.enabled = !config.enabled;
      await config.save();

      const status = config.enabled ? '✅ activé' : '❌ désactivé';
      const color = config.enabled ? '#2ECC71' : '#D35400';

      const embed = createSuccessEmbed(
        'Système de bienvenue',
        `Le système de bienvenue est maintenant ${status}.`
      ).setColor(color as any);

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('❌ Error in welcome-toggle command:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Erreur', 'Une erreur est survenue.')],
      });
    }
  },
} satisfies Command;
