import { GoogleGenAI, Type } from '@google/genai';
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

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
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
 * Translates a single tab title if it contains Chinese (Mandarin, Cantonese,
 * Hokkien, Hakka, Simplified/Traditional), Korean (standard or dialect), or
 * Japanese (standard or dialect) into clear, natural English.
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

  const ai = getGeminiClient();
  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Translate any Chinese (including Mandarin, Cantonese, Hokkien, Hakka, Traditional, or Simplified dialects), Korean (including regional dialects and slang), or Japanese (including Kansai and regional dialects) text in the following browser tab title into natural, concise English. Keep existing English or Vietnamese words, numbers, brackets, and brand/channel names intact. Return ONLY the translated title text without quotes or explanations.\n\nTab Title: ${trimmed}`,
        config: {
          temperature: 0.1,
        },
      });

      const candidate = response.text?.trim();
      if (candidate && !containsCJK(candidate)) {
        const sanitized = sanitizeTranslatedTitle(candidate, trimmed);
        setCachedTranslation(trimmed, sanitized);
        return sanitized;
      }
      if (candidate) {
        // If Gemini left a few CJK chars (e.g. proper noun), run fallback on remaining or accept if mostly translated
        const fallbackRefined = await translateViaGoogleGtxFallback(candidate);
        const finalTitle = sanitizeTranslatedTitle(
          fallbackRefined || candidate,
          trimmed
        );
        setCachedTranslation(trimmed, finalTitle);
        return finalTitle;
      }
    } catch {
      // Fall through to Google Translate gtx fallback
    }
  }

  const fallback = await translateViaGoogleGtxFallback(trimmed);
  if (fallback) {
    setCachedTranslation(trimmed, fallback);
    return fallback;
  }

  return trimmed;
}

/**
 * Batch-translates multiple tab titles containing CJK characters/dialects.
 * Returns a map from original title -> translated title.
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

  if (uniqueToTranslate.length === 1) {
    const single = uniqueToTranslate[0];
    const translated = await translateCJKTitleIfNeeded(single);
    for (const raw of titles) {
      if (typeof raw === 'string' && raw.trim() === single) {
        result[raw] = translated;
      }
    }
    return result;
  }

  const ai = getGeminiClient();
  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Translate any Chinese (Mandarin, Cantonese, Hokkien, Hakka, Traditional, Simplified), Korean (standard and regional dialects), or Japanese (standard and regional dialects) text in each of the following browser tab titles into natural, concise English. Preserve non-CJK words (like English or Vietnamese), numbers, and brand names. Return a JSON array of objects with "source" and "translated" properties matching the input order.\n\nInput titles:\n${JSON.stringify(
          uniqueToTranslate
        )}`,
        config: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                source: { type: Type.STRING },
                translated: { type: Type.STRING },
              },
              required: ['source', 'translated'],
            },
          },
        },
      });

      const rawJson = response.text?.trim();
      if (rawJson) {
        const parsed = JSON.parse(rawJson) as Array<{
          source?: string;
          translated?: string;
        }>;
        if (Array.isArray(parsed)) {
          for (let i = 0; i < uniqueToTranslate.length; i++) {
            const src = uniqueToTranslate[i];
            const matched =
              parsed.find((item) => item?.source?.trim() === src) ?? parsed[i];
            if (matched?.translated) {
              const clean = sanitizeTranslatedTitle(matched.translated, src);
              setCachedTranslation(src, clean);
            }
          }
        }
      }
    } catch {
      // Fall through to per-item fallback for any untranslated items
    }
  }

  // Ensure any remaining items not resolved by batch Gemini call use the fallback
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
