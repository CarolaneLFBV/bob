/**
 * Vérifie / active les notifications Articles & Keepio sans passer par Discord
 * (équivalent de /notif-setup). Ouvre sa propre connexion : aucun impact sur le bot PM2.
 *
 * Usage :
 *   bun src/scripts/notif-setup-now.ts check [--channel=<id>]   Diagnostic complet, ne modifie rien
 *   bun src/scripts/notif-setup-now.ts enable --channel=<id>    Active les notifications dans ce salon
 *   bun src/scripts/notif-setup-now.ts announce --yes           Poste l'annonce de lancement (@here)
 */
import { Client, GatewayIntentBits, PermissionFlagsBits } from 'discord.js';
import type { GuildBasedChannel } from 'discord.js';
import mongoose from 'mongoose';
import { NotificationConfig } from '../database/models/NotificationConfig';
import {
  fetchLatestArticle,
  fetchKeepioIosRelease,
  fetchKeepioAndroidRelease,
  isKeepioAndroidConfigured,
  primeNotificationCursors,
  buildFeatureAnnouncement,
} from '../services/contentNotifier';
import { APPLE_NEWS_CURIOUS_ROLE_ID } from '../config/appleNews';
import { KEEPIO_IOS_ROLE_ID, KEEPIO_ANDROID_ROLE_ID } from '../config/notifications';

const GUILD_ID = '1390017627715403776';

const ROLES = [
  { label: 'Articles (🍎・Curious)', id: APPLE_NEWS_CURIOUS_ROLE_ID },
  { label: 'Keepio iOS', id: KEEPIO_IOS_ROLE_ID },
  { label: 'Keepio Android', id: KEEPIO_ANDROID_ROLE_ID },
];

const REQUIRED_PERMISSIONS = [
  { label: 'Voir le salon', flag: PermissionFlagsBits.ViewChannel },
  { label: 'Envoyer des messages', flag: PermissionFlagsBits.SendMessages },
  { label: 'Intégrer des liens', flag: PermissionFlagsBits.EmbedLinks },
  { label: 'Mentionner @everyone, @here et tous les rôles', flag: PermissionFlagsBits.MentionEveryone },
];

let failures = 0;
const ok = (msg: string) => console.log(`  ✅ ${msg}`);
const warn = (msg: string) => console.log(`  ⚠️  ${msg}`);
const fail = (msg: string) => { failures++; console.log(`  ❌ ${msg}`); };

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
}

function checkChannel(channel: GuildBasedChannel | null, client: Client<true>) {
  if (!channel) return fail('Salon introuvable');
  ok(`Salon #${channel.name} (${channel.id})`);

  const permissions = channel.permissionsFor(client.user);
  for (const { label, flag } of REQUIRED_PERMISSIONS) {
    if (permissions?.has(flag)) ok(label);
    else fail(`Permission manquante : ${label}`);
  }
}

async function check(client: Client<true>) {
  const guild = await client.guilds.fetch(GUILD_ID);

  console.log('\n🗄️  MongoDB (base portfolio)');
  try {
    const latest = await fetchLatestArticle();
    if (latest) ok(`Lecture OK · dernier article annoncé : ${latest.slug} (${latest.announcedAt.toISOString()})`);
    else warn('Lecture OK mais aucun article annoncé trouvé');
  } catch (error) {
    fail(`Lecture impossible : ${(error as Error).message}`);
    console.log('     → l\'utilisateur MongoDB du bot doit avoir le rôle "read" sur la base "portfolio"');
  }

  console.log('\n🍎 Keepio iOS (App Store)');
  const ios = await fetchKeepioIosRelease();
  if (ios) ok(`Version actuelle : ${ios.version}`);
  else fail('API iTunes injoignable');

  console.log('\n🤖 Keepio Android (Google Play)');
  if (!isKeepioAndroidConfigured()) {
    warn('Non configuré (GOOGLE_PLAY_SERVICE_ACCOUNT_FILE / KEEPIO_ANDROID_PACKAGE) : suivi Android inactif');
  } else {
    const android = await fetchKeepioAndroidRelease();
    if (android === 'none') ok('API OK · pas encore de version en production');
    else if (android) ok(`API OK · version en production : ${android.version} (versionCode ${android.versionKey})`);
    else fail('API Google Play inaccessible (voir les logs ci-dessus)');
  }

  console.log('\n🎭 Rôles');
  const roles = await guild.roles.fetch();
  for (const { label, id } of ROLES) {
    const role = roles.get(id);
    if (role) ok(`${label} → @${role.name}${role.mentionable ? '' : ' (non mentionnable : nécessite la permission de mentionner tous les rôles)'}`);
    else fail(`${label} → rôle ${id} introuvable`);
  }

  const config = await NotificationConfig.findOne({ guildId: GUILD_ID });
  const channelId = arg('channel') ?? config?.channelId;

  console.log('\n📢 Salon des annonces');
  if (channelId) {
    checkChannel(await guild.channels.fetch(channelId).catch(() => null), client);
  } else {
    warn('Aucun salon configuré. Candidats :');
    const channels = await guild.channels.fetch();
    for (const channel of channels.values()) {
      if (channel?.isSendable() && channel.name.toLowerCase().includes('annonce')) {
        console.log(`     - #${channel.name} (${channel.id})`);
      }
    }
  }

  console.log('\n⚙️  Configuration actuelle');
  if (!config) {
    warn('Notifications pas encore activées');
  } else {
    console.log(`     enabled=${config.enabled} channel=${config.channelId ?? '—'}`);
    console.log(`     lastArticleAnnouncedAt=${config.lastArticleAnnouncedAt?.toISOString() ?? '—'}`);
    console.log(`     lastKeepioIosVersion=${config.lastKeepioIosVersion ?? '—'} lastKeepioAndroidVersion=${config.lastKeepioAndroidVersion ?? '—'}`);
  }
}

async function enable(client: Client<true>) {
  const channelId = arg('channel');
  if (!channelId) throw new Error('--channel=<id> requis');

  const guild = await client.guilds.fetch(GUILD_ID);
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isSendable()) throw new Error(`Salon ${channelId} introuvable ou non textuel`);

  const roles = await guild.roles.fetch();
  const config =
    (await NotificationConfig.findOne({ guildId: GUILD_ID })) ?? new NotificationConfig({ guildId: GUILD_ID });

  config.enabled = true;
  config.channelId = channel.id;
  config.newsRoleId = roles.get(config.newsRoleId ?? APPLE_NEWS_CURIOUS_ROLE_ID)?.id;
  config.keepioIosRoleId = roles.get(config.keepioIosRoleId ?? KEEPIO_IOS_ROLE_ID)?.id;
  config.keepioAndroidRoleId = roles.get(config.keepioAndroidRoleId ?? KEEPIO_ANDROID_ROLE_ID)?.id;

  const warnings = await primeNotificationCursors(config);
  await config.save();

  console.log(`\n✅ Notifications activées dans #${channel.name}`);
  console.log(`   Rôles : articles=${config.newsRoleId ?? '❌'} iOS=${config.keepioIosRoleId ?? '❌'} Android=${config.keepioAndroidRoleId ?? '❌'}`);
  console.log(`   Points de départ : article=${config.lastArticleAnnouncedAt?.toISOString()} iOS=${config.lastKeepioIosVersion} Android=${config.lastKeepioAndroidVersion ?? '—'}`);
  for (const w of warnings) console.log(`   ${w}`);
}

async function announce(client: Client<true>) {
  if (!process.argv.includes('--yes')) throw new Error('Ajoutez --yes pour confirmer (poste un message avec @here)');

  const config = await NotificationConfig.findOne({ guildId: GUILD_ID });
  if (!config?.enabled || !config.channelId) throw new Error('Notifications non activées : lancez d\'abord "enable"');

  const channel = await client.channels.fetch(config.channelId);
  if (!channel?.isSendable()) throw new Error(`Salon ${config.channelId} introuvable`);

  const message = await channel.send({
    ...buildFeatureAnnouncement(
      config.newsRoleId ?? APPLE_NEWS_CURIOUS_ROLE_ID,
      config.keepioIosRoleId ?? KEEPIO_IOS_ROLE_ID,
      config.keepioAndroidRoleId ?? KEEPIO_ANDROID_ROLE_ID
    ),
    allowedMentions: { parse: ['everyone'] },
  });
  console.log(`\n✅ Annonce postée · message ${message.id}`);
}

async function main() {
  if (!process.env.DISCORD_TOKEN || !process.env.MONGODB_URI) {
    throw new Error('❌ DISCORD_TOKEN ou MONGODB_URI manquant');
  }

  const action = process.argv[2];
  const actions = { check, enable, announce } as const;
  if (!action || !(action in actions)) {
    throw new Error('Action attendue : check | enable | announce');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  const ready = new Promise<void>((resolve) => client.once('ready', () => resolve()));
  await client.login(process.env.DISCORD_TOKEN);
  await ready;

  try {
    await actions[action as keyof typeof actions](client as Client<true>);
  } finally {
    await client.destroy();
    await mongoose.disconnect();
  }

  if (failures > 0) {
    console.log(`\n❌ ${failures} problème(s) à corriger`);
    process.exit(1);
  }
}

main().catch((err) => { console.error('❌ Échec :', err.message ?? err); process.exit(1); });
