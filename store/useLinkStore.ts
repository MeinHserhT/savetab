'use client';

import { create } from 'zustand';
import { Folder, LinkItem, LinkStatus, TabGroupColor } from '@/lib/types';
import { moveAndReorderLinks } from '@/lib/kanban-rules';
import {
  getOrCreateClientUserId,
  USER_HEADER_NAME,
} from '@/lib/user-session';

export type WorkspaceTab = 'board' | 'scraper-lab' | 'synthesis' | 'spec';

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

interface LinkStoreState {
  userId: string;
  links: LinkItem[];
  folders: Folder[];
  activeFolderId: string | null;
  activeTag: string | null;
  searchQuery: string;
  activeTab: WorkspaceTab;
  isLoading: boolean;
  isScraping: boolean;
  errorMessage: string | null;
  lastDiagnostic: string | null;

  fetchInitialData: () => Promise<void>;
  setActiveFolderId: (folderId: string | null) => void;
  setActiveTag: (tag: string | null) => void;
  setSearchQuery: (query: string) => void;
  setActiveTab: (tab: WorkspaceTab) => void;
  clearError: () => void;

  addLink: (payload: CreateLinkPayload) => Promise<LinkItem | null>;
  moveLink: (
    linkId: string,
    targetStatus: LinkStatus,
    targetIndex?: number
  ) => Promise<void>;
  updateLink: (
    id: string,
    patch: Partial<
      Pick<
        LinkItem,
        'title' | 'description' | 'folder_id' | 'status' | 'tags' | 'image_url'
      >
    >
  ) => Promise<void>;
  deleteLink: (id: string) => Promise<void>;
  createFolder: (
    name: string,
    parentId: string | null,
    color?: TabGroupColor
  ) => Promise<Folder | null>;
  updateFolder: (
    id: string,
    patch: Partial<Pick<Folder, 'name' | 'color' | 'collapsed'>>
  ) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
}

export const useLinkStore = create<LinkStoreState>((set, get) => ({
  userId: '',
  links: [],
  folders: [],
  activeFolderId: null,
  activeTag: null,
  searchQuery: '',
  activeTab: 'board',
  isLoading: true,
  isScraping: false,
  errorMessage: null,
  lastDiagnostic: null,

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
        links: data.links ?? [],
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

  setActiveFolderId: (folderId) => set({ activeFolderId: folderId }),
  setActiveTag: (tag) =>
    set((state) => ({ activeTag: state.activeTag === tag ? null : tag })),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  clearError: () => set({ errorMessage: null }),

  addLink: async (payload) => {
    set({ isScraping: true, errorMessage: null, lastDiagnostic: null });
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
      set({
        links: data.links ?? [data.link, ...get().links],
        isScraping: false,
        lastDiagnostic: data.scrapeDiagnostics ?? null,
      });
      return data.link as LinkItem;
    } catch (error) {
      set({
        isScraping: false,
        errorMessage:
          error instanceof Error ? error.message : 'Failed to save link.',
      });
      return null;
    }
  },

  moveLink: async (linkId, targetStatus, targetIndex) => {
    const previousLinks = get().links;
    const optimisticLinks = moveAndReorderLinks(
      previousLinks,
      linkId,
      targetStatus,
      targetIndex
    );
    const movedItem = optimisticLinks.find((item) => item.id === linkId);

    set({ links: optimisticLinks, errorMessage: null });

    try {
      const response = await fetch(`/api/links/${encodeURIComponent(linkId)}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: getUserHeaders(true),
        body: JSON.stringify({
          status: targetStatus,
          order_index: movedItem ? movedItem.order_index : targetIndex ?? 0,
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to persist lane order.');
      }
      const data = await response.json();
      if (Array.isArray(data.links)) {
        set({ links: data.links });
      }
    } catch (error) {
      set({
        links: previousLinks,
        errorMessage:
          error instanceof Error
            ? error.message
            : 'Reordering failed; reverted state.',
      });
    }
  },

  updateLink: async (id, patch) => {
    const previousLinks = get().links;
    set({
      links: previousLinks.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      ),
    });

    try {
      const response = await fetch(`/api/links/${encodeURIComponent(id)}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: getUserHeaders(true),
        body: JSON.stringify(patch),
      });
      if (!response.ok) {
        throw new Error('Failed to update link.');
      }
      const data = await response.json();
      if (Array.isArray(data.links)) {
        set({ links: data.links });
      }
    } catch (error) {
      set({
        links: previousLinks,
        errorMessage:
          error instanceof Error ? error.message : 'Update failed.',
      });
    }
  },

  deleteLink: async (id) => {
    const previousLinks = get().links;
    set({ links: previousLinks.filter((item) => item.id !== id) });

    try {
      const response = await fetch(`/api/links/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: getUserHeaders(false),
      });
      if (!response.ok) {
        throw new Error('Failed to delete link.');
      }
      const data = await response.json();
      if (Array.isArray(data.links)) {
        set({ links: data.links });
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
      set({ folders: data.folders });
      return data.folder as Folder;
    } catch (error) {
      set({
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
      const response = await fetch('/api/folders', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: getUserHeaders(true),
        body: JSON.stringify({ id, ...patch }),
      });
      if (!response.ok) throw new Error('Failed to update group.');
      const data = await response.json();
      if (Array.isArray(data.folders)) {
        set({ folders: data.folders });
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
      const response = await fetch(
        `/api/folders?id=${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
          credentials: 'same-origin',
          headers: getUserHeaders(false),
        }
      );
      if (!response.ok) throw new Error('Failed to delete group.');
      const data = await response.json();
      set({
        folders: data.folders ?? prevFolders,
        links: data.links ?? prevLinks,
      });
    } catch {
      set({ folders: prevFolders, links: prevLinks });
    }
  },
}));
