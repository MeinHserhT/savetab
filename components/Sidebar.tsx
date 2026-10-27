'use client';

import React, { useState } from 'react';
import {
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useLinkStore } from '@/store/useLinkStore';
import { TAB_GROUP_STYLES } from '@/components/KanbanBoard';
import { LinkStatus, TabGroupColor } from '@/lib/types';

const COLOR_KEYS = Object.keys(TAB_GROUP_STYLES) as TabGroupColor[];

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

export function Sidebar() {
  const {
    links,
    folders,
    activeFolderId,
    setActiveFolderId,
    createFolder,
    updateFolder,
    deleteFolder,
    addLink,
    updateLink,
  } = useLinkStore();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState<TabGroupColor>('blue');

  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    const created = await createFolder(newGroupName.trim(), null, newGroupColor);
    if (created) {
      setNewGroupName('');
      setIsAddingGroup(false);
    }
  };

  const commitEditingFolder = async (folderId: string) => {
    const trimmed = editingName.trim();
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

  return (
    <aside
      aria-label="Tab Groups sidebar"
      className={`${
        isCollapsed ? 'w-14 lg:w-14' : 'w-full lg:w-[248px]'
      } shrink-0 border-b lg:border-b-0 lg:border-r border-zinc-800/90 bg-zinc-950/90 flex flex-col justify-between select-none transition-all duration-200 ease-in-out overflow-hidden`}
    >
      <div className={isCollapsed ? 'p-2 space-y-3' : 'p-4 space-y-6'}>
        <div className="space-y-1.5">
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-2 pb-1">
              <button
                type="button"
                onClick={() => setIsCollapsed(false)}
                aria-label="Expand sidebar"
                title="Expand sidebar"
                className="p-2 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCollapsed(false);
                  setIsAddingGroup(true);
                }}
                aria-label="New Group"
                title="New Group"
                className="p-2 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="px-2 pb-1 flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={() => setIsAddingGroup((prev) => !prev)}
                aria-label="New Group"
                className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-100 transition-colors rounded px-1.5 py-0.5 whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Group</span>
              </button>
              <button
                type="button"
                onClick={() => setIsCollapsed(true)}
                aria-label="Collapse sidebar"
                title="Collapse sidebar to left"
                className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors shrink-0"
              >
                <PanelLeftClose className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {!isCollapsed && isAddingGroup && (
            <form
              onSubmit={handleCreateGroup}
              className="p-2.5 mb-2 rounded-md border border-zinc-800 bg-zinc-900/90 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <label
                  htmlFor="sidebar-group-name"
                  className="text-xs font-medium text-zinc-300"
                >
                  Group Name
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddingGroup(false)}
                  aria-label="Cancel new group"
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                id="sidebar-group-name"
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="e.g. Reading List"
                required
                className="w-full px-2.5 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-sky-500"
              />
              <div className="flex items-center gap-1.5">
                {COLOR_KEYS.map((cKey) => (
                  <button
                    key={cKey}
                    type="button"
                    aria-label={`Color ${cKey}`}
                    onClick={() => setNewGroupColor(cKey)}
                    className={`w-4 h-4 rounded-full ${TAB_GROUP_STYLES[cKey].dot} ${
                      newGroupColor === cKey
                        ? 'ring-2 ring-white ring-offset-1 ring-offset-zinc-900'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
              <button
                type="submit"
                className="w-full py-1.5 px-3 text-xs font-medium bg-zinc-100 text-zinc-950 rounded hover:bg-white transition-colors whitespace-nowrap"
              >
                Add Tab Group
              </button>
            </form>
          )}

          <button
            type="button"
            onClick={() => setActiveFolderId(null)}
            title="All Saved Tabs"
            className={`w-full flex items-center ${
              isCollapsed ? 'justify-center p-2' : 'justify-between px-2.5 py-2'
            } rounded-md text-xs font-medium transition-colors ${
              activeFolderId === null
                ? 'bg-zinc-800/90 text-zinc-50'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/70'
            }`}
          >
            <span className="flex items-center gap-2 truncate">
              <Layers className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
              {!isCollapsed && <span className="truncate">All Saved Tabs</span>}
            </span>
            {!isCollapsed && (
              <span className="font-mono text-[11px] tabular-nums text-zinc-400 ml-2">
                {links.length}
              </span>
            )}
          </button>

          <div className="space-y-0.5 pt-1">
            {folders.map((folder) => {
              const colorKey: TabGroupColor = folder.color ?? 'blue';
              const style =
                TAB_GROUP_STYLES[colorKey] ?? TAB_GROUP_STYLES.blue;
              const isSelected = activeFolderId === folder.id;
              const isDropTarget = dragOverFolderId === folder.id;
              const isEditing = editingFolderId === folder.id;
              const count = links.filter((l) => l.folder_id === folder.id).length;

              if (isCollapsed) {
                return (
                  <button
                    key={folder.id}
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
                    className={`w-full flex items-center justify-center p-2 rounded-md transition-colors ${
                      isDropTarget
                        ? 'bg-sky-950/60 ring-1 ring-sky-400'
                        : isSelected
                        ? 'bg-zinc-800/90 text-zinc-50'
                        : 'text-zinc-300 hover:text-zinc-100 hover:bg-zinc-900/70'
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
                  className={`group flex items-center justify-between rounded-md transition-colors ${
                    isDropTarget
                      ? 'bg-sky-950/40 ring-1 ring-sky-400 text-zinc-50'
                      : isSelected
                      ? 'bg-zinc-800/90 text-zinc-50'
                      : 'text-zinc-300 hover:text-zinc-100 hover:bg-zinc-900/70'
                  }`}
                >
                  <div
                    onClick={() =>
                      setActiveFolderId(isSelected ? null : folder.id)
                    }
                    className="flex-1 flex items-center justify-between pl-2.5 pr-1.5 py-1.5 text-xs font-medium min-w-0 cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${style.dot}`}
                      />
                      <input
                        type="text"
                        value={isEditing ? editingName : folder.name}
                        onFocus={() => {
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
                        aria-label={`Edit group name ${folder.name}`}
                        title="Click to edit group name"
                        className="w-full min-w-0 bg-transparent text-xs font-medium text-inherit truncate rounded px-1 py-0.5 -mx-1 border border-transparent hover:border-zinc-700/80 focus:border-sky-500 focus:bg-zinc-950 focus:text-zinc-100 focus:outline-none transition-colors cursor-text"
                      />
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-zinc-400 ml-2 shrink-0">
                      {count}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => deleteFolder(folder.id)}
                    aria-label={`Delete sidebar group ${folder.name}`}
                    className="p-1.5 mr-1 text-zinc-500 hover:text-rose-400 rounded hover:bg-zinc-800 transition-colors shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
