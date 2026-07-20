import { Schema, model, Document } from 'mongoose';

export interface IStreamer {
  name: string; // Display name
  platform: 'twitch' | 'youtube';
  channelId: string; // Twitch username or YouTube channel ID
  customMessage?: string; // Custom announcement message
  lastLiveAt?: Date; // Last time they were detected as live
  isCurrentlyLive: boolean;
}

export interface IStreamConfig extends Document {
  guildId: string;
  enabled: boolean;
  announcementChannelId?: string;
  mentionRoleId?: string; // Role to ping when someone goes live
  mentionEveryone?: boolean; // Ping @everyone when someone goes live
  streamers: IStreamer[];
  defaultMessage: string; // Default message template
  embedColor: string;
}

const StreamerSchema = new Schema<IStreamer>({
  name: { type: String, required: true },
  platform: { type: String, enum: ['twitch', 'youtube'], required: true },
  channelId: { type: String, required: true },
  customMessage: { type: String, required: false },
  lastLiveAt: { type: Date, required: false },
  isCurrentlyLive: { type: Boolean, default: false },
});

const StreamConfigSchema = new Schema<IStreamConfig>({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: true },
  announcementChannelId: { type: String, required: false },
  mentionRoleId: { type: String, required: false },
  mentionEveryone: { type: Boolean, default: false },
  streamers: { type: [StreamerSchema], default: [] },
  defaultMessage: {
    type: String,
    default: '🔴 **{streamer}** est en live sur {platform} !\n{title}\n{url}',
  },
  embedColor: { type: String, default: '#9146FF' }, // Twitch purple
});

export const StreamConfig = model<IStreamConfig>('StreamConfig', StreamConfigSchema);
