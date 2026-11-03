# Cross-Group Automatic Tab Consolidation Plan

## 1. Product Vision & User Experience
When saving a new link, importing a batch of browser tabs, or completing background metadata scraping for a tab (such as resolving a YouTube video's channel name), TabFlow will automatically check whether another tab group already contains a tab from that **same YouTube channel** or **same website domain**.

If a match is found in an existing group (for example, a tab from the same YouTube channel already lives in the **"Learn"** group while a new tab is being added to a **"YouTube"** group), the tab is automatically routed and grouped into the **existing group where that channel or domain appeared first**. Inside that destination group, the matching tabs immediately cluster at the top inside their shared Channel / Domain Sub-Group block.

```
+-------------------------------------------------------------------------+
|                   Incoming Tab Added or Metadata Scraped                |
|        (Single Add / Group Import / Background Channel Resolution)      |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|               Source Identity Extraction (Bucket Key)                   |
|   • YouTube Link  -->  yt-channel:<normalized_channel_name>             |
|                        (or yt-url:<video_id> prior to channel scrape)   |
|   • Website Link  -->  domain:<normalized_hostname>                     |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|            Cross-Group First-Appearance Lookup Engine                   |
|   Scans existing tabs across groups (ordered by group & creation time)  |
|   to find the earliest group that already hosts this channel or domain  |
+------------------------------------+------------------------------------+
                                     |
                 +-------------------+-------------------+
                 | Match Found                           | No Match Found
                 v                                       v
+------------------------------------+  +---------------------------------+
| Route / Move Tab to Matched Group  |  | Keep Tab in Requested / Current |
| • Assigns target folder_id         |  | Tab Group                       |
| • Normalizes order_index           |  +---------------------------------+
| • Clusters into top Sub-Group      |
| • Syncs with API & Cloud Firestore |
+------------------------------------+
```

---

## 2. Core Consolidation Rules & Behavior

### Unified Source Matching (`YouTube Channel` + `Website Domain`)
- **YouTube Channels**: Normalized case-insensitively via the resolved channel name (`yt-channel:<channel>`). If a YouTube link's channel name has not yet been scraped, identical video URLs (`yt-url:<canonical_video_url>`) also match immediately.
- **Website Domains**: Non-YouTube links are matched by their normalized hostname (`domain:<clean_domain>`, stripping `www.` and `m.` prefixes) so tabs from the same site consolidate into the same group.

### Earliest Existing Group Priority
- When determining which group owns a given YouTube channel or website domain, the engine evaluates existing tabs by earliest appearance (`created_at` timestamp, breaking ties by group `order_index` and tab `order_index`).
- Whichever existing group hosted that YouTube channel or domain first becomes the canonical destination group for new or newly scraped matching tabs.

### Lifecycle Triggers
1. **When Adding a New Tab (`POST /api/links` & Store `addLink`)**:
   - As soon as a link is scraped and created, if an older tab in another group shares the same YouTube channel or website domain, the link is automatically assigned to that existing group instead of creating a duplicate split across groups.
2. **When Importing a Tab Group (`createFolderWithLinks`)**:
   - Tabs in an imported group (e.g., importing a `"YouTube"` group) that match a YouTube channel or domain already present in an older group (e.g., `"Learn"`) are automatically routed into `"Learn"`.
   - If *all* tabs in a newly imported group are absorbed into existing groups, the redundant empty group is automatically cleaned up so the board stays clutter-free.
3. **When Background Scraping Resolves a YouTube Channel (`TabLinkRow` / `GET /api/links` repair)**:
   - If a YouTube tab was initially saved with generic metadata and its channel name is resolved asynchronously via `/api/scrape`, the store immediately checks whether that channel already exists in an earlier group and automatically moves the tab into that group.
   - Existing workspace tabs that are split across multiple groups for the same YouTube channel or domain are also reconciled into the earliest group on load while preserving intentional manual drag-and-drop moves during the active session.
