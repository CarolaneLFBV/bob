import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../types/command';
import { VoiceTime } from '../../database/models/VoiceTime';
import { VoiceSession } from '../../database/models/VoiceSession';
import { createErrorEmbed } from '../../utils/embeds';

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const remainingHours = hours % 24;
  const remainingMinutes = minutes % 60;
  const remainingSeconds = seconds % 60;

  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days}j`);
  }
  if (remainingHours > 0 || days > 0) {
    parts.push(`${remainingHours}h`);
  }
  if (remainingMinutes > 0 || hours > 0) {
    parts.push(`${remainingMinutes}m`);
  }
  parts.push(`${remainingSeconds}s`);

  return parts.join(' ');
}

export default {
  data: new SlashCommandBuilder()
    .setName('voice-time')
    .setDescription('Voir ton temps total passé en vocal sur ce serveur'),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      // Get stored total time
      const voiceTime = await VoiceTime.findOne({
        guildId: interaction.guildId,
        userId: interaction.user.id,
      });

      let totalTime = voiceTime?.totalTime ?? 0;

      // Check for active session and add current session time
      const activeSession = await VoiceSession.findOne({
        guildId: interaction.guildId,
        userId: interaction.user.id,
      });

      let currentSessionTime = 0;
      if (activeSession) {
        currentSessionTime = Date.now() - activeSession.startedAt.getTime();
      }

      const grandTotal = totalTime + currentSessionTime;

      const embed = new EmbedBuilder()
        .setColor('#1ABC9C')
        .setTitle('🎙️ Temps en vocal')
        .setDescription(`Voici ton temps passé en vocal sur **${interaction.guild?.name}**`)
        .addFields({
          name: '⏱️ Temps total',
          value: grandTotal > 0 ? `**${formatDuration(grandTotal)}**` : '*Aucun temps enregistré*',
          inline: true,
        })
        .setFooter({ text: `Demandé par ${interaction.user.username}` })
        .setTimestamp();

      if (activeSession) {
        embed.addFields({
          name: '🔴 Session en cours',
          value: `**${formatDuration(currentSessionTime)}**`,
          inline: true,
        });
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching voice time:', error);
      return interaction.editReply({
        embeds: [createErrorEmbed('Erreur', 'Impossible de récupérer ton temps en vocal.')],
      });
    }
  },
} satisfies Command;
