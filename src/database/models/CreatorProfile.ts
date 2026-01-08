import { Schema, model, Document } from 'mongoose';

export interface ISocialLink {
  platform: 'twitch' | 'youtube' | 'twitter' | 'instagram' | 'tiktok' | 'website' | 'discord';
  url: string;
  username?: string;
}

export interface ICreatorProfile extends Document {
  guildId: string;
  userId: string; // Discord user ID of the creator
  name: string; // Display name
  description: string;
  avatarUrl?: string;
  bannerColor: string;
  socialLinks: ISocialLink[];
  tags: string[]; // e.g., ["gaming", "IRL", "Just Chatting"]
  isVerified: boolean;
  featured: boolean; // Show in featured list
  createdAt: Date;
  updatedAt: Date;
}

const SocialLinkSchema = new Schema<ISocialLink>({
  platform: {
    type: String,
    enum: ['twitch', 'youtube', 'twitter', 'instagram', 'tiktok', 'website', 'discord'],
    required: true,
  },
  url: { type: String, required: true },
  username: { type: String, required: false },
});

const CreatorProfileSchema = new Schema<ICreatorProfile>({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  avatarUrl: { type: String, required: false },
  bannerColor: { type: String, default: '#9146FF' },
  socialLinks: { type: [SocialLinkSchema], default: [] },
  tags: { type: [String], default: [] },
  isVerified: { type: Boolean, default: true },
  featured: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Compound unique index
CreatorProfileSchema.index({ guildId: 1, userId: 1 }, { unique: true });

export const CreatorProfile = model<ICreatorProfile>('CreatorProfile', CreatorProfileSchema);
