import { VoiceState, ChannelType, PermissionFlagsBits } from 'discord.js';
import { Event } from '../../types/event';
import { TempVoiceChannel } from '../../database/models/TempVoiceChannel';
import { VoiceConfig } from '../../database/models/VoiceConfig';

export default {
  name: 'voiceStateUpdate',
  async execute(oldState: VoiceState, newState: VoiceState) {
    // Handle Join to Create
    if (newState.channelId && newState.channelId !== oldState.channelId) {
      await handleJoinToCreate(newState);
    }

    // Handle temp channel cleanup when someone leaves
    if (oldState.channelId && oldState.channelId !== newState.channelId) {
      await handleChannelCleanup(oldState);
    }
  },
} satisfies Event<'voiceStateUpdate'>;

/**
 * Handle Join to Create - create a new temp channel when user joins the JTC channel
 */
async function handleJoinToCreate(state: VoiceState) {
  try {
    const config = await VoiceConfig.findOne({ guildId: state.guild.id });
    if (!config) return;

    // Check if user joined the "Join to Create" channel
    if (state.channelId !== config.joinToCreateChannelId) return;

    const member = state.member;
    if (!member) return;

    const username = member.displayName || member.user.username;
    const channelName = `Salon-${username}`;

    // Create the new voice channel
    const newChannel = await state.guild.channels.create({
      name: channelName,
      type: ChannelType.GuildVoice,
      parent: config.categoryId,
      userLimit: config.defaultUserLimit,
      permissionOverwrites: [
        {
          id: member.id,
          allow: [
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.MuteMembers,
            PermissionFlagsBits.DeafenMembers,
            PermissionFlagsBits.MoveMembers,
            PermissionFlagsBits.ManageChannels,
          ],
        },
      ],
    });

    // Save to database
    await TempVoiceChannel.create({
      guildId: state.guild.id,
      channelId: newChannel.id,
      creatorId: member.id,
      baseName: username,
      createdAt: new Date(),
    });

    // Move user to their new channel
    await member.voice.setChannel(newChannel);

    console.log(`🎤 Temp voice channel "${channelName}" created by ${member.user.tag}`);
  } catch (error) {
    console.error('Error in Join to Create:', error);
  }
}

/**
 * Handle cleanup - delete temp channel when empty
 */
async function handleChannelCleanup(state: VoiceState) {
  try {
    const oldChannel = state.channel;
    if (!oldChannel) return;

    // Check if the channel is empty
    if (oldChannel.members.size > 0) return;

    // Check if this is a temporary voice channel
    const tempChannel = await TempVoiceChannel.findOne({
      channelId: state.channelId,
    });

    if (!tempChannel) return;

    // Delete the channel
    await oldChannel.delete('Salon vocal temporaire vide');

    // Remove from database
    await TempVoiceChannel.deleteOne({ channelId: state.channelId });

    console.log(`🎤 Temporary voice channel "${oldChannel.name}" deleted (empty)`);
  } catch (error) {
    console.error('Error deleting temporary voice channel:', error);
  }
}
