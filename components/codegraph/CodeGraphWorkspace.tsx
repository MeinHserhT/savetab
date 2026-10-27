'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  GitBranch,
  Search,
  ArrowRight,
  Layers,
  Code2,
  Route,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  FileCode,
  CornerDownRight,
  ShieldAlert,
  ChevronRight,
  Terminal,
} from 'lucide-react';
import {
  CodeGraphSnapshot,
  CodeNode,
  findSymbolFlow,
  NodeKind,
} from '@/lib/codegraph-engine';

export type CodeGraphViewMode =
  | 'map'
  | 'symbol'
  | 'flow'
  | 'entries'
  | 'dead';

const KIND_ACCENT: Record<NodeKind, string> = {
  file: 'text-zinc-400 border-zinc-700/80 bg-zinc-900/90',
  module: 'text-zinc-300 border-zinc-700/80 bg-zinc-900/90',
  route: 'text-emerald-400 border-emerald-500/30 bg-emerald-950/30',
  component: 'text-sky-400 border-sky-500/30 bg-sky-950/30',
  function: 'text-amber-400 border-amber-500/30 bg-amber-950/30',
  method: 'text-amber-300 border-amber-500/30 bg-amber-950/30',
  class: 'text-purple-400 border-purple-500/30 bg-purple-950/30',
  interface: 'text-teal-400 border-teal-500/30 bg-teal-950/30',
  type_alias: 'text-teal-300 border-teal-500/30 bg-teal-950/30',
  constant: 'text-zinc-300 border-zinc-700 bg-zinc-900',
};

export function CodeGraphWorkspace() {
  const [snapshot, setSnapshot] = useState<CodeGraphSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [activeView, setActiveView] = useState<CodeGraphViewMode>('symbol');
  const [activePreset, setActivePreset] = useState<'workspace' | 'codegraph-repo'>('workspace');
  const [repoUrlInput, setRepoUrlInput] = useState<string>(
    'https://github.com/colbymchenry/codegraph.git'
  );
  const [isIndexingRepo, setIsIndexingRepo] = useState<boolean>(false);

  // Selected symbol & breadcrumb navigation trail
  const [selectedSymbolId, setSelectedSymbolId] = useState<string | null>(null);
  const [trailIds, setTrailIds] = useState<string[]>([]);

  // Architecture Map selected module
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);

  // Flow view state
  const [flowFromId, setFlowFromId] = useState<string>('');
  const [flowToId, setFlowToId] = useState<string>('');

  // Search query
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [showFullFile, setShowFullFile] = useState<boolean>(false);

  const loadPresetGraph = async (preset: 'workspace' | 'codegraph-repo') => {
    setIsLoading(true);
    setError(null);
    setActivePreset(preset);
    try {
      const res = await fetch(`/api/codegraph?preset=${preset}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load CodeGraph index');
      }
      applyNewSnapshot(data as CodeGraphSnapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load CodeGraph');
    } finally {
      setIsLoading(false);
    }
  };

  const handleIndexGitHubRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrlInput.trim()) return;
    setIsIndexingRepo(true);
    setError(null);
    try {
      const res = await fetch('/api/codegraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: repoUrlInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to index repository');
      }
      applyNewSnapshot(data as CodeGraphSnapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error indexing GitHub repository');
    } finally {
      setIsIndexingRepo(false);
    }
  };

  const applyNewSnapshot = (data: CodeGraphSnapshot) => {
    setSnapshot(data);
    const symbolNodes = data.nodes.filter((n) => n.kind !== 'file');
    // Pick an interesting initial symbol with both callers or callees
    const preferred =
      symbolNodes.find((n) => n.name === 'KanbanBoard') ||
      symbolNodes.find((n) => n.name === 'runIndexPipeline') ||
      symbolNodes.find((n) => n.name === 'indexSourceFiles') ||
      symbolNodes.find((n) => n.name === 'POST') ||
      symbolNodes[0];

    if (preferred) {
      setSelectedSymbolId(preferred.id);
      setTrailIds([preferred.id]);
    }
    if (data.architecture.nodes.length > 0) {
      setSelectedFilePath(data.architecture.nodes[0].filePath);
    }

    // Initialize flow endpoints with a valid multi-hop path if available
    const entryCandidate =
      symbolNodes.find((n) => n.name === 'HomePage') ||
      symbolNodes.find((n) => n.name === 'GET') ||
      symbolNodes.find((n) => n.name === 'POST') ||
      symbolNodes[0];
    const targetCandidate =
      symbolNodes.find((n) => n.name === 'EmptyLaneState') ||
      symbolNodes.find((n) => n.name === 'createGraphStore') ||
      symbolNodes.find((n) => n.name === 'scrapeMetadata') ||
      symbolNodes[symbolNodes.length - 1];

    if (entryCandidate && targetCandidate) {
      setFlowFromId(entryCandidate.id);
      setFlowToId(targetCandidate.id);
    }
  };

  useEffect(() => {
    loadPresetGraph('workspace');
  }, []);

  const symbolNodes = useMemo(
    () => (snapshot ? snapshot.nodes.filter((n) => n.kind !== 'file') : []),
    [snapshot]
  );

  const nodeMap = useMemo(
    () => new Map<string, CodeNode>((snapshot?.nodes || []).map((n) => [n.id, n])),
    [snapshot]
  );

  const selectedSymbol = useMemo(
    () => (selectedSymbolId ? nodeMap.get(selectedSymbolId) || null : null),
    [nodeMap, selectedSymbolId]
  );

  const walkToSymbol = (symbolId: string) => {
    if (!nodeMap.has(symbolId)) return;
    setSelectedSymbolId(symbolId);
    setTrailIds((prev) => {
      const existingIdx = prev.indexOf(symbolId);
      if (existingIdx !== -1) {
        return prev.slice(0, existingIdx + 1);
      }
      return [...prev.slice(-9), symbolId];
    });
    if (activeView !== 'symbol') {
      setActiveView('symbol');
    }
  };

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return symbolNodes.slice(0, 12);
    const q = searchQuery.toLowerCase();
    return symbolNodes
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.filePath.toLowerCase().includes(q) ||
          s.kind.toLowerCase().includes(q)
      )
      .slice(0, 16);
  }, [symbolNodes, searchQuery]);

  const activeFlow = useMemo(() => {
    if (!snapshot || !flowFromId || !flowToId) return null;
    return findSymbolFlow(snapshot, flowFromId, flowToId);
  }, [snapshot, flowFromId, flowToId]);

  // Group architecture modules by layer for clean DAG rendering
  const layeredArchitecture = useMemo(() => {
    if (!snapshot) return [];
    const groups = new Map<number, { layer: number; layerName: string; nodes: typeof snapshot.architecture.nodes }>();
    for (const mod of snapshot.architecture.nodes) {
      const existing = groups.get(mod.layer) || {
        layer: mod.layer,
        layerName: mod.layerName,
        nodes: [],
      };
      existing.nodes.push(mod);
      groups.set(mod.layer, existing);
    }
    return Array.from(groups.values()).sort((a, b) => a.layer - b.layer);
  }, [snapshot]);

  if (isLoading && !snapshot) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-950 text-zinc-400 p-12 font-mono text-sm">
        <RefreshCw className="w-4 h-4 mr-2.5 animate-spin text-sky-400" />
        Indexing AST symbols, cross-file call edges, and blast radius...
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-950 text-rose-400 p-12 font-mono text-sm">
        {error || 'Unable to initialize CodeGraph.'}
      </div>
    );
  }

  const callers = selectedSymbol ? snapshot.callersBySymbol[selectedSymbol.id] || [] : [];
  const callees = selectedSymbol ? snapshot.calleesBySymbol[selectedSymbol.id] || [] : [];
  const blast = selectedSymbol ? snapshot.blastRadiusBySymbol[selectedSymbol.id] : null;
  const currentFileRecord = selectedSymbol ? snapshot.files[selectedSymbol.filePath] : null;

  // Map call-site line numbers inside the selected symbol to their callee references
  const calleesByLine = new Map<number, typeof callees>();
  for (const c of callees) {
    const list = calleesByLine.get(c.callSiteLine) || [];
    list.push(c);
    calleesByLine.set(c.callSiteLine, list);
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-zinc-950 text-zinc-100">
      {/* CODEGRAPH TOP CONTROL BAR (Modeled on colbymchenry/codegraph TopBar.svelte) */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-2.5 border-b border-zinc-800/90 bg-zinc-900/50">
        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1" role="tablist" aria-label="CodeGraph Views">
          {(
            [
              { id: 'symbol', label: 'Symbol', icon: Code2 },
              { id: 'map', label: 'Architecture Map', icon: Layers },
              { id: 'flow', label: 'Call Flow', icon: GitBranch },
              {
                id: 'entries',
                label: `Entry Points (${snapshot.stats.entryPointCount})`,
                icon: Route,
              },
              {
                id: 'dead',
                label: `Dead Code (${snapshot.stats.deadCodeCount})`,
                icon: AlertTriangle,
              },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeView === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveView(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-sky-500/15 text-sky-300 border border-sky-500/40'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70 border border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Center Symbol Search Palette Trigger + Input */}
        <div className="relative flex-1 max-w-xs min-w-[220px]">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-zinc-950 border border-zinc-800 focus-within:border-sky-500/60">
            <Search className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setIsSearchOpen(true)}
              onBlur={() => setTimeout(() => setIsSearchOpen(false), 180)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              placeholder="Jump to symbol or file..."
              aria-label="Search symbols in CodeGraph"
              className="w-full bg-transparent text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none font-mono"
            />
            <span className="text-[10px] font-mono text-zinc-500 border border-zinc-800 px-1 rounded">
              /
            </span>
          </div>

          {isSearchOpen && searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-zinc-900 border border-zinc-700 rounded shadow-2xl max-h-72 overflow-y-auto divide-y divide-zinc-800/60">
              {searchResults.map((sym) => (
                <button
                  key={sym.id}
                  type="button"
                  onMouseDown={() => {
                    walkToSymbol(sym.id);
                    setIsSearchOpen(false);
                  }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-zinc-800/80 transition-colors cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-mono font-medium text-zinc-100 truncate">
                      {sym.name}
                    </div>
                    <div className="text-[11px] font-mono text-zinc-400 truncate">
                      {sym.filePath}:{sym.startLine}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border shrink-0 ${KIND_ACCENT[sym.kind]}`}
                  >
                    {sym.kind}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Repository Target Switcher + Telemetry Stats */}
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded border border-zinc-800 bg-zinc-950 p-0.5">
            <button
              type="button"
              onClick={() => loadPresetGraph('workspace')}
              className={`px-2.5 py-1 text-[11px] font-mono rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activePreset === 'workspace'
                  ? 'bg-zinc-800 text-zinc-100 font-medium'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Live Workspace
            </button>
            <button
              type="button"
              onClick={() => loadPresetGraph('codegraph-repo')}
              className={`px-2.5 py-1 text-[11px] font-mono rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activePreset === 'codegraph-repo'
                  ? 'bg-zinc-800 text-zinc-100 font-medium'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              colbymchenry/codegraph
            </button>
          </div>

          <div className="hidden xl:flex items-center gap-2 text-xs font-mono text-zinc-400 tabular-nums whitespace-nowrap shrink-0">
            <span className="text-zinc-200 font-semibold">{snapshot.stats.symbolCount}</span>
            <span>symbols</span>
            <span className="text-zinc-700">·</span>
            <span className="text-zinc-200 font-semibold">{snapshot.stats.edgeCount}</span>
            <span>edges</span>
            <span className="text-zinc-700">·</span>
            <span className="text-zinc-200 font-semibold">{snapshot.stats.fileCount}</span>
            <span>files</span>
          </div>
        </div>
      </div>

      {/* SUB-BAR: GitHub Repository Indexer Bar + Active Symbol TrailBar */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-2 border-b border-zinc-800/80 bg-zinc-950">
        {/* TrailBar (Visited Symbol Hop Breadcrumbs) */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 min-w-0">
          <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 mr-1 shrink-0">
            Trail:
          </span>
          {trailIds.map((id, idx) => {
            const node = nodeMap.get(id);
            if (!node) return null;
            const isCurrent = id === selectedSymbolId;
            return (
              <React.Fragment key={`${id}-${idx}`}>
                {idx > 0 && <ChevronRight className="w-3 h-3 text-zinc-600 shrink-0" />}
                <button
                  type="button"
                  onClick={() => walkToSymbol(id)}
                  className={`px-2 py-0.5 text-xs font-mono rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isCurrent
                      ? 'bg-sky-500/15 border-sky-500/40 text-sky-300 font-medium'
                      : 'bg-zinc-900/70 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {node.name}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* GitHub Repo Live Indexer Form */}
        <form onSubmit={handleIndexGitHubRepo} className="flex items-center gap-2 shrink-0">
          <Terminal className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <input
            type="url"
            value={repoUrlInput}
            onChange={(e) => setRepoUrlInput(e.target.value)}
            placeholder="https://github.com/colbymchenry/codegraph.git"
            aria-label="GitHub repository URL to index"
            className="w-64 sm:w-72 px-2.5 py-1 text-xs font-mono bg-zinc-900 border border-zinc-800 rounded text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-sky-500"
          />
          <button
            type="submit"
            disabled={isIndexingRepo}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-medium rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isIndexingRepo ? 'animate-spin text-sky-400' : ''}`} />
            <span>{isIndexingRepo ? 'Indexing...' : 'Index Repo'}</span>
          </button>
        </form>
      </div>

      {error && (
        <div className="px-6 py-2 bg-rose-950/50 border-b border-rose-500/30 text-xs font-mono text-rose-300">
          {error}
        </div>
      )}

      {/* VIEW 1: 3-PANE SYMBOL INSPECTOR (Callers | Source + Blast Radius | Callees) */}
      {activeView === 'symbol' && selectedSymbol && (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-zinc-800/90">
          {/* LEFT RAIL: Incoming Callers ("Who calls this symbol") */}
          <aside className="lg:col-span-3 flex flex-col min-h-0 bg-zinc-950">
            <div className="px-4 py-3 border-b border-zinc-800/80 flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                Callers · Incoming
              </span>
              <span className="text-xs font-mono text-zinc-400 tabular-nums">
                {callers.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-zinc-900">
              {callers.length === 0 ? (
                <div className="p-5 text-xs font-mono text-zinc-400 leading-relaxed">
                  0 incoming callers in workspace.{' '}
                  {selectedSymbol.exported
                    ? 'This symbol is an exported root or entry point.'
                    : 'This symbol is unreferenced.'}
                </div>
              ) : (
                callers.map((caller) => (
                  <button
                    key={caller.edgeId}
                    type="button"
                    onClick={() => walkToSymbol(caller.callerId)}
                    className="w-full p-3.5 text-left hover:bg-zinc-900/70 transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-mono font-semibold text-zinc-100 group-hover:text-sky-400 transition-colors truncate">
                        {caller.callerName}
                      </span>
                      <span
                        className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border shrink-0 ${KIND_ACCENT[caller.callerKind]}`}
                      >
                        {caller.edgeKind}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-zinc-400 mb-1.5 truncate tabular-nums">
                      {caller.filePath}:{caller.line}
                    </div>
                    <pre className="text-[11px] font-mono text-zinc-300 bg-zinc-900/90 border border-zinc-800/80 rounded px-2 py-1 overflow-x-auto">
                      {caller.snippet}
                    </pre>
                  </button>
                ))
              )}
            </div>
          </aside>

          {/* CENTER STAGE: Symbol Header, Source Code with Line-Anchored Ports, and Blast Radius Strip */}
          <section className="lg:col-span-6 flex flex-col min-h-0 bg-zinc-950">
            {/* Symbol Header Card */}
            <div className="px-5 py-3.5 border-b border-zinc-800/90 bg-zinc-900/30 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 mb-1">
                  <span
                    className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${KIND_ACCENT[selectedSymbol.kind]}`}
                  >
                    {selectedSymbol.kind}
                  </span>
                  <h2 className="text-base font-bold font-mono text-zinc-50 truncate">
                    {selectedSymbol.name}
                  </h2>
                  {selectedSymbol.exported && (
                    <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">
                      exported
                    </span>
                  )}
                </div>
                <div className="text-xs font-mono text-zinc-400 tabular-nums">
                  {selectedSymbol.filePath} · Lines {selectedSymbol.startLine}–
                  {selectedSymbol.endLine} ({selectedSymbol.loc} LOC)
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowFullFile((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono text-zinc-300 hover:bg-zinc-800 border border-zinc-700 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>{showFullFile ? 'Focus Symbol' : 'Show Full File'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFlowFromId(selectedSymbol.id);
                    setActiveView('flow');
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono text-sky-400 hover:bg-sky-500/10 border border-sky-500/30 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>Trace Flow From Here</span>
                </button>
              </div>
            </div>

            {/* Source Viewer with Line Highlighting & Outgoing Call Ports */}
            <div className="flex-1 overflow-y-auto font-mono text-xs bg-zinc-950 py-2">
              {currentFileRecord ? (
                currentFileRecord.lines.map((lineText, idx) => {
                  const lineNumber = idx + 1;
                  const minVisible = Math.max(1, selectedSymbol.startLine - 4);
                  const maxVisible = Math.min(
                    currentFileRecord.lines.length,
                    selectedSymbol.endLine + 4
                  );
                  if (!showFullFile && (lineNumber < minVisible || lineNumber > maxVisible)) {
                    return null;
                  }

                  const isInsideSymbol =
                    lineNumber >= selectedSymbol.startLine &&
                    lineNumber <= selectedSymbol.endLine;
                  const isDeclarationLine = lineNumber === selectedSymbol.startLine;
                  const lineCallees = calleesByLine.get(lineNumber) || [];

                  return (
                    <div
                      key={lineNumber}
                      className={`flex items-start px-4 py-0.5 leading-5 ${
                        isDeclarationLine
                          ? 'bg-sky-500/15 border-l-2 border-sky-400 text-zinc-50'
                          : isInsideSymbol
                            ? 'bg-zinc-900/40 border-l-2 border-zinc-700 text-zinc-200'
                            : 'text-zinc-500 opacity-65'
                      }`}
                    >
                      <span className="w-10 select-none text-right pr-3 text-[11px] font-mono text-zinc-500 tabular-nums shrink-0">
                        {lineNumber}
                      </span>
                      <pre className="flex-1 overflow-x-auto whitespace-pre">
                        {lineText || ' '}
                      </pre>
                      {lineCallees.length > 0 && (
                        <div className="flex items-center gap-1 ml-2 shrink-0">
                          {lineCallees.map((callee) => (
                            <button
                              key={callee.edgeId}
                              type="button"
                              onClick={() => walkToSymbol(callee.calleeId)}
                              title={`Jump to callee ${callee.calleeName}`}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-colors cursor-pointer"
                            >
                              <ArrowRight className="w-2.5 h-2.5" />
                              <span>{callee.calleeName}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-zinc-400">Source file unavailable.</div>
              )}
            </div>

            {/* Bottom Blast Radius / Impact Strip */}
            {blast && (
              <div className="px-5 py-3 border-t border-zinc-800/90 bg-zinc-900/60 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <ShieldAlert
                    className={`w-4 h-4 ${
                      blast.riskLevel === 'HIGH'
                        ? 'text-rose-400'
                        : blast.riskLevel === 'MODERATE'
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                    }`}
                  />
                  <span className="text-xs font-mono uppercase tracking-wider text-zinc-300 font-semibold">
                    Blast Radius:
                  </span>
                  <span
                    className={`text-xs font-mono font-bold ${
                      blast.riskLevel === 'HIGH'
                        ? 'text-rose-400'
                        : blast.riskLevel === 'MODERATE'
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                    }`}
                  >
                    {blast.riskLevel}
                  </span>
                </div>

                <div className="flex items-center gap-5 text-xs font-mono text-zinc-300 tabular-nums">
                  <span>
                    Direct Callers:{' '}
                    <strong className="text-zinc-100">{blast.directCallers}</strong>
                  </span>
                  <span>
                    Transitive Impact:{' '}
                    <strong className="text-zinc-100">{blast.transitiveCallers}</strong> symbols
                  </span>
                  <span>
                    Affected Files:{' '}
                    <strong className="text-zinc-100">{blast.affectedFiles.length}</strong>
                  </span>
                </div>
              </div>
            )}
          </section>

          {/* RIGHT RAIL: Line-Anchored Callees ("What this symbol calls") */}
          <aside className="lg:col-span-3 flex flex-col min-h-0 bg-zinc-950">
            <div className="px-4 py-3 border-b border-zinc-800/80 flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                Callees · Outgoing
              </span>
              <span className="text-xs font-mono text-zinc-400 tabular-nums">
                {callees.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-zinc-900">
              {callees.length === 0 ? (
                <div className="p-5 text-xs font-mono text-zinc-400 leading-relaxed">
                  0 outgoing symbol calls inside this body (leaf symbol).
                </div>
              ) : (
                callees.map((callee) => (
                  <button
                    key={callee.edgeId}
                    type="button"
                    onClick={() => walkToSymbol(callee.calleeId)}
                    className="w-full p-3.5 text-left hover:bg-zinc-900/70 transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-mono font-semibold text-zinc-100 group-hover:text-amber-300 transition-colors truncate">
                        {callee.calleeName}
                      </span>
                      <span className="text-[11px] font-mono text-zinc-400 tabular-nums shrink-0">
                        L{callee.callSiteLine}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-zinc-400 mb-1.5">
                      <span className="truncate">{callee.targetFilePath}</span>
                      <span className="uppercase text-[10px] text-zinc-400">
                        {callee.edgeKind}
                      </span>
                    </div>
                    <pre className="text-[11px] font-mono text-zinc-300 bg-zinc-900/90 border border-zinc-800/80 rounded px-2 py-1 overflow-x-auto">
                      {callee.snippet}
                    </pre>
                  </button>
                ))
              )}
            </div>
          </aside>
        </div>
      )}

      {/* VIEW 2: LAYERED ARCHITECTURE MAP (Module Dependency Graph + Edge Inspector) */}
      {activeView === 'map' && (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-zinc-800/90">
          {/* Layered Module Architecture Canvas */}
          <div className="lg:col-span-8 p-6 overflow-y-auto space-y-6 bg-zinc-950">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-zinc-100">
                  Layered Module Dependency Architecture
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Select any file node to inspect cross-module imports, symbol calls, and layer boundaries.
                </p>
              </div>
              <span className="text-xs font-mono text-zinc-400 tabular-nums">
                {snapshot.architecture.nodes.length} modules · {snapshot.architecture.edges.length} cross-file links
              </span>
            </div>

            <div className="space-y-5">
              {layeredArchitecture.map((layerGroup) => (
                <div
                  key={layerGroup.layer}
                  className="border border-zinc-800/90 rounded-lg bg-zinc-900/25 p-4"
                >
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-800/70">
                    <span className="text-xs font-mono uppercase tracking-wider text-sky-400 font-semibold">
                      {layerGroup.layerName}
                    </span>
                    <span className="text-xs font-mono text-zinc-400 tabular-nums">
                      {layerGroup.nodes.length} files
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {layerGroup.nodes.map((mod) => {
                      const isSelected = selectedFilePath === mod.filePath;
                      return (
                        <button
                          key={mod.id}
                          type="button"
                          onClick={() => setSelectedFilePath(mod.filePath)}
                          className={`p-3.5 rounded border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-sky-500/10 border-sky-500/60 shadow-sm'
                              : 'bg-zinc-900/70 border-zinc-800/90 hover:border-zinc-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-mono font-bold text-zinc-100 truncate">
                              {mod.label}
                            </span>
                            <span className="text-[11px] font-mono text-zinc-400 tabular-nums">
                              {mod.loc} LOC
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-zinc-400 truncate mb-2.5">
                            {mod.filePath}
                          </div>
                          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-300 tabular-nums pt-2 border-t border-zinc-800/80">
                            <span>{mod.symbolCount} symbols</span>
                            <span>
                              in: <strong>{mod.inDegree}</strong> · out:{' '}
                              <strong>{mod.outDegree}</strong>
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Panel: Selected Module Dependency & Symbol Inspector */}
          <aside className="lg:col-span-4 flex flex-col min-h-0 bg-zinc-950 p-5 overflow-y-auto space-y-5">
            {selectedFilePath ? (
              <>
                <div className="pb-3 border-b border-zinc-800">
                  <div className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                    Selected Module
                  </div>
                  <h3 className="text-sm font-mono font-bold text-zinc-100 mt-1 break-all">
                    {selectedFilePath}
                  </h3>
                </div>

                {/* Symbols Declared in this Module */}
                <div>
                  <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-400 mb-2.5">
                    Declared Symbols (Click to Inspect)
                  </h4>
                  <div className="space-y-1.5">
                    {symbolNodes
                      .filter((s) => s.filePath === selectedFilePath)
                      .map((sym) => (
                        <button
                          key={sym.id}
                          type="button"
                          onClick={() => walkToSymbol(sym.id)}
                          className="w-full flex items-center justify-between px-3 py-2 rounded bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 text-left transition-colors cursor-pointer"
                        >
                          <span className="text-xs font-mono font-medium text-zinc-100 truncate">
                            {sym.name}
                          </span>
                          <span
                            className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${KIND_ACCENT[sym.kind]}`}
                          >
                            {sym.kind}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>

                {/* Outgoing Dependencies */}
                <div>
                  <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-400 mb-2.5">
                    Imports & Outgoing Calls
                  </h4>
                  <div className="space-y-2">
                    {snapshot.architecture.edges
                      .filter((e) => e.sourceFile === selectedFilePath)
                      .map((edge) => (
                        <div
                          key={edge.id}
                          className="p-3 rounded bg-zinc-900/60 border border-zinc-800/90 text-xs font-mono"
                        >
                          <div className="flex items-center justify-between text-zinc-200 mb-1">
                            <span className="truncate">→ {edge.targetFile}</span>
                            <span className="text-sky-400 tabular-nums">
                              {edge.callCount} calls
                            </span>
                          </div>
                          {edge.symbolsReferenced.length > 0 && (
                            <div className="text-[11px] text-zinc-400">
                              Refs: {edge.symbolsReferenced.join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              </>
            ) : null}
          </aside>
        </div>
      )}

      {/* VIEW 3: CALL FLOW PATHFINDER (From Symbol -> To Symbol Hop Strip) */}
      {activeView === 'flow' && (
        <div className="flex-1 p-6 overflow-y-auto bg-zinc-950 space-y-6">
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="border border-zinc-800 rounded-lg bg-zinc-900/40 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-zinc-100">
                    Symbol Execution Call Flow (Shortest Path BFS)
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Trace how execution hops across symbols and files from an entry point to a downstream target.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase text-zinc-400 mb-1.5">
                    From Symbol (Origin)
                  </label>
                  <select
                    value={flowFromId}
                    onChange={(e) => setFlowFromId(e.target.value)}
                    aria-label="Origin symbol"
                    className="w-full px-3 py-2 rounded bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-100 focus:outline-none focus:border-sky-500"
                  >
                    {symbolNodes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.filePath})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-zinc-400 mb-1.5">
                    To Symbol (Destination)
                  </label>
                  <select
                    value={flowToId}
                    onChange={(e) => setFlowToId(e.target.value)}
                    aria-label="Destination symbol"
                    className="w-full px-3 py-2 rounded bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-100 focus:outline-none focus:border-sky-500"
                  >
                    {symbolNodes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.filePath})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Flow Hops Result */}
            {activeFlow && activeFlow.found ? (
              <div className="space-y-3">
                <div className="text-xs font-mono text-emerald-400 uppercase tracking-wider">
                  Found execution path ({activeFlow.hops.length} hops)
                </div>

                {activeFlow.hops.map((hop, idx) => (
                  <div key={`${hop.symbolId}-${idx}`} className="space-y-2">
                    <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/60 flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-zinc-400 tabular-nums">
                            Hop #{idx + 1}
                          </span>
                          <span
                            className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${KIND_ACCENT[hop.kind]}`}
                          >
                            {hop.kind}
                          </span>
                          <button
                            type="button"
                            onClick={() => walkToSymbol(hop.symbolId)}
                            className="text-sm font-mono font-bold text-sky-400 hover:underline cursor-pointer"
                          >
                            {hop.name}
                          </button>
                        </div>
                        <div className="text-xs font-mono text-zinc-400 tabular-nums">
                          {hop.filePath}:{hop.startLine}
                        </div>
                        <pre className="text-xs font-mono text-zinc-300 mt-1 overflow-x-auto">
                          {hop.signature}
                        </pre>
                      </div>
                    </div>

                    {hop.callSnippet && (
                      <div className="ml-6 pl-4 border-l-2 border-sky-500/40 py-1 flex items-center gap-2 text-xs font-mono text-zinc-300">
                        <CornerDownRight className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <span className="text-zinc-400 tabular-nums shrink-0">
                          L{hop.callLine}:
                        </span>
                        <code className="bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 text-amber-300">
                          {hop.callSnippet}
                        </code>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 rounded-lg border border-zinc-800 bg-zinc-900/20 text-center text-xs font-mono text-zinc-400">
                No direct directed call path found between the selected origin and destination symbols. Try selecting an entry component or API route as the origin.
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 4: ENTRY POINTS */}
      {activeView === 'entries' && (
        <div className="flex-1 p-6 overflow-y-auto bg-zinc-950">
          <div className="max-w-5xl mx-auto space-y-4">
            <div>
              <h2 className="text-base font-bold text-zinc-100">
                Indexed Entry Points & Exported Roots
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                HTTP API routes, Next.js page roots, and exported symbols that initiate execution graphs.
              </p>
            </div>

            <div className="border border-zinc-800 rounded-lg overflow-hidden divide-y divide-zinc-800/80">
              {snapshot.entryPoints.map((entry) => (
                <button
                  key={entry.symbolId}
                  type="button"
                  onClick={() => walkToSymbol(entry.symbolId)}
                  className="w-full p-4 bg-zinc-900/30 hover:bg-zinc-900/80 flex items-center justify-between gap-4 text-left transition-colors cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 mb-1">
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        {entry.category}
                      </span>
                      <span className="text-sm font-mono font-bold text-zinc-100">
                        {entry.name}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-zinc-400 tabular-nums">
                      {entry.filePath}:{entry.startLine}
                    </div>
                  </div>
                  <div className="text-right font-mono text-xs text-zinc-300 tabular-nums shrink-0">
                    <div>
                      Downstream reach: <strong>{entry.downstreamReach}</strong> symbols
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 5: DEAD CODE DETECTOR */}
      {activeView === 'dead' && (
        <div className="flex-1 p-6 overflow-y-auto bg-zinc-950">
          <div className="max-w-5xl mx-auto space-y-4">
            <div>
              <h2 className="text-base font-bold text-zinc-100">
                Zero-Reference / Dead Code Detector
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Symbols with 0 incoming call or reference edges across the indexed codebase.
              </p>
            </div>

            {snapshot.deadCode.length === 0 ? (
              <div className="p-8 rounded-lg border border-zinc-800 bg-zinc-900/30 text-center text-xs font-mono text-emerald-400">
                0 unreferenced dead symbols detected. Every non-entry symbol has at least 1 caller or reference.
              </div>
            ) : (
              <div className="border border-zinc-800 rounded-lg overflow-hidden divide-y divide-zinc-800/80">
                {snapshot.deadCode.map((item) => (
                  <button
                    key={item.symbolId}
                    type="button"
                    onClick={() => walkToSymbol(item.symbolId)}
                    className="w-full p-4 bg-zinc-900/30 hover:bg-zinc-900/80 flex items-center justify-between gap-4 text-left transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${KIND_ACCENT[item.kind]}`}
                        >
                          {item.kind}
                        </span>
                        <span className="text-sm font-mono font-bold text-zinc-100">
                          {item.name}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-zinc-400">
                        {item.filePath}:{item.startLine} · {item.reason}
                      </div>
                    </div>
                    <span className="text-xs font-mono text-zinc-400 tabular-nums shrink-0">
                      {item.loc} LOC
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
