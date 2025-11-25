import { Schema, model, Document } from 'mongoose';

export interface IVoiceConfig extends Document {
  guildId: string;
  panelChannelId: string;
  categoryId: string;
  defaultUserLimit: number;
}

const VoiceConfigSchema = new Schema<IVoiceConfig>({
  guildId: { type: String, required: true, unique: true },
  panelChannelId: { type: String, required: true },
  categoryId: { type: String, required: true },
  defaultUserLimit: { type: Number, default: 0 }, // 0 = unlimited
});

export const VoiceConfig = model<IVoiceConfig>('VoiceConfig', VoiceConfigSchema);
