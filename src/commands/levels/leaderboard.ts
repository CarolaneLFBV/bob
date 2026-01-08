import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { Command } from '../../types/command';
import { UserLevel } from '../../database/models/UserLevel';
import { VoiceTime } from '../../database/models/VoiceTime';
import { LevelConfig } from '../../database/models/LevelConfig';
import { formatNumber } from '../../utils/levels';
import { createErrorEmbed } from '../../utils/embeds';

const MEDALS = ['🥇', '🥈', '🥉'];
const PAGE_SIZE = 10;

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export default {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Voir les classements du serveur')
    .addSubcommand((sub) =>
      sub
        .setName('xp')
        .setDescription('Classement par XP/Niveau')
        .addIntegerOption((opt) =>
          opt.setName('page').setDescription('Page du classement').setMinValue(1)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('voice')
        .setDescription('Classement par temps en vocal')
        .addIntegerOption((opt) =>
          opt.setName('page').setDescription('Page du classement').setMinValue(1)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('messages')
        .setDescription('Classement par nombre de messages')
        .addIntegerOption((opt) =>
          opt.setName('page').setDescription('Page du classement').setMinValue(1)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      return interaction.reply({
        embeds: [createErrorEmbed('Erreur', 'Cette commande doit être utilisée dans un serveur.')],
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    const subcommand = interaction.options.getSubcommand();
    const page = interaction.options.getInteger('page') || 1;
    const skip = (page - 1) * PAGE_SIZE;

    try {
      const guild = interaction.guild;
      if (!guild) return;

      switch (subcommand) {
        case 'xp': {
          // Check if level system is enabled
          const config = await LevelConfig.findOne({ guildId: interaction.guildId });
          if (!config?.enabled) {
            return interaction.editReply({
              embeds: [createErrorEmbed('Système désactivé', 'Le système de niveaux n\'est pas activé.')],
            });
          }

          const totalUsers = await UserLevel.countDocuments({ guildId: interaction.guildId });
          const totalPages = Math.ceil(totalUsers / PAGE_SIZE);

          if (page > totalPages && totalPages > 0) {
            return interaction.editReply({
              embeds: [createErrorEmbed('Page invalide', `Il n'y a que ${totalPages} page(s).`)],
            });
          }

          const users = await UserLevel.find({ guildId: interaction.guildId })
            .sort({ xp: -1 })
            .skip(skip)
            .limit(PAGE_SIZE);

          if (users.length === 0) {
            return interaction.editReply({
              embeds: [createErrorEmbed('Aucune donnée', 'Personne n\'a encore d\'XP.')],
            });
          }

          const leaderboardLines = await Promise.all(
            users.map(async (user, index) => {
              const rank = skip + index + 1;
              const medal = rank <= 3 ? MEDALS[rank - 1] : `\`${rank}.\``;
              const member = await guild.members.fetch(user.userId).catch(() => null);
              const name = member?.displayName || 'Utilisateur inconnu';

              return `${medal} **${name}**\n┗ Niveau ${user.level} • ${formatNumber(user.xp)} XP`;
            })
          );

          // Find user's rank
          const userRank = await UserLevel.countDocuments({
            guildId: interaction.guildId,
            xp: { $gt: (await UserLevel.findOne({ guildId: interaction.guildId, userId: interaction.user.id }))?.xp || 0 },
          }) + 1;

          const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🏆 Classement XP')
            .setDescription(leaderboardLines.join('\n\n'))
            .setFooter({ text: `Page ${page}/${totalPages || 1} • Ton rang: #${userRank}` })
            .setTimestamp();

          return interaction.editReply({ embeds: [embed] });
        }

        case 'voice': {
          const totalUsers = await VoiceTime.countDocuments({ guildId: interaction.guildId });
          const totalPages = Math.ceil(totalUsers / PAGE_SIZE);

          if (page > totalPages && totalPages > 0) {
            return interaction.editReply({
              embeds: [createErrorEmbed('Page invalide', `Il n'y a que ${totalPages} page(s).`)],
            });
          }

          const users = await VoiceTime.find({ guildId: interaction.guildId })
            .sort({ totalTime: -1 })
            .skip(skip)
            .limit(PAGE_SIZE);

          if (users.length === 0) {
            return interaction.editReply({
              embeds: [createErrorEmbed('Aucune donnée', 'Personne n\'a encore de temps vocal.')],
            });
          }

          const leaderboardLines = await Promise.all(
            users.map(async (user, index) => {
              const rank = skip + index + 1;
              const medal = rank <= 3 ? MEDALS[rank - 1] : `\`${rank}.\``;
              const member = await guild.members.fetch(user.userId).catch(() => null);
              const name = member?.displayName || 'Utilisateur inconnu';

              return `${medal} **${name}**\n┗ 🎤 ${formatDuration(user.totalTime)}`;
            })
          );

          // Find user's rank
          const userVoiceTime = await VoiceTime.findOne({
            guildId: interaction.guildId,
            userId: interaction.user.id,
          });
          const userRank = await VoiceTime.countDocuments({
            guildId: interaction.guildId,
            totalTime: { $gt: userVoiceTime?.totalTime || 0 },
          }) + 1;

          const embed = new EmbedBuilder()
            .setColor('#3498DB')
            .setTitle('🎤 Classement Temps Vocal')
            .setDescription(leaderboardLines.join('\n\n'))
            .setFooter({ text: `Page ${page}/${totalPages || 1} • Ton rang: #${userRank}` })
            .setTimestamp();

          return interaction.editReply({ embeds: [embed] });
        }

        case 'messages': {
          // Check if level system is enabled (messages are tracked there)
          const config = await LevelConfig.findOne({ guildId: interaction.guildId });
          if (!config?.enabled) {
            return interaction.editReply({
              embeds: [createErrorEmbed('Système désactivé', 'Le système de niveaux n\'est pas activé.')],
            });
          }

          const totalUsers = await UserLevel.countDocuments({
            guildId: interaction.guildId,
            totalMessages: { $gt: 0 },
          });
          const totalPages = Math.ceil(totalUsers / PAGE_SIZE);

          if (page > totalPages && totalPages > 0) {
            return interaction.editReply({
              embeds: [createErrorEmbed('Page invalide', `Il n'y a que ${totalPages} page(s).`)],
            });
          }

          const users = await UserLevel.find({
            guildId: interaction.guildId,
            totalMessages: { $gt: 0 },
          })
            .sort({ totalMessages: -1 })
            .skip(skip)
            .limit(PAGE_SIZE);

          if (users.length === 0) {
            return interaction.editReply({
              embeds: [createErrorEmbed('Aucune donnée', 'Personne n\'a encore envoyé de messages.')],
            });
          }

          const leaderboardLines = await Promise.all(
            users.map(async (user, index) => {
              const rank = skip + index + 1;
              const medal = rank <= 3 ? MEDALS[rank - 1] : `\`${rank}.\``;
              const member = await guild.members.fetch(user.userId).catch(() => null);
              const name = member?.displayName || 'Utilisateur inconnu';

              return `${medal} **${name}**\n┗ 💬 ${formatNumber(user.totalMessages)} messages`;
            })
          );

          // Find user's rank
          const userData = await UserLevel.findOne({
            guildId: interaction.guildId,
            userId: interaction.user.id,
          });
          const userRank = await UserLevel.countDocuments({
            guildId: interaction.guildId,
            totalMessages: { $gt: userData?.totalMessages || 0 },
          }) + 1;

          const embed = new EmbedBuilder()
            .setColor('#E91E63')
            .setTitle('💬 Classement Messages')
            .setDescription(leaderboardLines.join('\n\n'))
            .setFooter({ text: `Page ${page}/${totalPages || 1} • Ton rang: #${userRank}` })
            .setTimestamp();

          return interaction.editReply({ embeds: [embed] });
        }
      }
    } catch (error) {
      console.error('Error in leaderboard command:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Erreur', 'Une erreur est survenue.')],
      });
    }
  },
} satisfies Command;
