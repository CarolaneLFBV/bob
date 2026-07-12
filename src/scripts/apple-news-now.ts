/**
 * One-shot : déclenche un post Apple News immédiatement (force=true).
 * Utilise uniquement l'API REST — aucun impact sur le bot PM2.
 *
 * Usage : bun src/scripts/apple-news-now.ts
 */
import { REST, Routes, EmbedBuilder } from 'discord.js';
import mongoose from 'mongoose';
import { runAppleNewsOnce, Poster } from '../services/appleNews';
import { APPLE_NEWS_CHANNEL_ID, APPLE_NEWS_CURIOUS_ROLE_ID } from '../config/appleNews';

const GUILD_ID = '1390017627715403776';

async function main() {
  if (!process.env.DISCORD_TOKEN || !process.env.MONGODB_URI) {
    throw new Error('❌ DISCORD_TOKEN ou MONGODB_URI manquant');
  }
  await mongoose.connect(process.env.MONGODB_URI);
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  const poster: Poster = async (embed: EmbedBuilder, content: string, reactions: string[]) => {
    const message = (await rest.post(Routes.channelMessages(APPLE_NEWS_CHANNEL_ID), {
      body: {
        content,
        embeds: [embed.toJSON()],
        allowed_mentions: { roles: [APPLE_NEWS_CURIOUS_ROLE_ID] },
      },
    })) as { id: string };
    for (const emoji of reactions) {
      try {
        await rest.put(Routes.channelMessageOwnReaction(APPLE_NEWS_CHANNEL_ID, message.id, encodeURIComponent(emoji)));
      } catch { /* ignore */ }
    }
    return { messageId: message.id };
  };

  console.log('📤 Apple News (force=true)…\n');
  const result = await runAppleNewsOnce(poster, GUILD_ID, APPLE_NEWS_CHANNEL_ID, { force: true });
  console.log(result.posted ? `\n✅ Posté · message ${result.messageId}` : `\n⚠️ Non posté : ${result.reason}`);

  await mongoose.disconnect();
}

main().catch(err => { console.error('❌ Échec :', err); process.exit(1); });
