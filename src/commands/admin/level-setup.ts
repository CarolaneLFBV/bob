import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import { Command } from '../../types/command';
import { LevelConfig } from '../../database/models/LevelConfig';
import { createSuccessEmbed, createErrorEmbed, createInfoEmbed } from '../../utils/embeds';

export default {
  data: new SlashCommandBuilder()
    .setName('level-setup')
    .setDescription('Configurer le système de niveaux')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('enable')
        .setDescription('Activer le système de niveaux')
    )
    .addSubcommand((sub) =>
      sub
        .setName('disable')
        .setDescription('Désactiver le système de niveaux')
    )
    .addSubcommand((sub) =>
      sub
        .setName('channel')
        .setDescription('Définir le salon d\'annonce des level-up')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Salon pour les annonces (laisser vide = même salon)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('xp')
        .setDescription('Configurer les gains d\'XP')
        .addIntegerOption((opt) =>
          opt.setName('message_min').setDescription('XP minimum par message').setMinValue(1).setMaxValue(100)
        )
        .addIntegerOption((opt) =>
          opt.setName('message_max').setDescription('XP maximum par message').setMinValue(1).setMaxValue(100)
        )
        .addIntegerOption((opt) =>
          opt.setName('voice').setDescription('XP par minute en vocal').setMinValue(1).setMaxValue(50)
        )
        .addIntegerOption((opt) =>
          opt.setName('cooldown').setDescription('Cooldown entre messages en secondes').setMinValue(0).setMaxValue(300)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('reward')
        .setDescription('Ajouter un rôle récompense pour un niveau')
        .addIntegerOption((opt) =>
          opt.setName('level').setDescription('Niveau requis').setRequired(true).setMinValue(1)
        )
        .addRoleOption((opt) =>
          opt.setName('role').setDescription('Rôle à attribuer').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove-reward')
        .setDescription('Supprimer un rôle récompense')
        .addIntegerOption((opt) =>
          opt.setName('level').setDescription('Niveau du rôle à supprimer').setRequired(true).setMinValue(1)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('ignore-channel')
        .setDescription('Ajouter/retirer un salon ignoré')
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
        .setDescription('Ajouter/retirer un rôle ignoré')
        .addRoleOption((opt) =>
          opt.setName('role').setDescription('Rôle à ignorer').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('message')
        .setDescription('Personnaliser le message de level-up')
        .addStringOption((opt) =>
          opt
            .setName('message')
            .setDescription('Message ({user} = mention, {level} = niveau)')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('view')
        .setDescription('Voir la configuration actuelle')
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
      // Get or create config
      let config = await LevelConfig.findOne({ guildId: interaction.guildId });
      if (!config) {
        config = new LevelConfig({ guildId: interaction.guildId });
      }

      switch (subcommand) {
        case 'enable': {
          config.enabled = true;
          await config.save();
          return interaction.editReply({
            embeds: [createSuccessEmbed('Système activé', 'Le système de niveaux est maintenant activé.')],
          });
        }

        case 'disable': {
          config.enabled = false;
          await config.save();
          return interaction.editReply({
            embeds: [createSuccessEmbed('Système désactivé', 'Le système de niveaux est maintenant désactivé.')],
          });
        }

        case 'channel': {
          const channel = interaction.options.getChannel('channel');
          config.announcementChannelId = channel?.id || undefined;
          await config.save();
          return interaction.editReply({
            embeds: [createSuccessEmbed(
              'Salon configuré',
              channel
                ? `Les annonces de level-up seront envoyées dans ${channel}.`
                : 'Les annonces de level-up seront envoyées dans le même salon que le message.'
            )],
          });
        }

        case 'xp': {
          const msgMin = interaction.options.getInteger('message_min');
          const msgMax = interaction.options.getInteger('message_max');
          const voice = interaction.options.getInteger('voice');
          const cooldown = interaction.options.getInteger('cooldown');

          if (msgMin !== null) config.xpPerMessage.min = msgMin;
          if (msgMax !== null) config.xpPerMessage.max = msgMax;
          if (voice !== null) config.xpPerMinuteVoice = voice;
          if (cooldown !== null) config.messageCooldown = cooldown;

          await config.save();
          return interaction.editReply({
            embeds: [createSuccessEmbed('XP configuré', `
**Messages:** ${config.xpPerMessage.min}-${config.xpPerMessage.max} XP
**Vocal:** ${config.xpPerMinuteVoice} XP/min
**Cooldown:** ${config.messageCooldown}s
            `)],
          });
        }

        case 'reward': {
          const level = interaction.options.getInteger('level', true);
          const role = interaction.options.getRole('role', true);

          // Remove existing reward for this level if any
          config.rewards = config.rewards.filter((r) => r.level !== level);
          config.rewards.push({ level, roleId: role.id });
          config.rewards.sort((a, b) => a.level - b.level);

          await config.save();
          return interaction.editReply({
            embeds: [createSuccessEmbed('Récompense ajoutée', `Le rôle ${role} sera attribué au niveau ${level}.`)],
          });
        }

        case 'remove-reward': {
          const level = interaction.options.getInteger('level', true);
          const removed = config.rewards.find((r) => r.level === level);

          if (!removed) {
            return interaction.editReply({
              embeds: [createErrorEmbed('Non trouvé', `Aucune récompense configurée pour le niveau ${level}.`)],
            });
          }

          config.rewards = config.rewards.filter((r) => r.level !== level);
          await config.save();
          return interaction.editReply({
            embeds: [createSuccessEmbed('Récompense supprimée', `La récompense du niveau ${level} a été supprimée.`)],
          });
        }

        case 'ignore-channel': {
          const channel = interaction.options.getChannel('channel', true);
          const index = config.ignoredChannels.indexOf(channel.id);

          if (index === -1) {
            config.ignoredChannels.push(channel.id);
            await config.save();
            return interaction.editReply({
              embeds: [createSuccessEmbed('Salon ignoré', `${channel} ne donnera plus d'XP.`)],
            });
          } else {
            config.ignoredChannels.splice(index, 1);
            await config.save();
            return interaction.editReply({
              embeds: [createSuccessEmbed('Salon réactivé', `${channel} donnera à nouveau de l'XP.`)],
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
              embeds: [createSuccessEmbed('Rôle ignoré', `Les membres avec ${role} ne gagneront plus d'XP.`)],
            });
          } else {
            config.ignoredRoles.splice(index, 1);
            await config.save();
            return interaction.editReply({
              embeds: [createSuccessEmbed('Rôle réactivé', `Les membres avec ${role} gagneront à nouveau de l'XP.`)],
            });
          }
        }

        case 'message': {
          const message = interaction.options.getString('message', true);
          config.levelUpMessage = message;
          await config.save();
          return interaction.editReply({
            embeds: [createSuccessEmbed('Message configuré', `Nouveau message:\n${message}`)],
          });
        }

        case 'view': {
          const rewardsText = config.rewards.length > 0
            ? config.rewards.map((r) => `Niveau ${r.level}: <@&${r.roleId}>`).join('\n')
            : 'Aucune';

          const ignoredChannelsText = config.ignoredChannels.length > 0
            ? config.ignoredChannels.map((c) => `<#${c}>`).join(', ')
            : 'Aucun';

          const ignoredRolesText = config.ignoredRoles.length > 0
            ? config.ignoredRoles.map((r) => `<@&${r}>`).join(', ')
            : 'Aucun';

          return interaction.editReply({
            embeds: [createInfoEmbed('Configuration des niveaux', `
**Statut:** ${config.enabled ? '✅ Activé' : '❌ Désactivé'}
**Salon d'annonce:** ${config.announcementChannelId ? `<#${config.announcementChannelId}>` : 'Même salon'}

**XP par message:** ${config.xpPerMessage.min}-${config.xpPerMessage.max}
**XP par minute vocal:** ${config.xpPerMinuteVoice}
**Cooldown:** ${config.messageCooldown}s

**Message level-up:**
${config.levelUpMessage}

**Récompenses:**
${rewardsText}

**Salons ignorés:** ${ignoredChannelsText}
**Rôles ignorés:** ${ignoredRolesText}
            `)],
          });
        }
      }
    } catch (error) {
      console.error('Error in level-setup command:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Erreur', 'Une erreur est survenue.')],
      });
    }
  },
} satisfies Command;
