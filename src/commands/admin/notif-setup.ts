import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import type { Command } from '../../types/command';
import { NotificationConfig } from '../../database/models/NotificationConfig';
import {
  fetchLatestArticle,
  fetchKeepioIosRelease,
  fetchKeepioAndroidRelease,
  isKeepioAndroidConfigured,
  primeNotificationCursors,
  buildArticleMessage,
  buildKeepioMessage,
  buildFeatureAnnouncement,
} from '../../services/contentNotifier';
import { createSuccessEmbed, createErrorEmbed, createInfoEmbed } from '../../utils/embeds';
import { APPLE_NEWS_CURIOUS_ROLE_ID } from '../../config/appleNews';
import { KEEPIO_IOS_ROLE_ID, KEEPIO_ANDROID_ROLE_ID } from '../../config/notifications';

const roleMention = (id?: string) => (id ? `<@&${id}>` : '');

export default {
  data: new SlashCommandBuilder()
    .setName('notif-setup')
    .setDescription('Configurer les notifications d\'articles et de versions Keepio')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('enable')
        .setDescription('Activer les notifications (articles: @🍎・Curious, Keepio: rôles iOS et Android)')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Salon des annonces')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('disable').setDescription('Désactiver les notifications')
    )
    .addSubcommand((sub) =>
      sub
        .setName('role')
        .setDescription('Changer le rôle mentionné')
        .addStringOption((opt) =>
          opt
            .setName('type')
            .setDescription('Type de notification')
            .setRequired(true)
            .addChoices(
              { name: 'Articles', value: 'news' },
              { name: 'Keepio iOS', value: 'keepio-ios' },
              { name: 'Keepio Android', value: 'keepio-android' }
            )
        )
        .addRoleOption((opt) =>
          opt.setName('role').setDescription('Rôle (laisser vide pour retirer)')
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('preview')
        .setDescription('Prévisualiser une notification (visible par vous seul, sans ping)')
        .addStringOption((opt) =>
          opt
            .setName('type')
            .setDescription('Type de notification')
            .setRequired(true)
            .addChoices(
              { name: 'Dernier article', value: 'news' },
              { name: 'Version actuelle de Keepio iOS', value: 'keepio-ios' },
              { name: 'Version actuelle de Keepio Android', value: 'keepio-android' },
              { name: 'Annonce des fonctionnalités', value: 'announce' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('announce')
        .setDescription('Poster l\'annonce de lancement des notifications (avec @here)')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Salon (par défaut : salon des annonces configuré)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('status').setDescription('Voir la configuration actuelle')
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      return interaction.reply({
        embeds: [createErrorEmbed('Erreur', 'Cette commande doit être utilisée dans un serveur.')],
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const subcommand = interaction.options.getSubcommand();

    try {
      let config = await NotificationConfig.findOne({ guildId: interaction.guild.id });
      if (!config) {
        config = new NotificationConfig({ guildId: interaction.guild.id });
      }

      switch (subcommand) {
        case 'enable': {
          const channel = interaction.options.getChannel('channel', true);
          const roles = await interaction.guild.roles.fetch();

          // Les articles pingent le rôle des news Apple (🍎・Curious)
          const news = roles.get(config.newsRoleId ?? APPLE_NEWS_CURIOUS_ROLE_ID) ?? null;
          const keepioIos = roles.get(config.keepioIosRoleId ?? KEEPIO_IOS_ROLE_ID) ?? null;
          const keepioAndroid = roles.get(config.keepioAndroidRoleId ?? KEEPIO_ANDROID_ROLE_ID) ?? null;

          config.enabled = true;
          config.channelId = channel.id;
          config.newsRoleId = news?.id;
          config.keepioIosRoleId = keepioIos?.id;
          config.keepioAndroidRoleId = keepioAndroid?.id;

          let warnings: string[];
          try {
            warnings = await primeNotificationCursors(config);
          } catch (error) {
            return interaction.editReply({
              embeds: [createErrorEmbed('Erreur', `${(error as Error).message}. Réessayez dans un instant.`)],
            });
          }
          if (!news) warnings.push('⚠️ Rôle 🍎・Curious introuvable : utilisez `/notif-setup role type:Articles`.');
          if (!keepioIos) warnings.push('⚠️ Rôle Keepio iOS introuvable : utilisez `/notif-setup role type:Keepio iOS`.');
          if (!keepioAndroid) warnings.push('⚠️ Rôle Keepio Android introuvable : utilisez `/notif-setup role type:Keepio Android`.');

          await config.save();

          const androidVersion =
            config.lastKeepioAndroidVersion === 'none' ? 'pas encore en production' : config.lastKeepioAndroidVersion ?? '—';

          return interaction.editReply({
            embeds: [createSuccessEmbed(
              'Notifications activées',
              `Les nouveaux articles et versions de Keepio seront annoncés dans ${channel}, en mentionnant uniquement le rôle correspondant.\n\n` +
              `Articles: ${news ?? 'Aucun'}\nKeepio iOS: ${keepioIos ?? 'Aucun'}\nKeepio Android: ${keepioAndroid ?? 'Aucun'}\n\n` +
              `Version iOS connue: **${config.lastKeepioIosVersion}**\nVersion Android connue: **${androidVersion}**` +
              (warnings.length ? `\n\n${warnings.join('\n')}` : '')
            )],
          });
        }

        case 'disable': {
          config.enabled = false;
          await config.save();
          return interaction.editReply({
            embeds: [createSuccessEmbed('Notifications désactivées', 'Les notifications d\'articles et de Keepio sont maintenant désactivées.')],
          });
        }

        case 'role': {
          const type = interaction.options.getString('type', true);
          const role = interaction.options.getRole('role');

          if (type === 'news') config.newsRoleId = role?.id;
          else if (type === 'keepio-ios') config.keepioIosRoleId = role?.id;
          else config.keepioAndroidRoleId = role?.id;
          await config.save();

          return interaction.editReply({
            embeds: [createSuccessEmbed(
              'Rôle modifié',
              role
                ? `Le rôle ${role} sera mentionné.`
                : 'Aucun rôle ne sera mentionné : la notification sera postée sans ping.'
            )],
          });
        }

        case 'announce': {
          const channelId = interaction.options.getChannel('channel')?.id ?? config.channelId;
          const channel = channelId ? await interaction.guild.channels.fetch(channelId).catch(() => null) : null;

          if (!channel || !channel.isSendable()) {
            return interaction.editReply({
              embeds: [createErrorEmbed('Erreur', 'Salon introuvable. Précisez `channel` ou lancez d\'abord `/notif-setup enable`.')],
            });
          }

          await channel.send({
            ...buildFeatureAnnouncement(
              config.newsRoleId ?? APPLE_NEWS_CURIOUS_ROLE_ID,
              config.keepioIosRoleId ?? KEEPIO_IOS_ROLE_ID,
              config.keepioAndroidRoleId ?? KEEPIO_ANDROID_ROLE_ID
            ),
            allowedMentions: { parse: ['everyone'] },
          });

          return interaction.editReply({
            embeds: [createSuccessEmbed('Annonce publiée', `L'annonce a été postée dans ${channel}.`)],
          });
        }

        case 'preview': {
          const type = interaction.options.getString('type', true);

          if (type === 'announce') {
            return interaction.editReply({
              ...buildFeatureAnnouncement(
                config.newsRoleId ?? APPLE_NEWS_CURIOUS_ROLE_ID,
                config.keepioIosRoleId ?? KEEPIO_IOS_ROLE_ID,
                config.keepioAndroidRoleId ?? KEEPIO_ANDROID_ROLE_ID
              ),
              allowedMentions: { parse: [] },
            });
          }

          if (type === 'news') {
            const article = await fetchLatestArticle();
            if (!article) {
              return interaction.editReply({
                embeds: [createErrorEmbed('Aucun article', 'Aucun article publié trouvé.')],
              });
            }
            return interaction.editReply({
              content: roleMention(config.newsRoleId),
              ...buildArticleMessage(article),
              allowedMentions: { parse: [] },
            });
          }

          if (type === 'keepio-android') {
            if (!isKeepioAndroidConfigured()) {
              return interaction.editReply({
                embeds: [createErrorEmbed('Non configuré', 'Configurez `GOOGLE_PLAY_SERVICE_ACCOUNT_FILE` et `KEEPIO_ANDROID_PACKAGE`.')],
              });
            }
            const release = await fetchKeepioAndroidRelease();
            if (!release || release === 'none') {
              return interaction.editReply({
                embeds: [createErrorEmbed(
                  'Aucune version',
                  release === 'none' ? 'Keepio n\'est pas encore publié en production sur Google Play.' : 'Impossible de joindre Google Play.'
                )],
              });
            }
            return interaction.editReply({
              content: roleMention(config.keepioAndroidRoleId),
              ...buildKeepioMessage(release),
              allowedMentions: { parse: [] },
            });
          }

          const release = await fetchKeepioIosRelease();
          if (!release) {
            return interaction.editReply({
              embeds: [createErrorEmbed('Erreur', 'Impossible de récupérer Keepio sur l\'App Store.')],
            });
          }
          return interaction.editReply({
            content: roleMention(config.keepioIosRoleId),
            ...buildKeepioMessage(release),
            allowedMentions: { parse: [] },
          });
        }

        case 'status': {
          const role = (id?: string) => roleMention(id) || 'Aucun';
          const androidVersion =
            config.lastKeepioAndroidVersion === 'none' ? 'pas encore en production' : config.lastKeepioAndroidVersion ?? '—';

          return interaction.editReply({
            embeds: [createInfoEmbed('Notifications', `
**Statut:** ${config.enabled && config.channelId ? '✅ Activé' : '❌ Désactivé'}
**Salon:** ${config.channelId ? `<#${config.channelId}>` : 'Non configuré'}
**Rôle articles:** ${role(config.newsRoleId)}
**Rôle Keepio iOS:** ${role(config.keepioIosRoleId)}
**Rôle Keepio Android:** ${role(config.keepioAndroidRoleId)}
**Dernier article annoncé:** ${config.lastArticleAnnouncedAt ? `<t:${Math.floor(config.lastArticleAnnouncedAt.getTime() / 1000)}:f>` : '—'}
**Dernière version iOS:** ${config.lastKeepioIosVersion ?? '—'}
**Dernière version Android:** ${androidVersion}${isKeepioAndroidConfigured() ? '' : ' *(suivi inactif)*'}
            `)],
          });
        }
      }
    } catch (error) {
      console.error('Error in notif-setup command:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Erreur', 'Une erreur est survenue.')],
      });
    }
  },
} satisfies Command;
