import { Schema, model, Document } from 'mongoose';

export interface ITempVoiceChannel extends Document {
  guildId: string;
  channelId: string;
  creatorId: string;
  baseName: string;
  createdAt: Date;
}

const TempVoiceChannelSchema = new Schema<ITempVoiceChannel>({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true, unique: true },
  creatorId: { type: String, required: true },
  baseName: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

// Index for efficient lookups
TempVoiceChannelSchema.index({ guildId: 1, baseName: 1 });

export const TempVoiceChannel = model<ITempVoiceChannel>('TempVoiceChannel', TempVoiceChannelSchema);
