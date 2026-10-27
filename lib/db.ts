import fs from 'fs';
import path from 'path';
import { Folder, LinkItem, LinkStatus, TabGroupColor, User } from './types';
import { moveAndReorderLinks, sortLaneLinks } from './kanban-rules';

export const SQL_SCHEMA_DEFINITION = `
-- Phase 2: Minimal Relational Schema (SQLite / PostgreSQL / Prisma Equivalent)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE folders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
  color TEXT NOT NULL DEFAULT 'blue',
  collapsed INTEGER NOT NULL DEFAULT 0,
  order_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE links (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  favicon TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('UNREAD', 'READING', 'ARCHIVED')) DEFAULT 'UNREAD',
  order_index INTEGER NOT NULL DEFAULT 0,
  reading_minutes INTEGER NOT NULL DEFAULT 5,
  tags_json TEXT NOT NULL DEFAULT '[]',
  scrape_status TEXT NOT NULL DEFAULT 'ok',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_links_user_status_order ON links(user_id, status, order_index);
CREATE INDEX idx_links_folder ON links(folder_id);
`.trim();

interface DatabaseState {
  users: User[];
  folders: Folder[];
  links: LinkItem[];
}

const DEFAULT_USER: User = {
  id: 'usr-swiss-01',
  email: 'curator@tabflow.ch',
  name: 'Dieter Müller',
  created_at: '2026-10-01T08:00:00.000Z',
};

const SEED_FOLDERS: Folder[] = [
  {
    id: 'fld-dist',
    user_id: DEFAULT_USER.id,
    name: 'Distributed Systems',
    parent_id: null,
    order_index: 0,
    color: 'blue',
    collapsed: false,
  },
  {
    id: 'fld-compilers',
    user_id: DEFAULT_USER.id,
    name: 'Compilers & Runtime',
    parent_id: null,
    order_index: 1,
    color: 'amber',
    collapsed: false,
  },
  {
    id: 'fld-swiss',
    user_id: DEFAULT_USER.id,
    name: 'UI & Design Systems',
    parent_id: null,
    order_index: 2,
    color: 'rose',
    collapsed: false,
  },
  {
    id: 'fld-eng',
    user_id: DEFAULT_USER.id,
    name: 'Reading Later',
    parent_id: null,
    order_index: 3,
    color: 'emerald',
    collapsed: false,
  },
];

const SEED_LINKS: LinkItem[] = [
  {
    id: 'lnk-01',
    user_id: DEFAULT_USER.id,
    folder_id: 'fld-swiss',
    url: 'https://grid-systems.ch/essays/muller-brockmann-modular-proportions',
    domain: 'grid-systems.ch',
    title: 'Modular Grid Proportions in High-Density Information Interfaces',
    description:
      'How Josef Müller-Brockmann mathematical field divisions eliminate visual noise and enforce strict typographic hierarchy in modern web workspaces.',
    image_url: '/covers/swiss-grid.svg',
    favicon: '/covers/swiss-grid.svg',
    status: LinkStatus.UNREAD,
    order_index: 0,
    reading_minutes: 9,
    tags: ['typography', 'grid-systems', 'architecture'],
    scrape_status: 'ok',
    created_at: '2026-10-24T10:15:00.000Z',
    updated_at: '2026-10-24T10:15:00.000Z',
  },
  {
    id: 'lnk-02',
    user_id: DEFAULT_USER.id,
    folder_id: 'fld-dist',
    url: 'https://raft.github.io/papers/raft-extended-linearizability.pdf',
    domain: 'raft.github.io',
    title: 'In Search of an Understandable Consensus Algorithm (Extended Edition)',
    description:
      'Leader election, log replication safety invariants, and split-vote recovery latencies across geo-distributed state machines.',
    image_url: '/covers/distributed-raft.svg',
    favicon: '/covers/distributed-raft.svg',
    status: LinkStatus.UNREAD,
    order_index: 1,
    reading_minutes: 18,
    tags: ['distributed-systems', 'consensus', 'protocols'],
    scrape_status: 'ok',
    created_at: '2026-10-25T14:20:00.000Z',
    updated_at: '2026-10-25T14:20:00.000Z',
  },
  {
    id: 'lnk-03',
    user_id: DEFAULT_USER.id,
    folder_id: 'fld-dist',
    url: 'https://inkandswitch.com/local-first/crdt-automerge-sync',
    domain: 'inkandswitch.com',
    title: 'Local-First Software: You Own Your Data, in Spite of the Cloud',
    description:
      'Evaluating Conflict-Free Replicated Data Types (CRDTs) for zero-latency optimistic UI mutations and offline-capable collaborative workspaces.',
    image_url: '/covers/local-first-crdt.svg',
    favicon: '/covers/local-first-crdt.svg',
    status: LinkStatus.READING,
    order_index: 0,
    reading_minutes: 14,
    tags: ['local-first', 'crdt', 'state-machines'],
    scrape_status: 'ok',
    created_at: '2026-10-25T18:00:00.000Z',
    updated_at: '2026-10-26T09:10:00.000Z',
  },
  {
    id: 'lnk-04',
    user_id: DEFAULT_USER.id,
    folder_id: 'fld-compilers',
    url: 'https://v8.dev/blog/liftoff-wasm-baseline-simd-pipeline',
    domain: 'v8.dev',
    title: 'Zero-Copy Parsing & Single-Pass WebAssembly Baseline Compilation',
    description:
      'Reducing cold-start compilation overhead by 78% via register-allocated single-pass codegen and L1 cache-aligned AST arenas.',
    image_url: '/covers/wasm-jit.svg',
    favicon: '/covers/wasm-jit.svg',
    status: LinkStatus.READING,
    order_index: 1,
    reading_minutes: 11,
    tags: ['compilers', 'wasm', 'performance'],
    scrape_status: 'ok',
    created_at: '2026-10-26T02:30:00.000Z',
    updated_at: '2026-10-26T11:45:00.000Z',
  },
  {
    id: 'lnk-05',
    user_id: DEFAULT_USER.id,
    folder_id: 'fld-swiss',
    url: 'https://w3c.github.io/design-tokens/format-specification',
    domain: 'w3c.github.io',
    title: 'Semantic Token Architecture & Perceptual Contrast Math (APCA / WCAG)',
    description:
      'Formalizing surface luminance deltas, optical dark-mode weight compensation, and deterministic component state tokens.',
    image_url: '/covers/design-tokens.svg',
    favicon: '/covers/design-tokens.svg',
    status: LinkStatus.ARCHIVED,
    order_index: 0,
    reading_minutes: 7,
    tags: ['design-tokens', 'accessibility', 'typography'],
    scrape_status: 'ok',
    created_at: '2026-10-20T16:00:00.000Z',
    updated_at: '2026-10-23T20:00:00.000Z',
  },
];

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
        parsed.folders = parsed.folders.map((f, idx) => ({
          ...f,
          color: f.color ?? DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
          collapsed: Boolean(f.collapsed),
        }));
        memoryStore = parsed;
        return memoryStore;
      }
    }
  } catch {
    // Fallback to initial seed on corrupt/unreadable file
  }

  memoryStore = {
    users: [DEFAULT_USER],
    folders: structuredClone(SEED_FOLDERS),
    links: structuredClone(SEED_LINKS),
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

  const folderIdMap = new Map<string, string>();
  const userFolders: Folder[] = SEED_FOLDERS.map((seedFolder, idx) => {
    const newFolderId = `${seedFolder.id}-${userId.slice(-6)}-${idx}`;
    folderIdMap.set(seedFolder.id, newFolderId);
    return {
      ...seedFolder,
      id: newFolderId,
      user_id: userId,
    };
  });

  const userLinks: LinkItem[] = SEED_LINKS.map((seedLink, idx) => ({
    ...seedLink,
    id: `${seedLink.id}-${userId.slice(-6)}-${idx}`,
    user_id: userId,
    folder_id: seedLink.folder_id
      ? (folderIdMap.get(seedLink.folder_id) ?? null)
      : null,
    created_at: now,
    updated_at: now,
  }));

  const updated: DatabaseState = {
    users: [...store.users, newUser],
    folders: [...store.folders, ...userFolders],
    links: [...store.links, ...userLinks],
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
  const folders = store.folders.filter((f) => f.user_id === userId);
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

  const updatedLinks = store.links.map((item) =>
    item.user_id === userId && item.status === status
      ? { ...item, order_index: item.order_index + 1 }
      : item
  );

  const now = new Date().toISOString();
  const newLink: LinkItem = {
    id: `lnk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    user_id: userId,
    folder_id: input.folder_id,
    url: input.url,
    domain: input.domain,
    title: input.title,
    description: input.description,
    image_url: input.image_url,
    favicon: input.favicon,
    status,
    order_index: 0,
    reading_minutes: input.reading_minutes,
    tags: input.tags,
    scrape_status: input.scrape_status,
    created_at: now,
    updated_at: now,
  };

  persistStore({
    ...store,
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
    >
  >,
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

  const definedPatch = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined)
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

  if (patch.status !== undefined || patch.order_index !== undefined) {
    const targetStatus = patch.status ?? existing.status;
    const targetIndex =
      patch.order_index !== undefined
        ? patch.order_index
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
  const newFolder: Folder = {
    id: `fld-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    user_id: userId,
    name: name.trim(),
    parent_id,
    order_index: siblings.length,
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
  patch: Partial<Pick<Folder, 'name' | 'color' | 'collapsed' | 'parent_id'>>,
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
  return nextFolders.filter((f) => f.user_id === userId);
}

export function deleteFolderById(
  id: string,
  userId: string = DEFAULT_USER.id
): {
  folders: Folder[];
  links: LinkItem[];
} {
  const store = ensureUserExists(loadStore(), userId);
  const nextFolders = store.folders.filter(
    (f) =>
      f.user_id !== userId || (f.id !== id && f.parent_id !== id)
  );
  const nextLinks = store.links.filter(
    (l) => l.user_id !== userId || l.folder_id !== id
  );
  persistStore({
    ...store,
    folders: nextFolders,
    links: nextLinks,
  });
  return {
    folders: nextFolders.filter((f) => f.user_id === userId),
    links: nextLinks.filter((l) => l.user_id === userId),
  };
}
