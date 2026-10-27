'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FolderPlus,
  Globe,
  Layers,
  LayoutGrid,
  List,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useLinkStore } from '@/store/useLinkStore';
import { filterLinks } from '@/lib/kanban-rules';
import { Folder, LinkItem, LinkStatus, TabGroupColor } from '@/lib/types';
import { EmptyLaneState } from '@/components/EmptyLaneState';

function extractDroppedUrl(dataTransfer: DataTransfer): string {
  const uriList = dataTransfer.getData('text/uri-list');
  if (uriList) {
    const firstValidLine = uriList
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith('#'));
    if (firstValidLine) return firstValidLine;
  }
  const directUrl = dataTransfer.getData('URL');
  if (directUrl && directUrl.trim()) return directUrl.trim();

  const html = dataTransfer.getData('text/html');
  if (html) {
    const match = html.match(/href=["'](https?:\/\/[^"']+)["']/i);
    if (match?.[1]) return match[1].trim();
  }

  const plainText = dataTransfer.getData('text/plain');
  return plainText ? plainText.trim().split(/\s+/)[0] : '';
}

interface KanbanBoardProps {
  onOpenAddModal: (defaultStatus?: LinkStatus, defaultFolderId?: string) => void;
}

export const TAB_GROUP_STYLES: Record<
  TabGroupColor,
  {
    label: string;
    dot: string;
    badgeBg: string;
    badgeText: string;
    topBar: string;
    borderHover: string;
  }
> = {
  blue: {
    label: 'Blue',
    dot: 'bg-sky-400',
    badgeBg: 'bg-sky-500/20 border-sky-500/40',
    badgeText: 'text-sky-300',
    topBar: 'bg-sky-400',
    borderHover: 'hover:border-sky-500/50',
  },
  amber: {
    label: 'Yellow',
    dot: 'bg-amber-400',
    badgeBg: 'bg-amber-500/20 border-amber-500/40',
    badgeText: 'text-amber-300',
    topBar: 'bg-amber-400',
    borderHover: 'hover:border-amber-500/50',
  },
  rose: {
    label: 'Pink',
    dot: 'bg-rose-400',
    badgeBg: 'bg-rose-500/20 border-rose-500/40',
    badgeText: 'text-rose-300',
    topBar: 'bg-rose-400',
    borderHover: 'hover:border-rose-500/50',
  },
  emerald: {
    label: 'Green',
    dot: 'bg-emerald-400',
    badgeBg: 'bg-emerald-500/20 border-emerald-500/40',
    badgeText: 'text-emerald-300',
    topBar: 'bg-emerald-400',
    borderHover: 'hover:border-emerald-500/50',
  },
  cyan: {
    label: 'Cyan',
    dot: 'bg-cyan-400',
    badgeBg: 'bg-cyan-500/20 border-cyan-500/40',
    badgeText: 'text-cyan-300',
    topBar: 'bg-cyan-400',
    borderHover: 'hover:border-cyan-500/50',
  },
  purple: {
    label: 'Purple',
    dot: 'bg-purple-400',
    badgeBg: 'bg-purple-500/20 border-purple-500/40',
    badgeText: 'text-purple-300',
    topBar: 'bg-purple-400',
    borderHover: 'hover:border-purple-500/50',
  },
  orange: {
    label: 'Orange',
    dot: 'bg-orange-400',
    badgeBg: 'bg-orange-500/20 border-orange-500/40',
    badgeText: 'text-orange-300',
    topBar: 'bg-orange-400',
    borderHover: 'hover:border-orange-500/50',
  },
  zinc: {
    label: 'Grey',
    dot: 'bg-zinc-400',
    badgeBg: 'bg-zinc-700/40 border-zinc-600/50',
    badgeText: 'text-zinc-200',
    topBar: 'bg-zinc-400',
    borderHover: 'hover:border-zinc-600',
  },
};

const COLOR_KEYS = Object.keys(TAB_GROUP_STYLES) as TabGroupColor[];

function isUnresolvedYouTubeLink(link: LinkItem): boolean {
  const lowerUrl = link.url.toLowerCase();
  const isYt =
    lowerUrl.includes('youtube.com/') || lowerUrl.includes('youtu.be/');
  if (!isYt) return false;
  const normalizedTitle = link.title.trim().toLowerCase();
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

function TabLinkRow({
  link,
  folders,
  showCover,
  onMoveToGroup,
  onUpdateTitle,
  onDelete,
  onDragStart,
}: {
  link: LinkItem;
  folders: Folder[];
  showCover: boolean;
  onMoveToGroup: (linkId: string, folderId: string | null) => void;
  onUpdateTitle: (linkId: string, newTitle: string) => void;
  onDelete: (linkId: string) => void;
  onDragStart: (e: React.DragEvent<HTMLElement>, link: LinkItem) => void;
}) {
  const [faviconFailed, setFaviconFailed] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);

  React.useEffect(() => {
    if (!isUnresolvedYouTubeLink(link)) return;
    let cancelled = false;
    fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: link.url }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.metadata?.title) return;
        const resolvedTitle = String(data.metadata.title).trim();
        if (resolvedTitle && resolvedTitle !== link.title) {
          onUpdateTitle(link.id, resolvedTitle);
        }
      })
      .catch(() => {
        // Ignore background title repair errors
      });
    return () => {
      cancelled = true;
    };
  }, [link.id, link.url, link.title, onUpdateTitle]);

  return (
    <article
      draggable
      onDragStart={(e) => onDragStart(e, link)}
      aria-label={link.title}
      className="group rounded-md border border-zinc-800/80 bg-zinc-950/90 hover:bg-zinc-900 hover:border-zinc-700 transition-colors cursor-grab active:cursor-grabbing overflow-hidden"
    >
      {showCover && link.image_url && !coverFailed && (
        <div className="w-full aspect-video bg-zinc-950 border-b border-zinc-800/80 overflow-hidden">
          <img
            src={link.image_url}
            alt=""
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={() => setCoverFailed(true)}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="p-3 flex items-start justify-between gap-2.5">
        {/* Browser Tab Favicon + Title + Domain */}
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-2.5 min-w-0 flex-1 focus-visible:outline-none focus-visible:underline"
        >
          <span className="w-5 h-5 mt-0.5 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 overflow-hidden">
            {!faviconFailed && link.favicon ? (
              <img
                src={link.favicon}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setFaviconFailed(true)}
                className="w-3.5 h-3.5 object-contain"
              />
            ) : (
              <Globe className="w-3 h-3 text-zinc-400" />
            )}
          </span>

          <div className="min-w-0 flex-1 space-y-0.5">
            <h3
              title={link.title}
              className="text-xs font-medium text-zinc-100 group-hover:text-sky-400 transition-colors leading-snug line-clamp-2 break-words"
            >
              {link.title}
            </h3>
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-500">
              <span className="truncate text-zinc-400">{link.domain}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums shrink-0">{link.reading_minutes}m</span>
            </div>
          </div>
        </a>

        {/* Open + Close Tab Button */}
        <div className="flex items-center gap-1 shrink-0">
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${link.title} in new tab`}
            className="p-1 text-zinc-500 hover:text-zinc-200 rounded hover:bg-zinc-800 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            type="button"
            onClick={() => onDelete(link.id)}
            aria-label={`Delete ${link.title}`}
            className="p-1 text-zinc-500 hover:text-rose-400 rounded hover:bg-zinc-800 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}

export function KanbanBoard({ onOpenAddModal }: KanbanBoardProps) {
  const {
    links,
    folders,
    activeFolderId,
    activeTag,
    searchQuery,
    isLoading,
    isScraping,
    errorMessage,
    setSearchQuery,
    setActiveFolderId,
    setActiveTag,
    clearError,
    addLink,
    updateLink,
    deleteLink,
    createFolder,
    updateFolder,
    deleteFolder,
  } = useLinkStore();

  // Inline Quick-Save Link State
  const [quickUrl, setQuickUrl] = useState('');
  const [quickTitle, setQuickTitle] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  // Inline New Tab Group State
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState<TabGroupColor>('blue');

  // Drag & Drop + Display Mode + Bottom Nav Focus + Inline Group Rename State
  const [draggedLinkId, setDraggedLinkId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [showCovers, setShowCovers] = useState(false);
  const [openColorPickerId, setOpenColorPickerId] = useState<string | null>(null);
  const [focusedGroupId, setFocusedGroupId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const boardScrollRef = useRef<HTMLDivElement | null>(null);

  const effectiveGroupId =
    selectedGroupId || activeFolderId || folders[0]?.id || '';

  const filteredLinks = useMemo(
    () =>
      filterLinks(links, folders, {
        folderId: activeFolderId,
        tag: activeTag,
        searchQuery,
      }),
    [links, folders, activeFolderId, activeTag, searchQuery]
  );

  const visibleGroups = useMemo(() => {
    if (activeFolderId) {
      return folders.filter(
        (f) => f.id === activeFolderId || f.parent_id === activeFolderId
      );
    }
    return folders;
  }, [folders, activeFolderId]);

  const startEditingGroup = (group: Folder, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingGroupId(group.id);
    setEditingGroupName(group.name);
  };

  const commitEditingGroup = async (groupId: string) => {
    const trimmed = editingGroupName.trim();
    const current = folders.find((f) => f.id === groupId);
    setEditingGroupId(null);
    if (!trimmed || !current || trimmed === current.name) return;
    await updateFolder(groupId, { name: trimmed });
  };

  const handleQuickSaveLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickUrl.trim()) return;
    const saved = await addLink({
      url: quickUrl.trim(),
      title: quickTitle.trim() || undefined,
      folder_id: effectiveGroupId || null,
      tags: ['saved-tab'],
      status: LinkStatus.UNREAD,
    });
    if (saved) {
      setQuickUrl('');
      setQuickTitle('');
    }
  };

  const handleCreateTabGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    const created = await createFolder(newGroupName.trim(), null, newGroupColor);
    if (created) {
      setSelectedGroupId(created.id);
      setNewGroupName('');
      setIsCreatingGroup(false);
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLElement>, link: LinkItem) => {
    setDraggedLinkId(link.id);
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

    const internalLinkId =
      e.dataTransfer.getData('application/x-tabflow-link-id') || draggedLinkId;
    const plainText = e.dataTransfer.getData('text/plain').trim();
    const matchedLink = links.find(
      (l) => l.id === internalLinkId || l.id === plainText
    );

    setDraggedLinkId(null);
    setDragOverGroupId(null);

    if (matchedLink) {
      if (e.altKey || e.ctrlKey || e.metaKey) {
        await addLink({
          url: matchedLink.url,
          title: matchedLink.title,
          folder_id: targetFolderId,
          tags: matchedLink.tags?.length ? matchedLink.tags : ['saved-tab'],
          status: LinkStatus.UNREAD,
        });
      } else if (matchedLink.folder_id !== targetFolderId) {
        await updateLink(matchedLink.id, { folder_id: targetFolderId });
      }
      return;
    }

    const droppedUrl = extractDroppedUrl(e.dataTransfer);
    if (droppedUrl) {
      await addLink({
        url: droppedUrl,
        folder_id: targetFolderId,
        tags: ['saved-tab'],
        status: LinkStatus.UNREAD,
      });
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

    // If sidebar filter is hiding other columns, clear filter so all columns are navigable
    if (activeFolderId !== null && activeFolderId !== groupId) {
      setActiveFolderId(null);
    }

    // Smoothly scroll the selected group column into center view
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

  return (
    <div className="relative flex-1 flex flex-col min-w-0 bg-zinc-950 overflow-hidden">
      {errorMessage && (
        <div
          role="alert"
          className="mx-6 mt-4 px-3 py-2 rounded-md bg-rose-950/60 border border-rose-800/80 flex items-center justify-between text-xs text-rose-200"
        >
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={clearError}
            aria-label="Dismiss error"
            className="text-rose-300 hover:text-white ml-4"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Google Chrome Tab Groups Column Board */}
      <div
        ref={boardScrollRef}
        className="p-6 pb-24 flex-1 flex flex-row gap-5 items-start overflow-x-auto min-h-0 scroll-smooth"
      >
        {visibleGroups.map((group) => {
          const colorKey: TabGroupColor = group.color ?? 'blue';
          const style = TAB_GROUP_STYLES[colorKey] ?? TAB_GROUP_STYLES.blue;
          const groupLinks = filteredLinks.filter(
            (l) => l.folder_id === group.id
          );
          const isCollapsed = Boolean(group.collapsed);
          const isDropTarget = dragOverGroupId === group.id;
          const isFocused =
            focusedGroupId === group.id || activeFolderId === group.id;
          const isEditingName = editingGroupId === group.id;

          return (
            <section
              key={group.id}
              id={`tab-group-col-${group.id}`}
              aria-label={`Tab group ${group.name}`}
              onClick={() => setFocusedGroupId(group.id)}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOverGroupId !== group.id) setDragOverGroupId(group.id);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  if (dragOverGroupId === group.id) setDragOverGroupId(null);
                }
              }}
              onDrop={(e) => handleDropOnGroup(e, group.id)}
              className={`w-[360px] shrink-0 flex flex-col max-h-[calc(100vh-9.5rem)] rounded-lg border bg-zinc-900/40 overflow-hidden transition-all ${
                isDropTarget
                  ? 'border-sky-400 bg-zinc-900/80 ring-1 ring-sky-400/50'
                  : isFocused
                  ? 'border-zinc-600 ring-1 ring-zinc-700/80 bg-zinc-900/60'
                  : `border-zinc-800/90 ${style.borderHover}`
              }`}
            >
              {/* Google Chrome Tab Group Colored Top Accent Line */}
              <div className={`h-1 w-full shrink-0 ${style.topBar}`} />

              {/* Collapsible Tab Group Header */}
              <header className="px-3 py-2.5 border-b border-zinc-800/80 flex items-center justify-between gap-2 bg-zinc-900/70 shrink-0">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold border ${style.badgeBg} ${style.badgeText} min-w-0 max-w-[195px]`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        updateFolder(group.id, { collapsed: !isCollapsed })
                      }
                      aria-expanded={!isCollapsed}
                      aria-label={`Toggle ${group.name} group`}
                      title={isCollapsed ? 'Expand group' : 'Collapse group'}
                      className="p-0.5 -ml-0.5 rounded hover:bg-black/20 transition-colors shrink-0"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                      )}
                    </button>

                    <input
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
                      aria-label={`Edit group name ${group.name}`}
                      title="Click to edit group name"
                      className="w-full min-w-0 bg-transparent text-xs font-semibold text-inherit truncate rounded px-1 -mx-0.5 border border-transparent focus:border-sky-400 focus:bg-zinc-950 focus:text-zinc-100 focus:outline-none transition-colors cursor-text"
                    />
                  </div>

                  <span className="font-mono text-[11px] tabular-nums text-zinc-400 shrink-0">
                    {groupLinks.length}
                  </span>
                </div>

                {/* Group Actions: Change Color, Open All, Add Link to Group */}
                <div className="flex items-center gap-1 shrink-0 relative">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenColorPickerId(
                        openColorPickerId === group.id ? null : group.id
                      )
                    }
                    aria-label={`Change color for ${group.name}`}
                    title="Change group color"
                    className="p-1.5 rounded hover:bg-zinc-800 flex items-center justify-center"
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
                  </button>

                  {openColorPickerId === group.id && (
                    <div className="absolute right-0 top-8 z-20 p-2 rounded-md border border-zinc-700 bg-zinc-900 shadow-xl flex items-center gap-1.5">
                      {COLOR_KEYS.map((cKey) => (
                        <button
                          key={cKey}
                          type="button"
                          aria-label={`Set group color ${cKey}`}
                          onClick={() => {
                            updateFolder(group.id, { color: cKey });
                            setOpenColorPickerId(null);
                          }}
                          className={`w-4 h-4 rounded-full ${TAB_GROUP_STYLES[cKey].dot} hover:scale-110 transition-transform`}
                        />
                      ))}
                    </div>
                  )}

                  {groupLinks.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleOpenAllInGroup(groupLinks)}
                      className="px-1.5 py-1 text-[11px] font-mono text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors whitespace-nowrap"
                    >
                      Open all
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGroupId(group.id);
                      onOpenAddModal(LinkStatus.UNREAD, group.id);
                    }}
                    aria-label={`Add link to ${group.name}`}
                    title={`Add link to ${group.name}`}
                    className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </header>

              {/* Group Tabs List (Hidden when Collapsed like Chrome Tab Groups) */}
              {!isCollapsed && (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverGroupId !== group.id) {
                      setDragOverGroupId(group.id);
                    }
                  }}
                  onDrop={(e) => handleDropOnGroup(e, group.id)}
                  className={`p-3 space-y-2 flex-1 overflow-y-auto transition-colors ${
                    isDropTarget ? 'bg-sky-950/20' : ''
                  }`}
                >
                  {isLoading ? (
                    <div className="h-14 rounded-md bg-zinc-900 animate-pulse" />
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
                          folders={folders}
                          showCover={showCovers}
                          onMoveToGroup={(linkId, targetFolderId) =>
                            updateLink(linkId, { folder_id: targetFolderId })
                          }
                          onUpdateTitle={(linkId, newTitle) =>
                            updateLink(linkId, { title: newTitle })
                          }
                          onDelete={deleteLink}
                          onDragStart={handleDragStart}
                        />
                      ))}

                      {isDropTarget && (
                        <div className="rounded-md border border-dashed border-sky-400/70 bg-sky-950/30 px-3 py-2 text-center text-[11px] font-medium text-sky-300">
                          Drop tab or URL to add to {group.name}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Bottom Tab Selection Row for Quick Navigation */}
      <div className="pointer-events-none absolute inset-x-0 bottom-5 z-30 flex justify-center px-4">
        <nav
          aria-label="Bottom tab group selection"
          className="pointer-events-auto flex items-center gap-1.5 p-1.5 rounded-xl border border-zinc-800/90 bg-zinc-900/95 backdrop-blur-md shadow-2xl max-w-full overflow-x-auto"
        >
          <button
            type="button"
            onClick={() => handleScrollBoardBy(-380)}
            aria-label="Scroll board left"
            title="Scroll left"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors shrink-0"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {folders.map((group) => {
            const colorKey: TabGroupColor = group.color ?? 'blue';
            const style = TAB_GROUP_STYLES[colorKey] ?? TAB_GROUP_STYLES.blue;
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
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0 border ${
                  isDropTarget
                    ? 'border-sky-400 bg-zinc-800 text-zinc-50 scale-[1.02]'
                    : isSelected
                    ? `${style.badgeBg} ${style.badgeText}`
                    : 'border-transparent text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/70'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`}
                />
                <span className="max-w-[140px] truncate">{group.name}</span>
                <span className="font-mono text-[10px] tabular-nums opacity-75">
                  {count}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => handleScrollBoardBy(380)}
            aria-label="Scroll board right"
            title="Scroll right"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors shrink-0"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </nav>
      </div>
    </div>
  );
}
