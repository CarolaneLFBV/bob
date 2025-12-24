import { Client, ActivityType } from 'discord.js';
import { Event } from '../../types/event';
import { TempVoiceChannel } from '../../database/models/TempVoiceChannel';
import { VoiceSession } from '../../database/models/VoiceSession';
import { VoiceTime } from '../../database/models/VoiceTime';

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

    // Recover voice sessions after restart
    await recoverVoiceSessions(client);
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

/**
 * Recover voice sessions after bot restart
 * - Finalize sessions for users no longer in voice
 * - Create sessions for users currently in voice without a session
 */
async function recoverVoiceSessions(client: Client) {
  try {
    // Get all active sessions from database
    const activeSessions = await VoiceSession.find({});
    let recovered = 0;
    let synced = 0;

    // Process each session
    for (const session of activeSessions) {
      try {
        const guild = await client.guilds.fetch(session.guildId).catch(() => null);
        if (!guild) {
          // Guild no longer accessible, finalize session
          await finalizeSession(session);
          recovered++;
          continue;
        }

        const member = await guild.members.fetch(session.userId).catch(() => null);
        if (!member || !member.voice.channelId) {
          // User is no longer in voice, finalize session
          await finalizeSession(session);
          recovered++;
        }
        // If user is still in voice, keep the session (timer continues from original start)
      } catch {
        // Error processing session, finalize it to be safe
        await finalizeSession(session);
        recovered++;
      }
    }

    // Sync: Create sessions for users currently in voice without a session
    for (const guild of client.guilds.cache.values()) {
      for (const channel of guild.channels.cache.values()) {
        if (!channel.isVoiceBased()) continue;

        for (const member of channel.members.values()) {
          if (member.user.bot) continue;

          // Check if session exists
          const existingSession = await VoiceSession.findOne({
            guildId: guild.id,
            userId: member.id,
          });

          if (!existingSession) {
            // Create a new session starting from now
            await VoiceSession.create({
              guildId: guild.id,
              userId: member.id,
              channelId: channel.id,
              startedAt: new Date(),
            });
            synced++;
          }
        }
      }
    }

    if (recovered > 0) {
      console.log(`🔄 Recovered ${recovered} voice session(s) from previous run`);
    }
    if (synced > 0) {
      console.log(`🔄 Synced ${synced} active voice user(s)`);
    }
  } catch (error) {
    console.error('Error recovering voice sessions:', error);
  }
}

/**
 * Finalize a voice session by adding time to user's total
 */
async function finalizeSession(session: any) {
  const duration = Date.now() - session.startedAt.getTime();

  await VoiceTime.findOneAndUpdate(
    { guildId: session.guildId, userId: session.userId },
    {
      $inc: { totalTime: duration },
      $set: { updatedAt: new Date() },
    },
    { upsert: true }
  );

  await VoiceSession.deleteOne({ _id: session._id });
}
