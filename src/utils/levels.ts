/**
 * Level system utilities
 * Formula: XP required for level N = 5 * (N^2) + 50 * N + 100
 */

/**
 * Calculate XP required to reach a specific level
 */
export function xpForLevel(level: number): number {
  return 5 * Math.pow(level, 2) + 50 * level + 100;
}

/**
 * Calculate total XP required from level 0 to reach a level
 */
export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let i = 0; i < level; i++) {
    total += xpForLevel(i);
  }
  return total;
}

/**
 * Calculate level from total XP
 */
export function levelFromXp(xp: number): number {
  let level = 0;
  let totalRequired = 0;

  while (totalRequired + xpForLevel(level) <= xp) {
    totalRequired += xpForLevel(level);
    level++;
  }

  return level;
}

/**
 * Calculate XP progress within current level
 */
export function xpProgress(totalXp: number): { current: number; required: number; percentage: number } {
  const level = levelFromXp(totalXp);
  const xpForCurrentLevel = totalXpForLevel(level);
  const current = totalXp - xpForCurrentLevel;
  const required = xpForLevel(level);
  const percentage = Math.floor((current / required) * 100);

  return { current, required, percentage };
}

/**
 * Generate a progress bar
 */
export function progressBar(percentage: number, length: number = 10): string {
  const filled = Math.round((percentage / 100) * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Get random XP within a range
 */
export function randomXp(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Format large numbers (1000 -> 1K, 1000000 -> 1M)
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}
