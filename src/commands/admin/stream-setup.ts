import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import { Command } from '../../types/command';
import { StreamConfig } from '../../database/models/StreamConfig';
import { createSuccessEmbed, createErrorEmbed, createInfoEmbed } from '../../utils/embeds';

export default {
  data: new SlashCommandBuilder()
    .setName('stream-setup')
    .setDescription('Configurer les notifications de stream')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('enable')
        .setDescription('Activer les notifications de stream')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Salon pour les notifications')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addRoleOption((opt) =>
          opt
            .setName('role')
            .setDescription('Rôle à mentionner (optionnel)')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('disable').setDescription('Désactiver les notifications de stream')
    )
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Ajouter un streamer à surveiller')
        .addStringOption((opt) =>
          opt
            .setName('platform')
            .setDescription('Plateforme')
            .setRequired(true)
            .addChoices(
              { name: 'Twitch', value: 'twitch' },
              { name: 'YouTube', value: 'youtube' }
            )
        )
        .addStringOption((opt) =>
          opt
            .setName('channel_id')
            .setDescription('Nom Twitch ou ID de chaîne YouTube')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('name')
            .setDescription('Nom d\'affichage du streamer')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Retirer un streamer')
        .addStringOption((opt) =>
          opt
            .setName('channel_id')
            .setDescription('Nom Twitch ou ID de chaîne YouTube')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('Voir les streamers configurés')
    )
    .addSubcommand((sub) =>
      sub
        .setName('role')
        .setDescription('Modifier le rôle à mentionner')
        .addRoleOption((opt) =>
          opt.setName('role').setDescription('Rôle (laisser vide pour retirer)')
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      return interaction.reply({
        embeds: [createErrorEmbed('Erreur', 'Cette commande doit être utilisée dans un serveur.')],
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const subcommand = interaction.options.getSubcommand();

    try {
      let config = await StreamConfig.findOne({ guildId: interaction.guildId });
      if (!config) {
        config = new StreamConfig({ guildId: interaction.guildId });
      }

      switch (subcommand) {
        case 'enable': {
          const channel = interaction.options.getChannel('channel', true);
          const role = interaction.options.getRole('role');

          config.enabled = true;
          config.announcementChannelId = channel.id;
          if (role) config.mentionRoleId = role.id;

          await config.save();

          // Check if Twitch is configured
          const twitchConfigured = process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET;

          return interaction.editReply({
            embeds: [createSuccessEmbed(
              'Notifications activées',
              `Les notifications de stream seront envoyées dans ${channel}.${role ? `\nRôle mentionné: ${role}` : ''}\n\n${
                twitchConfigured
                  ? '✅ API Twitch configurée'
                  : '⚠️ API Twitch non configurée - ajoutez TWITCH_CLIENT_ID et TWITCH_CLIENT_SECRET dans .env.local'
              }`
            )],
          });
        }

        case 'disable': {
          config.enabled = false;
          await config.save();
          return interaction.editReply({
            embeds: [createSuccessEmbed('Notifications désactivées', 'Les notifications de stream sont maintenant désactivées.')],
          });
        }

        case 'add': {
          const platform = interaction.options.getString('platform', true) as 'twitch' | 'youtube';
          const channelId = interaction.options.getString('channel_id', true);
          const name = interaction.options.getString('name', true);

          // Check if already exists
          const exists = config.streamers.find(
            (s) => s.channelId.toLowerCase() === channelId.toLowerCase() && s.platform === platform
          );

          if (exists) {
            return interaction.editReply({
              embeds: [createErrorEmbed('Déjà configuré', `Ce streamer est déjà dans la liste.`)],
            });
          }

          config.streamers.push({
            name,
            platform,
            channelId: channelId.toLowerCase(),
            isCurrentlyLive: false,
          });

          await config.save();

          const url =
            platform === 'twitch'
              ? `https://twitch.tv/${channelId}`
              : `https://youtube.com/channel/${channelId}`;

          return interaction.editReply({
            embeds: [createSuccessEmbed(
              'Streamer ajouté',
              `**${name}** a été ajouté à la liste.\nPlateforme: ${platform}\nLien: ${url}`
            )],
          });
        }

        case 'remove': {
          const channelId = interaction.options.getString('channel_id', true);

          const index = config.streamers.findIndex(
            (s) => s.channelId.toLowerCase() === channelId.toLowerCase()
          );

          if (index === -1) {
            return interaction.editReply({
              embeds: [createErrorEmbed('Non trouvé', `Ce streamer n'est pas dans la liste.`)],
            });
          }

          const removed = config.streamers.splice(index, 1)[0]!;
          await config.save();

          return interaction.editReply({
            embeds: [createSuccessEmbed('Streamer retiré', `**${removed.name}** a été retiré de la liste.`)],
          });
        }

        case 'list': {
          if (config.streamers.length === 0) {
            return interaction.editReply({
              embeds: [createInfoEmbed('Aucun streamer', 'Aucun streamer n\'est configuré.')],
            });
          }

          const streamerList = config.streamers.map((s) => {
            const statusEmoji = s.isCurrentlyLive ? '🔴' : '⚫';
            const platformEmoji = s.platform === 'twitch' ? '💜' : '📺';
            return `${statusEmoji} ${platformEmoji} **${s.name}** (${s.channelId})`;
          }).join('\n');

          return interaction.editReply({
            embeds: [createInfoEmbed('Streamers configurés', `
**Statut:** ${config.enabled ? '✅ Activé' : '❌ Désactivé'}
**Salon:** ${config.announcementChannelId ? `<#${config.announcementChannelId}>` : 'Non configuré'}
**Rôle:** ${config.mentionRoleId ? `<@&${config.mentionRoleId}>` : 'Aucun'}

**Liste des streamers:**
${streamerList}

🔴 = En live | ⚫ = Hors ligne
💜 = Twitch | 📺 = YouTube
            `)],
          });
        }

        case 'role': {
          const role = interaction.options.getRole('role');
          config.mentionRoleId = role?.id;
          await config.save();

          return interaction.editReply({
            embeds: [createSuccessEmbed(
              'Rôle modifié',
              role
                ? `Le rôle ${role} sera mentionné lors des notifications.`
                : 'Aucun rôle ne sera mentionné.'
            )],
          });
        }
      }
    } catch (error) {
      console.error('Error in stream-setup command:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Erreur', 'Une erreur est survenue.')],
      });
    }
  },
} satisfies Command;
