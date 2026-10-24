import { Schema, model, Document } from 'mongoose';

export interface INotificationConfig extends Document {
  guildId: string;
  enabled: boolean;
  channelId?: string; // Salon des annonces
  newsRoleId?: string; // Rôle pingé pour un nouvel article (🍎・Curious)
  keepioIosRoleId?: string; // Rôle pingé pour une nouvelle version iOS de Keepio
  keepioAndroidRoleId?: string; // Rôle pingé pour une nouvelle version Android de Keepio
  lastArticleAnnouncedAt?: Date; // Curseur : announcedAt du dernier article notifié
  lastKeepioIosVersion?: string; // Dernière version iOS notifiée
  lastKeepioAndroidVersion?: string; // Dernier versionCode Android notifié ('none' tant que rien n'est en production)
}

const NotificationConfigSchema = new Schema<INotificationConfig>({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: true },
  channelId: { type: String, required: false },
  newsRoleId: { type: String, required: false },
  keepioIosRoleId: { type: String, required: false },
  keepioAndroidRoleId: { type: String, required: false },
  lastArticleAnnouncedAt: { type: Date, required: false },
  lastKeepioIosVersion: { type: String, required: false },
  lastKeepioAndroidVersion: { type: String, required: false },
});

export const NotificationConfig = model<INotificationConfig>('NotificationConfig', NotificationConfigSchema);
