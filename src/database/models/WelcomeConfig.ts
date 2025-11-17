import { Schema, model, Document } from 'mongoose';

export interface IWelcomeConfig extends Document {
  guildId: string;
  channelId: string;
  enabled: boolean;
  title: string;
  description: string;
  embedColor: string;
  imageUrl?: string;
  mentionUser: boolean;
}

const WelcomeConfigSchema = new Schema<IWelcomeConfig>({
  guildId: { type: String, required: true, unique: true },
  channelId: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  title: { type: String, default: 'Bienvenue {user} !' },
  description: { type: String, default: 'Bienvenue sur **{server}** ! Tu es le membre #{memberCount}' },
  embedColor: { type: String, default: '#5865F2' },
  imageUrl: { type: String, required: false },
  mentionUser: { type: Boolean, default: false },
});

export const WelcomeConfig = model<IWelcomeConfig>('WelcomeConfig', WelcomeConfigSchema);
