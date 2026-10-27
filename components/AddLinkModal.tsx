'use client';

import React, { useEffect, useState } from 'react';
import { Link2, Loader2, Upload, X } from 'lucide-react';
import { useLinkStore } from '@/store/useLinkStore';
import { LinkStatus } from '@/lib/types';

interface AddLinkModalProps {
  isOpen: boolean;
  defaultStatus?: LinkStatus;
  defaultFolderId?: string | null;
  onClose: () => void;
}

function extractDroppedUrl(dataTransfer: DataTransfer): string {
  const uriList = dataTransfer.getData('text/uri-list');
  if (uriList) {
    const firstValidLine = uriList
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith('#'));
    if (firstValidLine) return firstValidLine;
  }
  const plainText = dataTransfer.getData('text/plain');
  return plainText ? plainText.trim().split(/\s+/)[0] : '';
}

export function AddLinkModal({
  isOpen,
  defaultStatus = LinkStatus.UNREAD,
  defaultFolderId = null,
  onClose,
}: AddLinkModalProps) {
  const { folders, activeFolderId, addLink, isScraping } = useLinkStore();

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
      setValidationError('Please enter or drop a valid URL.');
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

    const droppedUrl = extractDroppedUrl(e.dataTransfer);
    if (!droppedUrl) {
      setValidationError('Could not read a valid URL from the dropped item.');
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800/90 flex items-center justify-between">
          <h2
            id="add-link-modal-title"
            className="text-sm font-semibold text-zinc-100 flex items-center gap-2"
          >
            <Link2 className="w-4 h-4 text-sky-400" />
            <span>Add Link</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 text-zinc-400 hover:text-zinc-100 rounded-md hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
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
                ? 'border-sky-400 bg-sky-950/25'
                : 'border-zinc-800 bg-zinc-900/40'
            }`}
          >
            <div className="flex items-center gap-2">
              <input
                id="save-link-url"
                type="text"
                autoFocus
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                placeholder="Paste or drag & drop URL here..."
                className="flex-1 px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-sky-500"
              />
              <button
                type="submit"
                disabled={isScraping}
                className="px-3.5 py-2 text-xs font-medium text-zinc-950 bg-zinc-100 hover:bg-white rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                {isScraping && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save</span>
              </button>
            </div>

            <p className="mt-2 text-[11px] text-zinc-400 flex items-center justify-center gap-1.5 select-none">
              <Upload className="w-3 h-3 text-sky-400 shrink-0" />
              <span>
                {isDragOver
                  ? 'Drop URL now to save immediately'
                  : 'Drag & drop any link into this box or press Enter'}
              </span>
            </p>
          </div>

          {validationError && (
            <p role="alert" className="text-xs text-rose-400">
              {validationError}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
