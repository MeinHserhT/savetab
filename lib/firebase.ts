'use client';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
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
import {
  Folder,
  LinkItem,
  LinkStatus,
  TAB_GROUP_COLORS,
  TabGroupColor,
} from './types';
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

const ALLOWED_COLORS: readonly TabGroupColor[] = TAB_GROUP_COLORS;

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

const knownCloudFolderIds = new Set<string>();
const knownCloudLinkIds = new Set<string>();
let hasLoadedCloudFolders = false;
let hasLoadedCloudLinks = false;
const migratedUserIds = new Set<string>();

function resolveCurrentSafeUid(explicitUid?: string): string | null {
  const raw = explicitUid || auth.currentUser?.uid;
  if (!raw) return null;
  return sanitizeId(raw, 'usr');
}

/**
 * Automatically migrates any folders and links owned by `safeUid` from legacy
 * top-level `/folders` and `/links` collections into `/users/{safeUid}/folders`
 * and `/users/{safeUid}/links`, then cleans up the legacy root documents.
 */
export async function migrateLegacyRootWorkspaceIfNeeded(
  uid: string
): Promise<void> {
  if (!canSyncWithFirestore(auth.currentUser)) return;
  const safeUid = sanitizeId(uid, 'usr');
  if (migratedUserIds.has(safeUid)) return;
  migratedUserIds.add(safeUid);

  try {
    const legacyFoldersSnap = await getDocs(
      query(collection(db, 'folders'), where('user_id', '==', safeUid))
    );
    const legacyLinksSnap = await getDocs(
      query(collection(db, 'links'), where('user_id', '==', safeUid))
    );

    if (legacyFoldersSnap.empty && legacyLinksSnap.empty) {
      return;
    }

    const validSubFolderIds = new Set<string>();

    // 1. Migrate legacy folders into /users/{safeUid}/folders/{folderId}
    for (let i = 0; i < legacyFoldersSnap.docs.length; i++) {
      const docSnap = legacyFoldersSnap.docs[i];
      const d = docSnap.data();
      const folderObj: Folder = {
        id: String(d.id || docSnap.id),
        user_id: safeUid,
        name: String(d.name || 'Tab đã lưu'),
        parent_id: null,
        order_index: Number(d.order_index ?? i),
        color: sanitizeColor(d.color as TabGroupColor),
        collapsed: Boolean(d.collapsed),
      };

      if (isLegacySeedFolder(folderObj) && legacyLinksSnap.empty) {
        await deleteDoc(doc(db, 'folders', docSnap.id)).catch(() => {});
        continue;
      }

      const folderId = sanitizeId(folderObj.id, 'fld');
      const subFolderRef = doc(db, 'users', safeUid, 'folders', folderId);
      const existingSubSnap = await getDoc(subFolderRef);

      if (!existingSubSnap.exists()) {
        await setDoc(subFolderRef, {
          id: folderId,
          user_id: safeUid,
          name: sanitizeFolderName(folderObj.name),
          color: sanitizeColor(folderObj.color),
          collapsed: Boolean(folderObj.collapsed),
          order_index: Math.max(
            0,
            Math.min(10000, Math.round(Number(folderObj.order_index) || i))
          ),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      validSubFolderIds.add(folderId);
      knownCloudFolderIds.add(folderId);
    }

    // 2. Ensure a fallback folder exists if legacy links exist without a migrated folder
    let fallbackFolderId = Array.from(validSubFolderIds)[0] || '';
    if (!legacyLinksSnap.empty && !fallbackFolderId) {
      fallbackFolderId = sanitizeId(`fld-${safeUid.slice(0, 8)}-default`, 'fld');
      const fallbackRef = doc(db, 'users', safeUid, 'folders', fallbackFolderId);
      const fallbackSnap = await getDoc(fallbackRef);
      if (!fallbackSnap.exists()) {
        await setDoc(fallbackRef, {
          id: fallbackFolderId,
          user_id: safeUid,
          name: 'Tab đã lưu',
          color: 'blue',
          collapsed: false,
          order_index: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      validSubFolderIds.add(fallbackFolderId);
      knownCloudFolderIds.add(fallbackFolderId);
    }

    // 3. Migrate legacy links into /users/{safeUid}/links/{linkId}
    for (let i = 0; i < legacyLinksSnap.docs.length; i++) {
      const docSnap = legacyLinksSnap.docs[i];
      const d = docSnap.data();

      if (isLegacyMockLink(d)) {
        await deleteDoc(doc(db, 'links', docSnap.id)).catch(() => {});
        continue;
      }

      const linkId = sanitizeId(String(d.id || docSnap.id), 'lnk');
      const candidateFolderId = d.folder_id
        ? sanitizeId(String(d.folder_id), 'fld')
        : fallbackFolderId;

      let resolvedFolderId = candidateFolderId;
      if (!validSubFolderIds.has(resolvedFolderId)) {
        const checkFolderRef = doc(
          db,
          'users',
          safeUid,
          'folders',
          resolvedFolderId
        );
        const checkFolderSnap = await getDoc(checkFolderRef);
        if (!checkFolderSnap.exists()) {
          resolvedFolderId =
            fallbackFolderId ||
            sanitizeId(`fld-${safeUid.slice(0, 8)}-default`, 'fld');
          const ensureRef = doc(
            db,
            'users',
            safeUid,
            'folders',
            resolvedFolderId
          );
          const ensureSnap = await getDoc(ensureRef);
          if (!ensureSnap.exists()) {
            await setDoc(ensureRef, {
              id: resolvedFolderId,
              user_id: safeUid,
              name: 'Tab đã lưu',
              color: 'blue',
              collapsed: false,
              order_index: 0,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        }
        validSubFolderIds.add(resolvedFolderId);
        knownCloudFolderIds.add(resolvedFolderId);
      }

      const subLinkRef = doc(db, 'users', safeUid, 'links', linkId);
      const existingLinkSnap = await getDoc(subLinkRef);
      if (!existingLinkSnap.exists()) {
        const safeUrl =
          String(d.url || 'https://example.com')
            .trim()
            .slice(0, MAX_LINK_URL_LENGTH) || 'https://example.com';
        const safeDomain =
          String(d.domain || 'example.com')
            .trim()
            .slice(0, MAX_LINK_DOMAIN_LENGTH) || 'example.com';
        const safeTitle =
          String(d.title || safeDomain || 'Saved Tab')
            .trim()
            .slice(0, MAX_LINK_TITLE_LENGTH) || 'Saved Tab';
        const safeDescription = String(d.description || '').slice(
          0,
          MAX_LINK_DESCRIPTION_LENGTH
        );
        const safeImageUrl = String(d.image_url || '')
          .trim()
          .slice(0, MAX_LINK_URL_LENGTH);
        const safeFavicon =
          String(d.favicon || '/favicon.ico')
            .trim()
            .slice(0, MAX_LINK_URL_LENGTH) || '/favicon.ico';

        await setDoc(subLinkRef, {
          id: linkId,
          user_id: safeUid,
          folder_id: resolvedFolderId,
          url: safeUrl,
          domain: safeDomain,
          title: safeTitle,
          description: safeDescription,
          image_url: safeImageUrl,
          favicon: safeFavicon,
          status: sanitizeStatus(d.status as LinkStatus),
          order_index: Math.max(
            0,
            Math.min(10000, Math.round(Number(d.order_index) || i))
          ),
          reading_minutes: Math.max(
            1,
            Math.min(1000, Math.round(Number(d.reading_minutes) || 5))
          ),
          scrape_status:
            d.scrape_status === 'degraded' || d.scrape_status === 'manual'
              ? d.scrape_status
              : 'ok',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      knownCloudLinkIds.add(linkId);

      // Delete legacy root link after copying to /users/{safeUid}/links/{linkId}
      await deleteDoc(doc(db, 'links', docSnap.id)).catch(() => {});
    }

    // 4. Delete legacy root folders after links have been migrated
    for (const docSnap of legacyFoldersSnap.docs) {
      await deleteDoc(doc(db, 'folders', docSnap.id)).catch(() => {});
    }
  } catch (error) {
    console.warn('Legacy root workspace migration warning:', error);
  }
}

export async function ensureUserWorkspaceSeededInFirestore(
  uid: string,
  seedFolders: Folder[],
  seedLinks: LinkItem[]
): Promise<void> {
  if (!canSyncWithFirestore(auth.currentUser)) return;
  const safeUid = sanitizeId(uid, 'usr');

  await migrateLegacyRootWorkspaceIfNeeded(safeUid);

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

  const userFoldersCollectionPath = `users/${safeUid}/folders`;
  try {
    const existingFoldersSnap = await getDocs(
      query(
        collection(db, 'users', safeUid, 'folders'),
        where('user_id', '==', safeUid)
      )
    );
    if (!existingFoldersSnap.empty) {
      return;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, userFoldersCollectionPath);
  }

  const folderIdMap = new Map<string, string>();

  for (let i = 0; i < realFolders.length; i++) {
    const f = realFolders[i];
    const newFolderId = sanitizeId(f.id || `fld-${i}-${Date.now().toString(36)}`, 'fld');
    folderIdMap.set(f.id, newFolderId);
    const folderPath = `users/${safeUid}/folders/${newFolderId}`;
    try {
      await setDoc(doc(db, 'users', safeUid, 'folders', newFolderId), {
        id: newFolderId,
        user_id: safeUid,
        name: sanitizeFolderName(f.name),
        color: sanitizeColor(f.color),
        collapsed: Boolean(f.collapsed),
        order_index: Math.max(
          0,
          Math.min(10000, Math.round(Number(f.order_index) || i))
        ),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      knownCloudFolderIds.add(newFolderId);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, folderPath);
    }
  }

  let fallbackFolderId = Array.from(folderIdMap.values())[0];
  if (!fallbackFolderId && realLinks.length > 0) {
    fallbackFolderId = sanitizeId(`fld-${safeUid.slice(0, 8)}-default`, 'fld');
    const fallbackPath = `users/${safeUid}/folders/${fallbackFolderId}`;
    try {
      await setDoc(doc(db, 'users', safeUid, 'folders', fallbackFolderId), {
        id: fallbackFolderId,
        user_id: safeUid,
        name: 'Tab đã lưu',
        color: 'blue',
        collapsed: false,
        order_index: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      knownCloudFolderIds.add(fallbackFolderId);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, fallbackPath);
    }
  }
  if (!fallbackFolderId) return;

  for (let i = 0; i < realLinks.length; i++) {
    const l = realLinks[i];
    const mappedFolderId =
      (l.folder_id ? folderIdMap.get(l.folder_id) : undefined) ||
      fallbackFolderId;
    const newLinkId = sanitizeId(l.id || `lnk-${i}-${Date.now().toString(36)}`, 'lnk');
    const linkPath = `users/${safeUid}/links/${newLinkId}`;
    try {
      await setDoc(doc(db, 'users', safeUid, 'links', newLinkId), {
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
        order_index: Math.max(
          0,
          Math.min(10000, Math.round(Number(l.order_index) || i))
        ),
        reading_minutes: Math.max(
          1,
          Math.min(1000, Math.round(Number(l.reading_minutes) || 5))
        ),
        scrape_status:
          l.scrape_status === 'degraded' || l.scrape_status === 'manual'
            ? l.scrape_status
            : 'ok',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      knownCloudLinkIds.add(newLinkId);
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

  knownCloudFolderIds.clear();
  knownCloudLinkIds.clear();
  hasLoadedCloudFolders = false;
  hasLoadedCloudLinks = false;

  void migrateLegacyRootWorkspaceIfNeeded(safeUid);

  const foldersQuery = query(
    collection(db, 'users', safeUid, 'folders'),
    where('user_id', '==', safeUid)
  );
  const linksQuery = query(
    collection(db, 'users', safeUid, 'links'),
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
          knownCloudFolderIds.delete(entry.docId);
          void deleteDoc(
            doc(db, 'users', safeUid, 'folders', entry.docId)
          ).catch(() => {});
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
      knownCloudFolderIds.clear();
      latestRawFolders = snapshot.docs
        .map((docSnap) => {
          knownCloudFolderIds.add(docSnap.id);
          const d = docSnap.data();
          const folderId = String(d.id || docSnap.id);
          knownCloudFolderIds.add(folderId);
          return {
            docId: docSnap.id,
            folder: {
              id: folderId,
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
      hasLoadedCloudFolders = true;
      emitCleanedFolders();
    },
    (error) => {
      handleFirestoreError(
        error,
        OperationType.LIST,
        `users/${safeUid}/folders`
      );
    }
  );

  const unsubLinks = onSnapshot(
    linksQuery,
    (snapshot) => {
      knownCloudLinkIds.clear();
      const realLinks: LinkItem[] = [];
      for (const docSnap of snapshot.docs) {
        const d = docSnap.data();
        if (isLegacyMockLink(d)) {
          if (!deletedLinkDocIds.has(docSnap.id)) {
            deletedLinkDocIds.add(docSnap.id);
            void deleteDoc(
              doc(db, 'users', safeUid, 'links', docSnap.id)
            ).catch(() => {});
          }
          continue;
        }
        const resolvedId = String(d.id || docSnap.id);
        knownCloudLinkIds.add(docSnap.id);
        knownCloudLinkIds.add(resolvedId);
        realLinks.push({
          id: resolvedId,
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
      hasLoadedCloudLinks = true;
      onLinksChange(realLinks);
      emitCleanedFolders();
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${safeUid}/links`);
    }
  );

  return () => {
    unsubFolders();
    unsubLinks();
    knownCloudFolderIds.clear();
    knownCloudLinkIds.clear();
    hasLoadedCloudFolders = false;
    hasLoadedCloudLinks = false;
  };
}

export async function createFolderInFirestore(
  uid: string,
  folder: Folder
): Promise<string> {
  if (!canSyncWithFirestore(auth.currentUser)) return folder.id;
  const safeUid = sanitizeId(uid, 'usr');
  const rawFolderId =
    !folder.id || folder.id === '__ungrouped__'
      ? `fld-${safeUid.slice(0, 8)}-default`
      : folder.id;
  const folderId = sanitizeId(rawFolderId, 'fld');

  if (knownCloudFolderIds.has(folderId)) {
    return folderId;
  }

  const folderRef = doc(db, 'users', safeUid, 'folders', folderId);
  try {
    const existingSnap = await getDoc(folderRef);
    if (existingSnap.exists()) {
      knownCloudFolderIds.add(folderId);
      return folderId;
    }
  } catch {
    // Proceed to create if getDoc failed or doc did not exist
  }

  const path = `users/${safeUid}/folders/${folderId}`;
  try {
    await setDoc(folderRef, {
      id: folderId,
      user_id: safeUid,
      name: sanitizeFolderName(folder.name),
      color: sanitizeColor(folder.color),
      collapsed: Boolean(folder.collapsed),
      order_index: Math.max(
        0,
        Math.min(10000, Math.round(Number(folder.order_index) || 0))
      ),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    knownCloudFolderIds.add(folderId);
    return folderId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateFolderInFirestore(
  folderId: string,
  patch: Partial<Pick<Folder, 'name' | 'color' | 'collapsed' | 'order_index'>>
): Promise<void> {
  if (!canSyncWithFirestore(auth.currentUser)) return;
  const safeUid = resolveCurrentSafeUid();
  if (!safeUid) return;
  const safeId = sanitizeId(folderId, 'fld');
  if (hasLoadedCloudFolders && !knownCloudFolderIds.has(safeId)) {
    return;
  }
  const path = `users/${safeUid}/folders/${safeId}`;
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
      Math.min(10000, Math.round(Number(patch.order_index) || 0))
    );
  }

  try {
    await updateDoc(
      doc(db, 'users', safeUid, 'folders', safeId),
      updatePayload
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteFolderInFirestore(
  folderId: string,
  userLinks: LinkItem[]
): Promise<void> {
  if (!canSyncWithFirestore(auth.currentUser)) return;
  const safeUid = resolveCurrentSafeUid();
  if (!safeUid) return;
  const safeId = sanitizeId(folderId, 'fld');
  const folderLinks = userLinks.filter((l) => l.folder_id === safeId);

  for (const link of folderLinks) {
    const safeLinkId = sanitizeId(link.id, 'lnk');
    if (hasLoadedCloudLinks && !knownCloudLinkIds.has(safeLinkId)) {
      continue;
    }
    knownCloudLinkIds.delete(safeLinkId);
    try {
      await deleteDoc(doc(db, 'users', safeUid, 'links', safeLinkId));
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.DELETE,
        `users/${safeUid}/links/${safeLinkId}`
      );
    }
  }

  if (hasLoadedCloudFolders && !knownCloudFolderIds.has(safeId)) {
    return;
  }
  knownCloudFolderIds.delete(safeId);
  try {
    await deleteDoc(doc(db, 'users', safeUid, 'folders', safeId));
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `users/${safeUid}/folders/${safeId}`
    );
  }
}

export async function createLinkInFirestore(
  uid: string,
  link: LinkItem,
  fallbackFolderId: string,
  fallbackFolder?: Partial<Folder>
): Promise<void> {
  if (!canSyncWithFirestore(auth.currentUser)) return;
  const safeUid = sanitizeId(uid, 'usr');
  const linkId = sanitizeId(link.id, 'lnk');
  const rawTargetFolderId =
    !link.folder_id || link.folder_id === '__ungrouped__'
      ? !fallbackFolderId || fallbackFolderId === '__ungrouped__'
        ? `fld-${safeUid.slice(0, 8)}-default`
        : fallbackFolderId
      : link.folder_id;

  // Guarantee the parent folder exists in /users/{safeUid}/folders/{folderId} before creating the link
  const verifiedFolderId = await createFolderInFirestore(safeUid, {
    id: rawTargetFolderId,
    user_id: safeUid,
    name: fallbackFolder?.name || 'Tab đã lưu',
    parent_id: null,
    order_index: fallbackFolder?.order_index ?? 0,
    color: fallbackFolder?.color ?? 'blue',
    collapsed: Boolean(fallbackFolder?.collapsed),
  });

  if (knownCloudLinkIds.has(linkId)) {
    await updateLinkInFirestore(linkId, {
      title: link.title,
      description: link.description,
      folder_id: verifiedFolderId,
      status: link.status,
      order_index: link.order_index,
    });
    return;
  }

  const linkRef = doc(db, 'users', safeUid, 'links', linkId);
  try {
    const existingLinkSnap = await getDoc(linkRef);
    if (existingLinkSnap.exists()) {
      knownCloudLinkIds.add(linkId);
      await updateLinkInFirestore(linkId, {
        title: link.title,
        description: link.description,
        folder_id: verifiedFolderId,
        status: link.status,
        order_index: link.order_index,
      });
      return;
    }
  } catch {
    // Proceed to create
  }

  const path = `users/${safeUid}/links/${linkId}`;
  const safeUrl =
    (link.url || '').trim().slice(0, MAX_LINK_URL_LENGTH) ||
    'https://example.com';
  const safeDomain =
    (link.domain || '').trim().slice(0, MAX_LINK_DOMAIN_LENGTH) ||
    'youtube.com';
  const safeTitle =
    (link.title || safeDomain || 'Saved Tab')
      .trim()
      .slice(0, MAX_LINK_TITLE_LENGTH) || 'Saved Tab';
  const safeDescription = (link.description || '').slice(
    0,
    MAX_LINK_DESCRIPTION_LENGTH
  );
  const safeImageUrl = (link.image_url || '')
    .trim()
    .slice(0, MAX_LINK_URL_LENGTH);
  const safeFavicon =
    (link.favicon || '').trim().slice(0, MAX_LINK_URL_LENGTH) ||
    '/favicon.ico';

  try {
    await setDoc(linkRef, {
      id: linkId,
      user_id: safeUid,
      folder_id: verifiedFolderId,
      url: safeUrl,
      domain: safeDomain,
      title: safeTitle,
      description: safeDescription,
      image_url: safeImageUrl,
      favicon: safeFavicon,
      status: sanitizeStatus(link.status),
      order_index: Math.max(
        0,
        Math.min(10000, Math.round(Number(link.order_index) || 0))
      ),
      reading_minutes: Math.max(
        1,
        Math.min(1000, Math.round(Number(link.reading_minutes) || 5))
      ),
      scrape_status:
        link.scrape_status === 'degraded' || link.scrape_status === 'manual'
          ? link.scrape_status
          : 'ok',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    knownCloudLinkIds.add(linkId);
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
  const safeUid = resolveCurrentSafeUid();
  if (!safeUid) return;
  const safeId = sanitizeId(linkId, 'lnk');
  if (hasLoadedCloudLinks && !knownCloudLinkIds.has(safeId)) {
    return;
  }
  const path = `users/${safeUid}/links/${safeId}`;
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
    const safeFolderId = sanitizeId(patch.folder_id, 'fld');
    if (hasLoadedCloudFolders && !knownCloudFolderIds.has(safeFolderId)) {
      return;
    }
    updatePayload.folder_id = safeFolderId;
  }
  if (patch.status !== undefined) {
    updatePayload.status = sanitizeStatus(patch.status);
  }
  if (patch.order_index !== undefined) {
    updatePayload.order_index = Math.max(
      0,
      Math.min(10000, Math.round(Number(patch.order_index) || 0))
    );
  }

  // Only write to Firestore if at least one Firestore-governed field changed
  if (Object.keys(updatePayload).length <= 1) {
    return;
  }

  try {
    await updateDoc(doc(db, 'users', safeUid, 'links', safeId), updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteLinkInFirestore(linkId: string): Promise<void> {
  if (!canSyncWithFirestore(auth.currentUser)) return;
  const safeUid = resolveCurrentSafeUid();
  if (!safeUid) return;
  const safeId = sanitizeId(linkId, 'lnk');
  if (hasLoadedCloudLinks && !knownCloudLinkIds.has(safeId)) {
    return;
  }
  knownCloudLinkIds.delete(safeId);
  const path = `users/${safeUid}/links/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', safeUid, 'links', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
