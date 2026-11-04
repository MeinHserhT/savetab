'use client';

import React, { useEffect, useState } from 'react';
import { Link2, Loader2, Upload, X } from 'lucide-react';
import { useLinkStore } from '@/store/useLinkStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { LinkStatus } from '@/lib/types';
import { parseTabGroupFromDataTransfer } from '@/lib/tab-group-drop';

interface AddLinkModalProps {
  isOpen: boolean;
  defaultStatus?: LinkStatus;
  defaultFolderId?: string | null;
  onClose: () => void;
}

export function AddLinkModal({
  isOpen,
  defaultStatus = LinkStatus.UNREAD,
  defaultFolderId = null,
  onClose,
}: AddLinkModalProps) {
  const { folders, activeFolderId, addLink, isScraping } = useLinkStore();
  const { t } = useLanguageStore();

  const [url, setUrl] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const targetFolderId =
    defaultFolderId ?? activeFolderId ?? folders[0]?.id ?? null;

  useEffect(() => {
    if (isOpen) {
      setValidationError(null);
      setIsDragOver(false);
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

  const saveUrl = async (rawUrl: string) => {
    const trimmed = rawUrl.trim();
    if (!trimmed) {
      setValidationError(t.addModal.errEmptyUrl);
      return;
    }

    setValidationError(null);
    const created = await addLink({
      url: trimmed,
      folder_id: targetFolderId,
      tags: ['saved-tab'],
      status: defaultStatus,
    });

    if (created) {
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
