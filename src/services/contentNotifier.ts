import mongoose from 'mongoose';
import { createSign } from 'crypto';
import {
  Client,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { NotificationConfig } from '../database/models/NotificationConfig';
import type { INotificationConfig } from '../database/models/NotificationConfig';

// Le site partage le cluster Atlas du bot, dans sa propre base
const PORTFOLIO_DB_NAME = 'portfolio';
const SITE_BASE_URL = 'https://carolanelefebvre.com';
const KEEPIO_APP_STORE_ID = '6746096493';
// Seule la piste production est annoncée : les tests fermés ne sont pas installables par les membres
const KEEPIO_ANDROID_TRACK = 'production';

export interface PortfolioArticle {
  slug: string;
  title: string;
  description: string;
  cover?: string;
  tags?: string[];
  announcedAt: Date;
}

export type KeepioPlatform = 'ios' | 'android';

export interface KeepioRelease {
  platform: KeepioPlatform;
  version: string; // Version affichée (ex. 4.2.0)
  versionKey: string; // Identifiant comparé d'une vérification à l'autre
  releaseNotes?: string;
  storeUrl: string;
  artworkUrl?: string;
  releasedAt?: Date;
}

interface ITunesLookupResult {
  version: string;
  releaseNotes?: string;
  trackViewUrl: string;
  artworkUrl512?: string;
  currentVersionReleaseDate?: string;
}

interface PlayTrackRelease {
  name?: string;
  versionCodes?: string[];
  status: 'completed' | 'inProgress' | 'halted' | 'draft';
  releaseNotes?: { language: string; text: string }[];
}

interface GoogleServiceAccount {
  client_email: string;
  private_key: string;
}

function articlesCollection() {
  return mongoose.connection
    .useDb(PORTFOLIO_DB_NAME, { useCache: true })
    .collection<PortfolioArticle>('articles');
}

/**
 * Articles annoncés par le site après `since`.
 * Le site ne pose `announcedAt` qu'au premier passage brouillon -> publié :
 * les sauvegardes de brouillon, mises à jour et republications ne le modifient pas.
 */
export async function fetchArticlesAnnouncedAfter(since: Date): Promise<PortfolioArticle[]> {
  return articlesCollection()
    .find(
      { draft: false, announcedAt: { $gt: since } },
      { projection: { slug: 1, title: 1, description: 1, cover: 1, tags: 1, announcedAt: 1 } }
    )
    .sort({ announcedAt: 1 })
    .toArray();
}

export async function fetchLatestArticle(): Promise<PortfolioArticle | null> {
  return articlesCollection().findOne(
    { draft: false, announcedAt: { $exists: true } },
    { sort: { announcedAt: -1 } }
  );
}

/**
 * Version actuelle de Keepio sur l'App Store (API publique iTunes Lookup)
 */
export async function fetchKeepioIosRelease(): Promise<KeepioRelease | null> {
  try {
    const response = await fetch(
      `https://itunes.apple.com/lookup?id=${KEEPIO_APP_STORE_ID}&country=fr`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!response.ok) {
      console.error('iTunes lookup error:', response.status);
      return null;
    }

    const data = (await response.json()) as { resultCount: number; results: ITunesLookupResult[] };
    const app = data.results[0];
    if (!app) return null;

    return {
      platform: 'ios',
      version: app.version,
      versionKey: app.version,
      releaseNotes: app.releaseNotes,
      storeUrl: app.trackViewUrl,
      artworkUrl: app.artworkUrl512,
      releasedAt: app.currentVersionReleaseDate ? new Date(app.currentVersionReleaseDate) : undefined,
    };
  } catch (error) {
    console.error('Error fetching Keepio iOS release:', error);
    return null;
  }
}

/**
 * Le suivi Android nécessite un compte de service ayant accès à la Play Console
 */
export function isKeepioAndroidConfigured(): boolean {
  return Boolean(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_FILE && process.env.KEEPIO_ANDROID_PACKAGE);
}

let googleAccessToken: string | null = null;
let googleTokenExpiresAt: number = 0;

/**
 * Get Google access token for the Android Publisher API (service account JWT flow)
 */
async function getGoogleToken(): Promise<string | null> {
  if (googleAccessToken && Date.now() < googleTokenExpiresAt) {
    return googleAccessToken;
  }

  try {
    const account = (await Bun.file(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_FILE!).json()) as GoogleServiceAccount;
    const now = Math.floor(Date.now() / 1000);
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

    const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
      iss: account.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })}`;
    const signature = createSign('RSA-SHA256').update(unsigned).sign(account.private_key, 'base64url');

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: `${unsigned}.${signature}`,
      }),
    });

    if (!response.ok) {
      console.error('Failed to get Google token:', response.status, await response.text());
      return null;
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    googleAccessToken = data.access_token;
    googleTokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000; // Refresh 1 min early

    return googleAccessToken;
  } catch (error) {
    console.error('Error getting Google token:', error);
    return null;
  }
}

/**
 * Dernière version de Keepio publiée sur Google Play (piste production).
 * Renvoie 'none' si aucune version n'est encore publique, null en cas d'erreur.
 */
export async function fetchKeepioAndroidRelease(): Promise<KeepioRelease | 'none' | null> {
  const packageName = process.env.KEEPIO_ANDROID_PACKAGE;
  const token = await getGoogleToken();
  if (!token || !packageName) return null;

  const api = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/edits`;
  const headers = { Authorization: `Bearer ${token}` };
  let editId: string | null = null;

  try {
    // L'API ne lit les pistes qu'au travers d'une "edit", supprimée juste après
    const editResponse = await fetch(api, { method: 'POST', headers, signal: AbortSignal.timeout(10000) });
    if (!editResponse.ok) {
      console.error('Google Play edit error:', editResponse.status, await editResponse.text());
      return null;
    }
    editId = ((await editResponse.json()) as { id: string }).id;

    const trackResponse = await fetch(`${api}/${editId}/tracks/${KEEPIO_ANDROID_TRACK}`, {
      headers,
      signal: AbortSignal.timeout(10000),
    });
    if (trackResponse.status === 404) return 'none';
    if (!trackResponse.ok) {
      console.error('Google Play track error:', trackResponse.status, await trackResponse.text());
      return null;
    }

    const track = (await trackResponse.json()) as { releases?: PlayTrackRelease[] };
    const release = track.releases?.find((r) => r.status === 'completed');
    if (!release?.versionCodes?.length) return 'none';

    const versionCode = String(Math.max(...release.versionCodes.map(Number)));
    // Les noms de release Play ressemblent souvent à "42 (4.2.0)"
    const version = release.name?.match(/\((.+)\)\s*$/)?.[1] ?? release.name ?? versionCode;
    const notes =
      release.releaseNotes?.find((n) => n.language.startsWith('fr')) ??
      release.releaseNotes?.find((n) => n.language.startsWith('en')) ??
      release.releaseNotes?.[0];

    return {
      platform: 'android',
      version,
      versionKey: versionCode,
      releaseNotes: notes?.text,
      storeUrl: `https://play.google.com/store/apps/details?id=${packageName}`,
      // Même icône que sur iOS
      artworkUrl: (await fetchKeepioIosRelease())?.artworkUrl,
      releasedAt: new Date(),
    };
  } catch (error) {
    console.error('Error fetching Keepio Android release:', error);
    return null;
  } finally {
    if (editId) {
      await fetch(`${api}/${editId}`, { method: 'DELETE', headers }).catch(() => {});
    }
  }
}

function absoluteUrl(path: string): string {
  return path.startsWith('http') ? path : `${SITE_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function buildArticleMessage(article: PortfolioArticle) {
  const url = `${SITE_BASE_URL}/articles/${article.slug}`;

  const embed = new EmbedBuilder()
    .setColor('#2ECC71')
    .setAuthor({ name: '📰 Nouvel article' })
    .setTitle(truncate(article.title, 256))
    .setURL(url)
    .setDescription(truncate(article.description, 4096))
    .setTimestamp(article.announcedAt);

  if (article.cover) {
    embed.setImage(absoluteUrl(article.cover));
  }

  if (article.tags && article.tags.length > 0) {
    embed.addFields({ name: 'Tags', value: article.tags.slice(0, 10).join(' • '), inline: false });
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setLabel('Lire l\'article').setStyle(ButtonStyle.Link).setURL(url)
  );

  return { embeds: [embed], components: [row] };
}

const PLATFORM_DISPLAY: Record<KeepioPlatform, { name: string; store: string; color: `#${string}` }> = {
  ios: { name: 'iOS', store: 'l\'App Store', color: '#1ABC9C' },
  android: { name: 'Android', store: 'Google Play', color: '#27AE60' },
};

export function buildKeepioMessage(release: KeepioRelease) {
  const platform = PLATFORM_DISPLAY[release.platform];

  const embed = new EmbedBuilder()
    .setColor(platform.color)
    .setAuthor({ name: `🚀 Nouvelle version disponible sur ${platform.name}` })
    .setTitle(`Keepio ${release.version}`)
    .setURL(release.storeUrl)
    .setDescription(
      release.releaseNotes
        ? truncate(`**Nouveautés**\n${release.releaseNotes}`, 4096)
        : `Une nouvelle version est disponible sur ${platform.store} !`
    )
    .setTimestamp(release.releasedAt ?? new Date());

  if (release.artworkUrl) {
    embed.setThumbnail(release.artworkUrl);
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setLabel(`Voir sur ${platform.store}`).setStyle(ButtonStyle.Link).setURL(release.storeUrl)
  );

  return { embeds: [embed], components: [row] };
}

/**
 * Annonce de lancement des notifications articles / Keepio.
 * <id:customize> est le lien natif Discord vers la page "Channels & Roles".
 */
export function buildFeatureAnnouncement(newsRoleId?: string, keepioIosRoleId?: string, keepioAndroidRoleId?: string) {
  const role = (id: string | undefined, fallback: string) => (id ? `<@&${id}>` : fallback);

  const embed = new EmbedBuilder()
    .setColor('#2ECC71')
    .setTitle('🔔 Nouveau : les notifications Articles & Keepio')
    .setDescription(
      'Deux nouvelles notifications arrivent sur le serveur !\n\n' +
      '📰 **Nouveaux articles**\n' +
      'Dès que je publie un nouvel article sur mon site (Swift, SwiftUI, iOS…), il est annoncé ici avec un lien direct pour le lire.\n\n' +
      '🚀 **Mises à jour de Keepio**\n' +
      'À chaque nouvelle version de Keepio sur l\'App Store ou Google Play, vous recevez les nouveautés et le lien pour la télécharger.\n\n' +
      '**Comment les recevoir ?**\n' +
      'Rendez-vous dans <id:customize> et choisissez :\n' +
      `• ${role(newsRoleId, '🍎・Curious')} pour être notifié des nouveaux articles\n` +
      `• ${role(keepioIosRoleId, 'Keepio iOS')} pour les mises à jour de Keepio sur iPhone et iPad\n` +
      `• ${role(keepioAndroidRoleId, 'Keepio Android')} pour la sortie et les mises à jour de Keepio sur Android`
    )
    .setTimestamp();

  return { content: '@here', embeds: [embed] };
}

/**
 * Pose les points de départ (dernier article, versions Keepio) s'ils manquent :
 * seules les publications postérieures seront annoncées. Renvoie les avertissements.
 */
export async function primeNotificationCursors(config: INotificationConfig): Promise<string[]> {
  const warnings: string[] = [];

  if (!config.lastArticleAnnouncedAt) {
    const latest = await fetchLatestArticle();
    config.lastArticleAnnouncedAt = latest?.announcedAt ?? new Date();
  }

  if (!config.lastKeepioIosVersion) {
    const release = await fetchKeepioIosRelease();
    if (!release) throw new Error('Impossible de récupérer la version actuelle de Keepio sur l\'App Store');
    config.lastKeepioIosVersion = release.versionKey;
  }

  if (!isKeepioAndroidConfigured()) {
    warnings.push('⚠️ Suivi Android inactif : configurez `GOOGLE_PLAY_SERVICE_ACCOUNT_FILE` et `KEEPIO_ANDROID_PACKAGE`.');
  } else if (!config.lastKeepioAndroidVersion) {
    const release = await fetchKeepioAndroidRelease();
    if (release) config.lastKeepioAndroidVersion = release === 'none' ? 'none' : release.versionKey;
    else warnings.push('⚠️ Impossible de joindre Google Play : réactivez les notifications pour lancer le suivi Android.');
  }

  return warnings;
}

/**
 * Envoie une notification dans le salon des annonces, avec @here + le rôle donné
 */
async function sendToAnnouncements(
  client: Client,
  config: INotificationConfig,
  roleId: string | undefined,
  message: ReturnType<typeof buildArticleMessage>
): Promise<void> {
  if (!config.channelId) return;

  const channel = await client.channels.fetch(config.channelId).catch(() => null);
  if (!channel || !channel.isSendable()) {
    console.warn(`⚠️  Announcement channel ${config.channelId} unavailable for guild ${config.guildId}`);
    return;
  }

  const mentions = ['@here', roleId ? `<@&${roleId}>` : ''].filter(Boolean).join(' ');

  await channel.send({
    content: mentions,
    ...message,
    allowedMentions: { parse: ['everyone'], roles: roleId ? [roleId] : [] },
  });
}

async function checkArticles(client: Client, configs: INotificationConfig[]): Promise<void> {
  for (const config of configs) {
    // Le curseur est initialisé par /notif-setup : sans lui, on ne rattrape pas l'historique
    if (!config.lastArticleAnnouncedAt) continue;

    const articles = await fetchArticlesAnnouncedAfter(config.lastArticleAnnouncedAt);

    for (const article of articles) {
      try {
        await sendToAnnouncements(client, config, config.newsRoleId, buildArticleMessage(article));
        console.log(`📰 Sent new article notification: ${article.slug} (guild ${config.guildId})`);
      } catch (error) {
        console.error(`Error sending article notification ${article.slug}:`, error);
      }
      // On avance même en cas d'échec pour ne pas renvoyer en boucle
      config.lastArticleAnnouncedAt = article.announcedAt;
    }

    if (articles.length > 0) await config.save();
  }
}

async function checkKeepio(client: Client, configs: INotificationConfig[]): Promise<void> {
  const ios = configs.some((c) => c.lastKeepioIosVersion) ? await fetchKeepioIosRelease() : null;
  const android =
    isKeepioAndroidConfigured() && configs.some((c) => c.lastKeepioAndroidVersion)
      ? await fetchKeepioAndroidRelease()
      : null;

  for (const config of configs) {
    const platforms = [
      { release: ios, roleId: config.keepioIosRoleId, field: 'lastKeepioIosVersion' as const },
      { release: android, roleId: config.keepioAndroidRoleId, field: 'lastKeepioAndroidVersion' as const },
    ];

    for (const { release, roleId, field } of platforms) {
      // Pas de point de départ, erreur de récupération, ou rien de public sur cette plateforme
      if (!config[field] || !release || release === 'none') continue;
      if (config[field] === release.versionKey) continue;

      try {
        await sendToAnnouncements(client, config, roleId, buildKeepioMessage(release));
        console.log(`🚀 Sent Keepio ${release.platform} ${release.version} notification (guild ${config.guildId})`);
      } catch (error) {
        console.error(`Error sending Keepio ${release.platform} notification:`, error);
      }

      config[field] = release.versionKey;
      await config.save();
    }
  }
}

let articlesRunning = false;
let keepioRunning = false;

async function runArticles(client: Client) {
  if (articlesRunning) return;
  articlesRunning = true;
  try {
    const configs = await NotificationConfig.find({ enabled: true, channelId: { $exists: true } });
    await checkArticles(client, configs);
  } catch (error) {
    console.error('Error checking new articles:', error);
  } finally {
    articlesRunning = false;
  }
}

async function runKeepio(client: Client) {
  if (keepioRunning) return;
  keepioRunning = true;
  try {
    const configs = await NotificationConfig.find({ enabled: true, channelId: { $exists: true } });
    await checkKeepio(client, configs);
  } catch (error) {
    console.error('Error checking Keepio versions:', error);
  } finally {
    keepioRunning = false;
  }
}

/**
 * Démarre la surveillance des nouveaux articles et des versions de Keepio
 */
export function startContentNotifier(
  client: Client,
  articlesIntervalMs: number = 60 * 1000,
  keepioIntervalMs: number = 10 * 60 * 1000
): void {
  console.log(
    `📰 Content notifier started (articles every ${articlesIntervalMs / 1000}s, Keepio every ${keepioIntervalMs / 1000}s)`
  );
  if (!isKeepioAndroidConfigured()) {
    console.log('⚠️  Google Play API not configured - Keepio Android notifications disabled');
  }

  setTimeout(() => {
    runArticles(client);
    runKeepio(client);
  }, 5000);

  setInterval(() => runArticles(client), articlesIntervalMs);
  setInterval(() => runKeepio(client), keepioIntervalMs);
}
