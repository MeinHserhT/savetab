'use client';

import React, { useState } from 'react';
import { Check, ClipboardPaste, Globe, Loader2, Plus, X } from 'lucide-react';
import { Folder, TabGroupColor } from '@/lib/types';
import { TAB_GROUP_STYLES } from '@/components/KanbanBoard';

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

  const colorKey: TabGroupColor = group.color ?? 'blue';
  const style = TAB_GROUP_STYLES[colorKey] ?? TAB_GROUP_STYLES.blue;

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
      setFeedbackError('Enter or paste a valid URL.');
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
      setFeedbackError('Could not save URL. Check the domain format.');
    }
  };

  return (
    <div
      data-testid={`empty-lane-${group.id}`}
      className={`rounded-md border border-dashed transition-colors p-3 space-y-2.5 ${
        isDragOver
          ? `${style.badgeBg} border-current`
          : 'border-zinc-800/90 bg-zinc-950/60 hover:border-zinc-700/90'
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
          <p className="text-xs font-medium text-zinc-200 truncate">
            No links in {group.name}
          </p>
          <p className="text-[11px] text-zinc-500 truncate">
            Add a new link or drag a tab into this group
          </p>
        </div>
      </div>

      {/* Dual Action Controls: Clipboard Quick-Paste + Preselected Modal Button */}
      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="button"
          disabled={isSaving}
          onClick={handleClipboardPaste}
          aria-label={`Paste URL into ${group.name}`}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 hover:text-zinc-100 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-500"
        >
          {isSaving ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <ClipboardPaste className="w-3 h-3 text-zinc-400" />
          )}
          <span>Paste URL</span>
        </button>

        <button
          type="button"
          disabled={isSaving}
          onClick={() => onAddViaModal(group.id)}
          aria-label={`Add new link to ${group.name}`}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold border rounded transition-opacity hover:opacity-90 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-500 ${style.badgeBg} ${style.badgeText}`}
        >
          <Plus className="w-3 h-3" />
          <span>Add Link</span>
        </button>
      </div>

      {/* Compact Single-Line Fallback URL Input (when Paste URL is clicked or clipboard requires manual paste) */}
      {showInlineInput && (
        <form
          onSubmit={handleInlineSubmit}
          className="pt-2 border-t border-zinc-800/80 flex items-center gap-1.5"
        >
          <input
            type="text"
            value={inlineUrl}
            onChange={(e) => setInlineUrl(e.target.value)}
            aria-label={`Quick URL input for ${group.name}`}
            placeholder="https://example.com/article..."
            autoFocus
            className="flex-1 min-w-0 px-2.5 py-1 text-xs bg-zinc-900 border border-zinc-800 rounded text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-sky-500"
          />
          <button
            type="submit"
            disabled={isSaving}
            aria-label={`Save quick link to ${group.name}`}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-zinc-100 hover:bg-white text-zinc-950 rounded transition-colors whitespace-nowrap shrink-0"
          >
            {isSaving ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Check className="w-3 h-3" />
            )}
            <span>Save</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setShowInlineInput(false);
              setFeedbackError(null);
            }}
            aria-label="Cancel quick paste"
            className="p-1 text-zinc-500 hover:text-zinc-300 rounded hover:bg-zinc-900"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </form>
      )}

      {feedbackError && (
        <p role="alert" className="text-[11px] text-rose-400">
          {feedbackError}
        </p>
      )}
    </div>
  );
}
