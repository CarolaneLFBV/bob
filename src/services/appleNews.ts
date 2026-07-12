/**
 * Service Apple News.
 *
 * Sources (gratuites, sans clé API) — Apple uniquement :
 *  - MacRumors (RSS)        — rumeurs & actu produits/logiciels
 *  - 9to5Mac (RSS)          — actu Apple, apps, deals
 *  - Apple Newsroom (RSS)   — communiqués officiels d'Apple
 *
 * Pipeline (identique à Tech Watch) :
 *  - Récupère les sources en parallèle (erreurs isolées).
 *  - Dédup sur 7 jours glissants.
 *  - Construit un embed, ping @Curious, persiste le run.
 */
import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { AppleNewsRun } from '../database/models/AppleNewsRun';
import {
  APPLE_NEWS_CHANNEL_ID,
  APPLE_NEWS_CURIOUS_ROLE_ID,
  APPLE_NEWS_POST_HOUR_PARIS,
  APPLE_NEWS_POST_MINUTE_PARIS,
  APPLE_NEWS_POST_WINDOW_MINUTES,
  APPLE_NEWS_MACRUMORS_COUNT,
  APPLE_NEWS_9TO5_COUNT,
  APPLE_NEWS_NEWSROOM_COUNT,
} from '../config/appleNews';
import { getParisNow } from '../config/techwatch';

interface Article {
  title: string;
  url: string;
  pubDate?: string;
}

// ─── Parsing ───
function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function stripHtml(text: string): string {
  return decodeEntities(text.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

// RSS 2.0 (<item> + <link>texte</link>) — MacRumors, 9to5Mac
function parseRssItems(xml: string): Article[] {
  const items: Article[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    const titleMatch =
      item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ?? item.match(/<title>([\s\S]*?)<\/title>/);
    const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/);
    const dateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    if (titleMatch && linkMatch) {
      items.push({ title: stripHtml(titleMatch[1]), url: linkMatch[1].trim(), pubDate: dateMatch?.[1]?.trim() });
    }
  }
  return items;
}

// Atom (<entry> + <link href> + <id>url</id>) — Apple Newsroom
function parseAtomEntries(xml: string): Article[] {
  const items: Article[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match: RegExpExecArray | null;
  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];
    const titleMatch =
      entry.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ?? entry.match(/<title>([\s\S]*?)<\/title>/);
    // L'URL de l'article = <id> (permalien), fallback sur le 1er <link href>
    const idMatch = entry.match(/<id><!\[CDATA\[([\s\S]*?)\]\]><\/id>/);
    const linkMatch = entry.match(/<link\s+href="([^"]+)"\s*\/>/);
    const url = idMatch?.[1]?.trim() ?? linkMatch?.[1]?.trim();
    if (titleMatch && url) items.push({ title: stripHtml(titleMatch[1]), url });
  }
  return items;
}

async function fetchFeed(url: string, label: string, atom = false): Promise<Article[]> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KeepOS-Discord-Bot/1.0)' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`${label} ${res.status}`);
  const xml = await res.text();
  return atom ? parseAtomEntries(xml) : parseRssItems(xml);
}

const fetchMacRumors = () => fetchFeed('https://feeds.macrumors.com/MacRumors-All', 'MacRumors');
const fetch9to5Mac = () => fetchFeed('https://9to5mac.com/feed/', '9to5Mac');
const fetchNewsroom = () => fetchFeed('https://www.apple.com/newsroom/rss-feed.rss', 'Apple Newsroom', true);

// ─── Dédup 7 jours ───
async function getRecentlyPosted(guildId: string): Promise<Set<string>> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const runs = await AppleNewsRun.find({ guildId, createdAt: { $gte: sevenDaysAgo } });
  const urls = new Set<string>();
  for (const r of runs) r.postedUrls.forEach(u => urls.add(u));
  return urls;
}

function formatDateFR(): string {
  return new Date().toLocaleDateString('fr-FR', {
    timeZone: 'Europe/Paris',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
}

function buildEmbed(mac: Article[], nto: Article[], news: Article[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor('#0A84FF')
    .setTitle(`🍎 Apple News — ${formatDateFR()}`)
    .setDescription("L'actu Apple du jour : produits, logiciels, écosystème.");

  const section = (arr: Article[]) =>
    truncate(arr.map(a => `• [${truncate(a.title, 200)}](${a.url})`).join('\n'), 1024);

  if (mac.length) embed.addFields({ name: '📰 MacRumors', value: section(mac), inline: false });
  if (nto.length) embed.addFields({ name: '🍏 9to5Mac', value: section(nto), inline: false });
  if (news.length) embed.addFields({ name: '📢 Apple Newsroom', value: section(news), inline: false });

  embed.setFooter({ text: 'Réagis avec 🔥 / 👀 / 🤯' }).setTimestamp();
  return embed;
}

// ─── Pipeline ───
export type Poster = (
  embed: EmbedBuilder,
  content: string,
  reactions: string[]
) => Promise<{ messageId: string }>;

export async function runAppleNewsOnce(
  poster: Poster,
  guildId: string,
  channelId: string,
  options: { force?: boolean } = {}
): Promise<{ posted: boolean; reason?: string; messageId?: string }> {
  const { date: parisDate } = getParisNow();

  if (!options.force) {
    const existing = await AppleNewsRun.findOne({ guildId, parisDate });
    if (existing) return { posted: false, reason: `Déjà posté aujourd'hui (${parisDate})`, messageId: existing.messageId };
  }

  const seen = await getRecentlyPosted(guildId);
  const [macRes, ntoRes, newsRes] = await Promise.allSettled([fetchMacRumors(), fetch9to5Mac(), fetchNewsroom()]);

  const pick = (r: PromiseSettledResult<Article[]>, n: number) =>
    r.status === 'fulfilled' ? r.value.filter(a => !seen.has(a.url)).slice(0, n) : [];

  const mac = pick(macRes, APPLE_NEWS_MACRUMORS_COUNT);
  const nto = pick(ntoRes, APPLE_NEWS_9TO5_COUNT);
  const news = pick(newsRes, APPLE_NEWS_NEWSROOM_COUNT);

  if (macRes.status === 'rejected') console.warn('⚠️ MacRumors:', macRes.reason);
  if (ntoRes.status === 'rejected') console.warn('⚠️ 9to5Mac:', ntoRes.reason);
  if (newsRes.status === 'rejected') console.warn('⚠️ Apple Newsroom:', newsRes.reason);

  if (mac.length === 0 && nto.length === 0 && news.length === 0) {
    return { posted: false, reason: 'Aucune nouveauté Apple (sources HS ou déjà postées)' };
  }

  const embed = buildEmbed(mac, nto, news);
  const content = `<@&${APPLE_NEWS_CURIOUS_ROLE_ID}> 🍎 Le point Apple du jour !`;
  const { messageId } = await poster(embed, content, ['🔥', '👀', '🤯']);

  await AppleNewsRun.findOneAndUpdate(
    { guildId, parisDate },
    {
      $set: { channelId, messageId, postedUrls: [...mac, ...nto, ...news].map(a => a.url) },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true, new: true }
  );

  console.log(`✅ Apple News posté (${parisDate}) : ${mac.length} MacR · ${nto.length} 9to5 · ${news.length} Newsroom · msg ${messageId}`);
  return { posted: true, messageId };
}

// ─── Poster côté Client ───
export function clientPoster(client: Client, channelId: string): Poster {
  return async (embed, content, reactions) => {
    const channel = (await client.channels.fetch(channelId).catch(() => null)) as TextChannel | null;
    if (!channel || !channel.isTextBased()) throw new Error(`Channel ${channelId} introuvable`);
    const message = await channel.send({
      content,
      embeds: [embed],
      allowedMentions: { roles: [APPLE_NEWS_CURIOUS_ROLE_ID] },
    });
    for (const emoji of reactions) {
      try { await message.react(emoji); } catch { /* ignore */ }
    }
    return { messageId: message.id };
  };
}

// ─── Scheduler ───
let schedulerStarted = false;

export function startAppleNewsScheduler(client: Client, guildId: string) {
  if (schedulerStarted) return;
  schedulerStarted = true;

  const tick = async () => {
    try {
      const { hour, minute } = getParisNow();
      if (
        hour === APPLE_NEWS_POST_HOUR_PARIS &&
        minute >= APPLE_NEWS_POST_MINUTE_PARIS &&
        minute < APPLE_NEWS_POST_MINUTE_PARIS + APPLE_NEWS_POST_WINDOW_MINUTES
      ) {
        const poster = clientPoster(client, APPLE_NEWS_CHANNEL_ID);
        const result = await runAppleNewsOnce(poster, guildId, APPLE_NEWS_CHANNEL_ID);
        if (result.posted) console.log('🍎 Apple News quotidien posté (cron)');
      }
    } catch (err) {
      console.error('Apple News scheduler error:', err);
    }
  };

  setInterval(tick, 60 * 1000);
  console.log(`⏰ Apple News scheduler démarré (post à ${APPLE_NEWS_POST_HOUR_PARIS}h00 Paris)`);
}
