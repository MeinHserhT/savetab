'use client';

import { create } from 'zustand';
import { Folder, LinkItem, LinkStatus, TabGroupColor } from '@/lib/types';
import {
  consolidateLinksAcrossGroups,
  ConsolidateLinksResult,
  extractYouTubeVideoIdFromUrl,
  findDuplicateLinkByUrl,
  findExistingGroupForLinkSource,
  moveAndReorderGroupLinks,
  normalizeLinkSourceDomain,
  normalizeLinkUrlKey,
  resolveYouTubeChannelFromLink,
} from '@/lib/kanban-rules';
import {
  getOrCreateClientUserId,
  setAuthenticatedClientUserId,
  clearAuthenticatedClientUserId,
  USER_HEADER_NAME,
} from '@/lib/user-session';
import {
  canSyncWithFirestore,
  upsertUserProfileInFirestore,
  ensureUserWorkspaceSeededInFirestore,
  subscribeToUserWorkspace,
  createFolderInFirestore,
  updateFolderInFirestore,
  deleteFolderInFirestore,
  createLinkInFirestore,
  updateLinkInFirestore,
  deleteLinkInFirestore,
} from '@/lib/firebase';

export interface AuthUserSummary {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  isAnonymous?: boolean;
}

export interface WorkspaceNotice {
  id: string;
  kind: 'same-website-grouped';
  sourceLabel: string;
  groupName: string;
  folderId?: string | null;
}

interface CreateLinkPayload {
  url: string;
  folder_id: string | null;
  tags: string[];
  status?: LinkStatus;
  title?: string;
  description?: string;
  image_url?: string | null;
  target_link_id?: string | null;
  position?: 'before' | 'after';
}

function getUserHeaders(includeJsonContentType = false): Record<string, string> {
  const uid = getOrCreateClientUserId();
  const headers: Record<string, string> = {
    [USER_HEADER_NAME]: uid,
  };
  if (includeJsonContentType) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

let activeFirestoreUnsubscribe: (() => void) | null = null;
const manuallyMovedLinkIds = new Set<string>();
const inFlightAddByUrlKey = new Map<string, Promise<LinkItem | null>>();

const VIDEO_META_STORAGE_KEY = 'tabflow_video_meta_v1';

interface CachedVideoMeta {
  video_duration?: string;
  reading_minutes?: number;
  channel_name?: string;
}

function readVideoMetaCache(): Record<string, CachedVideoMeta> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(VIDEO_META_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeVideoMetaCache(
  id: string,
  url: string | undefined,
  meta: CachedVideoMeta
): void {
  if (
    typeof window === 'undefined' ||
    (!meta.video_duration && !meta.channel_name)
  ) {
    return;
  }
  try {
    const cache = readVideoMetaCache();
    const prevById = cache[`id:${id}`] ?? {};
    const prevByUrl = url ? (cache[`url:${url.trim()}`] ?? {}) : {};
    const merged: CachedVideoMeta = {
      ...prevByUrl,
      ...prevById,
      ...(meta.video_duration ? { video_duration: meta.video_duration } : {}),
      ...(meta.reading_minutes !== undefined
        ? { reading_minutes: meta.reading_minutes }
        : {}),
      ...(meta.channel_name ? { channel_name: meta.channel_name } : {}),
    };
    cache[`id:${id}`] = merged;
    if (url) {
      cache[`url:${url.trim()}`] = merged;
    }
    window.localStorage.setItem(VIDEO_META_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage quota errors
  }
}

function mergeCachedVideoDuration(
  incomingLinks: LinkItem[],
  existingLinks: LinkItem[]
): LinkItem[] {
  const cache = readVideoMetaCache();
  const byId = new Map<string, LinkItem>();
  const byUrl = new Map<string, LinkItem>();
  for (const item of existingLinks) {
    if (item.video_duration || item.channel_name) {
      byId.set(item.id, item);
      byUrl.set(item.url.trim(), item);
    }
  }

  return incomingLinks.map((link) => {
    if (link.video_duration || link.channel_name) {
      writeVideoMetaCache(link.id, link.url, {
        video_duration: link.video_duration ?? undefined,
        reading_minutes: link.reading_minutes,
        channel_name: link.channel_name ?? undefined,
      });
    }
    const memMatch = byId.get(link.id) || byUrl.get(link.url.trim());
    const storageMatch =
      cache[`id:${link.id}`] || cache[`url:${link.url.trim()}`];

    const resolvedDuration =
      link.video_duration ||
      memMatch?.video_duration ||
      storageMatch?.video_duration ||
      null;
    const resolvedChannel =
      link.channel_name ||
      memMatch?.channel_name ||
      storageMatch?.channel_name ||
      null;
    const resolvedMinutes =
      link.reading_minutes ||
      memMatch?.reading_minutes ||
      storageMatch?.reading_minutes ||
      5;

    if (
      resolvedDuration !== (link.video_duration ?? null) ||
      resolvedChannel !== (link.channel_name ?? null)
    ) {
      return {
        ...link,
        video_duration: resolvedDuration,
        channel_name: resolvedChannel,
        reading_minutes: resolvedMinutes,
      };
    }
    return link;
  });
}

async function persistConsolidatedState(
  consolidated: ConsolidateLinksResult,
  authUser: AuthUserSummary | null
): Promise<void> {
  const {
    links: consolidatedLinks,
    movedLinks,
    removedDuplicateLinks,
    updatedKeptLinks,
  } = consolidated;

  if (
    movedLinks.length === 0 &&
    removedDuplicateLinks.length === 0 &&
    updatedKeptLinks.length === 0
  ) {
    return;
  }

  // 1. Delete any removed duplicate tabs (old or new) from Firestore and local API
  if (removedDuplicateLinks.length > 0) {
    await Promise.all(
      removedDuplicateLinks.map(async (dup) => {
        manuallyMovedLinkIds.delete(dup.id);
        if (authUser && canSyncWithFirestore(authUser)) {
          try {
            await deleteLinkInFirestore(dup.id);
          } catch {
            // Ignore transient cloud delete errors
          }
        }
        try {
          await fetch(`/api/links/${encodeURIComponent(dup.id)}`, {
            method: 'DELETE',
            credentials: 'same-origin',
            headers: getUserHeaders(false),
          });
        } catch {
          // Ignore transient local delete errors
        }
      })
    );
  }

  // 2. Update any kept links that absorbed metadata or moved groups
  const byId = new Map(consolidatedLinks.map((item) => [item.id, item]));
  const idsToUpdate = new Set<string>([
    ...movedLinks.map((m) => m.linkId),
    ...updatedKeptLinks.map((u) => u.id),
  ]);

  await Promise.all(
    Array.from(idsToUpdate).map(async (linkId) => {
      const updatedItem = byId.get(linkId);
      if (!updatedItem) return;

      if (authUser && canSyncWithFirestore(authUser) && updatedItem.folder_id) {
        try {
          await updateLinkInFirestore(linkId, {
            title: updatedItem.title,
            description: updatedItem.description,
            folder_id: updatedItem.folder_id,
            order_index: updatedItem.order_index,
          });
        } catch {
          // Ignore transient cloud sync errors during auto-consolidation
        }
      }

      try {
        await fetch(`/api/links/${encodeURIComponent(linkId)}`, {
          method: 'PUT',
          credentials: 'same-origin',
          headers: getUserHeaders(true),
          body: JSON.stringify({
            title: updatedItem.title,
            description: updatedItem.description,
            folder_id: updatedItem.folder_id,
            order_index: updatedItem.order_index,
            channel_name: updatedItem.channel_name,
            video_duration: updatedItem.video_duration,
            image_url: updatedItem.image_url,
          }),
        });
      } catch {
        // Ignore transient local API errors during auto-consolidation
      }
    })
  );
}

interface LinkStoreState {
  userId: string;
  authUser: AuthUserSummary | null;
  isAuthReady: boolean;
  isCloudSynced: boolean;
  links: LinkItem[];
  folders: Folder[];
  activeFolderId: string | null;
  activeTag: string | null;
  cardDensity: 'rich' | 'compact';
  newlyCreatedGroupId: string | null;
  isImportingGroup: boolean;
  isLoading: boolean;
  isScraping: boolean;
  errorMessage: string | null;
  workspaceNotice: WorkspaceNotice | null;
  highlightedLinkId: string | null;

  fetchInitialData: () => Promise<void>;
  syncAuthUser: (user: AuthUserSummary | null) => Promise<void>;
  setActiveFolderId: (folderId: string | null) => void;
  setActiveTag: (tag: string | null) => void;
  setCardDensity: (density: 'rich' | 'compact') => void;
  clearNewlyCreatedGroupId: () => void;
  clearError: () => void;
  clearNotice: () => void;
  clearHighlightedLinkId: () => void;

  addLink: (payload: CreateLinkPayload) => Promise<LinkItem | null>;
  updateLink: (
    id: string,
    patch: Partial<
      Pick<
        LinkItem,
        | 'title'
        | 'description'
        | 'folder_id'
        | 'status'
        | 'order_index'
        | 'tags'
        | 'image_url'
        | 'reading_minutes'
        | 'video_duration'
        | 'channel_name'
      >
    >
  ) => Promise<void>;
  reorderLink: (
    linkId: string,
    targetFolderId: string | null,
    targetLinkId?: string | null,
    position?: 'before' | 'after'
  ) => Promise<void>;
  deleteLink: (id: string) => Promise<void>;
  createFolder: (
    name: string,
    parentId: string | null,
    color?: TabGroupColor
  ) => Promise<Folder | null>;
  createFolderWithLinks: (payload: {
    name: string;
    color?: TabGroupColor;
    tabs: { url: string; title?: string }[];
    focusInlineRename?: boolean;
  }) => Promise<Folder | null>;
  updateFolder: (
    id: string,
    patch: Partial<Pick<Folder, 'name' | 'color' | 'collapsed' | 'order_index' | 'parent_id'>>
  ) => Promise<void>;
  reorderFolders: (
    sourceFolderId: string,
    targetFolderId: string,
    position?: 'before' | 'after'
  ) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
}

export const useLinkStore = create<LinkStoreState>((set, get) => ({
  userId: '',
  authUser: null,
  isAuthReady: false,
  isCloudSynced: false,
  links: [],
  folders: [],
  activeFolderId: null,
  activeTag: null,
  cardDensity: 'rich',
  newlyCreatedGroupId: null,
  isImportingGroup: false,
  isLoading: true,
  isScraping: false,
  errorMessage: null,
  workspaceNotice: null,
  highlightedLinkId: null,

  fetchInitialData: async () => {
    const uid = getOrCreateClientUserId();
    set({ isLoading: true, errorMessage: null, userId: uid });
    try {
      const response = await fetch('/api/links', {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: getUserHeaders(false),
      });
      if (!response.ok) {
        throw new Error('Failed to load workspace data.');
      }
      const data = await response.json();
      const loadedFolders: Folder[] = data.folders ?? [];
      const mergedLinks = mergeCachedVideoDuration(
        data.links ?? [],
        get().links
      );
      const consolidated = consolidateLinksAcrossGroups(
        mergedLinks,
        loadedFolders,
        manuallyMovedLinkIds
      );

      set({
        userId: data.user?.id ?? uid,
        links: consolidated.links,
        folders: loadedFolders,
        isLoading: false,
      });

      if (
        consolidated.movedLinks.length > 0 ||
        consolidated.removedDuplicateLinks.length > 0 ||
        consolidated.updatedKeptLinks.length > 0
      ) {
        void persistConsolidatedState(consolidated, null);
      }
    } catch (error) {
      set({
        isLoading: false,
        errorMessage:
          error instanceof Error ? error.message : 'Unable to fetch links.',
      });
    }
  },

  syncAuthUser: async (user) => {
    if (activeFirestoreUnsubscribe) {
      activeFirestoreUnsubscribe();
      activeFirestoreUnsubscribe = null;
    }

    if (!user) {
      const wasLoggedIn = get().authUser !== null;
      if (wasLoggedIn) {
        clearAuthenticatedClientUserId();
      }
      set({
        authUser: null,
        isAuthReady: true,
        isCloudSynced: false,
        activeFolderId: null,
      });
      await get().fetchInitialData();
      return;
    }

    const mappedSessionUid = setAuthenticatedClientUserId(user.uid);
    set({
      authUser: user,
      userId: mappedSessionUid,
      isAuthReady: true,
      isLoading: true,
      errorMessage: null,
    });

    // Load baseline workspace for this user ID
    await get().fetchInitialData();

    if (canSyncWithFirestore(user)) {
      try {
        await upsertUserProfileInFirestore(user);
        await ensureUserWorkspaceSeededInFirestore(
          user.uid,
          get().folders,
          get().links
        );

        activeFirestoreUnsubscribe = subscribeToUserWorkspace(
          user.uid,
          (cloudFolders) => {
            const consolidated = consolidateLinksAcrossGroups(
              get().links,
              cloudFolders,
              manuallyMovedLinkIds
            );
            set({
              folders: cloudFolders,
              links: consolidated.links,
              isCloudSynced: true,
            });
            if (
              consolidated.movedLinks.length > 0 ||
              consolidated.removedDuplicateLinks.length > 0 ||
              consolidated.updatedKeptLinks.length > 0
            ) {
              void persistConsolidatedState(consolidated, get().authUser);
            }
          },
          (cloudLinks) => {
            const merged = mergeCachedVideoDuration(cloudLinks, get().links);
            const consolidated = consolidateLinksAcrossGroups(
              merged,
              get().folders,
              manuallyMovedLinkIds
            );
            set({
              links: consolidated.links,
              isCloudSynced: true,
              isLoading: false,
            });
            if (
              consolidated.movedLinks.length > 0 ||
              consolidated.removedDuplicateLinks.length > 0 ||
              consolidated.updatedKeptLinks.length > 0
            ) {
              void persistConsolidatedState(consolidated, get().authUser);
            }
          }
        );
      } catch (error) {
        console.error('Cloud sync setup error:', error);
        set({ isCloudSynced: false, isLoading: false });
      }
    } else {
      set({ isCloudSynced: false, isLoading: false });
    }
  },

  setActiveFolderId: (folderId) => set({ activeFolderId: folderId }),
  setActiveTag: (tag) => set({ activeTag: tag }),
  setCardDensity: (density) => set({ cardDensity: density }),
  clearNewlyCreatedGroupId: () => set({ newlyCreatedGroupId: null }),
  clearError: () => set({ errorMessage: null }),
  clearNotice: () => set({ workspaceNotice: null, highlightedLinkId: null }),
  clearHighlightedLinkId: () => set({ highlightedLinkId: null }),

  addLink: async (payload) => {
    const urlKey =
      normalizeLinkUrlKey(payload.url) || payload.url.trim().toLowerCase();
    if (urlKey) {
      const existingInFlight = inFlightAddByUrlKey.get(urlKey);
      if (existingInFlight) {
        return existingInFlight;
      }
    }

    const runAddLink = async (): Promise<LinkItem | null> => {
      set({
        isScraping: true,
        errorMessage: null,
        workspaceNotice: null,
        highlightedLinkId: null,
      });
      const previousLinks = get().links;
      const previousFolders = get().folders;
      const preExistingDuplicate = findDuplicateLinkByUrl(
        payload.url,
        previousLinks,
        previousFolders
      );

      if (preExistingDuplicate) {
        const immediateConsolidated = consolidateLinksAcrossGroups(
          previousLinks,
          previousFolders,
          manuallyMovedLinkIds
        );
        const immediateKept =
          immediateConsolidated.links.find(
            (item) => item.id === preExistingDuplicate.id
          ) ?? preExistingDuplicate;

        set({
          links: immediateConsolidated.links,
          isScraping: false,
          highlightedLinkId: immediateKept.id,
          activeFolderId: immediateKept.folder_id ?? get().activeFolderId,
          workspaceNotice: null,
        });

        if (
          immediateConsolidated.movedLinks.length > 0 ||
          immediateConsolidated.removedDuplicateLinks.length > 0 ||
          immediateConsolidated.updatedKeptLinks.length > 0
        ) {
          void persistConsolidatedState(immediateConsolidated, get().authUser);
        }

        const lowerTitle = (immediateKept.title || '').trim().toLowerCase();
        const needsMetadataEnrichment =
          !lowerTitle ||
          lowerTitle === 'youtube' ||
          lowerTitle === '- youtube' ||
          lowerTitle === 'watch - youtube' ||
          lowerTitle.startsWith('youtube clip (');

        if (!needsMetadataEnrichment) {
          return immediateKept;
        }
      }

    try {
      const normalizedPayloadFolderId =
        payload.folder_id && payload.folder_id !== '__ungrouped__'
          ? payload.folder_id
          : null;

      let data: {
        link?: LinkItem;
        folders?: Folder[];
        links?: LinkItem[];
        duplicateOfLinkId?: string | null;
        error?: string;
      } = {};
      let responseOk = false;

      try {
        const response = await fetch('/api/links', {
          method: 'POST',
          credentials: 'same-origin',
          headers: getUserHeaders(true),
          body: JSON.stringify({
            ...payload,
            folder_id: normalizedPayloadFolderId,
          }),
        });
        responseOk = response.ok;
        const rawText = await response.text();
        if (rawText) {
          data = JSON.parse(rawText);
        }
      } catch {
        responseOk = false;
      }

      if (!responseOk || !data.link) {
        if (preExistingDuplicate) {
          set({ isScraping: false, errorMessage: null });
          return preExistingDuplicate;
        }
        // Build a deterministic fallback LinkItem when the URL is valid so adding YouTube/web links never fails
        let parsedFallbackUrl: URL;
        try {
          const trimmedRaw = payload.url.trim();
          const withProto = /^https?:\/\//i.test(trimmedRaw)
            ? trimmedRaw
            : `https://${trimmedRaw}`;
          parsedFallbackUrl = new URL(withProto);
        } catch {
          throw new Error(data.error || 'URL không hợp lệ. Vui lòng kiểm tra lại đường dẫn.');
        }

        const fallbackDomain = parsedFallbackUrl.hostname.replace(/^www\./i, '');
        const ytId = extractYouTubeVideoIdFromUrl(parsedFallbackUrl.toString());
        const fallbackFolder =
          normalizedPayloadFolderId ||
          get().folders[0]?.id ||
          `fld-${Date.now()}`;

        data.link = {
          id: `lnk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          user_id: get().authUser?.uid || 'usr-local',
          folder_id: fallbackFolder,
          url: parsedFallbackUrl.toString(),
          domain: fallbackDomain,
          title:
            payload.title?.trim() ||
            (ytId ? `YouTube Video (${ytId})` : fallbackDomain),
          description:
            payload.description?.trim() ||
            (ytId
              ? `YouTube video clip (https://www.youtube.com/watch?v=${ytId}).`
              : `Saved link from ${fallbackDomain}.`),
          image_url:
            payload.image_url !== undefined
              ? payload.image_url
              : ytId
              ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`
              : null,
          favicon: ytId
            ? 'https://www.youtube.com/favicon.ico'
            : `https://www.google.com/s2/favicons?domain=${encodeURIComponent(fallbackDomain)}&sz=64`,
          status: payload.status ?? LinkStatus.UNREAD,
          tags: Array.isArray(payload.tags) ? payload.tags : [],
          reading_minutes: 5,
          video_duration: null,
          channel_name: null,
          order_index: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          scrape_status: 'ok',
        };
      }

      const createdLink = data.link as LinkItem;
      if (createdLink.video_duration || createdLink.channel_name) {
        writeVideoMetaCache(createdLink.id, createdLink.url, {
          video_duration: createdLink.video_duration ?? undefined,
          reading_minutes: createdLink.reading_minutes,
          channel_name: createdLink.channel_name ?? undefined,
        });
      }

      const authUser = get().authUser;
      const currentFolders = get().folders;
      const serverFolders: Folder[] = Array.isArray(data.folders)
        ? data.folders
        : currentFolders;
      const effectiveFolders =
        currentFolders.length > 0 ? currentFolders : serverFolders;

      // Only detect a duplicate if the link actually exists in `previousLinks` (the user's active board)
      const matchedDuplicate =
        preExistingDuplicate ??
        findDuplicateLinkByUrl(
          createdLink.url,
          previousLinks,
          effectiveFolders
        );

      // Case 1: The user added a tab with the exact same URL as an existing tab in their current board
      if (matchedDuplicate) {
        const wasTransientCreatedId = createdLink.id !== matchedDuplicate.id;
        if (wasTransientCreatedId) {
          try {
            await fetch(`/api/links/${encodeURIComponent(createdLink.id)}`, {
              method: 'DELETE',
              credentials: 'same-origin',
              headers: getUserHeaders(false),
            });
          } catch {
            // Ignore local cleanup error
          }
        }

        const combinedWithNewMeta = [
          ...previousLinks,
          ...(previousLinks.some((item) => item.id === createdLink.id)
            ? []
            : [createdLink]),
        ];
        const mergedLinks = mergeCachedVideoDuration(
          combinedWithNewMeta,
          previousLinks
        );
        const consolidated = consolidateLinksAcrossGroups(
          mergedLinks,
          effectiveFolders,
          manuallyMovedLinkIds
        );

        const keptLink =
          consolidated.links.find((item) => item.id === matchedDuplicate.id) ??
          consolidated.links.find((item) => item.id === createdLink.id) ??
          matchedDuplicate;

        set({
          folders:
            !get().isCloudSynced && serverFolders.length > 0
              ? serverFolders
              : currentFolders.length === 0 && serverFolders.length > 0
              ? serverFolders
              : get().folders,
          links: consolidated.links,
          isScraping: false,
          errorMessage: null,
          highlightedLinkId: keptLink.id,
          activeFolderId: keptLink.folder_id ?? get().activeFolderId,
          workspaceNotice: null,
        });

        const consolidatedForPersist: ConsolidateLinksResult =
          wasTransientCreatedId
            ? {
                ...consolidated,
                removedDuplicateLinks:
                  consolidated.removedDuplicateLinks.filter(
                    (dup) => dup.id !== createdLink.id
                  ),
              }
            : consolidated;

        void persistConsolidatedState(consolidatedForPersist, authUser);
        return keptLink;
      }

      // Case 2: Brand-new link in the user's workspace
      const matchedExistingFolderId = findExistingGroupForLinkSource(
        createdLink,
        previousLinks,
        effectiveFolders,
        createdLink.id
      );

      const rawFallbackFolderId =
        matchedExistingFolderId ||
        normalizedPayloadFolderId ||
        currentFolders[0]?.id ||
        createdLink.folder_id ||
        serverFolders[0]?.id ||
        `fld-${Date.now()}`;

      const fallbackFolderId =
        rawFallbackFolderId === '__ungrouped__'
          ? currentFolders[0]?.id || serverFolders[0]?.id || `fld-${Date.now()}`
          : rawFallbackFolderId;

      const finalCreatedLink: LinkItem = {
        ...createdLink,
        folder_id: fallbackFolderId,
      };

      if (createdLink.folder_id !== fallbackFolderId) {
        try {
          await fetch(`/api/links/${encodeURIComponent(createdLink.id)}`, {
            method: 'PUT',
            credentials: 'same-origin',
            headers: getUserHeaders(true),
            body: JSON.stringify({ folder_id: fallbackFolderId }),
          });
        } catch {
          // Ignore background sync error
        }
      }

      const targetFolderObj: Folder =
        currentFolders.find((f) => f.id === fallbackFolderId) ??
        serverFolders.find((f) => f.id === fallbackFolderId) ?? {
          id: fallbackFolderId,
          user_id: authUser?.uid || 'usr-local',
          name: 'Tab đã lưu',
          parent_id: null,
          order_index: 0,
          color: 'blue' as const,
          collapsed: false,
        };

      const nextFolders = effectiveFolders.some((f) => f.id === fallbackFolderId)
        ? effectiveFolders
        : [...effectiveFolders, targetFolderObj];

      if (payload.target_link_id) {
        manuallyMovedLinkIds.add(finalCreatedLink.id);
      }

      const rawCandidateLinks = [
        ...previousLinks.filter((item) => item.id !== finalCreatedLink.id),
        finalCreatedLink,
      ];

      const positionedCandidateLinks = moveAndReorderGroupLinks(
        rawCandidateLinks,
        {
          linkId: finalCreatedLink.id,
          targetFolderId: fallbackFolderId,
          targetLinkId: payload.target_link_id ?? null,
          position: payload.position ?? 'after',
        }
      );

      const mergedLinks = mergeCachedVideoDuration(
        positionedCandidateLinks,
        previousLinks
      );
      const consolidated = consolidateLinksAcrossGroups(
        mergedLinks,
        nextFolders,
        manuallyMovedLinkIds
      );

      const placedLink =
        consolidated.links.find((item) => item.id === finalCreatedLink.id) ??
        finalCreatedLink;

      let nextNotice: WorkspaceNotice | null = null;
      if (
        matchedExistingFolderId &&
        normalizedPayloadFolderId &&
        matchedExistingFolderId !== normalizedPayloadFolderId
      ) {
        const targetGroupName =
          nextFolders.find((f) => f.id === matchedExistingFolderId)
            ?.name || 'Tab đã lưu';
        const sourceLabel =
          resolveYouTubeChannelFromLink(finalCreatedLink) ||
          normalizeLinkSourceDomain(finalCreatedLink);
        nextNotice = {
          id: `notice-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          kind: 'same-website-grouped',
          sourceLabel,
          groupName: targetGroupName,
          folderId: matchedExistingFolderId,
        };
      }

      set({
        folders: nextFolders,
        links: consolidated.links,
        isScraping: false,
        errorMessage: null,
        workspaceNotice: nextNotice,
        highlightedLinkId: placedLink.id,
        activeFolderId: placedLink.folder_id ?? fallbackFolderId,
      });

      if (authUser && canSyncWithFirestore(authUser)) {
        void (async () => {
          try {
            await createLinkInFirestore(
              authUser.uid,
              placedLink,
              placedLink.folder_id ?? fallbackFolderId,
              targetFolderObj
            );
          } catch (cloudErr) {
            console.warn('Cloud link sync skipped:', cloudErr);
          }
        })();
      }

      if (
        consolidated.movedLinks.length > 0 ||
        consolidated.removedDuplicateLinks.length > 0 ||
        consolidated.updatedKeptLinks.length > 0
      ) {
        void persistConsolidatedState(consolidated, authUser);
      }

      return placedLink;
    } catch (error) {
      set({
        isScraping: false,
        errorMessage:
          error instanceof Error ? error.message : 'Failed to save link.',
      });
      return null;
    }
    };

    const taskPromise = runAddLink().finally(() => {
      if (urlKey) {
        inFlightAddByUrlKey.delete(urlKey);
      }
    });

    if (urlKey) {
      inFlightAddByUrlKey.set(urlKey, taskPromise);
    }
    return taskPromise;
  },

  updateLink: async (id, patch) => {
    const previousLinks = get().links;
    const currentFolders = get().folders;
    const targetLink = previousLinks.find((item) => item.id === id);
    if (!targetLink) return;

    if (patch.video_duration || patch.channel_name) {
      writeVideoMetaCache(id, targetLink.url, {
        video_duration:
          patch.video_duration ?? targetLink.video_duration ?? undefined,
        reading_minutes: patch.reading_minutes ?? targetLink.reading_minutes,
        channel_name:
          patch.channel_name ?? targetLink.channel_name ?? undefined,
      });
    }

    const updatedCandidate: LinkItem = {
      ...targetLink,
      ...patch,
    };

    // If background scraping just resolved channel_name or description, check if an earlier group already owns this source
    const autoMatchedFolderId =
      patch.folder_id === undefined &&
      !manuallyMovedLinkIds.has(id) &&
      (patch.channel_name !== undefined || patch.description !== undefined)
        ? findExistingGroupForLinkSource(
            updatedCandidate,
            previousLinks,
            currentFolders,
            id
          )
        : null;

    const effectivePatch = {
      ...patch,
      ...(autoMatchedFolderId && autoMatchedFolderId !== targetLink.folder_id
        ? { folder_id: autoMatchedFolderId }
        : {}),
    };

    let nextLinks = previousLinks.map((item) =>
      item.id === id ? { ...item, ...effectivePatch } : item
    );

    if (
      effectivePatch.folder_id !== undefined &&
      effectivePatch.folder_id !== targetLink.folder_id
    ) {
      nextLinks = moveAndReorderGroupLinks(nextLinks, {
        linkId: id,
        targetFolderId: effectivePatch.folder_id,
        position: 'after',
      });
    }

    const consolidated = consolidateLinksAcrossGroups(
      nextLinks,
      currentFolders,
      manuallyMovedLinkIds
    );
    nextLinks = consolidated.links;

    const updatedItemAfterConsolidation = nextLinks.find(
      (item) => item.id === id
    );
    if (
      updatedItemAfterConsolidation &&
      updatedItemAfterConsolidation.folder_id !== targetLink.folder_id
    ) {
      effectivePatch.folder_id = updatedItemAfterConsolidation.folder_id;
      effectivePatch.order_index = updatedItemAfterConsolidation.order_index;
    }

    set({ links: nextLinks });

    if (
      consolidated.movedLinks.length > 0 ||
      consolidated.removedDuplicateLinks.length > 0 ||
      consolidated.updatedKeptLinks.length > 0
    ) {
      void persistConsolidatedState(consolidated, get().authUser);
    }

    // If this link itself was removed as a duplicate during consolidation, do not send a PUT for it
    if (consolidated.removedDuplicateLinks.some((d) => d.id === id)) {
      return;
    }

    const hasFirestoreFields =
      effectivePatch.title !== undefined ||
      effectivePatch.description !== undefined ||
      (effectivePatch.folder_id !== undefined &&
        effectivePatch.folder_id !== null) ||
      effectivePatch.status !== undefined ||
      effectivePatch.order_index !== undefined;

    try {
      const authUser = get().authUser;
      if (authUser && canSyncWithFirestore(authUser) && hasFirestoreFields) {
        await updateLinkInFirestore(id, effectivePatch);
      }

      const response = await fetch(`/api/links/${encodeURIComponent(id)}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: getUserHeaders(true),
        body: JSON.stringify(effectivePatch),
      });
      if (!response.ok && !get().isCloudSynced && hasFirestoreFields) {
        throw new Error('Failed to update link.');
      }
      if (response.ok && !get().isCloudSynced) {
        const data = await response.json();
        if (Array.isArray(data.links)) {
          set((state) => {
            const merged = mergeCachedVideoDuration(data.links, state.links);
            const reconsolidated = consolidateLinksAcrossGroups(
              merged,
              state.folders,
              manuallyMovedLinkIds
            );
            return { links: reconsolidated.links };
          });
        }
      }
    } catch (error) {
      if (hasFirestoreFields) {
        set({
          links: previousLinks,
          errorMessage:
            error instanceof Error ? error.message : 'Update failed.',
        });
      }
    }
  },

  reorderLink: async (
    linkId,
    targetFolderId,
    targetLinkId = null,
    position = 'after'
  ) => {
    if (!linkId) return;
    if (targetLinkId && linkId === targetLinkId) return;

    manuallyMovedLinkIds.add(linkId);

    const previousLinks = get().links;
    const movingLink = previousLinks.find((item) => item.id === linkId);
    if (!movingLink) return;

    const nextLinks = moveAndReorderGroupLinks(previousLinks, {
      linkId,
      targetFolderId,
      targetLinkId,
      position,
    });

    const prevById = new Map(previousLinks.map((item) => [item.id, item]));
    const changedLinks = nextLinks.filter((nextItem) => {
      const prevItem = prevById.get(nextItem.id);
      if (!prevItem) return false;
      return (
        prevItem.folder_id !== nextItem.folder_id ||
        prevItem.order_index !== nextItem.order_index
      );
    });

    const isSameOrderAndFolder =
      changedLinks.length === 0 &&
      nextLinks.every(
        (item, index) => item.id === previousLinks[index]?.id
      );

    if (isSameOrderAndFolder) {
      return;
    }

    set({ links: nextLinks, errorMessage: null });

    try {
      const authUser = get().authUser;
      const folderIdSet = new Set(get().folders.map((f) => f.id));

      if (authUser && canSyncWithFirestore(authUser)) {
        await Promise.all(
          changedLinks.map((item) => {
            const prevItem = prevById.get(item.id);
            const patch: Partial<
              Pick<LinkItem, 'folder_id' | 'order_index'>
            > = {};

            if (
              item.folder_id &&
              folderIdSet.has(item.folder_id) &&
              prevItem?.folder_id !== item.folder_id
            ) {
              patch.folder_id = item.folder_id;
            }
            if (prevItem?.order_index !== item.order_index) {
              patch.order_index = item.order_index;
            }

            if (Object.keys(patch).length === 0) {
              return Promise.resolve();
            }
            return updateLinkInFirestore(item.id, patch);
          })
        );
      }

      const updatedMovingLink = nextLinks.find((item) => item.id === linkId);
      const response = await fetch(`/api/links/${encodeURIComponent(linkId)}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: getUserHeaders(true),
        body: JSON.stringify({
          folder_id: targetFolderId,
          order_index: updatedMovingLink?.order_index,
          target_link_id: targetLinkId,
          position,
        }),
      });

      if (!response.ok && !get().isCloudSynced) {
        throw new Error('Failed to reorder link.');
      }
      if (response.ok && !get().isCloudSynced) {
        const data = await response.json();
        if (Array.isArray(data.links)) {
          set((state) => ({
            links: mergeCachedVideoDuration(data.links, state.links),
          }));
        }
      }
    } catch (error) {
      set({
        links: previousLinks,
        errorMessage:
          error instanceof Error ? error.message : 'Failed to reorder link.',
      });
    }
  },

  deleteLink: async (id) => {
    manuallyMovedLinkIds.delete(id);
    const previousLinks = get().links;
    set({ links: previousLinks.filter((item) => item.id !== id) });

    try {
      const authUser = get().authUser;
      if (authUser && canSyncWithFirestore(authUser)) {
        await deleteLinkInFirestore(id);
      }

      const response = await fetch(`/api/links/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: getUserHeaders(false),
      });
      if (!response.ok && !get().isCloudSynced) {
        throw new Error('Failed to delete link.');
      }
      if (response.ok && !get().isCloudSynced) {
        const data = await response.json();
        if (Array.isArray(data.links)) {
          set({ links: data.links });
        }
      }
    } catch (error) {
      set({
        links: previousLinks,
        errorMessage:
          error instanceof Error ? error.message : 'Delete failed.',
      });
    }
  },

  createFolder: async (name, parentId, color) => {
    try {
      const response = await fetch('/api/folders', {
        method: 'POST',
        credentials: 'same-origin',
        headers: getUserHeaders(true),
        body: JSON.stringify({ name, parent_id: parentId, color }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create group.');
      }
      const createdFolder = data.folder as Folder;
      const authUser = get().authUser;
      const currentFolders = get().folders;
      const nextOrderIndex = currentFolders.length;
      const folderWithOrder: Folder = {
        ...createdFolder,
        order_index: createdFolder.order_index ?? nextOrderIndex,
      };

      // Immediately update local state and focus the newly created tab group
      const updatedFolders = Array.isArray(data.folders) && !get().isCloudSynced
        ? (data.folders as Folder[])
        : currentFolders.some((f) => f.id === folderWithOrder.id)
        ? currentFolders
        : [...currentFolders, folderWithOrder];

      set({
        folders: updatedFolders,
        activeFolderId: folderWithOrder.id,
      });

      if (authUser && canSyncWithFirestore(authUser)) {
        await createFolderInFirestore(authUser.uid, folderWithOrder);
      }

      return folderWithOrder;
    } catch (error) {
      set({
        errorMessage:
          error instanceof Error ? error.message : 'Could not create group.',
      });
      return null;
    }
  },

  createFolderWithLinks: async ({
    name,
    color,
    tabs,
    focusInlineRename = true,
  }) => {
    set({ isImportingGroup: true, errorMessage: null });
    try {
      const response = await fetch('/api/folders', {
        method: 'POST',
        credentials: 'same-origin',
        headers: getUserHeaders(true),
        body: JSON.stringify({ name, parent_id: null, color }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create group.');
      }
      const createdFolder = data.folder as Folder;
      const authUser = get().authUser;
      const currentFolders = get().folders;
      const nextOrderIndex = currentFolders.length;
      const folderWithOrder: Folder = {
        ...createdFolder,
        order_index: createdFolder.order_index ?? nextOrderIndex,
      };

      const updatedFolders =
        Array.isArray(data.folders) && !get().isCloudSynced
          ? (data.folders as Folder[])
          : currentFolders.some((f) => f.id === folderWithOrder.id)
          ? currentFolders
          : [...currentFolders, folderWithOrder];

      // Keep activeFolderId: null so all groups stay visible on the board,
      // and set newlyCreatedGroupId so the new column scrolls into view and auto-focuses inline rename.
      set({
        folders: updatedFolders,
        activeFolderId: null,
        newlyCreatedGroupId: focusInlineRename ? folderWithOrder.id : null,
      });

      if (authUser && canSyncWithFirestore(authUser)) {
        await createFolderInFirestore(authUser.uid, folderWithOrder);
      }

      const validTabs = tabs.filter((t) => Boolean(t.url && t.url.trim()));
      let lastRoutedFolderId: string | null = null;

      for (const tab of validTabs) {
        const added = await get().addLink({
          url: tab.url,
          title: tab.title,
          folder_id: folderWithOrder.id,
          tags: ['saved-tab'],
          status: LinkStatus.UNREAD,
        });
        if (added?.folder_id) {
          lastRoutedFolderId = added.folder_id;
        }
      }

      // If valid tabs were imported and ALL of them were automatically consolidated into existing groups,
      // remove the redundant empty group and focus the group that received the tabs.
      if (validTabs.length > 0) {
        const remainingInCreatedGroup = get().links.filter(
          (l) => l.folder_id === folderWithOrder.id
        );
        if (remainingInCreatedGroup.length === 0) {
          set({ newlyCreatedGroupId: null });
          await get().deleteFolder(folderWithOrder.id);
          const matchedExistingFolder = get().folders.find(
            (f) => f.id === lastRoutedFolderId
          );
          set({
            isImportingGroup: false,
            activeFolderId: matchedExistingFolder?.id ?? null,
          });
          return matchedExistingFolder ?? null;
        }
      }

      set({ isImportingGroup: false });
      return folderWithOrder;
    } catch (error) {
      set({
        isImportingGroup: false,
        errorMessage:
          error instanceof Error ? error.message : 'Could not create group.',
      });
      return null;
    }
  },

  updateFolder: async (id, patch) => {
    const prevFolders = get().folders;
    set({
      folders: prevFolders.map((f) =>
        f.id === id ? { ...f, ...patch } : f
      ),
    });
    try {
      const authUser = get().authUser;
      if (authUser && canSyncWithFirestore(authUser)) {
        await updateFolderInFirestore(id, patch);
      }

      const response = await fetch('/api/folders', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: getUserHeaders(true),
        body: JSON.stringify({ id, ...patch }),
      });
      if (!response.ok && !get().isCloudSynced) {
        throw new Error('Failed to update group.');
      }
      if (response.ok && !get().isCloudSynced) {
        const data = await response.json();
        if (Array.isArray(data.folders)) {
          set({ folders: data.folders });
        }
      }
    } catch {
      set({ folders: prevFolders });
    }
  },

  reorderFolders: async (
    sourceFolderId,
    targetFolderId,
    position = 'before'
  ) => {
    if (
      !sourceFolderId ||
      !targetFolderId ||
      sourceFolderId === targetFolderId ||
      sourceFolderId === '__ungrouped__' ||
      targetFolderId === '__ungrouped__'
    ) {
      return;
    }

    const prevFolders = get().folders;
    const sourceFolder = prevFolders.find((f) => f.id === sourceFolderId);
    const targetExists = prevFolders.some((f) => f.id === targetFolderId);
    if (!sourceFolder || !targetExists) return;

    const remaining = prevFolders.filter((f) => f.id !== sourceFolderId);
    const targetIdx = remaining.findIndex((f) => f.id === targetFolderId);
    if (targetIdx === -1) return;

    const insertIdx = position === 'after' ? targetIdx + 1 : targetIdx;
    const reordered = [
      ...remaining.slice(0, insertIdx),
      sourceFolder,
      ...remaining.slice(insertIdx),
    ].map((f, index) => ({
      ...f,
      order_index: index,
    }));

    const isSameOrder = reordered.every(
      (f, index) => f.id === prevFolders[index]?.id
    );
    if (isSameOrder) return;

    set({ folders: reordered, errorMessage: null });

    try {
      const authUser = get().authUser;
      if (authUser && canSyncWithFirestore(authUser)) {
        await Promise.all(
          reordered.map((folder, index) =>
            updateFolderInFirestore(folder.id, { order_index: index })
          )
        );
      }

      const response = await fetch('/api/folders', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: getUserHeaders(true),
        body: JSON.stringify({
          ordered_ids: reordered.map((f) => f.id),
        }),
      });
      if (!response.ok && !get().isCloudSynced) {
        throw new Error('Failed to reorder tab groups.');
      }
      if (response.ok && !get().isCloudSynced) {
        const data = await response.json();
        if (Array.isArray(data.folders)) {
          set({ folders: data.folders });
        }
      }
    } catch {
      set({ folders: prevFolders });
    }
  },

  deleteFolder: async (id) => {
    const prevFolders = get().folders;
    const prevLinks = get().links;
    set({
      folders: prevFolders.filter((f) => f.id !== id),
      links: prevLinks.filter((l) => l.folder_id !== id),
      activeFolderId: get().activeFolderId === id ? null : get().activeFolderId,
    });
    try {
      const authUser = get().authUser;
      if (authUser && canSyncWithFirestore(authUser)) {
        await deleteFolderInFirestore(id, prevLinks);
      }

      const response = await fetch(
        `/api/folders?id=${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
          credentials: 'same-origin',
          headers: getUserHeaders(false),
        }
      );
      if (!response.ok && !get().isCloudSynced) {
        throw new Error('Failed to delete group.');
      }
      if (response.ok && !get().isCloudSynced) {
        const data = await response.json();
        set({
          folders: data.folders ?? prevFolders,
          links: data.links ?? prevLinks,
        });
      }
    } catch {
      set({ folders: prevFolders, links: prevLinks });
    }
  },
}));
