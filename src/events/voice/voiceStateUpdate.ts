import { VoiceState, ChannelType, PermissionFlagsBits } from 'discord.js';
import { Event } from '../../types/event';
import { TempVoiceChannel } from '../../database/models/TempVoiceChannel';
import { VoiceConfig } from '../../database/models/VoiceConfig';

export default {
  name: 'voiceStateUpdate',
  async execute(oldState: VoiceState, newState: VoiceState) {
    // Ignore bots and changes that do not move the member between channels.
    if (newState.member?.user.bot || oldState.member?.user.bot) return;
    if (oldState.channelId === newState.channelId) return;

    if (newState.channelId) await handleJoinToCreate(newState);
    if (oldState.channelId) await handleTempChannelCleanup(oldState);
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
 * Handle temporary voice channel cleanup when empty
 */
async function handleTempChannelCleanup(oldState: VoiceState) {
  const oldChannel = oldState.channel;
  if (!oldChannel) return;

  // Check if the channel is empty
  if (oldChannel.members.size > 0) return;

  try {
    // Check if this is a temporary voice channel
    const tempChannel = await TempVoiceChannel.findOne({
      channelId: oldState.channelId,
    });

    if (!tempChannel) return;

    // Delete the channel
    await oldChannel.delete('Salon vocal temporaire vide');

    // Remove from database
    await TempVoiceChannel.deleteOne({ channelId: oldState.channelId });

    console.log(`🎤 Temporary voice channel "${oldChannel.name}" deleted (empty)`);
  } catch (error) {
    console.error('Error deleting temporary voice channel:', error);
  }
}
