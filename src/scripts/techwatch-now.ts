/**
 * One-shot : déclenche un post Tech Watch immédiatement (force=true).
 *
 * Utilise UNIQUEMENT l'API REST de Discord — pas de connexion gateway.
 * Donc aucun impact sur le bot principal qui tourne via PM2 : ils ne
 * partagent pas de session.
 *
 * Usage :
 *   bun src/scripts/techwatch-now.ts
 */
import { REST, Routes, EmbedBuilder } from 'discord.js';
import mongoose from 'mongoose';
import { runTechWatchOnce, Poster } from '../services/techWatch';
import { TECHWATCH_CHANNEL_ID } from '../config/techwatch';

const GUILD_ID = '1390017627715403776';

async function main() {
  if (!process.env.DISCORD_TOKEN || !process.env.MONGODB_URI) {
    throw new Error('❌ DISCORD_TOKEN ou MONGODB_URI manquant');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  // Poster REST : crée le message via API, puis ajoute les réactions.
  const poster: Poster = async (embed: EmbedBuilder, reactions: string[]) => {
    const message = (await rest.post(Routes.channelMessages(TECHWATCH_CHANNEL_ID), {
      body: { embeds: [embed.toJSON()] },
    })) as { id: string };

    for (const emoji of reactions) {
      try {
        await rest.put(
          Routes.channelMessageOwnReaction(TECHWATCH_CHANNEL_ID, message.id, encodeURIComponent(emoji))
        );
      } catch {
        /* ignore reaction failures */
      }
    }

    return { messageId: message.id };
  };

  console.log('📤 Tech Watch (force=true)…\n');
  const result = await runTechWatchOnce(poster, GUILD_ID, TECHWATCH_CHANNEL_ID, { force: true });

  if (result.posted) {
    console.log(`\n✅ Posté · message ${result.messageId}`);
  } else {
    console.log(`\n⚠️ Non posté : ${result.reason}`);
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('❌ Échec :', err);
  process.exit(1);
});
