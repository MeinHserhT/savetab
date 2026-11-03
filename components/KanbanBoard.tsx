'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  FolderPlus,
  Globe,
  GripVertical,
  Hash,
  Image as ImageIcon,
  LayoutGrid,
  List,
  MoreVertical,
  Play,
  Plus,
  X,
} from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useLinkStore } from '@/store/useLinkStore';
import { useThemeStore } from '@/store/useThemeStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useWorkspaceDnd } from '@/components/WorkspaceDndProvider';
import {
  clusterGroupLinksBySource,
  filterLinks,
  isYouTubeLink,
  resolveYouTubeChannelFromLink,
  sortGroupLinks,
  TabSubGroup,
} from '@/lib/kanban-rules';
import {
  Folder,
  LinkItem,
  LinkStatus,
  TAB_GROUP_COLORS,
  TabGroupColor,
} from '@/lib/types';
import { ThemeMode } from '@/lib/theme';
import { EmptyLaneState } from '@/components/EmptyLaneState';
import {
  inferDefaultGroupName,
  parseTabGroupFromDataTransfer,
  parseTabGroupFromTextOrHtml,
  pickNextTabGroupColor,
} from '@/lib/tab-group-drop';
import { containsCJK } from '@/lib/cjk-translate';

interface KanbanBoardProps {
  onOpenAddModal: (defaultStatus?: LinkStatus, defaultFolderId?: string) => void;
  onOpenImportModal?: () => void;
}

export interface TabGroupStyleEntry {
  label: string;
  dot: string;
  badgeBg: string;
  badgeText: string;
  topBar: string;
  borderHover: string;
}

export const TAB_GROUP_STYLES: Record<TabGroupColor, TabGroupStyleEntry> = {
  // Row 1: Warm Spectrum (Deep Red -> Bright Red -> Coral -> Orange -> Amber -> Yellow)
  crimson: {
    label: 'Crimson',
    dot: 'bg-[#B91C1C]',
    badgeBg: 'bg-[#B91C1C]/30 border-[#DC2626]/60',
    badgeText: 'text-red-200',
    topBar: 'bg-[#B91C1C]',
    borderHover: 'hover:border-[#DC2626]/70',
  },
  red: {
    label: 'Red',
    dot: 'bg-[#FF3B30]',
    badgeBg: 'bg-[#FF3B30]/20 border-[#FF3B30]/50',
    badgeText: 'text-red-200',
    topBar: 'bg-[#FF3B30]',
    borderHover: 'hover:border-[#FF3B30]/65',
  },
  coral: {
    label: 'Coral',
    dot: 'bg-[#FF6B4A]',
    badgeBg: 'bg-[#FF6B4A]/20 border-[#FF6B4A]/50',
    badgeText: 'text-orange-200',
    topBar: 'bg-[#FF6B4A]',
    borderHover: 'hover:border-[#FF6B4A]/65',
  },
  orange: {
    label: 'Orange',
    dot: 'bg-[#FF8C00]',
    badgeBg: 'bg-[#FF8C00]/20 border-[#FF8C00]/50',
    badgeText: 'text-orange-200',
    topBar: 'bg-[#FF8C00]',
    borderHover: 'hover:border-[#FF8C00]/65',
  },
  amber: {
    label: 'Amber',
    dot: 'bg-[#FFB300]',
    badgeBg: 'bg-[#FFB300]/20 border-[#FFB300]/50',
    badgeText: 'text-amber-200',
    topBar: 'bg-[#FFB300]',
    borderHover: 'hover:border-[#FFB300]/65',
  },
  yellow: {
    label: 'Yellow',
    dot: 'bg-[#FFE600]',
    badgeBg: 'bg-[#FFE600]/20 border-[#FFE600]/50',
    badgeText: 'text-yellow-100',
    topBar: 'bg-[#FFE600]',
    borderHover: 'hover:border-[#FFE600]/65',
  },

  // Row 2: Green -> Teal -> Cyan Spectrum (Opposing Warm Row 1)
  lime: {
    label: 'Lime',
    dot: 'bg-[#A3E635]',
    badgeBg: 'bg-[#A3E635]/20 border-[#A3E635]/50',
    badgeText: 'text-lime-200',
    topBar: 'bg-[#A3E635]',
    borderHover: 'hover:border-[#A3E635]/65',
  },
  green: {
    label: 'Forest Green',
    dot: 'bg-[#22C55E]',
    badgeBg: 'bg-[#22C55E]/20 border-[#22C55E]/50',
    badgeText: 'text-green-200',
    topBar: 'bg-[#22C55E]',
    borderHover: 'hover:border-[#22C55E]/65',
  },
  emerald: {
    label: 'Emerald',
    dot: 'bg-[#059669]',
    badgeBg: 'bg-[#059669]/25 border-[#10B981]/50',
    badgeText: 'text-emerald-200',
    topBar: 'bg-[#059669]',
    borderHover: 'hover:border-[#10B981]/65',
  },
  mint: {
    label: 'Mint',
    dot: 'bg-[#2DD4BF]',
    badgeBg: 'bg-[#2DD4BF]/20 border-[#2DD4BF]/50',
    badgeText: 'text-teal-100',
    topBar: 'bg-[#2DD4BF]',
    borderHover: 'hover:border-[#2DD4BF]/65',
  },
  teal: {
    label: 'Teal',
    dot: 'bg-[#0D9488]',
    badgeBg: 'bg-[#0D9488]/25 border-[#14B8A6]/50',
    badgeText: 'text-teal-200',
    topBar: 'bg-[#0D9488]',
    borderHover: 'hover:border-[#14B8A6]/65',
  },
  cyan: {
    label: 'Cyan',
    dot: 'bg-[#00D4FF]',
    badgeBg: 'bg-[#00D4FF]/20 border-[#00D4FF]/50',
    badgeText: 'text-cyan-100',
    topBar: 'bg-[#00D4FF]',
    borderHover: 'hover:border-[#00D4FF]/65',
  },

  // Row 3: Blue -> Indigo -> Violet -> Purple -> Fuchsia Spectrum (Opposing Yellows/Greens)
  blue: {
    label: 'Sky Blue',
    dot: 'bg-[#38BDF8]',
    badgeBg: 'bg-[#38BDF8]/20 border-[#38BDF8]/50',
    badgeText: 'text-sky-200',
    topBar: 'bg-[#38BDF8]',
    borderHover: 'hover:border-[#38BDF8]/65',
  },
  ocean: {
    label: 'Ocean Blue',
    dot: 'bg-[#2563EB]',
    badgeBg: 'bg-[#2563EB]/25 border-[#3B82F6]/55',
    badgeText: 'text-blue-200',
    topBar: 'bg-[#2563EB]',
    borderHover: 'hover:border-[#3B82F6]/65',
  },
  indigo: {
    label: 'Indigo',
    dot: 'bg-[#4F46E5]',
    badgeBg: 'bg-[#4F46E5]/25 border-[#6366F1]/55',
    badgeText: 'text-indigo-200',
    topBar: 'bg-[#4F46E5]',
    borderHover: 'hover:border-[#6366F1]/65',
  },
  violet: {
    label: 'Violet',
    dot: 'bg-[#7C3AED]',
    badgeBg: 'bg-[#7C3AED]/25 border-[#8B5CF6]/55',
    badgeText: 'text-violet-200',
    topBar: 'bg-[#7C3AED]',
    borderHover: 'hover:border-[#8B5CF6]/65',
  },
  purple: {
    label: 'Purple',
    dot: 'bg-[#A855F7]',
    badgeBg: 'bg-[#A855F7]/20 border-[#A855F7]/50',
    badgeText: 'text-purple-200',
    topBar: 'bg-[#A855F7]',
    borderHover: 'hover:border-[#A855F7]/65',
  },
  fuchsia: {
    label: 'Fuchsia',
    dot: 'bg-[#E81CFF]',
    badgeBg: 'bg-[#E81CFF]/20 border-[#E81CFF]/50',
    badgeText: 'text-fuchsia-200',
    topBar: 'bg-[#E81CFF]',
    borderHover: 'hover:border-[#E81CFF]/65',
  },

  // Row 4: Rose -> Pink & Contrasting Metallics / Neutrals
  rose: {
    label: 'Rose',
    dot: 'bg-[#F43F5E]',
    badgeBg: 'bg-[#F43F5E]/20 border-[#F43F5E]/50',
    badgeText: 'text-rose-200',
    topBar: 'bg-[#F43F5E]',
    borderHover: 'hover:border-[#F43F5E]/65',
  },
  pink: {
    label: 'Soft Pink',
    dot: 'bg-[#FF7EB6]',
    badgeBg: 'bg-[#FF7EB6]/20 border-[#FF7EB6]/50',
    badgeText: 'text-pink-200',
    topBar: 'bg-[#FF7EB6]',
    borderHover: 'hover:border-[#FF7EB6]/65',
  },
  gold: {
    label: 'Gold',
    dot: 'bg-[#D4AF37]',
    badgeBg: 'bg-[#D4AF37]/25 border-[#D4AF37]/55',
    badgeText: 'text-amber-100',
    topBar: 'bg-[#D4AF37]',
    borderHover: 'hover:border-[#D4AF37]/65',
  },
  bronze: {
    label: 'Bronze',
    dot: 'bg-[#A0522D]',
    badgeBg: 'bg-[#A0522D]/25 border-[#C08457]/55',
    badgeText: 'text-orange-200',
    topBar: 'bg-[#A0522D]',
    borderHover: 'hover:border-[#C08457]/65',
  },
  slate: {
    label: 'Slate',
    dot: 'bg-[#475569]',
    badgeBg: 'bg-[#475569]/30 border-[#64748B]/55',
    badgeText: 'text-slate-200',
    topBar: 'bg-[#475569]',
    borderHover: 'hover:border-[#64748B]/65',
  },
  zinc: {
    label: 'Warm Grey',
    dot: 'bg-[#9CA3AF]',
    badgeBg: 'bg-[#9CA3AF]/20 border-[#9CA3AF]/50',
    badgeText: 'text-zinc-200',
    topBar: 'bg-[#9CA3AF]',
    borderHover: 'hover:border-[#9CA3AF]/65',
  },
};

export const LIGHT_TAB_GROUP_STYLES: Record<TabGroupColor, TabGroupStyleEntry> = {
  // Row 1: Warm Spectrum
  crimson: {
    label: 'Crimson',
    dot: 'bg-[#991B1B]',
    badgeBg: 'bg-[#991B1B]/15 border-[#991B1B]/40',
    badgeText: 'text-red-950',
    topBar: 'bg-[#991B1B]',
    borderHover: 'hover:border-[#991B1B]/65',
  },
  red: {
    label: 'Red',
    dot: 'bg-[#EF4444]',
    badgeBg: 'bg-[#EF4444]/15 border-[#DC2626]/40',
    badgeText: 'text-red-800',
    topBar: 'bg-[#EF4444]',
    borderHover: 'hover:border-[#EF4444]/65',
  },
  coral: {
    label: 'Coral',
    dot: 'bg-[#FF6B4A]',
    badgeBg: 'bg-[#FF6B4A]/15 border-[#F0564A]/40',
    badgeText: 'text-red-900',
    topBar: 'bg-[#FF6B4A]',
    borderHover: 'hover:border-[#FF6B4A]/65',
  },
  orange: {
    label: 'Orange',
    dot: 'bg-[#F97316]',
    badgeBg: 'bg-[#F97316]/15 border-[#EA580C]/40',
    badgeText: 'text-orange-900',
    topBar: 'bg-[#F97316]',
    borderHover: 'hover:border-[#F97316]/65',
  },
  amber: {
    label: 'Amber',
    dot: 'bg-[#F59E0B]',
    badgeBg: 'bg-[#F59E0B]/15 border-[#D97706]/40',
    badgeText: 'text-amber-900',
    topBar: 'bg-[#F59E0B]',
    borderHover: 'hover:border-[#F59E0B]/65',
  },
  yellow: {
    label: 'Yellow',
    dot: 'bg-[#EAB308]',
    badgeBg: 'bg-[#FACC15]/20 border-[#CA8A04]/45',
    badgeText: 'text-yellow-950',
    topBar: 'bg-[#EAB308]',
    borderHover: 'hover:border-[#EAB308]/65',
  },

  // Row 2: Green -> Cyan Spectrum
  lime: {
    label: 'Lime',
    dot: 'bg-[#84CC16]',
    badgeBg: 'bg-[#84CC16]/15 border-[#65A30D]/40',
    badgeText: 'text-lime-900',
    topBar: 'bg-[#84CC16]',
    borderHover: 'hover:border-[#84CC16]/65',
  },
  green: {
    label: 'Forest Green',
    dot: 'bg-[#16A34A]',
    badgeBg: 'bg-[#16A34A]/15 border-[#15803D]/40',
    badgeText: 'text-green-900',
    topBar: 'bg-[#16A34A]',
    borderHover: 'hover:border-[#16A34A]/65',
  },
  emerald: {
    label: 'Emerald',
    dot: 'bg-[#047857]',
    badgeBg: 'bg-[#047857]/15 border-[#047857]/40',
    badgeText: 'text-emerald-950',
    topBar: 'bg-[#047857]',
    borderHover: 'hover:border-[#047857]/65',
  },
  mint: {
    label: 'Mint',
    dot: 'bg-[#14B8A6]',
    badgeBg: 'bg-[#14B8A6]/15 border-[#0D9488]/40',
    badgeText: 'text-teal-900',
    topBar: 'bg-[#14B8A6]',
    borderHover: 'hover:border-[#14B8A6]/65',
  },
  teal: {
    label: 'Teal',
    dot: 'bg-[#0F766E]',
    badgeBg: 'bg-[#0F766E]/15 border-[#0F766E]/40',
    badgeText: 'text-teal-950',
    topBar: 'bg-[#0F766E]',
    borderHover: 'hover:border-[#0F766E]/65',
  },
  cyan: {
    label: 'Cyan',
    dot: 'bg-[#06B6D4]',
    badgeBg: 'bg-[#06B6D4]/15 border-[#0891B2]/40',
    badgeText: 'text-cyan-900',
    topBar: 'bg-[#06B6D4]',
    borderHover: 'hover:border-[#06B6D4]/65',
  },

  // Row 3: Blue -> Purple -> Fuchsia Spectrum
  blue: {
    label: 'Sky Blue',
    dot: 'bg-[#0EA5E9]',
    badgeBg: 'bg-[#0EA5E9]/15 border-[#0284C7]/40',
    badgeText: 'text-sky-900',
    topBar: 'bg-[#0EA5E9]',
    borderHover: 'hover:border-[#0EA5E9]/65',
  },
  ocean: {
    label: 'Ocean Blue',
    dot: 'bg-[#1D4ED8]',
    badgeBg: 'bg-[#1D4ED8]/15 border-[#1E40AF]/40',
    badgeText: 'text-blue-950',
    topBar: 'bg-[#1D4ED8]',
    borderHover: 'hover:border-[#1D4ED8]/65',
  },
  indigo: {
    label: 'Indigo',
    dot: 'bg-[#4338CA]',
    badgeBg: 'bg-[#4338CA]/15 border-[#3730A3]/40',
    badgeText: 'text-indigo-950',
    topBar: 'bg-[#4338CA]',
    borderHover: 'hover:border-[#4338CA]/65',
  },
  violet: {
    label: 'Violet',
    dot: 'bg-[#6D28D9]',
    badgeBg: 'bg-[#6D28D9]/15 border-[#5B21B6]/40',
    badgeText: 'text-violet-950',
    topBar: 'bg-[#6D28D9]',
    borderHover: 'hover:border-[#6D28D9]/65',
  },
  purple: {
    label: 'Purple',
    dot: 'bg-[#9333EA]',
    badgeBg: 'bg-[#9333EA]/15 border-[#7E22CE]/40',
    badgeText: 'text-purple-900',
    topBar: 'bg-[#9333EA]',
    borderHover: 'hover:border-[#9333EA]/65',
  },
  fuchsia: {
    label: 'Fuchsia',
    dot: 'bg-[#D946EF]',
    badgeBg: 'bg-[#D946EF]/15 border-[#C026D3]/40',
    badgeText: 'text-fuchsia-900',
    topBar: 'bg-[#D946EF]',
    borderHover: 'hover:border-[#D946EF]/65',
  },

  // Row 4: Rose -> Pink & Contrasting Metallics / Neutrals
  rose: {
    label: 'Rose',
    dot: 'bg-[#E11D48]',
    badgeBg: 'bg-[#E11D48]/15 border-[#BE123C]/40',
    badgeText: 'text-rose-900',
    topBar: 'bg-[#E11D48]',
    borderHover: 'hover:border-[#E11D48]/65',
  },
  pink: {
    label: 'Soft Pink',
    dot: 'bg-[#F472B6]',
    badgeBg: 'bg-[#F472B6]/15 border-[#DB2777]/40',
    badgeText: 'text-pink-900',
    topBar: 'bg-[#F472B6]',
    borderHover: 'hover:border-[#F472B6]/65',
  },
  gold: {
    label: 'Gold',
    dot: 'bg-[#B8860B]',
    badgeBg: 'bg-[#B8860B]/15 border-[#9A6E08]/40',
    badgeText: 'text-yellow-950',
    topBar: 'bg-[#B8860B]',
    borderHover: 'hover:border-[#B8860B]/65',
  },
  bronze: {
    label: 'Bronze',
    dot: 'bg-[#8B4513]',
    badgeBg: 'bg-[#8B4513]/15 border-[#7C3F11]/40',
    badgeText: 'text-amber-950',
    topBar: 'bg-[#8B4513]',
    borderHover: 'hover:border-[#8B4513]/65',
  },
  slate: {
    label: 'Slate',
    dot: 'bg-[#334155]',
    badgeBg: 'bg-[#334155]/15 border-[#334155]/40',
    badgeText: 'text-slate-900',
    topBar: 'bg-[#334155]',
    borderHover: 'hover:border-[#334155]/65',
  },
  zinc: {
    label: 'Warm Grey',
    dot: 'bg-[#71717A]',
    badgeBg: 'bg-[#71717A]/15 border-[#52525B]/40',
    badgeText: 'text-zinc-800',
    topBar: 'bg-[#71717A]',
    borderHover: 'hover:border-[#71717A]/65',
  },
};

export function getTabGroupStyles(
  mode: ThemeMode
): Record<TabGroupColor, TabGroupStyleEntry> {
  return mode === 'light' ? LIGHT_TAB_GROUP_STYLES : TAB_GROUP_STYLES;
}

export const COLOR_KEYS: TabGroupColor[] = [...TAB_GROUP_COLORS];

function isUnresolvedYouTubeUrlAndTitle(url: string, title: string): boolean {
  const lowerUrl = url.toLowerCase();
  const isYt =
    lowerUrl.includes('youtube.com/') || lowerUrl.includes('youtu.be/');
  if (!isYt) return false;
  const normalizedTitle = title.trim().toLowerCase();
  return (
    !normalizedTitle ||
    normalizedTitle === '- youtube' ||
    normalizedTitle === 'youtube' ||
    normalizedTitle === 'watch - youtube' ||
    normalizedTitle === 'watch — youtube.com' ||
    normalizedTitle.startsWith('youtube clip (') ||
    normalizedTitle === 'before you continue to youtube'
  );
}

function isVideoUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes('youtube.com/watch') ||
    lower.includes('youtube.com/shorts/') ||
    lower.includes('youtube.com/live/') ||
    lower.includes('youtube.com/embed/') ||
    lower.includes('youtube.com/v/') ||
    lower.includes('youtu.be/') ||
    lower.includes('vimeo.com/') ||
    lower.includes('dailymotion.com/video') ||
    lower.includes('loom.com/share/') ||
    /\.(mp4|webm|mov)(\?|$)/i.test(lower)
  );
}

function extractYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return id && id.length >= 6 ? id : null;
    }
    if (host.includes('youtube.com')) {
      const v = parsed.searchParams.get('v');
      if (v) return v;
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (
        (parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live' || parts[0] === 'v') &&
        parts[1]
      ) {
        return parts[1];
      }
    }
  } catch {
    // Ignore invalid URLs
  }
  return null;
}

const attemptedImageScrapeIds = new Set<string>();

function FolderDroppableWrapper({
  group,
  className,
  onClick,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
}: {
  group: Folder;
  className: string;
  onClick: () => void;
  onDragOver: (e: React.DragEvent<HTMLElement>) => void;
  onDragLeave: (e: React.DragEvent<HTMLElement>) => void;
  onDrop: (e: React.DragEvent<HTMLElement>) => void;
  children: React.ReactNode;
}) {
  const { t } = useLanguageStore();
  const { setNodeRef } = useDroppable({
    id: `folder-col:${group.id}`,
    data: { type: 'folder', folderId: group.id, folder: group },
  });

  return (
    <section
      ref={setNodeRef}
      id={`tab-group-col-${group.id}`}
      aria-label={t.board.tabGroupAria(group.name)}
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={className}
    >
      {children}
    </section>
  );
}

function BottomNavFolderButton({
  group,
  style,
  count,
  isSelected,
  isNativeDropTarget,
  onClick,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  group: Folder;
  style: TabGroupStyleEntry;
  count: number;
  isSelected: boolean;
  isNativeDropTarget: boolean;
  onClick: () => void;
  onDragOver: (e: React.DragEvent<HTMLElement>) => void;
  onDragLeave: (e: React.DragEvent<HTMLElement>) => void;
  onDrop: (e: React.DragEvent<HTMLElement>) => void;
}) {
  const { activeLink, overFolderId } = useWorkspaceDnd();
  const { setNodeRef, isOver } = useDroppable({
    id: `bottom-folder:${group.id}`,
    data: { type: 'folder', folderId: group.id, folder: group },
  });

  const isDropTarget =
    isNativeDropTarget ||
    (Boolean(activeLink) && (isOver || overFolderId === group.id));

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md text-[11px] font-medium transition-all whitespace-nowrap shrink-0 border ${
        isDropTarget
          ? 'border-[var(--tf-accent)] bg-[var(--tf-accent-soft)] text-[var(--tf-text)] scale-[1.02] ring-1 ring-[var(--tf-accent)]'
          : isSelected
          ? `${style.badgeBg} ${style.badgeText}`
          : 'border-transparent text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-surface)]'
      }`}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
      <span className="max-w-[110px] sm:max-w-[140px] truncate">
        {group.name}
      </span>
      <span className="font-mono text-[10px] tabular-nums opacity-75">
        {count}
      </span>
    </button>
  );
}

function TabLinkRow({
  link,
  groupId,
  cardDensity = 'rich',
  isDragging,
  isHighlighted,
  dropPosition,
  onUpdateLinkMeta,
  onDelete,
  onDragStart,
  onDragEnd,
  onDragOverLink,
  onDropOnLink,
}: {
  link: LinkItem;
  groupId: string;
  cardDensity?: 'rich' | 'compact';
  isDragging: boolean;
  isHighlighted?: boolean;
  dropPosition: 'before' | 'after' | null;
  onUpdateLinkMeta: (
    linkId: string,
    patch: Partial<
      Pick<
        LinkItem,
        | 'title'
        | 'description'
        | 'image_url'
        | 'reading_minutes'
        | 'video_duration'
        | 'channel_name'
      >
    >
  ) => void;
  onDelete: (linkId: string) => void;
  onDragStart: (e: React.DragEvent<HTMLElement>, link: LinkItem) => void;
  onDragEnd: () => void;
  onDragOverLink: (
    e: React.DragEvent<HTMLElement>,
    targetLink: LinkItem,
    groupId: string
  ) => void;
  onDropOnLink: (
    e: React.DragEvent<HTMLElement>,
    targetLink: LinkItem,
    groupId: string
  ) => void;
}) {
  const [faviconFailed, setFaviconFailed] = useState(false);
  const [coverImageFailed, setCoverImageFailed] = useState(false);
  const [screenshotFailed, setScreenshotFailed] = useState(false);
  const [resolvedDuration, setResolvedDuration] = useState<string | null>(
    link.video_duration ?? null
  );
  const [resolvedChannel, setResolvedChannel] = useState<string | null>(() =>
    resolveYouTubeChannelFromLink(link)
  );
  const { t } = useLanguageStore();
  const { activeLink, overLinkId, overPosition } = useWorkspaceDnd();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isDndDragging,
  } = useSortable({
    id: link.id,
    data: {
      type: 'link',
      link,
      groupId,
    },
  });

  const effectiveIsDragging = isDragging || isDndDragging;
  const effectiveDropPosition =
    dropPosition ??
    (activeLink && activeLink.id !== link.id && overLinkId === link.id
      ? overPosition
      : null);

  const sortableStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const effectiveVideoDuration = link.video_duration || resolvedDuration;
  const effectiveChannelName =
    resolveYouTubeChannelFromLink(link) || resolvedChannel;
  const isYt = isYouTubeLink(link.url, link.domain);
  const ytVideoId = useMemo(() => extractYouTubeVideoId(link.url), [link.url]);
  const needsTitle = isUnresolvedYouTubeUrlAndTitle(link.url, link.title);
  const needsVideoDuration = isVideoUrl(link.url) && !effectiveVideoDuration;
  const needsYouTubeChannel = isYt && !effectiveChannelName;
  const needsCoverImage =
    !link.image_url && !ytVideoId && !attemptedImageScrapeIds.has(link.id);
  const needsCJKTranslation = !needsTitle && containsCJK(link.title);

  React.useEffect(() => {
    setCoverImageFailed(false);
    setScreenshotFailed(false);
  }, [link.image_url, link.url]);

  React.useEffect(() => {
    if (!needsCJKTranslation) return;
    let cancelled = false;
    fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: link.title }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.translatedTitle) return;
        const translated = String(data.translatedTitle).trim();
        if (translated && translated !== link.title) {
          onUpdateLinkMeta(link.id, { title: translated });
        }
      })
      .catch(() => {
        // Ignore background translation errors
      });
    return () => {
      cancelled = true;
    };
  }, [link.id, link.title, needsCJKTranslation, onUpdateLinkMeta]);

  React.useEffect(() => {
    if (
      !needsTitle &&
      !needsVideoDuration &&
      !needsYouTubeChannel &&
      !needsCoverImage
    ) {
      return;
    }
    attemptedImageScrapeIds.add(link.id);
    let cancelled = false;
    fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: link.url }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.metadata) return;
        const patch: Partial<
          Pick<
            LinkItem,
            | 'title'
            | 'description'
            | 'image_url'
            | 'reading_minutes'
            | 'video_duration'
            | 'channel_name'
          >
        > = {};
        if ((needsTitle || containsCJK(link.title)) && data.metadata.title) {
          const resolvedTitle = String(data.metadata.title).trim();
          if (resolvedTitle && resolvedTitle !== link.title) {
            patch.title = resolvedTitle;
          }
        }
        if (!link.image_url && data.metadata.image_url) {
          patch.image_url = String(data.metadata.image_url);
        }
        if (data.metadata.video_duration) {
          const dur = String(data.metadata.video_duration);
          setResolvedDuration(dur);
          patch.video_duration = dur;
          if (typeof data.metadata.reading_minutes === 'number') {
            patch.reading_minutes = data.metadata.reading_minutes;
          }
        }
        const scrapedChannel =
          typeof data.metadata.channel_name === 'string' &&
          data.metadata.channel_name.trim()
            ? data.metadata.channel_name.trim()
            : resolveYouTubeChannelFromLink({
                url: link.url,
                domain: link.domain,
                channel_name: data.metadata.channel_name,
                description: data.metadata.description,
              });
        if (scrapedChannel) {
          setResolvedChannel(scrapedChannel);
          if (scrapedChannel !== link.channel_name) {
            patch.channel_name = scrapedChannel;
          }
          if (
            typeof data.metadata.description === 'string' &&
            data.metadata.description.trim() &&
            data.metadata.description !== link.description
          ) {
            patch.description = data.metadata.description;
          }
        }
        if (Object.keys(patch).length > 0) {
          onUpdateLinkMeta(link.id, patch);
        }
      })
      .catch(() => {
        // Ignore background metadata repair errors
      });
    return () => {
      cancelled = true;
    };
  }, [
    link.id,
    link.url,
    link.domain,
    link.title,
    link.image_url,
    link.channel_name,
    link.description,
    needsTitle,
    needsVideoDuration,
    needsYouTubeChannel,
    needsCoverImage,
    onUpdateLinkMeta,
  ]);

  const faviconUrl =
    link.favicon ||
    (link.domain
      ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
          link.domain
        )}&sz=32`
      : '');

  const rowRef = useRef<HTMLElement | null>(null);
  const [hoverRect, setHoverRect] = useState<{
    top: number;
    bottom: number;
    left: number;
    width: number;
    placeAbove: boolean;
  } | null>(null);

  const updateHoverPosition = useCallback(() => {
    if (effectiveIsDragging) return;
    const el = rowRef.current;
    if (!el || typeof window === 'undefined') return;
    const rect = el.getBoundingClientRect();
    const cardWidth = Math.min(Math.max(rect.width, 250), 300);
    const maxLeft = Math.max(8, window.innerWidth - cardWidth - 8);
    const clampedLeft = Math.min(Math.max(8, rect.left), maxLeft);
    // Prefer showing the hover card below the tab unless near the very bottom of the viewport
    const placeAbove =
      window.innerHeight - rect.bottom < 220 && rect.top > 230;
    setHoverRect({
      top: rect.top,
      bottom: rect.bottom,
      left: clampedLeft,
      width: cardWidth,
      placeAbove,
    });
  }, [effectiveIsDragging]);

  useEffect(() => {
    if (!hoverRect) return;
    const handleScrollOrResize = () => {
      setHoverRect(null);
    };
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [hoverRect]);

  const cleanDomain = (link.domain || '').replace(/^www\./i, '');
  const domainLabel =
    isYt && effectiveChannelName ? effectiveChannelName : cleanDomain || link.domain;
  const readingEstimateText =
    effectiveVideoDuration ||
    t.board.readingEstimateLabel(link.reading_minutes || 5);

  const primaryImageUrl =
    link.image_url ||
    (ytVideoId ? `https://i.ytimg.com/vi/${ytVideoId}/hqdefault.jpg` : null);
  const screenshotFallbackUrl = `https://s.wordpress.com/mshots/v1/${encodeURIComponent(
    link.url
  )}?w=600&h=340`;
  const activePreviewImageUrl =
    primaryImageUrl && !coverImageFailed
      ? primaryImageUrl
      : !screenshotFailed
      ? screenshotFallbackUrl
      : null;

  return (
    <div ref={setNodeRef} style={sortableStyle} className="relative">
      {effectiveDropPosition === 'before' && (
        <div
          aria-hidden="true"
          data-testid={`link-drop-indicator-before-${link.id}`}
          className="pointer-events-none absolute -top-1 inset-x-0 z-30 flex items-center"
        >
          <span className="w-2 h-2 rounded-full bg-[var(--tf-accent)] shrink-0 -ml-0.5 shadow-xs" />
          <span className="h-0.5 flex-1 bg-[var(--tf-accent)] rounded-full shadow-xs" />
        </div>
      )}

      <article
        id={`tab-link-card-${link.id}`}
        ref={rowRef}
        {...attributes}
        {...listeners}
        data-testid={`tab-link-card-${link.id}`}
        draggable
        onDragStart={(e) => {
          setHoverRect(null);
          onDragStart(e, link);
        }}
        onDragEnd={onDragEnd}
        onDragOver={(e) => onDragOverLink(e, link, groupId)}
        onDrop={(e) => onDropOnLink(e, link, groupId)}
        onMouseEnter={updateHoverPosition}
        onMouseLeave={() => setHoverRect(null)}
        aria-label={link.title}
        className={`group relative rounded-md border transition-all duration-300 cursor-grab active:cursor-grabbing overflow-hidden focus:outline-none ${
          effectiveIsDragging
            ? 'opacity-40 scale-[0.98] border-dashed border-[var(--tf-accent)] bg-[var(--tf-accent-soft)]'
            : isHighlighted
            ? 'border-[var(--tf-accent)] ring-2 ring-[var(--tf-accent)] bg-[var(--tf-accent-soft)] shadow-lg scale-[1.01] z-10'
            : effectiveDropPosition
            ? 'border-[var(--tf-accent)] bg-[var(--tf-card-hover)]'
            : 'border-[var(--tf-border)] bg-[var(--tf-card)] hover:bg-[var(--tf-card-hover)] hover:border-[var(--tf-border-strong)]'
        }`}
      >
        {isHighlighted && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-[var(--tf-accent)] animate-pulse"
          />
        )}
        <div className="p-2.5 flex flex-col gap-2 text-[11px]">
          <div className="flex items-start justify-between gap-1.5">
            <span
              aria-hidden="true"
              className="mt-0.5 -ml-1 text-[var(--tf-text-muted)] opacity-45 group-hover:opacity-90 transition-opacity shrink-0"
            >
              <GripVertical className="w-3 h-3" />
            </span>

            {/* Favicon Placeholder + Title */}
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              draggable={false}
              className="flex items-start gap-2 min-w-0 flex-1 focus-visible:outline-none focus-visible:underline"
            >
              <span
                data-testid="link-favicon-slot"
                className="w-4 h-4 mt-0.5 rounded-xs bg-[var(--tf-surface)] border border-[var(--tf-border)] flex items-center justify-center shrink-0 overflow-hidden"
              >
                {!faviconFailed && faviconUrl ? (
                  <img
                    src={faviconUrl}
                    alt=""
                    draggable={false}
                    referrerPolicy="no-referrer"
                    onError={() => setFaviconFailed(true)}
                    className="w-3 h-3 object-contain"
                  />
                ) : (
                  <Globe className="w-2.5 h-2.5 text-[var(--tf-text-muted)]" />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <h3
                  className={`text-[11px] font-medium text-[var(--tf-text)] group-hover:text-[var(--tf-accent-text)] transition-colors leading-snug ${
                    cardDensity === 'rich' ? 'line-clamp-2' : 'truncate'
                  }`}
                >
                  {link.title}
                </h3>
              </div>
            </a>

            {/* Right Action: Close/Delete Tab Button */}
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseEnter={(e) => {
                e.stopPropagation();
                setHoverRect(null);
              }}
              onMouseLeave={() => {
                updateHoverPosition();
              }}
              onClick={() => onDelete(link.id)}
              aria-label={t.board.deleteLinkAria(link.title)}
              className="p-0.5 text-[var(--tf-text-muted)] hover:text-rose-500 rounded hover:bg-[var(--tf-surface)] shrink-0 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* Swiss Minimalist Metadata Footer: Domain Pill + Reading Estimate */}
          <div className="pl-4 flex items-center justify-between gap-2 pt-0.5">
            <span
              data-testid="link-domain-pill"
              title={domainLabel}
              className="inline-flex items-center px-1.5 py-0.5 rounded-xs text-[10px] font-mono bg-[var(--tf-surface)] border border-[var(--tf-border)] text-[var(--tf-text-secondary)] truncate max-w-[145px]"
            >
              {domainLabel}
            </span>

            <span
              data-testid="link-reading-estimate"
              className="inline-flex items-center gap-1 font-mono text-[10px] tabular-nums text-[var(--tf-text-muted)] shrink-0"
            >
              <Clock className="w-2.5 h-2.5 opacity-70" />
              <span>{readingEstimateText}</span>
            </span>
          </div>
        </div>
      </article>

      {effectiveDropPosition === 'after' && (
        <div
          aria-hidden="true"
          data-testid={`link-drop-indicator-after-${link.id}`}
          className="pointer-events-none absolute -bottom-1 inset-x-0 z-30 flex items-center"
        >
          <span className="w-2 h-2 rounded-full bg-[var(--tf-accent)] shrink-0 -ml-0.5 shadow-xs" />
          <span className="h-0.5 flex-1 bg-[var(--tf-accent)] rounded-full shadow-xs" />
        </div>
      )}

      {hoverRect &&
        !effectiveIsDragging &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="tooltip"
            data-testid="chrome-tab-hover-card"
            style={{
              position: 'fixed',
              left: `${hoverRect.left}px`,
              top: hoverRect.placeAbove
                ? `${hoverRect.top - 6}px`
                : `${hoverRect.bottom + 6}px`,
              width: `${hoverRect.width}px`,
              transform: hoverRect.placeAbove ? 'translateY(-100%)' : undefined,
            }}
            className="z-[120] pointer-events-none rounded-xl border border-[var(--tf-border-strong)] bg-[var(--tf-elevated)] shadow-2xl overflow-hidden transition-opacity duration-100"
          >
            <div className="px-3.5 py-2.5">
              <p className="text-[12px] font-semibold text-[var(--tf-text)] leading-snug whitespace-normal break-words">
                {link.title}
              </p>
              <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-[var(--tf-text-muted)]">
                <span className="truncate">
                  {isYt && effectiveChannelName
                    ? `${cleanDomain || 'youtube.com'} • ${effectiveChannelName}`
                    : cleanDomain || link.domain}
                </span>
                <span className="font-mono text-[10px] tabular-nums shrink-0">
                  {readingEstimateText}
                </span>
              </div>
            </div>

            {/* Website Preview Image shown inside the bottom hover card */}
            <div
              data-testid="link-og-cover"
              className="relative w-full h-32 sm:h-36 bg-[var(--tf-surface)] border-t border-[var(--tf-border)] overflow-hidden"
            >
              {activePreviewImageUrl ? (
                <img
                  src={activePreviewImageUrl}
                  alt=""
                  draggable={false}
                  referrerPolicy="no-referrer"
                  onError={() => {
                    if (primaryImageUrl && !coverImageFailed) {
                      setCoverImageFailed(true);
                    } else {
                      setScreenshotFailed(true);
                    }
                  }}
                  className="w-full h-full object-cover object-top"
                />
              ) : (
                <div
                  data-testid="link-og-placeholder"
                  className="w-full h-full flex flex-col justify-between p-3 bg-[var(--tf-surface)] text-[var(--tf-text-muted)]"
                >
                  <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-[0.08em]">
                    <span className="truncate max-w-[160px]">
                      {cleanDomain || 'OPENGRAPH'}
                    </span>
                    <span className="inline-flex items-center gap-1 shrink-0 opacity-75">
                      <ImageIcon className="w-2.5 h-2.5" />
                      <span>OG</span>
                    </span>
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <span className="text-xl font-semibold tracking-tight text-[var(--tf-text-secondary)] opacity-35 font-mono uppercase leading-none">
                      {(cleanDomain || link.title || 'TF').slice(0, 2)}
                    </span>
                    <span className="text-[9px] font-mono tabular-nums opacity-60">
                      {t.board.ogCoverPlaceholderLabel}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

function TabSubGroupBlock({
  subGroup,
  groupId,
  cardDensity,
  draggedLinkId,
  highlightedLinkId,
  linkDropTarget,
  onUpdateLinkMeta,
  onDelete,
  onDragStart,
  onDragEnd,
  onDragOverLink,
  onDropOnLink,
}: {
  subGroup: TabSubGroup;
  groupId: string;
  cardDensity: 'rich' | 'compact';
  draggedLinkId: string | null;
  highlightedLinkId?: string | null;
  linkDropTarget: {
    linkId: string;
    groupId: string;
    position: 'before' | 'after';
  } | null;
  onUpdateLinkMeta: (
    linkId: string,
    patch: Partial<
      Pick<
        LinkItem,
        | 'title'
        | 'description'
        | 'image_url'
        | 'reading_minutes'
        | 'video_duration'
        | 'channel_name'
      >
    >
  ) => void;
  onDelete: (linkId: string) => void;
  onDragStart: (e: React.DragEvent<HTMLElement>, link: LinkItem) => void;
  onDragEnd: () => void;
  onDragOverLink: (
    e: React.DragEvent<HTMLElement>,
    targetLink: LinkItem,
    groupId: string
  ) => void;
  onDropOnLink: (
    e: React.DragEvent<HTMLElement>,
    targetLink: LinkItem,
    groupId: string
  ) => void;
}) {
  const [iconFailed, setIconFailed] = useState(false);

  return (
    <div
      data-testid={`tab-subgroup-${subGroup.key}`}
      className="rounded-md border border-[var(--tf-border)] bg-[var(--tf-elevated)]/55 p-1.5 space-y-1.5"
    >
      <div
        onDragOver={(e) => {
          const firstLink = subGroup.links[0];
          if (firstLink) {
            onDragOverLink(e, firstLink, groupId);
          }
        }}
        onDrop={(e) => {
          const firstLink = subGroup.links[0];
          if (firstLink) {
            onDropOnLink(e, firstLink, groupId);
          }
        }}
        className="px-1 py-0.5 flex items-center justify-between gap-1.5"
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {subGroup.kind === 'youtube-channel' ? (
            <span className="w-3.5 h-3.5 rounded bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0 text-red-500">
              <Play className="w-2 h-2 fill-current" />
            </span>
          ) : (
            <span className="w-3.5 h-3.5 rounded bg-[var(--tf-surface)] border border-[var(--tf-border)] flex items-center justify-center shrink-0 overflow-hidden">
              {!iconFailed && subGroup.favicon ? (
                <img
                  src={subGroup.favicon}
                  alt=""
                  draggable={false}
                  referrerPolicy="no-referrer"
                  onError={() => setIconFailed(true)}
                  className="w-2.5 h-2.5 object-contain"
                />
              ) : (
                <Globe className="w-2.5 h-2.5 text-[var(--tf-text-muted)]" />
              )}
            </span>
          )}
          <span
            title={subGroup.label}
            className="text-[11px] font-semibold text-[var(--tf-text-secondary)] truncate"
          >
            {subGroup.label}
          </span>
        </div>
        <span className="font-mono text-[10px] tabular-nums text-[var(--tf-text-muted)] shrink-0">
          {subGroup.links.length}
        </span>
      </div>

      <div className="space-y-1.5">
        {subGroup.links.map((link) => (
          <TabLinkRow
            key={link.id}
            link={link}
            groupId={groupId}
            cardDensity={cardDensity}
            isDragging={draggedLinkId === link.id}
            isHighlighted={highlightedLinkId === link.id}
            dropPosition={
              linkDropTarget?.groupId === groupId &&
              linkDropTarget?.linkId === link.id &&
              draggedLinkId !== link.id
                ? linkDropTarget.position
                : null
            }
            onUpdateLinkMeta={onUpdateLinkMeta}
            onDelete={onDelete}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragOverLink={onDragOverLink}
            onDropOnLink={onDropOnLink}
          />
        ))}
      </div>
    </div>
  );
}

export function KanbanBoard({
  onOpenAddModal,
  onOpenImportModal,
}: KanbanBoardProps) {
  const {
    links,
    folders,
    activeFolderId,
    activeTag,
    cardDensity,
    newlyCreatedGroupId,
    isImportingGroup,
    isLoading,
    errorMessage,
    workspaceNotice,
    highlightedLinkId,
    setActiveFolderId,
    setActiveTag,
    setCardDensity,
    clearNewlyCreatedGroupId,
    clearError,
    clearNotice,
    clearHighlightedLinkId,
    addLink,
    updateLink,
    reorderLink,
    deleteLink,
    createFolder,
    createFolderWithLinks,
    updateFolder,
    reorderFolders,
  } = useLinkStore();

  const { mode } = useThemeStore();
  const { t } = useLanguageStore();
  const {
    activeLink: dndActiveLink,
    overFolderId: dndOverFolderId,
    isOverNewGroupZone: dndIsOverNewGroupZone,
  } = useWorkspaceDnd();
  const { setNodeRef: setNewGroupDropNodeRef, isOver: isDndOverNewGroup } =
    useDroppable({
      id: 'new-group-drop-zone',
      data: { type: 'new-group' },
    });
  const groupStyles = getTabGroupStyles(mode);

  // Drag & Drop + Bottom Nav Focus + Inline Group Rename State
  const [draggedLinkId, setDraggedLinkId] = useState<string | null>(null);
  const [linkDropTarget, setLinkDropTarget] = useState<{
    linkId: string;
    groupId: string;
    position: 'before' | 'after';
  } | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null);
  const [folderDropTarget, setFolderDropTarget] = useState<{
    groupId: string;
    position: 'before' | 'after';
  } | null>(null);
  const [openColorPickerId, setOpenColorPickerId] = useState<string | null>(null);
  const [openActionsMenuId, setOpenActionsMenuId] = useState<string | null>(null);
  const [focusedGroupId, setFocusedGroupId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const boardScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setFocusedGroupId(activeFolderId);
    if (!activeFolderId) return;
    const rafId = requestAnimationFrame(() => {
      const colEl = document.getElementById(`tab-group-col-${activeFolderId}`);
      colEl?.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    });
    return () => cancelAnimationFrame(rafId);
  }, [activeFolderId]);

  useEffect(() => {
    if (!workspaceNotice?.id) return;
    if (workspaceNotice.folderId) {
      setFocusedGroupId(workspaceNotice.folderId);
      requestAnimationFrame(() => {
        const colEl = document.getElementById(
          `tab-group-col-${workspaceNotice.folderId}`
        );
        colEl?.scrollIntoView({
          behavior: 'smooth',
          inline: 'center',
          block: 'nearest',
        });
      });
    }
    const timer = window.setTimeout(() => {
      clearNotice();
    }, 9000);
    return () => window.clearTimeout(timer);
  }, [workspaceNotice?.id, workspaceNotice?.folderId, clearNotice]);

  // Automatically scroll to, focus, and highlight newly added tabs at their exact board position
  useEffect(() => {
    if (!highlightedLinkId) return;
    const targetLink = useLinkStore
      .getState()
      .links.find((l) => l.id === highlightedLinkId);
    const targetFolderId = targetLink?.folder_id ?? '__ungrouped__';

    setFocusedGroupId(targetFolderId);

    const focusAndScrollTimer = window.setTimeout(() => {
      const colEl = document.getElementById(`tab-group-col-${targetFolderId}`);
      colEl?.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });

      const cardEl = document.getElementById(
        `tab-link-card-${highlightedLinkId}`
      ) as HTMLElement | null;
      if (cardEl) {
        cardEl.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        });
        cardEl.focus({ preventScroll: true });
      }
    }, 50);

    const clearTimer = window.setTimeout(() => {
      clearHighlightedLinkId();
    }, 4500);

    return () => {
      window.clearTimeout(focusAndScrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [highlightedLinkId, clearHighlightedLinkId]);

  // Auto-scroll and focus + select the inline rename input whenever a new Tab Group is created via drop/import
  useEffect(() => {
    if (!newlyCreatedGroupId) return;
    const targetFolder = folders.find((f) => f.id === newlyCreatedGroupId);
    if (!targetFolder) return;

    setFocusedGroupId(newlyCreatedGroupId);
    setEditingGroupId(newlyCreatedGroupId);
    setEditingGroupName(targetFolder.name);

    const timerId = window.setTimeout(() => {
      const colEl = document.getElementById(
        `tab-group-col-${newlyCreatedGroupId}`
      );
      colEl?.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });

      const inputEl = document.getElementById(
        `tab-group-title-input-${newlyCreatedGroupId}`
      ) as HTMLInputElement | null;
      if (inputEl) {
        inputEl.focus();
        inputEl.select();
      }
      clearNewlyCreatedGroupId();
    }, 60);

    return () => window.clearTimeout(timerId);
  }, [newlyCreatedGroupId, folders, clearNewlyCreatedGroupId]);

  const handleCreateGroupFromParsedPayload = useCallback(
    async (parsed: ReturnType<typeof parseTabGroupFromTextOrHtml>) => {
      if (parsed.tabs.length === 0) return;
      const groupName = inferDefaultGroupName(
        parsed,
        t.board.defaultNewGroupName
      );
      const color =
        parsed.color ?? pickNextTabGroupColor(useLinkStore.getState().folders.length);
      await createFolderWithLinks({
        name: groupName,
        color,
        tabs: parsed.tabs,
        focusInlineRename: true,
      });
    },
    [createFolderWithLinks, t.board.defaultNewGroupName]
  );

  // Listen for global Ctrl+V / Cmd+V paste on the board (when not typing in an input/textarea)
  useEffect(() => {
    const handleGlobalPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        (target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable ||
            Boolean(target.closest('[role="dialog"]')))) ||
        Boolean(document.querySelector('[role="dialog"]'))
      ) {
        return;
      }
      if (!event.clipboardData) return;

      const rawText = event.clipboardData.getData('text/plain');
      const rawHtml = event.clipboardData.getData('text/html');
      const customJson = event.clipboardData.getData(
        'application/x-tabflow-tabgroup'
      );
      const parsed = parseTabGroupFromTextOrHtml(rawText, rawHtml, customJson);

      if (parsed.tabs.length === 0) return;

      // If pasting a multi-URL list / Bookmark folder / TabGroup JSON, or if the board has no groups yet, create a new Tab Group
      if (
        parsed.isGroupPayload ||
        parsed.tabs.length > 1 ||
        useLinkStore.getState().folders.length === 0
      ) {
        event.preventDefault();
        void handleCreateGroupFromParsedPayload(parsed);
      } else if (parsed.tabs.length === 1) {
        event.preventDefault();
        const state = useLinkStore.getState();
        const targetFolderId =
          state.activeFolderId ??
          focusedGroupId ??
          state.folders[0]?.id ??
          null;
        void addLink({
          url: parsed.tabs[0].url,
          title: parsed.tabs[0].title,
          folder_id: targetFolderId,
          tags: ['saved-tab'],
          status: LinkStatus.UNREAD,
        });
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [handleCreateGroupFromParsedPayload, addLink, focusedGroupId]);

  const filteredLinks = useMemo(
    () =>
      filterLinks(links, folders, {
        folderId: null,
        tag: activeTag,
        searchQuery: '',
      }),
    [links, folders, activeTag]
  );

  const folderIdSet = useMemo(
    () => new Set(folders.map((f) => f.id)),
    [folders]
  );

  const visibleGroups = useMemo(() => {
    const baseGroups = folders;

    const hasUngroupedLinks = filteredLinks.some(
      (l) => !l.folder_id || !folderIdSet.has(l.folder_id)
    );

    if (hasUngroupedLinks) {
      const virtualGroup: Folder = {
        id: '__ungrouped__',
        user_id: 'current',
        name: t.sidebar.allSavedTabs,
        parent_id: null,
        order_index: baseGroups.length,
        color: 'blue',
        collapsed: false,
      };
      return [...baseGroups, virtualGroup];
    }

    return baseGroups;
  }, [folders, filteredLinks, folderIdSet, t.sidebar.allSavedTabs]);

  const commitEditingGroup = async (groupId: string) => {
    const trimmed = editingGroupName.trim();
    const current = folders.find((f) => f.id === groupId);
    setEditingGroupId(null);
    if (!trimmed || !current || trimmed === current.name) return;
    await updateFolder(groupId, { name: trimmed });
  };

  const isFolderDragEvent = (e: React.DragEvent<HTMLElement>): boolean => {
    if (draggedFolderId) return true;
    const types = Array.from(e.dataTransfer?.types ?? []);
    return types.includes('application/x-tabflow-folder-id');
  };

  const isLinkDragEvent = (e: React.DragEvent<HTMLElement>): boolean => {
    if (draggedLinkId) return true;
    const types = Array.from(e.dataTransfer?.types ?? []);
    return types.includes('application/x-tabflow-link-id');
  };

  const handleGroupHeaderDragStart = (
    e: React.DragEvent<HTMLElement>,
    group: Folder
  ) => {
    if (group.id === '__ungrouped__' || editingGroupId === group.id) {
      e.preventDefault();
      return;
    }
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' || target.closest('button'))
    ) {
      e.preventDefault();
      return;
    }

    e.stopPropagation();
    setDraggedFolderId(group.id);
    setDraggedLinkId(null);
    setLinkDropTarget(null);
    setDragOverGroupId(null);
    e.dataTransfer.setData('application/x-tabflow-folder-id', group.id);
    e.dataTransfer.setData('text/plain', group.id);
    e.dataTransfer.effectAllowed = 'move';

    const colEl = document.getElementById(`tab-group-col-${group.id}`);
    if (colEl && e.dataTransfer.setDragImage) {
      const rect = colEl.getBoundingClientRect();
      const offsetX = Math.min(
        Math.max(e.clientX - rect.left, 24),
        Math.max(rect.width - 24, 24)
      );
      e.dataTransfer.setDragImage(colEl, offsetX, 20);
    }
  };

  const handleGroupHeaderDragEnd = () => {
    setDraggedFolderId(null);
    setFolderDropTarget(null);
    setDragOverGroupId(null);
  };

  const handleDragStart = (e: React.DragEvent<HTMLElement>, link: LinkItem) => {
    e.stopPropagation();
    setDraggedLinkId(link.id);
    setLinkDropTarget(null);
    setDraggedFolderId(null);
    setFolderDropTarget(null);
    e.dataTransfer.setData('application/x-tabflow-link-id', link.id);
    e.dataTransfer.setData('text/plain', link.id);
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleLinkDragEnd = () => {
    setDraggedLinkId(null);
    setLinkDropTarget(null);
    setDragOverGroupId(null);
  };

  const handleDragOverLink = (
    e: React.DragEvent<HTMLElement>,
    targetLink: LinkItem,
    groupId: string
  ) => {
    if (isFolderDragEvent(e)) return;
    e.preventDefault();
    e.stopPropagation();

    e.dataTransfer.dropEffect =
      e.altKey || e.ctrlKey || e.metaKey ? 'copy' : 'move';

    if (dragOverGroupId !== groupId) {
      setDragOverGroupId(groupId);
    }

    // Auto-scroll the vertical tab list when dragging near top/bottom edges
    const tabListEl = e.currentTarget.closest(
      '[data-tab-list-scroll="true"]'
    ) as HTMLElement | null;
    if (tabListEl && tabListEl.scrollHeight > tabListEl.clientHeight) {
      const listRect = tabListEl.getBoundingClientRect();
      const vEdge = 36;
      if (e.clientY - listRect.top < vEdge) {
        tabListEl.scrollTop -= 8;
      } else if (listRect.bottom - e.clientY < vEdge) {
        tabListEl.scrollTop += 8;
      }
    }

    // Auto-scroll the horizontal board when dragging near left/right edges
    if (boardScrollRef.current) {
      const boardRect = boardScrollRef.current.getBoundingClientRect();
      const hEdge = 72;
      if (e.clientX - boardRect.left < hEdge) {
        boardScrollRef.current.scrollLeft -= 14;
      } else if (boardRect.right - e.clientX < hEdge) {
        boardScrollRef.current.scrollLeft += 14;
      }
    }

    if (draggedLinkId === targetLink.id) {
      if (linkDropTarget !== null) {
        setLinkDropTarget(null);
      }
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const nextPos: 'before' | 'after' =
      e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';

    if (
      linkDropTarget?.linkId !== targetLink.id ||
      linkDropTarget?.groupId !== groupId ||
      linkDropTarget?.position !== nextPos
    ) {
      setLinkDropTarget({
        linkId: targetLink.id,
        groupId,
        position: nextPos,
      });
    }
  };

  const handleDropOnLink = async (
    e: React.DragEvent<HTMLElement>,
    targetLink: LinkItem,
    targetGroupId: string
  ) => {
    if (isFolderDragEvent(e)) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = e.currentTarget.getBoundingClientRect();
    const position: 'before' | 'after' =
      linkDropTarget?.linkId === targetLink.id
        ? linkDropTarget.position
        : e.clientY < rect.top + rect.height / 2
        ? 'before'
        : 'after';

    const resolvedTargetFolderId =
      targetGroupId === '__ungrouped__' ? null : targetGroupId;

    const internalLinkId =
      e.dataTransfer.getData('application/x-tabflow-link-id') || draggedLinkId;
    const plainText = e.dataTransfer.getData('text/plain').trim();
    const matchedLink = links.find(
      (l) => l.id === internalLinkId || l.id === plainText
    );

    setDraggedLinkId(null);
    setLinkDropTarget(null);
    setDragOverGroupId(null);

    if (matchedLink) {
      if (e.altKey || e.ctrlKey || e.metaKey) {
        await addLink({
          url: matchedLink.url,
          title: matchedLink.title,
          folder_id: resolvedTargetFolderId ?? (folders[0]?.id ?? null),
          tags: matchedLink.tags?.length ? matchedLink.tags : ['saved-tab'],
          status: LinkStatus.UNREAD,
          target_link_id: targetLink.id,
          position,
        });
      } else {
        await reorderLink(
          matchedLink.id,
          resolvedTargetFolderId,
          targetLink.id,
          position
        );
      }
      return;
    }

    const parsed = parseTabGroupFromDataTransfer(e.dataTransfer);
    if (parsed.tabs.length > 0) {
      for (const tab of parsed.tabs) {
        await addLink({
          url: tab.url,
          title: tab.title,
          folder_id: resolvedTargetFolderId ?? (folders[0]?.id ?? null),
          tags: ['saved-tab'],
          status: LinkStatus.UNREAD,
          target_link_id: targetLink.id,
          position,
        });
      }
    }
  };

  const handleDropOnGroup = async (
    e: React.DragEvent<HTMLElement>,
    targetFolderId: string
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const sourceFolderId =
      e.dataTransfer.getData('application/x-tabflow-folder-id') ||
      draggedFolderId;

    if (sourceFolderId) {
      const rect = e.currentTarget.getBoundingClientRect();
      const position: 'before' | 'after' =
        folderDropTarget?.groupId === targetFolderId
          ? folderDropTarget.position
          : e.clientX < rect.left + rect.width / 2
          ? 'before'
          : 'after';

      setDraggedFolderId(null);
      setFolderDropTarget(null);
      setDragOverGroupId(null);

      if (
        targetFolderId !== '__ungrouped__' &&
        sourceFolderId !== targetFolderId
      ) {
        await reorderFolders(sourceFolderId, targetFolderId, position);
      }
      return;
    }

    const resolvedTargetFolderId =
      targetFolderId === '__ungrouped__' ? null : targetFolderId;

    const internalLinkId =
      e.dataTransfer.getData('application/x-tabflow-link-id') || draggedLinkId;
    const plainText = e.dataTransfer.getData('text/plain').trim();
    const matchedLink = links.find(
      (l) => l.id === internalLinkId || l.id === plainText
    );

    const activeTargetForLane =
      linkDropTarget?.groupId === targetFolderId ? linkDropTarget : null;

    setDraggedLinkId(null);
    setLinkDropTarget(null);
    setDragOverGroupId(null);

    if (matchedLink) {
      if (e.altKey || e.ctrlKey || e.metaKey) {
        await addLink({
          url: matchedLink.url,
          title: matchedLink.title,
          folder_id: resolvedTargetFolderId ?? (folders[0]?.id ?? null),
          tags: matchedLink.tags?.length ? matchedLink.tags : ['saved-tab'],
          status: LinkStatus.UNREAD,
          target_link_id: activeTargetForLane?.linkId ?? null,
          position: activeTargetForLane?.position ?? 'after',
        });
      } else {
        await reorderLink(
          matchedLink.id,
          resolvedTargetFolderId,
          activeTargetForLane?.linkId ?? null,
          activeTargetForLane?.position ?? 'after'
        );
      }
      return;
    }

    const parsed = parseTabGroupFromDataTransfer(e.dataTransfer);
    if (parsed.tabs.length > 0) {
      for (const tab of parsed.tabs) {
        await addLink({
          url: tab.url,
          title: tab.title,
          folder_id: resolvedTargetFolderId ?? (folders[0]?.id ?? null),
          tags: ['saved-tab'],
          status: LinkStatus.UNREAD,
          target_link_id: activeTargetForLane?.linkId ?? null,
          position: activeTargetForLane?.position ?? 'after',
        });
      }
    }
  };

  const handleDropToCreateNewGroup = async (
    e: React.DragEvent<HTMLElement>
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const sourceFolderId =
      e.dataTransfer.getData('application/x-tabflow-folder-id') ||
      draggedFolderId;
    if (sourceFolderId) {
      const lastFolder = folders[folders.length - 1];
      setDraggedFolderId(null);
      setFolderDropTarget(null);
      setDragOverGroupId(null);
      if (lastFolder && lastFolder.id !== sourceFolderId) {
        await reorderFolders(sourceFolderId, lastFolder.id, 'after');
      }
      return;
    }

    const internalLinkId =
      e.dataTransfer.getData('application/x-tabflow-link-id') || draggedLinkId;
    const plainText = e.dataTransfer.getData('text/plain').trim();
    const matchedLink = links.find(
      (l) => l.id === internalLinkId || l.id === plainText
    );

    setDraggedLinkId(null);
    setLinkDropTarget(null);
    setDragOverGroupId(null);

    // If user dragged an existing internal tab card onto "Drop to create new Tab Group"
    if (matchedLink) {
      const nextColor = pickNextTabGroupColor(folders.length);
      const created = await createFolder(
        t.board.defaultNewGroupName,
        null,
        nextColor
      );
      if (created) {
        await reorderLink(matchedLink.id, created.id, null, 'after');
        useLinkStore.setState({
          activeFolderId: null,
          newlyCreatedGroupId: created.id,
        });
      }
      return;
    }

    const parsed = parseTabGroupFromDataTransfer(e.dataTransfer);
    if (parsed.tabs.length > 0) {
      await handleCreateGroupFromParsedPayload(parsed);
    }
  };

  const handleDropOnEmptyBoard = async (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverGroupId(null);
    setLinkDropTarget(null);

    const parsed = parseTabGroupFromDataTransfer(e.dataTransfer);
    if (parsed.tabs.length > 0) {
      await handleCreateGroupFromParsedPayload(parsed);
    }
  };

  const handleOpenAllInGroup = (groupLinks: LinkItem[]) => {
    groupLinks.forEach((l) => {
      window.open(l.url, '_blank', 'noopener,noreferrer');
    });
  };

  const handleSelectBottomTab = (groupId: string | null) => {
    if (groupId === null) {
      setActiveFolderId(null);
      setFocusedGroupId(null);
      boardScrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
      return;
    }

    setActiveFolderId(groupId);
    setFocusedGroupId(groupId);

    requestAnimationFrame(() => {
      const colEl = document.getElementById(`tab-group-col-${groupId}`);
      if (colEl) {
        colEl.scrollIntoView({
          behavior: 'smooth',
          inline: 'center',
          block: 'nearest',
        });
      }
    });
  };

  const handleScrollBoardBy = (deltaX: number) => {
    boardScrollRef.current?.scrollBy({ left: deltaX, behavior: 'smooth' });
  };

  const handleBoardWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!boardScrollRef.current) return;
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;

    const target = e.target as HTMLElement | null;
    const tabListEl = target?.closest(
      '[data-tab-list-scroll="true"]'
    ) as HTMLElement | null;

    if (tabListEl && tabListEl.scrollHeight > tabListEl.clientHeight) {
      return;
    }

    boardScrollRef.current.scrollLeft += e.deltaY;
  };

  const handleBottomNavWheel = (e: React.WheelEvent<HTMLElement>) => {
    e.stopPropagation();
    const delta =
      Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (delta === 0) return;

    if (boardScrollRef.current) {
      boardScrollRef.current.scrollLeft += delta;
    }
    if (e.currentTarget.scrollWidth > e.currentTarget.clientWidth) {
      e.currentTarget.scrollLeft += delta;
    }
  };

  const noticeMessage =
    workspaceNotice?.kind === 'same-website-grouped'
      ? t.board.sameWebsiteGroupedNotice(
          workspaceNotice.sourceLabel,
          workspaceNotice.groupName
        )
      : '';

  return (
    <div
      onWheel={handleBoardWheel}
      className="relative flex-1 flex flex-col min-w-0 h-full bg-[var(--tf-canvas)] overflow-hidden transition-colors duration-200"
    >
      {errorMessage && (
        <div
          role="alert"
          className="mx-3 sm:mx-6 mt-3 sm:mt-4 px-3 py-2 rounded-md bg-rose-500/15 border border-rose-500/40 flex items-center justify-between text-xs text-rose-500 shrink-0"
        >
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={clearError}
            aria-label={t.board.dismissErrorAria}
            className="text-rose-500 hover:opacity-80 ml-4"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {workspaceNotice?.kind === 'same-website-grouped' && noticeMessage && (
        <div
          role="status"
          aria-live="polite"
          data-testid="workspace-notice-banner"
          className={`mx-3 sm:mx-6 mt-3 sm:mt-4 px-3.5 py-2.5 rounded-lg border flex items-center justify-between gap-3 text-xs shrink-0 shadow-sm ${
            mode === 'light'
              ? 'bg-sky-500/15 border-sky-500/60 text-sky-950'
              : 'bg-sky-500/20 border-sky-400/60 text-sky-200'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertTriangle className="w-4 h-4 shrink-0 text-sky-500" />
            <span className="font-semibold leading-snug">{noticeMessage}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {workspaceNotice.folderId && (
              <button
                type="button"
                onClick={() => {
                  if (workspaceNotice.folderId) {
                    handleSelectBottomTab(workspaceNotice.folderId);
                  }
                }}
                className="px-2.5 py-1 rounded-md border border-current/40 bg-current/10 hover:bg-current/20 text-[11px] font-semibold transition-colors whitespace-nowrap"
              >
                {t.board.viewGroupBtn}
              </button>
            )}
            <button
              type="button"
              onClick={clearNotice}
              aria-label={t.board.dismissNoticeAria}
              className="hover:opacity-80 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Swiss Minimalist Board Sub-Toolbar: Tag Filter Indicator & Rich/Compact Card Density Switch */}
      <div className="px-3 sm:px-4 lg:px-6 pt-2.5 pb-1.5 border-b border-[var(--tf-border)] bg-[var(--tf-surface)]/45 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {activeTag ? (
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs border border-[var(--tf-border-strong)] bg-[var(--tf-elevated)] text-[11px] font-mono text-[var(--tf-text)]">
              <Hash className="w-3 h-3 text-[var(--tf-accent)] shrink-0" />
              <span className="truncate">{t.board.filteredByTagLabel(activeTag)}</span>
              <button
                type="button"
                onClick={() => setActiveTag(null)}
                aria-label={t.sidebar.clearTagFilter}
                className="ml-1 text-[var(--tf-text-muted)] hover:text-[var(--tf-text)]"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <span className="text-[11px] font-mono text-[var(--tf-text-muted)] tabular-nums truncate">
              {visibleGroups.length} · {filteredLinks.length} {t.sidebar.tabUnit}
            </span>
          )}
        </div>

        <div
          role="group"
          aria-label="Card density"
          className="inline-flex items-center rounded-md border border-[var(--tf-border)] bg-[var(--tf-surface)] p-0.5 shrink-0"
        >
          <button
            type="button"
            onClick={() => setCardDensity('rich')}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[11px] font-medium transition-colors ${
              cardDensity === 'rich'
                ? 'bg-[var(--tf-elevated)] text-[var(--tf-text)] border border-[var(--tf-border)]'
                : 'text-[var(--tf-text-muted)] hover:text-[var(--tf-text)] border border-transparent'
            }`}
          >
            <LayoutGrid className="w-3 h-3" />
            <span>{t.board.cardViewRich}</span>
          </button>
          <button
            type="button"
            onClick={() => setCardDensity('compact')}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[11px] font-medium transition-colors ${
              cardDensity === 'compact'
                ? 'bg-[var(--tf-elevated)] text-[var(--tf-text)] border border-[var(--tf-border)]'
                : 'text-[var(--tf-text-muted)] hover:text-[var(--tf-text)] border border-transparent'
            }`}
          >
            <List className="w-3 h-3" />
            <span>{t.board.cardViewCompact}</span>
          </button>
        </div>
      </div>

      {/* Google Chrome Tab Groups Board */}
      <div
        ref={boardScrollRef}
        onDragOver={(e) => {
          if (isFolderDragEvent(e) || isLinkDragEvent(e)) {
            e.preventDefault();
            if (boardScrollRef.current) {
              const boardRect = boardScrollRef.current.getBoundingClientRect();
              const edgeThreshold = 72;
              if (e.clientX - boardRect.left < edgeThreshold) {
                boardScrollRef.current.scrollLeft -= 14;
              } else if (boardRect.right - e.clientX < edgeThreshold) {
                boardScrollRef.current.scrollLeft += 14;
              }
            }
            if (isFolderDragEvent(e)) {
              return;
            }
          }
          if (visibleGroups.length === 0) {
            e.preventDefault();
            if (dragOverGroupId !== '__empty_board__') {
              setDragOverGroupId('__empty_board__');
            }
          }
        }}
        onDragLeave={(e) => {
          if (
            visibleGroups.length === 0 &&
            !e.currentTarget.contains(e.relatedTarget as Node)
          ) {
            setDragOverGroupId(null);
          }
        }}
        onDrop={(e) => {
          const sourceFolderId =
            e.dataTransfer.getData('application/x-tabflow-folder-id') ||
            draggedFolderId;
          if (sourceFolderId && folderDropTarget) {
            e.preventDefault();
            const target = folderDropTarget;
            setDraggedFolderId(null);
            setFolderDropTarget(null);
            setDragOverGroupId(null);
            if (sourceFolderId !== target.groupId) {
              void reorderFolders(
                sourceFolderId,
                target.groupId,
                target.position
              );
            }
            return;
          }
          if (visibleGroups.length === 0) {
            void handleDropOnEmptyBoard(e);
          }
        }}
        className="p-3 sm:p-4 lg:p-6 pb-20 sm:pb-24 flex-1 flex flex-row gap-3 sm:gap-4 lg:gap-5 items-start overflow-x-auto overflow-y-hidden min-h-0"
      >
        {!isLoading && visibleGroups.length === 0 && (
          <div
            data-testid="empty-board-state"
            className={`w-full h-full min-h-[240px] flex items-center justify-center rounded-xl border border-dashed transition-colors p-6 ${
              dragOverGroupId === '__empty_board__'
                ? 'border-[var(--tf-accent)] bg-[var(--tf-accent-soft)]'
                : 'border-[var(--tf-border)] bg-[var(--tf-surface)]/40'
            }`}
          >
            <div className="max-w-md text-center space-y-3">
              <div className="mx-auto w-10 h-10 rounded-lg border border-[var(--tf-border)] bg-[var(--tf-elevated)] flex items-center justify-center text-[var(--tf-text-muted)]">
                <Globe className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-[var(--tf-text)]">
                  {dragOverGroupId === '__empty_board__'
                    ? t.board.dropNewGroupActive
                    : t.board.emptyBoardTitle}
                </h2>
                <p className="text-xs text-[var(--tf-text-muted)] leading-relaxed">
                  {t.board.emptyBoardSubtext}
                </p>
              </div>
              <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenAddModal(LinkStatus.UNREAD)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[var(--tf-text)] text-[var(--tf-canvas)] hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.board.emptyBoardAddBtn}</span>
                </button>
                {onOpenImportModal && (
                  <button
                    type="button"
                    onClick={onOpenImportModal}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border border-[var(--tf-border-strong)] bg-[var(--tf-elevated)] text-[var(--tf-text)] hover:border-[var(--tf-accent)] transition-colors whitespace-nowrap shrink-0"
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-[var(--tf-accent)]" />
                    <span>{t.board.emptyBoardImportBtn}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {visibleGroups.map((group) => {
              const colorKey: TabGroupColor = group.color ?? 'blue';
              const style = groupStyles[colorKey] ?? groupStyles.blue;
              const groupLinks = sortGroupLinks(
                group.id === '__ungrouped__'
                  ? filteredLinks.filter(
                      (l) => !l.folder_id || !folderIdSet.has(l.folder_id)
                    )
                  : filteredLinks.filter((l) => l.folder_id === group.id)
              );
              const isDropTarget =
                dragOverGroupId === group.id ||
                (Boolean(dndActiveLink) && dndOverFolderId === group.id);
              const isDraggingThisGroup = draggedFolderId === group.id;
              const isGroupReorderTarget =
                folderDropTarget?.groupId === group.id &&
                draggedFolderId !== group.id;
              const reorderPosition = isGroupReorderTarget
                ? folderDropTarget?.position
                : null;
              const isFocused =
                focusedGroupId === group.id || activeFolderId === group.id;
              const isEditingName = editingGroupId === group.id;

              return (
                <FolderDroppableWrapper
                  key={group.id}
                  group={group}
                  onClick={() => {
                    setFocusedGroupId(group.id);
                    if (group.id !== '__ungrouped__') {
                      setActiveFolderId(group.id);
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (isFolderDragEvent(e)) {
                      e.dataTransfer.dropEffect = 'move';
                      if (
                        group.id !== '__ungrouped__' &&
                        draggedFolderId !== group.id
                      ) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const nextPos: 'before' | 'after' =
                          e.clientX < rect.left + rect.width / 2
                            ? 'before'
                            : 'after';
                        if (
                          folderDropTarget?.groupId !== group.id ||
                          folderDropTarget.position !== nextPos
                        ) {
                          setFolderDropTarget({
                            groupId: group.id,
                            position: nextPos,
                          });
                        }
                      }
                      return;
                    }
                    if (dragOverGroupId !== group.id)
                      setDragOverGroupId(group.id);
                  }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  if (dragOverGroupId === group.id) setDragOverGroupId(null);
                  if (folderDropTarget?.groupId === group.id) {
                    setFolderDropTarget(null);
                  }
                  if (linkDropTarget?.groupId === group.id) {
                    setLinkDropTarget(null);
                  }
                }
              }}
              onDrop={(e) => handleDropOnGroup(e, group.id)}
              className={`relative w-[calc(100vw-3.5rem)] max-w-[288px] sm:w-[264px] md:w-[276px] lg:w-[288px] shrink-0 flex flex-col max-h-full rounded-lg border bg-[var(--tf-surface)] overflow-hidden transition-all ${
                isDraggingThisGroup
                  ? 'opacity-50 scale-[0.98] border-dashed border-[var(--tf-accent)]'
                  : isGroupReorderTarget
                  ? 'border-[var(--tf-accent)] ring-2 ring-[var(--tf-accent)]'
                  : isDropTarget
                  ? 'border-[var(--tf-accent)] ring-1 ring-[var(--tf-accent)]'
                  : isFocused
                  ? 'border-[var(--tf-accent)] ring-2 ring-[var(--tf-accent)]/60 shadow-lg'
                  : `border-[var(--tf-border)] ${style.borderHover}`
              }`}
            >
              {/* Visual insertion edge indicator when reordering Tab Groups */}
              {reorderPosition === 'before' && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-[var(--tf-accent)] z-30"
                />
              )}
              {reorderPosition === 'after' && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 right-0 w-1.5 bg-[var(--tf-accent)] z-30"
                />
              )}

              {/* Google Chrome Tab Group Colored Top Accent Line */}
              <div className={`h-1 w-full shrink-0 ${style.topBar}`} />

              {/* Collapsible & Draggable Tab Group Header */}
              <header
                draggable={!isEditingName && group.id !== '__ungrouped__'}
                onDragStart={(e) => handleGroupHeaderDragStart(e, group)}
                onDragEnd={handleGroupHeaderDragEnd}
                title={
                  !isEditingName && group.id !== '__ungrouped__'
                    ? t.board.dragGroupTitle
                    : undefined
                }
                className={`px-2.5 sm:px-3 py-2 sm:py-2.5 border-b border-[var(--tf-border)] flex items-center justify-between gap-1.5 sm:gap-2 bg-[var(--tf-elevated)] shrink-0 select-none ${
                  !isEditingName && group.id !== '__ungrouped__'
                    ? 'cursor-grab active:cursor-grabbing'
                    : ''
                }`}
              >
                <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 flex-1">
                  <div
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold border ${style.badgeBg} ${style.badgeText} min-w-0 max-w-[148px] sm:max-w-[164px]`}
                  >
                    <input
                      id={`tab-group-title-input-${group.id}`}
                      type="text"
                      value={isEditingName ? editingGroupName : group.name}
                      onFocus={() => {
                        setEditingGroupId(group.id);
                        setEditingGroupName(group.name);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setEditingGroupName(e.target.value)}
                      onBlur={() => commitEditingGroup(group.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.currentTarget.blur();
                        } else if (e.key === 'Escape') {
                          setEditingGroupId(null);
                          setEditingGroupName(group.name);
                          e.currentTarget.blur();
                        }
                      }}
                      aria-label={t.sidebar.editGroupNameAria(group.name)}
                      title={t.board.editGroupTitle}
                      className="w-full min-w-0 bg-transparent text-xs font-semibold text-inherit truncate rounded px-1 -mx-0.5 border border-transparent focus:border-[var(--tf-accent)] focus:bg-[var(--tf-canvas)] focus:text-[var(--tf-text)] focus:outline-none transition-colors cursor-text"
                    />
                  </div>

                  <span className="font-mono text-[11px] tabular-nums text-[var(--tf-text-muted)] shrink-0">
                    {groupLinks.length}
                  </span>
                </div>

                {/* Group Actions: Change Color & Three-dots Menu (Open All + New Tab) */}
                <div className="flex items-center gap-0.5 sm:gap-1 shrink-0 relative">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenActionsMenuId(null);
                      setOpenColorPickerId(
                        openColorPickerId === group.id ? null : group.id
                      );
                    }}
                    aria-label={t.board.changeColorAria(group.name)}
                    title={t.board.changeColorTitle}
                    className="p-1.5 rounded hover:bg-[var(--tf-surface)] flex items-center justify-center"
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
                  </button>

                  {openColorPickerId === group.id && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-8 z-30 p-3 rounded-xl border border-[var(--tf-border-strong)] bg-[var(--tf-elevated)] shadow-2xl grid grid-cols-6 gap-2.5 w-max"
                    >
                      {COLOR_KEYS.map((cKey) => (
                        <button
                          key={cKey}
                          type="button"
                          title={t.board.colors[cKey]}
                          aria-label={t.board.setColorAria(t.board.colors[cKey])}
                          onClick={(e) => {
                            e.stopPropagation();
                            updateFolder(group.id, { color: cKey });
                            setOpenColorPickerId(null);
                          }}
                          className={`w-5 h-5 rounded-full ${groupStyles[cKey].dot} border border-black/20 dark:border-white/25 shadow-xs hover:scale-125 transition-transform ${
                            colorKey === cKey
                              ? 'ring-2 ring-[var(--tf-text)] ring-offset-2 ring-offset-[var(--tf-elevated)] scale-110'
                              : 'opacity-95 hover:opacity-100'
                          }`}
                        />
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenColorPickerId(null);
                      setOpenActionsMenuId(null);
                      onOpenAddModal(LinkStatus.UNREAD, group.id);
                    }}
                    title={t.board.addLinkToGroupTitle(group.name)}
                    aria-label={t.board.addLinkToGroupAria(group.name)}
                    className="p-1 text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-surface)] rounded transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenColorPickerId(null);
                      setOpenActionsMenuId(
                        openActionsMenuId === group.id ? null : group.id
                      );
                    }}
                    aria-haspopup="menu"
                    aria-expanded={openActionsMenuId === group.id}
                    aria-label={t.board.addLinkToGroupAria(group.name)}
                    className="p-1 text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-surface)] rounded transition-colors"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>

                  {openActionsMenuId === group.id && (
                    <div
                      role="menu"
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-8 z-30 min-w-[148px] p-1 rounded-md border border-[var(--tf-border-strong)] bg-[var(--tf-elevated)] shadow-xl flex flex-col gap-0.5"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setOpenActionsMenuId(null);
                          onOpenAddModal(LinkStatus.UNREAD, group.id);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-[11px] font-medium text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-surface)] rounded transition-colors whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5 shrink-0" />
                        <span>{t.emptyLane.addLink}</span>
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        disabled={groupLinks.length === 0}
                        onClick={() => {
                          setOpenActionsMenuId(null);
                          handleOpenAllInGroup(groupLinks);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-[11px] font-mono text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-surface)] disabled:opacity-40 disabled:pointer-events-none rounded transition-colors whitespace-nowrap"
                      >
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        <span>{t.board.openAll}</span>
                      </button>
                    </div>
                  )}
                </div>
              </header>

              {/* Group Tabs List */}
              <div
                data-tab-list-scroll="true"
                onDragOver={(e) => {
                  e.preventDefault();
                  if (isFolderDragEvent(e)) {
                    return;
                  }
                  if (dragOverGroupId !== group.id) {
                    setDragOverGroupId(group.id);
                  }
                  // If hovering the empty area of the scroll container itself (not on a specific link card),
                  // clear any stale card drop target from another lane
                  if (
                    e.target === e.currentTarget &&
                    linkDropTarget &&
                    linkDropTarget.groupId !== group.id
                  ) {
                    setLinkDropTarget(null);
                  }
                }}
                onDrop={(e) => handleDropOnGroup(e, group.id)}
                className={`p-2 space-y-1.5 flex-1 min-h-0 overflow-y-auto overscroll-contain transition-colors ${
                  isDropTarget ? 'bg-[var(--tf-accent-soft)]' : ''
                }`}
              >
                {isLoading ? (
                  <div className="h-14 rounded-md bg-[var(--tf-elevated)] animate-pulse" />
                ) : groupLinks.length === 0 ? (
                  <EmptyLaneState
                    group={group}
                    isDragOver={isDropTarget}
                    onAddViaModal={(folderId) =>
                      onOpenAddModal(LinkStatus.UNREAD, folderId)
                    }
                    onQuickSaveUrl={async (url, folderId) => {
                      const created = await addLink({
                        url,
                        folder_id: folderId,
                        tags: ['saved-tab'],
                        status: LinkStatus.UNREAD,
                      });
                      return Boolean(created);
                    }}
                  />
                ) : (
                  <SortableContext
                    items={groupLinks.map((l) => l.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {(() => {
                      const { items } = clusterGroupLinksBySource(groupLinks);
                      return (
                        <>
                          {items.map((entry) =>
                            entry.type === 'subgroup' ? (
                              <TabSubGroupBlock
                                key={entry.subGroup.key}
                                subGroup={entry.subGroup}
                                groupId={group.id}
                                cardDensity={cardDensity}
                                draggedLinkId={draggedLinkId}
                                highlightedLinkId={highlightedLinkId}
                                linkDropTarget={linkDropTarget}
                                onUpdateLinkMeta={updateLink}
                                onDelete={deleteLink}
                                onDragStart={handleDragStart}
                                onDragEnd={handleLinkDragEnd}
                                onDragOverLink={handleDragOverLink}
                                onDropOnLink={handleDropOnLink}
                              />
                            ) : (
                              <TabLinkRow
                                key={entry.link.id}
                                link={entry.link}
                                groupId={group.id}
                                cardDensity={cardDensity}
                                isDragging={draggedLinkId === entry.link.id}
                                isHighlighted={
                                  highlightedLinkId === entry.link.id
                                }
                                dropPosition={
                                  linkDropTarget?.groupId === group.id &&
                                  linkDropTarget?.linkId === entry.link.id &&
                                  draggedLinkId !== entry.link.id
                                    ? linkDropTarget.position
                                    : null
                                }
                                onUpdateLinkMeta={updateLink}
                                onDelete={deleteLink}
                                onDragStart={handleDragStart}
                                onDragEnd={handleLinkDragEnd}
                                onDragOverLink={handleDragOverLink}
                                onDropOnLink={handleDropOnLink}
                              />
                            )
                          )}
                        </>
                      );
                    })()}

                    {isDropTarget &&
                      (!linkDropTarget ||
                        linkDropTarget.groupId !== group.id) && (
                        <div className="rounded-md border border-dashed border-[var(--tf-accent)] bg-[var(--tf-accent-soft)] px-3 py-2 text-center text-[11px] font-medium text-[var(--tf-accent-text)]">
                          {t.board.dropToAdd(group.name)}
                        </div>
                      )}
                  </SortableContext>
                )}
              </div>
            </FolderDroppableWrapper>
          );
        })}

        {/* Dedicated "Drop to Create New Tab Group" Zone at the end of the Board */}
        {!isLoading && visibleGroups.length > 0 && (
          <section
            ref={setNewGroupDropNodeRef}
            id="tab-group-drop-new"
            data-testid="drop-new-tab-group-zone"
            aria-label={t.board.dropNewGroupTitle}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragOverGroupId !== '__new_group_drop__') {
                setDragOverGroupId('__new_group_drop__');
              }
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                if (dragOverGroupId === '__new_group_drop__') {
                  setDragOverGroupId(null);
                }
              }
            }}
            onDrop={handleDropToCreateNewGroup}
            className={`w-[240px] sm:w-[250px] md:w-[270px] shrink-0 rounded-lg border border-dashed p-4 flex flex-col items-center justify-center text-center gap-2.5 transition-all select-none ${
              dragOverGroupId === '__new_group_drop__' ||
              isDndOverNewGroup ||
              dndIsOverNewGroupZone
                ? 'border-[var(--tf-accent)] bg-[var(--tf-accent-soft)] ring-1 ring-[var(--tf-accent)] min-h-[210px]'
                : 'border-[var(--tf-border)] bg-[var(--tf-surface)]/45 hover:border-[var(--tf-border-strong)] hover:bg-[var(--tf-surface)]/80 min-h-[180px]'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-colors ${
                dragOverGroupId === '__new_group_drop__' ||
                isDndOverNewGroup ||
                dndIsOverNewGroupZone
                  ? 'border-[var(--tf-accent)] bg-[var(--tf-elevated)] text-[var(--tf-accent)]'
                  : 'border-[var(--tf-border)] bg-[var(--tf-elevated)] text-[var(--tf-text-secondary)]'
              }`}
            >
              <FolderPlus className="w-4 h-4" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xs font-semibold text-[var(--tf-text)]">
                {isImportingGroup
                  ? t.board.creatingGroupStatus
                  : dragOverGroupId === '__new_group_drop__' ||
                    isDndOverNewGroup ||
                    dndIsOverNewGroupZone
                  ? t.board.dropNewGroupActive
                  : t.board.dropNewGroupTitle}
              </h3>
              <p className="text-[11px] text-[var(--tf-text-muted)] leading-relaxed">
                {t.board.dropNewGroupSubtext}
              </p>
            </div>

            {onOpenImportModal && (
              <button
                type="button"
                onClick={onOpenImportModal}
                className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium border border-[var(--tf-border)] bg-[var(--tf-elevated)] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:border-[var(--tf-border-strong)] transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3 h-3" />
                <span>{t.board.dropNewGroupPasteHint}</span>
              </button>
            )}
          </section>
        )}
      </div>

      {/* Bottom Tab Selection Row for Quick Navigation */}
      {folders.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 sm:bottom-5 z-20 flex justify-center px-2.5 sm:px-4">
          <nav
            aria-label={t.board.bottomNavAria}
            onWheel={handleBottomNavWheel}
            className="pointer-events-auto flex items-center gap-1 px-1 py-0.5 sm:px-1.5 sm:py-1 rounded-lg border border-[var(--tf-border-strong)] bg-[var(--tf-elevated)] backdrop-blur-md shadow-2xl max-w-full overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            <button
              type="button"
              onClick={() => handleScrollBoardBy(-320)}
              aria-label={t.board.scrollLeftAria}
              title={t.board.scrollLeftTitle}
              className="p-1 rounded-md text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-surface)] transition-colors shrink-0"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {folders.map((group) => {
              const colorKey: TabGroupColor = group.color ?? 'blue';
              const style = groupStyles[colorKey] ?? groupStyles.blue;
              const count = links.filter((l) => l.folder_id === group.id).length;
              const isSelected =
                activeFolderId === group.id || focusedGroupId === group.id;
              const isNativeDropTarget = dragOverGroupId === group.id;

              return (
                <BottomNavFolderButton
                  key={group.id}
                  group={group}
                  style={style}
                  count={count}
                  isSelected={isSelected}
                  isNativeDropTarget={isNativeDropTarget}
                  onClick={() => {
                    if (group.collapsed) {
                      updateFolder(group.id, { collapsed: false });
                    }
                    handleSelectBottomTab(group.id);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverGroupId !== group.id) {
                      setDragOverGroupId(group.id);
                    }
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      if (dragOverGroupId === group.id) {
                        setDragOverGroupId(null);
                      }
                    }
                  }}
                  onDrop={(e) => handleDropOnGroup(e, group.id)}
                />
              );
            })}

            <button
              type="button"
              onClick={() => handleScrollBoardBy(320)}
              aria-label={t.board.scrollRightAria}
              title={t.board.scrollRightTitle}
              className="p-1 rounded-md text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-surface)] transition-colors shrink-0"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}
