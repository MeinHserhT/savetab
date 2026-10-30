'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ClipboardPaste,
  FolderPlus,
  Layers,
  Sparkles,
  X,
} from 'lucide-react';
import { useLinkStore } from '@/store/useLinkStore';
import { useThemeStore } from '@/store/useThemeStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { COLOR_KEYS, getTabGroupStyles } from '@/components/KanbanBoard';
import {
  inferDefaultGroupName,
  parseTabGroupFromDataTransfer,
  parseTabGroupFromTextOrHtml,
  pickNextTabGroupColor,
} from '@/lib/tab-group-drop';
import { TabGroupColor } from '@/lib/types';

interface ChromeTabGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChromeTabGroupModal({
  isOpen,
  onClose,
}: ChromeTabGroupModalProps) {
  const { folders, isImportingGroup, createFolderWithLinks } = useLinkStore();
  const { mode } = useThemeStore();
  const { t } = useLanguageStore();
  const groupStyles = getTabGroupStyles(mode);

  const [groupName, setGroupName] = useState('');
  const [selectedColor, setSelectedColor] = useState<TabGroupColor>('blue');
  const [rawInput, setRawInput] = useState('');
  const [rawHtml, setRawHtml] = useState<string | undefined>(undefined);
  const [isDragOver, setIsDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLocalError(null);
    setSelectedColor(pickNextTabGroupColor(folders.length));
  }, [isOpen, folders.length]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const parsedPayload = useMemo(
    () => parseTabGroupFromTextOrHtml(rawInput, rawHtml),
    [rawInput, rawHtml]
  );

  useEffect(() => {
    if (parsedPayload.color) {
      setSelectedColor(parsedPayload.color);
    }
  }, [parsedPayload.color]);

  if (!isOpen) return null;

  const handlePasteFromClipboard = async () => {
    setLocalError(null);
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText && clipText.trim()) {
        setRawInput((prev) =>
          prev.trim() ? `${prev.trim()}\n${clipText.trim()}` : clipText.trim()
        );
      }
    } catch {
      // Clipboard API permission denied; user can press Ctrl+V in textarea
    }
  };

  const handleDropInBox = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setLocalError(null);

    const dropped = parseTabGroupFromDataTransfer(e.dataTransfer);
    if (dropped.tabs.length === 0) {
      setLocalError(t.chromeImport.errNoValidUrls);
      return;
    }

    const effectiveName =
      groupName.trim() ||
      inferDefaultGroupName(dropped, t.board.defaultNewGroupName);
    const effectiveColor = dropped.color ?? selectedColor;

    const created = await createFolderWithLinks({
      name: effectiveName,
      color: effectiveColor,
      tabs: dropped.tabs,
      focusInlineRename: !groupName.trim(),
    });

    if (created) {
      setGroupName('');
      setRawInput('');
      setRawHtml(undefined);
      onClose();
    }
  };

  const handleSubmitPaste = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (parsedPayload.tabs.length === 0) {
      setLocalError(t.chromeImport.errNoValidUrls);
      return;
    }

    const userTypedCustomName = Boolean(groupName.trim());
    const finalName = userTypedCustomName
      ? groupName.trim().slice(0, 100)
      : inferDefaultGroupName(parsedPayload, t.board.defaultNewGroupName);
    const finalColor = parsedPayload.color ?? selectedColor;

    const created = await createFolderWithLinks({
      name: finalName,
      color: finalColor,
      tabs: parsedPayload.tabs,
      focusInlineRename: !userTypedCustomName,
    });

    if (created) {
      setGroupName('');
      setRawInput('');
      setRawHtml(undefined);
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="chrome-import-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs"
    >
      <div className="w-full max-w-xl rounded-xl border border-[var(--tf-border-strong)] bg-[var(--tf-elevated)] text-[var(--tf-text)] shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[var(--tf-border)] flex items-center justify-between gap-2 bg-[var(--tf-surface)] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Layers className="w-4 h-4 text-[var(--tf-accent)] shrink-0" />
            <h2
              id="chrome-import-modal-title"
              className="text-xs sm:text-sm font-semibold text-[var(--tf-text)] truncate"
            >
              {t.chromeImport.modalTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.chromeImport.closeAria}
            className="p-1 rounded-md text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-elevated)] transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1 min-h-0">
          <form onSubmit={handleSubmitPaste} className="space-y-3.5">
            {/* Optional Group Name + Color Picker */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="chrome-import-group-name"
                  className="block text-[11px] font-medium text-[var(--tf-text-secondary)]"
                >
                  {t.chromeImport.groupNameOptionalLabel}
                </label>
                <input
                  id="chrome-import-group-name"
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder={
                    parsedPayload.groupName ||
                    t.chromeImport.groupNameOptionalPlaceholder
                  }
                  className="w-full px-3 py-1.5 text-xs rounded-md bg-[var(--tf-canvas)] border border-[var(--tf-border)] text-[var(--tf-text)] placeholder:text-[var(--tf-text-muted)] focus:outline-none focus:border-[var(--tf-accent)]"
                />
              </div>

              <div className="space-y-1.5">
                <span className="block text-[11px] font-medium text-[var(--tf-text-secondary)]">
                  {t.chromeImport.colorLabel}
                </span>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {COLOR_KEYS.map((cKey) => (
                    <button
                      key={cKey}
                      type="button"
                      title={t.board.colors[cKey]}
                      aria-label={t.board.setColorAria(t.board.colors[cKey])}
                      onClick={() => setSelectedColor(cKey)}
                      className={`w-4 h-4 rounded-full ${groupStyles[cKey].dot} transition-transform ${
                        selectedColor === cKey
                          ? 'ring-2 ring-[var(--tf-text)] ring-offset-1 ring-offset-[var(--tf-elevated)] scale-110'
                          : 'opacity-75 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Paste & Drop Area */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="chrome-import-urls"
                  className="text-[11px] font-medium text-[var(--tf-text-secondary)]"
                >
                  {t.chromeImport.pasteInputLabel}
                </label>
                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-[var(--tf-surface)] border border-[var(--tf-border)] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:border-[var(--tf-border-strong)] transition-colors whitespace-nowrap shrink-0"
                >
                  <ClipboardPaste className="w-3 h-3" />
                  <span>{t.chromeImport.pasteFromClipboardBtn}</span>
                </button>
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!isDragOver) setIsDragOver(true);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setIsDragOver(false);
                  }
                }}
                onDrop={handleDropInBox}
                className={`relative rounded-lg border transition-colors ${
                  isDragOver
                    ? 'border-[var(--tf-accent)] bg-[var(--tf-accent-soft)]'
                    : 'border-[var(--tf-border)] bg-[var(--tf-canvas)]'
                }`}
              >
                <textarea
                  id="chrome-import-urls"
                  rows={6}
                  value={rawInput}
                  onChange={(e) => {
                    setRawInput(e.target.value);
                    setLocalError(null);
                  }}
                  onPaste={(e) => {
                    const htmlData = e.clipboardData.getData('text/html');
                    if (htmlData) {
                      setRawHtml(htmlData);
                    }
                  }}
                  placeholder={t.chromeImport.pasteInputPlaceholder}
                  className="w-full p-3 text-xs font-mono bg-transparent text-[var(--tf-text)] placeholder:text-[var(--tf-text-muted)] focus:outline-none resize-y"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--tf-text-muted)]">
                <span>{t.chromeImport.pasteDropHint}</span>
                {parsedPayload.tabs.length > 0 && (
                  <span className="font-mono tabular-nums text-[var(--tf-accent-text)] font-medium">
                    {t.chromeImport.detectedTabsCount(
                      parsedPayload.tabs.length
                    )}
                    {parsedPayload.groupName
                      ? ` · ${t.chromeImport.detectedGroupName(
                          parsedPayload.groupName
                        )}`
                      : ''}
                  </span>
                )}
              </div>
            </div>

            <div className="p-3 rounded-lg border border-[var(--tf-border)] bg-[var(--tf-surface)] space-y-1">
              <div className="text-xs font-semibold text-[var(--tf-text)] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[var(--tf-accent)] shrink-0" />
                <span>{t.chromeImport.extBookmarkTipTitle}</span>
              </div>
              <p className="text-xs text-[var(--tf-text-secondary)] leading-relaxed">
                {t.chromeImport.extBookmarkTipDesc}
              </p>
            </div>

            {localError && (
              <div
                role="alert"
                className="px-3 py-2 rounded-md bg-rose-500/15 border border-rose-500/40 text-xs text-rose-400"
              >
                {localError}
              </div>
            )}

            <div className="pt-1 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-md text-xs font-medium border border-[var(--tf-border)] bg-[var(--tf-surface)] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] transition-colors"
              >
                {t.sidebar.cancel}
              </button>
              <button
                type="submit"
                disabled={isImportingGroup}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold bg-[var(--tf-text)] text-[var(--tf-canvas)] hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap shrink-0"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>
                  {isImportingGroup
                    ? t.chromeImport.creatingBtn
                    : t.chromeImport.createGroupSubmit(
                        parsedPayload.tabs.length
                      )}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
