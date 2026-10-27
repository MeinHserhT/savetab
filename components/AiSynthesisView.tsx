'use client';

import React, { useState } from 'react';
import { BrainCircuit, Loader2, Sparkles } from 'lucide-react';
import { useLinkStore } from '@/store/useLinkStore';
import { SynthesisResult } from '@/lib/types';

export function AiSynthesisView() {
  const { links } = useLinkStore();
  const [query, setQuery] = useState(
    'How do Local-First CRDTs, Raft consensus, and Swiss typographic grids combine when architecting high-density collaborative engineering tools?'
  );
  const [synthesis, setSynthesis] = useState<SynthesisResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleRunSynthesis = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      const response = await fetch('/api/ai/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await response.json();
      if (data.synthesis) {
        setSynthesis(data.synthesis);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-6">
      <div className="border-b border-zinc-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-sky-400" />
            <span>High-Thinking Research Synthesis</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Powered by server-side <code className="font-mono text-zinc-200">gemini-4-argon</code> with{' '}
            <code className="font-mono text-zinc-200">ThinkingLevel.HIGH</code> across your{' '}
            <span className="font-mono tabular-nums">{links.length}</span> saved links.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleRunSynthesis}
        className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5 space-y-4"
      >
        <div className="space-y-1.5">
          <label
            htmlFor="synthesis-query"
            className="text-xs font-medium text-zinc-300 block"
          >
            Complex Cross-Link Research Prompt
          </label>
          <textarea
            id="synthesis-query"
            rows={3}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full p-3 text-xs bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100 focus:outline-none focus:border-sky-500"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono text-zinc-500">
            Model: gemini-4-argon · ThinkingLevel.HIGH
          </span>
          <button
            type="submit"
            disabled={isGenerating}
            className="px-4 py-2 text-xs font-medium bg-zinc-100 hover:bg-white text-zinc-950 rounded-md inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            {isGenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>Run Deep Synthesis</span>
          </button>
        </div>
      </form>

      {synthesis && (
        <div className="space-y-6">
          <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
              <span>Executive Synthesis</span>
              <span>{synthesis.modelUsed}</span>
            </div>
            <p className="text-sm text-zinc-200 leading-relaxed">
              {synthesis.summary}
            </p>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
              <h2 className="text-sm font-semibold text-zinc-100">
                Thematic Clusters
              </h2>
              <div className="space-y-4">
                {synthesis.thematicClusters.map((cluster) => (
                  <div
                    key={cluster.theme}
                    className="pb-3 border-b border-zinc-800/70 last:border-0 last:pb-0 space-y-1.5"
                  >
                    <h3 className="text-xs font-semibold text-sky-400">
                      {cluster.theme}
                    </h3>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      {cluster.rationale}
                    </p>
                    <p className="text-[11px] font-mono text-zinc-500">
                      Links: {cluster.relatedTitles.join(' · ')}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
              <h2 className="text-sm font-semibold text-zinc-100">
                Recommended Reading Sequence
              </h2>
              <div className="space-y-3">
                {synthesis.readingSequence.map((step) => (
                  <div
                    key={step.step}
                    className="flex items-start gap-3 pb-3 border-b border-zinc-800/70 last:border-0 last:pb-0"
                  >
                    <span className="font-mono text-xs tabular-nums text-zinc-400 mt-0.5">
                      0{step.step}.
                    </span>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-zinc-100">
                        {step.title}
                      </p>
                      <p className="text-xs text-zinc-400">{step.whyFirst}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
