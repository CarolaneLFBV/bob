import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../../types/command';
import { TempVoiceChannel } from '../../database/models/TempVoiceChannel';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embeds';

export default {
  data: new SlashCommandBuilder()
    .setName('voice-limit')
    .setDescription('Modifier la limite de personnes dans ton salon vocal')
    .addIntegerOption((option) =>
      option
        .setName('limite')
        .setDescription('Nombre max de personnes (0 = illimité)')
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(99)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const member = interaction.member;
    if (!member || !('voice' in member)) {
      return interaction.editReply({
        embeds: [createErrorEmbed('Erreur', 'Impossible de récupérer tes informations.')],
      });
    }

    const voiceChannel = member.voice.channel;
    if (!voiceChannel) {
      return interaction.editReply({
        embeds: [createErrorEmbed('Erreur', "Tu dois être dans un salon vocal pour utiliser cette commande.")],
      });
    }

    // Check if this is a temp voice channel owned by the user
    const tempChannel = await TempVoiceChannel.findOne({
      channelId: voiceChannel.id,
      guildId: interaction.guildId,
    });

    if (!tempChannel) {
      return interaction.editReply({
        embeds: [createErrorEmbed('Erreur', "Ce salon n'est pas un salon vocal temporaire.")],
      });
    }

    if (tempChannel.creatorId !== interaction.user.id) {
      return interaction.editReply({
        embeds: [createErrorEmbed('Erreur', "Tu n'es pas le créateur de ce salon.")],
      });
    }

    const limit = interaction.options.getInteger('limite') ?? 0;

    try {
      await voiceChannel.setUserLimit(limit);

      const limitText = limit === 0 ? 'illimitée' : `${limit} personnes`;
      return interaction.editReply({
        embeds: [createSuccessEmbed('Limite modifiée', `La limite du salon est maintenant : **${limitText}**`)],
      });
    } catch (error) {
      console.error('Error setting voice channel limit:', error);
      return interaction.editReply({
        embeds: [createErrorEmbed('Erreur', 'Impossible de modifier la limite du salon.')],
      });
    }
  },
} satisfies Command;
