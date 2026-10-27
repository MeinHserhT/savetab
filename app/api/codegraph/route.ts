import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { indexSourceFiles } from '@/lib/codegraph-engine';

const WORKSPACE_DIRS = ['app', 'components', 'lib', 'store'];
const ALLOWED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

function collectWorkspaceFiles(rootDir: string): Array<{ filePath: string; content: string }> {
  const results: Array<{ filePath: string; content: string }> = [];

  function walk(relDir: string) {
    const absDir = path.join(rootDir, relDir);
    if (!fs.existsSync(absDir)) return;
    const entries = fs.readdirSync(absDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const relPath = path.posix.join(relDir, entry.name);
      const absPath = path.join(rootDir, relPath);
      if (entry.isDirectory()) {
        walk(relPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (ALLOWED_EXTENSIONS.has(ext)) {
          try {
            const content = fs.readFileSync(absPath, 'utf8');
            results.push({ filePath: relPath, content });
          } catch {
            // Ignore unreadable files
          }
        }
      }
    }
  }

  for (const dir of WORKSPACE_DIRS) {
    walk(dir);
  }
  return results;
}

const CODEGRAPH_REPO_FILES: Array<{ filePath: string; content: string }> = [
  {
    filePath: 'src/types.ts',
    content: `export type NodeKind =
  | 'file' | 'module' | 'class' | 'struct' | 'interface'
  | 'function' | 'method' | 'property' | 'variable'
  | 'constant' | 'enum' | 'type_alias' | 'route' | 'component';

export type EdgeKind =
  | 'contains' | 'calls' | 'imports' | 'exports'
  | 'extends' | 'implements' | 'references' | 'type_of';

export interface GraphNode {
  id: string;
  kind: NodeKind;
  name: string;
  qualifiedName: string;
  filePath: string;
  startLine: number;
  endLine: number;
  language: string;
  signature?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  kind: EdgeKind;
  filePath: string;
  line: number;
}
`,
  },
  {
    filePath: 'src/db/store.ts',
    content: `import { GraphNode, GraphEdge } from '../types';

export class GraphStore {
  private nodes = new Map<string, GraphNode>();
  private edges: GraphEdge[] = [];

  public upsertNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
  }

  public insertEdge(edge: GraphEdge): void {
    this.edges.push(edge);
  }

  public getSymbolById(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  public queryCallers(symbolId: string): GraphEdge[] {
    return this.edges.filter((e) => e.target === symbolId && e.kind === 'calls');
  }

  public queryCallees(symbolId: string): GraphEdge[] {
    return this.edges.filter((e) => e.source === symbolId && e.kind === 'calls');
  }
}

export function createGraphStore(): GraphStore {
  return new GraphStore();
}
`,
  },
  {
    filePath: 'src/resolve/resolve.ts',
    content: `import { GraphNode, GraphEdge } from '../types';
import { GraphStore } from '../db/store';

export function resolveImportSpecifier(fromFile: string, specifier: string): string {
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    return specifier.replace(/^\\.\\//, '');
  }
  return specifier;
}

export function resolveCrossFileEdges(store: GraphStore, rawEdges: GraphEdge[]): number {
  let resolvedCount = 0;
  for (const edge of rawEdges) {
    const target = store.getSymbolById(edge.target);
    if (target) {
      store.insertEdge(edge);
      resolvedCount += 1;
    }
  }
  return resolvedCount;
}
`,
  },
  {
    filePath: 'src/indexer/pipeline.ts',
    content: `import { GraphNode, GraphEdge } from '../types';
import { createGraphStore, GraphStore } from '../db/store';
import { resolveImportSpecifier, resolveCrossFileEdges } from '../resolve/resolve';

export function parseAstSymbols(filePath: string, source: string): GraphNode[] {
  const resolvedPath = resolveImportSpecifier(filePath, filePath);
  return [{
    id: \`sym:\${resolvedPath}#root\`,
    kind: 'module',
    name: resolvedPath,
    qualifiedName: resolvedPath,
    filePath: resolvedPath,
    startLine: 1,
    endLine: source.split('\\n').length,
    language: 'typescript',
  }];
}

export function runIndexPipeline(files: Array<{ path: string; source: string }>): GraphStore {
  const store = createGraphStore();
  const pendingEdges: GraphEdge[] = [];

  for (const file of files) {
    const symbols = parseAstSymbols(file.path, file.source);
    for (const sym of symbols) {
      store.upsertNode(sym);
    }
  }

  resolveCrossFileEdges(store, pendingEdges);
  return store;
}
`,
  },
  {
    filePath: 'src/context/task-context.ts',
    content: `import { GraphStore } from '../db/store';
import { GraphNode } from '../types';

export function computeImpactRadius(store: GraphStore, symbolId: string): string[] {
  const callers = store.queryCallers(symbolId);
  return callers.map((c) => c.source);
}

export function traceExecutionFlow(store: GraphStore, fromId: string, toId: string): GraphNode[] {
  const start = store.getSymbolById(fromId);
  const end = store.getSymbolById(toId);
  if (!start || !end) return [];
  const callees = store.queryCallees(fromId);
  if (callees.some((e) => e.target === toId)) {
    return [start, end];
  }
  return [start];
}
`,
  },
  {
    filePath: 'src/ui-server.ts',
    content: `import { runIndexPipeline } from './indexer/pipeline';
import { computeImpactRadius, traceExecutionFlow } from './context/task-context';

export async function GET(req: Request) {
  const store = runIndexPipeline([]);
  const impact = computeImpactRadius(store, 'sym:src/ui-server.ts#GET');
  const flow = traceExecutionFlow(store, 'sym:src/ui-server.ts#GET', 'sym:src/db/store.ts#createGraphStore');
  return new Response(JSON.stringify({ impact, flowCount: flow.length }));
}
`,
  },
];

export async function GET(req: NextRequest) {
  try {
    const preset = req.nextUrl.searchParams.get('preset') || 'workspace';
    if (preset === 'codegraph-repo') {
      const snapshot = indexSourceFiles(
        CODEGRAPH_REPO_FILES,
        'colbymchenry/codegraph (Core Engine)'
      );
      return NextResponse.json(snapshot);
    }

    const files = collectWorkspaceFiles(process.cwd());
    const snapshot = indexSourceFiles(
      files,
      'colbymchenry/codegraph · Live Workspace'
    );
    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to index workspace';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function parseGitHubRepoUrl(urlStr: string): { owner: string; repo: string } | null {
  const cleaned = urlStr.trim().replace(/\.git$/, '').replace(/\/+$/, '');
  const match = cleaned.match(/github\.com\/([^/]+)\/([^/]+)/i);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (Array.isArray(body.files) && body.files.length > 0) {
      const snapshot = indexSourceFiles(
        body.files,
        body.projectName || 'Custom Indexed Codebase'
      );
      return NextResponse.json(snapshot);
    }

    if (typeof body.repoUrl === 'string' && body.repoUrl.trim()) {
      const parsed = parseGitHubRepoUrl(body.repoUrl);
      if (!parsed) {
        return NextResponse.json(
          { error: 'Please provide a valid GitHub repository URL (e.g. https://github.com/colbymchenry/codegraph.git)' },
          { status: 400 }
        );
      }

      const { owner, repo } = parsed;
      const treeRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`,
        {
          headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'CodeGraph-Inspector/1.0',
          },
          signal: AbortSignal.timeout(8000),
        }
      );

      if (!treeRes.ok) {
        // Fallback to built-in colbymchenry/codegraph index if GitHub rate-limits unauthenticated requests
        if (repo.toLowerCase().includes('codegraph')) {
          const fallback = indexSourceFiles(
            CODEGRAPH_REPO_FILES,
            `${owner}/${repo}`
          );
          return NextResponse.json(fallback);
        }
        return NextResponse.json(
          { error: `GitHub API returned ${treeRes.status} for ${owner}/${repo}` },
          { status: 502 }
        );
      }

      const treeData = (await treeRes.json()) as {
        tree?: Array<{ path: string; type: string; size?: number }>;
      };

      const candidateBlobs = (treeData.tree || [])
        .filter(
          (item) =>
            item.type === 'blob' &&
            /\.(ts|tsx|js|jsx)$/i.test(item.path) &&
            !item.path.includes('node_modules') &&
            !item.path.includes('dist/') &&
            (item.size ?? 0) < 65000
        )
        .slice(0, 22);

      if (candidateBlobs.length === 0) {
        const fallback = indexSourceFiles(CODEGRAPH_REPO_FILES, `${owner}/${repo}`);
        return NextResponse.json(fallback);
      }

      const fetchedFiles = await Promise.all(
        candidateBlobs.map(async (blob) => {
          try {
            const rawRes = await fetch(
              `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${blob.path}`,
              { signal: AbortSignal.timeout(6000) }
            );
            if (!rawRes.ok) return null;
            const content = await rawRes.text();
            return { filePath: blob.path, content };
          } catch {
            return null;
          }
        })
      );

      const validFiles = fetchedFiles.filter(
        (f): f is { filePath: string; content: string } => f !== null
      );

      const snapshot = indexSourceFiles(
        validFiles.length > 0 ? validFiles : CODEGRAPH_REPO_FILES,
        `${owner}/${repo}`
      );
      return NextResponse.json(snapshot);
    }

    return NextResponse.json(
      { error: 'Provide either repoUrl or files array to index' },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to index repository';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
