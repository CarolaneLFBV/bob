/**
 * Configuration du système Tech Watch.
 * Pour passer du salon de test au salon public final, change juste TECHWATCH_CHANNEL_ID.
 */

// Salon officiel Tech Watch (public)
export const TECHWATCH_CHANNEL_ID = '1503702206715658250';

// Heure de post quotidien, en heure de Paris (Europe/Paris).
export const TECHWATCH_POST_HOUR_PARIS = 9;
export const TECHWATCH_POST_MINUTE_PARIS = 0;

// Le cron tolère jusqu'à 5 minutes de retard (au cas où le bot ait redémarré pile à 9h)
export const TECHWATCH_POST_WINDOW_MINUTES = 5;

// Nombre d'items à inclure
export const TECHWATCH_HN_COUNT = 3;
export const TECHWATCH_GITHUB_COUNT = 3;

/**
 * Convertit "maintenant" en heure de Paris et retourne le numéro de jour ISO (YYYY-MM-DD)
 * et l'heure/minute en Europe/Paris. Permet de gérer correctement été/hiver.
 */
export function getParisNow(): { date: string; hour: number; minute: number } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '00';

  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: parseInt(get('hour'), 10),
    minute: parseInt(get('minute'), 10),
  };
}

/**
 * Indique si "maintenant" est dans la fenêtre de post quotidien (9h00-9h05 Paris).
 */
export function isInPostWindow(): boolean {
  const { hour, minute } = getParisNow();
  if (hour !== TECHWATCH_POST_HOUR_PARIS) return false;
  return minute >= TECHWATCH_POST_MINUTE_PARIS && minute < TECHWATCH_POST_MINUTE_PARIS + TECHWATCH_POST_WINDOW_MINUTES;
}
