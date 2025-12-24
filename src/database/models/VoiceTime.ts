import { Schema, model, Document } from 'mongoose';

export interface IVoiceTime extends Document {
  guildId: string;
  userId: string;
  totalTime: number; // Total time in milliseconds
  updatedAt: Date;
}

const VoiceTimeSchema = new Schema<IVoiceTime>({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  totalTime: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now },
});

// Compound unique index for efficient lookups
VoiceTimeSchema.index({ guildId: 1, userId: 1 }, { unique: true });

export const VoiceTime = model<IVoiceTime>('VoiceTime', VoiceTimeSchema);
