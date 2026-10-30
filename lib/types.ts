export enum LinkStatus {
  UNREAD = 'UNREAD',
  READING = 'READING',
  ARCHIVED = 'ARCHIVED',
}

export type TabGroupColor =
  | 'blue'
  | 'cyan'
  | 'emerald'
  | 'amber'
  | 'orange'
  | 'red'
  | 'rose'
  | 'purple'
  | 'indigo'
  | 'zinc';

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
