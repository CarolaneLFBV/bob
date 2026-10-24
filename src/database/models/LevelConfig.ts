import { Schema, model, Document } from 'mongoose';

export interface ILevelReward {
  level: number;
  roleId: string;
}

export interface ILevelConfig extends Document {
  guildId: string;
  enabled: boolean;
  announcementChannelId?: string; // Channel for level-up announcements (null = same channel)
  ignoredChannels: string[]; // Channels where XP is not earned
  ignoredRoles: string[]; // Roles that don't earn XP
  xpPerMessage: { min: number; max: number }; // Random XP range per message
  messageCooldown: number; // Cooldown in seconds between XP gains from messages
  levelUpMessage: string; // Custom level-up message
  rewards: ILevelReward[]; // Role rewards for reaching levels
  stackRewards: boolean; // If false, only keep highest role
}

const LevelConfigSchema = new Schema<ILevelConfig>({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: true },
  announcementChannelId: { type: String, required: false },
  ignoredChannels: { type: [String], default: [] },
  ignoredRoles: { type: [String], default: [] },
  xpPerMessage: {
    min: { type: Number, default: 15 },
    max: { type: Number, default: 25 },
  },
  messageCooldown: { type: Number, default: 60 }, // 60 seconds
  levelUpMessage: {
    type: String,
    default: '🎉 Félicitations {user} ! Tu es maintenant niveau **{level}** !',
  },
  rewards: {
    type: [
      {
        level: { type: Number, required: true },
        roleId: { type: String, required: true },
      },
    ],
    default: [],
  },
  stackRewards: { type: Boolean, default: true },
});

export const LevelConfig = model<ILevelConfig>('LevelConfig', LevelConfigSchema);
