/**
 * Service Tech Watch.
 *
 * Sources (toutes gratuites, sans clé API) :
 *  - Ars Technica (RSS)          — tech + hardware + sécurité + science, deep coverage
 *  - TechCrunch AI feed (RSS)    — news IA / industrie tech
 *  - Lobsters hottest (JSON)     — discussions dev curatées (meilleure qualité que HN)
 *  - GitHub trending (HTML scrape) — repos qui buzzent du jour
 *
 * Pipeline :
 *  - Récupère les 4 sources en parallèle (try/catch indépendants : si une source HS,
 *    on poste avec les autres).
 *  - Dédup sur 7 jours glissants pour éviter de reposter le même item.
 *  - Construit un embed multi-sections, l'envoie, ajoute des auto-réactions.
 *  - Persiste le run en Mongo.
 */
import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { TechWatchRun } from '../database/models/TechWatchRun';
import { TECHWATCH_CHANNEL_ID, getParisNow } from '../config/techwatch';

// ─── Types ───
interface ArsArticle {
  title: string;
  url: string;
  pubDate?: string;
  description?: string;
}

interface TCArticle {
  title: string;
  url: string;
  pubDate?: string;
}

interface LobsterPost {
  shortId: string;
  title: string;
  url: string;
  commentsUrl: string;
  score: number;
  commentCount: number;
  tags: string[];
}

interface GithubRepo {
  fullName: string;
  url: string;
  description: string;
  language: string;
  starsToday: number;
}

// ─── Sources ───

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseRssItems(xml: string): { title: string; link: string; pubDate?: string; description?: string }[] {
  const items: { title: string; link: string; pubDate?: string; description?: string }[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    const titleMatch =
      item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ?? item.match(/<title>([\s\S]*?)<\/title>/);
    const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/);
    const dateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const descMatch =
      item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ??
      item.match(/<description>([\s\S]*?)<\/description>/);

    if (titleMatch && linkMatch) {
      items.push({
        title: stripHtml(titleMatch[1]),
        link: linkMatch[1].trim(),
        pubDate: dateMatch?.[1]?.trim(),
        description: descMatch ? stripHtml(descMatch[1]).slice(0, 300) : undefined,
      });
    }
  }
  return items;
}

async function fetchArsTechnica(): Promise<ArsArticle[]> {
  const res = await fetch('https://feeds.arstechnica.com/arstechnica/index/', {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KeepOS-Bot/1.0)' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Ars Technica RSS ${res.status}`);
  const xml = await res.text();
  return parseRssItems(xml).map(i => ({
    title: i.title,
    url: i.link,
    pubDate: i.pubDate,
    description: i.description,
  }));
}

async function fetchTechCrunch(): Promise<TCArticle[]> {
  const res = await fetch('https://techcrunch.com/category/artificial-intelligence/feed/', {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KeepOS-Bot/1.0)' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`TechCrunch RSS ${res.status}`);
  const xml = await res.text();
  return parseRssItems(xml).map(i => ({ title: i.title, url: i.link, pubDate: i.pubDate }));
}

async function fetchLobsters(): Promise<LobsterPost[]> {
  const res = await fetch('https://lobste.rs/hottest.json', {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KeepOS-Bot/1.0)' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Lobsters ${res.status}`);
  const data = (await res.json()) as any[];
  return data.map(p => ({
    shortId: p.short_id as string,
    title: (p.title as string).replace(/\s+/g, ' ').trim(),
    url: (p.url ?? p.short_id_url) as string,
    commentsUrl: p.comments_url as string,
    score: (p.score ?? 0) as number,
    commentCount: (p.comment_count ?? 0) as number,
    tags: (p.tags ?? []) as string[],
  }));
}

async function fetchGitHubTrending(): Promise<GithubRepo[]> {
  const res = await fetch('https://github.com/trending?since=daily', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; KeepOS-Bot/1.0)',
      Accept: 'text/html',
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`GitHub trending ${res.status}`);
  const html = await res.text();

  const articles = html.split('<article class="Box-row">').slice(1);
  const repos: GithubRepo[] = [];

  for (const block of articles) {
    const hrefMatch = block.match(/href="\/([\w.-]+)\/([\w.-]+?)"/);
    if (!hrefMatch) continue;
    const fullName = `${hrefMatch[1]}/${hrefMatch[2]}`;

    const descMatch = block.match(/<p class="col-9[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/p>/);
    const description = descMatch ? descMatch[1].replace(/\s+/g, ' ').trim() : '';

    const langMatch = block.match(/<span itemprop="programmingLanguage">([^<]+)<\/span>/);
    const language = langMatch ? langMatch[1].trim() : '';

    const starsMatch = block.match(/([\d,]+)\s*stars today/);
    const starsToday = starsMatch ? parseInt(starsMatch[1].replace(/,/g, ''), 10) : 0;

    repos.push({
      fullName,
      url: `https://github.com/${fullName}`,
      description,
      language,
      starsToday,
    });
  }

  return repos;
}

// ─── Dédup sur 7 jours glissants ───
async function getRecentlyPosted(guildId: string) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const runs = await TechWatchRun.find({ guildId, createdAt: { $gte: sevenDaysAgo } });

  const arsUrls = new Set<string>();
  const tcUrls = new Set<string>();
  const lobsterIds = new Set<string>();
  const githubRepos = new Set<string>();
  for (const r of runs) {
    r.arsUrls.forEach(u => arsUrls.add(u));
    r.tcUrls.forEach(u => tcUrls.add(u));
    r.lobsterIds.forEach(id => lobsterIds.add(id));
    r.githubRepos.forEach(name => githubRepos.add(name));
  }
  return { arsUrls, tcUrls, lobsterIds, githubRepos };
}

// ─── Emojis par langage GitHub + par tag Lobsters ───
const LANG_EMOJI: Record<string, string> = {
  TypeScript: '🟦',
  JavaScript: '🟨',
  Python: '🐍',
  Swift: '🐦',
  Rust: '🦀',
  Go: '🐹',
  Kotlin: '🟣',
  Java: '☕',
  'C++': '⚙️',
  C: '⚙️',
  Ruby: '💎',
  PHP: '🐘',
  HTML: '🌐',
  CSS: '🎨',
  Shell: '🐚',
  Dart: '🎯',
  Zig: '⚡',
};

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

// ─── Embed ───
function buildEmbed(ars: ArsArticle[], tc: TCArticle[], lob: LobsterPost[], repos: GithubRepo[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor('#ff6600')
    .setTitle(`📰 Tech Watch — ${formatDateFR()}`)
    .setDescription(
      'Sélection du jour : tech & hardware, breaking news IA, dev curaté, projets qui buzzent.'
    );

  if (ars.length > 0) {
    const value = ars
      .map(a => {
        const desc = a.description ? `\n↳ *${truncate(a.description, 180)}*` : '';
        return `• [${truncate(a.title, 180)}](${a.url})${desc}`;
      })
      .join('\n\n');
    embed.addFields({ name: '🔧 Tech & hardware — Ars Technica', value: truncate(value, 1024), inline: false });
  }

  if (tc.length > 0) {
    const value = tc
      .map(a => `• [${truncate(a.title, 180)}](${a.url})`)
      .join('\n');
    embed.addFields({ name: '🌐 IA & industrie — TechCrunch', value: truncate(value, 1024), inline: false });
  }

  if (lob.length > 0) {
    const value = lob
      .map(p => {
        const tagStr = p.tags.length > 0 ? p.tags.slice(0, 2).map(t => `\`${t}\``).join(' ') + ' · ' : '';
        return `• ${tagStr}[${truncate(p.title, 140)}](${p.url}) · \`${p.score} pts\` · \`${p.commentCount} 💬\``;
      })
      .join('\n');
    embed.addFields({ name: '💻 Dev — discussions (Lobsters)', value: truncate(value, 1024), inline: false });
  }

  if (repos.length > 0) {
    const value = repos
      .map(r => {
        const emoji = LANG_EMOJI[r.language] ?? '📦';
        const lang = r.language ? `\`${r.language}\` · ` : '';
        return `${emoji} **[${r.fullName}](${r.url})** · ${lang}\`${r.starsToday.toLocaleString('fr-FR')} ⭐ aujourd'hui\``;
      })
      .join('\n');
    embed.addFields({ name: '⭐ GitHub trending — repos du jour', value: truncate(value, 1024), inline: false });
  }

  embed.setFooter({ text: 'Réagis avec 🔥 / 👀 / 🤯 pour partager ton avis' }).setTimestamp();
  return embed;
}

// ─── Pipeline ───

export type Poster = (embed: EmbedBuilder, reactions: string[]) => Promise<{ messageId: string }>;

export async function runTechWatchOnce(
  poster: Poster,
  guildId: string,
  channelId: string,
  options: { force?: boolean } = {}
): Promise<{ posted: boolean; reason?: string; messageId?: string }> {
  const { date: parisDate } = getParisNow();

  if (!options.force) {
    const existing = await TechWatchRun.findOne({ guildId, parisDate });
    if (existing) {
      return { posted: false, reason: `Déjà posté aujourd'hui (${parisDate})`, messageId: existing.messageId };
    }
  }

  const seen = await getRecentlyPosted(guildId);

  // Toutes les sources en parallèle, isolation des erreurs
  const [arsRes, tcRes, lobRes, ghRes] = await Promise.allSettled([
    fetchArsTechnica(),
    fetchTechCrunch(),
    fetchLobsters(),
    fetchGitHubTrending(),
  ]);

  const ars =
    arsRes.status === 'fulfilled'
      ? arsRes.value.filter(a => !seen.arsUrls.has(a.url)).slice(0, 3)
      : [];
  const tc =
    tcRes.status === 'fulfilled'
      ? tcRes.value.filter(a => !seen.tcUrls.has(a.url)).slice(0, 2)
      : [];
  const lob =
    lobRes.status === 'fulfilled'
      ? lobRes.value.filter(p => !seen.lobsterIds.has(p.shortId)).slice(0, 2)
      : [];
  const repos =
    ghRes.status === 'fulfilled'
      ? ghRes.value.filter(r => !seen.githubRepos.has(r.fullName)).slice(0, 3)
      : [];

  if (arsRes.status === 'rejected') console.warn('⚠️ Ars Technica:', arsRes.reason);
  if (tcRes.status === 'rejected') console.warn('⚠️ TechCrunch:', tcRes.reason);
  if (lobRes.status === 'rejected') console.warn('⚠️ Lobsters:', lobRes.reason);
  if (ghRes.status === 'rejected') console.warn('⚠️ GitHub:', ghRes.reason);

  if (ars.length === 0 && tc.length === 0 && lob.length === 0 && repos.length === 0) {
    return { posted: false, reason: 'Toutes les sources sont HS' };
  }

  const embed = buildEmbed(ars, tc, lob, repos);
  const { messageId } = await poster(embed, ['🔥', '👀', '🤯']);

  await TechWatchRun.findOneAndUpdate(
    { guildId, parisDate },
    {
      $set: {
        channelId,
        messageId,
        arsUrls: ars.map(a => a.url),
        tcUrls: tc.map(a => a.url),
        lobsterIds: lob.map(p => p.shortId),
        githubRepos: repos.map(r => r.fullName),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true, new: true }
  );

  console.log(
    `✅ Tech Watch posté (${parisDate}) : ${ars.length} Ars · ${tc.length} TC · ${lob.length} lob · ${repos.length} GH · msg ${messageId}`
  );
  return { posted: true, messageId };
}

// ─── Poster côté Client ───
export function clientPoster(client: Client, channelId: string): Poster {
  return async (embed, reactions) => {
    const channel = (await client.channels.fetch(channelId).catch(() => null)) as TextChannel | null;
    if (!channel || !channel.isTextBased()) {
      throw new Error(`Channel ${channelId} introuvable`);
    }
    const message = await channel.send({ embeds: [embed] });
    for (const emoji of reactions) {
      try {
        await message.react(emoji);
      } catch {
        /* ignore */
      }
    }
    return { messageId: message.id };
  };
}

// ─── Scheduler ───
let schedulerStarted = false;

export function startTechWatchScheduler(client: Client, guildId: string) {
  if (schedulerStarted) return;
  schedulerStarted = true;

  const tick = async () => {
    try {
      const { hour, minute } = getParisNow();
      if (hour === 9 && minute >= 0 && minute < 5) {
        const poster = clientPoster(client, TECHWATCH_CHANNEL_ID);
        const result = await runTechWatchOnce(poster, guildId, TECHWATCH_CHANNEL_ID);
        if (result.posted) {
          console.log(`📰 Tech Watch quotidien posté (cron)`);
        }
      }
    } catch (err) {
      console.error('Tech Watch scheduler error:', err);
    }
  };

  setInterval(tick, 60 * 1000);
  console.log('⏰ Tech Watch scheduler démarré (vérification toutes les 60s, post à 9h00 Paris)');
}
