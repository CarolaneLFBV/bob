import { EmbedBuilder, TextChannel, Guild } from 'discord.js';
import { LogConfig, ILogConfig } from '../database/models/LogConfig';

export type LogEventType =
  | 'memberJoin'
  | 'memberLeave'
  | 'messageDelete'
  | 'messageEdit'
  | 'voiceActivity'
  | 'moderation'
  | 'roleChanges'
  | 'channelChanges';

const LOG_COLORS: Record<LogEventType, number> = {
  memberJoin: 0x57f287, // Green
  memberLeave: 0xed4245, // Red
  messageDelete: 0xe67e22, // Orange
  messageEdit: 0xf1c40f, // Yellow
  voiceActivity: 0x3498db, // Blue
  moderation: 0x9b59b6, // Purple
  roleChanges: 0x1abc9c, // Teal
  channelChanges: 0x95a5a6, // Gray
};

const LOG_EMOJIS: Record<LogEventType, string> = {
  memberJoin: '📥',
  memberLeave: '📤',
  messageDelete: '🗑️',
  messageEdit: '✏️',
  voiceActivity: '🎤',
  moderation: '🔨',
  roleChanges: '🏷️',
  channelChanges: '📁',
};

/**
 * Send a log message to the appropriate channel
 */
export async function sendLog(
  guild: Guild,
  eventType: LogEventType,
  title: string,
  description: string,
  fields?: { name: string; value: string; inline?: boolean }[],
  thumbnail?: string
): Promise<void> {
  try {
    const config = await LogConfig.findOne({ guildId: guild.id });
    if (!config?.enabled) return;

    // Get the appropriate channel
    const channelId = config.channels[eventType] || config.channelId;
    if (!channelId) return;

    const channel = guild.channels.cache.get(channelId) as TextChannel;
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(LOG_COLORS[eventType])
      .setTitle(`${LOG_EMOJIS[eventType]} ${title}`)
      .setDescription(description)
      .setTimestamp();

    if (fields) {
      embed.addFields(fields);
    }

    if (thumbnail) {
      embed.setThumbnail(thumbnail);
    }

    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Error sending log:', error);
  }
}

/**
 * Check if an event type is enabled for a guild
 */
export async function isEventEnabled(
  guildId: string,
  eventKey: keyof ILogConfig['events']
): Promise<{ enabled: boolean; config: ILogConfig | null }> {
  const config = await LogConfig.findOne({ guildId });
  if (!config?.enabled) return { enabled: false, config: null };
  if (!config.events[eventKey]) return { enabled: false, config };
  return { enabled: true, config };
}

/**
 * Check if a channel or user should be ignored for logging
 */
export function shouldIgnore(
  config: ILogConfig,
  channelId?: string,
  roleIds?: string[]
): boolean {
  if (channelId && config.ignoredChannels.includes(channelId)) {
    return true;
  }
  if (roleIds && roleIds.some((id) => config.ignoredRoles.includes(id))) {
    return true;
  }
  return false;
}

/**
 * Format a timestamp for display
 */
export function formatTimestamp(date: Date): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:F>`;
}

/**
 * Truncate text to a maximum length
 */
export function truncate(text: string, maxLength: number = 1024): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}
