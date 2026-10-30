'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FolderPlus,
  Globe,
  GripVertical,
  Plus,
  X,
} from 'lucide-react';
import { useLinkStore } from '@/store/useLinkStore';
import { useThemeStore } from '@/store/useThemeStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { filterLinks } from '@/lib/kanban-rules';
import { Folder, LinkItem, LinkStatus, TabGroupColor } from '@/lib/types';
import { ThemeMode } from '@/lib/theme';
import { EmptyLaneState } from '@/components/EmptyLaneState';
import {
  inferDefaultGroupName,
  parseTabGroupFromDataTransfer,
  parseTabGroupFromTextOrHtml,
  pickNextTabGroupColor,
} from '@/lib/tab-group-drop';

interface KanbanBoardProps {
  onOpenAddModal: (defaultStatus?: LinkStatus, defaultFolderId?: string) => void;
  onOpenImportModal?: () => void;
}

export interface TabGroupStyleEntry {
  label: string;
  dot: string;
  badgeBg: string;
  badgeText: string;
  topBar: string;
  borderHover: string;
}

export const TAB_GROUP_STYLES: Record<TabGroupColor, TabGroupStyleEntry> = {
  blue: {
    label: 'Blue',
    dot: 'bg-sky-400',
    badgeBg: 'bg-sky-500/20 border-sky-400/45',
    badgeText: 'text-sky-200',
    topBar: 'bg-sky-400',
    borderHover: 'hover:border-sky-400/60',
  },
  cyan: {
    label: 'Cyan',
    dot: 'bg-cyan-400',
    badgeBg: 'bg-cyan-500/20 border-cyan-400/45',
    badgeText: 'text-cyan-200',
    topBar: 'bg-cyan-400',
    borderHover: 'hover:border-cyan-400/60',
  },
  emerald: {
    label: 'Green',
    dot: 'bg-emerald-400',
    badgeBg: 'bg-emerald-500/20 border-emerald-400/45',
    badgeText: 'text-emerald-200',
    topBar: 'bg-emerald-400',
    borderHover: 'hover:border-emerald-400/60',
  },
  amber: {
    label: 'Yellow',
    dot: 'bg-amber-400',
    badgeBg: 'bg-amber-500/20 border-amber-400/45',
    badgeText: 'text-amber-200',
    topBar: 'bg-amber-400',
    borderHover: 'hover:border-amber-400/60',
  },
  orange: {
    label: 'Orange',
    dot: 'bg-orange-400',
    badgeBg: 'bg-orange-500/20 border-orange-400/45',
    badgeText: 'text-orange-200',
    topBar: 'bg-orange-400',
    borderHover: 'hover:border-orange-400/60',
  },
  red: {
    label: 'Red',
    dot: 'bg-red-400',
    badgeBg: 'bg-red-500/20 border-red-400/45',
    badgeText: 'text-red-200',
    topBar: 'bg-red-400',
    borderHover: 'hover:border-red-400/60',
  },
  rose: {
    label: 'Pink',
    dot: 'bg-rose-400',
    badgeBg: 'bg-rose-500/20 border-rose-400/45',
    badgeText: 'text-rose-200',
    topBar: 'bg-rose-400',
    borderHover: 'hover:border-rose-400/60',
  },
  purple: {
    label: 'Purple',
    dot: 'bg-purple-400',
    badgeBg: 'bg-purple-500/20 border-purple-400/45',
    badgeText: 'text-purple-200',
    topBar: 'bg-purple-400',
    borderHover: 'hover:border-purple-400/60',
  },
  indigo: {
    label: 'Indigo',
    dot: 'bg-indigo-400',
    badgeBg: 'bg-indigo-500/20 border-indigo-400/45',
    badgeText: 'text-indigo-200',
    topBar: 'bg-indigo-400',
    borderHover: 'hover:border-indigo-400/60',
  },
  zinc: {
    label: 'Grey',
    dot: 'bg-slate-400',
    badgeBg: 'bg-slate-500/25 border-slate-400/45',
    badgeText: 'text-slate-200',
    topBar: 'bg-slate-400',
    borderHover: 'hover:border-slate-400/60',
  },
};

export const LIGHT_TAB_GROUP_STYLES: Record<TabGroupColor, TabGroupStyleEntry> = {
  blue: {
    label: 'Blue',
    dot: 'bg-sky-500',
    badgeBg: 'bg-sky-500/15 border-sky-600/35',
    badgeText: 'text-sky-800',
    topBar: 'bg-sky-500',
    borderHover: 'hover:border-sky-500/60',
  },
  cyan: {
    label: 'Cyan',
    dot: 'bg-cyan-500',
    badgeBg: 'bg-cyan-500/15 border-cyan-600/35',
    badgeText: 'text-cyan-800',
    topBar: 'bg-cyan-500',
    borderHover: 'hover:border-cyan-500/60',
  },
  emerald: {
    label: 'Green',
    dot: 'bg-emerald-500',
    badgeBg: 'bg-emerald-500/15 border-emerald-600/35',
    badgeText: 'text-emerald-800',
    topBar: 'bg-emerald-500',
    borderHover: 'hover:border-emerald-500/60',
  },
  amber: {
    label: 'Yellow',
    dot: 'bg-amber-500',
    badgeBg: 'bg-amber-500/15 border-amber-600/35',
    badgeText: 'text-amber-800',
    topBar: 'bg-amber-500',
    borderHover: 'hover:border-amber-500/60',
  },
  orange: {
    label: 'Orange',
    dot: 'bg-orange-500',
    badgeBg: 'bg-orange-500/15 border-orange-600/35',
    badgeText: 'text-orange-800',
    topBar: 'bg-orange-500',
    borderHover: 'hover:border-orange-500/60',
  },
  red: {
    label: 'Red',
    dot: 'bg-red-500',
    badgeBg: 'bg-red-500/15 border-red-600/35',
    badgeText: 'text-red-800',
    topBar: 'bg-red-500',
    borderHover: 'hover:border-red-500/60',
  },
  rose: {
    label: 'Pink',
    dot: 'bg-rose-500',
    badgeBg: 'bg-rose-500/15 border-rose-600/35',
    badgeText: 'text-rose-800',
    topBar: 'bg-rose-500',
    borderHover: 'hover:border-rose-500/60',
  },
  purple: {
    label: 'Purple',
    dot: 'bg-purple-500',
    badgeBg: 'bg-purple-500/15 border-purple-600/35',
    badgeText: 'text-purple-800',
    topBar: 'bg-purple-500',
    borderHover: 'hover:border-purple-500/60',
  },
  indigo: {
    label: 'Indigo',
    dot: 'bg-indigo-500',
    badgeBg: 'bg-indigo-500/15 border-indigo-600/35',
    badgeText: 'text-indigo-800',
    topBar: 'bg-indigo-500',
    borderHover: 'hover:border-indigo-500/60',
  },
  zinc: {
    label: 'Grey',
    dot: 'bg-slate-500',
    badgeBg: 'bg-slate-500/15 border-slate-500/40',
    badgeText: 'text-slate-800',
    topBar: 'bg-slate-500',
    borderHover: 'hover:border-slate-400',
  },
};

export function getTabGroupStyles(
  mode: ThemeMode
): Record<TabGroupColor, TabGroupStyleEntry> {
  return mode === 'light' ? LIGHT_TAB_GROUP_STYLES : TAB_GROUP_STYLES;
}

export const COLOR_KEYS: TabGroupColor[] = [
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

function isUnresolvedYouTubeUrlAndTitle(url: string, title: string): boolean {
  const lowerUrl = url.toLowerCase();
  const isYt =
    lowerUrl.includes('youtube.com/') || lowerUrl.includes('youtu.be/');
  if (!isYt) return false;
  const normalizedTitle = title.trim().toLowerCase();
  return (
    !normalizedTitle ||
    normalizedTitle === '- youtube' ||
    normalizedTitle === 'youtube' ||
    normalizedTitle === 'watch - youtube' ||
    normalizedTitle === 'watch — youtube.com' ||
    normalizedTitle.startsWith('youtube clip (') ||
    normalizedTitle === 'before you continue to youtube'
  );
}

function isVideoUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes('youtube.com/watch') ||
    lower.includes('youtube.com/shorts/') ||
    lower.includes('youtube.com/live/') ||
    lower.includes('youtube.com/embed/') ||
    lower.includes('youtube.com/v/') ||
    lower.includes('youtu.be/') ||
    lower.includes('vimeo.com/') ||
    lower.includes('dailymotion.com/video') ||
    lower.includes('loom.com/share/') ||
    /\.(mp4|webm|mov)(\?|$)/i.test(lower)
  );
}

function TabLinkRow({
  link,
  onUpdateLinkMeta,
  onDelete,
  onDragStart,
}: {
  link: LinkItem;
  onUpdateLinkMeta: (
    linkId: string,
    patch: Partial<Pick<LinkItem, 'title' | 'reading_minutes' | 'video_duration'>>
  ) => void;
  onDelete: (linkId: string) => void;
  onDragStart: (e: React.DragEvent<HTMLElement>, link: LinkItem) => void;
}) {
  const [faviconFailed, setFaviconFailed] = useState(false);
  const [resolvedDuration, setResolvedDuration] = useState<string | null>(
    link.video_duration ?? null
  );
  const { t } = useLanguageStore();

  const effectiveVideoDuration = link.video_duration || resolvedDuration;
  const needsTitle = isUnresolvedYouTubeUrlAndTitle(link.url, link.title);
  const needsVideoDuration = isVideoUrl(link.url) && !effectiveVideoDuration;

  React.useEffect(() => {
    if (!needsTitle && !needsVideoDuration) return;
    let cancelled = false;
    fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: link.url }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.metadata) return;
        const patch: Partial<
          Pick<LinkItem, 'title' | 'reading_minutes' | 'video_duration'>
        > = {};
        if (needsTitle && data.metadata.title) {
          const resolvedTitle = String(data.metadata.title).trim();
          if (resolvedTitle && resolvedTitle !== link.title) {
            patch.title = resolvedTitle;
          }
        }
        if (data.metadata.video_duration) {
          const dur = String(data.metadata.video_duration);
          setResolvedDuration(dur);
          patch.video_duration = dur;
          if (typeof data.metadata.reading_minutes === 'number') {
            patch.reading_minutes = data.metadata.reading_minutes;
          }
        }
        if (Object.keys(patch).length > 0) {
          onUpdateLinkMeta(link.id, patch);
        }
      })
      .catch(() => {
        // Ignore background metadata repair errors
      });
    return () => {
      cancelled = true;
    };
  }, [link.id, link.url, link.title, needsTitle, needsVideoDuration, onUpdateLinkMeta]);

  return (
    <article
      draggable
      onDragStart={(e) => onDragStart(e, link)}
      aria-label={link.title}
      className="group rounded-md border border-[var(--tf-border)] bg-[var(--tf-card)] hover:bg-[var(--tf-card-hover)] hover:border-[var(--tf-border-strong)] transition-colors cursor-grab active:cursor-grabbing overflow-hidden"
    >
      <div className="p-2.5 flex items-start justify-between gap-2 text-[11px]">
        {/* Browser Tab Favicon + Title + Domain */}
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-2 min-w-0 flex-1 focus-visible:outline-none focus-visible:underline"
        >
          <span className="w-4 h-4 mt-0.5 rounded bg-[var(--tf-surface)] border border-[var(--tf-border)] flex items-center justify-center shrink-0 overflow-hidden">
            {!faviconFailed && link.favicon ? (
              <img
                src={link.favicon}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setFaviconFailed(true)}
                className="w-3 h-3 object-contain"
              />
            ) : (
              <Globe className="w-2.5 h-2.5 text-[var(--tf-text-muted)]" />
            )}
          </span>

          <div className="min-w-0 flex-1 space-y-0.5">
            <h3
              title={link.title}
              className="text-[11px] font-medium text-[var(--tf-text)] group-hover:text-[var(--tf-accent-text)] transition-colors leading-snug line-clamp-2 break-words"
            >
              {link.title}
            </h3>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-[var(--tf-text-muted)]">
              <span className="truncate text-[var(--tf-text-secondary)]">
                {link.domain}
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums shrink-0">
                {effectiveVideoDuration || `${link.reading_minutes}m`}
              </span>
            </div>
          </div>
        </a>

        {/* Open + Close Tab Button */}
        <div className="flex items-center gap-0.5 shrink-0">
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t.board.openInNewTabAria(link.title)}
            className="p-1 text-[var(--tf-text-muted)] hover:text-[var(--tf-text)] rounded hover:bg-[var(--tf-surface)] transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
          </a>

          <button
            type="button"
            onClick={() => onDelete(link.id)}
            aria-label={t.board.deleteLinkAria(link.title)}
            className="p-1 text-[var(--tf-text-muted)] hover:text-rose-500 rounded hover:bg-[var(--tf-surface)] transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    </article>
  );
}

export function KanbanBoard({
  onOpenAddModal,
  onOpenImportModal,
}: KanbanBoardProps) {
  const {
    links,
    folders,
    activeFolderId,
    newlyCreatedGroupId,
    isImportingGroup,
    isLoading,
    errorMessage,
    setActiveFolderId,
    clearNewlyCreatedGroupId,
    clearError,
    addLink,
    updateLink,
    deleteLink,
    createFolder,
    createFolderWithLinks,
    updateFolder,
    reorderFolders,
  } = useLinkStore();

  const { mode } = useThemeStore();
  const { t } = useLanguageStore();
  const groupStyles = getTabGroupStyles(mode);

  // Drag & Drop + Bottom Nav Focus + Inline Group Rename State
  const [draggedLinkId, setDraggedLinkId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null);
  const [folderDropTarget, setFolderDropTarget] = useState<{
    groupId: string;
    position: 'before' | 'after';
  } | null>(null);
  const [openColorPickerId, setOpenColorPickerId] = useState<string | null>(null);
  const [focusedGroupId, setFocusedGroupId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const boardScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setFocusedGroupId(activeFolderId);
    if (!activeFolderId) return;
    const rafId = requestAnimationFrame(() => {
      const colEl = document.getElementById(`tab-group-col-${activeFolderId}`);
      colEl?.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    });
    return () => cancelAnimationFrame(rafId);
  }, [activeFolderId]);

  // Auto-scroll and focus + select the inline rename input whenever a new Tab Group is created via drop/import
  useEffect(() => {
    if (!newlyCreatedGroupId) return;
    const targetFolder = folders.find((f) => f.id === newlyCreatedGroupId);
    if (!targetFolder) return;

    setFocusedGroupId(newlyCreatedGroupId);
    setEditingGroupId(newlyCreatedGroupId);
    setEditingGroupName(targetFolder.name);

    const timerId = window.setTimeout(() => {
      const colEl = document.getElementById(
        `tab-group-col-${newlyCreatedGroupId}`
      );
      colEl?.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });

      const inputEl = document.getElementById(
        `tab-group-title-input-${newlyCreatedGroupId}`
      ) as HTMLInputElement | null;
      if (inputEl) {
        inputEl.focus();
        inputEl.select();
      }
      clearNewlyCreatedGroupId();
    }, 60);

    return () => window.clearTimeout(timerId);
  }, [newlyCreatedGroupId, folders, clearNewlyCreatedGroupId]);

  const handleCreateGroupFromParsedPayload = useCallback(
    async (parsed: ReturnType<typeof parseTabGroupFromTextOrHtml>) => {
      if (parsed.tabs.length === 0) return;
      const groupName = inferDefaultGroupName(
        parsed,
        t.board.defaultNewGroupName
      );
      const color =
        parsed.color ?? pickNextTabGroupColor(useLinkStore.getState().folders.length);
      await createFolderWithLinks({
        name: groupName,
        color,
        tabs: parsed.tabs,
        focusInlineRename: true,
      });
    },
    [createFolderWithLinks, t.board.defaultNewGroupName]
  );

  // Listen for global Ctrl+V / Cmd+V paste on the board (when not typing in an input/textarea)
  useEffect(() => {
    const handleGlobalPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (!event.clipboardData) return;

      const rawText = event.clipboardData.getData('text/plain');
      const rawHtml = event.clipboardData.getData('text/html');
      const customJson = event.clipboardData.getData(
        'application/x-tabflow-tabgroup'
      );
      const parsed = parseTabGroupFromTextOrHtml(rawText, rawHtml, customJson);

      if (parsed.tabs.length === 0) return;

      // If pasting a multi-URL list / Bookmark folder / TabGroup JSON, or if the board has no groups yet, create a new Tab Group
      if (
        parsed.isGroupPayload ||
        parsed.tabs.length > 1 ||
        useLinkStore.getState().folders.length === 0
      ) {
        event.preventDefault();
        void handleCreateGroupFromParsedPayload(parsed);
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [handleCreateGroupFromParsedPayload]);

  const filteredLinks = useMemo(
    () =>
      filterLinks(links, folders, {
        folderId: activeFolderId,
        tag: null,
        searchQuery: '',
      }),
    [links, folders, activeFolderId]
  );

  const folderIdSet = useMemo(
    () => new Set(folders.map((f) => f.id)),
    [folders]
  );

  const visibleGroups = useMemo(() => {
    const baseGroups = activeFolderId
      ? folders.filter(
          (f) => f.id === activeFolderId || f.parent_id === activeFolderId
        )
      : folders;

    const hasUngroupedLinks = filteredLinks.some(
      (l) => !l.folder_id || !folderIdSet.has(l.folder_id)
    );

    if (hasUngroupedLinks && !activeFolderId) {
      const virtualGroup: Folder = {
        id: '__ungrouped__',
        user_id: 'current',
        name: t.sidebar.allSavedTabs,
        parent_id: null,
        order_index: baseGroups.length,
        color: 'blue',
        collapsed: false,
      };
      return [...baseGroups, virtualGroup];
    }

    return baseGroups;
  }, [folders, activeFolderId, filteredLinks, folderIdSet, t.sidebar.allSavedTabs]);

  const commitEditingGroup = async (groupId: string) => {
    const trimmed = editingGroupName.trim();
    const current = folders.find((f) => f.id === groupId);
    setEditingGroupId(null);
    if (!trimmed || !current || trimmed === current.name) return;
    await updateFolder(groupId, { name: trimmed });
  };

  const isFolderDragEvent = (e: React.DragEvent<HTMLElement>): boolean => {
    if (draggedFolderId) return true;
    const types = Array.from(e.dataTransfer?.types ?? []);
    return types.includes('application/x-tabflow-folder-id');
  };

  const handleGroupHeaderDragStart = (
    e: React.DragEvent<HTMLElement>,
    group: Folder
  ) => {
    if (group.id === '__ungrouped__' || editingGroupId === group.id) {
      e.preventDefault();
      return;
    }
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.closest('button:not([data-group-drag-handle="true"])'))
    ) {
      e.preventDefault();
      return;
    }

    e.stopPropagation();
    setDraggedFolderId(group.id);
    setDraggedLinkId(null);
    setDragOverGroupId(null);
    e.dataTransfer.setData('application/x-tabflow-folder-id', group.id);
    e.dataTransfer.setData('text/plain', group.id);
    e.dataTransfer.effectAllowed = 'move';

    const colEl = document.getElementById(`tab-group-col-${group.id}`);
    if (colEl && e.dataTransfer.setDragImage) {
      const rect = colEl.getBoundingClientRect();
      const offsetX = Math.min(
        Math.max(e.clientX - rect.left, 24),
        Math.max(rect.width - 24, 24)
      );
      e.dataTransfer.setDragImage(colEl, offsetX, 20);
    }
  };

  const handleGroupHeaderDragEnd = () => {
    setDraggedFolderId(null);
    setFolderDropTarget(null);
    setDragOverGroupId(null);
  };

  const handleDragStart = (e: React.DragEvent<HTMLElement>, link: LinkItem) => {
    setDraggedLinkId(link.id);
    setDraggedFolderId(null);
    setFolderDropTarget(null);
    e.dataTransfer.setData('application/x-tabflow-link-id', link.id);
    e.dataTransfer.setData('text/plain', link.id);
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleDropOnGroup = async (
    e: React.DragEvent<HTMLElement>,
    targetFolderId: string
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const sourceFolderId =
      e.dataTransfer.getData('application/x-tabflow-folder-id') ||
      draggedFolderId;

    if (sourceFolderId) {
      const rect = e.currentTarget.getBoundingClientRect();
      const position: 'before' | 'after' =
        folderDropTarget?.groupId === targetFolderId
          ? folderDropTarget.position
          : e.clientX < rect.left + rect.width / 2
          ? 'before'
          : 'after';

      setDraggedFolderId(null);
      setFolderDropTarget(null);
      setDragOverGroupId(null);

      if (
        targetFolderId !== '__ungrouped__' &&
        sourceFolderId !== targetFolderId
      ) {
        await reorderFolders(sourceFolderId, targetFolderId, position);
      }
      return;
    }

    const resolvedTargetFolderId =
      targetFolderId === '__ungrouped__'
        ? (folders[0]?.id ?? '')
        : targetFolderId;

    const internalLinkId =
      e.dataTransfer.getData('application/x-tabflow-link-id') || draggedLinkId;
    const plainText = e.dataTransfer.getData('text/plain').trim();
    const matchedLink = links.find(
      (l) => l.id === internalLinkId || l.id === plainText
    );

    setDraggedLinkId(null);
    setDragOverGroupId(null);

    if (matchedLink && resolvedTargetFolderId) {
      if (e.altKey || e.ctrlKey || e.metaKey) {
        await addLink({
          url: matchedLink.url,
          title: matchedLink.title,
          folder_id: resolvedTargetFolderId,
          tags: matchedLink.tags?.length ? matchedLink.tags : ['saved-tab'],
          status: LinkStatus.UNREAD,
        });
      } else if (matchedLink.folder_id !== resolvedTargetFolderId) {
        await updateLink(matchedLink.id, { folder_id: resolvedTargetFolderId });
      }
      return;
    }

    const parsed = parseTabGroupFromDataTransfer(e.dataTransfer);
    if (parsed.tabs.length > 0) {
      for (const tab of parsed.tabs) {
        await addLink({
          url: tab.url,
          title: tab.title,
          folder_id: resolvedTargetFolderId || null,
          tags: ['saved-tab'],
          status: LinkStatus.UNREAD,
        });
      }
    }
  };

  const handleDropToCreateNewGroup = async (
    e: React.DragEvent<HTMLElement>
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const sourceFolderId =
      e.dataTransfer.getData('application/x-tabflow-folder-id') ||
      draggedFolderId;
    if (sourceFolderId) {
      const lastFolder = folders[folders.length - 1];
      setDraggedFolderId(null);
      setFolderDropTarget(null);
      setDragOverGroupId(null);
      if (lastFolder && lastFolder.id !== sourceFolderId) {
        await reorderFolders(sourceFolderId, lastFolder.id, 'after');
      }
      return;
    }

    const internalLinkId =
      e.dataTransfer.getData('application/x-tabflow-link-id') || draggedLinkId;
    const plainText = e.dataTransfer.getData('text/plain').trim();
    const matchedLink = links.find(
      (l) => l.id === internalLinkId || l.id === plainText
    );

    setDraggedLinkId(null);
    setDragOverGroupId(null);

    // If user dragged an existing internal tab card onto "Drop to create new Tab Group"
    if (matchedLink) {
      const nextColor = pickNextTabGroupColor(folders.length);
      const created = await createFolder(
        t.board.defaultNewGroupName,
        null,
        nextColor
      );
      if (created) {
        await updateLink(matchedLink.id, { folder_id: created.id });
        useLinkStore.setState({
          activeFolderId: null,
          newlyCreatedGroupId: created.id,
        });
      }
      return;
    }

    const parsed = parseTabGroupFromDataTransfer(e.dataTransfer);
    if (parsed.tabs.length > 0) {
      await handleCreateGroupFromParsedPayload(parsed);
    }
  };

  const handleDropOnEmptyBoard = async (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverGroupId(null);

    const parsed = parseTabGroupFromDataTransfer(e.dataTransfer);
    if (parsed.tabs.length > 0) {
      await handleCreateGroupFromParsedPayload(parsed);
    }
  };

  const handleOpenAllInGroup = (groupLinks: LinkItem[]) => {
    groupLinks.forEach((l) => {
      window.open(l.url, '_blank', 'noopener,noreferrer');
    });
  };

  const handleSelectBottomTab = (groupId: string | null) => {
    if (groupId === null) {
      setActiveFolderId(null);
      setFocusedGroupId(null);
      boardScrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
      return;
    }

    setFocusedGroupId(groupId);

    if (activeFolderId !== null && activeFolderId !== groupId) {
      setActiveFolderId(null);
    }

    requestAnimationFrame(() => {
      const colEl = document.getElementById(`tab-group-col-${groupId}`);
      if (colEl) {
        colEl.scrollIntoView({
          behavior: 'smooth',
          inline: 'center',
          block: 'nearest',
        });
      }
    });
  };

  const handleScrollBoardBy = (deltaX: number) => {
    boardScrollRef.current?.scrollBy({ left: deltaX, behavior: 'smooth' });
  };

  const handleBoardWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!boardScrollRef.current) return;
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;

    const target = e.target as HTMLElement | null;
    const tabListEl = target?.closest(
      '[data-tab-list-scroll="true"]'
    ) as HTMLElement | null;

    if (tabListEl && tabListEl.scrollHeight > tabListEl.clientHeight) {
      const atTop = tabListEl.scrollTop <= 0 && e.deltaY < 0;
      const atBottom =
        tabListEl.scrollTop + tabListEl.clientHeight >=
          tabListEl.scrollHeight - 1 && e.deltaY > 0;
      if (!atTop && !atBottom) {
        return;
      }
    }

    boardScrollRef.current.scrollLeft += e.deltaY;
  };

  const handleBottomNavWheel = (e: React.WheelEvent<HTMLElement>) => {
    e.stopPropagation();
    const delta =
      Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (delta === 0) return;

    if (boardScrollRef.current) {
      boardScrollRef.current.scrollLeft += delta;
    }
    if (e.currentTarget.scrollWidth > e.currentTarget.clientWidth) {
      e.currentTarget.scrollLeft += delta;
    }
  };

  return (
    <div
      onWheel={handleBoardWheel}
      className="relative flex-1 flex flex-col min-w-0 h-full bg-[var(--tf-canvas)] overflow-hidden transition-colors duration-200"
    >
      {errorMessage && (
        <div
          role="alert"
          className="mx-3 sm:mx-6 mt-3 sm:mt-4 px-3 py-2 rounded-md bg-rose-500/15 border border-rose-500/40 flex items-center justify-between text-xs text-rose-500 shrink-0"
        >
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={clearError}
            aria-label={t.board.dismissErrorAria}
            className="text-rose-500 hover:opacity-80 ml-4"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Google Chrome Tab Groups Column Board */}
      <div
        ref={boardScrollRef}
        onDragOver={(e) => {
          if (isFolderDragEvent(e)) {
            e.preventDefault();
            if (boardScrollRef.current) {
              const boardRect = boardScrollRef.current.getBoundingClientRect();
              const edgeThreshold = 72;
              if (e.clientX - boardRect.left < edgeThreshold) {
                boardScrollRef.current.scrollLeft -= 14;
              } else if (boardRect.right - e.clientX < edgeThreshold) {
                boardScrollRef.current.scrollLeft += 14;
              }
            }
            return;
          }
          if (visibleGroups.length === 0) {
            e.preventDefault();
            if (dragOverGroupId !== '__empty_board__') {
              setDragOverGroupId('__empty_board__');
            }
          }
        }}
        onDragLeave={(e) => {
          if (
            visibleGroups.length === 0 &&
            !e.currentTarget.contains(e.relatedTarget as Node)
          ) {
            setDragOverGroupId(null);
          }
        }}
        onDrop={(e) => {
          const sourceFolderId =
            e.dataTransfer.getData('application/x-tabflow-folder-id') ||
            draggedFolderId;
          if (sourceFolderId && folderDropTarget) {
            e.preventDefault();
            const target = folderDropTarget;
            setDraggedFolderId(null);
            setFolderDropTarget(null);
            setDragOverGroupId(null);
            if (sourceFolderId !== target.groupId) {
              void reorderFolders(
                sourceFolderId,
                target.groupId,
                target.position
              );
            }
            return;
          }
          if (visibleGroups.length === 0) {
            void handleDropOnEmptyBoard(e);
          }
        }}
        className="p-3 sm:p-4 lg:p-6 pb-20 sm:pb-24 flex-1 flex flex-row gap-3 sm:gap-4 lg:gap-5 items-start overflow-x-auto overflow-y-hidden min-h-0"
      >
        {!isLoading && visibleGroups.length === 0 && (
          <div
            data-testid="empty-board-state"
            className={`w-full h-full min-h-[240px] flex items-center justify-center rounded-xl border border-dashed transition-colors p-6 ${
              dragOverGroupId === '__empty_board__'
                ? 'border-[var(--tf-accent)] bg-[var(--tf-accent-soft)]'
                : 'border-[var(--tf-border)] bg-[var(--tf-surface)]/40'
            }`}
          >
            <div className="max-w-md text-center space-y-3">
              <div className="mx-auto w-10 h-10 rounded-lg border border-[var(--tf-border)] bg-[var(--tf-elevated)] flex items-center justify-center text-[var(--tf-text-muted)]">
                <Globe className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-[var(--tf-text)]">
                  {dragOverGroupId === '__empty_board__'
                    ? t.board.dropNewGroupActive
                    : t.board.emptyBoardTitle}
                </h2>
                <p className="text-xs text-[var(--tf-text-muted)] leading-relaxed">
                  {t.board.emptyBoardSubtext}
                </p>
              </div>
              <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenAddModal(LinkStatus.UNREAD)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[var(--tf-text)] text-[var(--tf-canvas)] hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.board.emptyBoardAddBtn}</span>
                </button>
                {onOpenImportModal && (
                  <button
                    type="button"
                    onClick={onOpenImportModal}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border border-[var(--tf-border-strong)] bg-[var(--tf-elevated)] text-[var(--tf-text)] hover:border-[var(--tf-accent)] transition-colors whitespace-nowrap shrink-0"
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-[var(--tf-accent)]" />
                    <span>{t.board.emptyBoardImportBtn}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {visibleGroups.map((group) => {
          const colorKey: TabGroupColor = group.color ?? 'blue';
          const style = groupStyles[colorKey] ?? groupStyles.blue;
          const groupLinks =
            group.id === '__ungrouped__'
              ? filteredLinks.filter(
                  (l) => !l.folder_id || !folderIdSet.has(l.folder_id)
                )
              : filteredLinks.filter((l) => l.folder_id === group.id);
          const isCollapsed = Boolean(group.collapsed);
          const isDropTarget = dragOverGroupId === group.id;
          const isDraggingThisGroup = draggedFolderId === group.id;
          const isGroupReorderTarget =
            folderDropTarget?.groupId === group.id &&
            draggedFolderId !== group.id;
          const reorderPosition = isGroupReorderTarget
            ? folderDropTarget?.position
            : null;
          const isFocused =
            focusedGroupId === group.id || activeFolderId === group.id;
          const isEditingName = editingGroupId === group.id;

          return (
            <section
              key={group.id}
              id={`tab-group-col-${group.id}`}
              aria-label={t.board.tabGroupAria(group.name)}
              onClick={() => setFocusedGroupId(group.id)}
              onDragOver={(e) => {
                e.preventDefault();
                if (isFolderDragEvent(e)) {
                  e.dataTransfer.dropEffect = 'move';
                  if (
                    group.id !== '__ungrouped__' &&
                    draggedFolderId !== group.id
                  ) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const nextPos: 'before' | 'after' =
                      e.clientX < rect.left + rect.width / 2
                        ? 'before'
                        : 'after';
                    if (
                      folderDropTarget?.groupId !== group.id ||
                      folderDropTarget.position !== nextPos
                    ) {
                      setFolderDropTarget({
                        groupId: group.id,
                        position: nextPos,
                      });
                    }
                  }
                  return;
                }
                if (dragOverGroupId !== group.id) setDragOverGroupId(group.id);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  if (dragOverGroupId === group.id) setDragOverGroupId(null);
                  if (folderDropTarget?.groupId === group.id) {
                    setFolderDropTarget(null);
                  }
                }
              }}
              onDrop={(e) => handleDropOnGroup(e, group.id)}
              className={`relative ${
                visibleGroups.length === 1
                  ? 'w-full max-w-[460px] sm:w-[360px] md:w-[400px]'
                  : 'w-[calc(100vw-4.5rem)] max-w-[330px] sm:w-[280px] md:w-[310px] lg:w-[340px] xl:w-[360px] 2xl:w-[380px]'
              } shrink-0 flex flex-col max-h-full rounded-lg border bg-[var(--tf-surface)] overflow-hidden transition-all ${
                isDraggingThisGroup
                  ? 'opacity-50 scale-[0.98] border-dashed border-[var(--tf-accent)]'
                  : isGroupReorderTarget
                  ? 'border-[var(--tf-accent)] ring-2 ring-[var(--tf-accent)]'
                  : isDropTarget
                  ? 'border-[var(--tf-accent)] ring-1 ring-[var(--tf-accent)]'
                  : isFocused
                  ? 'border-[var(--tf-border-strong)] ring-1 ring-[var(--tf-border-strong)]'
                  : `border-[var(--tf-border)] ${style.borderHover}`
              }`}
            >
              {/* Visual insertion edge indicator when reordering Tab Groups */}
              {reorderPosition === 'before' && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-[var(--tf-accent)] z-30"
                />
              )}
              {reorderPosition === 'after' && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 right-0 w-1.5 bg-[var(--tf-accent)] z-30"
                />
              )}

              {/* Google Chrome Tab Group Colored Top Accent Line */}
              <div className={`h-1 w-full shrink-0 ${style.topBar}`} />

              {/* Collapsible & Draggable Tab Group Header */}
              <header
                draggable={!isEditingName && group.id !== '__ungrouped__'}
                onDragStart={(e) => handleGroupHeaderDragStart(e, group)}
                onDragEnd={handleGroupHeaderDragEnd}
                title={
                  !isEditingName && group.id !== '__ungrouped__'
                    ? t.board.dragGroupTitle
                    : undefined
                }
                className={`px-2.5 sm:px-3 py-2 sm:py-2.5 border-b border-[var(--tf-border)] flex items-center justify-between gap-1.5 sm:gap-2 bg-[var(--tf-elevated)] shrink-0 select-none ${
                  !isEditingName && group.id !== '__ungrouped__'
                    ? 'cursor-grab active:cursor-grabbing'
                    : ''
                }`}
              >
                <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 flex-1">
                  {group.id !== '__ungrouped__' && (
                    <span
                      data-group-drag-handle="true"
                      aria-hidden="true"
                      title={t.board.dragGroupTitle}
                      className="text-[var(--tf-text-muted)] hover:text-[var(--tf-text-secondary)] transition-colors shrink-0 -ml-0.5 cursor-grab active:cursor-grabbing"
                    >
                      <GripVertical className="w-3.5 h-3.5" />
                    </span>
                  )}

                  <div
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold border ${style.badgeBg} ${style.badgeText} min-w-0 max-w-[145px] sm:max-w-[170px] lg:max-w-[190px]`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        updateFolder(group.id, { collapsed: !isCollapsed })
                      }
                      aria-expanded={!isCollapsed}
                      aria-label={t.board.toggleGroupAria(group.name)}
                      title={
                        isCollapsed
                          ? t.board.expandGroupTitle
                          : t.board.collapseGroupTitle
                      }
                      className="p-0.5 -ml-0.5 rounded hover:bg-black/10 transition-colors shrink-0"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                      )}
                    </button>

                    <input
                      id={`tab-group-title-input-${group.id}`}
                      type="text"
                      value={isEditingName ? editingGroupName : group.name}
                      onFocus={() => {
                        setEditingGroupId(group.id);
                        setEditingGroupName(group.name);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setEditingGroupName(e.target.value)}
                      onBlur={() => commitEditingGroup(group.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.currentTarget.blur();
                        } else if (e.key === 'Escape') {
                          setEditingGroupId(null);
                          setEditingGroupName(group.name);
                          e.currentTarget.blur();
                        }
                      }}
                      aria-label={t.sidebar.editGroupNameAria(group.name)}
                      title={t.board.editGroupTitle}
                      className="w-full min-w-0 bg-transparent text-xs font-semibold text-inherit truncate rounded px-1 -mx-0.5 border border-transparent focus:border-[var(--tf-accent)] focus:bg-[var(--tf-canvas)] focus:text-[var(--tf-text)] focus:outline-none transition-colors cursor-text"
                    />
                  </div>

                  <span className="font-mono text-[11px] tabular-nums text-[var(--tf-text-muted)] shrink-0">
                    {groupLinks.length}
                  </span>
                </div>

                {/* Group Actions: Change Color, Open All, Add Link to Group */}
                <div className="flex items-center gap-0.5 sm:gap-1 shrink-0 relative">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenColorPickerId(
                        openColorPickerId === group.id ? null : group.id
                      )
                    }
                    aria-label={t.board.changeColorAria(group.name)}
                    title={t.board.changeColorTitle}
                    className="p-1.5 rounded hover:bg-[var(--tf-surface)] flex items-center justify-center"
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
                  </button>

                  {openColorPickerId === group.id && (
                    <div className="absolute right-0 top-8 z-20 p-2 rounded-md border border-[var(--tf-border-strong)] bg-[var(--tf-elevated)] shadow-xl grid grid-cols-5 gap-1.5 w-max">
                      {COLOR_KEYS.map((cKey) => (
                        <button
                          key={cKey}
                          type="button"
                          title={t.board.colors[cKey]}
                          aria-label={t.board.setColorAria(t.board.colors[cKey])}
                          onClick={(e) => {
                            e.stopPropagation();
                            updateFolder(group.id, { color: cKey });
                            setOpenColorPickerId(null);
                          }}
                          className={`w-4 h-4 rounded-full ${groupStyles[cKey].dot} hover:scale-110 transition-transform ${
                            colorKey === cKey
                              ? 'ring-2 ring-[var(--tf-text)] ring-offset-1 ring-offset-[var(--tf-elevated)]'
                              : 'opacity-85 hover:opacity-100'
                          }`}
                        />
                      ))}
                    </div>
                  )}

                  {groupLinks.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleOpenAllInGroup(groupLinks)}
                      className="px-1.5 py-1 text-[11px] font-mono text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-surface)] rounded transition-colors whitespace-nowrap"
                    >
                      {t.board.openAll}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onOpenAddModal(LinkStatus.UNREAD, group.id)}
                    aria-label={t.board.addLinkToGroupAria(group.name)}
                    title={t.board.addLinkToGroupTitle(group.name)}
                    className="p-1 text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-surface)] rounded transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </header>

              {/* Group Tabs List (Hidden when Collapsed like Chrome Tab Groups) */}
              {!isCollapsed && (
                <div
                  data-tab-list-scroll="true"
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (isFolderDragEvent(e)) {
                      return;
                    }
                    if (dragOverGroupId !== group.id) {
                      setDragOverGroupId(group.id);
                    }
                  }}
                  onDrop={(e) => handleDropOnGroup(e, group.id)}
                  className={`p-2.5 sm:p-3 space-y-2 flex-1 min-h-0 overflow-y-auto transition-colors ${
                    isDropTarget ? 'bg-[var(--tf-accent-soft)]' : ''
                  }`}
                >
                  {isLoading ? (
                    <div className="h-14 rounded-md bg-[var(--tf-elevated)] animate-pulse" />
                  ) : groupLinks.length === 0 ? (
                    <EmptyLaneState
                      group={group}
                      isDragOver={isDropTarget}
                      onAddViaModal={(folderId) =>
                        onOpenAddModal(LinkStatus.UNREAD, folderId)
                      }
                      onQuickSaveUrl={async (url, folderId) => {
                        const created = await addLink({
                          url,
                          folder_id: folderId,
                          tags: ['saved-tab'],
                          status: LinkStatus.UNREAD,
                        });
                        return Boolean(created);
                      }}
                    />
                  ) : (
                    <>
                      {groupLinks.map((link) => (
                        <TabLinkRow
                          key={link.id}
                          link={link}
                          onUpdateLinkMeta={updateLink}
                          onDelete={deleteLink}
                          onDragStart={handleDragStart}
                        />
                      ))}

                      {isDropTarget && (
                        <div className="rounded-md border border-dashed border-[var(--tf-accent)] bg-[var(--tf-accent-soft)] px-3 py-2 text-center text-[11px] font-medium text-[var(--tf-accent-text)]">
                          {t.board.dropToAdd(group.name)}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </section>
          );
        })}

        {/* Dedicated "Drop to Create New Tab Group" Zone at the end of the Board */}
        {!isLoading && visibleGroups.length > 0 && (
          <section
            id="tab-group-drop-new"
            data-testid="drop-new-tab-group-zone"
            aria-label={t.board.dropNewGroupTitle}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragOverGroupId !== '__new_group_drop__') {
                setDragOverGroupId('__new_group_drop__');
              }
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                if (dragOverGroupId === '__new_group_drop__') {
                  setDragOverGroupId(null);
                }
              }
            }}
            onDrop={handleDropToCreateNewGroup}
            className={`w-[240px] sm:w-[250px] md:w-[270px] shrink-0 rounded-lg border border-dashed p-4 flex flex-col items-center justify-center text-center gap-2.5 transition-all select-none ${
              dragOverGroupId === '__new_group_drop__'
                ? 'border-[var(--tf-accent)] bg-[var(--tf-accent-soft)] ring-1 ring-[var(--tf-accent)] min-h-[210px]'
                : 'border-[var(--tf-border)] bg-[var(--tf-surface)]/45 hover:border-[var(--tf-border-strong)] hover:bg-[var(--tf-surface)]/80 min-h-[180px]'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-colors ${
                dragOverGroupId === '__new_group_drop__'
                  ? 'border-[var(--tf-accent)] bg-[var(--tf-elevated)] text-[var(--tf-accent)]'
                  : 'border-[var(--tf-border)] bg-[var(--tf-elevated)] text-[var(--tf-text-secondary)]'
              }`}
            >
              <FolderPlus className="w-4 h-4" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xs font-semibold text-[var(--tf-text)]">
                { isImportingGroup
                  ? t.board.creatingGroupStatus
                  : dragOverGroupId === '__new_group_drop__'
                  ? t.board.dropNewGroupActive
                  : t.board.dropNewGroupTitle }
              </h3>
              <p className="text-[11px] text-[var(--tf-text-muted)] leading-relaxed">
                {t.board.dropNewGroupSubtext}
              </p>
            </div>

            {onOpenImportModal && (
              <button
                type="button"
                onClick={onOpenImportModal}
                className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium border border-[var(--tf-border)] bg-[var(--tf-elevated)] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:border-[var(--tf-border-strong)] transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3 h-3" />
                <span>{t.board.dropNewGroupPasteHint}</span>
              </button>
            )}
          </section>
        )}
      </div>

      {/* Bottom Tab Selection Row for Quick Navigation */}
      {folders.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 sm:bottom-5 z-20 flex justify-center px-2.5 sm:px-4">
          <nav
            aria-label={t.board.bottomNavAria}
            onWheel={handleBottomNavWheel}
            className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 rounded-xl border border-[var(--tf-border-strong)] bg-[var(--tf-elevated)] backdrop-blur-md shadow-2xl max-w-full overflow-x-auto"
          >
            <button
              type="button"
              onClick={() => handleScrollBoardBy(-320)}
              aria-label={t.board.scrollLeftAria}
              title={t.board.scrollLeftTitle}
              className="p-1 sm:p-1.5 rounded-lg text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-surface)] transition-colors shrink-0"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {folders.map((group) => {
              const colorKey: TabGroupColor = group.color ?? 'blue';
              const style = groupStyles[colorKey] ?? groupStyles.blue;
              const count = links.filter((l) => l.folder_id === group.id).length;
              const isSelected =
                activeFolderId === group.id || focusedGroupId === group.id;
              const isDropTarget = dragOverGroupId === group.id;

              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => {
                    if (group.collapsed) {
                      updateFolder(group.id, { collapsed: false });
                    }
                    handleSelectBottomTab(group.id);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverGroupId !== group.id) {
                      setDragOverGroupId(group.id);
                    }
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      if (dragOverGroupId === group.id) {
                        setDragOverGroupId(null);
                      }
                    }
                  }}
                  onDrop={(e) => handleDropOnGroup(e, group.id)}
                  className={`inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition-all whitespace-nowrap shrink-0 border ${
                    isDropTarget
                      ? 'border-[var(--tf-accent)] bg-[var(--tf-accent-soft)] text-[var(--tf-text)] scale-[1.02]'
                      : isSelected
                      ? `${style.badgeBg} ${style.badgeText}`
                      : 'border-transparent text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-surface)]'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`}
                  />
                  <span className="max-w-[110px] sm:max-w-[140px] truncate">
                    {group.name}
                  </span>
                  <span className="font-mono text-[10px] tabular-nums opacity-75">
                    {count}
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => handleScrollBoardBy(320)}
              aria-label={t.board.scrollRightAria}
              title={t.board.scrollRightTitle}
              className="p-1 sm:p-1.5 rounded-lg text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-surface)] transition-colors shrink-0"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}
