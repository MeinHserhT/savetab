'use client';

import React, { useEffect, useState } from 'react';
import { useLinkStore } from '@/store/useLinkStore';
import { Sidebar } from '@/components/Sidebar';
import { KanbanBoard } from '@/components/KanbanBoard';
import { AddLinkModal } from '@/components/AddLinkModal';
import { LinkStatus } from '@/lib/types';

export default function HomePage() {
  const { setActiveFolderId, fetchInitialData } = useLinkStore();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalDefaultStatus, setModalDefaultStatus] = useState<LinkStatus>(
    LinkStatus.UNREAD
  );
  const [modalDefaultFolderId, setModalDefaultFolderId] = useState<
    string | null
  >(null);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const handleOpenAddModal = (
    defaultStatus: LinkStatus = LinkStatus.UNREAD,
    defaultFolderId?: string
  ) => {
    setModalDefaultStatus(defaultStatus);
    setModalDefaultFolderId(defaultFolderId ?? null);
    setIsAddModalOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 border-b border-zinc-800/90 bg-zinc-950">
        <a
          href="#all-groups"
          onClick={(e) => {
            e.preventDefault();
            setActiveFolderId(null);
          }}
          className="text-base font-bold tracking-tight text-zinc-50 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded"
        >
          TabFlow
        </a>
      </header>

      {/* Main Workspace Container */}
      <main className="flex-1 flex flex-col lg:flex-row min-h-0">
        <Sidebar />
        <KanbanBoard onOpenAddModal={handleOpenAddModal} />
      </main>

      {/* Accessible Save Link Modal */}
      <AddLinkModal
        isOpen={isAddModalOpen}
        defaultStatus={modalDefaultStatus}
        defaultFolderId={modalDefaultFolderId}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  );
}
