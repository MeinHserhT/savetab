'use client';

import { create } from 'zustand';
import { Folder, LinkItem, LinkStatus, TabGroupColor } from '@/lib/types';
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

interface CreateLinkPayload {
  url: string;
  folder_id: string | null;
  tags: string[];
  status?: LinkStatus;
  title?: string;
  description?: string;
  image_url?: string | null;
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

const VIDEO_META_STORAGE_KEY = 'tabflow_video_meta_v1';

interface CachedVideoMeta {
  video_duration: string;
  reading_minutes?: number;
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
  if (typeof window === 'undefined' || !meta.video_duration) return;
  try {
    const cache = readVideoMetaCache();
    cache[`id:${id}`] = meta;
    if (url) {
      cache[`url:${url.trim()}`] = meta;
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
    if (item.video_duration) {
      byId.set(item.id, item);
      byUrl.set(item.url.trim(), item);
    }
  }

  return incomingLinks.map((link) => {
    if (link.video_duration) {
      writeVideoMetaCache(link.id, link.url, {
        video_duration: link.video_duration,
        reading_minutes: link.reading_minutes,
      });
      return link;
    }
    const memMatch = byId.get(link.id) || byUrl.get(link.url.trim());
    if (memMatch?.video_duration) {
      return {
        ...link,
        video_duration: memMatch.video_duration,
        reading_minutes: memMatch.reading_minutes || link.reading_minutes,
      };
    }
    const storageMatch =
      cache[`id:${link.id}`] || cache[`url:${link.url.trim()}`];
    if (storageMatch?.video_duration) {
      return {
        ...link,
        video_duration: storageMatch.video_duration,
        reading_minutes:
          storageMatch.reading_minutes ?? link.reading_minutes,
      };
    }
    return link;
  });
}

interface LinkStoreState {
  userId: string;
  authUser: AuthUserSummary | null;
  isAuthReady: boolean;
  isCloudSynced: boolean;
  links: LinkItem[];
  folders: Folder[];
  activeFolderId: string | null;
  newlyCreatedGroupId: string | null;
  isImportingGroup: boolean;
  isLoading: boolean;
  isScraping: boolean;
  errorMessage: string | null;

  fetchInitialData: () => Promise<void>;
  syncAuthUser: (user: AuthUserSummary | null) => Promise<void>;
  setActiveFolderId: (folderId: string | null) => void;
  clearNewlyCreatedGroupId: () => void;
  clearError: () => void;

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
        | 'tags'
        | 'image_url'
        | 'reading_minutes'
        | 'video_duration'
      >
    >
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
    patch: Partial<Pick<Folder, 'name' | 'color' | 'collapsed' | 'order_index'>>
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
  newlyCreatedGroupId: null,
  isImportingGroup: false,
  isLoading: true,
  isScraping: false,
  errorMessage: null,

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
      set({
        userId: data.user?.id ?? uid,
        links: mergeCachedVideoDuration(data.links ?? [], get().links),
        folders: data.folders ?? [],
        isLoading: false,
      });
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
            set({ folders: cloudFolders, isCloudSynced: true });
          },
          (cloudLinks) => {
            set({
              links: mergeCachedVideoDuration(cloudLinks, get().links),
              isCloudSynced: true,
              isLoading: false,
            });
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
  clearNewlyCreatedGroupId: () => set({ newlyCreatedGroupId: null }),
  clearError: () => set({ errorMessage: null }),

  addLink: async (payload) => {
    set({ isScraping: true, errorMessage: null });
    try {
      const response = await fetch('/api/links', {
        method: 'POST',
        credentials: 'same-origin',
        headers: getUserHeaders(true),
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save link.');
      }
      const createdLink = data.link as LinkItem;
      if (createdLink.video_duration) {
        writeVideoMetaCache(createdLink.id, createdLink.url, {
          video_duration: createdLink.video_duration,
          reading_minutes: createdLink.reading_minutes,
        });
      }

      const authUser = get().authUser;
      const currentFolders = get().folders;
      const serverFolders: Folder[] = Array.isArray(data.folders)
        ? data.folders
        : currentFolders;
      const fallbackFolderId =
        payload.folder_id ||
        currentFolders[0]?.id ||
        createdLink.folder_id ||
        serverFolders[0]?.id ||
        `fld-${Date.now()}`;

      if (authUser && canSyncWithFirestore(authUser)) {
        const folderExistsInState = currentFolders.some(
          (f) => f.id === fallbackFolderId
        );
        if (!folderExistsInState) {
          const matchedServerFolder = serverFolders.find(
            (f) => f.id === fallbackFolderId
          ) ?? {
            id: fallbackFolderId,
            user_id: authUser.uid,
            name: 'Tab đã lưu',
            parent_id: null,
            order_index: 0,
            color: 'blue' as const,
            collapsed: false,
          };
          await createFolderInFirestore(authUser.uid, matchedServerFolder);
        }

        await createLinkInFirestore(
          authUser.uid,
          { ...createdLink, folder_id: fallbackFolderId },
          fallbackFolderId
        );
      }

      set({
        folders:
          !get().isCloudSynced && serverFolders.length > 0
            ? serverFolders
            : currentFolders.length === 0 && serverFolders.length > 0
            ? serverFolders
            : get().folders,
        links: mergeCachedVideoDuration(
          data.links ?? [
            { ...createdLink, folder_id: fallbackFolderId },
            ...get().links,
          ],
          get().links
        ),
        isScraping: false,
      });
      return createdLink;
    } catch (error) {
      set({
        isScraping: false,
        errorMessage:
          error instanceof Error ? error.message : 'Failed to save link.',
      });
      return null;
    }
  },

  updateLink: async (id, patch) => {
    const previousLinks = get().links;
    const targetLink = previousLinks.find((item) => item.id === id);
    if (patch.video_duration) {
      writeVideoMetaCache(id, targetLink?.url, {
        video_duration: patch.video_duration,
        reading_minutes: patch.reading_minutes ?? targetLink?.reading_minutes,
      });
    }

    set((state) => ({
      links: state.links.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      ),
    }));

    const hasFirestoreFields =
      patch.title !== undefined ||
      patch.description !== undefined ||
      (patch.folder_id !== undefined && patch.folder_id !== null) ||
      patch.status !== undefined;

    try {
      const authUser = get().authUser;
      if (authUser && canSyncWithFirestore(authUser) && hasFirestoreFields) {
        await updateLinkInFirestore(id, patch);
      }

      const response = await fetch(`/api/links/${encodeURIComponent(id)}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: getUserHeaders(true),
        body: JSON.stringify(patch),
      });
      if (!response.ok && !get().isCloudSynced && hasFirestoreFields) {
        throw new Error('Failed to update link.');
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
      if (hasFirestoreFields) {
        set({
          links: previousLinks,
          errorMessage:
            error instanceof Error ? error.message : 'Update failed.',
        });
      }
    }
  },

  deleteLink: async (id) => {
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

      for (const tab of tabs) {
        if (!tab.url) continue;
        await get().addLink({
          url: tab.url,
          title: tab.title,
          folder_id: folderWithOrder.id,
          tags: ['saved-tab'],
          status: LinkStatus.UNREAD,
        });
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
