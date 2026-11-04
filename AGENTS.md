# TabFlow — Agent Architecture, Engineering & Free Deployment Guide

This document integrates three core engineering methodologies for AI coding agents working on TabFlow, followed by the production deployment checklist:
1. **CodeGraph (`colbymchenry/codegraph`)**: Pre-indexed dependency, symbol, and data-flow graph (`.codegraph/graph.json`) so agents locate the exact file and symbol in one hop without redundant file scanning.
2. **Production Agent Skills (`addyosmani/agent-skills`)**: Spec-driven, production-grade TypeScript, Next.js App Router, Firebase security, and Gemini SDK patterns.
3. **Ponytail Anti-Bloat Discipline (`DietrichGebert/ponytail`)**: *"The best code is the code you never wrote."* Zero dead files, zero duplicate helpers, and strict YAGNI enforcement.

---

## 1. CodeGraph Navigation Map (`colbymchenry/codegraph`)

Machine-readable graph: `/.codegraph/graph.json`

### Entry Points & Routes
| Route / File | Layer | Responsibility |
| :--- | :--- | :--- |
| `/app/layout.tsx` | Presentation | Root HTML shell, fonts, theme bootstrap, OpenGraph metadata |
| `/app/page.tsx` | Presentation | Renders `<Sidebar />`, `<KanbanBoard />`, `<AddLinkModal />`, `<ChromeTabGroupImportModal />`, and `<AuthControl />` |
| `/app/api/links/route.ts` | Server API | `GET` workspace snapshot; `POST` scrape + create link (or return existing duplicate) |
| `/app/api/links/[id]/route.ts` | Server API | `PATCH` link metadata/order/group; `DELETE` link |
| `/app/api/folders/route.ts` | Server API | `POST` create Tab Group folder |
| `/app/api/folders/[id]/route.ts` | Server API | `PATCH` rename/recolor/collapse folder; `DELETE` folder + cascade links |
| `/app/api/folders/import-group/route.ts` | Server API | `POST` batch-create Tab Group folder with multiple scraped links |
| `/app/api/folders/reorder/route.ts` | Server API | `POST` reorder Tab Group columns |
| `/app/api/scrape/route.ts` | Server API | `POST` scrape URL metadata (HTML + YouTube oEmbed/watch fallback + CJK translation) |
| `/app/api/translate/route.ts` | Server API | `POST` translate CJK titles |

### State & Domain Core
| Module | Key Exports | Connected Dependents |
| :--- | :--- | :--- |
| `/lib/types.ts` | `LinkItem`, `Folder`, `LinkStatus`, `TAB_GROUP_COLORS`, `TabGroupColor`, `ThemeMode` | All stores, API routes, and components |
| `/lib/kanban-rules.ts` | `decodeHtmlEntities`, `isPlaceholderLikeTitle`, `normalizeLinkUrlKey`, `extractYouTubeVideoIdFromUrl`, `resolveYouTubeChannelFromLink`, `deduplicateLinks`, `consolidateLinksAcrossGroups`, `moveAndReorderGroupLinks`, `clusterGroupLinksBySource` | `/store/useLinkStore.ts`, `/components/KanbanBoard.tsx`, `/lib/scraper.ts`, `/lib/tab-group-drop.ts`, `/lib/db.ts` |
| `/lib/tab-group-drop.ts` | `parseTabGroupFromDataTransfer`, `parseTabGroupFromTextOrHtml`, `pickNextTabGroupColor`, `inferDefaultGroupName` | `/components/KanbanBoard.tsx`, `/components/Sidebar.tsx`, `/components/ChromeTabGroupImportModal.tsx`, `/components/EmptyLaneState.tsx` |
| `/store/useLinkStore.ts` | `useLinkStore` (`links`, `folders`, `highlightedLinkId`, `addLink`, `reorderLink`, `syncAuthUser`) | `/app/page.tsx`, `/components/KanbanBoard.tsx`, `/components/Sidebar.tsx`, `/components/AddLinkModal.tsx`, `/components/ChromeTabGroupImportModal.tsx`, `/components/AuthControl.tsx` |
| `/lib/firebase.ts` | `subscribeToUserWorkspace`, `ensureUserWorkspaceSeededInFirestore`, `createLinkInFirestore`, `updateLinkInFirestore` | `/store/useLinkStore.ts`, `/components/AuthControl.tsx` |
| `/lib/db.ts` | `getWorkspaceData`, `createLink`, `updateLink`, `deleteLink`, `createFolder` | `/app/api/**` (with automatic `/tmp` serverless fallback) |

### Firestore Data Hierarchy
- `/users/{userId}` — User profile document (`UserProfile`).
- `/users/{userId}/folders/{folderId}` — User-scoped Tab Group folders (`user_id == userId`).
- `/users/{userId}/links/{linkId}` — User-scoped saved tabs (`user_id == userId`, `folder_id` referencing `/users/{userId}/folders/{folderId}`).
- Legacy top-level `/folders` and `/links` documents owned by `{userId}` are automatically migrated once via `migrateLegacyRootWorkspaceIfNeeded` in `/lib/firebase.ts`.

---

## 2. Production Quality Gates (`addyosmani/agent-skills`)

1. **Single Source of Truth for Domain & HTML Parsing**:
   - Always use `decodeHtmlEntities`, `isPlaceholderLikeTitle`, `normalizeLinkUrlKey`, `extractYouTubeVideoIdFromUrl`, and `resolveYouTubeChannelFromLink` from `/lib/kanban-rules.ts`. Never re-implement URL/YouTube/HTML-entity regex parsers inside UI components, scrapers, or stores.
2. **Server-Side CJK Title Translation**:
   - CJK title translation resides strictly in `/lib/cjk-translate-server.ts` with an LRU memory cache.
3. **Deduplicated Multi-MIME Drag & Paste**:
   - Browsers populate `text/uri-list`, `text/plain`, `URL`, and `text/html` simultaneously for a single dragged tab. `/lib/tab-group-drop.ts` deduplicates across all MIME payloads by `normalizeLinkUrlKey` before dispatching `addLink`, and `/store/useLinkStore.ts` guards concurrent adds with `inFlightAddByUrlKey`.
4. **Immediate Visual Feedback on Tab Insertion**:
   - Adding a tab sets `highlightedLinkId` in `/store/useLinkStore.ts` and inserts the card at its exact `target_link_id` / `position` slot. `/components/KanbanBoard.tsx` scrolls the card into view, focuses the DOM node, and renders a 3.2-second accent highlight ring.
5. **Verification Gate**:
   - Run `npm run predeploy:check` (`npm run typecheck && npm run lint && npm run build`) before deployment.

---

## 3. YAGNI & Anti-Redundancy Rules (`DietrichGebert/ponytail`)

- **No Dead Files or Unused Hooks**: Never leave scaffolded template files (such as unused `/hooks/*`, unused `cn()` wrappers, or `DRAFT_*` files) in the repository.
- **No Speculative Abstractions**: Do not add unused state fields, union variants that are never constructed, or redundant network probes on startup.
- **Consolidate Before Writing**: Before adding a helper function, check `/.codegraph/graph.json` and `/lib/kanban-rules.ts` to reuse existing pure functions.

---

## 4. Free Web Deployment Guide & Checklist

### Pre-Flight Verification
Run the automated pre-deploy check locally or in CI:
```bash
npm run predeploy:check
```

### Option A: Vercel (Free Hobby Tier — Recommended)
1. Push your project to a GitHub repository.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository.
3. In **Environment Variables**, add:
   - `GEMINI_API_KEY`: Your Gemini API key for server-side CJK title translation.
4. Click **Deploy**. (`/lib/db.ts` automatically detects `process.env.VERCEL` and routes unsigned guest storage to `/tmp/tabflow-data/tabflow-db.json` while signed-in users sync directly to Firebase Firestore).

### Option B: Google Cloud Run (Free Tier — Native GCP)
1. Ensure the Google Cloud CLI (`gcloud`) is authenticated with project `cotuong-d864b`.
2. Deploy directly using the included multi-stage `Dockerfile`:
   ```bash
   gcloud run deploy tabflow \
     --source . \
     --region asia-southeast1 \
     --allow-unauthenticated \
     --set-env-vars GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
   ```

### Option C: Render or Koyeb (Free Docker Web Service)
1. Create a new **Web Service** on [Render](https://render.com) or [Koyeb](https://www.koyeb.com) connected to your GitHub repo.
2. Select **Docker** as the runtime (uses `/Dockerfile` listening on `PORT=3000`).
3. Choose the **Free** instance plan and set `GEMINI_API_KEY` in Environment Variables.

### Post-Deploy Checklist: Firebase Auth & Firestore
1. **Authorize Your Production Domain for Google Sign-In**:
   - Open [Firebase Console](https://console.firebase.google.com/project/cotuong-d864b/authentication/settings) → **Authentication** → **Settings** → **Authorized domains**.
   - Click **Add domain** and add your new production domain (e.g., `your-project.vercel.app`, `*.run.app`, or your custom domain).
2. **Verify Firestore Security Rules**:
   - Your `firestore.rules` are already deployed to database `ai-studio-tabflow-dc350772-7f9b-4fa9-b288-24019f53c63b` in project `cotuong-d864b`, enforcing strict owner isolation under `/users/{userId}/folders/{folderId}` and `/users/{userId}/links/{linkId}`.
