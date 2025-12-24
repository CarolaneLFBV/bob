import { Schema, model, Document } from 'mongoose';

export interface IVoiceSession extends Document {
  guildId: string;
  userId: string;
  channelId: string;
  startedAt: Date;
}

const VoiceSessionSchema = new Schema<IVoiceSession>({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  channelId: { type: String, required: true },
  startedAt: { type: Date, default: Date.now },
});

// Compound unique index - one active session per user per guild
VoiceSessionSchema.index({ guildId: 1, userId: 1 }, { unique: true });

export const VoiceSession = model<IVoiceSession>('VoiceSession', VoiceSessionSchema);
