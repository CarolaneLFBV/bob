import { Schema, model, Document } from 'mongoose';

export interface ILogConfig extends Document {
  guildId: string;
  enabled: boolean;
  channelId?: string; // Main log channel
  // Specific channel overrides (optional)
  channels: {
    memberJoin?: string;
    memberLeave?: string;
    messageDelete?: string;
    messageEdit?: string;
    voiceActivity?: string;
    moderation?: string; // bans, kicks, timeouts
    roleChanges?: string;
    channelChanges?: string;
  };
  // What to log
  events: {
    memberJoin: boolean;
    memberLeave: boolean;
    messageDelete: boolean;
    messageEdit: boolean;
    voiceJoin: boolean;
    voiceLeave: boolean;
    voiceSwitch: boolean;
    memberBan: boolean;
    memberUnban: boolean;
    roleAdd: boolean;
    roleRemove: boolean;
    nicknameChange: boolean;
  };
  // Ignored channels/roles for message logs
  ignoredChannels: string[];
  ignoredRoles: string[];
}

const LogConfigSchema = new Schema<ILogConfig>({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: true },
  channelId: { type: String, required: false },
  channels: {
    memberJoin: { type: String, required: false },
    memberLeave: { type: String, required: false },
    messageDelete: { type: String, required: false },
    messageEdit: { type: String, required: false },
    voiceActivity: { type: String, required: false },
    moderation: { type: String, required: false },
    roleChanges: { type: String, required: false },
    channelChanges: { type: String, required: false },
  },
  events: {
    memberJoin: { type: Boolean, default: true },
    memberLeave: { type: Boolean, default: true },
    messageDelete: { type: Boolean, default: true },
    messageEdit: { type: Boolean, default: true },
    voiceJoin: { type: Boolean, default: false },
    voiceLeave: { type: Boolean, default: false },
    voiceSwitch: { type: Boolean, default: false },
    memberBan: { type: Boolean, default: true },
    memberUnban: { type: Boolean, default: true },
    roleAdd: { type: Boolean, default: true },
    roleRemove: { type: Boolean, default: true },
    nicknameChange: { type: Boolean, default: true },
  },
  ignoredChannels: { type: [String], default: [] },
  ignoredRoles: { type: [String], default: [] },
});

export const LogConfig = model<ILogConfig>('LogConfig', LogConfigSchema);
