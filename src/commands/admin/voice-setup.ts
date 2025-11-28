import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import { Command } from '../../types/command';
import { VoiceConfig } from '../../database/models/VoiceConfig';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embeds';

export default {
  data: new SlashCommandBuilder()
    .setName('voice-setup')
    .setDescription('Configure le système de salons vocaux temporaires (Join to Create)')
    .addChannelOption(option =>
      option
        .setName('category')
        .setDescription('Catégorie où créer les salons vocaux')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('user-limit')
        .setDescription('Limite d\'utilisateurs par défaut (0 = illimité)')
        .setMinValue(0)
        .setMaxValue(99)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const category = interaction.options.getChannel('category', true);
      const userLimit = interaction.options.getInteger('user-limit') ?? 0;

      if (category.type !== ChannelType.GuildCategory) {
        return interaction.editReply({
          embeds: [createErrorEmbed('Erreur', 'Vous devez sélectionner une catégorie.')],
        });
      }

      // Create the "Join to Create" voice channel
      const joinToCreateChannel = await interaction.guild!.channels.create({
        name: '➕ Créer un salon temporaire',
        type: ChannelType.GuildVoice,
        parent: category.id,
      });

      // Save configuration to database
      await VoiceConfig.findOneAndUpdate(
        { guildId: interaction.guildId! },
        {
          guildId: interaction.guildId!,
          categoryId: category.id,
          joinToCreateChannelId: joinToCreateChannel.id,
          defaultUserLimit: userLimit,
        },
        { upsert: true, new: true }
      );

      // Confirm to the admin
      const confirmEmbed = createSuccessEmbed(
        'Système vocal configuré',
        `Le salon **${joinToCreateChannel.name}** a été créé !\n\n` +
        `**Catégorie:** ${category.name}\n` +
        `**Limite utilisateurs:** ${userLimit === 0 ? 'Illimitée' : userLimit}\n\n` +
        `Quand quelqu'un rejoint ce salon, un salon \`Salon-{pseudo}\` sera créé automatiquement.`
      );

      await interaction.editReply({ embeds: [confirmEmbed] });
    } catch (error) {
      console.error('Error in voice-setup command:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Erreur', 'Une erreur est survenue lors de la configuration.')],
      });
    }
  },
} satisfies Command;
