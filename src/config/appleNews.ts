/**
 * Configuration du système Apple News (digest quotidien, sources Apple uniquement).
 * Distinct de Tech Watch (veille tech générale).
 */

// Salon dédié #apple-news
export const APPLE_NEWS_CHANNEL_ID = '1525876921748029612';

// Rôle pingé à chaque digest (les curieux·ses)
export const APPLE_NEWS_CURIOUS_ROLE_ID = '1525878356426489927';

// Heure de post quotidien, heure de Paris (briefing du matin)
export const APPLE_NEWS_POST_HOUR_PARIS = 9;
export const APPLE_NEWS_POST_MINUTE_PARIS = 0;
export const APPLE_NEWS_POST_WINDOW_MINUTES = 5;

// Nombre d'items par source
export const APPLE_NEWS_MACRUMORS_COUNT = 3;
export const APPLE_NEWS_9TO5_COUNT = 3;
export const APPLE_NEWS_NEWSROOM_COUNT = 2;
