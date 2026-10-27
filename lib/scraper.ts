import { ScrapedMetadata } from './types';

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export function validateAndNormalizeUrl(rawInput: string): URL {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    throw new Error('URL cannot be empty.');
  }
  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed);
  const withProtocol = hasScheme ? trimmed : `https://${trimmed}`;
  const parsed = new URL(withProtocol);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS URLs are supported.');
  }
  if (!parsed.hostname || !parsed.hostname.includes('.')) {
    throw new Error('Please enter a valid domain name.');
  }
  return parsed;
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractMetaContent(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:property|name|itemprop)=["']${escapedKey}["'][^>]+content=["']([^"']+)["'][^>]*>`,
        'i'
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name|itemprop)=["']${escapedKey}["'][^>]*>`,
        'i'
      ),
    ];
    for (const regex of patterns) {
      const match = html.match(regex);
      if (match?.[1]?.trim()) {
        return decodeHtmlEntities(match[1]);
      }
    }
  }
  return null;
}

export function resolveAbsoluteUrl(candidate: string | null | undefined, baseUrl: URL): string | null {
  if (!candidate || !candidate.trim()) return null;
  const cleaned = candidate.trim();
  if (cleaned.startsWith('data:')) return null;
  try {
    return new URL(cleaned, baseUrl.origin + baseUrl.pathname).toString();
  } catch {
    return null;
  }
}

export function resolveFaviconUrl(html: string, baseUrl: URL): string {
  const iconPatterns = [
    /<link[^>]+rel=["'](?:shortcut\s+icon|icon|apple-touch-icon)["'][^>]+href=["']([^"']+)["'][^>]*>/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut\s+icon|icon|apple-touch-icon)["'][^>]*>/i,
  ];

  for (const pattern of iconPatterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const resolved = resolveAbsoluteUrl(match[1], baseUrl);
      if (resolved) return resolved;
    }
  }

  return `${baseUrl.origin}/favicon.ico`;
}

export function estimateReadingMinutes(htmlOrText: string, description: string): number {
  const strippedBody = htmlOrText
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = strippedBody ? strippedBody.split(' ').length : 0;
  if (words > 120) {
    return Math.max(1, Math.min(45, Math.round(words / 220)));
  }

  const descWords = description ? description.split(/\s+/).length : 0;
  return Math.max(3, Math.min(18, Math.round(descWords / 6) + 3));
}

const GENERIC_PLACEHOLDER_TITLES = new Set([
  '- youtube',
  'youtube',
  'watch - youtube',
  'watch — youtube.com',
  'before you continue to youtube',
  'just a moment...',
  'attention required! | cloudflare',
  'access denied',
]);

export function isGenericPlaceholderTitle(rawTitle: string | null | undefined): boolean {
  if (!rawTitle) return true;
  const cleaned = rawTitle.trim();
  if (cleaned.length <= 1) return true;
  return GENERIC_PLACEHOLDER_TITLES.has(cleaned.toLowerCase());
}

export function cleanScrapedTitle(rawTitle: string | null | undefined): string | null {
  if (!rawTitle) return null;
  const decoded = decodeHtmlEntities(rawTitle)
    .replace(/\s+-\s+YouTube$/i, '')
    .trim();
  if (isGenericPlaceholderTitle(decoded)) {
    return null;
  }
  return decoded;
}

export function extractYouTubeVideoId(url: URL): string | null {
  const host = url.hostname.replace(/^(www|m|music)\./i, '').toLowerCase();
  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return id && /^[\w-]{6,20}$/.test(id) ? id : null;
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const vParam = url.searchParams.get('v');
    if (vParam && /^[\w-]{6,20}$/.test(vParam)) {
      return vParam;
    }
    const segments = url.pathname.split('/').filter(Boolean);
    if (
      segments.length >= 2 &&
      ['shorts', 'embed', 'live', 'v'].includes(segments[0].toLowerCase())
    ) {
      const id = segments[1];
      return id && /^[\w-]{6,20}$/.test(id) ? id : null;
    }
  }
  return null;
}

export function humanizeFallbackTitle(url: URL): string {
  const host = url.hostname.replace(/^www\./i, '');
  const ytVideoId = extractYouTubeVideoId(url);
  if (ytVideoId) {
    return `YouTube Clip (${ytVideoId})`;
  }

  const segments = url.pathname
    .split('/')
    .filter(Boolean)
    .map((seg) =>
      seg
        .replace(/\.(html?|php|aspx|md)$/i, '')
        .replace(/[-_]+/g, ' ')
        .trim()
    )
    .filter((seg) => Boolean(seg) && seg.toLowerCase() !== 'watch');

  if (segments.length > 0) {
    const lastSegment = segments[segments.length - 1];
    const formatted = lastSegment.replace(/\b\w/g, (char) => char.toUpperCase());
    return `${formatted} — ${host}`;
  }

  return `${host} Reference Document`;
}

function extractYouTubePlayerTitle(html: string): string | null {
  const playerTitleMatch = html.match(/"videoDetails"\s*:\s*\{[^}]*?"title"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);
  if (playerTitleMatch?.[1]) {
    try {
      const unescaped = JSON.parse(`"${playerTitleMatch[1]}"`) as string;
      return cleanScrapedTitle(unescaped);
    } catch {
      return cleanScrapedTitle(playerTitleMatch[1]);
    }
  }
  return null;
}

export function parseHtmlMetadata(html: string, rawUrl: string): ScrapedMetadata {
  const parsedUrl = validateAndNormalizeUrl(rawUrl);
  const domain = parsedUrl.hostname.replace(/^www\./i, '');

  const ogTitle = extractMetaContent(html, ['og:title', 'twitter:title', 'title']);
  const titleTagMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const fallbackTagTitle = titleTagMatch?.[1] ? decodeHtmlEntities(titleTagMatch[1]) : null;
  const ytPlayerTitle = extractYouTubePlayerTitle(html);

  const cleanedTitle =
    cleanScrapedTitle(ogTitle) ||
    ytPlayerTitle ||
    cleanScrapedTitle(fallbackTagTitle);

  const ogDescription = extractMetaContent(html, [
    'og:description',
    'twitter:description',
    'description',
  ]);

  const ytVideoId = extractYouTubeVideoId(parsedUrl);
  const rawImage = extractMetaContent(html, ['og:image', 'twitter:image', 'twitter:image:src']);
  const resolvedImage =
    resolveAbsoluteUrl(rawImage, parsedUrl) ||
    (ytVideoId ? `https://i.ytimg.com/vi/${ytVideoId}/hqdefault.jpg` : null);
  const favicon = ytVideoId
    ? 'https://www.youtube.com/favicon.ico'
    : resolveFaviconUrl(html, parsedUrl);

  const hasValidTitle = Boolean(cleanedTitle);
  const title = hasValidTitle ? (cleanedTitle as string) : humanizeFallbackTitle(parsedUrl);
  const description =
    ogDescription ||
    `Saved technical reference from ${domain}${parsedUrl.pathname !== '/' ? ` (${parsedUrl.pathname})` : ''}. Metadata synthesized via defensive fallback.`;

  const reading_minutes = estimateReadingMinutes(html, description);
  const scrape_status = hasValidTitle && Boolean(ogDescription || fallbackTagTitle || ytPlayerTitle) ? 'ok' : 'degraded';

  return {
    url: parsedUrl.toString(),
    domain,
    title,
    description,
    image_url: resolvedImage,
    favicon,
    reading_minutes,
    scrape_status,
    diagnostics:
      scrape_status === 'ok'
        ? 'OpenGraph / HTML metadata extracted cleanly.'
        : 'Partial or missing meta tags; applied deterministic domain fallback.',
  };
}

async function fetchYouTubeOEmbedMetadata(
  parsedUrl: URL,
  videoId: string,
  timeoutMs: number
): Promise<ScrapedMetadata | null> {
  const canonicalWatchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const endpoints = [
    `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalWatchUrl)}&format=json`,
    `https://noembed.com/embed?url=${encodeURIComponent(canonicalWatchUrl)}`,
  ];

  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'User-Agent': BROWSER_USER_AGENT,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!response.ok) continue;
      const payload = (await response.json()) as {
        title?: string;
        author_name?: string;
        thumbnail_url?: string;
      };

      const validTitle = cleanScrapedTitle(payload.title);
      if (!validTitle) continue;

      const domain = parsedUrl.hostname.replace(/^www\./i, '');
      const author = payload.author_name?.trim();
      return {
        url: parsedUrl.toString(),
        domain,
        title: validTitle,
        description: author
          ? `YouTube video by ${author} (${canonicalWatchUrl}).`
          : `YouTube video clip (${canonicalWatchUrl}).`,
        image_url:
          payload.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        favicon: 'https://www.youtube.com/favicon.ico',
        reading_minutes: 5,
        scrape_status: 'ok',
        diagnostics: 'YouTube video title and thumbnail resolved via oEmbed API.',
      };
    } catch {
      // Try next endpoint or fall back to HTML scrape
    }
  }

  return null;
}

export async function scrapeUrlMetadata(
  rawUrl: string,
  timeoutMs = 4500
): Promise<ScrapedMetadata> {
  const parsedUrl = validateAndNormalizeUrl(rawUrl);
  const domain = parsedUrl.hostname.replace(/^www\./i, '');
  const ytVideoId = extractYouTubeVideoId(parsedUrl);

  if (ytVideoId) {
    const oembedMeta = await fetchYouTubeOEmbedMetadata(parsedUrl, ytVideoId, timeoutMs);
    if (oembedMeta) {
      return oembedMeta;
    }
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(parsedUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      return {
        url: parsedUrl.toString(),
        domain,
        title: humanizeFallbackTitle(parsedUrl),
        description: `Direct fetch returned HTTP ${response.status}. Preserved link with domain fallback metadata.`,
        image_url: ytVideoId ? `https://i.ytimg.com/vi/${ytVideoId}/hqdefault.jpg` : null,
        favicon: ytVideoId ? 'https://www.youtube.com/favicon.ico' : `${parsedUrl.origin}/favicon.ico`,
        reading_minutes: 5,
        scrape_status: 'degraded',
        diagnostics: `HTTP ${response.status} response from origin; degraded gracefully.`,
      };
    }

    const html = await response.text();
    return parseHtmlMetadata(html, parsedUrl.toString());
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Network timeout or unreachable host';
    return {
      url: parsedUrl.toString(),
      domain,
      title: humanizeFallbackTitle(parsedUrl),
      description: `Saved reference from ${domain}. Live scrape bypassed (${reason}).`,
      image_url: ytVideoId ? `https://i.ytimg.com/vi/${ytVideoId}/hqdefault.jpg` : null,
      favicon: ytVideoId ? 'https://www.youtube.com/favicon.ico' : `${parsedUrl.origin}/favicon.ico`,
      reading_minutes: 5,
      scrape_status: 'degraded',
      diagnostics: `Scraper fallback triggered: ${reason}`,
    };
  }
}
