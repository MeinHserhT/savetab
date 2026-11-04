export type ThemeMode = 'dark' | 'light';

export enum LinkStatus {
  UNREAD = 'UNREAD',
  READING = 'READING',
  ARCHIVED = 'ARCHIVED',
}

/**
 * Ordered along the color spectrum (6x4 grid):
 * Row 1 (Warm: Red -> Yellow): crimson, red, coral, orange, amber, yellow
 * Row 2 (Cool Greens -> Cyan, opposing Row 1): lime, green, emerald, mint, teal, cyan
 * Row 3 (Blues -> Violet -> Fuchsia, opposing Row 1/2): blue, ocean, indigo, violet, purple, fuchsia
 * Row 4 (Rose/Pink & Contrasting Earth/Neutrals): rose, pink, gold, bronze, slate, zinc
 */
export const TAB_GROUP_COLORS = [
  'crimson',
  'red',
  'coral',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'mint',
  'teal',
  'cyan',
  'blue',
  'ocean',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'rose',
  'pink',
  'gold',
  'bronze',
  'slate',
  'zinc',
] as const;

export type TabGroupColor = (typeof TAB_GROUP_COLORS)[number];

export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface Folder {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  order_index: number;
  color?: TabGroupColor;
  collapsed?: boolean;
}

export interface LinkItem {
  id: string;
  user_id: string;
  folder_id: string | null;
  url: string;
  domain: string;
  title: string;
  description: string;
  image_url: string | null;
  favicon: string;
  status: LinkStatus;
  order_index: number;
  reading_minutes: number;
  video_duration?: string | null;
  channel_name?: string | null;
  tags: string[];
  scrape_status: 'ok' | 'degraded' | 'manual';
  created_at: string;
  updated_at: string;
}

export interface ScrapedMetadata {
  url: string;
  domain: string;
  title: string;
  description: string;
  image_url: string | null;
  favicon: string;
  reading_minutes: number;
  video_duration?: string | null;
  channel_name?: string | null;
  scrape_status: 'ok' | 'degraded';
  diagnostics?: string;
}
