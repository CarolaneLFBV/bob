import { Schema, model, Document } from 'mongoose';

export interface ITicketConfig extends Document {
  guildId: string;
  panelChannelId: string;
  categoryId: string;
  supportRoleId?: string;
  transcriptChannelId?: string;
  ticketCounter: number;
}

const TicketConfigSchema = new Schema<ITicketConfig>({
  guildId: { type: String, required: true, unique: true },
  panelChannelId: { type: String, required: true },
  categoryId: { type: String, required: true },
  supportRoleId: { type: String, required: false },
  transcriptChannelId: { type: String, required: false },
  ticketCounter: { type: Number, default: 0 },
});

export const TicketConfig = model<ITicketConfig>('TicketConfig', TicketConfigSchema);
