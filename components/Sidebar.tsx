'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  GripVertical,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useLinkStore } from '@/store/useLinkStore';
import { useThemeStore } from '@/store/useThemeStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useWorkspaceDnd } from '@/components/WorkspaceDndProvider';
import {
  COLOR_KEYS,
  getTabGroupStyles,
  TabGroupStyleEntry,
} from '@/components/KanbanBoard';
import { Folder, LinkStatus, TabGroupColor } from '@/lib/types';
import { getDescendantFolderIds } from '@/lib/kanban-rules';
import {
  inferDefaultGroupName,
  parseTabGroupFromDataTransfer,
  pickNextTabGroupColor,
} from '@/lib/tab-group-drop';

interface SidebarFolderRowProps {
  folder: Folder;
  style: TabGroupStyleEntry;
  count: number;
  depth?: number;
  hasChildren?: boolean;
  isTreeExpanded?: boolean;
  isCollapsed: boolean;
  isSelected: boolean;
  isNativeDropTarget: boolean;
  isNativeDragging: boolean;
  isEditing: boolean;
  editingName: string;
  isConfirmingDelete: boolean;
  editGroupNameAria: string;
  editGroupNameTitle: string;
  deleteGroupAria: string;
  deleteGroupTitle: string;
  addSubfolderAria?: string;
  addSubfolderTitle?: string;
  onToggleTreeExpand?: (folderId: string) => void;
  onStartAddSubfolder?: (parentFolderId: string) => void;
  onFocusGroupOnBoard: (folderId: string) => void;
  onStartEditing: (folder: Folder) => void;
  onChangeEditingName: (val: string) => void;
  onCommitEditing: (folderId: string) => void;
  onCancelEditing: (folder: Folder) => void;
  onRequestDelete: (folderId: string) => void;
  onNativeDragStart: (e: React.DragEvent<HTMLElement>, folder: Folder) => void;
  onNativeDragEnd: () => void;
  onNativeDragOver: (e: React.DragEvent<HTMLElement>, folderId: string) => void;
  onNativeDragLeave: (e: React.DragEvent<HTMLElement>) => void;
  onNativeDrop: (e: React.DragEvent<HTMLElement>, folderId: string) => void;
}

function SidebarFolderRow({
  folder,
  style,
  count,
  depth = 0,
  hasChildren = false,
  isTreeExpanded = true,
  isCollapsed,
  isSelected,
  isNativeDropTarget,
  isNativeDragging,
  isEditing,
  editingName,
  isConfirmingDelete,
  editGroupNameAria,
  editGroupNameTitle,
  deleteGroupAria,
  deleteGroupTitle,
  addSubfolderAria,
  addSubfolderTitle,
  onToggleTreeExpand,
  onStartAddSubfolder,
  onFocusGroupOnBoard,
  onStartEditing,
  onChangeEditingName,
  onCommitEditing,
  onCancelEditing,
  onRequestDelete,
  onNativeDragStart,
  onNativeDragEnd,
  onNativeDragOver,
  onNativeDragLeave,
  onNativeDrop,
}: SidebarFolderRowProps) {
  const { overFolderId, activeLink } = useWorkspaceDnd();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: `sidebar-folder:${folder.id}`,
    disabled: isEditing,
    data: {
      type: 'sidebar-folder',
      folderId: folder.id,
      folder,
    },
  });

  const sortableStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isDndDropTarget =
    Boolean(activeLink) && (overFolderId === folder.id || isOver);
  const isDropTarget = isNativeDropTarget || isDndDropTarget;

  if (isCollapsed) {
    return (
      <button
        ref={setNodeRef}
        style={sortableStyle}
        id={`sidebar-folder-${folder.id}`}
        type="button"
        onClick={() => onFocusGroupOnBoard(folder.id)}
        onDragOver={(e) => onNativeDragOver(e, folder.id)}
        onDragLeave={onNativeDragLeave}
        onDrop={(e) => onNativeDrop(e, folder.id)}
        title={`${folder.name} (${count})`}
        aria-label={folder.name}
        className={`w-full flex items-center justify-center p-2 rounded-md transition-colors border ${
          isDropTarget
            ? 'bg-[var(--tf-accent-soft)] border-[var(--tf-accent)] ring-1 ring-[var(--tf-accent)]'
            : isSelected
            ? 'bg-[var(--tf-elevated)] text-[var(--tf-text)] border-[var(--tf-accent)] ring-1 ring-[var(--tf-accent)]/50'
            : 'border-transparent text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-elevated)]'
        }`}
      >
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${style.dot}`} />
      </button>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={sortableStyle}
      id={`sidebar-folder-${folder.id}`}
      draggable={!isEditing}
      onDragStart={(e) => onNativeDragStart(e, folder)}
      onDragEnd={onNativeDragEnd}
      onDragOver={(e) => onNativeDragOver(e, folder.id)}
      onDragLeave={onNativeDragLeave}
      onDrop={(e) => onNativeDrop(e, folder.id)}
      className={`group flex items-center justify-between rounded-md transition-colors border ${
        isDragging || isNativeDragging
          ? 'opacity-50 border-dashed border-[var(--tf-accent)]'
          : isDropTarget
          ? 'bg-[var(--tf-accent-soft)] border-[var(--tf-accent)] ring-1 ring-[var(--tf-accent)] text-[var(--tf-text)]'
          : isSelected
          ? 'bg-[var(--tf-elevated)] border-[var(--tf-border-strong)] text-[var(--tf-text)]'
          : 'border-transparent text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-elevated)]'
      }`}
    >
      <div
        onClick={() => onFocusGroupOnBoard(folder.id)}
        className="flex-1 flex items-center justify-between pl-1 pr-1 py-1.5 text-xs font-medium min-w-0 cursor-pointer"
      >
        <span className="flex items-center gap-1 min-w-0 flex-1">
          <span
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="p-0.5 rounded hover:bg-[var(--tf-canvas)] shrink-0 cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="w-3 h-3 text-[var(--tf-text-muted)] opacity-55 group-hover:opacity-100 transition-opacity" />
          </span>

          {hasChildren && onToggleTreeExpand ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleTreeExpand(folder.id);
              }}
              aria-label={folder.name}
              className="p-0.5 rounded text-[var(--tf-text-muted)] hover:text-[var(--tf-text)] shrink-0"
            >
              {isTreeExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </button>
          ) : null}

          <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
          <input
            type="text"
            value={isEditing ? editingName : folder.name}
            onFocus={() => onStartEditing(folder)}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onChangeEditingName(e.target.value)}
            onBlur={() => onCommitEditing(folder.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.currentTarget.blur();
              } else if (e.key === 'Escape') {
                onCancelEditing(folder);
                e.currentTarget.blur();
              }
            }}
            aria-label={editGroupNameAria}
            title={editGroupNameTitle}
            className="w-full min-w-0 bg-transparent text-xs font-medium text-inherit truncate rounded px-1 py-0.5 -mx-0.5 border border-transparent hover:border-[var(--tf-border)] focus:border-[var(--tf-accent)] focus:bg-[var(--tf-canvas)] focus:text-[var(--tf-text)] focus:outline-none transition-colors cursor-text"
          />
        </span>
        <span className="font-mono text-[10px] tabular-nums text-[var(--tf-text-muted)] ml-1.5 shrink-0">
          {count}
        </span>
      </div>

      <div className="flex items-center shrink-0 pr-0.5">
        {depth === 0 && onStartAddSubfolder && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStartAddSubfolder(folder.id);
            }}
            aria-label={addSubfolderAria}
            title={addSubfolderTitle}
            className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded text-[var(--tf-text-muted)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-canvas)] transition-all shrink-0"
          >
            <Plus className="w-3 h-3" />
          </button>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRequestDelete(folder.id);
          }}
          aria-label={deleteGroupAria}
          title={deleteGroupTitle}
          className={`p-1 rounded transition-colors shrink-0 ${
            isConfirmingDelete
              ? 'text-rose-500 bg-rose-500/15'
              : 'text-[var(--tf-text-muted)] hover:text-rose-500 hover:bg-[var(--tf-canvas)]'
          }`}
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const {
    links,
    folders,
    activeFolderId,
    setActiveFolderId,
    createFolder,
    createFolderWithLinks,
    updateFolder,
    reorderFolders,
    deleteFolder,
    addLink,
    reorderLink,
  } = useLinkStore();

  const { mode } = useThemeStore();
  const { t } = useLanguageStore();
  const { isOverNewGroupZone } = useWorkspaceDnd();
  const { setNodeRef: setSidebarNewGroupNodeRef, isOver: isDndOverSidebarNew } =
    useDroppable({
      id: 'sidebar-new-group-drop',
      data: { type: 'new-group' },
    });
  const groupStyles = getTabGroupStyles(mode);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupParentId, setNewGroupParentId] = useState<string | null>(null);
  const [newGroupColor, setNewGroupColor] = useState<TabGroupColor>('blue');
  const [collapsedTreeIds, setCollapsedTreeIds] = useState<Record<string, boolean>>({});

  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [draggedSidebarFolderId, setDraggedSidebarFolderId] = useState<
    string | null
  >(null);
  const [confirmDeleteFolderId, setConfirmDeleteFolderId] = useState<
    string | null
  >(null);

  const folderPendingDelete =
    folders.find((f) => f.id === confirmDeleteFolderId) ?? null;
  const pendingDeleteTabCount = folderPendingDelete
    ? links.filter((l) => l.folder_id === folderPendingDelete.id).length
    : 0;

  // Nested folder tree structure: top-level folders + children map
  const { rootFolders, childrenByParentId } = useMemo(() => {
    const folderIds = new Set(folders.map((f) => f.id));
    const roots: Folder[] = [];
    const childMap = new Map<string, Folder[]>();

    for (const folder of folders) {
      if (folder.parent_id && folderIds.has(folder.parent_id)) {
        const list = childMap.get(folder.parent_id) ?? [];
        list.push(folder);
        childMap.set(folder.parent_id, list);
      } else {
        roots.push(folder);
      }
    }

    return { rootFolders: roots, childrenByParentId: childMap };
  }, [folders]);

  useEffect(() => {
    if (!confirmDeleteFolderId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setConfirmDeleteFolderId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmDeleteFolderId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newGroupName.trim().slice(0, 120);
    if (!trimmed) return;
    const created = await createFolder(trimmed, newGroupParentId, newGroupColor);
    if (created) {
      setNewGroupName('');
      setNewGroupParentId(null);
      setIsAddingGroup(false);
      setActiveFolderId(created.id);
      requestAnimationFrame(() => {
        const el = document.getElementById(`sidebar-folder-${created.id}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
  };

  const commitEditingFolder = async (folderId: string) => {
    const trimmed = editingName.trim().slice(0, 120);
    const current = folders.find((f) => f.id === folderId);
    setEditingFolderId(null);
    if (!trimmed || !current || trimmed === current.name) return;
    await updateFolder(folderId, { name: trimmed });
  };

  const handleDropOnSidebarGroup = async (
    e: React.DragEvent<HTMLElement>,
    targetFolderId: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);

    const sourceFolderId =
      e.dataTransfer.getData('application/x-tabflow-folder-id') ||
      draggedSidebarFolderId;
    if (sourceFolderId) {
      const rect = e.currentTarget.getBoundingClientRect();
      const position: 'before' | 'after' =
        e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
      setDraggedSidebarFolderId(null);
      if (sourceFolderId !== targetFolderId) {
        await reorderFolders(sourceFolderId, targetFolderId, position);
      }
      return;
    }

    const internalLinkId = e.dataTransfer.getData('application/x-tabflow-link-id');
    const plainText = e.dataTransfer.getData('text/plain').trim();
    const matchedLink = links.find(
      (l) => l.id === internalLinkId || l.id === plainText
    );

    if (matchedLink) {
      if (matchedLink.folder_id !== targetFolderId) {
        await reorderLink(matchedLink.id, targetFolderId, null, 'after');
      }
      return;
    }

    const parsed = parseTabGroupFromDataTransfer(e.dataTransfer);
    if (parsed.tabs.length > 0) {
      for (const tab of parsed.tabs) {
        await addLink({
          url: tab.url,
          title: tab.title,
          folder_id: targetFolderId,
          tags: ['saved-tab'],
          status: LinkStatus.UNREAD,
        });
      }
    }
  };

  const handleDropToCreateSidebarGroup = async (
    e: React.DragEvent<HTMLElement>
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);

    const internalLinkId = e.dataTransfer.getData('application/x-tabflow-link-id');
    const plainText = e.dataTransfer.getData('text/plain').trim();
    const matchedLink = links.find(
      (l) => l.id === internalLinkId || l.id === plainText
    );

    if (matchedLink) {
      const nextColor = pickNextTabGroupColor(folders.length);
      const created = await createFolder(
        t.board.defaultNewGroupName,
        null,
        nextColor
      );
      if (created) {
        await reorderLink(matchedLink.id, created.id, null, 'after');
        useLinkStore.setState({
          activeFolderId: null,
          newlyCreatedGroupId: created.id,
        });
      }
      return;
    }

    const parsed = parseTabGroupFromDataTransfer(e.dataTransfer);
    if (parsed.tabs.length > 0) {
      const groupName = inferDefaultGroupName(
        parsed,
        t.board.defaultNewGroupName
      );
      const color = parsed.color ?? pickNextTabGroupColor(folders.length);
      await createFolderWithLinks({
        name: groupName,
        color,
        tabs: parsed.tabs,
        focusInlineRename: true,
      });
    }
  };

  const handleFocusGroupOnBoard = (folderId: string) => {
    setActiveFolderId(folderId);
    requestAnimationFrame(() => {
      const colEl = document.getElementById(`tab-group-col-${folderId}`);
      colEl?.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    });
  };

  const renderFolderNode = (folder: Folder, depth: number) => {
    const colorKey: TabGroupColor = folder.color ?? 'blue';
    const style = groupStyles[colorKey] ?? groupStyles.blue;
    const isSelected = activeFolderId === folder.id;
    const isNativeDropTarget = dragOverFolderId === folder.id;
    const isEditing = editingFolderId === folder.id;
    const children = childrenByParentId.get(folder.id) ?? [];
    const hasChildren = children.length > 0;
    const isTreeExpanded = !collapsedTreeIds[folder.id];
    const descendantIds = hasChildren
      ? getDescendantFolderIds(folders, folder.id)
      : null;
    const count = descendantIds
      ? links.filter((l) => l.folder_id && descendantIds.has(l.folder_id)).length
      : links.filter((l) => l.folder_id === folder.id).length;

    return (
      <div key={folder.id} className="space-y-0.5">
        <SidebarFolderRow
          folder={folder}
          style={style}
          count={count}
          depth={depth}
          hasChildren={hasChildren}
          isTreeExpanded={isTreeExpanded}
          isCollapsed={isCollapsed}
          isSelected={isSelected}
          isNativeDropTarget={isNativeDropTarget}
          isNativeDragging={draggedSidebarFolderId === folder.id}
          isEditing={isEditing}
          editingName={editingName}
          isConfirmingDelete={confirmDeleteFolderId === folder.id}
          editGroupNameAria={t.sidebar.editGroupNameAria(folder.name)}
          editGroupNameTitle={t.sidebar.editGroupNameTitle}
          deleteGroupAria={t.sidebar.deleteGroupAria(folder.name)}
          deleteGroupTitle={t.sidebar.deleteGroupTitle}
          addSubfolderAria={t.sidebar.addSubfolderAria(folder.name)}
          addSubfolderTitle={t.sidebar.addSubfolderTitle}
          onToggleTreeExpand={(fId) =>
            setCollapsedTreeIds((prev) => ({ ...prev, [fId]: !prev[fId] }))
          }
          onStartAddSubfolder={(parentId) => {
            setIsCollapsed(false);
            setNewGroupParentId(parentId);
            setNewGroupColor(pickNextTabGroupColor(folders.length));
            setIsAddingGroup(true);
          }}
          onFocusGroupOnBoard={handleFocusGroupOnBoard}
          onStartEditing={(f) => {
            handleFocusGroupOnBoard(f.id);
            setEditingFolderId(f.id);
            setEditingName(f.name);
          }}
          onChangeEditingName={setEditingName}
          onCommitEditing={commitEditingFolder}
          onCancelEditing={(f) => {
            setEditingFolderId(null);
            setEditingName(f.name);
          }}
          onRequestDelete={setConfirmDeleteFolderId}
          onNativeDragStart={(e, f) => {
            const target = e.target as HTMLElement | null;
            if (
              isEditing ||
              (target &&
                (target.tagName === 'INPUT' || target.closest('button')))
            ) {
              e.preventDefault();
              return;
            }
            setDraggedSidebarFolderId(f.id);
            e.dataTransfer.setData('application/x-tabflow-folder-id', f.id);
            e.dataTransfer.setData('text/plain', f.id);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onNativeDragEnd={() => {
            setDraggedSidebarFolderId(null);
            setDragOverFolderId(null);
          }}
          onNativeDragOver={(e, fId) => {
            e.preventDefault();
            if (dragOverFolderId !== fId) {
              setDragOverFolderId(fId);
            }
          }}
          onNativeDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setDragOverFolderId(null);
            }
          }}
          onNativeDrop={handleDropOnSidebarGroup}
        />

        {!isCollapsed && hasChildren && isTreeExpanded && (
          <div
            data-testid={`sidebar-subfolder-tree-${folder.id}`}
            className="ml-3.5 pl-2 border-l border-[var(--tf-border)] space-y-0.5"
          >
            {children.map((child) => renderFolderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {!isCollapsed && (
        <div
          aria-hidden="true"
          onClick={() => setIsCollapsed(true)}
          className="md:hidden fixed inset-0 z-30 bg-black/40 backdrop-blur-[1px]"
        />
      )}
      <aside
        aria-label={t.sidebar.ariaLabel}
        className={`${
          isCollapsed
            ? 'w-11 sm:w-12'
            : 'max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:shadow-2xl w-[200px] md:w-[196px] lg:w-[212px] xl:w-[224px]'
        } h-full shrink-0 border-r border-[var(--tf-border)] bg-[var(--tf-surface)] flex flex-col justify-between select-none transition-all duration-200 ease-in-out overflow-hidden`}
      >
        <div
          className={`flex-1 min-h-0 flex flex-col ${
            isCollapsed ? 'p-1.5 space-y-2' : 'p-2 sm:p-2.5 space-y-2'
          }`}
        >
          <div className="flex-1 min-h-0 flex flex-col space-y-1.5">
            {isCollapsed ? (
              <div className="flex flex-col items-center gap-1.5 pb-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCollapsed(false)}
                  aria-label={t.sidebar.expandSidebar}
                  title={t.sidebar.expandSidebar}
                  className="p-2 rounded-md text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-elevated)] transition-colors"
                >
                  <PanelLeftOpen className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCollapsed(false);
                    setNewGroupParentId(null);
                    setIsAddingGroup(true);
                  }}
                  aria-label={t.sidebar.newGroup}
                  title={t.sidebar.newGroup}
                  className="p-2 rounded-md text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-elevated)] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="px-1.5 pb-1 flex items-center justify-between gap-1 shrink-0 border-b border-[var(--tf-border)]">
                <div className="w-full flex items-center justify-between gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setNewGroupParentId(null);
                      setIsAddingGroup((prev) => !prev);
                    }}
                    aria-label={t.sidebar.newGroup}
                    className="mr-auto inline-flex items-center justify-start gap-1 text-left text-[11px] font-medium text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] transition-colors rounded px-1.5 py-0.5 whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{t.sidebar.newGroup}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCollapsed(true)}
                    aria-label={t.sidebar.collapseSidebar}
                    title={t.sidebar.collapseSidebar}
                    className="p-1 rounded text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-elevated)] transition-colors shrink-0"
                  >
                    <PanelLeftClose className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {!isCollapsed && isAddingGroup && (
              <form
                onSubmit={handleCreateGroup}
                className="p-2.5 mb-1.5 rounded-md border border-[var(--tf-border)] bg-[var(--tf-elevated)] space-y-2"
              >
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="sidebar-group-name"
                    className="text-[11px] font-medium text-[var(--tf-text)]"
                  >
                    {t.sidebar.groupNameLabel}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingGroup(false);
                      setNewGroupParentId(null);
                    }}
                    aria-label={t.sidebar.cancelNewGroup}
                    className="text-[var(--tf-text-muted)] hover:text-[var(--tf-text)]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <input
                  id="sidebar-group-name"
                  type="text"
                  autoFocus
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder={t.sidebar.groupNamePlaceholder}
                  required
                  className="w-full px-2 py-1.5 text-xs bg-[var(--tf-canvas)] border border-[var(--tf-border)] rounded text-[var(--tf-text)] placeholder:text-[var(--tf-text-muted)] focus:outline-none focus:border-[var(--tf-accent)]"
                />
                {rootFolders.length > 0 && (
                  <div className="space-y-1">
                    <label
                      htmlFor="sidebar-parent-folder"
                      className="block text-[10px] font-mono uppercase tracking-wider text-[var(--tf-text-muted)]"
                    >
                      {t.sidebar.parentGroupLabel}
                    </label>
                    <select
                      id="sidebar-parent-folder"
                      value={newGroupParentId ?? ''}
                      onChange={(e) =>
                        setNewGroupParentId(e.target.value || null)
                      }
                      className="w-full px-2 py-1 text-xs bg-[var(--tf-canvas)] border border-[var(--tf-border)] rounded text-[var(--tf-text)] focus:outline-none focus:border-[var(--tf-accent)]"
                    >
                      <option value="">{t.sidebar.topLevelGroupOption}</option>
                      {rootFolders.map((rf) => (
                        <option key={rf.id} value={rf.id}>
                          {rf.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-1.5">
                  {COLOR_KEYS.map((cKey) => (
                    <button
                      key={cKey}
                      type="button"
                      title={t.board.colors[cKey]}
                      aria-label={t.board.setColorAria(t.board.colors[cKey])}
                      onClick={() => setNewGroupColor(cKey)}
                      className={`w-4 h-4 rounded-full ${groupStyles[cKey].dot} ${
                        newGroupColor === cKey
                          ? 'ring-2 ring-[var(--tf-text)] ring-offset-1 ring-offset-[var(--tf-elevated)]'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
                <button
                  type="submit"
                  className="w-full py-1.5 px-3 text-xs font-medium bg-[var(--tf-text)] text-[var(--tf-canvas)] rounded hover:opacity-90 transition-opacity whitespace-nowrap"
                >
                  {t.sidebar.addTabGroup}
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={() => {
                setActiveFolderId(null);
              }}
              title={t.sidebar.allSavedTabs}
              className={`w-full shrink-0 flex items-center ${
                isCollapsed ? 'justify-center p-2' : 'justify-between px-2 py-1.5'
              } rounded-md text-xs font-medium transition-colors ${
                activeFolderId === null
                  ? 'bg-[var(--tf-elevated)] text-[var(--tf-text)] border border-[var(--tf-border)]'
                  : 'text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-elevated)] border border-transparent'
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <Layers className="w-3.5 h-3.5 shrink-0 text-[var(--tf-accent)]" />
                {!isCollapsed && (
                  <span className="truncate">{t.sidebar.allSavedTabs}</span>
                )}
              </span>
              {!isCollapsed && (
                <span className="font-mono text-[10px] tabular-nums text-[var(--tf-text-muted)] ml-2">
                  {links.length}
                </span>
              )}
            </button>

            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pt-0.5 pr-0.5">
              <SortableContext
                items={folders.map((f) => `sidebar-folder:${f.id}`)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-0.5">
                  {rootFolders.map((folder) => renderFolderNode(folder, 0))}
                </div>
              </SortableContext>

              {/* Drop Target to Create a New Tab Group in Sidebar */}
              <div
                ref={setSidebarNewGroupNodeRef}
                data-testid="sidebar-drop-new-group"
                title={t.sidebar.dropNewGroupCollapsedTitle}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverFolderId !== '__sidebar_new_group__') {
                    setDragOverFolderId('__sidebar_new_group__');
                  }
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    if (dragOverFolderId === '__sidebar_new_group__') {
                      setDragOverFolderId(null);
                    }
                  }
                }}
                onDrop={handleDropToCreateSidebarGroup}
                onClick={() => {
                  setIsCollapsed(false);
                  setNewGroupParentId(null);
                  setIsAddingGroup(true);
                }}
                className={`rounded-md border border-dashed transition-colors cursor-pointer ${
                  isCollapsed
                    ? 'p-2 flex items-center justify-center'
                    : 'px-2.5 py-1.5 flex items-center gap-2 text-[11px] font-medium'
                } ${
                  dragOverFolderId === '__sidebar_new_group__' ||
                  isDndOverSidebarNew ||
                  isOverNewGroupZone
                    ? 'border-[var(--tf-accent)] bg-[var(--tf-accent-soft)] text-[var(--tf-text)] ring-1 ring-[var(--tf-accent)]'
                    : 'border-[var(--tf-border)] text-[var(--tf-text-muted)] hover:text-[var(--tf-text)] hover:border-[var(--tf-border-strong)] hover:bg-[var(--tf-elevated)]/60'
                }`}
              >
                <FolderPlus className="w-3.5 h-3.5 shrink-0 text-[var(--tf-accent)]" />
                {!isCollapsed && (
                  <span className="truncate">
                    {dragOverFolderId === '__sidebar_new_group__' ||
                    isDndOverSidebarNew ||
                    isOverNewGroupZone
                      ? t.sidebar.dropNewGroupActive
                      : t.sidebar.dropNewGroupLabel}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Delete Group Confirmation Modal */}
        {folderPendingDelete && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-delete-group-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setConfirmDeleteFolderId(null);
              }
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          >
            <div className="w-full max-w-sm rounded-lg border border-[var(--tf-border-strong)] bg-[var(--tf-elevated)] text-[var(--tf-text)] shadow-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--tf-border)] flex items-center justify-between">
                <h2
                  id="confirm-delete-group-title"
                  className="text-sm font-semibold text-[var(--tf-text)] flex items-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{t.sidebar.confirmDeleteTitle}</span>
                </h2>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteFolderId(null)}
                  aria-label={t.sidebar.closeConfirmAria}
                  className="p-1 text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] rounded-md hover:bg-[var(--tf-surface)] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-3">
                <p className="text-xs text-[var(--tf-text-secondary)] leading-relaxed">
                  {t.sidebar.confirmDeletePromptPrefix}{' '}
                  <span className="font-semibold text-[var(--tf-text)]">
                    “{folderPendingDelete.name}”
                  </span>
                  ?
                </p>

                <div className="flex items-center justify-between px-3 py-2 rounded-md border border-[var(--tf-border)] bg-[var(--tf-surface)]">
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        (
                          groupStyles[folderPendingDelete.color ?? 'blue'] ??
                          groupStyles.blue
                        ).dot
                      }`}
                    />
                    <span className="text-xs font-medium text-[var(--tf-text)] truncate">
                      {folderPendingDelete.name}
                    </span>
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-[var(--tf-text-muted)] ml-2 shrink-0">
                    {pendingDeleteTabCount} {t.sidebar.tabUnit}
                  </span>
                </div>

                {pendingDeleteTabCount > 0 && (
                  <p className="text-[11px] text-rose-400">
                    {t.sidebar.confirmDeleteWarning(pendingDeleteTabCount)}
                  </p>
                )}

                <div className="pt-1 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteFolderId(null)}
                    className="px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--tf-border)] bg-[var(--tf-surface)] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:border-[var(--tf-border-strong)] transition-colors"
                  >
                    {t.sidebar.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const targetId = folderPendingDelete.id;
                      setConfirmDeleteFolderId(null);
                      await deleteFolder(targetId);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-rose-600 hover:bg-rose-500 text-white transition-colors shadow-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t.sidebar.confirmDeleteBtn}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
