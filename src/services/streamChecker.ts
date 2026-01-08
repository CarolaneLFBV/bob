import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { StreamConfig, IStreamer } from '../database/models/StreamConfig';

interface TwitchStream {
  user_name: string;
  title: string;
  game_name: string;
  viewer_count: number;
  thumbnail_url: string;
  started_at: string;
}

interface TwitchTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

let twitchAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Get Twitch access token using client credentials
 */
async function getTwitchToken(): Promise<string | null> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  // Return cached token if still valid
  if (twitchAccessToken && Date.now() < tokenExpiresAt) {
    return twitchAccessToken;
  }

  try {
    const response = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
      { method: 'POST' }
    );

    if (!response.ok) {
      console.error('Failed to get Twitch token:', response.status);
      return null;
    }

    const data = (await response.json()) as TwitchTokenResponse;
    twitchAccessToken = data.access_token;
    tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000; // Refresh 1 min early

    return twitchAccessToken;
  } catch (error) {
    console.error('Error getting Twitch token:', error);
    return null;
  }
}

/**
 * Check if a Twitch streamer is live
 */
async function checkTwitchStream(username: string): Promise<TwitchStream | null> {
  const token = await getTwitchToken();
  const clientId = process.env.TWITCH_CLIENT_ID;

  if (!token || !clientId) {
    console.warn('Twitch API not configured - skipping stream check');
    return null;
  }

  try {
    const response = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=${username}`,
      {
        headers: {
          'Client-ID': clientId,
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      console.error('Twitch API error:', response.status);
      return null;
    }

    const data = (await response.json()) as { data: TwitchStream[] };
    return data.data.length > 0 ? data.data[0]! : null;
  } catch (error) {
    console.error('Error checking Twitch stream:', error);
    return null;
  }
}

/**
 * Check if a YouTube channel is live (simplified - checks RSS feed)
 */
async function checkYouTubeStream(channelId: string): Promise<{ title: string; videoId: string } | null> {
  try {
    // Use YouTube RSS feed to check for recent videos/streams
    const response = await fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
    );

    if (!response.ok) {
      return null;
    }

    const xml = await response.text();

    // Simple check for live indicator in recent video titles
    // This is a basic approach - full implementation would need YouTube API
    const liveMatch = xml.match(/<title>([^<]*(?:LIVE|EN DIRECT|🔴)[^<]*)<\/title>/i);
    if (liveMatch) {
      const videoIdMatch = xml.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
      return {
        title: liveMatch[1] || 'Live',
        videoId: videoIdMatch?.[1] ?? '',
      };
    }

    return null;
  } catch (error) {
    console.error('Error checking YouTube:', error);
    return null;
  }
}

/**
 * Send stream notification
 */
async function sendNotification(
  client: Client,
  guildId: string,
  channelId: string,
  streamer: IStreamer,
  streamData: { title: string; url: string; thumbnail?: string; viewers?: number; game?: string },
  config: any
): Promise<void> {
  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    const channel = guild.channels.cache.get(channelId) as TextChannel;
    if (!channel) return;

    const platformColors: Record<string, number> = {
      twitch: 0x9146ff,
      youtube: 0xff0000,
    };

    const platformEmojis: Record<string, string> = {
      twitch: '<:twitch:1234567890>', // Will show as text if custom emoji not available
      youtube: '📺',
    };

    const embed = new EmbedBuilder()
      .setColor(platformColors[streamer.platform] || 0x5865f2)
      .setTitle(`🔴 ${streamer.name} est en live !`)
      .setDescription(streamData.title || 'Pas de titre')
      .setURL(streamData.url)
      .addFields(
        { name: 'Plateforme', value: streamer.platform.charAt(0).toUpperCase() + streamer.platform.slice(1), inline: true }
      )
      .setTimestamp();

    if (streamData.game) {
      embed.addFields({ name: 'Jeu', value: streamData.game, inline: true });
    }

    if (streamData.viewers) {
      embed.addFields({ name: 'Viewers', value: streamData.viewers.toString(), inline: true });
    }

    if (streamData.thumbnail) {
      embed.setImage(streamData.thumbnail.replace('{width}', '1280').replace('{height}', '720'));
    }

    const mention = config.mentionRoleId ? `<@&${config.mentionRoleId}>` : '';

    await channel.send({
      content: mention || undefined,
      embeds: [embed],
    });

    console.log(`📺 Sent live notification for ${streamer.name} (${streamer.platform})`);
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

/**
 * Check all streamers for all guilds
 */
export async function checkAllStreams(client: Client): Promise<void> {
  try {
    const configs = await StreamConfig.find({ enabled: true });

    for (const config of configs) {
      if (!config.announcementChannelId || config.streamers.length === 0) continue;

      for (const streamer of config.streamers) {
        let isLive = false;
        let streamData: { title: string; url: string; thumbnail?: string; viewers?: number; game?: string } | null = null;

        if (streamer.platform === 'twitch') {
          const stream = await checkTwitchStream(streamer.channelId);
          if (stream) {
            isLive = true;
            streamData = {
              title: stream.title,
              url: `https://twitch.tv/${streamer.channelId}`,
              thumbnail: stream.thumbnail_url,
              viewers: stream.viewer_count,
              game: stream.game_name,
            };
          }
        } else if (streamer.platform === 'youtube') {
          const stream = await checkYouTubeStream(streamer.channelId);
          if (stream) {
            isLive = true;
            streamData = {
              title: stream.title,
              url: `https://www.youtube.com/watch?v=${stream.videoId}`,
            };
          }
        }

        // Check if status changed to live
        if (isLive && !streamer.isCurrentlyLive && streamData) {
          await sendNotification(
            client,
            config.guildId,
            config.announcementChannelId,
            streamer,
            streamData,
            config
          );

          // Update streamer status
          streamer.isCurrentlyLive = true;
          streamer.lastLiveAt = new Date();
        } else if (!isLive && streamer.isCurrentlyLive) {
          // Stream ended
          streamer.isCurrentlyLive = false;
        }
      }

      await config.save();
    }
  } catch (error) {
    console.error('Error checking streams:', error);
  }
}

/**
 * Start the stream checker interval
 */
export function startStreamChecker(client: Client, intervalMs: number = 60000): NodeJS.Timeout {
  console.log('📺 Stream checker started (checking every', intervalMs / 1000, 'seconds)');

  // Initial check
  setTimeout(() => checkAllStreams(client), 5000);

  // Regular interval
  return setInterval(() => checkAllStreams(client), intervalMs);
}
