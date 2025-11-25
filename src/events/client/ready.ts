import { Client, ActivityType } from 'discord.js';
import { Event } from '../../types/event';
import { TempVoiceChannel } from '../../database/models/TempVoiceChannel';

export default {
  name: 'ready',
  once: true,
  async execute(client: Client) {
    if (!client.user) return;

    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log(`🌐 Serving ${client.guilds.cache.size} guild(s)`);
    console.log(`👥 Serving ${client.users.cache.size} user(s)`);

    // Set bot status
    client.user.setPresence({
      activities: [{ name: 'les tickets 🎫', type: ActivityType.Watching }],
      status: 'online',
    });

    // Cleanup stale temp voice channels on startup
    await cleanupStaleVoiceChannels(client);
  },
} satisfies Event<'ready'>;

/**
 * Clean up temporary voice channels that are empty or older than 2 minutes
 */
async function cleanupStaleVoiceChannels(client: Client) {
  try {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const staleChannels = await TempVoiceChannel.find({
      createdAt: { $lt: twoMinutesAgo },
    });

    let cleaned = 0;
    for (const tempChannel of staleChannels) {
      try {
        const guild = await client.guilds.fetch(tempChannel.guildId).catch(() => null);
        if (!guild) {
          await TempVoiceChannel.deleteOne({ _id: tempChannel._id });
          cleaned++;
          continue;
        }

        const channel = await guild.channels.fetch(tempChannel.channelId).catch(() => null);
        if (!channel) {
          // Channel doesn't exist anymore, clean up DB
          await TempVoiceChannel.deleteOne({ _id: tempChannel._id });
          cleaned++;
          continue;
        }

        if (channel.isVoiceBased() && channel.members.size === 0) {
          await channel.delete('Salon vocal temporaire vide (cleanup au démarrage)');
          await TempVoiceChannel.deleteOne({ _id: tempChannel._id });
          cleaned++;
        }
      } catch {
        // Ignore individual channel errors
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} stale temp voice channel(s)`);
    }
  } catch (error) {
    console.error('Error cleaning up stale voice channels:', error);
  }
}
