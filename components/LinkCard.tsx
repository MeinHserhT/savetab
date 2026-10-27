'use client';

import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Globe,
  Trash2,
} from 'lucide-react';
import { Folder, LinkItem, LinkStatus } from '@/lib/types';

interface LinkCardProps {
  link: LinkItem;
  folders: Folder[];
  isFirstInLane: boolean;
  isLastInLane: boolean;
  onMoveStatus: (linkId: string, targetStatus: LinkStatus) => void;
  onMoveOrder: (linkId: string, status: LinkStatus, newIndex: number) => void;
  onDelete: (linkId: string) => void;
  onDragStart: (e: React.DragEvent<HTMLElement>, link: LinkItem) => void;
}

const LANE_OPTIONS: { status: LinkStatus; label: string }[] = [
  { status: LinkStatus.UNREAD, label: 'Unread' },
  { status: LinkStatus.READING, label: 'Reading' },
  { status: LinkStatus.ARCHIVED, label: 'Archived' },
];

export function LinkCard({
  link,
  folders,
  isFirstInLane,
  isLastInLane,
  onMoveStatus,
  onMoveOrder,
  onDelete,
  onDragStart,
}: LinkCardProps) {
  const [coverFailed, setCoverFailed] = useState(false);
  const [faviconFailed, setFaviconFailed] = useState(false);

  const folderName = folders.find((f) => f.id === link.folder_id)?.name ?? null;
  const showCoverImage = Boolean(link.image_url && !coverFailed);

  return (
    <article
      draggable
      onDragStart={(e) => onDragStart(e, link)}
      aria-label={link.title}
      className="group bg-zinc-900/75 hover:bg-zinc-900 border border-zinc-800/90 hover:border-zinc-700 rounded-lg overflow-hidden transition-colors duration-150 flex flex-col cursor-grab active:cursor-grabbing focus-within:ring-2 focus-within:ring-sky-500"
    >
      {/* Fixed 16:9 Aspect-Ratio Preview Frame (Zero CLS) */}
      <div className="relative w-full aspect-video bg-zinc-950 border-b border-zinc-800/80 overflow-hidden shrink-0">
        {showCoverImage ? (
          <img
            src={link.image_url!}
            alt={`Cover preview for ${link.title}`}
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={() => setCoverFailed(true)}
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.015]"
          />
        ) : (
          /* Deterministic Swiss Minimalist Architectural Fallback (Zero-Broken-Image Policy) */
          <div
            data-testid={`fallback-cover-${link.id}`}
            className="w-full h-full bg-zinc-950 flex flex-col justify-between p-3.5 select-none relative overflow-hidden"
          >
            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-20 pointer-events-none"
              style={{
                backgroundImage:
                  'linear-gradient(to right, #27272a 1px, transparent 1px), linear-gradient(to bottom, #27272a 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            />
            <div className="relative z-10 flex items-center justify-between text-[11px] font-mono text-zinc-500">
              <span>{link.domain}</span>
              <span className="tabular-nums">{link.reading_minutes}m</span>
            </div>
            <div className="relative z-10 space-y-0.5">
              <p className="text-xs font-medium text-zinc-300 line-clamp-1">
                {link.title}
              </p>
              <p className="text-[11px] font-mono text-zinc-500">
                {link.scrape_status === 'degraded'
                  ? 'Defensive fallback preview'
                  : 'Text-only reference'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Card Content Body */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-2">
          {/* Unboxed Metadata Line (Zero-Pill Discipline) */}
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 min-w-0">
            <span className="w-4 h-4 rounded-sm bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden">
              {!faviconFailed && link.favicon ? (
                <img
                  src={link.favicon}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={() => setFaviconFailed(true)}
                  className="w-3.5 h-3.5 object-contain"
                />
              ) : (
                <Globe className="w-3 h-3 text-zinc-400" />
              )}
            </span>
            <span className="font-mono text-[11px] text-zinc-200 whitespace-nowrap shrink-0">
              {link.domain}
            </span>
            <span aria-hidden="true" className="text-zinc-600 shrink-0">
              ·
            </span>
            <span className="font-mono text-[11px] tabular-nums whitespace-nowrap shrink-0">
              {link.reading_minutes} min
            </span>
            {folderName && (
              <>
                <span aria-hidden="true" className="text-zinc-600 shrink-0">
                  ·
                </span>
                <span className="text-[11px] text-zinc-400 truncate min-w-0">
                  {folderName}
                </span>
              </>
            )}
          </div>

          {/* Primary Title */}
          <h3 className="text-[15px] font-semibold tracking-normal text-zinc-100 leading-snug line-clamp-2">
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-sky-400 transition-colors focus-visible:outline-none focus-visible:underline"
            >
              {link.title}
            </a>
          </h3>

          {/* Description */}
          <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
            {link.description}
          </p>
        </div>

        {/* Unboxed Tags & Action Footer */}
        <div className="pt-2.5 border-t border-zinc-800/80 space-y-2.5">
          {link.tags.length > 0 && (
            <div className="flex items-center flex-wrap gap-1 text-[11px] font-mono text-zinc-500">
              {link.tags.map((tag, index) => (
                <React.Fragment key={tag}>
                  {index > 0 && <span aria-hidden="true">·</span>}
                  <span>#{tag}</span>
                </React.Fragment>
              ))}
            </div>
          )}

          {/* Accessible State Transition & Reorder Controls */}
          <div className="flex items-center justify-between gap-2">
            <div
              role="group"
              aria-label={`Set status for ${link.title}`}
              className="inline-flex items-center p-0.5 rounded bg-zinc-950 border border-zinc-800/90"
            >
              {LANE_OPTIONS.map((option) => {
                const isCurrent = link.status === option.status;
                return (
                  <button
                    key={option.status}
                    type="button"
                    onClick={() => {
                      if (!isCurrent) {
                        onMoveStatus(link.id, option.status);
                      }
                    }}
                    aria-pressed={isCurrent}
                    aria-label={`Move ${link.title} to ${option.label}`}
                    className={`px-2 py-1 text-[11px] font-medium rounded-sm transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-500 ${
                      isCurrent
                        ? 'bg-zinc-800 text-zinc-100'
                        : 'text-zinc-500 hover:text-zinc-200'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                disabled={isFirstInLane}
                onClick={() =>
                  onMoveOrder(
                    link.id,
                    link.status,
                    Math.max(0, link.order_index - 1)
                  )
                }
                aria-label={`Move ${link.title} up`}
                className="p-1 text-zinc-500 hover:text-zinc-200 disabled:opacity-30 disabled:pointer-events-none rounded hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-500"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={isLastInLane}
                onClick={() =>
                  onMoveOrder(link.id, link.status, link.order_index + 1)
                }
                aria-label={`Move ${link.title} down`}
                className="p-1 text-zinc-500 hover:text-zinc-200 disabled:opacity-30 disabled:pointer-events-none rounded hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-500"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${link.title} in new tab`}
                className="p-1 text-zinc-500 hover:text-zinc-200 rounded hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-500"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={() => onDelete(link.id)}
                aria-label={`Delete ${link.title}`}
                className="p-1 text-zinc-500 hover:text-rose-400 rounded hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
