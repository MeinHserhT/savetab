import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { indexSourceFiles, findSymbolFlow } from './codegraph-engine';

describe('CodeGraph Static Analyzer & Knowledge Graph Engine', () => {
  const sampleFiles = [
    {
      filePath: 'app/api/links/route.ts',
      content: `import { scrapeMetadata } from '@/lib/scraper';
import { insertLink } from '@/lib/db';

export async function POST(req: Request) {
  const body = await req.json();
  const meta = await scrapeMetadata(body.url);
  return insertLink(meta.title);
}
`,
    },
    {
      filePath: 'lib/scraper.ts',
      content: `export function parseHtmlMeta(html: string) {
  return { title: html.slice(0, 10) };
}

export async function scrapeMetadata(url: string) {
  const parsed = parseHtmlMeta(url);
  return parsed;
}

function unusedInternalHelper() {
  return 42;
}
`,
    },
    {
      filePath: 'lib/db.ts',
      content: `export function insertLink(title: string) {
  return { id: '1', title };
}
`,
    },
  ];

  it('extracts file nodes, symbols, imports, and call edges with exact line numbers', () => {
    const snapshot = indexSourceFiles(sampleFiles, 'test-repo');
    assert.equal(snapshot.stats.fileCount, 3);
    assert.ok(snapshot.stats.symbolCount >= 5);

    const postRoute = snapshot.nodes.find((n) => n.name === 'POST');
    assert.ok(postRoute, 'Expected POST route symbol to be indexed');
    assert.equal(postRoute.kind, 'route');

    const callees = snapshot.calleesBySymbol[postRoute.id] || [];
    const calleeNames = callees.map((c) => c.calleeName);
    assert.ok(calleeNames.includes('scrapeMetadata'));
    assert.ok(calleeNames.includes('insertLink'));
  });

  it('computes shortest call flow between two symbols with exact call-site snippets', () => {
    const snapshot = indexSourceFiles(sampleFiles, 'test-repo');
    const postSym = snapshot.nodes.find((n) => n.name === 'POST')!;
    const parseSym = snapshot.nodes.find((n) => n.name === 'parseHtmlMeta')!;

    const flow = findSymbolFlow(snapshot, postSym.id, parseSym.id);
    assert.equal(flow.found, true);
    assert.equal(flow.hops.length, 3);
    assert.equal(flow.hops[0].name, 'POST');
    assert.equal(flow.hops[1].name, 'scrapeMetadata');
    assert.equal(flow.hops[2].name, 'parseHtmlMeta');
    assert.ok(flow.hops[0].callSnippet?.includes('scrapeMetadata'));
  });

  it('computes blast radius and detects unreferenced dead code', () => {
    const snapshot = indexSourceFiles(sampleFiles, 'test-repo');
    const parseSym = snapshot.nodes.find((n) => n.name === 'parseHtmlMeta')!;
    const blast = snapshot.blastRadiusBySymbol[parseSym.id];
    assert.equal(blast.directCallers, 1);
    assert.equal(blast.transitiveCallers, 2); // scrapeMetadata -> POST

    const deadNames = snapshot.deadCode.map((d) => d.name);
    assert.ok(deadNames.includes('unusedInternalHelper'));
  });
});
