/**
 * Diagnostic du serveur Discord :
 * - Cartographie des catégories et salons
 * - Activité récente par salon (échantillon des 100 derniers messages)
 * - Stats d'usage des features bot stockées en Mongo
 *
 * Usage : bun src/scripts/analyze-server.ts
 */
import { REST, Routes, ChannelType } from 'discord.js';
import mongoose from 'mongoose';
import { WelcomeConfig } from '../database/models/WelcomeConfig';
import { LevelConfig } from '../database/models/LevelConfig';
import { UserLevel } from '../database/models/UserLevel';
import { VoiceConfig } from '../database/models/VoiceConfig';
import { LogConfig } from '../database/models/LogConfig';

const GUILD_ID = '1390017627715403776';
const EXCLUDED_KEYWORDS = ['modération', 'moderation', 'staff', 'admin'];

const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;

function snowflakeToDate(id: string): Date {
  return new Date(Number(BigInt(id) >> 22n) + 1420070400000);
}

function ageDays(date: Date): number {
  return (NOW - date.getTime()) / DAY;
}

async function main() {
  const token = process.env.DISCORD_TOKEN;
  const mongoUri = process.env.MONGODB_URI;
  if (!token || !mongoUri) {
    console.error('❌ DISCORD_TOKEN ou MONGODB_URI manquant');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);

  const rest = new REST({ version: '10' }).setToken(token);

  console.log('═══════════════════════════════════════');
  console.log(' 📊 DIAGNOSTIC DU SERVEUR');
  console.log('═══════════════════════════════════════\n');

  // ─── 1. Structure des catégories et salons ───
  const channels = (await rest.get(Routes.guildChannels(GUILD_ID))) as any[];
  const categories = channels.filter(c => c.type === ChannelType.GuildCategory);
  const textChannels = channels.filter(c =>
    [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(c.type)
  );
  const voiceChannels = channels.filter(c => c.type === ChannelType.GuildVoice);

  console.log('🏛️  STRUCTURE');
  console.log(`   • ${categories.length} catégories`);
  console.log(`   • ${textChannels.length} salons texte`);
  console.log(`   • ${voiceChannels.length} salons vocaux\n`);

  // ─── 2. Activité par salon (hors exclus) ───
  console.log('💬 ACTIVITÉ DES SALONS TEXTE (hors Modération)\n');

  type Activity = {
    name: string;
    category: string;
    msg7d: number;
    msg30d: number;
    msgTotal: number;
    lastMsgAge: number | null;
    lastAuthor?: string;
  };
  const activityRows: Activity[] = [];

  for (const cat of categories) {
    const catLower = cat.name.toLowerCase();
    if (EXCLUDED_KEYWORDS.some(k => catLower.includes(k))) continue;

    const inCat = textChannels.filter(c => c.parent_id === cat.id);
    for (const ch of inCat) {
      try {
        const msgs = (await rest.get(Routes.channelMessages(ch.id), {
          query: new URLSearchParams({ limit: '100' }),
        } as any)) as any[];

        let m7 = 0;
        let m30 = 0;
        let lastAge: number | null = null;
        let lastAuthor: string | undefined;

        for (const m of msgs) {
          const created = new Date(m.timestamp);
          const age = ageDays(created);
          if (lastAge === null || age < lastAge) {
            lastAge = age;
            lastAuthor = m.author?.username;
          }
          if (age <= 7) m7++;
          if (age <= 30) m30++;
        }

        activityRows.push({
          name: ch.name,
          category: cat.name,
          msg7d: m7,
          msg30d: m30,
          msgTotal: msgs.length,
          lastMsgAge: lastAge,
          lastAuthor,
        });
      } catch (err) {
        // Salon inaccessible (permission, etc.) — skip
      }
    }
  }

  // Tri par activité décroissante 30j
  activityRows.sort((a, b) => b.msg30d - a.msg30d);

  console.log(
    `   ${'Catégorie / Salon'.padEnd(50)} ${'7j'.padStart(5)} ${'30j'.padStart(5)} ${'Dernier'.padStart(12)}`
  );
  console.log(`   ${'─'.repeat(80)}`);
  for (const a of activityRows) {
    const last =
      a.lastMsgAge === null
        ? 'jamais'
        : a.lastMsgAge < 1
          ? `${Math.round(a.lastMsgAge * 24)}h`
          : `${Math.round(a.lastMsgAge)}j`;
    const label = `${a.category} / #${a.name}`.slice(0, 50).padEnd(50);
    console.log(
      `   ${label} ${String(a.msg7d).padStart(5)} ${String(a.msg30d).padStart(5)} ${last.padStart(12)}`
    );
  }
  console.log();

  // ─── 3. Stats globales ───
  const totals = activityRows.reduce(
    (acc, a) => ({
      m7: acc.m7 + a.msg7d,
      m30: acc.m30 + a.msg30d,
      dead7: acc.dead7 + (a.msg7d === 0 ? 1 : 0),
      dead30: acc.dead30 + (a.msg30d === 0 ? 1 : 0),
    }),
    { m7: 0, m30: 0, dead7: 0, dead30: 0 }
  );

  console.log('📈 TOTAUX (hors exclus)');
  console.log(`   • Messages 7j  : ${totals.m7}`);
  console.log(`   • Messages 30j : ${totals.m30}`);
  console.log(`   • Salons morts 7j  : ${totals.dead7} / ${activityRows.length}`);
  console.log(`   • Salons morts 30j : ${totals.dead30} / ${activityRows.length}\n`);

  // ─── 4. Stats des features bot ───
  console.log('🤖 USAGE DES FEATURES BOT\n');

  const welcomeCfg = await WelcomeConfig.findOne({ guildId: GUILD_ID });
  console.log(
    `   Welcome : ${
      welcomeCfg ? (welcomeCfg.enabled ? `✅ actif (canal <#${welcomeCfg.channelId}>)` : '⚠️ configuré mais désactivé') : '❌ non configuré'
    }`
  );

  const levelCfg = await LevelConfig.findOne({ guildId: GUILD_ID });
  console.log(
    `   Levels  : ${
      levelCfg ? (levelCfg.enabled ? '✅ actif' : '⚠️ configuré mais désactivé') : '❌ non configuré'
    }`
  );

  const levelCount = await UserLevel.countDocuments({ guildId: GUILD_ID });
  if (levelCount > 0) {
    const topLevels = await UserLevel.find({ guildId: GUILD_ID }).sort({ xp: -1 }).limit(5);
    console.log(`   └─ ${levelCount} membres avec XP`);
    console.log(`      Top 5 : ${topLevels.map(l => `<@${l.userId}> (lvl ${l.level})`).join(', ')}`);
  }

  const voiceCfg = await VoiceConfig.findOne({ guildId: GUILD_ID });
  console.log(`   Voice JTC : ${voiceCfg ? '✅ actif' : '❌ non configuré'}`);

  const logCfg = await LogConfig.findOne({ guildId: GUILD_ID });
  console.log(`   Logs : ${logCfg ? '✅ actif' : '❌ non configuré'}`);

  // ─── 5. Top salons à revitaliser ───
  console.log('\n🚨 SALONS À REVITALISER (les + morts, hors annonces)\n');
  const deadChannels = activityRows
    .filter(a => a.msg7d === 0 && !a.name.includes('annonce') && !a.name.includes('regle'))
    .sort((a, b) => (a.lastMsgAge ?? 9999) - (b.lastMsgAge ?? 9999))
    .reverse()
    .slice(0, 10);
  for (const d of deadChannels) {
    const last = d.lastMsgAge === null ? 'jamais' : `${Math.round(d.lastMsgAge)}j`;
    console.log(`   • ${d.category} / #${d.name}  (dernier message : ${last})`);
  }

  await mongoose.disconnect();
  console.log('\n✅ Analyse terminée.');
}

main().catch(err => {
  console.error('❌ Échec :', err);
  process.exit(1);
});
