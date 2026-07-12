/**
 * Service d'accès à la doc Apple Developer via l'endpoint JSON
 * non documenté que le site `developer.apple.com` utilise lui-même
 * (DocC-based static JSON).
 *
 * Endpoint: https://developer.apple.com/tutorials/data/documentation/{framework}/{symbol}.json
 *
 * Stratégie : pas de pré-indexation lourde. Si l'utilisateur fournit
 * un framework, on tape directement. Sinon, on tente les 8 frameworks
 * en parallèle, le premier hit (HTTP 200) gagne.
 */

const DATA_BASE = 'https://developer.apple.com/tutorials/data/documentation/';
const WEB_BASE = 'https://developer.apple.com/documentation/';

export const APPLE_FRAMEWORKS = [
  'swiftui',
  'uikit',
  'foundation',
  'swiftdata',
  'coredata',
  'cloudkit',
  'swift',
  'combine',
] as const;

export type AppleFramework = typeof APPLE_FRAMEWORKS[number];

export const FRAMEWORK_META: Record<AppleFramework, { label: string; emoji: string }> = {
  swiftui: { label: 'SwiftUI', emoji: '💎' },
  uikit: { label: 'UIKit', emoji: '🧱' },
  foundation: { label: 'Foundation', emoji: '🏛️' },
  swiftdata: { label: 'SwiftData', emoji: '🗃️' },
  coredata: { label: 'Core Data', emoji: '💾' },
  cloudkit: { label: 'CloudKit', emoji: '☁️' },
  swift: { label: 'Swift', emoji: '🐦' },
  combine: { label: 'Combine', emoji: '🔗' },
};

interface AppleFragment {
  text: string;
  kind: string;
}

interface ApplePlatform {
  name: string;
  introducedAt?: string;
  deprecated?: boolean;
  beta?: boolean;
  unavailable?: boolean;
  deprecatedAt?: string;
}

interface AppleMetadata {
  title?: string;
  roleHeading?: string;
  symbolKind?: string;
  modules?: { name: string }[];
  fragments?: AppleFragment[];
  platforms?: ApplePlatform[];
  role?: string;
}

interface AppleAbstractPart {
  text?: string;
  type?: string;
  identifier?: string;
}

export interface AppleDocPayload {
  metadata?: AppleMetadata;
  abstract?: AppleAbstractPart[];
  topicSections?: { title: string; identifiers?: string[]; anchor?: string }[];
  variants?: { paths: string[] }[];
  identifier?: { url?: string };
}

export interface AppleDocResult {
  framework: AppleFramework;
  symbolPath: string;
  webUrl: string;
  data: AppleDocPayload;
}

/**
 * Construit l'URL de l'endpoint JSON pour un symbole donné.
 * Le path est normalisé : lowercase, espaces → tirets, signature `init(_:)` préservée.
 */
function buildDataUrl(framework: AppleFramework, symbol: string): string {
  const normalized = symbol
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_\-\(\):,]/g, '');
  return `${DATA_BASE}${framework}/${normalized}.json`;
}

/**
 * Reconstruit le chemin web public à partir d'une payload Apple.
 * Le champ `variants[0].paths[0]` ou `identifier.url` donne `/documentation/swiftui/text`.
 */
function extractWebPath(data: AppleDocPayload, framework: AppleFramework, symbol: string): string {
  const variantPath = data.variants?.[0]?.paths?.[0];
  if (variantPath) return `https://developer.apple.com${variantPath}`;

  const idUrl = data.identifier?.url;
  if (idUrl?.startsWith('doc://')) {
    // doc://com.apple.SwiftUI/documentation/SwiftUI/Text
    const match = idUrl.match(/doc:\/\/[^/]+(\/.*)$/);
    if (match) return `https://developer.apple.com${match[1].toLowerCase()}`;
  }

  return `${WEB_BASE}${framework}/${symbol.toLowerCase()}`;
}

async function fetchOneFramework(
  framework: AppleFramework,
  symbol: string,
  timeoutMs: number
): Promise<AppleDocResult | null> {
  const url = buildDataUrl(framework, symbol);
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; KeepOS-Bot/1.0)',
      },
      signal: controller.signal,
    });
    clearTimeout(id);

    if (!res.ok) return null;
    const data = (await res.json()) as AppleDocPayload;

    return {
      framework,
      symbolPath: symbol,
      webUrl: extractWebPath(data, framework, symbol),
      data,
    };
  } catch {
    clearTimeout(id);
    return null;
  }
}

/**
 * Cherche un symbole dans la doc Apple.
 * - Si `framework` est fourni : un seul fetch ciblé.
 * - Sinon : 8 fetches en parallèle, on prend le premier hit.
 */
export async function findSymbolDoc(
  symbol: string,
  framework?: AppleFramework,
  timeoutMs = 4000
): Promise<AppleDocResult | null> {
  if (framework) {
    return fetchOneFramework(framework, symbol, timeoutMs);
  }

  const results = await Promise.all(
    APPLE_FRAMEWORKS.map(fw => fetchOneFramework(fw, symbol, timeoutMs))
  );
  return results.find(r => r !== null) ?? null;
}

/**
 * Fetch direct via le path Apple complet (ex: `/documentation/swiftui/text`).
 * Utilisé quand l'utilisateur sélectionne une suggestion d'autocomplete : on a
 * déjà le path exact, pas besoin de deviner le framework ni de lowercase.
 */
export async function fetchByDocPath(
  path: string,
  timeoutMs = 4000
): Promise<AppleDocResult | null> {
  if (!path.startsWith('/documentation/')) return null;

  const url = `https://developer.apple.com/tutorials/data${path}.json`;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; KeepOS-Bot/1.0)',
      },
      signal: controller.signal,
    });
    clearTimeout(id);
    if (!res.ok) return null;
    const data = (await res.json()) as AppleDocPayload;

    const frameworkSegment = path.split('/')[2]?.toLowerCase() ?? '';
    const framework = (APPLE_FRAMEWORKS.includes(frameworkSegment as AppleFramework)
      ? frameworkSegment
      : 'swift') as AppleFramework;

    return {
      framework,
      symbolPath: path,
      webUrl: `https://developer.apple.com${path}`,
      data,
    };
  } catch {
    clearTimeout(id);
    return null;
  }
}

/**
 * Extrait le texte concaténé d'un abstract Apple.
 */
export function flattenAbstract(abstract: AppleAbstractPart[] | undefined): string {
  if (!abstract?.length) return '';
  return abstract
    .map(part => part.text ?? '')
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Reconstruit la signature à partir des fragments (ex: "struct Text").
 */
export function flattenFragments(fragments: AppleFragment[] | undefined): string {
  if (!fragments?.length) return '';
  return fragments.map(f => f.text).join('').replace(/\s+/g, ' ').trim();
}

/**
 * Formate les plateformes en une ligne concise : "iOS 13+ · macOS 10.15+ · visionOS 1+".
 * Filtre les plateformes "unavailable" et regroupe Mac Catalyst sous iOS quand identique.
 */
export function formatPlatforms(platforms: ApplePlatform[] | undefined): string {
  if (!platforms?.length) return '';

  const available = platforms.filter(p => !p.unavailable);
  if (!available.length) return '';

  return available
    .map(p => {
      const version = p.introducedAt ? `${p.introducedAt}+` : '';
      const deprecated = p.deprecated ? ' ⚠️' : '';
      const beta = p.beta ? ' β' : '';
      return `**${p.name}** ${version}${deprecated}${beta}`.trim();
    })
    .join(' · ');
}
