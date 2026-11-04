# AI OpenGraph Category Tagging Utility

## User Review & Critical Decisions

> [!IMPORTANT]
> **Resolved Scope & Tagging Decisions**
> - **Tag Vocabulary Strategy**: Reuse existing workspace tags first when semantically relevant, and introduce clean new AI category tags when no existing tag fits.
> - **Tag Density**: Assign **2 to 3 concise, lowercase kebab-case category tags** per link (e.g., `ai`, `typescript`, `system-design`), replacing generic fallback placeholders (`saved-tab`, `reference`).
> - **Trigger Points**:
>   1. **Automatic on Save / Drop**: Every newly saved, pasted, or dragged-and-dropped link (and imported tab group) is automatically scanned and tagged from its scraped OpenGraph metadata.
>   2. **Live Preview in Add Link Modal**: Entering a URL in the Add Link modal lets you preview, accept, or customize AI-suggested OpenGraph category tags before saving.
>   3. **One-Click Re-Tag on Existing Cards**: Every saved card on the Kanban board includes a one-click AI Tag action to scan its OpenGraph metadata and refresh its category tags across local storage and Firebase Firestore.

---

## 1. Overview & Core Concept

TabFlow's **AI OpenGraph Category Tagging Utility** turns raw saved URLs into organized, searchable knowledge without manual tagging overhead. Whenever a link is captured—whether dragged from the browser tab bar, pasted onto a Kanban lane, added via the modal, or refreshed on an existing card—the utility inspects the page's OpenGraph metadata (`og:title`, `og:description`, canonical hostname/domain, URL path segments, and YouTube channel metadata) and assigns **2 to 3 high-signal category tags**.

To prevent tag sprawl (such as `react`, `reactjs`, and `react-dev` coexisting across different cards), the utility uses a **hybrid vocabulary strategy**: it receives the user's active workspace tag catalog alongside the link's OpenGraph metadata, prioritizing established workspace tags whenever they match the link's topic and minting normalized lowercase kebab-case tags only for genuinely new subjects.

---

## 2. User Experience & Visual Design

### Swiss Minimalist Integration
Following TabFlow's Swiss Minimalist visual architecture, AI-generated tags and triggers integrate quietly into the existing typographic hierarchy without noisy banners or decorative clutter:

- **Automatic Background Tagging on Drop & Paste**:
  - When a user drags a browser tab or pastes a URL onto a lane, the link is scraped for OpenGraph metadata and categorized in a single pass.
  - The newly inserted card immediately appears in its target position with its 3.2-second focus highlight ring and displays its 2–3 assigned category tags in the sidebar tag filter and card metadata.
- **Interactive Tag Suggestions in the Add Link Modal**:
  - When a user enters or pastes a URL in the **Save New Tab** modal, an **Auto-Suggest Tags** trigger (alongside automatic suggestion on URL blur) fetches OpenGraph metadata and populates interactive tag chips.
  - Users can click to toggle suggested tags, remove unwanted ones, or append custom comma-separated tags before clicking **Save Tab**.
- **One-Click AI Re-Tag on Existing Kanban Cards**:
  - Each rich link card on the board provides a subtle **AI Auto-Tag** action button in its quick-action bar / context controls.
  - Clicking the action shows a compact spinner state while scanning the card's OpenGraph metadata, then smoothly updates the card's tags and sidebar tag counts in real time.

---

## 3. Key Product Decisions & Trade-Offs

- **Hybrid Vocabulary (Existing Tags + New AI Tags) vs. Fixed Taxonomy**:
  - *Decision*: Pass the workspace's existing distinct tags into the structured Gemini prompt so the model reuses established tags first and creates new tags only when needed.
  - *Why*: A rigid fixed taxonomy fails on niche technical or regional content, while unconstrained generation creates duplicate synonyms. The hybrid approach keeps the sidebar tag filter clean and tailored to each user's library.
- **Strict 2–3 Tag Cap & Placeholder Replacement**:
  - *Decision*: Enforce 2 to 3 lowercase kebab-case tags per link (`1–24` characters each) and automatically strip generic system placeholders (`saved-tab`, `reference`) once real category tags are assigned.
  - *Why*: Keeps cards scannable and ensures the sidebar tag navigation reflects meaningful topics rather than how the link was imported.
- **Deterministic Heuristic Fallback for Offline / Missing Key Resilience**:
  - *Decision*: Pair the server-side Gemini structured output call with a fast, deterministic OpenGraph & domain classification fallback.
  - *Why*: Guarantees that link creation, drag-and-drop imports, and one-click re-tagging always return 2–3 accurate category tags even if `GEMINI_API_KEY` is unconfigured or rate-limited.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT WORKSPACE LAYER                           │
│                                                                            │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐  │
│  │ Drag / Drop / Paste  │  │   Add Link Modal     │  │ Existing Card    │  │
│  │ (New Tab or Group)   │  │ (Live OG Tag Preview)│  │ (1-Click Re-Tag) │  │
│  └──────────┬───────────┘  └──────────┬───────────┘  └────────┬─────────┘  │
└─────────────┼─────────────────────────┼───────────────────────┼────────────┘
              │                         │                       │
              ▼                         ▼                       ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                         NEXT.JS SERVER API LAYER                           │
│                                                                            │
│  ┌──────────────────────────────┐     ┌─────────────────────────────────┐  │
│  │ Link & Group Creation Flow   │     │ Tag Suggestion Endpoint         │  │
│  │ • Scrapes OpenGraph metadata │     │ • Accepts URL or OG metadata    │  │
│  │ • Reads workspace tag list   │     │   + existing workspace tags     │  │
│  └──────────────┬───────────────┘     └────────────────┬────────────────┘  │
│                 └──────────────────┬───────────────────┘                   │
│                                    ▼                                       │
│            ┌───────────────────────────────────────────────┐               │
│            │     Server-Side AI OpenGraph Tagger Engine    │               │
│            │  1. Inspects OG title, description, domain,   │               │
│            │     URL path, and YouTube channel metadata    │               │
│            │  2. Calls Gemini (@google/genai) with JSON    │               │
│            │     schema + existing workspace tag catalog   │               │
│            │  3. Normalizes to 2-3 lowercase kebab tags    │               │
│            │     (with deterministic OG heuristic backup)  │               │
│            └───────────────────────┬───────────────────────┘               │
└────────────────────────────────────┼───────────────────────────────────────┘
                                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                        PERSISTENCE & SYNC LAYER                            │
│                                                                            │
│   ┌────────────────────────────────┐   ┌────────────────────────────────┐  │
│   │ Local / Serverless JSON Store  │   │ Firebase Firestore Sync        │  │
│   │ Updates link.tags array        │   │ Persists under user-scoped     │  │
│   │ for guest & server snapshot    │   │ links collection in real time  │  │
│   └────────────────────────────────┘   └────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

### Server-Side Gemini Structured Output Contract
- **SDK & Model**: Uses `@google/genai` strictly on the server with `GEMINI_API_KEY` and structured JSON output (`responseMimeType: "application/json"`, `responseSchema` enforcing `{ tags: string[] }`).
- **Input Signal Payload**:
  - `title` (OpenGraph `og:title` / translated title)
  - `description` (OpenGraph `og:description` / meta summary)
  - `domain` and `url` (hostname + semantic path tokens)
  - `channel_name` (when the link is a YouTube video or media source)
  - `existingTags` (deduplicated list of current workspace tags, excluding generic placeholders)
- **Post-Processing & Validation**:
  - Lowercases, trims, converts spaces/underscores to hyphens, strips punctuation (`#`, `@`), deduplicates, and caps output at 2–3 tags.
  - Updates both the local database snapshot and, when signed in, the user's Firestore link document so sidebar tag filters update immediately across sessions.
