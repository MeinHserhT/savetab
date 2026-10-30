'use client';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { Folder, LinkItem, LinkStatus, TabGroupColor } from './types';
import { isLegacyMockLink, isLegacySeedFolder } from './kanban-rules';

// Initialize Firebase App & Services
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Validation Constants synchronized with firebase-blueprint.json & firestore.rules
export const BLUEPRINT_ID_PATTERN = '^[a-zA-Z0-9_\\-]+$';
export const BLUEPRINT_ID_REGEX = new RegExp(BLUEPRINT_ID_PATTERN);
export const MAX_ID_LENGTH = 128;
export const MAX_DISPLAY_NAME_LENGTH = 80;
export const MAX_FOLDER_NAME_LENGTH = 120;
export const MAX_LINK_URL_LENGTH = 2048;
export const MAX_LINK_DOMAIN_LENGTH = 255;
export const MAX_LINK_TITLE_LENGTH = 300;
export const MAX_LINK_DESCRIPTION_LENGTH = 1000;

const ALLOWED_COLORS: TabGroupColor[] = [
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

const ALLOWED_STATUSES: LinkStatus[] = [
  LinkStatus.UNREAD,
  LinkStatus.READING,
  LinkStatus.ARCHIVED,
];

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate Connection to Firestore on client boot
let connectionTested = false;
export async function testFirestoreConnection(): Promise<void> {
  if (typeof window === 'undefined' || connectionTested) return;
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

if (typeof window !== 'undefined') {
  void testFirestoreConnection();
}

export function sanitizeId(rawId: string, prefix = 'id'): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, MAX_ID_LENGTH);
  if (!cleaned || !BLUEPRINT_ID_REGEX.test(cleaned)) {
    return `${prefix}-${Date.now()}`;
  }
  return cleaned;
}

export function sanitizeFolderName(name: string): string {
  const trimmed = name.trim().slice(0, MAX_FOLDER_NAME_LENGTH);
  return trimmed.length > 0 ? trimmed : 'Untitled Group';
}

export function sanitizeColor(color?: TabGroupColor): TabGroupColor {
  if (color && ALLOWED_COLORS.includes(color)) {
    return color;
  }
  return 'blue';
}

export function sanitizeStatus(status?: LinkStatus): LinkStatus {
  if (status && ALLOWED_STATUSES.includes(status)) {
    return status;
  }
  return LinkStatus.UNREAD;
}

function timestampToIso(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string' && val.length > 0) {
    return val;
  }
  return new Date().toISOString();
}

export function canSyncWithFirestore(user?: {
  emailVerified?: boolean;
  isAnonymous?: boolean;
} | null): boolean {
  const target = user ?? auth.currentUser;
  if (!target) return false;
  return Boolean(target.emailVerified || target.isAnonymous);
}

export async function upsertUserProfileInFirestore(user: {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  isAnonymous?: boolean;
}): Promise<void> {
  if (!canSyncWithFirestore(user)) return;
  const uid = sanitizeId(user.uid, 'usr');
  const userPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);

  const defaultLabel = user.isAnonymous ? 'Guest User' : 'TabFlow User';
  const displayName =
    (user.displayName || defaultLabel)
      .trim()
      .slice(0, MAX_DISPLAY_NAME_LENGTH) || defaultLabel;
  const photoURL = (user.photoURL || '').trim().slice(0, MAX_LINK_URL_LENGTH);

  let exists = false;
  let existingDisplayName = '';
  let existingPhotoURL = '';

  try {
    const snap = await getDoc(userRef);
    exists = snap.exists();
    if (exists) {
      const data = snap.data();
      existingDisplayName =
        typeof data?.displayName === 'string' ? data.displayName : '';
      existingPhotoURL =
        typeof data?.photoURL === 'string' ? data.photoURL : '';
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  if (!exists) {
    try {
      await setDoc(userRef, {
        uid,
        displayName,
        photoURL,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, userPath);
    }
  } else if (
    existingDisplayName !== displayName ||
    existingPhotoURL !== photoURL
  ) {
    try {
      await updateDoc(userRef, {
        displayName,
        photoURL,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, userPath);
    }
  }
}

export async function ensureUserWorkspaceSeededInFirestore(
  uid: string,
  seedFolders: Folder[],
  seedLinks: LinkItem[]
): Promise<void> {
  if (!canSyncWithFirestore(auth.currentUser)) return;
  const safeUid = sanitizeId(uid, 'usr');

  const realLinks = seedLinks.filter((l) => !isLegacyMockLink(l));
  const usedFolderIds = new Set(
    realLinks.map((l) => l.folder_id).filter(Boolean)
  );
  const realFolders = seedFolders.filter(
    (f) => !isLegacySeedFolder(f) || usedFolderIds.has(f.id)
  );

  if (realFolders.length === 0 && realLinks.length === 0) {
    return;
  }

  try {
    const foldersQuery = query(
      collection(db, 'folders'),
      where('user_id', '==', safeUid)
    );
    const existingFoldersSnap = await getDocs(foldersQuery);
    if (!existingFoldersSnap.empty) {
      return;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'folders');
  }

  const folderIdMap = new Map<string, string>();

  for (let i = 0; i < realFolders.length; i++) {
    const f = realFolders[i];
    const newFolderId = sanitizeId(
      `fld-${safeUid.slice(0, 8)}-${i}-${Date.now().toString(36)}`,
      'fld'
    );
    folderIdMap.set(f.id, newFolderId);
    const folderPath = `folders/${newFolderId}`;
    try {
      await setDoc(doc(db, 'folders', newFolderId), {
        id: newFolderId,
        user_id: safeUid,
        name: sanitizeFolderName(f.name),
        color: sanitizeColor(f.color),
        collapsed: Boolean(f.collapsed),
        order_index: Math.max(0, Math.min(10000, Number(f.order_index) || i)),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, folderPath);
    }
  }

  let fallbackFolderId = Array.from(folderIdMap.values())[0];
  if (!fallbackFolderId && realLinks.length > 0) {
    fallbackFolderId = sanitizeId(
      `fld-${safeUid.slice(0, 8)}-0-${Date.now().toString(36)}`,
      'fld'
    );
    try {
      await setDoc(doc(db, 'folders', fallbackFolderId), {
        id: fallbackFolderId,
        user_id: safeUid,
        name: 'Tab đã lưu',
        color: 'blue',
        collapsed: false,
        order_index: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.CREATE,
        `folders/${fallbackFolderId}`
      );
    }
  }
  if (!fallbackFolderId) return;

  for (let i = 0; i < realLinks.length; i++) {
    const l = realLinks[i];
    const mappedFolderId =
      (l.folder_id ? folderIdMap.get(l.folder_id) : undefined) ||
      fallbackFolderId;
    const newLinkId = sanitizeId(
      `lnk-${safeUid.slice(0, 8)}-${i}-${Date.now().toString(36)}`,
      'lnk'
    );
    const linkPath = `links/${newLinkId}`;
    try {
      await setDoc(doc(db, 'links', newLinkId), {
        id: newLinkId,
        user_id: safeUid,
        folder_id: mappedFolderId,
        url: (l.url || 'https://example.com').slice(0, MAX_LINK_URL_LENGTH),
        domain: (l.domain || 'example.com').slice(0, MAX_LINK_DOMAIN_LENGTH),
        title: (l.title || l.domain || 'Saved Tab').slice(
          0,
          MAX_LINK_TITLE_LENGTH
        ),
        description: (l.description || '').slice(
          0,
          MAX_LINK_DESCRIPTION_LENGTH
        ),
        image_url: (l.image_url || '').slice(0, MAX_LINK_URL_LENGTH),
        favicon: (l.favicon || '/favicon.ico').slice(0, MAX_LINK_URL_LENGTH),
        status: sanitizeStatus(l.status),
        order_index: Math.max(0, Math.min(10000, Number(l.order_index) || i)),
        reading_minutes: Math.max(
          1,
          Math.min(1000, Number(l.reading_minutes) || 5)
        ),
        scrape_status:
          l.scrape_status === 'degraded' || l.scrape_status === 'manual'
            ? l.scrape_status
            : 'ok',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, linkPath);
    }
  }
}

export function subscribeToUserWorkspace(
  uid: string,
  onFoldersChange: (folders: Folder[]) => void,
  onLinksChange: (links: LinkItem[]) => void
): () => void {
  const safeUid = sanitizeId(uid, 'usr');

  const foldersQuery = query(
    collection(db, 'folders'),
    where('user_id', '==', safeUid)
  );
  const linksQuery = query(
    collection(db, 'links'),
    where('user_id', '==', safeUid)
  );

  let latestRawFolders: Array<{ docId: string; folder: Folder }> = [];
  let latestRealLinks: LinkItem[] = [];
  let hasLoadedFolders = false;
  let hasLoadedLinks = false;
  const deletedFolderDocIds = new Set<string>();
  const deletedLinkDocIds = new Set<string>();

  const emitCleanedFolders = () => {
    if (!hasLoadedFolders) return;
    if (!hasLoadedLinks) {
      // Wait until initial links snapshot arrives before deciding whether legacy seed folders are empty
      const nonSeedFolders = latestRawFolders
        .filter((entry) => !isLegacySeedFolder(entry.folder))
        .map((entry) => entry.folder);
      onFoldersChange(nonSeedFolders);
      return;
    }

    const usedFolderIds = new Set(
      latestRealLinks.map((l) => l.folder_id).filter(Boolean)
    );

    const activeFolders: Folder[] = [];
    for (const entry of latestRawFolders) {
      const isLegacyEmptySeed =
        isLegacySeedFolder(entry.folder) &&
        !usedFolderIds.has(entry.folder.id);

      if (isLegacyEmptySeed) {
        if (!deletedFolderDocIds.has(entry.docId)) {
          deletedFolderDocIds.add(entry.docId);
          void deleteDoc(doc(db, 'folders', entry.docId)).catch(() => {});
        }
      } else {
        activeFolders.push(entry.folder);
      }
    }

    onFoldersChange(activeFolders);
  };

  const unsubFolders = onSnapshot(
    foldersQuery,
    (snapshot) => {
      latestRawFolders = snapshot.docs
        .map((docSnap) => {
          const d = docSnap.data();
          return {
            docId: docSnap.id,
            folder: {
              id: String(d.id || docSnap.id),
              user_id: String(d.user_id || safeUid),
              name: String(d.name || 'Untitled'),
              parent_id: null,
              order_index: Number(d.order_index ?? 0),
              color: sanitizeColor(d.color as TabGroupColor),
              collapsed: Boolean(d.collapsed),
            },
          };
        })
        .sort((a, b) => a.folder.order_index - b.folder.order_index);
      hasLoadedFolders = true;
      emitCleanedFolders();
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'folders');
    }
  );

  const unsubLinks = onSnapshot(
    linksQuery,
    (snapshot) => {
      const realLinks: LinkItem[] = [];
      for (const docSnap of snapshot.docs) {
        const d = docSnap.data();
        if (isLegacyMockLink(d)) {
          if (!deletedLinkDocIds.has(docSnap.id)) {
            deletedLinkDocIds.add(docSnap.id);
            void deleteDoc(doc(db, 'links', docSnap.id)).catch(() => {});
          }
          continue;
        }
        realLinks.push({
          id: String(d.id || docSnap.id),
          user_id: String(d.user_id || safeUid),
          folder_id: d.folder_id ? String(d.folder_id) : null,
          url: String(d.url || ''),
          domain: String(d.domain || ''),
          title: String(d.title || ''),
          description: String(d.description || ''),
          image_url: d.image_url ? String(d.image_url) : null,
          favicon: String(d.favicon || ''),
          status: sanitizeStatus(d.status as LinkStatus),
          order_index: Number(d.order_index ?? 0),
          reading_minutes: Number(d.reading_minutes ?? 5),
          tags: [],
          scrape_status:
            d.scrape_status === 'degraded' || d.scrape_status === 'manual'
              ? d.scrape_status
              : 'ok',
          created_at: timestampToIso(d.createdAt),
          updated_at: timestampToIso(d.updatedAt),
        });
      }
      realLinks.sort((a, b) => a.order_index - b.order_index);
      latestRealLinks = realLinks;
      hasLoadedLinks = true;
      onLinksChange(realLinks);
      emitCleanedFolders();
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'links');
    }
  );

  return () => {
    unsubFolders();
    unsubLinks();
  };
}

export async function createFolderInFirestore(
  uid: string,
  folder: Folder
): Promise<void> {
  if (!canSyncWithFirestore(auth.currentUser)) return;
  const safeUid = sanitizeId(uid, 'usr');
  const folderId = sanitizeId(folder.id, 'fld');
  const path = `folders/${folderId}`;
  try {
    await setDoc(doc(db, 'folders', folderId), {
      id: folderId,
      user_id: safeUid,
      name: sanitizeFolderName(folder.name),
      color: sanitizeColor(folder.color),
      collapsed: Boolean(folder.collapsed),
      order_index: Math.max(
        0,
        Math.min(10000, Number(folder.order_index) || 0)
      ),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateFolderInFirestore(
  folderId: string,
  patch: Partial<Pick<Folder, 'name' | 'color' | 'collapsed' | 'order_index'>>
): Promise<void> {
  if (!canSyncWithFirestore(auth.currentUser)) return;
  const safeId = sanitizeId(folderId, 'fld');
  const path = `folders/${safeId}`;
  const updatePayload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (patch.name !== undefined) {
    updatePayload.name = sanitizeFolderName(patch.name);
  }
  if (patch.color !== undefined) {
    updatePayload.color = sanitizeColor(patch.color);
  }
  if (patch.collapsed !== undefined) {
    updatePayload.collapsed = Boolean(patch.collapsed);
  }
  if (patch.order_index !== undefined) {
    updatePayload.order_index = Math.max(
      0,
      Math.min(10000, Number(patch.order_index) || 0)
    );
  }

  try {
    await updateDoc(doc(db, 'folders', safeId), updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteFolderInFirestore(
  folderId: string,
  userLinks: LinkItem[]
): Promise<void> {
  if (!canSyncWithFirestore(auth.currentUser)) return;
  const safeId = sanitizeId(folderId, 'fld');
  const folderLinks = userLinks.filter((l) => l.folder_id === safeId);

  for (const link of folderLinks) {
    const safeLinkId = sanitizeId(link.id, 'lnk');
    try {
      await deleteDoc(doc(db, 'links', safeLinkId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `links/${safeLinkId}`);
    }
  }

  try {
    await deleteDoc(doc(db, 'folders', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `folders/${safeId}`);
  }
}

export async function createLinkInFirestore(
  uid: string,
  link: LinkItem,
  fallbackFolderId: string
): Promise<void> {
  if (!canSyncWithFirestore(auth.currentUser)) return;
  const safeUid = sanitizeId(uid, 'usr');
  const linkId = sanitizeId(link.id, 'lnk');
  const targetFolderId = sanitizeId(
    link.folder_id || fallbackFolderId,
    'fld'
  );
  const path = `links/${linkId}`;

  try {
    await setDoc(doc(db, 'links', linkId), {
      id: linkId,
      user_id: safeUid,
      folder_id: targetFolderId,
      url: (link.url || 'https://example.com').slice(0, MAX_LINK_URL_LENGTH),
      domain: (link.domain || 'example.com').slice(0, MAX_LINK_DOMAIN_LENGTH),
      title: (link.title || link.domain || 'Saved Tab').slice(
        0,
        MAX_LINK_TITLE_LENGTH
      ),
      description: (link.description || '').slice(
        0,
        MAX_LINK_DESCRIPTION_LENGTH
      ),
      image_url: (link.image_url || '').slice(0, MAX_LINK_URL_LENGTH),
      favicon: (link.favicon || '/favicon.ico').slice(0, MAX_LINK_URL_LENGTH),
      status: sanitizeStatus(link.status),
      order_index: Math.max(0, Math.min(10000, Number(link.order_index) || 0)),
      reading_minutes: Math.max(
        1,
        Math.min(1000, Number(link.reading_minutes) || 5)
      ),
      scrape_status:
        link.scrape_status === 'degraded' || link.scrape_status === 'manual'
          ? link.scrape_status
          : 'ok',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateLinkInFirestore(
  linkId: string,
  patch: Partial<
    Pick<
      LinkItem,
      'title' | 'description' | 'folder_id' | 'status' | 'order_index'
    >
  >
): Promise<void> {
  if (!canSyncWithFirestore(auth.currentUser)) return;
  const safeId = sanitizeId(linkId, 'lnk');
  const path = `links/${safeId}`;
  const updatePayload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (patch.title !== undefined) {
    updatePayload.title =
      patch.title.trim().slice(0, MAX_LINK_TITLE_LENGTH) || 'Saved Tab';
  }
  if (patch.description !== undefined) {
    updatePayload.description = patch.description.slice(
      0,
      MAX_LINK_DESCRIPTION_LENGTH
    );
  }
  if (patch.folder_id !== undefined && patch.folder_id !== null) {
    updatePayload.folder_id = sanitizeId(patch.folder_id, 'fld');
  }
  if (patch.status !== undefined) {
    updatePayload.status = sanitizeStatus(patch.status);
  }
  if (patch.order_index !== undefined) {
    updatePayload.order_index = Math.max(
      0,
      Math.min(10000, Number(patch.order_index) || 0)
    );
  }

  // Only write to Firestore if at least one Firestore-governed field changed
  if (Object.keys(updatePayload).length <= 1) {
    return;
  }

  try {
    await updateDoc(doc(db, 'links', safeId), updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteLinkInFirestore(linkId: string): Promise<void> {
  if (!canSyncWithFirestore(auth.currentUser)) return;
  const safeId = sanitizeId(linkId, 'lnk');
  const path = `links/${safeId}`;
  try {
    await deleteDoc(doc(db, 'links', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
