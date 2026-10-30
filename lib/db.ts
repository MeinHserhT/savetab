import fs from 'fs';
import path from 'path';
import { Folder, LinkItem, LinkStatus, TabGroupColor, User } from './types';
import {
  isLegacyMockLink,
  isLegacySeedFolder,
  moveAndReorderGroupLinks,
  moveAndReorderLinks,
  sortLaneLinks,
} from './kanban-rules';

interface DatabaseState {
  users: User[];
  folders: Folder[];
  links: LinkItem[];
}

const DEFAULT_USER: User = {
  id: 'usr-swiss-01',
  email: 'user@tabflow.app',
  name: 'TabFlow User',
  created_at: '2026-10-01T08:00:00.000Z',
};

const DB_FILE_PATH = path.join(process.cwd(), '.data', 'tabflow-db.json');

let memoryStore: DatabaseState | null = null;

const DEFAULT_COLORS: TabGroupColor[] = [
  'blue',
  'amber',
  'rose',
  'emerald',
  'cyan',
  'purple',
  'orange',
  'zinc',
];

function loadStore(): DatabaseState {
  if (memoryStore) return memoryStore;
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as DatabaseState;
      if (Array.isArray(parsed.links) && Array.isArray(parsed.folders)) {
        const realLinks = parsed.links.filter((l) => !isLegacyMockLink(l));
        const usedFolderIds = new Set(
          realLinks.map((l) => l.folder_id).filter(Boolean)
        );
        const cleanedFolders = parsed.folders
          .filter((f) => !isLegacySeedFolder(f) || usedFolderIds.has(f.id))
          .map((f, idx) => ({
            ...f,
            color: f.color ?? DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
            collapsed: Boolean(f.collapsed),
          }));

        const wasCleaned =
          realLinks.length !== parsed.links.length ||
          cleanedFolders.length !== parsed.folders.length;

        memoryStore = {
          users: Array.isArray(parsed.users) ? parsed.users : [DEFAULT_USER],
          folders: cleanedFolders,
          links: realLinks,
        };
        if (wasCleaned) {
          persistStore(memoryStore);
        }
        return memoryStore;
      }
    }
  } catch {
    // Fallback to empty store on corrupt/unreadable file
  }

  memoryStore = {
    users: [DEFAULT_USER],
    folders: [],
    links: [],
  };
  persistStore(memoryStore);
  return memoryStore;
}

function persistStore(state: DatabaseState): void {
  memoryStore = state;
  try {
    const dir = path.dirname(DB_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } catch {
    // Ephemeral container fallback keeps memoryStore intact
  }
}

function ensureUserExists(store: DatabaseState, userId: string): DatabaseState {
  const exists = store.users.some((u) => u.id === userId);
  if (exists) {
    return store;
  }

  const now = new Date().toISOString();
  const newUser: User = {
    id: userId,
    email: `${userId}@cookie.tabflow.local`,
    name: `User ${userId.slice(-6)}`,
    created_at: now,
  };

  const updated: DatabaseState = {
    users: [...store.users, newUser],
    folders: store.folders,
    links: store.links,
  };

  persistStore(updated);
  return updated;
}

export function getDatabaseSnapshot(userId: string = DEFAULT_USER.id): {
  users: User[];
  folders: Folder[];
  links: LinkItem[];
  user: User;
} {
  const store = ensureUserExists(loadStore(), userId);
  const user =
    store.users.find((u) => u.id === userId) ?? store.users[0] ?? DEFAULT_USER;
  const folders = store.folders
    .filter((f) => f.user_id === userId)
    .sort((a, b) => a.order_index - b.order_index);
  const links = store.links.filter((l) => l.user_id === userId);
  return {
    users: store.users,
    folders,
    links,
    user,
  };
}

export function insertLink(
  input: Omit<LinkItem, 'id' | 'user_id' | 'order_index' | 'created_at' | 'updated_at'> & {
    status?: LinkStatus;
    user_id?: string;
  }
): LinkItem {
  const userId = input.user_id ?? DEFAULT_USER.id;
  const store = ensureUserExists(loadStore(), userId);
  const status = input.status ?? LinkStatus.UNREAD;

  let nextFolders = store.folders;
  const userFolders = store.folders
    .filter((f) => f.user_id === userId)
    .sort((a, b) => a.order_index - b.order_index);
  let targetFolderId =
    input.folder_id && userFolders.some((f) => f.id === input.folder_id)
      ? input.folder_id
      : (userFolders[0]?.id ?? null);

  if (!targetFolderId) {
    const defaultFolder: Folder = {
      id: `fld-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      user_id: userId,
      name: 'Tab đã lưu',
      parent_id: null,
      order_index: 0,
      color: 'blue',
      collapsed: false,
    };
    targetFolderId = defaultFolder.id;
    nextFolders = [...store.folders, defaultFolder];
  }

  const updatedLinks = store.links.map((item) =>
    item.user_id === userId && item.status === status
      ? { ...item, order_index: item.order_index + 1 }
      : item
  );

  const now = new Date().toISOString();
  const newLink: LinkItem = {
    id: `lnk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    user_id: userId,
    folder_id: targetFolderId,
    url: input.url,
    domain: input.domain,
    title: input.title,
    description: input.description,
    image_url: input.image_url,
    favicon: input.favicon,
    status,
    order_index: 0,
    reading_minutes: input.reading_minutes,
    video_duration: input.video_duration ?? null,
    channel_name: input.channel_name ?? null,
    tags: input.tags,
    scrape_status: input.scrape_status,
    created_at: now,
    updated_at: now,
  };

  persistStore({
    ...store,
    folders: nextFolders,
    links: [newLink, ...updatedLinks],
  });

  return newLink;
}

export function updateLinkById(
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
  > & {
    target_link_id?: string | null;
    position?: 'before' | 'after';
  },
  userId: string = DEFAULT_USER.id
): { link: LinkItem | null; links: LinkItem[] } {
  const store = ensureUserExists(loadStore(), userId);
  const existing = store.links.find(
    (item) => item.id === id && item.user_id === userId
  );
  if (!existing) {
    return {
      link: null,
      links: store.links.filter((l) => l.user_id === userId),
    };
  }

  const { target_link_id, position, ...restPatch } = patch;
  const definedPatch = Object.fromEntries(
    Object.entries(restPatch).filter(([, value]) => value !== undefined)
  );

  let userLinks = store.links
    .filter((item) => item.user_id === userId)
    .map((item) =>
      item.id === id
        ? {
            ...item,
            ...definedPatch,
            updated_at: new Date().toISOString(),
          }
        : item
    );

  if (
    target_link_id !== undefined ||
    position !== undefined ||
    restPatch.folder_id !== undefined
  ) {
    const targetFolderId =
      restPatch.folder_id !== undefined
        ? restPatch.folder_id
        : existing.folder_id;
    userLinks = moveAndReorderGroupLinks(userLinks, {
      linkId: id,
      targetFolderId,
      targetLinkId: target_link_id,
      position,
      targetIndex: restPatch.order_index,
    });
  } else if (
    restPatch.status !== undefined ||
    restPatch.order_index !== undefined
  ) {
    const targetStatus = restPatch.status ?? existing.status;
    const targetIndex =
      restPatch.order_index !== undefined
        ? restPatch.order_index
        : sortLaneLinks(userLinks, targetStatus).findIndex((l) => l.id === id);
    userLinks = moveAndReorderLinks(userLinks, id, targetStatus, targetIndex);
  }

  const otherLinks = store.links.filter((item) => item.user_id !== userId);
  persistStore({
    ...store,
    links: [...userLinks, ...otherLinks],
  });

  const updated = userLinks.find((item) => item.id === id) ?? null;
  return { link: updated, links: userLinks };
}

export function deleteLinkById(
  id: string,
  userId: string = DEFAULT_USER.id
): { deleted: boolean; links: LinkItem[] } {
  const store = ensureUserExists(loadStore(), userId);
  const exists = store.links.some(
    (item) => item.id === id && item.user_id === userId
  );
  if (!exists) {
    return {
      deleted: false,
      links: store.links.filter((l) => l.user_id === userId),
    };
  }

  const remainingUserLinks = store.links.filter(
    (item) => item.user_id === userId && item.id !== id
  );
  const statuses = [LinkStatus.UNREAD, LinkStatus.READING, LinkStatus.ARCHIVED];
  const normalizedUserLinks: LinkItem[] = [];
  for (const status of statuses) {
    sortLaneLinks(remainingUserLinks, status).forEach((item, idx) => {
      normalizedUserLinks.push({ ...item, order_index: idx });
    });
  }

  const otherLinks = store.links.filter((item) => item.user_id !== userId);
  persistStore({
    ...store,
    links: [...normalizedUserLinks, ...otherLinks],
  });

  return { deleted: true, links: normalizedUserLinks };
}

export function insertFolder(
  name: string,
  parent_id: string | null,
  color?: TabGroupColor,
  userId: string = DEFAULT_USER.id
): Folder {
  const store = ensureUserExists(loadStore(), userId);
  const userFolders = store.folders.filter((f) => f.user_id === userId);
  const siblings = userFolders.filter((f) => f.parent_id === parent_id);
  const chosenColor =
    color ?? DEFAULT_COLORS[userFolders.length % DEFAULT_COLORS.length];
  const maxOrderIndex = siblings.reduce(
    (max, f) => Math.max(max, f.order_index ?? 0),
    -1
  );
  const newFolder: Folder = {
    id: `fld-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    user_id: userId,
    name: name.trim(),
    parent_id,
    order_index: maxOrderIndex + 1,
    color: chosenColor,
    collapsed: false,
  };

  persistStore({
    ...store,
    folders: [...store.folders, newFolder],
  });

  return newFolder;
}

export function updateFolderById(
  id: string,
  patch: Partial<
    Pick<Folder, 'name' | 'color' | 'collapsed' | 'parent_id' | 'order_index'>
  >,
  userId: string = DEFAULT_USER.id
): Folder[] {
  const store = ensureUserExists(loadStore(), userId);
  const definedPatch = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined)
  );
  const nextFolders = store.folders.map((folder) =>
    folder.id === id && folder.user_id === userId
      ? { ...folder, ...definedPatch }
      : folder
  );
  persistStore({
    ...store,
    folders: nextFolders,
  });
  return nextFolders
    .filter((f) => f.user_id === userId)
    .sort((a, b) => a.order_index - b.order_index);
}

export function reorderUserFolders(
  orderedIds: string[],
  userId: string = DEFAULT_USER.id
): Folder[] {
  const store = ensureUserExists(loadStore(), userId);
  const userFolders = store.folders
    .filter((f) => f.user_id === userId)
    .sort((a, b) => a.order_index - b.order_index);

  const byId = new Map(userFolders.map((f) => [f.id, f]));
  const seen = new Set<string>();
  const reorderedUserFolders: Folder[] = [];

  for (const rawId of orderedIds) {
    const id = typeof rawId === 'string' ? rawId.trim() : '';
    const folder = byId.get(id);
    if (folder && !seen.has(id)) {
      seen.add(id);
      reorderedUserFolders.push(folder);
    }
  }

  for (const folder of userFolders) {
    if (!seen.has(folder.id)) {
      reorderedUserFolders.push(folder);
    }
  }

  const normalizedUserFolders = reorderedUserFolders.map((folder, index) => ({
    ...folder,
    order_index: index,
  }));

  const otherFolders = store.folders.filter((f) => f.user_id !== userId);
  persistStore({
    ...store,
    folders: [...normalizedUserFolders, ...otherFolders],
  });

  return normalizedUserFolders;
}

export function deleteFolderById(
  id: string,
  userId: string = DEFAULT_USER.id
): {
  folders: Folder[];
  links: LinkItem[];
} {
  const store = ensureUserExists(loadStore(), userId);
  const remainingUserFolders = store.folders
    .filter(
      (f) => f.user_id === userId && f.id !== id && f.parent_id !== id
    )
    .sort((a, b) => a.order_index - b.order_index)
    .map((f, index) => ({ ...f, order_index: index }));
  const otherFolders = store.folders.filter((f) => f.user_id !== userId);
  const nextLinks = store.links.filter(
    (l) => l.user_id !== userId || l.folder_id !== id
  );
  persistStore({
    ...store,
    folders: [...remainingUserFolders, ...otherFolders],
    links: nextLinks,
  });
  return {
    folders: remainingUserFolders,
    links: nextLinks.filter((l) => l.user_id === userId),
  };
}
