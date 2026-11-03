# TabFlow — Agent Architecture & Engineering Guidelines

This document integrates three core engineering methodologies for AI coding agents working on TabFlow:
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
| `/app/page.tsx` | Presentation | Renders `<WorkspaceShell />` |
| `/app/shared/group/page.tsx` | Presentation | Shared Tab Group preview and one-click workspace import |
| `/app/api/links/route.ts` | Server API | `GET` workspace snapshot; `POST` scrape + create link (or return existing duplicate) |
| `/app/api/links/[id]/route.ts` | Server API | `PATCH` link metadata/order/group; `DELETE` link |
| `/app/api/folders/route.ts` | Server API | `POST` create Tab Group folder |
| `/app/api/folders/[id]/route.ts` | Server API | `PATCH` rename/recolor/collapse folder; `DELETE` folder + cascade links |
| `/app/api/folders/import-group/route.ts` | Server API | `POST` batch-create Tab Group folder with multiple scraped links |
| `/app/api/folders/reorder/route.ts` | Server API | `POST` reorder Tab Group columns |
| `/app/api/scrape/route.ts` | Server API | `POST` scrape URL metadata (HTML + YouTube oEmbed/watch fallback + CJK translation) |
| `/app/api/translate/route.ts` | Server API | `POST` translate CJK titles via `gemini-3.5-flash` |

### State & Domain Core
| Module | Key Exports | Connected Dependents |
| :--- | :--- | :--- |
| `/lib/types.ts` | `LinkItem`, `Folder`, `LinkStatus`, `TAB_GROUP_COLORS`, `TabGroupColor` | All stores, API routes, and components |
| `/lib/kanban-rules.ts` | `normalizeLinkUrlKey`, `extractYouTubeVideoIdFromUrl`, `resolveYouTubeChannelFromLink`, `deduplicateLinks`, `consolidateLinksAcrossGroups`, `moveAndReorderGroupLinks`, `clusterGroupLinksBySource` | `/store/useLinkStore.ts`, `/components/KanbanBoard.tsx`, `/lib/scraper.ts`, `/lib/tab-group-drop.ts`, `/lib/db.ts` |
| `/lib/tab-group-drop.ts` | `parseTabGroupFromDataTransfer`, `parseTabGroupFromTextOrHtml`, `pickNextTabGroupColor` | `/components/KanbanBoard.tsx`, `/components/Sidebar.tsx`, `/components/EmptyLaneState.tsx` |
| `/store/useLinkStore.ts` | `useLinkStore` (`links`, `folders`, `highlightedLinkId`, `addLink`, `reorderLink`, `syncAuthUser`) | `/components/WorkspaceShell.tsx`, `/components/KanbanBoard.tsx`, `/components/Sidebar.tsx`, `/components/AddLinkModal.tsx` |
| `/lib/firebase.ts` | `subscribeToUserWorkspace`, `ensureUserWorkspaceSeededInFirestore`, `createLinkInFirestore`, `updateLinkInFirestore` | `/store/useLinkStore.ts`, `/components/AuthAccountControl.tsx` |
| `/lib/db.ts` | `getWorkspaceData`, `createLink`, `updateLink`, `deleteLink`, `createFolder` | `/app/api/**` |

### Firestore Data Hierarchy
- `/users/{userId}` — User profile document (`UserProfile`).
- `/users/{userId}/folders/{folderId}` — User-scoped Tab Group folders (`user_id == userId`).
- `/users/{userId}/links/{linkId}` — User-scoped saved tabs (`user_id == userId`, `folder_id` referencing `/users/{userId}/folders/{folderId}`).
- Legacy top-level `/folders` and `/links` documents owned by `{userId}` are automatically migrated once via `migrateLegacyRootWorkspaceIfNeeded` in `/lib/firebase.ts`.

---

## 2. Production Quality Gates (`addyosmani/agent-skills`)

1. **Single Source of Truth for Domain Parsing**:
   - Always use `normalizeLinkUrlKey`, `extractYouTubeVideoIdFromUrl`, and `resolveYouTubeChannelFromLink` from `/lib/kanban-rules.ts`. Never re-implement URL/YouTube regex parsers inside UI components or stores.
2. **Server-Only Gemini SDK (`@google/genai`)**:
   - All Gemini calls reside strictly in `/lib/cjk-translate-server.ts` using `model: 'gemini-3.5-flash'` and `process.env.GEMINI_API_KEY`.
3. **Deduplicated Multi-MIME Drag & Paste**:
   - Browsers populate `text/uri-list`, `text/plain`, `URL`, and `text/html` simultaneously for a single dragged tab. `/lib/tab-group-drop.ts` deduplicates across all MIME payloads by `normalizeLinkUrlKey` before dispatching `addLink`, and `/store/useLinkStore.ts` guards concurrent adds with `inFlightAddByUrlKey`.
4. **Immediate Visual Feedback on Tab Insertion**:
   - Adding a tab sets `highlightedLinkId` in `/store/useLinkStore.ts` and inserts the card at its exact `target_link_id` / `position` slot. `/components/KanbanBoard.tsx` scrolls the card into view, focuses the DOM node, and renders a 3.2-second accent highlight ring.
5. **Verification Gate**:
   - Every code change must pass both `npm run lint` (`lint_applet`) and `npm run build` (`compile_applet`) with zero warnings or errors.

---

## 3. YAGNI & Anti-Redundancy Rules (`DietrichGebert/ponytail`)

- **No Dead Files or Unused Hooks**: Never leave scaffolded template files (such as unused `/hooks/*`, unused `cn()` wrappers, or `DRAFT_*` files) in the repository.
- **No Speculative Abstractions**: Do not add unused state fields, union variants that are never constructed, or redundant network probes on startup.
- **Consolidate Before Writing**: Before adding a helper function, check `/.codegraph/graph.json` and `/lib/kanban-rules.ts` to reuse existing pure functions.
