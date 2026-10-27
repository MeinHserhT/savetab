'use client';

import React, { useState } from 'react';
import { CheckCircle2, Code2, Play, ShieldAlert } from 'lucide-react';
import { ScrapedMetadata } from '@/lib/types';

const EDGE_CASE_FIXTURES = [
  {
    id: 'complete-og',
    name: 'Complete OpenGraph + Relative Favicon',
    url: 'https://design.ch/essays/grid-systems',
    html: `<!doctype html>
<html>
  <head>
    <title>Fallback Title</title>
    <meta property="og:title" content="Grid Systems in Graphic Design &amp; UI" />
    <meta property="og:description" content="A comprehensive treatise on Swiss typographic grids and spatial precision." />
    <meta property="og:image" content="/covers/swiss-grid.svg" />
    <link rel="icon" href="../assets/favicon-32.png" />
  </head>
  <body><article>Swiss International Style modular typography...</article></body>
</html>`,
  },
  {
    id: 'paywall-zero-meta',
    name: 'Paywall / Zero Meta Tags / Malformed HTML',
    url: 'https://archive.example.org/papers/zero-copy-simd-kernels.html',
    html: `<html><head></head><body><div>HTTP 403 Paywall — Subscription Required to view meta`,
  },
  {
    id: 'twitter-card-only',
    name: 'Twitter Card Only + Missing Favicon Link',
    url: 'https://systems.io/blog/raft-quorum-leases',
    html: `<!doctype html>
<html>
  <head>
    <meta name="twitter:title" content="Raft Quorum Leases &amp; Low-Latency Reads" />
    <meta name="twitter:description" content="Bypassing log replication round-trips on linearizable read queries." />
  </head>
  <body><p>Detailed protocol analysis.</p></body>
</html>`,
  },
];

export function ScraperLabView() {
  const [selectedFixture, setSelectedFixture] = useState(EDGE_CASE_FIXTURES[0]);
  const [urlInput, setUrlInput] = useState(EDGE_CASE_FIXTURES[0].url);
  const [htmlInput, setHtmlInput] = useState(EDGE_CASE_FIXTURES[0].html);
  const [result, setResult] = useState<ScrapedMetadata | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const handleRunParser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRunning(true);
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: urlInput,
          htmlFixture: htmlInput,
        }),
      });
      const data = await res.json();
      if (data.metadata) {
        setResult(data.metadata);
      }
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="flex-1 p-6 max-w-6xl mx-auto w-full space-y-6">
      <div className="border-b border-zinc-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">
            Defensive Metadata Scraper Sandbox
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Verify OpenGraph extraction, relative URL resolution, and graceful
            fallback on malformed or paywalled HTML fixtures.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {EDGE_CASE_FIXTURES.map((fixture) => (
            <button
              key={fixture.id}
              type="button"
              onClick={() => {
                setSelectedFixture(fixture);
                setUrlInput(fixture.url);
                setHtmlInput(fixture.html);
                setResult(null);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                selectedFixture.id === fixture.id
                  ? 'bg-zinc-100 text-zinc-950 border-zinc-100'
                  : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800'
              }`}
            >
              {fixture.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form
          onSubmit={handleRunParser}
          className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
              <Code2 className="w-4 h-4 text-sky-400" />
              Input URL &amp; Raw HTML Fixture
            </span>
            <button
              type="submit"
              disabled={isRunning}
              className="px-3.5 py-1.5 text-xs font-medium bg-zinc-100 hover:bg-white text-zinc-950 rounded-md inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Execute Scraper</span>
            </button>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="scraper-lab-url"
              className="text-xs text-zinc-400 block"
            >
              Origin Request URL
            </label>
            <input
              id="scraper-lab-url"
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono bg-zinc-950 border border-zinc-800 rounded text-zinc-100"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="scraper-lab-html"
              className="text-xs text-zinc-400 block"
            >
              Simulated HTML Payload (Edit to test malformed tags)
            </label>
            <textarea
              id="scraper-lab-html"
              rows={9}
              value={htmlInput}
              onChange={(e) => setHtmlInput(e.target.value)}
              className="w-full p-3 text-xs font-mono bg-zinc-950 border border-zinc-800 rounded text-zinc-200 leading-relaxed"
            />
          </div>
        </form>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <span className="text-xs font-semibold text-zinc-200">
                Normalized Scraper Contract Output
              </span>
              {result && (
                <span className="text-xs font-mono flex items-center gap-1.5 text-zinc-300">
                  {result.scrape_status === 'ok' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  status: {result.scrape_status}
                </span>
              )}
            </div>

            {result ? (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-zinc-800/70">
                  <span className="text-zinc-500">Resolved Title</span>
                  <span className="col-span-2 text-zinc-100 font-medium">
                    {result.title}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-zinc-800/70">
                  <span className="text-zinc-500">Description</span>
                  <span className="col-span-2 text-zinc-300">
                    {result.description}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-zinc-800/70">
                  <span className="text-zinc-500">Resolved Favicon</span>
                  <span className="col-span-2 font-mono text-sky-400 break-all">
                    {result.favicon}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-zinc-800/70">
                  <span className="text-zinc-500">Resolved Image</span>
                  <span className="col-span-2 font-mono text-zinc-300 break-all">
                    {result.image_url ?? 'null (Triggers Zero-CLS SVG Fallback)'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-zinc-800/70">
                  <span className="text-zinc-500">Reading Estimate</span>
                  <span className="col-span-2 font-mono tabular-nums text-zinc-200">
                    {result.reading_minutes} min read
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-1.5">
                  <span className="text-zinc-500">Diagnostics</span>
                  <span className="col-span-2 font-mono text-zinc-400">
                    {result.diagnostics}
                  </span>
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-xs text-zinc-500">
                Select a fixture and click &ldquo;Execute Scraper&rdquo; to
                inspect output.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
