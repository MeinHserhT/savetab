'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  FolderPlus,
  GripVertical,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useLinkStore } from '@/store/useLinkStore';
import { useThemeStore } from '@/store/useThemeStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import {
  COLOR_KEYS,
  getTabGroupStyles,
} from '@/components/KanbanBoard';
import { LinkStatus, TabGroupColor } from '@/lib/types';
import {
  inferDefaultGroupName,
  parseTabGroupFromDataTransfer,
  pickNextTabGroupColor,
} from '@/lib/tab-group-drop';

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
    updateLink,
  } = useLinkStore();

  const { mode } = useThemeStore();
  const { t } = useLanguageStore();
  const groupStyles = getTabGroupStyles(mode);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState<TabGroupColor>('blue');

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
    const created = await createFolder(trimmed, null, newGroupColor);
    if (created) {
      setNewGroupName('');
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
        await updateLink(matchedLink.id, { folder_id: targetFolderId });
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
            ? 'w-12 sm:w-14'
            : 'max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:shadow-2xl w-[236px] md:w-[216px] lg:w-[248px] xl:w-[264px]'
        } h-full shrink-0 border-r border-[var(--tf-border)] bg-[var(--tf-surface)] flex flex-col justify-between select-none transition-all duration-200 ease-in-out overflow-hidden`}
      >
        <div
          className={`flex-1 min-h-0 flex flex-col ${
            isCollapsed ? 'p-1.5 sm:p-2 space-y-2' : 'p-3 sm:p-4 space-y-3'
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
              <div className="px-2 pb-1 flex items-center justify-between gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddingGroup((prev) => !prev)}
                  aria-label={t.sidebar.newGroup}
                  className="inline-flex items-center gap-1 text-xs text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] transition-colors rounded px-1.5 py-0.5 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
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
            )}

            {!isCollapsed && isAddingGroup && (
              <form
                onSubmit={handleCreateGroup}
                className="p-2.5 mb-2 rounded-md border border-[var(--tf-border)] bg-[var(--tf-elevated)] space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="sidebar-group-name"
                    className="text-xs font-medium text-[var(--tf-text)]"
                  >
                    {t.sidebar.groupNameLabel}
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAddingGroup(false)}
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
                  className="w-full px-2.5 py-1.5 text-xs bg-[var(--tf-canvas)] border border-[var(--tf-border)] rounded text-[var(--tf-text)] placeholder:text-[var(--tf-text-muted)] focus:outline-none focus:border-[var(--tf-accent)]"
                />
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
              onClick={() => setActiveFolderId(null)}
              title={t.sidebar.allSavedTabs}
              className={`w-full shrink-0 flex items-center ${
                isCollapsed ? 'justify-center p-2' : 'justify-between px-2.5 py-2'
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
                <span className="font-mono text-[11px] tabular-nums text-[var(--tf-text-muted)] ml-2">
                  {links.length}
                </span>
              )}
            </button>

            <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5 pt-1 pr-0.5">
              {folders.map((folder) => {
                const colorKey: TabGroupColor = folder.color ?? 'blue';
                const style = groupStyles[colorKey] ?? groupStyles.blue;
                const isSelected = activeFolderId === folder.id;
                const isDropTarget = dragOverFolderId === folder.id;
                const isEditing = editingFolderId === folder.id;
                const count = links.filter((l) => l.folder_id === folder.id).length;

                if (isCollapsed) {
                  return (
                    <button
                      key={folder.id}
                      id={`sidebar-folder-${folder.id}`}
                      type="button"
                      onClick={() =>
                        setActiveFolderId(isSelected ? null : folder.id)
                      }
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragOverFolderId !== folder.id) {
                          setDragOverFolderId(folder.id);
                        }
                      }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                          setDragOverFolderId(null);
                        }
                      }}
                      onDrop={(e) => handleDropOnSidebarGroup(e, folder.id)}
                      title={`${folder.name} (${count})`}
                      aria-label={folder.name}
                      className={`w-full flex items-center justify-center p-2 rounded-md transition-colors border ${
                        isDropTarget
                          ? 'bg-[var(--tf-accent-soft)] border-[var(--tf-accent)]'
                          : isSelected
                          ? 'bg-[var(--tf-elevated)] text-[var(--tf-text)] border-[var(--tf-border)]'
                          : 'border-transparent text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-elevated)]'
                      }`}
                    >
                      <span
                        className={`w-3 h-3 rounded-full shrink-0 ${style.dot}`}
                      />
                    </button>
                  );
                }

                return (
                  <div
                    key={folder.id}
                    id={`sidebar-folder-${folder.id}`}
                    draggable={!isEditing}
                    onDragStart={(e) => {
                      const target = e.target as HTMLElement | null;
                      if (
                        isEditing ||
                        (target &&
                          (target.tagName === 'INPUT' ||
                            target.closest('button')))
                      ) {
                        e.preventDefault();
                        return;
                      }
                      setDraggedSidebarFolderId(folder.id);
                      e.dataTransfer.setData(
                        'application/x-tabflow-folder-id',
                        folder.id
                      );
                      e.dataTransfer.setData('text/plain', folder.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragEnd={() => {
                      setDraggedSidebarFolderId(null);
                      setDragOverFolderId(null);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragOverFolderId !== folder.id) {
                        setDragOverFolderId(folder.id);
                      }
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        setDragOverFolderId(null);
                      }
                    }}
                    onDrop={(e) => handleDropOnSidebarGroup(e, folder.id)}
                    className={`group flex items-center justify-between rounded-md transition-colors border ${
                      draggedSidebarFolderId === folder.id
                        ? 'opacity-50 border-dashed border-[var(--tf-accent)]'
                        : isDropTarget
                        ? 'bg-[var(--tf-accent-soft)] border-[var(--tf-accent)] text-[var(--tf-text)]'
                        : isSelected
                        ? 'bg-[var(--tf-elevated)] border-[var(--tf-border)] text-[var(--tf-text)]'
                        : 'border-transparent text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-elevated)]'
                    }`}
                  >
                    <div
                      onClick={() =>
                        setActiveFolderId(isSelected ? null : folder.id)
                      }
                      className="flex-1 flex items-center justify-between pl-1.5 pr-1.5 py-1.5 text-xs font-medium min-w-0 cursor-grab active:cursor-grabbing"
                    >
                      <span className="flex items-center gap-1.5 min-w-0 flex-1">
                        <GripVertical className="w-3 h-3 shrink-0 text-[var(--tf-text-muted)] opacity-60 group-hover:opacity-100 transition-opacity" />
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${style.dot}`}
                        />
                        <input
                          type="text"
                          value={isEditing ? editingName : folder.name}
                          onFocus={() => {
                            setActiveFolderId(folder.id);
                            setEditingFolderId(folder.id);
                            setEditingName(folder.name);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setEditingName(e.target.value)}
                          onBlur={() => commitEditingFolder(folder.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              e.currentTarget.blur();
                            } else if (e.key === 'Escape') {
                              setEditingFolderId(null);
                              setEditingName(folder.name);
                              e.currentTarget.blur();
                            }
                          }}
                          aria-label={t.sidebar.editGroupNameAria(folder.name)}
                          title={t.sidebar.editGroupNameTitle}
                          className="w-full min-w-0 bg-transparent text-xs font-medium text-inherit truncate rounded px-1 py-0.5 -mx-1 border border-transparent hover:border-[var(--tf-border)] focus:border-[var(--tf-accent)] focus:bg-[var(--tf-canvas)] focus:text-[var(--tf-text)] focus:outline-none transition-colors cursor-text"
                        />
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-[var(--tf-text-muted)] ml-2 shrink-0">
                        {count}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteFolderId(folder.id);
                      }}
                      aria-label={t.sidebar.deleteGroupAria(folder.name)}
                      title={t.sidebar.deleteGroupTitle}
                      className={`p-1.5 mr-1 rounded transition-colors shrink-0 ${
                        confirmDeleteFolderId === folder.id
                          ? 'text-rose-500 bg-rose-500/15'
                          : 'text-[var(--tf-text-muted)] hover:text-rose-500 hover:bg-[var(--tf-canvas)]'
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}

              {/* Drop Target to Create a New Tab Group in Sidebar */}
              <div
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
                  setIsAddingGroup(true);
                }}
                className={`mt-2 rounded-md border border-dashed transition-colors cursor-pointer ${
                  isCollapsed
                    ? 'p-2 flex items-center justify-center'
                    : 'px-2.5 py-2 flex items-center gap-2 text-[11px] font-medium'
                } ${
                  dragOverFolderId === '__sidebar_new_group__'
                    ? 'border-[var(--tf-accent)] bg-[var(--tf-accent-soft)] text-[var(--tf-text)]'
                    : 'border-[var(--tf-border)] text-[var(--tf-text-muted)] hover:text-[var(--tf-text)] hover:border-[var(--tf-border-strong)] hover:bg-[var(--tf-elevated)]/60'
                }`}
              >
                <FolderPlus className="w-3.5 h-3.5 shrink-0 text-[var(--tf-accent)]" />
                {!isCollapsed && (
                  <span className="truncate">
                    {dragOverFolderId === '__sidebar_new_group__'
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
