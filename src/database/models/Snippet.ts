import { Schema, model, Document } from 'mongoose';

export interface ISnippet extends Document {
  guildId: string;
  snippetNumber: number;
  authorId: string;
  authorTag: string;
  title: string;
  language: string;
  code: string;
  usageCount: number;
  createdAt: Date;
}

const SnippetSchema = new Schema<ISnippet>({
  guildId: { type: String, required: true, index: true },
  snippetNumber: { type: Number, required: true },
  authorId: { type: String, required: true },
  authorTag: { type: String, required: true },
  title: { type: String, required: true, maxlength: 100 },
  language: { type: String, required: true, lowercase: true, maxlength: 30 },
  code: { type: String, required: true, maxlength: 3800 },
  usageCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

SnippetSchema.index({ guildId: 1, snippetNumber: 1 }, { unique: true });
SnippetSchema.index({ guildId: 1, language: 1 });
SnippetSchema.index({ guildId: 1, createdAt: -1 });

export const Snippet = model<ISnippet>('Snippet', SnippetSchema);

export interface ISnippetCounter extends Document {
  guildId: string;
  counter: number;
}

const SnippetCounterSchema = new Schema<ISnippetCounter>({
  guildId: { type: String, required: true, unique: true },
  counter: { type: Number, default: 0 },
});

export const SnippetCounter = model<ISnippetCounter>('SnippetCounter', SnippetCounterSchema);
