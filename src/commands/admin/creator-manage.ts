import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { Command } from '../../types/command';
import { CreatorProfile } from '../../database/models/CreatorProfile';
import { createSuccessEmbed, createErrorEmbed, createInfoEmbed } from '../../utils/embeds';

export default {
  data: new SlashCommandBuilder()
    .setName('creator-manage')
    .setDescription('Gérer les profils des créateurs')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Ajouter un nouveau créateur')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('Utilisateur Discord du créateur').setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('name').setDescription('Nom d\'affichage').setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('description').setDescription('Description du créateur').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Supprimer un créateur')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('Utilisateur Discord du créateur').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('set-description')
        .setDescription('Modifier la description d\'un créateur')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('Utilisateur Discord du créateur').setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('description').setDescription('Nouvelle description').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('add-link')
        .setDescription('Ajouter un lien social (pseudo uniquement)')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('Utilisateur Discord du créateur').setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('platform')
            .setDescription('Plateforme')
            .setRequired(true)
            .addChoices(
              { name: 'Twitch', value: 'twitch' },
              { name: 'YouTube', value: 'youtube' },
              { name: 'Twitter/X', value: 'twitter' },
              { name: 'Instagram', value: 'instagram' },
              { name: 'TikTok', value: 'tiktok' },
              { name: 'Discord (invite)', value: 'discord' }
            )
        )
        .addStringOption((opt) =>
          opt.setName('username').setDescription('Pseudo sur la plateforme').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('add-custom-link')
        .setDescription('Ajouter un lien personnalisé (URL complète)')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('Utilisateur Discord du créateur').setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('label').setDescription('Nom du lien (ex: Site Web, Boutique)').setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('url').setDescription('URL complète (https://...)').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove-link')
        .setDescription('Supprimer un lien social')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('Utilisateur Discord du créateur').setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('platform')
            .setDescription('Plateforme à supprimer')
            .setRequired(true)
            .addChoices(
              { name: 'Twitch', value: 'twitch' },
              { name: 'YouTube', value: 'youtube' },
              { name: 'Twitter/X', value: 'twitter' },
              { name: 'Instagram', value: 'instagram' },
              { name: 'TikTok', value: 'tiktok' },
              { name: 'Site Web', value: 'website' },
              { name: 'Discord', value: 'discord' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('add-tag')
        .setDescription('Ajouter un tag')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('Utilisateur Discord du créateur').setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('tag').setDescription('Tag à ajouter (ex: Gaming, IRL)').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove-tag')
        .setDescription('Supprimer un tag')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('Utilisateur Discord du créateur').setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('tag').setDescription('Tag à supprimer').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('set-color')
        .setDescription('Définir la couleur du profil')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('Utilisateur Discord du créateur').setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('color').setDescription('Couleur en hexadécimal (ex: #9146FF)').setRequired(true)
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
    const targetUser = interaction.options.getUser('user');

    try {
      switch (subcommand) {
        case 'add': {
          if (!targetUser) return;
          const name = interaction.options.getString('name', true);
          const description = interaction.options.getString('description') || '';

          const existing = await CreatorProfile.findOne({
            guildId: interaction.guildId,
            userId: targetUser.id,
          });

          if (existing) {
            return interaction.editReply({
              embeds: [createErrorEmbed('Déjà existant', `${targetUser} a déjà un profil créateur.`)],
            });
          }

          await CreatorProfile.create({
            guildId: interaction.guildId,
            userId: targetUser.id,
            name,
            description,
            avatarUrl: targetUser.displayAvatarURL({ size: 512 }),
          });

          return interaction.editReply({
            embeds: [createSuccessEmbed('Créateur ajouté', `Le profil de **${name}** (${targetUser}) a été créé.`)],
          });
        }

        case 'remove': {
          if (!targetUser) return;

          const deleted = await CreatorProfile.findOneAndDelete({
            guildId: interaction.guildId,
            userId: targetUser.id,
          });

          if (!deleted) {
            return interaction.editReply({
              embeds: [createErrorEmbed('Non trouvé', `${targetUser} n'a pas de profil créateur.`)],
            });
          }

          return interaction.editReply({
            embeds: [createSuccessEmbed('Créateur supprimé', `Le profil de **${deleted.name}** a été supprimé.`)],
          });
        }

        case 'set-description': {
          if (!targetUser) return;
          const description = interaction.options.getString('description', true);

          const profile = await CreatorProfile.findOneAndUpdate(
            { guildId: interaction.guildId, userId: targetUser.id },
            { description, updatedAt: new Date() },
            { new: true }
          );

          if (!profile) {
            return interaction.editReply({
              embeds: [createErrorEmbed('Non trouvé', `${targetUser} n'a pas de profil créateur.`)],
            });
          }

          return interaction.editReply({
            embeds: [createSuccessEmbed('Description modifiée', `La description de **${profile.name}** a été mise à jour.`)],
          });
        }

        case 'add-link': {
          if (!targetUser) return;
          const platform = interaction.options.getString('platform', true) as any;
          const username = interaction.options.getString('username', true);

          // Build URL from username
          const urlTemplates: Record<string, string> = {
            twitch: `https://twitch.tv/${username}`,
            youtube: `https://youtube.com/@${username}`,
            twitter: `https://x.com/${username}`,
            instagram: `https://instagram.com/${username}`,
            tiktok: `https://tiktok.com/@${username}`,
            discord: `https://discord.gg/${username}`,
          };

          const url = urlTemplates[platform];
          if (!url) {
            return interaction.editReply({
              embeds: [createErrorEmbed('Erreur', 'Plateforme non supportée.')],
            });
          }

          const profile = await CreatorProfile.findOne({
            guildId: interaction.guildId,
            userId: targetUser.id,
          });

          if (!profile) {
            return interaction.editReply({
              embeds: [createErrorEmbed('Non trouvé', `${targetUser} n'a pas de profil créateur.`)],
            });
          }

          // Remove existing link for this platform if any
          profile.socialLinks = profile.socialLinks.filter((l) => l.platform !== platform);
          profile.socialLinks.push({ platform, url, username });
          profile.updatedAt = new Date();
          await profile.save();

          return interaction.editReply({
            embeds: [createSuccessEmbed('Lien ajouté', `**${platform}** ajouté : ${url}`)],
          });
        }

        case 'add-custom-link': {
          if (!targetUser) return;
          const label = interaction.options.getString('label', true);
          const url = interaction.options.getString('url', true);

          // Validate URL
          try {
            new URL(url);
          } catch {
            return interaction.editReply({
              embeds: [createErrorEmbed('URL invalide', 'L\'URL doit commencer par https:// ou http://')],
            });
          }

          const profile = await CreatorProfile.findOne({
            guildId: interaction.guildId,
            userId: targetUser.id,
          });

          if (!profile) {
            return interaction.editReply({
              embeds: [createErrorEmbed('Non trouvé', `${targetUser} n'a pas de profil créateur.`)],
            });
          }

          // Use 'website' as platform for custom links
          profile.socialLinks.push({ platform: 'website', url, username: label });
          profile.updatedAt = new Date();
          await profile.save();

          return interaction.editReply({
            embeds: [createSuccessEmbed('Lien ajouté', `**${label}** ajouté : ${url}`)],
          });
        }

        case 'remove-link': {
          if (!targetUser) return;
          const platform = interaction.options.getString('platform', true);

          const profile = await CreatorProfile.findOne({
            guildId: interaction.guildId,
            userId: targetUser.id,
          });

          if (!profile) {
            return interaction.editReply({
              embeds: [createErrorEmbed('Non trouvé', `${targetUser} n'a pas de profil créateur.`)],
            });
          }

          const hadLink = profile.socialLinks.some((l) => l.platform === platform);
          if (!hadLink) {
            return interaction.editReply({
              embeds: [createErrorEmbed('Non trouvé', `Ce créateur n'a pas de lien ${platform}.`)],
            });
          }

          profile.socialLinks = profile.socialLinks.filter((l) => l.platform !== platform);
          profile.updatedAt = new Date();
          await profile.save();

          return interaction.editReply({
            embeds: [createSuccessEmbed('Lien supprimé', `Le lien ${platform} a été supprimé.`)],
          });
        }

        case 'add-tag': {
          if (!targetUser) return;
          const tag = interaction.options.getString('tag', true);

          const profile = await CreatorProfile.findOne({
            guildId: interaction.guildId,
            userId: targetUser.id,
          });

          if (!profile) {
            return interaction.editReply({
              embeds: [createErrorEmbed('Non trouvé', `${targetUser} n'a pas de profil créateur.`)],
            });
          }

          if (!profile.tags.includes(tag)) {
            profile.tags.push(tag);
            profile.updatedAt = new Date();
            await profile.save();
          }

          return interaction.editReply({
            embeds: [createSuccessEmbed('Tag ajouté', `Le tag "${tag}" a été ajouté à **${profile.name}**.`)],
          });
        }

        case 'remove-tag': {
          if (!targetUser) return;
          const tag = interaction.options.getString('tag', true);

          const profile = await CreatorProfile.findOne({
            guildId: interaction.guildId,
            userId: targetUser.id,
          });

          if (!profile) {
            return interaction.editReply({
              embeds: [createErrorEmbed('Non trouvé', `${targetUser} n'a pas de profil créateur.`)],
            });
          }

          profile.tags = profile.tags.filter((t) => t.toLowerCase() !== tag.toLowerCase());
          profile.updatedAt = new Date();
          await profile.save();

          return interaction.editReply({
            embeds: [createSuccessEmbed('Tag supprimé', `Le tag "${tag}" a été supprimé.`)],
          });
        }

        case 'set-color': {
          if (!targetUser) return;
          const color = interaction.options.getString('color', true);

          if (!/^#[0-9A-F]{6}$/i.test(color)) {
            return interaction.editReply({
              embeds: [createErrorEmbed('Format invalide', 'La couleur doit être au format hexadécimal (ex: #9146FF)')],
            });
          }

          const profile = await CreatorProfile.findOneAndUpdate(
            { guildId: interaction.guildId, userId: targetUser.id },
            { bannerColor: color, updatedAt: new Date() },
            { new: true }
          );

          if (!profile) {
            return interaction.editReply({
              embeds: [createErrorEmbed('Non trouvé', `${targetUser} n'a pas de profil créateur.`)],
            });
          }

          return interaction.editReply({
            embeds: [createSuccessEmbed('Couleur modifiée', `La couleur de **${profile.name}** a été changée en ${color}.`)],
          });
        }
      }
    } catch (error) {
      console.error('Error in creator-manage command:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Erreur', 'Une erreur est survenue.')],
      });
    }
  },
} satisfies Command;
