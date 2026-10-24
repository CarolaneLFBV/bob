import { Schema, model, Document } from 'mongoose';

export interface IUserLevel extends Document {
  guildId: string;
  userId: string;
  xp: number;
  level: number;
  totalMessages: number;
  messageXp: number; // XP earned from messages
  lastMessageAt: Date; // For cooldown
  updatedAt: Date;
}

const UserLevelSchema = new Schema<IUserLevel>({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 0 },
  totalMessages: { type: Number, default: 0 },
  messageXp: { type: Number, default: 0 },
  lastMessageAt: { type: Date, default: new Date(0) },
  updatedAt: { type: Date, default: Date.now },
});

// Compound unique index
UserLevelSchema.index({ guildId: 1, userId: 1 }, { unique: true });
// Index for leaderboard queries
UserLevelSchema.index({ guildId: 1, xp: -1 });

export const UserLevel = model<IUserLevel>('UserLevel', UserLevelSchema);
