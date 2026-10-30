'use client';

import React, { useState } from 'react';
import { Check, ClipboardPaste, Globe, Loader2, Plus, X } from 'lucide-react';
import { Folder, TabGroupColor } from '@/lib/types';
import { getTabGroupStyles } from '@/components/KanbanBoard';
import { useThemeStore } from '@/store/useThemeStore';
import { useLanguageStore } from '@/store/useLanguageStore';

interface EmptyLaneStateProps {
  group: Folder;
  isDragOver?: boolean;
  onAddViaModal: (folderId: string) => void;
  onQuickSaveUrl: (url: string, folderId: string) => Promise<boolean>;
}

export function EmptyLaneState({
  group,
  isDragOver = false,
  onAddViaModal,
  onQuickSaveUrl,
}: EmptyLaneStateProps) {
  const [showInlineInput, setShowInlineInput] = useState(false);
  const [inlineUrl, setInlineUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const { mode } = useThemeStore();
  const { t } = useLanguageStore();
  const groupStyles = getTabGroupStyles(mode);
  const colorKey: TabGroupColor = group.color ?? 'blue';
  const style = groupStyles[colorKey] ?? groupStyles.blue;

  const isLikelyUrl = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || /\s/.test(trimmed)) return false;
    return /^(https?:\/\/)?[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+(\/.*)?$/.test(trimmed);
  };

  const handleClipboardPaste = async () => {
    setFeedbackError(null);
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const clipText = await navigator.clipboard.readText();
        if (clipText && isLikelyUrl(clipText)) {
          setIsSaving(true);
          const ok = await onQuickSaveUrl(clipText.trim(), group.id);
          setIsSaving(false);
          if (ok) return;
        } else if (clipText && clipText.trim()) {
          setInlineUrl(clipText.trim());
        }
      }
    } catch {
      // Clipboard read blocked by browser permissions; fall back to inline single-line input
    }
    setShowInlineInput(true);
  };

  const handleInlineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const candidate = inlineUrl.trim();
    if (!candidate) {
      setFeedbackError(t.emptyLane.errEmptyUrl);
      return;
    }
    setFeedbackError(null);
    setIsSaving(true);
    const ok = await onQuickSaveUrl(candidate, group.id);
    setIsSaving(false);
    if (ok) {
      setInlineUrl('');
      setShowInlineInput(false);
    } else {
      setFeedbackError(t.emptyLane.errSaveFailed);
    }
  };

  return (
    <div
      data-testid={`empty-lane-${group.id}`}
      className={`rounded-md border border-dashed transition-colors p-3 space-y-2.5 ${
        isDragOver
          ? `${style.badgeBg} border-current`
          : 'border-[var(--tf-border)] bg-[var(--tf-card)] hover:border-[var(--tf-border-strong)]'
      }`}
    >
      {/* Compact Browser-Tab Geometry Row with Group-Colored Accent Icon */}
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className={`w-6 h-6 rounded border flex items-center justify-center shrink-0 ${style.badgeBg} ${style.badgeText}`}
        >
          <Globe className="w-3.5 h-3.5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-[var(--tf-text)] truncate">
            {t.emptyLane.noLinksIn(group.name)}
          </p>
          <p className="text-[11px] text-[var(--tf-text-muted)] truncate">
            {t.emptyLane.subtext}
          </p>
        </div>
      </div>

      {/* Dual Action Controls: Clipboard Quick-Paste + Preselected Modal Button */}
      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="button"
          disabled={isSaving}
          onClick={handleClipboardPaste}
          aria-label={t.emptyLane.pasteUrlAria(group.name)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] bg-[var(--tf-surface)] hover:bg-[var(--tf-elevated)] border border-[var(--tf-border)] rounded transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--tf-accent)]"
        >
          {isSaving ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <ClipboardPaste className="w-3 h-3 text-[var(--tf-text-muted)]" />
          )}
          <span>{t.emptyLane.pasteUrl}</span>
        </button>

        <button
          type="button"
          disabled={isSaving}
          onClick={() => onAddViaModal(group.id)}
          aria-label={t.emptyLane.addLinkAria(group.name)}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold border rounded transition-opacity hover:opacity-90 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--tf-accent)] ${style.badgeBg} ${style.badgeText}`}
        >
          <Plus className="w-3 h-3" />
          <span>{t.emptyLane.addLink}</span>
        </button>
      </div>

      {/* Compact Single-Line Fallback URL Input (when Paste URL is clicked or clipboard requires manual paste) */}
      {showInlineInput && (
        <form
          onSubmit={handleInlineSubmit}
          className="pt-2 border-t border-[var(--tf-border)] flex items-center gap-1.5"
        >
          <input
            type="text"
            value={inlineUrl}
            onChange={(e) => setInlineUrl(e.target.value)}
            aria-label={t.emptyLane.quickInputAria(group.name)}
            placeholder={t.emptyLane.quickInputPlaceholder}
            autoFocus
            className="flex-1 min-w-0 px-2.5 py-1 text-xs bg-[var(--tf-surface)] border border-[var(--tf-border)] rounded text-[var(--tf-text)] placeholder:text-[var(--tf-text-muted)] focus:outline-none focus:border-[var(--tf-accent)]"
          />
          <button
            type="submit"
            disabled={isSaving}
            aria-label={t.emptyLane.saveQuickAria(group.name)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-[var(--tf-text)] hover:opacity-90 text-[var(--tf-canvas)] rounded transition-opacity whitespace-nowrap shrink-0"
          >
            {isSaving ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Check className="w-3 h-3" />
            )}
            <span>{t.emptyLane.save}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setShowInlineInput(false);
              setFeedbackError(null);
            }}
            aria-label={t.emptyLane.cancelQuickAria}
            className="p-1 text-[var(--tf-text-muted)] hover:text-[var(--tf-text)] rounded hover:bg-[var(--tf-surface)]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </form>
      )}

      {feedbackError && (
        <p role="alert" className="text-[11px] text-rose-500">
          {feedbackError}
        </p>
      )}
    </div>
  );
}
