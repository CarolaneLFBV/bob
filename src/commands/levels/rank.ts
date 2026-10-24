import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { Command } from '../../types/command';
import { UserLevel } from '../../database/models/UserLevel';
import { LevelConfig } from '../../database/models/LevelConfig';
import { xpProgress, progressBar, formatNumber, xpForLevel } from '../../utils/levels';
import { createErrorEmbed } from '../../utils/embeds';

export default {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Voir ton niveau et ton XP')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('Utilisateur à vérifier (optionnel)')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      return interaction.reply({
        embeds: [createErrorEmbed('Erreur', 'Cette commande doit être utilisée dans un serveur.')],
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    try {
      // Check if level system is enabled
      const config = await LevelConfig.findOne({ guildId: interaction.guildId });
      if (!config?.enabled) {
        return interaction.editReply({
          embeds: [createErrorEmbed('Système désactivé', 'Le système de niveaux n\'est pas activé sur ce serveur.')],
        });
      }

      const targetUser = interaction.options.getUser('user') || interaction.user;

      // Get user level data
      const userLevel = await UserLevel.findOne({
        guildId: interaction.guildId,
        userId: targetUser.id,
      });

      if (!userLevel) {
        return interaction.editReply({
          embeds: [createErrorEmbed('Aucune donnée', `${targetUser.username} n'a pas encore d'XP.`)],
        });
      }

      // Calculate rank
      const rank = await UserLevel.countDocuments({
        guildId: interaction.guildId,
        xp: { $gt: userLevel.xp },
      }) + 1;

      // Calculate progress
      const progress = xpProgress(userLevel.xp);
      const bar = progressBar(progress.percentage, 12);

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setAuthor({
          name: targetUser.username,
          iconURL: targetUser.displayAvatarURL(),
        })
        .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
        .addFields(
          {
            name: '🏆 Rang',
            value: `#${rank}`,
            inline: true,
          },
          {
            name: '⭐ Niveau',
            value: `${userLevel.level}`,
            inline: true,
          },
          {
            name: '✨ XP Total',
            value: formatNumber(userLevel.xp),
            inline: true,
          },
          {
            name: '📊 Progression',
            value: `${bar}\n${formatNumber(progress.current)} / ${formatNumber(progress.required)} XP (${progress.percentage}%)`,
            inline: false,
          },
          {
            name: '💬 Messages',
            value: formatNumber(userLevel.totalMessages),
            inline: true,
          },
          {
            name: '📝 XP Messages',
            value: formatNumber(userLevel.messageXp),
            inline: true,
          }
        )
        .setFooter({ text: `Prochain niveau: ${xpForLevel(userLevel.level)} XP requis` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in rank command:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Erreur', 'Une erreur est survenue.')],
      });
    }
  },
} satisfies Command;
