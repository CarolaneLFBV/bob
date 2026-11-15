import { heapStats } from 'bun:jsc';

const MB = 1024 * 1024;
const TOP_TYPES = 8;

let previousCounts: Record<string, number> = {};

function toMB(bytes: number): string {
  return `${(bytes / MB).toFixed(1)}MB`;
}

function report() {
  Bun.gc(true);
  const memory = process.memoryUsage();
  const stats = heapStats();

  const growth = Object.entries(stats.objectTypeCounts)
    .map(([type, count]) => ({ type, count, delta: count - (previousCounts[type] ?? 0) }))
    .filter(entry => entry.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, TOP_TYPES)
    .map(entry => `${entry.type}=${entry.count}(+${entry.delta})`)
    .join(' ');
  previousCounts = stats.objectTypeCounts;

  console.log(
    `[memoire] rss=${toMB(memory.rss)} heapUsed=${toMB(memory.heapUsed)} heapTotal=${toMB(memory.heapTotal)} ` +
      `external=${toMB(memory.external)} arrayBuffers=${toMB(memory.arrayBuffers)} ` +
      `jscHeap=${toMB(stats.heapSize)} jscExtra=${toMB(stats.extraMemorySize)} objects=${stats.objectCount}`
  );
  console.log(`[memoire] croissance ${growth || 'aucune'}`);
}

export function startMemoryReport(intervalMs: number = 60 * 60 * 1000): void {
  setTimeout(report, 5 * 60 * 1000);
  setInterval(report, intervalMs);
}
