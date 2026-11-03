'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  FolderOpen,
  Link2,
  Loader2,
  RotateCcw,
  Upload,
  X,
} from 'lucide-react';
import { useLinkStore } from '@/store/useLinkStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { findDuplicateLinkByUrl } from '@/lib/kanban-rules';
import { LinkItem, LinkStatus } from '@/lib/types';
import { parseTabGroupFromDataTransfer } from '@/lib/tab-group-drop';

interface AddLinkModalProps {
  isOpen: boolean;
  defaultStatus?: LinkStatus;
  defaultFolderId?: string | null;
  onClose: () => void;
}

interface DuplicateAlertState {
  link: LinkItem;
  groupName: string;
}

export function AddLinkModal({
  isOpen,
  defaultStatus = LinkStatus.UNREAD,
  defaultFolderId = null,
  onClose,
}: AddLinkModalProps) {
  const {
    links,
    folders,
    activeFolderId,
    addLink,
    setActiveFolderId,
    isScraping,
  } = useLinkStore();
  const { t } = useLanguageStore();

  const [url, setUrl] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submittedDuplicate, setSubmittedDuplicate] =
    useState<DuplicateAlertState | null>(null);

  const targetFolderId =
    defaultFolderId ?? activeFolderId ?? folders[0]?.id ?? null;

  const matchedDuplicate = useMemo(() => {
    const trimmed = url.trim();
    if (!trimmed || trimmed.length < 4) return null;
    return findDuplicateLinkByUrl(trimmed, links, folders);
  }, [url, links, folders]);

  const duplicateGroupName = useMemo(() => {
    if (!matchedDuplicate) return '';
    return (
      folders.find((f) => f.id === matchedDuplicate.folder_id)?.name ||
      t.sidebar.allSavedTabs
    );
  }, [matchedDuplicate, folders, t]);

  useEffect(() => {
    if (isOpen) {
      setValidationError(null);
      setIsDragOver(false);
      setSubmittedDuplicate(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleViewExistingGroup = (dupLink: LinkItem) => {
    if (dupLink.folder_id) {
      setActiveFolderId(dupLink.folder_id);
    }
    useLinkStore.setState({ highlightedLinkId: dupLink.id });
    setSubmittedDuplicate(null);
    setUrl('');
    onClose();
  };

  const saveUrl = async (rawUrl: string) => {
    const trimmed = rawUrl.trim();
    if (!trimmed) {
      setValidationError(t.addModal.errEmptyUrl);
      return;
    }

    setValidationError(null);
    const preDetectedDuplicate = findDuplicateLinkByUrl(trimmed, links, folders);

    const created = await addLink({
      url: trimmed,
      folder_id: targetFolderId,
      tags: ['saved-tab'],
      status: defaultStatus,
    });

    const latestState = useLinkStore.getState();
    const isDuplicateNotice =
      latestState.workspaceNotice?.kind === 'duplicate-removed';
    const effectiveDuplicate =
      preDetectedDuplicate || (isDuplicateNotice ? created : null);

    if (effectiveDuplicate) {
      const resolvedGroupName =
        latestState.folders.find((f) => f.id === effectiveDuplicate.folder_id)
          ?.name || t.sidebar.allSavedTabs;
      setSubmittedDuplicate({
        link: effectiveDuplicate,
        groupName: resolvedGroupName,
      });
      return;
    }

    if (created) {
      setSubmittedDuplicate(null);
      setUrl('');
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveUrl(url);
  };

  const handleDrop = async (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const droppedUrl =
      parseTabGroupFromDataTransfer(e.dataTransfer).tabs[0]?.url ?? '';
    if (!droppedUrl) {
      setValidationError(t.addModal.errInvalidDrop);
      return;
    }
    setUrl(droppedUrl);
    await saveUrl(droppedUrl);
  };

  const activeDuplicateAlert: DuplicateAlertState | null =
    submittedDuplicate ||
    (matchedDuplicate
      ? { link: matchedDuplicate, groupName: duplicateGroupName }
      : null);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-link-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isScraping) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-lg border border-[var(--tf-border-strong)] bg-[var(--tf-elevated)] text-[var(--tf-text)] shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--tf-border)] flex items-center justify-between">
          <h2
            id="add-link-modal-title"
            className="text-sm font-semibold text-[var(--tf-text)] flex items-center gap-2"
          >
            <Link2 className="w-4 h-4 text-[var(--tf-accent)]" />
            <span>{t.addModal.title}</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.addModal.closeAria}
            className="p-1 text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] rounded-md hover:bg-[var(--tf-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tf-accent)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          onDragOver={(e) => {
            e.preventDefault();
            if (!isDragOver) setIsDragOver(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setIsDragOver(false);
            }
          }}
          onDrop={handleDrop}
          className="p-4 space-y-3"
        >
          <div
            className={`rounded-md border border-dashed p-3 transition-colors ${
              isDragOver
                ? 'border-[var(--tf-accent)] bg-[var(--tf-accent-soft)]'
                : activeDuplicateAlert
                  ? 'border-amber-500/70 bg-amber-500/5'
                  : 'border-[var(--tf-border)] bg-[var(--tf-surface)]'
            }`}
          >
            <div className="flex items-center gap-2">
              <input
                id="save-link-url"
                type="text"
                autoFocus
                maxLength={2048}
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value.slice(0, 2048));
                  if (validationError) setValidationError(null);
                  if (submittedDuplicate) setSubmittedDuplicate(null);
                }}
                placeholder={t.addModal.urlPlaceholder}
                className="flex-1 px-3 py-2 text-xs bg-[var(--tf-canvas)] border border-[var(--tf-border)] rounded-md text-[var(--tf-text)] placeholder:text-[var(--tf-text-muted)] focus:outline-none focus:border-[var(--tf-accent)]"
              />
              <button
                type="submit"
                disabled={isScraping}
                className="px-3.5 py-2 text-xs font-medium text-[var(--tf-canvas)] bg-[var(--tf-text)] hover:opacity-90 rounded-md transition-opacity inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                {isScraping && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{t.addModal.save}</span>
              </button>
            </div>

            <p className="mt-2 text-[11px] text-[var(--tf-text-secondary)] flex items-center justify-center gap-1.5 select-none">
              <Upload className="w-3 h-3 text-[var(--tf-accent)] shrink-0" />
              <span>
                {isDragOver ? t.addModal.dropActiveHint : t.addModal.dropIdleHint}
              </span>
            </p>
          </div>

          {activeDuplicateAlert && (
            <div
              role="alert"
              aria-live="assertive"
              data-testid="add-modal-duplicate-alert"
              className="p-3 rounded-lg border-2 border-amber-500/80 bg-amber-500/15 shadow-md space-y-2.5 text-xs text-amber-800 dark:text-amber-200"
            >
              <div className="flex items-start gap-2.5">
                <span className="p-1.5 rounded-md bg-amber-500 text-amber-950 shrink-0 mt-0.5">
                  <AlertTriangle className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-bold text-amber-900 dark:text-amber-100 leading-tight">
                    {t.board.duplicateAlertTitle}
                  </p>
                  <p className="leading-snug text-amber-800 dark:text-amber-200">
                    {submittedDuplicate
                      ? t.addModal.duplicateSubmittedDesc(
                          activeDuplicateAlert.link.title ||
                            activeDuplicateAlert.link.domain,
                          activeDuplicateAlert.groupName
                        )
                      : t.addModal.duplicateUrlWarning(
                          activeDuplicateAlert.link.title ||
                            activeDuplicateAlert.link.domain,
                          activeDuplicateAlert.groupName
                        )}
                  </p>
                </div>
              </div>

              <div className="px-2.5 py-2 rounded-md bg-[var(--tf-canvas)]/90 border border-amber-500/40 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[var(--tf-text)] truncate">
                    {activeDuplicateAlert.link.title ||
                      activeDuplicateAlert.link.domain}
                  </p>
                  <p className="text-[11px] text-[var(--tf-text-muted)] font-mono truncate">
                    {activeDuplicateAlert.link.url}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/40 shrink-0">
                  <FolderOpen className="w-3 h-3" />
                  <span className="max-w-[120px] truncate">
                    {activeDuplicateAlert.groupName}
                  </span>
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setSubmittedDuplicate(null);
                    setUrl('');
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] bg-[var(--tf-surface)] hover:bg-[var(--tf-canvas)] border border-[var(--tf-border)] transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{t.addModal.tryAnotherUrl}</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleViewExistingGroup(activeDuplicateAlert.link)
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-amber-500 hover:bg-amber-400 text-amber-950 transition-colors shadow-xs"
                >
                  <span>{t.board.viewGroupBtn}</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {validationError && (
            <p role="alert" className="text-xs text-rose-500">
              {validationError}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

