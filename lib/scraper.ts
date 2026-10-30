import { ScrapedMetadata } from './types';
import { containsCJK } from './cjk-translate';
import { translateCJKTitleIfNeeded } from './cjk-translate-server';

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

export function formatVideoDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(1, Math.round(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  const pad2 = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${pad2(minutes)}:${pad2(seconds)}`;
  }
  return `${minutes}:${pad2(seconds)}`;
}

export function parseIso8601DurationToSeconds(raw: string): number | null {
  const cleaned = raw.trim().toUpperCase();
  const match = cleaned.match(
    /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i
  );
  if (!match) return null;
  const days = match[1] ? Number(match[1]) : 0;
  const hours = match[2] ? Number(match[2]) : 0;
  const minutes = match[3] ? Number(match[3]) : 0;
  const seconds = match[4] ? Number(match[4]) : 0;
  const total = days * 86400 + hours * 3600 + minutes * 60 + Math.round(seconds);
  return total > 0 ? total : null;
}

export function extractVideoDurationSeconds(html: string): number | null {
  // 1. YouTube player response lengthSeconds
  const lengthSecMatches = [
    html.match(/"lengthSeconds"\s*:\s*"(\d+)"/i),
    html.match(/\\"lengthSeconds\\"\s*:\s*\\"(\d+)\\"/i),
    html.match(/"length_seconds"\s*:\s*"?(\d+)"?/i),
  ];
  for (const m of lengthSecMatches) {
    if (m?.[1]) {
      const sec = Number(m[1]);
      if (Number.isFinite(sec) && sec > 0) return sec;
    }
  }

  // 2. YouTube approxDurationMs
  const approxMsMatch =
    html.match(/"approxDurationMs"\s*:\s*"(\d+)"/i) ||
    html.match(/\\"approxDurationMs\\"\s*:\s*\\"(\d+)\\"/i);
  if (approxMsMatch?.[1]) {
    const sec = Math.round(Number(approxMsMatch[1]) / 1000);
    if (Number.isFinite(sec) && sec > 0) return sec;
  }

  // 3. OpenGraph / Schema meta duration tags
  const rawMetaDuration = extractMetaContent(html, [
    'og:video:duration',
    'video:duration',
    'duration',
    'music:duration',
  ]);
  if (rawMetaDuration) {
    if (/^\d+(\.\d+)?$/.test(rawMetaDuration.trim())) {
      const sec = Math.round(Number(rawMetaDuration.trim()));
      if (sec > 0) return sec;
    }
    const isoSec = parseIso8601DurationToSeconds(rawMetaDuration);
    if (isoSec && isoSec > 0) return isoSec;
  }

  // 4. JSON-LD VideoObject or inline itemprop duration (ISO 8601 PT...)
  const isoJsonMatch = html.match(/"duration"\s*:\s*"(PT[0-9HMS.]+)"/i);
  if (isoJsonMatch?.[1]) {
    const isoSec = parseIso8601DurationToSeconds(isoJsonMatch[1]);
    if (isoSec && isoSec > 0) return isoSec;
  }

  return null;
}

async function fetchYouTubeInnertubePlayerDetails(
  videoId: string,
  timeoutMs: number
): Promise<{ durationSeconds: number | null; title: string | null; author: string | null }> {
  const clients = [
    {
      clientName: 'VISIONOS',
      clientVersion: '0.1',
      hl: 'en',
      gl: 'US',
    },
    {
      clientName: 'ANDROID_TESTSUITE',
      clientVersion: '1.9',
      hl: 'en',
      gl: 'US',
    },
    {
      clientName: 'WEB',
      clientVersion: '2.20250201.01.00',
      hl: 'en',
      gl: 'US',
    },
  ];

  for (const client of clients) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(timeoutMs, 3500));
      const response = await fetch(
        'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': BROWSER_USER_AGENT,
            Accept: 'application/json',
          },
          body: JSON.stringify({
            videoId,
            context: { client },
          }),
          signal: controller.signal,
        }
      );
      clearTimeout(timer);

      if (!response.ok) continue;
      const data = (await response.json()) as {
        videoDetails?: {
          lengthSeconds?: string | number;
          title?: string;
          author?: string;
        };
        microformat?: {
          playerMicroformatRenderer?: {
            lengthSeconds?: string | number;
          };
        };
        streamingData?: {
          formats?: Array<{ approxDurationMs?: string }>;
          adaptiveFormats?: Array<{ approxDurationMs?: string }>;
        };
      };

      const rawApproxMs =
        data?.streamingData?.formats?.[0]?.approxDurationMs ??
        data?.streamingData?.adaptiveFormats?.[0]?.approxDurationMs;
      const approxSec =
        rawApproxMs !== undefined
          ? Math.floor(Number(rawApproxMs) / 1000)
          : NaN;

      const rawLength =
        data?.videoDetails?.lengthSeconds ??
        data?.microformat?.playerMicroformatRenderer?.lengthSeconds;
      const lengthSec = rawLength !== undefined ? Number(rawLength) : NaN;

      // YouTube videoDetails.lengthSeconds is Math.ceil(durationMs / 1000) (+1s compared to player UI Math.floor)
      const adjustedLengthSec =
        Number.isFinite(lengthSec) && lengthSec > 0
          ? lengthSec > 1
            ? lengthSec - 1
            : lengthSec
          : null;

      const validDuration =
        Number.isFinite(approxSec) && approxSec > 0
          ? approxSec
          : adjustedLengthSec;
      const validTitle = cleanScrapedTitle(data?.videoDetails?.title);
      const validAuthor = data?.videoDetails?.author?.trim() || null;

      if (validDuration || validTitle) {
        return {
          durationSeconds: validDuration,
          title: validTitle,
          author: validAuthor,
        };
      }
    } catch {
      // Try next Innertube client context
    }
  }

  return { durationSeconds: null, title: null, author: null };
}

function parseDurationTimestampToSeconds(raw: string): number | null {
  const parts = raw
    .trim()
    .split(':')
    .map((part) => Number(part));
  if (
    parts.length < 2 ||
    parts.length > 3 ||
    parts.some((n) => !Number.isFinite(n) || n < 0)
  ) {
    return null;
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return parts[0] * 60 + parts[1];
}

async function fetchYouTubeSearchDurationSeconds(
  videoId: string,
  titleHint: string | null | undefined,
  timeoutMs: number
): Promise<number | null> {
  const cleanHint = titleHint?.trim() || '';
  const queries = Array.from(
    new Set(
      [
        videoId.startsWith('-') || videoId.includes('_') || videoId.includes('-')
          ? cleanHint
            ? `${cleanHint} "${videoId}"`
            : `"${videoId}"`
          : `"${videoId}"`,
        cleanHint ? `${cleanHint} ${videoId}` : null,
        cleanHint || null,
        videoId,
      ].filter((q): q is string => Boolean(q && q.trim()))
    )
  );

  const escapedId = videoId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  for (const query of queries) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        Math.max(timeoutMs, 4500)
      );
      const response = await fetch(
        'https://www.youtube.com/youtubei/v1/search?prettyPrint=false',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': BROWSER_USER_AGENT,
            Accept: 'application/json',
          },
          body: JSON.stringify({
            query,
            context: {
              client: {
                clientName: 'WEB',
                clientVersion: '2.20250201.01.00',
                hl: 'en',
                gl: 'US',
              },
            },
          }),
          signal: controller.signal,
        }
      );
      clearTimeout(timer);

      if (!response.ok) continue;
      const text = await response.text();
      const rendererMatch = text.match(
        new RegExp(`"videoRenderer"\\s*:\\s*\\{"videoId"\\s*:\\s*"${escapedId}"`)
      );
      if (!rendererMatch || rendererMatch.index === undefined) continue;

      const slice = text.slice(rendererMatch.index, rendererMatch.index + 3500);
      const lenIdx = slice.indexOf('"lengthText":');
      if (lenIdx === -1) continue;

      const lenSlice = slice.slice(lenIdx, lenIdx + 350);
      const simpleMatch = lenSlice.match(/"simpleText"\s*:\s*"([0-9:]+)"/);
      if (simpleMatch?.[1]) {
        const rawSec = parseDurationTimestampToSeconds(simpleMatch[1]);
        if (rawSec && rawSec > 0) {
          // YouTube search videoRenderer.lengthText rounds fractional seconds up by +1s compared to player bar
          return rawSec > 1 ? rawSec - 1 : rawSec;
        }
      }
    } catch {
      // Try next search query
    }
  }

  return null;
}

async function fetchYouTubeWatchHtmlDurationSeconds(
  videoId: string,
  timeoutMs: number
): Promise<number | null> {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}&hl=en`;
  const userAgents = [
    'Twitterbot/1.0',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    BROWSER_USER_AGENT,
  ];

  for (const ua of userAgents) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        Math.max(timeoutMs, 5500)
      );
      const response = await fetch(watchUrl, {
        method: 'GET',
        headers: {
          'User-Agent': ua,
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          Cookie: 'CONSENT=YES+cb.20210328-17-p0.en+FX+417',
        },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (response.ok) {
        const html = await response.text();
        const durationSec = extractVideoDurationSeconds(html);
        if (durationSec && durationSec > 0) {
          return durationSec > 1 ? durationSec - 1 : durationSec;
        }
      }
    } catch {
      // Try next User-Agent
    }
  }
  return null;
}

function extractYouTubeAuthorFromHtml(html: string): string | null {
  const patterns = [
    /"videoDetails"\s*:\s*\{[\s\S]{0,1200}?"author"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i,
    /"ownerChannelName"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i,
    /<span[^>]+itemprop=["']author["'][\s\S]{0,400}?<link[^>]+itemprop=["']name["'][^>]+content=["']([^"']+)["']/i,
    /<link[^>]+itemprop=["']name["'][^>]+content=["']([^"']+)["']/i,
  ];

  for (const regex of patterns) {
    const match = html.match(regex);
    if (match?.[1]) {
      try {
        const decoded = regex.source.startsWith('"')
          ? (JSON.parse(`"${match[1]}"`) as string)
          : decodeHtmlEntities(match[1]);
        const cleaned = decoded.trim();
        if (cleaned && cleaned.toLowerCase() !== 'youtube') {
          return cleaned;
        }
      } catch {
        const cleaned = decodeHtmlEntities(match[1]).trim();
        if (cleaned && cleaned.toLowerCase() !== 'youtube') {
          return cleaned;
        }
      }
    }
  }

  const metaAuthor = extractMetaContent(html, ['author']);
  if (metaAuthor && metaAuthor.trim().toLowerCase() !== 'youtube') {
    return metaAuthor.trim();
  }

  return null;
}

export function extractYouTubeChannelName(link: {
  url?: string;
  domain?: string;
  channel_name?: string | null;
  description?: string | null;
}): string | null {
  if (typeof link.channel_name === 'string' && link.channel_name.trim()) {
    return link.channel_name.trim();
  }
  if (typeof link.description === 'string' && link.description.trim()) {
    const match = link.description
      .trim()
      .match(
        /^YouTube video by\s+(.+?)(?:\s*\((?:https?:\/\/|www\.|youtube\.com|youtu\.be)[^)]*\))?\.?$/i
      );
    if (match?.[1]?.trim()) {
      return match[1].trim();
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
  const ytChannelName = ytVideoId ? extractYouTubeAuthorFromHtml(html) : null;
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
    ytVideoId && ytChannelName
      ? `YouTube video by ${ytChannelName} (https://www.youtube.com/watch?v=${ytVideoId}).`
      : ogDescription ||
        `Saved technical reference from ${domain}${parsedUrl.pathname !== '/' ? ` (${parsedUrl.pathname})` : ''}. Metadata synthesized via defensive fallback.`;

  const durationSeconds = extractVideoDurationSeconds(html);
  const video_duration =
    durationSeconds && durationSeconds > 0
      ? formatVideoDuration(durationSeconds)
      : null;
  const reading_minutes =
    durationSeconds && durationSeconds > 0
      ? Math.max(1, Math.round(durationSeconds / 60))
      : estimateReadingMinutes(html, description);
  const scrape_status = hasValidTitle && Boolean(ogDescription || fallbackTagTitle || ytPlayerTitle) ? 'ok' : 'degraded';

  return {
    url: parsedUrl.toString(),
    domain,
    title,
    description,
    image_url: resolvedImage,
    favicon,
    reading_minutes,
    video_duration,
    channel_name: ytChannelName,
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
      const author = payload.author_name?.trim() || null;
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
        video_duration: null,
        channel_name: author,
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
    const [oembedMeta, innertube] = await Promise.all([
      fetchYouTubeOEmbedMetadata(parsedUrl, ytVideoId, timeoutMs),
      fetchYouTubeInnertubePlayerDetails(ytVideoId, timeoutMs),
    ]);

    const resolvedChannelName =
      oembedMeta?.channel_name || innertube.author || null;

    let resolvedDurationSec =
      innertube.durationSeconds && innertube.durationSeconds > 0
        ? innertube.durationSeconds
        : null;

    if (!resolvedDurationSec) {
      resolvedDurationSec = await fetchYouTubeSearchDurationSeconds(
        ytVideoId,
        oembedMeta?.title || innertube.title,
        timeoutMs
      );
    }

    if (!resolvedDurationSec) {
      resolvedDurationSec = await fetchYouTubeWatchHtmlDurationSeconds(
        ytVideoId,
        timeoutMs
      );
    }

    if (oembedMeta) {
      const canonicalWatchUrl = `https://www.youtube.com/watch?v=${ytVideoId}`;
      oembedMeta.channel_name = resolvedChannelName;
      if (
        resolvedChannelName &&
        !oembedMeta.description.toLowerCase().startsWith('youtube video by ')
      ) {
        oembedMeta.description = `YouTube video by ${resolvedChannelName} (${canonicalWatchUrl}).`;
      }
      if (resolvedDurationSec) {
        oembedMeta.video_duration = formatVideoDuration(resolvedDurationSec);
        oembedMeta.reading_minutes = Math.max(
          1,
          Math.round(resolvedDurationSec / 60)
        );
      }
      if (containsCJK(oembedMeta.title)) {
        oembedMeta.title = await translateCJKTitleIfNeeded(oembedMeta.title);
      }
      return oembedMeta;
    }

    if (innertube.title || resolvedDurationSec || resolvedChannelName) {
      const canonicalWatchUrl = `https://www.youtube.com/watch?v=${ytVideoId}`;
      const rawYtTitle = innertube.title || humanizeFallbackTitle(parsedUrl);
      const finalYtTitle = containsCJK(rawYtTitle)
        ? await translateCJKTitleIfNeeded(rawYtTitle)
        : rawYtTitle;
      return {
        url: parsedUrl.toString(),
        domain,
        title: finalYtTitle,
        description: resolvedChannelName
          ? `YouTube video by ${resolvedChannelName} (${canonicalWatchUrl}).`
          : `YouTube video clip (${canonicalWatchUrl}).`,
        image_url: `https://i.ytimg.com/vi/${ytVideoId}/hqdefault.jpg`,
        favicon: 'https://www.youtube.com/favicon.ico',
        reading_minutes: resolvedDurationSec
          ? Math.max(1, Math.round(resolvedDurationSec / 60))
          : 5,
        video_duration: resolvedDurationSec
          ? formatVideoDuration(resolvedDurationSec)
          : null,
        channel_name: resolvedChannelName,
        scrape_status: 'ok',
        diagnostics: 'YouTube video metadata and duration resolved via Innertube player API.',
      };
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
        video_duration: null,
        channel_name: null,
        scrape_status: 'degraded',
        diagnostics: `HTTP ${response.status} response from origin; degraded gracefully.`,
      };
    }

    const html = await response.text();
    const parsedMeta = parseHtmlMetadata(html, parsedUrl.toString());
    if (containsCJK(parsedMeta.title)) {
      parsedMeta.title = await translateCJKTitleIfNeeded(parsedMeta.title);
    }
    return parsedMeta;
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
      video_duration: null,
      channel_name: null,
      scrape_status: 'degraded',
      diagnostics: `Scraper fallback triggered: ${reason}`,
    };
  }
}
