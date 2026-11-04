import {
  containsCJK,
  normalizeCJKDialectPhrases,
  sanitizeTranslatedTitle,
} from './cjk-translate';

const translationMemoryCache = new Map<string, string>();
const MAX_CACHE_ENTRIES = 1000;

function setCachedTranslation(original: string, translated: string): void {
  if (translationMemoryCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = translationMemoryCache.keys().next().value;
    if (firstKey !== undefined) {
      translationMemoryCache.delete(firstKey);
    }
  }
  translationMemoryCache.set(original, translated);
}

async function translateViaGoogleGtxFallback(
  rawTitle: string,
  timeoutMs = 3500
): Promise<string | null> {
  const preNormalized = normalizeCJKDialectPhrases(rawTitle);
  const endpoint = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(
    preNormalized
  )}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) return null;
    const data = (await response.json()) as unknown;
    if (!Array.isArray(data) || !Array.isArray(data[0])) return null;

    const segments = data[0] as Array<unknown>;
    const joined = segments
      .map((seg) => (Array.isArray(seg) && typeof seg[0] === 'string' ? seg[0] : ''))
      .join('')
      .trim();

    if (!joined) return null;
    return sanitizeTranslatedTitle(joined, rawTitle);
  } catch {
    return null;
  }
}

/**
 * Translates a single tab title if it contains Chinese, Korean, or Japanese into English.
 */
export async function translateCJKTitleIfNeeded(
  rawTitle: string | null | undefined
): Promise<string> {
  if (!rawTitle || typeof rawTitle !== 'string') {
    return '';
  }
  const trimmed = rawTitle.trim();
  if (!trimmed || !containsCJK(trimmed)) {
    return trimmed;
  }

  const cached = translationMemoryCache.get(trimmed);
  if (cached) {
    return cached;
  }

  const fallback = await translateViaGoogleGtxFallback(trimmed, 2500);
  if (fallback) {
    setCachedTranslation(trimmed, fallback);
    return fallback;
  }

  return trimmed;
}

/**
 * Batch-translates multiple tab titles containing CJK characters/dialects.
 */
export async function translateCJKTitlesBatch(
  titles: string[]
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const uniqueToTranslate: string[] = [];
  const seen = new Set<string>();

  for (const raw of titles) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;

    if (!containsCJK(trimmed)) {
      result[raw] = trimmed;
      continue;
    }

    const cached = translationMemoryCache.get(trimmed);
    if (cached) {
      result[raw] = cached;
      continue;
    }

    if (!seen.has(trimmed)) {
      seen.add(trimmed);
      uniqueToTranslate.push(trimmed);
    }
  }

  if (uniqueToTranslate.length === 0) {
    return result;
  }

  await Promise.all(
    uniqueToTranslate.map(async (src) => {
      if (!translationMemoryCache.has(src)) {
        const translated = await translateCJKTitleIfNeeded(src);
        setCachedTranslation(src, translated);
      }
    })
  );

  for (const raw of titles) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    result[raw] = translationMemoryCache.get(trimmed) ?? trimmed;
  }

  return result;
}
