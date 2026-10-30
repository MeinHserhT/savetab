'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { FolderPlus } from 'lucide-react';
import { useLinkStore } from '@/store/useLinkStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { Sidebar } from '@/components/Sidebar';
import { KanbanBoard } from '@/components/KanbanBoard';
import { AddLinkModal } from '@/components/AddLinkModal';
import { ChromeTabGroupModal } from '@/components/ChromeTabGroupModal';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { AuthControl } from '@/components/AuthControl';
import { LinkStatus } from '@/lib/types';

export default function HomePage() {
  const { setActiveFolderId, fetchInitialData } = useLinkStore();
  const { t } = useLanguageStore();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportGroupModalOpen, setIsImportGroupModalOpen] = useState(false);
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
    <div className="h-dvh max-h-dvh w-full overflow-hidden flex flex-col bg-[var(--tf-canvas)] text-[var(--tf-text)] transition-colors duration-200">
      <header className="shrink-0 flex items-center justify-between gap-2 sm:gap-3 px-3 sm:px-5 lg:px-6 py-2 sm:py-2.5 border-b border-[var(--tf-border)] bg-[var(--tf-surface)] transition-colors duration-200">
        <a
          href="#all-groups"
          onClick={(e) => {
            e.preventDefault();
            setActiveFolderId(null);
          }}
          className="inline-flex items-center gap-2 sm:gap-2.5 text-sm sm:text-base font-bold tracking-tight text-[var(--tf-text)] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-lg"
        >
          <span className="relative w-7 h-7 sm:w-8 sm:h-8 shrink-0 flex items-center justify-center">
            <Image
              src="/assets/aistudio/logo-mark.png"
              alt="TabFlow Logo"
              fill
              priority
              sizes="32px"
              referrerPolicy="no-referrer"
              className="object-contain"
            />
          </span>
          <span>TabFlow</span>
        </a>

        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <button
            type="button"
            onClick={() => setIsImportGroupModalOpen(true)}
            title={t.header.importTabGroupTitle}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--tf-border)] bg-[var(--tf-elevated)] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:border-[var(--tf-border-strong)] transition-colors whitespace-nowrap shrink-0"
          >
            <FolderPlus className="w-3.5 h-3.5 text-[var(--tf-accent)] shrink-0" />
            <span className="hidden sm:inline">
              {t.header.importTabGroupBtn}
            </span>
            <span className="sm:hidden">{t.header.importTabGroupMobile}</span>
          </button>
          <LanguageSwitcher />
          <ThemeSwitcher />
          <AuthControl />
        </div>
      </header>

      {/* Main Workspace Container */}
      <main className="relative flex-1 flex flex-row min-h-0 overflow-hidden">
        <Sidebar />
        <KanbanBoard
          onOpenAddModal={handleOpenAddModal}
          onOpenImportModal={() => setIsImportGroupModalOpen(true)}
        />
      </main>

      {/* Accessible Save Link Modal */}
      <AddLinkModal
        isOpen={isAddModalOpen}
        defaultStatus={modalDefaultStatus}
        defaultFolderId={modalDefaultFolderId}
        onClose={() => setIsAddModalOpen(false)}
      />

      {/* Chrome Tab Group Import & Extension Bridge Modal */}
      <ChromeTabGroupModal
        isOpen={isImportGroupModalOpen}
        onClose={() => setIsImportGroupModalOpen(false)}
      />
    </div>
  );
}
