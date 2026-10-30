import { Folder, LinkItem, LinkStatus } from './types';

export function sortLaneLinks(links: LinkItem[], status: LinkStatus): LinkItem[] {
  return links
    .filter((item) => item.status === status)
    .slice()
    .sort((a, b) => {
      if (a.order_index !== b.order_index) {
        return a.order_index - b.order_index;
      }
      return a.created_at.localeCompare(b.created_at);
    });
}

/**
 * Pure deterministic transition for moving a card within the same lane
 * or across lanes (including into an empty lane) while normalizing
 * contiguous 0..n-1 `order_index` values in every lane.
 */
export function moveAndReorderLinks(
  allLinks: LinkItem[],
  linkId: string,
  targetStatus: LinkStatus,
  targetIndex?: number
): LinkItem[] {
  const movingLink = allLinks.find((item) => item.id === linkId);
  if (!movingLink) {
    return allLinks;
  }

  const statuses: LinkStatus[] = [
    LinkStatus.UNREAD,
    LinkStatus.READING,
    LinkStatus.ARCHIVED,
  ];

  const updatedByLane: Record<LinkStatus, LinkItem[]> = {
    [LinkStatus.UNREAD]: [],
    [LinkStatus.READING]: [],
    [LinkStatus.ARCHIVED]: [],
  };

  for (const status of statuses) {
    updatedByLane[status] = sortLaneLinks(allLinks, status).filter(
      (item) => item.id !== linkId
    );
  }

  const destinationList = updatedByLane[targetStatus];
  const clampedIndex =
    typeof targetIndex === 'number'
      ? Math.max(0, Math.min(destinationList.length, targetIndex))
      : destinationList.length;

  const transitionedLink: LinkItem = {
    ...movingLink,
    status: targetStatus,
    updated_at: new Date().toISOString(),
  };

  destinationList.splice(clampedIndex, 0, transitionedLink);

  const normalizedResult: LinkItem[] = [];
  for (const status of statuses) {
    updatedByLane[status].forEach((item, index) => {
      normalizedResult.push({
        ...item,
        order_index: index,
      });
    });
  }

  return normalizedResult;
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

export interface LinkFilterCriteria {
  folderId: string | null;
  tag: string | null;
  searchQuery: string;
}

export function filterLinks(
  links: LinkItem[],
  folders: Folder[],
  criteria: LinkFilterCriteria
): LinkItem[] {
  const allowedFolders = criteria.folderId
    ? getDescendantFolderIds(folders, criteria.folderId)
    : null;
  const normalizedQuery = criteria.searchQuery.trim().toLowerCase();

  return links.filter((link) => {
    if (allowedFolders && (!link.folder_id || !allowedFolders.has(link.folder_id))) {
      return false;
    }
    if (criteria.tag && !link.tags.includes(criteria.tag)) {
      return false;
    }
    if (normalizedQuery) {
      const haystack = `${link.title} ${link.description} ${link.domain} ${link.tags.join(' ')}`.toLowerCase();
      if (!haystack.includes(normalizedQuery)) {
        return false;
      }
    }
    return true;
  });
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

export function resolveYouTubeChannelFromLink(
  link: Pick<LinkItem, 'url' | 'domain' | 'channel_name' | 'description'>
): string | null {
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

export function normalizeLinkUrlKey(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^(www|m)\./i, '').toLowerCase();
    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    // Preserve key query params like YouTube video id `v`
    const vParam = parsed.searchParams.get('v');
    if (vParam && (host === 'youtube.com' || host.endsWith('.youtube.com'))) {
      return `youtube.com/watch?v=${vParam}`;
    }
    return `${host}${path}${parsed.search}`.toLowerCase();
  } catch {
    return trimmed.toLowerCase();
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


