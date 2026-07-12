/**
 * Crawler one-shot pour construire l'index local des symboles Apple Doc.
 *
 * Stratégie : on part de chaque framework root, on descend de 2 niveaux dans
 * les collectionGroups (qui regroupent les symboles), et on accumule chaque
 * référence de type "topic" dans une liste plate. Écrit `data/apple-doc-index.json`.
 *
 * Usage : bun src/scripts/build-apple-doc-index.ts
 *
 * Le bot lit ce fichier au démarrage. Re-run le script pour rafraîchir l'index
 * (à faire de temps en temps, ex: une fois par mois).
 */

const DATA_BASE = 'https://developer.apple.com/tutorials/data';

const FRAMEWORKS = [
  'swiftui',
  'uikit',
  'foundation',
  'swiftdata',
  'coredata',
  'cloudkit',
  'swift',
  'combine',
];

const MAX_DEPTH = 2;
const MAX_CONCURRENT = 12;
const FETCH_TIMEOUT_MS = 8000;

interface Reference {
  title?: string;
  url?: string;
  abstract?: { text?: string; type?: string }[];
  role?: string;
  type?: string;
  kind?: string;
  navigatorTitle?: { text?: string }[];
}

interface IndexEntry {
  name: string;
  url: string;
  abstract: string;
  role: string;
  framework: string;
  kind?: string;
}

async function fetchJson(url: string): Promise<any | null> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; KeepOS-Bot-Crawler/1.0)',
      },
      signal: controller.signal,
    });
    clearTimeout(id);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(id);
    return null;
  }
}

function flattenAbstract(abstract?: { text?: string }[]): string {
  if (!abstract?.length) return '';
  return abstract
    .map(p => p.text ?? '')
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractFramework(url: string): string {
  // /documentation/swiftui/text → swiftui
  // /documentation/CoreTransferable/Transferable → coretransferable
  const m = url.match(/^\/documentation\/([^/]+)/);
  return m ? m[1].toLowerCase() : 'unknown';
}

/**
 * Construit l'URL de la page JSON à partir d'un path donné par Apple.
 * Apple retourne parfois `/documentation/CoreTransferable/...` ; le serveur
 * accepte indifféremment la casse pour le JSON, mais on prend tel quel pour
 * éviter les surprises.
 */
function pathToJsonUrl(path: string): string {
  return `${DATA_BASE}${path}.json`;
}

let visited = new Set<string>();
const entries: IndexEntry[] = [];

/**
 * Pool de concurrence : limite le nombre de fetches simultanés.
 */
async function withLimit<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = [];
  let i = 0;

  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await tasks[idx]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, worker);
  await Promise.all(workers);
  return results;
}

async function crawlPage(path: string, depth: number): Promise<void> {
  if (depth > MAX_DEPTH) return;
  if (visited.has(path)) return;
  visited.add(path);

  const data = await fetchJson(pathToJsonUrl(path));
  if (!data || !data.references) return;

  const refs = Object.values(data.references) as Reference[];
  const nextTasks: (() => Promise<void>)[] = [];

  for (const ref of refs) {
    if (ref.type !== 'topic' || !ref.url || !ref.title) continue;

    entries.push({
      name: ref.title,
      url: ref.url,
      abstract: flattenAbstract(ref.abstract),
      role: ref.role ?? 'topic',
      framework: extractFramework(ref.url),
      kind: ref.kind,
    });

    // Recurse into groups
    if (
      (ref.role === 'collectionGroup' || ref.role === 'collection') &&
      depth < MAX_DEPTH
    ) {
      const subPath = ref.url;
      if (!visited.has(subPath)) {
        nextTasks.push(() => crawlPage(subPath, depth + 1));
      }
    }
  }

  // Crawl sub-pages with concurrency control
  await withLimit(nextTasks, MAX_CONCURRENT);
}

async function main() {
  console.log('🔎 Démarrage du crawl Apple Doc…\n');
  const start = Date.now();

  // Crawl each framework root in series. Visited est RESET entre frameworks
  // pour éviter qu'une référence croisée (ex: SwiftUI qui pointe vers UIKit)
  // bloque le crawl de la racine du framework concerné. La dédup finale fait
  // le ménage.
  for (const fw of FRAMEWORKS) {
    visited = new Set<string>();
    const before = entries.length;
    console.log(`▶ ${fw}…`);
    await crawlPage(`/documentation/${fw}`, 0);
    console.log(`  ↳ ${entries.length - before} entrées (${visited.size} pages visitées)`);
  }

  // Dedupe by URL (a symbol can appear in multiple collection groups)
  const map = new Map<string, IndexEntry>();
  for (const e of entries) {
    if (!map.has(e.url)) map.set(e.url, e);
  }
  const deduped = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));

  // Stats
  const byRole = new Map<string, number>();
  const byFramework = new Map<string, number>();
  for (const e of deduped) {
    byRole.set(e.role, (byRole.get(e.role) ?? 0) + 1);
    byFramework.set(e.framework, (byFramework.get(e.framework) ?? 0) + 1);
  }

  const outPath = 'data/apple-doc-index.json';
  await Bun.write(outPath, JSON.stringify(deduped));
  const size = (await Bun.file(outPath).size) / 1024;

  console.log('\n✅ Crawl terminé');
  console.log(`   ⏱  Durée : ${Math.round((Date.now() - start) / 1000)}s`);
  console.log(`   📄 ${deduped.length} entrées uniques · ${size.toFixed(0)} KB JSON`);
  console.log(`   🗂  Par rôle : ${[...byRole.entries()].map(([k, v]) => `${k}=${v}`).join(', ')}`);
  console.log(`   📚 Par framework :`);
  [...byFramework.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([fw, count]) => console.log(`      ${fw.padEnd(20)} ${count}`));
  console.log(`\n📂 Fichier écrit : ${outPath}`);
}

main().catch(err => {
  console.error('❌ Échec :', err);
  process.exit(1);
});
