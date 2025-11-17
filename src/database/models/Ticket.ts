import { Schema, model, Document } from 'mongoose';

export interface ITicket extends Document {
  guildId: string;
  channelId: string;
  userId: string;
  ticketNumber: number;
  createdAt: Date;
  status: 'open' | 'closed';
  category?: string;
}

const TicketSchema = new Schema<ITicket>({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  ticketNumber: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  category: { type: String, required: false },
});

export const Ticket = model<ITicket>('Ticket', TicketSchema);
