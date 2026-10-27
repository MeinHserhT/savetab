'use client';

import React from 'react';

const SQL_SCHEMA_DEFINITION = `
-- Phase 2: Minimal Relational Schema (SQLite / PostgreSQL / Prisma Equivalent)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE folders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE links (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  favicon TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('UNREAD', 'READING', 'ARCHIVED')) DEFAULT 'UNREAD',
  order_index INTEGER NOT NULL DEFAULT 0,
  reading_minutes INTEGER NOT NULL DEFAULT 5,
  tags_json TEXT NOT NULL DEFAULT '[]',
  scrape_status TEXT NOT NULL DEFAULT 'ok',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_links_user_status_order ON links(user_id, status, order_index);
CREATE INDEX idx_links_folder ON links(folder_id);
`.trim();

const EDGE_CASE_MATRIX = [
  {
    scenario: '1. Paywalled / 403 / 404 or Timeout Origins',
    layer: 'Backend Scraper (/lib/scraper.ts)',
    resolution:
      'AbortController enforces a 4,500ms timeout with realistic desktop User-Agent headers. Non-200 responses or network timeouts synthesize a clean human-readable title from URL path segments, set scrape_status = "degraded", and resolve favicon to ${origin}/favicon.ico.',
  },
  {
    scenario: '2. Zero Meta Tags or Malformed Unclosed HTML',
    layer: 'HTML Parser (parseHtmlMetadata)',
    resolution:
      'Regex extractors inspect og:*, twitter:*, and <title> in priority order. If all tags are empty or missing, humanizeFallbackTitle(url) generates a deterministic title and reading_minutes defaults to word-count estimation.',
  },
  {
    scenario: '3. Moving a Card to an Empty Lane',
    layer: 'Kanban State Engine (moveAndReorderLinks)',
    resolution:
      'Clamps targetIndex to [0, destinationList.length] so dropping into an empty lane assigns order_index = 0 while re-indexing the source lane to contiguous 0..n-1 integers.',
  },
  {
    scenario: '4. Reordering Items Within the Same Lane',
    layer: 'Kanban State Engine + Optimistic Store',
    resolution:
      'Removes the moving card from its current lane slice, splices it at targetIndex, and recalculates order_index across all items synchronously before syncing via PUT /api/links/:id.',
  },
  {
    scenario: '5. Broken Preview Image URLs or Missing og:image',
    layer: 'Frontend Component (LinkCard.tsx)',
    resolution:
      'Fixed aspect-video container prevents Cumulative Layout Shift (CLS). onError handler flips coverFailed = true, rendering a Swiss Minimalist grid fallback container with domain & reading time.',
  },
];

export function SystemSpecView() {
  return (
    <div className="flex-1 p-6 max-w-6xl mx-auto w-full space-y-8">
      <div className="border-b border-zinc-800 pb-4">
        <h1 className="text-xl font-semibold text-zinc-100">
          Multi-Agent Architecture &amp; QA Verification Specification
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Complete 4-Phase engineering artifacts: Design Tokens, Relational SQL
          Schema, and Deterministic Edge-Case Matrix.
        </p>
      </div>

      {/* Phase 1 & 4 Edge Case Matrix */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-200">
          01. Deterministic Edge-Case Verification Matrix
        </h2>
        <div className="rounded-lg border border-zinc-800 overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400">
                <th className="py-2.5 px-4 font-medium">Edge Case Scenario</th>
                <th className="py-2.5 px-4 font-medium">Responsible Layer</th>
                <th className="py-2.5 px-4 font-medium">
                  Deterministic Recovery Mechanism
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80 bg-zinc-950">
              {EDGE_CASE_MATRIX.map((row) => (
                <tr key={row.scenario} className="hover:bg-zinc-900/40">
                  <td className="py-3 px-4 font-medium text-zinc-200 align-top whitespace-nowrap">
                    {row.scenario}
                  </td>
                  <td className="py-3 px-4 font-mono text-sky-400 align-top whitespace-nowrap">
                    {row.layer}
                  </td>
                  <td className="py-3 px-4 text-zinc-400 leading-relaxed">
                    {row.resolution}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Phase 2 SQL Schema */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-200">
          02. Relational Database Schema (SQLite / PostgreSQL)
        </h2>
        <pre className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/60 text-xs font-mono text-zinc-300 overflow-x-auto leading-relaxed">
          {SQL_SCHEMA_DEFINITION}
        </pre>
      </section>
    </div>
  );
}
