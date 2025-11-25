import { VoiceState } from 'discord.js';
import { Event } from '../../types/event';
import { TempVoiceChannel } from '../../database/models/TempVoiceChannel';

export default {
  name: 'voiceStateUpdate',
  async execute(oldState: VoiceState, newState: VoiceState) {
    // Only handle when someone leaves a voice channel
    if (!oldState.channelId) return;

    // Check if the old channel still exists and is now empty
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
  },
} satisfies Event<'voiceStateUpdate'>;
