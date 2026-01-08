import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import { Command } from '../../types/command';
import { LogConfig } from '../../database/models/LogConfig';
import { createSuccessEmbed, createErrorEmbed, createInfoEmbed } from '../../utils/embeds';

export default {
  data: new SlashCommandBuilder()
    .setName('logs-setup')
    .setDescription('Configurer le système de logs')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('enable')
        .setDescription('Activer le système de logs')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Salon principal pour les logs')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('disable').setDescription('Désactiver le système de logs')
    )
    .addSubcommand((sub) =>
      sub
        .setName('channel')
        .setDescription('Définir un salon spécifique pour un type de log')
        .addStringOption((opt) =>
          opt
            .setName('type')
            .setDescription('Type de log')
            .setRequired(true)
            .addChoices(
              { name: 'Arrivées', value: 'memberJoin' },
              { name: 'Départs', value: 'memberLeave' },
              { name: 'Messages supprimés', value: 'messageDelete' },
              { name: 'Messages modifiés', value: 'messageEdit' },
              { name: 'Activité vocale', value: 'voiceActivity' },
              { name: 'Modération', value: 'moderation' },
              { name: 'Changements de rôles', value: 'roleChanges' }
            )
        )
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Salon (laisser vide = utiliser le salon principal)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setDescription('Activer/désactiver un type de log spécifique')
        .addStringOption((opt) =>
          opt
            .setName('event')
            .setDescription('Événement à toggle')
            .setRequired(true)
            .addChoices(
              { name: 'Arrivées de membres', value: 'memberJoin' },
              { name: 'Départs de membres', value: 'memberLeave' },
              { name: 'Messages supprimés', value: 'messageDelete' },
              { name: 'Messages modifiés', value: 'messageEdit' },
              { name: 'Connexions vocales', value: 'voiceJoin' },
              { name: 'Déconnexions vocales', value: 'voiceLeave' },
              { name: 'Changements de salon vocal', value: 'voiceSwitch' },
              { name: 'Bannissements', value: 'memberBan' },
              { name: 'Débannissements', value: 'memberUnban' },
              { name: 'Rôles ajoutés', value: 'roleAdd' },
              { name: 'Rôles retirés', value: 'roleRemove' },
              { name: 'Changements de pseudo', value: 'nicknameChange' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('ignore-channel')
        .setDescription('Ignorer un salon pour les logs de messages')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Salon à ignorer')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('ignore-role')
        .setDescription('Ignorer un rôle pour les logs de messages')
        .addRoleOption((opt) =>
          opt.setName('role').setDescription('Rôle à ignorer').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('view').setDescription('Voir la configuration actuelle')
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
      let config = await LogConfig.findOne({ guildId: interaction.guildId });
      if (!config) {
        config = new LogConfig({ guildId: interaction.guildId });
      }

      switch (subcommand) {
        case 'enable': {
          const channel = interaction.options.getChannel('channel', true);
          config.enabled = true;
          config.channelId = channel.id;
          await config.save();
          return interaction.editReply({
            embeds: [createSuccessEmbed('Logs activés', `Les logs seront envoyés dans ${channel}.`)],
          });
        }

        case 'disable': {
          config.enabled = false;
          await config.save();
          return interaction.editReply({
            embeds: [createSuccessEmbed('Logs désactivés', 'Le système de logs est maintenant désactivé.')],
          });
        }

        case 'channel': {
          const type = interaction.options.getString('type', true) as keyof typeof config.channels;
          const channel = interaction.options.getChannel('channel');

          if (channel) {
            config.channels[type] = channel.id;
          } else {
            config.channels[type] = undefined;
          }
          await config.save();

          return interaction.editReply({
            embeds: [createSuccessEmbed(
              'Salon configuré',
              channel
                ? `Les logs de type "${type}" seront envoyés dans ${channel}.`
                : `Les logs de type "${type}" utiliseront le salon principal.`
            )],
          });
        }

        case 'toggle': {
          const event = interaction.options.getString('event', true) as keyof typeof config.events;
          config.events[event] = !config.events[event];
          await config.save();

          return interaction.editReply({
            embeds: [createSuccessEmbed(
              'Événement modifié',
              `L'événement "${event}" est maintenant ${config.events[event] ? '✅ activé' : '❌ désactivé'}.`
            )],
          });
        }

        case 'ignore-channel': {
          const channel = interaction.options.getChannel('channel', true);
          const index = config.ignoredChannels.indexOf(channel.id);

          if (index === -1) {
            config.ignoredChannels.push(channel.id);
            await config.save();
            return interaction.editReply({
              embeds: [createSuccessEmbed('Salon ignoré', `${channel} sera ignoré pour les logs de messages.`)],
            });
          } else {
            config.ignoredChannels.splice(index, 1);
            await config.save();
            return interaction.editReply({
              embeds: [createSuccessEmbed('Salon réactivé', `${channel} ne sera plus ignoré.`)],
            });
          }
        }

        case 'ignore-role': {
          const role = interaction.options.getRole('role', true);
          const index = config.ignoredRoles.indexOf(role.id);

          if (index === -1) {
            config.ignoredRoles.push(role.id);
            await config.save();
            return interaction.editReply({
              embeds: [createSuccessEmbed('Rôle ignoré', `Les membres avec ${role} seront ignorés pour les logs.`)],
            });
          } else {
            config.ignoredRoles.splice(index, 1);
            await config.save();
            return interaction.editReply({
              embeds: [createSuccessEmbed('Rôle réactivé', `Les membres avec ${role} ne seront plus ignorés.`)],
            });
          }
        }

        case 'view': {
          const eventsStatus = Object.entries(config.events)
            .map(([key, value]) => `${value ? '✅' : '❌'} ${key}`)
            .join('\n');

          const channelsConfig = Object.entries(config.channels)
            .filter(([, v]) => v)
            .map(([k, v]) => `${k}: <#${v}>`)
            .join('\n') || 'Aucun (utilise le salon principal)';

          const ignoredChannels = config.ignoredChannels.length > 0
            ? config.ignoredChannels.map((c) => `<#${c}>`).join(', ')
            : 'Aucun';

          const ignoredRoles = config.ignoredRoles.length > 0
            ? config.ignoredRoles.map((r) => `<@&${r}>`).join(', ')
            : 'Aucun';

          return interaction.editReply({
            embeds: [createInfoEmbed('Configuration des logs', `
**Statut:** ${config.enabled ? '✅ Activé' : '❌ Désactivé'}
**Salon principal:** ${config.channelId ? `<#${config.channelId}>` : 'Non configuré'}

**Événements:**
${eventsStatus}

**Salons spécifiques:**
${channelsConfig}

**Salons ignorés:** ${ignoredChannels}
**Rôles ignorés:** ${ignoredRoles}
            `)],
          });
        }
      }
    } catch (error) {
      console.error('Error in logs-setup command:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Erreur', 'Une erreur est survenue.')],
      });
    }
  },
} satisfies Command;
