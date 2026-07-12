import { Schema, model, Document } from 'mongoose';

/**
 * Un run = un post quotidien d'Apple News dans un guild.
 * - Empêche le double-post le même jour (cron tolérant)
 * - Stocke les URLs déjà postées pour la dédup sur 7 jours glissants
 */
export interface IAppleNewsRun extends Document {
  guildId: string;
  channelId: string;
  parisDate: string; // YYYY-MM-DD
  messageId?: string;
  postedUrls: string[];
  createdAt: Date;
}

const AppleNewsRunSchema = new Schema<IAppleNewsRun>({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  parisDate: { type: String, required: true },
  messageId: { type: String, required: false },
  postedUrls: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now },
});

AppleNewsRunSchema.index({ guildId: 1, parisDate: 1 }, { unique: true });
AppleNewsRunSchema.index({ createdAt: -1 });

export const AppleNewsRun = model<IAppleNewsRun>('AppleNewsRun', AppleNewsRunSchema);
