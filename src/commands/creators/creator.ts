import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { Command } from '../../types/command';
import { CreatorProfile } from '../../database/models/CreatorProfile';
import { createErrorEmbed, createInfoEmbed } from '../../utils/embeds';

const PLATFORM_EMOJIS: Record<string, string> = {
  twitch: '💜',
  youtube: '📺',
  twitter: '🐦',
  instagram: '📷',
  tiktok: '🎵',
  website: '🌐',
  discord: '💬',
};

const PLATFORM_NAMES: Record<string, string> = {
  twitch: 'Twitch',
  youtube: 'YouTube',
  twitter: 'Twitter/X',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  website: 'Site Web',
  discord: 'Discord',
};

export default {
  data: new SlashCommandBuilder()
    .setName('creator')
    .setDescription('Voir les profils des créateurs')
    .addSubcommand((sub) =>
      sub
        .setName('profile')
        .setDescription('Voir le profil d\'un créateur')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('Le créateur à afficher').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('Voir la liste de tous les créateurs')
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

    try {
      switch (subcommand) {
        case 'profile': {
          const targetUser = interaction.options.getUser('user', true);

          const profile = await CreatorProfile.findOne({
            guildId: interaction.guildId,
            userId: targetUser.id,
          });

          if (!profile) {
            return interaction.editReply({
              embeds: [createErrorEmbed('Non trouvé', `${targetUser} n'a pas de profil créateur.`)],
            });
          }

          // Build social links string
          const socialLinks = profile.socialLinks.map((link) => {
            const emoji = PLATFORM_EMOJIS[link.platform] || '🔗';
            const name = PLATFORM_NAMES[link.platform] || link.platform;
            return `${emoji} [${name}](${link.url})`;
          }).join('\n') || '*Aucun lien*';

          // Build tags string
          const tags = profile.tags.length > 0
            ? profile.tags.map((t) => `\`${t}\``).join(' ')
            : '*Aucun tag*';

          const embed = new EmbedBuilder()
            .setColor(profile.bannerColor as `#${string}`)
            .setAuthor({
              name: profile.name,
              iconURL: profile.avatarUrl || targetUser.displayAvatarURL(),
            })
            .setThumbnail(profile.avatarUrl || targetUser.displayAvatarURL({ size: 512 }))
            .setDescription(profile.description || '*Pas de description*')
            .addFields(
              { name: '🏷️ Tags', value: tags, inline: false },
              { name: '🔗 Réseaux', value: socialLinks, inline: false },
              { name: '👤 Discord', value: `${targetUser}`, inline: true }
            )
            .setFooter({ text: profile.isVerified ? '✓ Créateur vérifié' : '' })
            .setTimestamp();

          // Create buttons for main social links (only valid URLs)
          const buttons: ButtonBuilder[] = [];

          for (const link of profile.socialLinks.slice(0, 5)) {
            // Validate URL before creating button
            try {
              new URL(link.url);
              buttons.push(
                new ButtonBuilder()
                  .setLabel(PLATFORM_NAMES[link.platform] || link.platform)
                  .setStyle(ButtonStyle.Link)
                  .setURL(link.url)
                  .setEmoji(PLATFORM_EMOJIS[link.platform] || '🔗')
              );
            } catch {
              // Skip invalid URLs
              console.warn(`Invalid URL for ${link.platform}: ${link.url}`);
            }
          }

          if (buttons.length > 0) {
            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
            return interaction.editReply({ embeds: [embed], components: [row] });
          }

          return interaction.editReply({ embeds: [embed] });
        }

        case 'list': {
          const profiles = await CreatorProfile.find({
            guildId: interaction.guildId,
            featured: true,
          }).sort({ name: 1 });

          if (profiles.length === 0) {
            return interaction.editReply({
              embeds: [createInfoEmbed('Aucun créateur', 'Aucun créateur n\'est configuré sur ce serveur.')],
            });
          }

          const guild = interaction.guild;
          if (!guild) return;

          // Build creator list
          const creatorList = await Promise.all(
            profiles.map(async (p, index) => {
              const member = await guild.members.fetch(p.userId).catch(() => null);
              const status = member?.presence?.status || 'offline';
              const statusEmojis: Record<string, string> = {
                online: '🟢',
                idle: '🟡',
                dnd: '🔴',
                offline: '⚫',
                invisible: '⚫',
              };
              const statusEmoji = statusEmojis[status] || '⚫';

              const mainPlatform = p.socialLinks[0];
              const platformLink = mainPlatform
                ? ` • [${PLATFORM_EMOJIS[mainPlatform.platform] || '🔗'}](${mainPlatform.url})`
                : '';

              return `${index + 1}. ${statusEmoji} **${p.name}**${platformLink}${p.tags.length > 0 ? ` • ${p.tags[0]}` : ''}`;
            })
          );

          const embed = new EmbedBuilder()
            .setColor('#9146FF')
            .setTitle('🎬 Les Créateurs')
            .setDescription(creatorList.join('\n'))
            .setFooter({ text: `${profiles.length} créateur(s) • Utilisez /creator profile pour voir un profil` })
            .setTimestamp();

          return interaction.editReply({ embeds: [embed] });
        }
      }
    } catch (error) {
      console.error('Error in creator command:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Erreur', 'Une erreur est survenue.')],
      });
    }
  },
} satisfies Command;
