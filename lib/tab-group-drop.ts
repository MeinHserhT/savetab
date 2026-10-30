import { TabGroupColor } from './types';

export interface ParsedTabItem {
  url: string;
  title?: string;
}

export interface ParsedTabGroupDrop {
  groupName?: string;
  color?: TabGroupColor;
  tabs: ParsedTabItem[];
  isGroupPayload: boolean;
}

const VALID_COLORS: TabGroupColor[] = [
  'blue',
  'cyan',
  'emerald',
  'amber',
  'orange',
  'red',
  'rose',
  'purple',
  'indigo',
  'zinc',
];

const CHROME_COLOR_MAP: Record<string, TabGroupColor> = {
  grey: 'zinc',
  gray: 'zinc',
  zinc: 'zinc',
  blue: 'blue',
  red: 'red',
  yellow: 'amber',
  amber: 'amber',
  green: 'emerald',
  emerald: 'emerald',
  pink: 'rose',
  rose: 'rose',
  purple: 'purple',
  cyan: 'cyan',
  orange: 'orange',
  indigo: 'indigo',
};

export function mapChromeColorToTabGroupColor(
  chromeColor?: string | null
): TabGroupColor | undefined {
  if (!chromeColor) return undefined;
  const key = chromeColor.trim().toLowerCase();
  return CHROME_COLOR_MAP[key];
}

export function pickNextTabGroupColor(existingCount: number): TabGroupColor {
  return VALID_COLORS[Math.abs(existingCount) % VALID_COLORS.length] ?? 'blue';
}

function normalizeCandidateUrl(raw: string): string | null {
  const trimmed = raw
    .trim()
    .replace(/^[<("']+/, '')
    .replace(/[>)"',;]+$/, '');
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .trim();
}

function tryParseJsonGroupPayload(raw: string): ParsedTabGroupDrop | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      const tabs: ParsedTabItem[] = [];
      const seen = new Set<string>();
      for (const item of parsed) {
        const candidateUrl =
          typeof item === 'string'
            ? normalizeCandidateUrl(item)
            : typeof item?.url === 'string'
            ? normalizeCandidateUrl(item.url)
            : null;
        if (candidateUrl && !seen.has(candidateUrl)) {
          seen.add(candidateUrl);
          tabs.push({
            url: candidateUrl,
            title:
              typeof item?.title === 'string' && item.title.trim()
                ? item.title.trim()
                : undefined,
          });
        }
      }
      if (tabs.length > 0) {
        return {
          tabs,
          isGroupPayload: true,
        };
      }
      return null;
    }

    if (parsed && typeof parsed === 'object') {
      const rawTabs = Array.isArray(parsed.tabs)
        ? parsed.tabs
        : Array.isArray(parsed.links)
        ? parsed.links
        : Array.isArray(parsed.urls)
        ? parsed.urls
        : null;

      if (!rawTabs) return null;

      const tabs: ParsedTabItem[] = [];
      const seen = new Set<string>();
      for (const item of rawTabs) {
        const candidateUrl =
          typeof item === 'string'
            ? normalizeCandidateUrl(item)
            : typeof item?.url === 'string'
            ? normalizeCandidateUrl(item.url)
            : null;
        if (candidateUrl && !seen.has(candidateUrl)) {
          seen.add(candidateUrl);
          tabs.push({
            url: candidateUrl,
            title:
              typeof item?.title === 'string' && item.title.trim()
                ? item.title.trim()
                : undefined,
          });
        }
      }

      const groupName =
        typeof parsed.name === 'string' && parsed.name.trim()
          ? parsed.name.trim()
          : typeof parsed.groupName === 'string' && parsed.groupName.trim()
          ? parsed.groupName.trim()
          : typeof parsed.title === 'string' && parsed.title.trim()
          ? parsed.title.trim()
          : undefined;

      const color = mapChromeColorToTabGroupColor(
        typeof parsed.color === 'string' ? parsed.color : undefined
      );

      if (tabs.length > 0 || groupName) {
        return {
          groupName,
          color,
          tabs,
          isGroupPayload: true,
        };
      }
    }
  } catch {
    // Not a JSON payload
  }
  return null;
}

function parseHtmlBookmarkOrAnchors(html: string): {
  groupName?: string;
  color?: TabGroupColor;
  tabs: ParsedTabItem[];
  hasFolderHeading: boolean;
} {
  const tabs: ParsedTabItem[] = [];
  const seen = new Set<string>();

  // Check for custom data-tabflow-group attributes on container or anchor
  const groupAttrMatch = html.match(/data-tabflow-group-name=["']([^"']+)["']/i);
  const colorAttrMatch = html.match(/data-tabflow-group-color=["']([^"']+)["']/i);
  const h3Match = html.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i);

  const groupName = groupAttrMatch?.[1]
    ? decodeHtmlEntities(groupAttrMatch[1])
    : h3Match?.[1]
    ? decodeHtmlEntities(h3Match[1].replace(/<[^>]+>/g, ''))
    : undefined;

  const color = colorAttrMatch?.[1]
    ? mapChromeColorToTabGroupColor(colorAttrMatch[1])
    : undefined;

  const anchorRegex = /<a\b[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorRegex.exec(html)) !== null) {
    const validUrl = normalizeCandidateUrl(match[1]);
    if (!validUrl || seen.has(validUrl)) continue;
    seen.add(validUrl);
    const rawTitle = decodeHtmlEntities(match[2].replace(/<[^>]+>/g, ''));
    tabs.push({
      url: validUrl,
      title: rawTitle && rawTitle !== validUrl ? rawTitle : undefined,
    });
  }

  return {
    groupName: groupName || undefined,
    color,
    tabs,
    hasFolderHeading: Boolean(groupName),
  };
}

function extractUrlsFromText(text: string): ParsedTabItem[] {
  const tabs: ParsedTabItem[] = [];
  const seen = new Set<string>();

  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    // Support Markdown format: [Title](https://example.com) or "Title - https://example.com"
    const mdMatch = line.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/i);
    if (mdMatch) {
      const validUrl = normalizeCandidateUrl(mdMatch[2]);
      if (validUrl && !seen.has(validUrl)) {
        seen.add(validUrl);
        tabs.push({
          url: validUrl,
          title: mdMatch[1].trim() || undefined,
        });
        continue;
      }
    }

    const urlMatches = line.match(/https?:\/\/[^\s<>"']+/gi);
    if (urlMatches) {
      for (const rawUrl of urlMatches) {
        const validUrl = normalizeCandidateUrl(rawUrl);
        if (!validUrl || seen.has(validUrl)) continue;
        seen.add(validUrl);

        // If line had text before the URL (e.g. "YouTube - https://youtube.com/..."), use as title
        const titleCandidate = line
          .replace(rawUrl, '')
          .replace(/^[\s\-–—:|•*]+|[\s\-–—:|•*]+$/g, '')
          .trim();

        tabs.push({
          url: validUrl,
          title:
            titleCandidate &&
            titleCandidate.length >= 2 &&
            titleCandidate.length <= 160 &&
            !titleCandidate.startsWith('http')
              ? titleCandidate
              : undefined,
        });
      }
    }
  }

  return tabs;
}

export function parseTabGroupFromTextOrHtml(
  rawText: string,
  rawHtml?: string,
  customGroupJson?: string,
  uriList?: string,
  directUrl?: string
): ParsedTabGroupDrop {
  // 1. Check dedicated custom MIME JSON payload
  if (customGroupJson) {
    const parsedCustom = tryParseJsonGroupPayload(customGroupJson);
    if (parsedCustom && parsedCustom.tabs.length > 0) {
      return parsedCustom;
    }
  }

  // 2. Check if rawText is JSON payload from extension or clipboard
  if (rawText) {
    const parsedJson = tryParseJsonGroupPayload(rawText);
    if (parsedJson && parsedJson.tabs.length > 0) {
      return parsedJson;
    }
  }

  // 3. Check HTML payload (Chrome Bookmark folder drag, multi-anchor selection, or extension drag card)
  const htmlResult = rawHtml ? parseHtmlBookmarkOrAnchors(rawHtml) : null;

  // 4. Extract URLs from uri-list and plain text
  const textTabs = extractUrlsFromText(
    [uriList || '', rawText || '', directUrl || ''].filter(Boolean).join('\n')
  );

  if (htmlResult && htmlResult.tabs.length > 0) {
    // Merge any additional URLs from textTabs while keeping HTML titles
    const merged: ParsedTabItem[] = [...htmlResult.tabs];
    const seen = new Set(merged.map((t) => t.url));
    for (const item of textTabs) {
      if (!seen.has(item.url)) {
        seen.add(item.url);
        merged.push(item);
      }
    }
    return {
      groupName: htmlResult.groupName,
      color: htmlResult.color,
      tabs: merged,
      isGroupPayload: htmlResult.hasFolderHeading || merged.length > 1,
    };
  }

  // 5. Fallback if rawText itself contains HTML bookmark markup pasted into textarea
  if (rawText && /<a\b[^>]*href=/i.test(rawText)) {
    const pastedHtmlResult = parseHtmlBookmarkOrAnchors(rawText);
    if (pastedHtmlResult.tabs.length > 0) {
      return {
        groupName: pastedHtmlResult.groupName,
        color: pastedHtmlResult.color,
        tabs: pastedHtmlResult.tabs,
        isGroupPayload:
          pastedHtmlResult.hasFolderHeading ||
          pastedHtmlResult.tabs.length > 1,
      };
    }
  }

  return {
    tabs: textTabs,
    isGroupPayload: textTabs.length > 1,
  };
}

export function parseTabGroupFromDataTransfer(
  dataTransfer: DataTransfer
): ParsedTabGroupDrop {
  const customGroupJson = dataTransfer.getData('application/x-tabflow-tabgroup');
  const rawHtml = dataTransfer.getData('text/html');
  const uriList = dataTransfer.getData('text/uri-list');
  const directUrl = dataTransfer.getData('URL');
  const rawText = dataTransfer.getData('text/plain');

  return parseTabGroupFromTextOrHtml(
    rawText,
    rawHtml,
    customGroupJson,
    uriList,
    directUrl
  );
}

export function inferDefaultGroupName(
  parsed: ParsedTabGroupDrop,
  fallbackLabel: string
): string {
  if (parsed.groupName && parsed.groupName.trim()) {
    return parsed.groupName.trim().slice(0, 100);
  }

  if (parsed.tabs.length > 0) {
    const hostnames = parsed.tabs
      .map((item) => {
        try {
          return new URL(item.url).hostname.replace(/^www\./i, '');
        } catch {
          return '';
        }
      })
      .filter(Boolean);

    if (hostnames.length > 0) {
      const uniqueHosts = Array.from(new Set(hostnames));
      if (uniqueHosts.length === 1) {
        const host = uniqueHosts[0];
        const brandPart = host.split('.')[0] || host;
        const capitalized =
          brandPart.charAt(0).toUpperCase() + brandPart.slice(1);
        return parsed.tabs.length > 1
          ? `${capitalized} (${parsed.tabs.length})`
          : capitalized;
      }
    }
  }

  return fallbackLabel;
}
