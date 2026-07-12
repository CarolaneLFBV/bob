/**
 * Service d'index local pour l'autocomplétion d'/apple-doc.
 * Charge `data/apple-doc-index.json` au démarrage en RAM,
 * expose une fonction de recherche par préfixe/sous-chaîne.
 *
 * L'index est généré par : bun src/scripts/build-apple-doc-index.ts
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export interface AppleDocIndexEntry {
  name: string;
  url: string;
  abstract: string;
  role: string;
  framework: string;
  kind?: string;
}

let INDEX: AppleDocIndexEntry[] = [];
let LOADED = false;

function loadIndex(): void {
  if (LOADED) return;
  LOADED = true;
  try {
    const path = join(process.cwd(), 'data', 'apple-doc-index.json');
    const raw = readFileSync(path, 'utf-8');
    INDEX = JSON.parse(raw);
    console.log(`✅ Apple doc index chargé : ${INDEX.length} symboles`);
  } catch (error) {
    console.warn(
      '⚠️  Apple doc index introuvable. Lance : `bun src/scripts/build-apple-doc-index.ts` puis redémarre.'
    );
    INDEX = [];
  }
}

// Auto-load au premier import
loadIndex();

function score(name: string, query: string, role: string): number {
  const n = name.toLowerCase();
  const q = query.toLowerCase();

  // Match exact > startsWith > contains (mot) > contains
  if (n === q) return 1000;
  if (n.startsWith(q)) return 500;
  if (n.split(/[^a-z0-9]/).some(part => part === q)) return 250;
  if (n.includes(q)) return 100;
  return 0;
}

// Préférence par rôle (symboles > articles > sample code)
const ROLE_BONUS: Record<string, number> = {
  symbol: 20,
  collection: 10,
  collectionGroup: 5,
  article: 3,
  overview: 2,
  sampleCode: 1,
};

export function searchSymbols(query: string, limit = 25): AppleDocIndexEntry[] {
  const q = query.trim();

  if (!q) {
    // Sans query, retourne quelques exemples populaires (symboles SwiftUI les plus courts)
    return INDEX.filter(e => e.role === 'symbol' && e.framework === 'swiftui' && e.name.length <= 12)
      .slice(0, limit);
  }

  const scored: { entry: AppleDocIndexEntry; score: number }[] = [];

  for (const entry of INDEX) {
    const s = score(entry.name, q, entry.role) + (ROLE_BONUS[entry.role] ?? 0);
    if (s > 0) scored.push({ entry, score: s });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(s => s.entry);
}

export function getIndexSize(): number {
  return INDEX.length;
}

export function findByUrl(url: string): AppleDocIndexEntry | null {
  return INDEX.find(e => e.url === url) ?? null;
}
