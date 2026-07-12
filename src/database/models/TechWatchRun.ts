import { Schema, model, Document } from 'mongoose';

/**
 * Un run = un post quotidien de Tech Watch dans un guild.
 * Sert à :
 * - Empêcher le double-post le même jour (cron tolérant)
 * - Stocker les IDs externes (HN story ID, GitHub repo full_name) déjà postés
 *   pour la dédup sur N jours glissants
 */
export interface ITechWatchRun extends Document {
  guildId: string;
  channelId: string;
  parisDate: string; // YYYY-MM-DD
  messageId?: string;
  arsUrls: string[]; // URLs des articles Ars Technica postés
  tcUrls: string[]; // URLs des articles TechCrunch postés
  lobsterIds: string[]; // short_ids Lobsters postés
  githubRepos: string[]; // ex: "facebook/react"
  // Legacy (anciens runs), conservés pour compat
  hfPapers: string[];
  hnIds: number[];
  createdAt: Date;
}

const TechWatchRunSchema = new Schema<ITechWatchRun>({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  parisDate: { type: String, required: true },
  messageId: { type: String, required: false },
  arsUrls: { type: [String], default: [] },
  tcUrls: { type: [String], default: [] },
  lobsterIds: { type: [String], default: [] },
  githubRepos: { type: [String], default: [] },
  hfPapers: { type: [String], default: [] },
  hnIds: { type: [Number], default: [] },
  createdAt: { type: Date, default: Date.now },
});

TechWatchRunSchema.index({ guildId: 1, parisDate: 1 }, { unique: true });
TechWatchRunSchema.index({ createdAt: -1 });

export const TechWatchRun = model<ITechWatchRun>('TechWatchRun', TechWatchRunSchema);
