import { Folder, LinkItem } from './types';

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getDescendantFolderIds(folders: Folder[], rootFolderId: string): Set<string> {
  const result = new Set<string>([rootFolderId]);
  let added = true;
  while (added) {
    added = false;
    for (const folder of folders) {
      if (folder.parent_id && result.has(folder.parent_id) && !result.has(folder.id)) {
        result.add(folder.id);
        added = true;
      }
    }
  }
  return result;
}

const LEGACY_MOCK_LINK_URLS = new Set([
  'https://grid-systems.ch/essays/muller-brockmann-modular-proportions',
  'https://raft.github.io/papers/raft-extended-linearizability.pdf',
  'https://inkandswitch.com/local-first/crdt-automerge-sync',
  'https://v8.dev/blog/liftoff-wasm-baseline-simd-pipeline',
  'https://w3c.github.io/design-tokens/format-specification',
  'https://arxiv.org/abs/2312.11805',
]);

const LEGACY_SEED_FOLDER_NAMES = new Set([
  'Distributed Systems',
  'Compilers & Runtime',
  'UI & Design Systems',
  'Reading Later',
  'AI Research',
  'Alpha Private Group',
]);

export function isLegacyMockLink(link: {
  id?: unknown;
  url?: unknown;
  image_url?: unknown;
  favicon?: unknown;
}): boolean {
  const url = typeof link.url === 'string' ? link.url.trim() : '';
  if (LEGACY_MOCK_LINK_URLS.has(url)) return true;
  if (
    typeof link.image_url === 'string' &&
    link.image_url.startsWith('/covers/')
  ) {
    return true;
  }
  if (typeof link.favicon === 'string' && link.favicon.startsWith('/covers/')) {
    return true;
  }
  return typeof link.id === 'string' && /^lnk-0[1-5](-|$)/.test(link.id);
}

export function isLegacySeedFolder(folder: {
  id?: unknown;
  name?: unknown;
}): boolean {
  const id = typeof folder.id === 'string' ? folder.id.trim() : '';
  const name = typeof folder.name === 'string' ? folder.name.trim() : '';
  if (
    id.startsWith('fld-dist') ||
    id.startsWith('fld-compilers') ||
    id.startsWith('fld-swiss') ||
    id.startsWith('fld-eng')
  ) {
    return true;
  }
  return LEGACY_SEED_FOLDER_NAMES.has(name);
}

export function isYouTubeLink(url: string, domain?: string): boolean {
  const lowerDomain = (domain || '').toLowerCase();
  const lowerUrl = (url || '').toLowerCase();
  return (
    lowerDomain === 'youtube.com' ||
    lowerDomain.endsWith('.youtube.com') ||
    lowerDomain === 'youtu.be' ||
    lowerDomain === 'youtube-nocookie.com' ||
    lowerUrl.includes('youtube.com/') ||
    lowerUrl.includes('youtu.be/')
  );
}

export function resolveYouTubeChannelFromLink(link: {
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

export function normalizeLinkSourceDomain(
  link: Pick<LinkItem, 'url' | 'domain'>
): string {
  const rawDomain = (link.domain || '').trim();
  if (rawDomain) {
    return rawDomain.replace(/^(www|m)\./i, '').toLowerCase();
  }
  try {
    const parsed = new URL(link.url);
    return parsed.hostname.replace(/^(www|m)\./i, '').toLowerCase();
  } catch {
    return 'unknown';
  }
}

export interface TabSubGroup {
  key: string;
  label: string;
  kind: 'youtube-channel' | 'domain';
  favicon: string | null;
  domain: string;
  links: LinkItem[];
}

export type ClusteredGroupItem =
  | { type: 'subgroup'; subGroup: TabSubGroup }
  | { type: 'link'; link: LinkItem };

export interface ClusteredGroupResult {
  subGroups: TabSubGroup[];
  standaloneLinks: LinkItem[];
  items: ClusteredGroupItem[];
}

const TRACKING_QUERY_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'fbclid',
  'gclid',
  'msclkid',
  'si',
  'feature',
  'pp',
  'ref',
  'source',
  'igshid',
  'mc_cid',
  'mc_eid',
]);

function extractCanonicalYouTubeVideoId(parsed: URL, host: string): string | null {
  if (host === 'youtu.be') {
    const id = parsed.pathname.split('/').filter(Boolean)[0];
    return id && id.length >= 6 ? id : null;
  }
  if (
    host === 'youtube.com' ||
    host.endsWith('.youtube.com') ||
    host === 'youtube-nocookie.com'
  ) {
    const vParam = parsed.searchParams.get('v');
    if (vParam && vParam.trim()) {
      return vParam.trim();
    }
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (
      parts.length >= 2 &&
      (parts[0] === 'shorts' ||
        parts[0] === 'embed' ||
        parts[0] === 'live' ||
        parts[0] === 'v')
    ) {
      return parts[1];
    }
  }
  return null;
}

export function extractYouTubeVideoIdFromUrl(rawUrl: string): string | null {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return null;
  try {
    const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed);
    const candidate = hasScheme ? trimmed : `https://${trimmed}`;
    const parsed = new URL(candidate);
    const host = parsed.hostname
      .replace(/^(www|m|mobile)\./i, '')
      .toLowerCase();
    return extractCanonicalYouTubeVideoId(parsed, host);
  } catch {
    return null;
  }
}

export function normalizeLinkUrlKey(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';
  try {
    const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed);
    const candidate = hasScheme ? trimmed : `https://${trimmed}`;
    const parsed = new URL(candidate);
    const host = parsed.hostname
      .replace(/^(www|m|mobile)\./i, '')
      .toLowerCase();
    const ytId = extractCanonicalYouTubeVideoId(parsed, host);
    if (ytId) {
      return `youtube.com/watch?v=${ytId}`;
    }

    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    const keptParams: Array<[string, string]> = [];
    parsed.searchParams.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (!TRACKING_QUERY_PARAMS.has(lowerKey)) {
        keptParams.push([lowerKey, value]);
      }
    });
    keptParams.sort((a, b) =>
      a[0] !== b[0] ? a[0].localeCompare(b[0]) : a[1].localeCompare(b[1])
    );
    const queryString =
      keptParams.length > 0
        ? `?${keptParams
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join('&')}`
        : '';

    return `${host}${path}${queryString}`.toLowerCase();
  } catch {
    return trimmed
      .replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '')
      .replace(/^(www|m|mobile)\./i, '')
      .replace(/\/+$/, '')
      .toLowerCase();
  }
}

export function getLinkSourceBucketKey(
  link: Pick<LinkItem, 'id' | 'url' | 'domain' | 'channel_name' | 'description'>
): string {
  const isYt = isYouTubeLink(link.url, link.domain);
  if (isYt) {
    const channelName = resolveYouTubeChannelFromLink(link);
    if (channelName) {
      return `yt-channel:${channelName.toLowerCase()}`;
    }
    const urlKey = normalizeLinkUrlKey(link.url);
    return urlKey ? `yt-url:${urlKey}` : `yt-unresolved:${link.id}`;
  }
  const normDomain = normalizeLinkSourceDomain(link);
  return `domain:${normDomain}`;
}

export function isConsolidatableSourceBucketKey(bucketKey: string): boolean {
  if (!bucketKey) return false;
  if (bucketKey.startsWith('yt-channel:')) {
    return bucketKey.slice('yt-channel:'.length).trim().length > 0;
  }
  if (bucketKey.startsWith('yt-url:')) {
    return bucketKey.slice('yt-url:'.length).trim().length > 0;
  }
  if (bucketKey.startsWith('domain:')) {
    const domain = bucketKey.slice('domain:'.length).trim();
    return Boolean(domain && domain !== 'unknown');
  }
  return false;
}

function compareLinksByFirstAppearance(
  a: LinkItem,
  b: LinkItem,
  folderOrderMap: ReadonlyMap<string, number>
): number {
  const timeA = a.created_at ? Date.parse(a.created_at) : NaN;
  const timeB = b.created_at ? Date.parse(b.created_at) : NaN;
  if (Number.isFinite(timeA) && Number.isFinite(timeB) && timeA !== timeB) {
    return timeA - timeB;
  }
  if (a.created_at && b.created_at && a.created_at !== b.created_at) {
    return a.created_at.localeCompare(b.created_at);
  }
  const folderOrderA = a.folder_id
    ? (folderOrderMap.get(a.folder_id) ?? Number.MAX_SAFE_INTEGER)
    : Number.MAX_SAFE_INTEGER;
  const folderOrderB = b.folder_id
    ? (folderOrderMap.get(b.folder_id) ?? Number.MAX_SAFE_INTEGER)
    : Number.MAX_SAFE_INTEGER;
  if (folderOrderA !== folderOrderB) {
    return folderOrderA - folderOrderB;
  }
  if (a.order_index !== b.order_index) {
    return a.order_index - b.order_index;
  }
  return a.id.localeCompare(b.id);
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

export function isPlaceholderLikeTitle(
  title: string | null | undefined,
  domain?: string
): boolean {
  const trimmed = (title || '').trim().toLowerCase();
  if (trimmed.length <= 1) return true;
  if (
    GENERIC_PLACEHOLDER_TITLES.has(trimmed) ||
    trimmed.startsWith('youtube clip (')
  ) {
    return true;
  }
  if (domain && trimmed === domain.trim().toLowerCase()) {
    return true;
  }
  return false;
}

function mergeDuplicateLinkMetadata(kept: LinkItem, duplicate: LinkItem): {
  merged: LinkItem;
  changed: boolean;
} {
  let changed = false;
  const next: LinkItem = { ...kept };

  if (
    isPlaceholderLikeTitle(kept.title, kept.domain) &&
    !isPlaceholderLikeTitle(duplicate.title, duplicate.domain) &&
    duplicate.title.trim()
  ) {
    next.title = duplicate.title;
    changed = true;
  }

  const keptChannel = resolveYouTubeChannelFromLink(kept);
  const dupChannel = resolveYouTubeChannelFromLink(duplicate);
  if (!keptChannel && dupChannel) {
    next.channel_name = dupChannel;
    changed = true;
  }

  if (!kept.video_duration && duplicate.video_duration) {
    next.video_duration = duplicate.video_duration;
    changed = true;
  }

  if (!kept.image_url && duplicate.image_url) {
    next.image_url = duplicate.image_url;
    changed = true;
  }

  if (!kept.favicon && duplicate.favicon) {
    next.favicon = duplicate.favicon;
    changed = true;
  }

  if (
    (!kept.description || kept.description.startsWith('Saved web reference')) &&
    duplicate.description &&
    !duplicate.description.startsWith('Saved web reference')
  ) {
    next.description = duplicate.description;
    changed = true;
  }

  return { merged: next, changed };
}

/**
 * Finds the earliest existing tab with the exact same normalized URL key.
 */
export function findDuplicateLinkByUrl(
  rawUrl: string,
  existingLinks: LinkItem[],
  folders: Folder[] = [],
  excludeLinkId?: string
): LinkItem | null {
  const targetKey = normalizeLinkUrlKey(rawUrl);
  if (!targetKey) return null;

  const folderOrderMap = new Map<string, number>();
  folders.forEach((folder, idx) => {
    folderOrderMap.set(folder.id, folder.order_index ?? idx);
  });

  const matches = existingLinks.filter((item) => {
    if (excludeLinkId && item.id === excludeLinkId) return false;
    return normalizeLinkUrlKey(item.url) === targetKey;
  });

  if (matches.length === 0) return null;

  matches.sort((a, b) => compareLinksByFirstAppearance(a, b, folderOrderMap));
  return matches[0] ?? null;
}

export interface DeduplicateLinksResult {
  links: LinkItem[];
  removedLinks: LinkItem[];
  updatedKeptLinks: LinkItem[];
}

/**
 * Removes duplicate tabs (both old and newly added) that share the same normalized URL.
 * Keeps the earliest tab, merges any richer metadata from duplicates into the kept tab,
 * and normalizes contiguous 0..n-1 `order_index` values in each group lane.
 */
export function deduplicateLinks(
  allLinks: LinkItem[],
  folders: Folder[] = []
): DeduplicateLinksResult {
  if (allLinks.length <= 1) {
    return { links: allLinks, removedLinks: [], updatedKeptLinks: [] };
  }

  const folderOrderMap = new Map<string, number>();
  folders.forEach((folder, idx) => {
    folderOrderMap.set(folder.id, folder.order_index ?? idx);
  });

  const sortedByAppearance = allLinks
    .slice()
    .sort((a, b) => compareLinksByFirstAppearance(a, b, folderOrderMap));

  const keptByUrlKey = new Map<string, LinkItem>();
  const changedKeptIds = new Set<string>();
  const removedLinks: LinkItem[] = [];
  const removedIds = new Set<string>();

  for (const link of sortedByAppearance) {
    const urlKey = normalizeLinkUrlKey(link.url);
    if (!urlKey) {
      keptByUrlKey.set(`__id__:${link.id}`, link);
      continue;
    }

    const existingKept = keptByUrlKey.get(urlKey);
    if (!existingKept) {
      keptByUrlKey.set(urlKey, link);
    } else {
      removedLinks.push(link);
      removedIds.add(link.id);
      const { merged, changed } = mergeDuplicateLinkMetadata(existingKept, link);
      if (changed) {
        keptByUrlKey.set(urlKey, merged);
        changedKeptIds.add(merged.id);
      }
    }
  }

  if (removedLinks.length === 0) {
    return { links: allLinks, removedLinks: [], updatedKeptLinks: [] };
  }

  const keptById = new Map<string, LinkItem>();
  for (const item of keptByUrlKey.values()) {
    keptById.set(item.id, item);
  }

  const getFolderLaneKey = (folderId: string | null | undefined): string =>
    folderId && folderId.trim() ? folderId.trim() : '__ungrouped__';

  const laneKeys: string[] = [];
  const laneMap = new Map<string, LinkItem[]>();
  for (const link of allLinks) {
    if (removedIds.has(link.id)) continue;
    const updatedItem = keptById.get(link.id) ?? link;
    const key = getFolderLaneKey(updatedItem.folder_id);
    if (!laneMap.has(key)) {
      laneKeys.push(key);
      laneMap.set(key, []);
    }
    laneMap.get(key)!.push(updatedItem);
  }

  const normalizedLinks: LinkItem[] = [];
  const updatedKeptLinks: LinkItem[] = [];

  for (const key of laneKeys) {
    const laneItems = sortGroupLinks(laneMap.get(key) ?? []);
    laneItems.forEach((item, idx) => {
      const normalizedItem =
        item.order_index !== idx ? { ...item, order_index: idx } : item;
      normalizedLinks.push(normalizedItem);
      if (changedKeptIds.has(item.id)) {
        updatedKeptLinks.push(normalizedItem);
      }
    });
  }

  return {
    links: normalizedLinks,
    removedLinks,
    updatedKeptLinks,
  };
}

/**
 * Finds the existing group (folder_id) where a candidate link's YouTube channel
 * or website domain appeared first. Returns null if no existing group has a matching tab.
 */
export function findExistingGroupForLinkSource(
  candidateLink: Pick<
    LinkItem,
    'id' | 'url' | 'domain' | 'channel_name' | 'description'
  >,
  existingLinks: LinkItem[],
  folders: Folder[] = [],
  excludeLinkId?: string
): string | null {
  const bucketKey = getLinkSourceBucketKey(candidateLink);
  if (!isConsolidatableSourceBucketKey(bucketKey)) {
    return null;
  }

  const validFolderIds = new Set(folders.map((f) => f.id));
  const folderOrderMap = new Map<string, number>();
  folders.forEach((folder, idx) => {
    folderOrderMap.set(folder.id, folder.order_index ?? idx);
  });

  const candidateUrlKey = normalizeLinkUrlKey(candidateLink.url);

  const matchingLinks = existingLinks.filter((item) => {
    if (item.id === candidateLink.id || (excludeLinkId && item.id === excludeLinkId)) {
      return false;
    }
    if (!item.folder_id || !item.folder_id.trim()) {
      return false;
    }
    if (validFolderIds.size > 0 && !validFolderIds.has(item.folder_id)) {
      return false;
    }
    const itemBucketKey = getLinkSourceBucketKey(item);
    if (itemBucketKey === bucketKey) {
      return true;
    }
    if (candidateUrlKey && normalizeLinkUrlKey(item.url) === candidateUrlKey) {
      return true;
    }
    return false;
  });

  if (matchingLinks.length === 0) {
    return null;
  }

  const sortedMatches = matchingLinks
    .slice()
    .sort((a, b) => compareLinksByFirstAppearance(a, b, folderOrderMap));

  return sortedMatches[0]?.folder_id ?? null;
}

export interface ConsolidateLinksResult {
  links: LinkItem[];
  movedLinks: Array<{
    linkId: string;
    fromFolderId: string | null;
    toFolderId: string;
  }>;
  removedDuplicateLinks: LinkItem[];
  updatedKeptLinks: LinkItem[];
}

/**
 * Deduplicates identical URLs (removing old and new duplicates) and consolidates
 * tabs across groups so that any tabs sharing the same YouTube channel
 * or website domain are grouped together into the existing group where that channel
 * or domain appeared first.
 */
export function consolidateLinksAcrossGroups(
  allLinks: LinkItem[],
  folders: Folder[] = [],
  pinnedLinkIds?: ReadonlySet<string>
): ConsolidateLinksResult {
  if (allLinks.length <= 1) {
    return {
      links: allLinks,
      movedLinks: [],
      removedDuplicateLinks: [],
      updatedKeptLinks: [],
    };
  }

  const deduplicated = deduplicateLinks(allLinks, folders);
  const workingLinks = deduplicated.links;

  if (workingLinks.length <= 1) {
    return {
      links: workingLinks,
      movedLinks: [],
      removedDuplicateLinks: deduplicated.removedLinks,
      updatedKeptLinks: deduplicated.updatedKeptLinks,
    };
  }

  const validFolderIds = new Set(folders.map((f) => f.id));
  const folderOrderMap = new Map<string, number>();
  folders.forEach((folder, idx) => {
    folderOrderMap.set(folder.id, folder.order_index ?? idx);
  });

  const buckets = new Map<string, LinkItem[]>();
  for (const link of workingLinks) {
    if (!link.folder_id || !link.folder_id.trim()) continue;
    if (validFolderIds.size > 0 && !validFolderIds.has(link.folder_id)) continue;

    const bucketKey = getLinkSourceBucketKey(link);
    if (!isConsolidatableSourceBucketKey(bucketKey)) continue;

    const list = buckets.get(bucketKey);
    if (list) {
      list.push(link);
    } else {
      buckets.set(bucketKey, [link]);
    }
  }

  const targetFolderByLinkId = new Map<string, string>();
  const movedLinks: Array<{
    linkId: string;
    fromFolderId: string | null;
    toFolderId: string;
  }> = [];

  for (const bucketLinks of buckets.values()) {
    if (bucketLinks.length < 2) continue;

    const sortedByAppearance = bucketLinks
      .slice()
      .sort((a, b) => compareLinksByFirstAppearance(a, b, folderOrderMap));

    const canonicalFolderId = sortedByAppearance[0]?.folder_id;
    if (!canonicalFolderId) continue;

    for (const item of sortedByAppearance.slice(1)) {
      if (pinnedLinkIds?.has(item.id)) continue;
      if (item.folder_id && item.folder_id !== canonicalFolderId) {
        targetFolderByLinkId.set(item.id, canonicalFolderId);
        movedLinks.push({
          linkId: item.id,
          fromFolderId: item.folder_id,
          toFolderId: canonicalFolderId,
        });
      }
    }
  }

  if (movedLinks.length === 0) {
    return {
      links: workingLinks,
      movedLinks: [],
      removedDuplicateLinks: deduplicated.removedLinks,
      updatedKeptLinks: deduplicated.updatedKeptLinks,
    };
  }

  let nextLinks = workingLinks.slice();
  for (const move of movedLinks) {
    const destFolderId = targetFolderByLinkId.get(move.linkId);
    if (!destFolderId) continue;
    nextLinks = moveAndReorderGroupLinks(nextLinks, {
      linkId: move.linkId,
      targetFolderId: destFolderId,
      position: 'after',
    });
  }

  return {
    links: nextLinks,
    movedLinks,
    removedDuplicateLinks: deduplicated.removedLinks,
    updatedKeptLinks: deduplicated.updatedKeptLinks,
  };
}

export function sortGroupLinks(links: LinkItem[]): LinkItem[] {
  return links.slice().sort((a, b) => {
    if (a.order_index !== b.order_index) {
      return a.order_index - b.order_index;
    }
    return a.created_at.localeCompare(b.created_at);
  });
}

export interface MoveAndReorderGroupLinkOptions {
  linkId: string;
  targetFolderId: string | null;
  targetLinkId?: string | null;
  position?: 'before' | 'after';
  targetIndex?: number;
}

/**
 * Pure deterministic transition for moving a link within the same Kanban lane (folder)
 * or across different Kanban lanes while normalizing contiguous 0..n-1 `order_index`
 * values in each affected lane.
 */
export function moveAndReorderGroupLinks(
  allLinks: LinkItem[],
  options: MoveAndReorderGroupLinkOptions
): LinkItem[] {
  const movingLink = allLinks.find((item) => item.id === options.linkId);
  if (!movingLink) {
    return allLinks;
  }

  const getFolderLaneKey = (folderId: string | null | undefined): string =>
    folderId && folderId.trim() ? folderId.trim() : '__ungrouped__';

  const targetLaneKey = getFolderLaneKey(options.targetFolderId);
  const resolvedTargetFolderId =
    targetLaneKey === '__ungrouped__' ? null : targetLaneKey;

  // Collect all distinct lane keys in deterministic order
  const laneKeys: string[] = [];
  const laneMap = new Map<string, LinkItem[]>();

  const ensureLane = (key: string) => {
    if (!laneMap.has(key)) {
      laneKeys.push(key);
      laneMap.set(key, []);
    }
  };

  for (const link of allLinks) {
    const key = getFolderLaneKey(link.folder_id);
    ensureLane(key);
    laneMap.get(key)!.push(link);
  }
  ensureLane(targetLaneKey);

  // Sort every lane by current order_index and remove the moving link from its source lane
  for (const key of laneKeys) {
    const sorted = sortGroupLinks(laneMap.get(key) ?? []).filter(
      (item) => item.id !== options.linkId
    );
    laneMap.set(key, sorted);
  }

  const destList = laneMap.get(targetLaneKey) ?? [];
  const nowIso = new Date().toISOString();
  const transitionedLink: LinkItem = {
    ...movingLink,
    folder_id: resolvedTargetFolderId,
    updated_at: nowIso,
  };

  let insertIndex = destList.length;

  if (options.targetLinkId && options.targetLinkId !== options.linkId) {
    const rawTargetIdx = destList.findIndex(
      (item) => item.id === options.targetLinkId
    );
    if (rawTargetIdx !== -1) {
      const targetLink = destList[rawTargetIdx];
      const targetBucketKey = getLinkSourceBucketKey(targetLink);
      const movingBucketKey = getLinkSourceBucketKey(transitionedLink);
      const bucketMatchesInDest = destList.filter(
        (item) => getLinkSourceBucketKey(item) === targetBucketKey
      );

      // If targetLink belongs to a multi-link sub-group and the moving link has a different source bucket,
      // place the moving link cleanly before the first item or after the last item of that sub-group
      // so visual order matches the rendered sub-group block.
      if (
        bucketMatchesInDest.length >= 2 &&
        movingBucketKey !== targetBucketKey
      ) {
        if (options.position === 'before') {
          const firstIdx = destList.findIndex(
            (item) => getLinkSourceBucketKey(item) === targetBucketKey
          );
          insertIndex = firstIdx !== -1 ? firstIdx : rawTargetIdx;
        } else {
          let lastIdx = rawTargetIdx;
          for (let i = destList.length - 1; i >= 0; i--) {
            if (getLinkSourceBucketKey(destList[i]) === targetBucketKey) {
              lastIdx = i;
              break;
            }
          }
          insertIndex = lastIdx + 1;
        }
      } else {
        insertIndex =
          options.position === 'after' ? rawTargetIdx + 1 : rawTargetIdx;
      }
    } else if (options.position === 'before') {
      insertIndex = 0;
    }
  } else if (typeof options.targetIndex === 'number') {
    insertIndex = Math.max(0, Math.min(destList.length, options.targetIndex));
  } else if (options.position === 'before') {
    insertIndex = 0;
  }

  destList.splice(insertIndex, 0, transitionedLink);
  laneMap.set(targetLaneKey, destList);

  const normalizedById = new Map<string, LinkItem>();
  for (const key of laneKeys) {
    const list = laneMap.get(key) ?? [];
    list.forEach((item, idx) => {
      normalizedById.set(item.id, {
        ...item,
        order_index: idx,
      });
    });
  }

  // Return links ordered by lane and order_index
  const result: LinkItem[] = [];
  for (const key of laneKeys) {
    const list = laneMap.get(key) ?? [];
    for (const item of list) {
      const normalized = normalizedById.get(item.id);
      if (normalized) {
        result.push(normalized);
      }
    }
  }

  return result;
}

/**
 * Clusters tabs inside a single Tab Group column into Sub-Groups when there are
 * >= 2 tabs from the same YouTube channel/video (for YouTube links) or the same website domain
 * (for general web links). Sub-groups are always sorted to the top of `items` above
 * single-occurrence `standaloneLinks`.
 */
export function clusterGroupLinksBySource(
  groupLinks: LinkItem[]
): ClusteredGroupResult {
  const sortedLinks = sortGroupLinks(groupLinks);
  const buckets = new Map<
    string,
    {
      key: string;
      label: string;
      kind: 'youtube-channel' | 'domain';
      favicon: string | null;
      domain: string;
      links: LinkItem[];
    }
  >();

  for (const link of sortedLinks) {
    const isYt = isYouTubeLink(link.url, link.domain);
    if (isYt) {
      const channelName = resolveYouTubeChannelFromLink(link);
      if (channelName) {
        const normalizedKey = `yt-channel:${channelName.toLowerCase()}`;
        const existing = buckets.get(normalizedKey);
        if (existing) {
          existing.links.push(link);
        } else {
          buckets.set(normalizedKey, {
            key: normalizedKey,
            label: channelName,
            kind: 'youtube-channel',
            favicon: link.favicon || 'https://www.youtube.com/favicon.ico',
            domain: 'youtube.com',
            links: [link],
          });
        }
      } else {
        // Group identical YouTube URLs even if channel metadata is not resolved yet
        const urlKey = normalizeLinkUrlKey(link.url);
        const bucketKey = urlKey ? `yt-url:${urlKey}` : `yt-unresolved:${link.id}`;
        const existing = buckets.get(bucketKey);
        if (existing) {
          existing.links.push(link);
        } else {
          buckets.set(bucketKey, {
            key: bucketKey,
            label: link.title || link.domain || 'youtube.com',
            kind: 'youtube-channel',
            favicon: link.favicon || 'https://www.youtube.com/favicon.ico',
            domain: 'youtube.com',
            links: [link],
          });
        }
      }
    } else {
      const normDomain = normalizeLinkSourceDomain(link);
      const domainKey = `domain:${normDomain}`;
      const existing = buckets.get(domainKey);
      if (existing) {
        existing.links.push(link);
        if (!existing.favicon && link.favicon) {
          existing.favicon = link.favicon;
        }
      } else {
        buckets.set(domainKey, {
          key: domainKey,
          label: normDomain,
          kind: 'domain',
          favicon: link.favicon || null,
          domain: normDomain,
          links: [link],
        });
      }
    }
  }

  const subGroups: TabSubGroup[] = [];
  const standaloneLinks: LinkItem[] = [];

  for (const bucket of buckets.values()) {
    if (bucket.links.length >= 2) {
      subGroups.push(bucket);
    } else if (bucket.links.length === 1) {
      standaloneLinks.push(bucket.links[0]);
    }
  }

  // Sort sub-groups (same YouTube channel or same domain/link) to the top,
  // followed by standalone single links below.
  const items: ClusteredGroupItem[] = [
    ...subGroups.map(
      (subGroup): ClusteredGroupItem => ({
        type: 'subgroup',
        subGroup,
      })
    ),
    ...standaloneLinks.map(
      (link): ClusteredGroupItem => ({
        type: 'link',
        link,
      })
    ),
  ];

  return { subGroups, standaloneLinks, items };
}


