'use client';

import React, { createContext, useContext, useState } from 'react';
import {
  CollisionDetection,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Globe, GripVertical, Layers } from 'lucide-react';
import { useLinkStore } from '@/store/useLinkStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { Folder, LinkItem } from '@/lib/types';
import { pickNextTabGroupColor } from '@/lib/tab-group-drop';

interface WorkspaceDndContextValue {
  activeLink: LinkItem | null;
  activeFolder: Folder | null;
  overFolderId: string | null;
  overLinkId: string | null;
  overPosition: 'before' | 'after';
  isOverNewGroupZone: boolean;
}

const WorkspaceDndContext = createContext<WorkspaceDndContextValue>({
  activeLink: null,
  activeFolder: null,
  overFolderId: null,
  overLinkId: null,
  overPosition: 'after',
  isOverNewGroupZone: false,
});

export function useWorkspaceDnd() {
  return useContext(WorkspaceDndContext);
}

const customCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  return pointerCollisions.length > 0 ? pointerCollisions : closestCorners(args);
};

export function WorkspaceDndProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { links, folders, reorderLink, createFolder, reorderFolders } =
    useLinkStore();
  const { t } = useLanguageStore();

  const [activeLink, setActiveLink] = useState<LinkItem | null>(null);
  const [activeFolder, setActiveFolder] = useState<Folder | null>(null);
  const [overFolderId, setOverFolderId] = useState<string | null>(null);
  const [overLinkId, setOverLinkId] = useState<string | null>(null);
  const [overPosition, setOverPosition] = useState<'before' | 'after'>('after');
  const [isOverNewGroupZone, setIsOverNewGroupZone] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const resetDragState = () => {
    setActiveLink(null);
    setActiveFolder(null);
    setOverFolderId(null);
    setOverLinkId(null);
    setOverPosition('after');
    setIsOverNewGroupZone(false);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.type === 'link' && data.link) {
      setActiveLink(data.link as LinkItem);
      setActiveFolder(null);
    } else if (
      (data?.type === 'folder-column' || data?.type === 'sidebar-folder') &&
      data.folder
    ) {
      setActiveFolder(data.folder as Folder);
      setActiveLink(null);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) {
      setOverFolderId(null);
      setOverLinkId(null);
      setIsOverNewGroupZone(false);
      return;
    }

    const overData = over.data.current;

    if (overData?.type === 'new-group') {
      setIsOverNewGroupZone(true);
      setOverFolderId(null);
      setOverLinkId(null);
      return;
    }

    setIsOverNewGroupZone(false);

    if (
      (overData?.type === 'folder' ||
        overData?.type === 'folder-column' ||
        overData?.type === 'sidebar-folder') &&
      overData.folderId
    ) {
      setOverFolderId(String(overData.folderId));
      setOverLinkId(null);
      return;
    }

    if (overData?.type === 'link' && overData.link) {
      const targetLink = overData.link as LinkItem;
      setOverLinkId(targetLink.id);
      setOverFolderId(
        overData.groupId
          ? String(overData.groupId)
          : (targetLink.folder_id ?? '__ungrouped__')
      );

      const activeRect = active.rect.current.translated;
      const overRect = over.rect;
      if (activeRect && overRect) {
        const activeCenterY = activeRect.top + activeRect.height / 2;
        const overCenterY = overRect.top + overRect.height / 2;
        setOverPosition(activeCenterY < overCenterY ? 'before' : 'after');
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const currentOverPosition = overPosition;
    resetDragState();

    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // 1. Folder reordering
    if (
      activeData?.type === 'folder-column' ||
      activeData?.type === 'sidebar-folder'
    ) {
      const sourceFolderId = String(activeData.folderId || '');
      const targetFolderId = String(
        overData?.folderId ||
          (overData?.type === 'link' ? overData?.groupId : '') ||
          ''
      );
      if (
        sourceFolderId &&
        targetFolderId &&
        sourceFolderId !== targetFolderId &&
        sourceFolderId !== '__ungrouped__' &&
        targetFolderId !== '__ungrouped__'
      ) {
        const sourceIdx = folders.findIndex((f) => f.id === sourceFolderId);
        const targetIdx = folders.findIndex((f) => f.id === targetFolderId);
        const pos: 'before' | 'after' =
          sourceIdx !== -1 && targetIdx !== -1 && sourceIdx < targetIdx
            ? 'after'
            : 'before';
        await reorderFolders(sourceFolderId, targetFolderId, pos);
      }
      return;
    }

    // 2. Link Card Drag & Drop
    if (activeData?.type !== 'link') return;
    const draggedLink =
      links.find((l) => l.id === String(active.id)) ??
      (activeData.link as LinkItem | undefined);
    if (!draggedLink) return;

    // 2a. Dropped onto "Create New Tab Group" zone
    if (overData?.type === 'new-group') {
      const nextColor = pickNextTabGroupColor(folders.length);
      const created = await createFolder(
        t.board.defaultNewGroupName,
        null,
        nextColor
      );
      if (created) {
        await reorderLink(draggedLink.id, created.id, null, 'after');
        useLinkStore.setState({
          activeFolderId: null,
          newlyCreatedGroupId: created.id,
        });
      }
      return;
    }

    // 2b. Dropped onto a Folder column, Sidebar folder, or Bottom Nav folder pill
    if (
      (overData?.type === 'folder' ||
        overData?.type === 'folder-column' ||
        overData?.type === 'sidebar-folder') &&
      overData.folderId
    ) {
      const rawFolderId = String(overData.folderId);
      const resolvedFolderId =
        rawFolderId === '__ungrouped__' ? null : rawFolderId;
      await reorderLink(draggedLink.id, resolvedFolderId, null, 'after');
      return;
    }

    // 2c. Dropped onto another Link Card
    if (overData?.type === 'link' && overData.link) {
      const targetLink = overData.link as LinkItem;
      const rawGroupId = String(
        overData.groupId ?? targetLink.folder_id ?? '__ungrouped__'
      );
      const resolvedFolderId =
        rawGroupId === '__ungrouped__' ? null : rawGroupId;

      if (
        draggedLink.id === targetLink.id &&
        draggedLink.folder_id === resolvedFolderId
      ) {
        return;
      }

      await reorderLink(
        draggedLink.id,
        resolvedFolderId,
        targetLink.id,
        currentOverPosition
      );
    }
  };

  const activeLinkFolderName = activeLink
    ? folders.find((f) => f.id === activeLink.folder_id)?.name ||
      t.sidebar.allSavedTabs
    : '';

  return (
    <WorkspaceDndContext.Provider
      value={{
        activeLink,
        activeFolder,
        overFolderId,
        overLinkId,
        overPosition,
        isOverNewGroupZone,
      }}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={resetDragState}
      >
        {children}

        <DragOverlay dropAnimation={null}>
          {activeLink ? (
            <div
              data-testid="dnd-kit-drag-overlay-card"
              className="w-[244px] rounded-md border-2 border-[var(--tf-accent)] bg-[var(--tf-elevated)] p-2.5 shadow-2xl ring-2 ring-[var(--tf-accent)]/30 pointer-events-none select-none rotate-[1.5deg] scale-[1.02]"
            >
              <div className="flex items-start gap-2 text-[11px]">
                <GripVertical className="w-3.5 h-3.5 mt-0.5 text-[var(--tf-accent)] shrink-0" />
                <span className="w-4 h-4 mt-0.5 rounded bg-[var(--tf-surface)] border border-[var(--tf-border)] flex items-center justify-center shrink-0 overflow-hidden">
                  {activeLink.favicon ? (
                    <img
                      src={activeLink.favicon}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="w-3 h-3 object-contain"
                    />
                  ) : (
                    <Globe className="w-2.5 h-2.5 text-[var(--tf-text-muted)]" />
                  )}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-[11px] font-semibold text-[var(--tf-text)] truncate leading-snug">
                    {activeLink.title}
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-[var(--tf-text-muted)]">
                    <span className="truncate text-[var(--tf-text-secondary)]">
                      {activeLink.domain}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="px-1.5 py-0.2 rounded bg-[var(--tf-surface)] border border-[var(--tf-border)] text-[9px] font-sans font-semibold text-[var(--tf-text-secondary)] truncate max-w-[90px]">
                      {activeLinkFolderName}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : activeFolder ? (
            <div className="px-3 py-2 rounded-lg border-2 border-[var(--tf-accent)] bg-[var(--tf-elevated)] text-xs font-semibold text-[var(--tf-text)] shadow-2xl inline-flex items-center gap-2 pointer-events-none select-none">
              <Layers className="w-3.5 h-3.5 text-[var(--tf-accent)]" />
              <span>{activeFolder.name}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </WorkspaceDndContext.Provider>
  );
}
