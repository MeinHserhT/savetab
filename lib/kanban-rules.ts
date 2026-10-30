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
