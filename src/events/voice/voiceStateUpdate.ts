import { VoiceState, ChannelType, PermissionFlagsBits } from 'discord.js';
import { Event } from '../../types/event';
import { TempVoiceChannel } from '../../database/models/TempVoiceChannel';
import { VoiceConfig } from '../../database/models/VoiceConfig';
import { VoiceSession } from '../../database/models/VoiceSession';
import { VoiceTime } from '../../database/models/VoiceTime';

export default {
  name: 'voiceStateUpdate',
  async execute(oldState: VoiceState, newState: VoiceState) {
    const userId = newState.member?.id || oldState.member?.id;
    const guildId = newState.guild?.id || oldState.guild?.id;

    if (!userId || !guildId) return;

    // Ignore bots
    if (newState.member?.user.bot || oldState.member?.user.bot) return;

    const oldChannelId = oldState.channelId;
    const newChannelId = newState.channelId;

    // User joined a voice channel (wasn't in one before)
    if (!oldChannelId && newChannelId) {
      await handleVoiceJoin(guildId, userId, newChannelId);
      await handleJoinToCreate(newState);
    }

    // User left a voice channel (no longer in one)
    if (oldChannelId && !newChannelId) {
      await handleVoiceLeave(guildId, userId);
      await handleTempChannelCleanup(oldState);
    }

    // User switched channels
    if (oldChannelId && newChannelId && oldChannelId !== newChannelId) {
      // Update the channel in the session, don't reset the timer
      await VoiceSession.findOneAndUpdate(
        { guildId, userId },
        { channelId: newChannelId }
      );
      await handleJoinToCreate(newState);
      await handleTempChannelCleanup(oldState);
    }
  },
} satisfies Event<'voiceStateUpdate'>;

/**
 * Handle user joining a voice channel - start tracking time
 */
async function handleVoiceJoin(guildId: string, userId: string, channelId: string) {
  try {
    // Create or update session (upsert in case of stale session)
    await VoiceSession.findOneAndUpdate(
      { guildId, userId },
      { channelId, startedAt: new Date() },
      { upsert: true }
    );
  } catch (error) {
    console.error('Error starting voice session:', error);
  }
}

/**
 * Handle user leaving a voice channel - add time to total
 */
async function handleVoiceLeave(guildId: string, userId: string) {
  try {
    // Find and delete the session
    const session = await VoiceSession.findOneAndDelete({ guildId, userId });

    if (!session) return;

    // Calculate duration
    const duration = Date.now() - session.startedAt.getTime();

    // Add to total time
    await VoiceTime.findOneAndUpdate(
      { guildId, userId },
      {
        $inc: { totalTime: duration },
        $set: { updatedAt: new Date() },
      },
      { upsert: true }
    );

    // Log for debugging
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    console.log(`🎤 ${userId} spent ${minutes}m ${seconds}s in voice (guild: ${guildId})`);
  } catch (error) {
    console.error('Error ending voice session:', error);
  }
}

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
