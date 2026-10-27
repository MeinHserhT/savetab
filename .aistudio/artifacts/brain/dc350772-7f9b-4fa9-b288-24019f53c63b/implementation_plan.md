# KanbanBoard Empty Lane & Tab Group State

A dedicated empty state component for `KanbanBoard` lanes and Tab Groups that guides users to populate empty groups through either a preselected Save Link modal or one-click clipboard URL quick-paste, styled as a compact, group-accented dashed placeholder.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following design and interaction choices have been confirmed from your answers and govern this implementation:

- **Confirmed Action Workflow**: Dual-action empty state supporting both **(1) Open Save Link Modal** (preselected with the target Tab Group) and **(2) Quick-Paste from Clipboard** (reads a URL from `navigator.clipboard.readText()`, validates it, and immediately scrapes and saves it into that group, with an inline fallback prompt if clipboard permissions are blocked).
- **Confirmed Visual Style**: A hybrid **Minimalist Dashed Container + Compact Browser-Tab Prompt** that pairs a subtle dashed border and group-colored accent icon with compact single-line action controls matching the geometry of populated browser tab rows.

---

## 1. Overview & Core Concept

- **What It Does**: Replaces static empty text inside any empty Tab Group or lane on the `KanbanBoard` with an interactive empty state component that lets users add a new link in one click or drop an existing tab into the lane.
- **Target Audience / Persona**: Users organizing research links and browser tabs into color-coded Google Chrome-style Tab Groups who want frictionless link capture when creating a new group.
- **Key Value**: Eliminates dead ends in newly created or cleared Tab Groups by turning the empty state itself into an active link-capture surface.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Viewing an Empty Group**: When a Tab Group has `0 tabs`, the lane displays a compact dashed container accented with the group's signature Chrome Tab Group color (`Blue`, `Yellow`, `Pink`, `Green`, `Cyan`, `Purple`, `Orange`, or `Grey`).
  2. **Modal Link Capture (`+ Add Link`)**: Clicking the primary `+ Add Link` button opens the `AddLinkModal` with the Collection Folder / Group dropdown automatically preselected to that specific empty group.
  3. **One-Click Clipboard Paste (`Paste URL`)**: Clicking `Paste URL` reads the user's clipboard via `navigator.clipboard.readText()`. If a valid URL is found, it immediately triggers the defensive metadata scraper and inserts the new tab into that group with a loading indicator. If the clipboard does not contain a valid URL or browser clipboard permission is denied, an inline single-line URL input appears inside the empty state so the user can press `Cmd/Ctrl + V` and `Enter` directly.
  4. **Drag-and-Drop Reception**: Dragging an existing tab card over the empty state highlights the dashed border in the group's accent color, signaling an active drop zone.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Swiss Minimalist workspace aligned with Google Chrome Tab Groups—quiet dark zinc surfaces (`bg-zinc-950/60`), 1px dashed hairlines (`border-dashed border-zinc-800/90`), and zero visual bloat.
  - *Color Palette & Mood*: Inherits the parent Tab Group's semantic token (`sky-400`, `amber-400`, `rose-400`, `emerald-400`, `cyan-400`, `purple-400`, `orange-400`, `zinc-400`) for the leading icon badge and hover/drag border highlights.
  - *Typography & Hierarchy*: `Plus Jakarta Sans` for the concise empty prompt title, `DM Sans` for helper text, and `JetBrains Mono` (`tabular-nums`) for status feedback.
  - *Component Styling & Layout*: Compact vertical footprint that aligns with populated `TabLinkRow` items, featuring a top compact tab-like prompt row and single-line action buttons (`whitespace-nowrap shrink-0`).

- **Interactive Feedback & Motion**:
  - Subtle hover transition (`150ms`) on action buttons, active drag-over ring highlight when a link tab hovers over the empty lane, and an inline spinner state (`Saving pasted link...`) while scraping a clipboard URL.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Clipboard Quick-Paste with Inline Input Fallback**
  - *Chosen Approach*: Attempt `navigator.clipboard.readText()` on click, and gracefully reveal a compact single-line `<input>` inside the empty state if clipboard read permission is restricted by the browser or iframe context.
  - *Why*: Browsers inside sandboxed iframes sometimes block programmatic clipboard reads; providing an automatic inline input fallback guarantees the quick-paste workflow always succeeds without throwing unhandled permission errors.
  - *Alternatives Considered*: Relying solely on `navigator.clipboard.readText()` (rejected because denied permissions would leave the button unresponsive).

- **Decision 2: Group-Preselected Modal Handoff**
  - *Chosen Approach*: Pass the target `groupId` (`folder_id`) directly into the modal trigger (`onOpenAddModal(LinkStatus.UNREAD, group.id)`) so the `AddLinkModal` initializes with that exact Tab Group selected.
  - *Why*: Prevents users from having to re-select the group name in the modal dropdown after clicking `+ Add Link` inside a specific group's empty state.
  - *Alternatives Considered*: Defaulting the modal to the first folder in the list (rejected as error-prone when adding to newly created groups).

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:
```text
┌─────────────────────────────────────────────────────────────────────────┐
│                              HomePage                                   │
│  ┌──────────────────────┐       ┌────────────────────────────────────┐  │
│  │    AddLinkModal      │◄──────┤            KanbanBoard             │  │
│  │ (Preselected Group)  │       │  ┌──────────────────────────────┐  │  │
│  └──────────┬───────────┘       │  │      Tab Group Section       │  │  │
│             │                   │  │  (Header + Color Top Bar)    │  │  │
│             │                   │  └──────────────┬───────────────┘  │  │
│             │                   │                 │                  │  │
│             │                   │        ┌────────┴────────┐         │  │
│             │                   │        ▼                 ▼         │  │
│             │                   │  ┌───────────┐   ┌──────────────┐  │  │
│             │                   │  │TabLinkRow │   │  EmptyState  │  │  │
│             │                   │  │ (n > 0)   │   │   (n === 0)  │  │  │
│             │                   │  └───────────┘   └──────┬───────┘  │  │
│             │                   └─────────────────────────┼──────────┘  │
└─────────────┼─────────────────────────────────────────────┼─────────────┘
              │                                             │
              ▼                                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     useLinkStore (Zustand State)                        │
│        addLink({ url, folder_id: groupId }) ──► POST /api/links         │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - Uses existing `Folder` (`id`, `name`, `color`, `collapsed`) and `LinkItem` (`folder_id`, `url`, `title`, `favicon`) contracts.
  - Extends the modal trigger callback signature to accept an optional `defaultFolderId?: string` so clicking `+ Add Link` inside an empty group pre-populates `folderId` in `AddLinkModal`.

- **Interactive Component & State Mapping**:
  - `EmptyLaneState` receives `group: Folder`, `isDragOver: boolean`, `onAddViaModal: (folderId: string) => void`, and `onQuickSaveUrl: (url: string, folderId: string) => Promise<void>`.
  - Clicking **Add Link** invokes `onAddViaModal(group.id)`, opening `AddLinkModal` targeted to `group.id`.
  - Clicking **Paste URL** reads the clipboard (or focuses the compact single-line URL input if clipboard access is blocked or non-URL), validates the URL, and calls `addLink({ url, folder_id: group.id, tags: ['saved-tab'] })`.
