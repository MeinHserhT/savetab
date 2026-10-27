export type NodeKind =
  | 'file'
  | 'module'
  | 'class'
  | 'interface'
  | 'function'
  | 'component'
  | 'method'
  | 'constant'
  | 'type_alias'
  | 'route';

export type EdgeKind =
  | 'contains'
  | 'calls'
  | 'imports'
  | 'exports'
  | 'references'
  | 'type_of';

export interface CodeNode {
  id: string;
  kind: NodeKind;
  name: string;
  qualifiedName: string;
  filePath: string;
  startLine: number;
  endLine: number;
  language: string;
  signature: string;
  exported: boolean;
  loc: number;
}

export interface CodeEdge {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
  filePath: string;
  line: number;
  snippet: string;
}

export interface CallerRef {
  edgeId: string;
  callerId: string;
  callerName: string;
  callerKind: NodeKind;
  filePath: string;
  line: number;
  snippet: string;
  edgeKind: EdgeKind;
}

export interface CalleeRef {
  edgeId: string;
  calleeId: string;
  calleeName: string;
  calleeKind: NodeKind;
  targetFilePath: string;
  callSiteLine: number;
  snippet: string;
  edgeKind: EdgeKind;
}

export interface BlastRadius {
  symbolId: string;
  directCallers: number;
  transitiveCallers: number;
  affectedFiles: string[];
  affectedSymbolIds: string[];
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH';
}

export interface ArchModuleNode {
  id: string;
  filePath: string;
  label: string;
  group: string;
  layer: number;
  layerName: string;
  symbolCount: number;
  loc: number;
  inDegree: number;
  outDegree: number;
  symbols: string[];
}

export interface ArchModuleEdge {
  id: string;
  sourceFile: string;
  targetFile: string;
  weight: number;
  importCount: number;
  callCount: number;
  symbolsReferenced: string[];
}

export interface EntryPointItem {
  symbolId: string;
  name: string;
  kind: NodeKind;
  filePath: string;
  startLine: number;
  category: 'HTTP Route' | 'UI Entry / Page' | 'Test Suite' | 'Exported API';
  downstreamReach: number;
  signature: string;
}

export interface DeadCodeItem {
  symbolId: string;
  name: string;
  kind: NodeKind;
  filePath: string;
  startLine: number;
  exported: boolean;
  loc: number;
  reason: string;
}

export interface FlowHop {
  symbolId: string;
  name: string;
  kind: NodeKind;
  filePath: string;
  startLine: number;
  signature: string;
  callLine?: number;
  callSnippet?: string;
  edgeKind?: EdgeKind;
}

export interface FlowPathResult {
  fromSymbolId: string;
  toSymbolId: string;
  found: boolean;
  hops: FlowHop[];
}

export interface FileSourceRecord {
  filePath: string;
  language: string;
  lines: string[];
  loc: number;
}

export interface CodeGraphSnapshot {
  projectName: string;
  indexedAt: string;
  stats: {
    fileCount: number;
    symbolCount: number;
    edgeCount: number;
    totalLoc: number;
    entryPointCount: number;
    deadCodeCount: number;
  };
  files: Record<string, FileSourceRecord>;
  nodes: CodeNode[];
  edges: CodeEdge[];
  callersBySymbol: Record<string, CallerRef[]>;
  calleesBySymbol: Record<string, CalleeRef[]>;
  blastRadiusBySymbol: Record<string, BlastRadius>;
  architecture: {
    nodes: ArchModuleNode[];
    edges: ArchModuleEdge[];
  };
  entryPoints: EntryPointItem[];
  deadCode: DeadCodeItem[];
}

function detectLanguage(filePath: string): string {
  if (filePath.endsWith('.tsx')) return 'tsx';
  if (filePath.endsWith('.ts')) return 'typescript';
  if (filePath.endsWith('.jsx') || filePath.endsWith('.js')) return 'javascript';
  if (filePath.endsWith('.py')) return 'python';
  if (filePath.endsWith('.rs')) return 'rust';
  return 'typescript';
}

function classifyLayer(filePath: string): { layer: number; layerName: string; group: string } {
  const normalized = filePath.replace(/^\/+/, '');
  if (normalized.startsWith('app/api/') || normalized.includes('/route.')) {
    return { layer: 0, layerName: 'Layer 0 · HTTP & API Routes', group: 'api' };
  }
  if (normalized.startsWith('app/')) {
    return { layer: 0, layerName: 'Layer 0 · App Router & Entry', group: 'app' };
  }
  if (normalized.startsWith('components/')) {
    return { layer: 1, layerName: 'Layer 1 · UI Views & Components', group: 'components' };
  }
  if (normalized.startsWith('store/')) {
    return { layer: 2, layerName: 'Layer 2 · Client State Stores', group: 'store' };
  }
  if (normalized.endsWith('.test.ts') || normalized.endsWith('.spec.ts')) {
    return { layer: 0, layerName: 'Layer 0 · Verification Suites', group: 'tests' };
  }
  if (normalized.includes('types')) {
    return { layer: 4, layerName: 'Layer 4 · Domain Contracts & Types', group: 'types' };
  }
  return { layer: 3, layerName: 'Layer 3 · Core Engine & Services', group: 'lib' };
}

function findBlockEndLine(lines: string[], startIndex: number): number {
  let braceDepth = 0;
  let parenDepth = 0;
  let sawParamList = false;
  let openedBody = false;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (!openedBody) {
        if (ch === '(') {
          parenDepth++;
          sawParamList = true;
        } else if (ch === ')') {
          parenDepth = Math.max(0, parenDepth - 1);
        } else if (ch === '{' && (!sawParamList || parenDepth === 0)) {
          openedBody = true;
          braceDepth = 1;
        }
      } else {
        if (ch === '{') {
          braceDepth++;
        } else if (ch === '}') {
          braceDepth--;
          if (braceDepth <= 0) {
            return i + 1;
          }
        }
      }
    }
    if (!openedBody && i > startIndex + 6 && line.trim().endsWith(';')) {
      return i + 1;
    }
  }
  return Math.min(lines.length, startIndex + 40);
}

function resolveImportTarget(
  sourceFilePath: string,
  importSpec: string,
  knownFilePaths: Set<string>
): string | null {
  let candidateBase = '';
  if (importSpec.startsWith('@/')) {
    candidateBase = importSpec.slice(2);
  } else if (importSpec.startsWith('./') || importSpec.startsWith('../')) {
    const sourceParts = sourceFilePath.replace(/^\/+/, '').split('/');
    sourceParts.pop();
    const specParts = importSpec.split('/');
    for (const part of specParts) {
      if (part === '.') continue;
      if (part === '..') {
        sourceParts.pop();
      } else {
        sourceParts.push(part);
      }
    }
    candidateBase = sourceParts.join('/');
  } else {
    return null;
  }

  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'];
  for (const ext of extensions) {
    const candidate = `${candidateBase}${ext}`;
    if (knownFilePaths.has(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function indexSourceFiles(
  rawFiles: Array<{ filePath: string; content: string }>,
  projectName = 'colbymchenry/codegraph · workspace'
): CodeGraphSnapshot {
  const normalizedFiles = rawFiles.map((f) => ({
    filePath: f.filePath.replace(/^\/+/, ''),
    content: f.content,
  }));

  const knownFilePaths = new Set(normalizedFiles.map((f) => f.filePath));
  const filesRecord: Record<string, FileSourceRecord> = {};
  const nodes: CodeNode[] = [];
  const edges: CodeEdge[] = [];

  let totalLoc = 0;

  // 1. Create file nodes and extract symbols per file
  for (const file of normalizedFiles) {
    const lines = file.content.split(/\r?\n/);
    const loc = lines.length;
    totalLoc += loc;
    const language = detectLanguage(file.filePath);

    filesRecord[file.filePath] = {
      filePath: file.filePath,
      language,
      lines,
      loc,
    };

    const fileNodeId = `file:${file.filePath}`;
    nodes.push({
      id: fileNodeId,
      kind: 'file',
      name: file.filePath.split('/').pop() || file.filePath,
      qualifiedName: file.filePath,
      filePath: file.filePath,
      startLine: 1,
      endLine: loc,
      language,
      signature: `module ${file.filePath}`,
      exported: true,
      loc,
    });

    const seenInFile = new Set<string>();

    for (let idx = 0; idx < lines.length; idx++) {
      const lineNum = idx + 1;
      const rawLine = lines[idx];
      const trimmed = rawLine.trim();

      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
        continue;
      }

      // Match function declarations: [export] [default] [async] function Name(...)
      const fnMatch = trimmed.match(
        /^(export\s+)?(default\s+)?(async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/
      );
      if (fnMatch) {
        const isExported = Boolean(fnMatch[1]);
        const name = fnMatch[4];
        if (!seenInFile.has(name)) {
          seenInFile.add(name);
          const endLine = findBlockEndLine(lines, idx);
          const isHttpHandler = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(name);
          const isComponent =
            !isHttpHandler &&
            /^[A-Z]/.test(name) &&
            (file.filePath.endsWith('.tsx') || file.filePath.endsWith('.jsx'));
          const kind: NodeKind = isHttpHandler
            ? 'route'
            : isComponent
              ? 'component'
              : 'function';
          const symbolId = `sym:${file.filePath}#${name}`;
          nodes.push({
            id: symbolId,
            kind,
            name,
            qualifiedName: `${file.filePath}::${name}`,
            filePath: file.filePath,
            startLine: lineNum,
            endLine,
            language,
            signature: trimmed.replace(/\{\s*$/, '').trim(),
            exported: isExported,
            loc: Math.max(1, endLine - lineNum + 1),
          });
          edges.push({
            id: `edge:contains:${fileNodeId}->${symbolId}`,
            source: fileNodeId,
            target: symbolId,
            kind: 'contains',
            filePath: file.filePath,
            line: lineNum,
            snippet: trimmed,
          });
        }
        continue;
      }

      // Match arrow functions or store hooks: [export] const Name = [async] (...) => or create<...>(...)
      const constFnMatch = trimmed.match(
        /^(export\s+)?const\s+([A-Za-z0-9_]+)\s*(?::\s*[^=]+)?=\s*(?:async\s*)?(?:\([^)]*\)\s*(?::\s*[^=]+)?=>|[A-Za-z0-9_]+\s*=>|create<)/
      );
      if (constFnMatch) {
        const isExported = Boolean(constFnMatch[1]);
        const name = constFnMatch[2];
        if (!seenInFile.has(name)) {
          seenInFile.add(name);
          const endLine = findBlockEndLine(lines, idx);
          const isComponent =
            /^[A-Z]/.test(name) &&
            (file.filePath.endsWith('.tsx') || file.filePath.endsWith('.jsx'));
          const kind: NodeKind = isComponent ? 'component' : 'function';
          const symbolId = `sym:${file.filePath}#${name}`;
          nodes.push({
            id: symbolId,
            kind,
            name,
            qualifiedName: `${file.filePath}::${name}`,
            filePath: file.filePath,
            startLine: lineNum,
            endLine,
            language,
            signature: trimmed.replace(/\{\s*$/, '').trim(),
            exported: isExported,
            loc: Math.max(1, endLine - lineNum + 1),
          });
          edges.push({
            id: `edge:contains:${fileNodeId}->${symbolId}`,
            source: fileNodeId,
            target: symbolId,
            kind: 'contains',
            filePath: file.filePath,
            line: lineNum,
            snippet: trimmed,
          });
        }
        continue;
      }

      // Match interface declarations
      const ifaceMatch = trimmed.match(/^(export\s+)?interface\s+([A-Za-z0-9_]+)/);
      if (ifaceMatch) {
        const isExported = Boolean(ifaceMatch[1]);
        const name = ifaceMatch[2];
        if (!seenInFile.has(name)) {
          seenInFile.add(name);
          const endLine = findBlockEndLine(lines, idx);
          const symbolId = `sym:${file.filePath}#${name}`;
          nodes.push({
            id: symbolId,
            kind: 'interface',
            name,
            qualifiedName: `${file.filePath}::${name}`,
            filePath: file.filePath,
            startLine: lineNum,
            endLine,
            language,
            signature: trimmed.replace(/\{\s*$/, '').trim(),
            exported: isExported,
            loc: Math.max(1, endLine - lineNum + 1),
          });
          edges.push({
            id: `edge:contains:${fileNodeId}->${symbolId}`,
            source: fileNodeId,
            target: symbolId,
            kind: 'contains',
            filePath: file.filePath,
            line: lineNum,
            snippet: trimmed,
          });
        }
        continue;
      }

      // Match type alias or enum declarations
      const typeMatch = trimmed.match(/^(export\s+)?(?:type|enum)\s+([A-Za-z0-9_]+)/);
      if (typeMatch) {
        const isExported = Boolean(typeMatch[1]);
        const name = typeMatch[2];
        if (!seenInFile.has(name)) {
          seenInFile.add(name);
          const endLine = findBlockEndLine(lines, idx);
          const symbolId = `sym:${file.filePath}#${name}`;
          nodes.push({
            id: symbolId,
            kind: 'type_alias',
            name,
            qualifiedName: `${file.filePath}::${name}`,
            filePath: file.filePath,
            startLine: lineNum,
            endLine,
            language,
            signature: trimmed.replace(/\{\s*$/, '').trim(),
            exported: isExported,
            loc: Math.max(1, endLine - lineNum + 1),
          });
          edges.push({
            id: `edge:contains:${fileNodeId}->${symbolId}`,
            source: fileNodeId,
            target: symbolId,
            kind: 'contains',
            filePath: file.filePath,
            line: lineNum,
            snippet: trimmed,
          });
        }
        continue;
      }

      // Match class declarations
      const classMatch = trimmed.match(/^(export\s+)?class\s+([A-Za-z0-9_]+)/);
      if (classMatch) {
        const isExported = Boolean(classMatch[1]);
        const name = classMatch[2];
        if (!seenInFile.has(name)) {
          seenInFile.add(name);
          const endLine = findBlockEndLine(lines, idx);
          const symbolId = `sym:${file.filePath}#${name}`;
          nodes.push({
            id: symbolId,
            kind: 'class',
            name,
            qualifiedName: `${file.filePath}::${name}`,
            filePath: file.filePath,
            startLine: lineNum,
            endLine,
            language,
            signature: trimmed.replace(/\{\s*$/, '').trim(),
            exported: isExported,
            loc: Math.max(1, endLine - lineNum + 1),
          });
          edges.push({
            id: `edge:contains:${fileNodeId}->${symbolId}`,
            source: fileNodeId,
            target: symbolId,
            kind: 'contains',
            filePath: file.filePath,
            line: lineNum,
            snippet: trimmed,
          });
        }
        continue;
      }

      // Match exported top-level constants
      const exportedConstMatch = trimmed.match(/^export\s+const\s+([A-Za-z0-9_]+)\s*[:=]/);
      if (exportedConstMatch) {
        const name = exportedConstMatch[1];
        if (!seenInFile.has(name)) {
          seenInFile.add(name);
          const endLine = findBlockEndLine(lines, idx);
          const symbolId = `sym:${file.filePath}#${name}`;
          nodes.push({
            id: symbolId,
            kind: 'constant',
            name,
            qualifiedName: `${file.filePath}::${name}`,
            filePath: file.filePath,
            startLine: lineNum,
            endLine,
            language,
            signature: trimmed,
            exported: true,
            loc: Math.max(1, endLine - lineNum + 1),
          });
          edges.push({
            id: `edge:contains:${fileNodeId}->${symbolId}`,
            source: fileNodeId,
            target: symbolId,
            kind: 'contains',
            filePath: file.filePath,
            line: lineNum,
            snippet: trimmed,
          });
        }
      }
    }
  }

  // Index symbols by name and file
  const symbolNodes = nodes.filter((n) => n.kind !== 'file');
  const symbolsByName = new Map<string, CodeNode[]>();
  const symbolsByFile = new Map<string, CodeNode[]>();

  for (const sym of symbolNodes) {
    const byName = symbolsByName.get(sym.name) || [];
    byName.push(sym);
    symbolsByName.set(sym.name, byName);

    const byFile = symbolsByFile.get(sym.filePath) || [];
    byFile.push(sym);
    symbolsByFile.set(sym.filePath, byFile);
  }

  // 2. Scan imports & symbol calls/references across every file
  for (const file of normalizedFiles) {
    const lines = filesRecord[file.filePath].lines;
    const fileSymbols = symbolsByFile.get(file.filePath) || [];
    const importedTargetFiles = new Set<string>();

    // Extract import statements (including multi-line imports)
    const fullContent = file.content;
    const importRegex = /from\s+['"]([^'"]+)['"]/g;
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(fullContent)) !== null) {
      const spec = match[1];
      const resolved = resolveImportTarget(file.filePath, spec, knownFilePaths);
      if (resolved && resolved !== file.filePath) {
        importedTargetFiles.add(resolved);
        // Find approximate line number
        const upToMatch = fullContent.slice(0, match.index);
        const lineNum = upToMatch.split(/\r?\n/).length;
        edges.push({
          id: `edge:imports:${file.filePath}->${resolved}:${lineNum}`,
          source: `file:${file.filePath}`,
          target: `file:${resolved}`,
          kind: 'imports',
          filePath: file.filePath,
          line: lineNum,
          snippet: lines[lineNum - 1]?.trim() || `import from '${spec}'`,
        });
      }
    }

    // For each line, determine enclosing symbol (or fallback to first symbol in file if top-level)
    for (let idx = 0; idx < lines.length; idx++) {
      const lineNum = idx + 1;
      const rawLine = lines[idx];
      const trimmed = rawLine.trim();

      if (
        !trimmed ||
        trimmed.startsWith('//') ||
        trimmed.startsWith('/*') ||
        trimmed.startsWith('*') ||
        trimmed.startsWith('import ')
      ) {
        continue;
      }

      const enclosingSymbol = fileSymbols.find(
        (s) => lineNum >= s.startLine && lineNum <= s.endLine
      );
      if (!enclosingSymbol) continue;

      // Find identifier tokens on this line
      const tokenRegex = /\b([A-Za-z_][A-Za-z0-9_]*)\b/g;
      let tokMatch: RegExpExecArray | null;
      const seenTargetsOnLine = new Set<string>();

      while ((tokMatch = tokenRegex.exec(trimmed)) !== null) {
        const token = tokMatch[1];
        const candidates = symbolsByName.get(token);
        if (!candidates || candidates.length === 0) continue;

        // Prefer symbol in same file or imported file
        let targetSym =
          candidates.find((c) => c.filePath === file.filePath) ||
          candidates.find((c) => importedTargetFiles.has(c.filePath)) ||
          candidates.find((c) => c.exported);

        if (!targetSym) continue;
        // Skip self-definition on the declaration line itself
        if (targetSym.id === enclosingSymbol.id && lineNum === enclosingSymbol.startLine) {
          continue;
        }
        // Avoid self-recursive noise unless it's an explicit function call `name(`
        if (targetSym.id === enclosingSymbol.id) {
          continue;
        }
        if (seenTargetsOnLine.has(targetSym.id)) continue;
        seenTargetsOnLine.add(targetSym.id);

        // Determine edge kind
        const afterToken = trimmed.slice(tokMatch.index + token.length).trim();
        let edgeKind: EdgeKind = 'references';
        if (
          afterToken.startsWith('(') ||
          trimmed.includes(`<${token}`) ||
          targetSym.kind === 'function' ||
          targetSym.kind === 'component' ||
          targetSym.kind === 'route'
        ) {
          edgeKind =
            targetSym.kind === 'interface' || targetSym.kind === 'type_alias'
              ? 'type_of'
              : 'calls';
        } else if (targetSym.kind === 'interface' || targetSym.kind === 'type_alias') {
          edgeKind = 'type_of';
        }

        edges.push({
          id: `edge:${edgeKind}:${enclosingSymbol.id}->${targetSym.id}@${file.filePath}:${lineNum}`,
          source: enclosingSymbol.id,
          target: targetSym.id,
          kind: edgeKind,
          filePath: file.filePath,
          line: lineNum,
          snippet: trimmed,
        });
      }
    }
  }

  // 3. Build Callers & Callees maps
  const nodeMap = new Map<string, CodeNode>(nodes.map((n) => [n.id, n]));
  const callersBySymbol: Record<string, CallerRef[]> = {};
  const calleesBySymbol: Record<string, CalleeRef[]> = {};

  for (const sym of symbolNodes) {
    callersBySymbol[sym.id] = [];
    calleesBySymbol[sym.id] = [];
  }

  for (const edge of edges) {
    if (edge.kind === 'contains' || edge.kind === 'imports') continue;
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (!sourceNode || !targetNode) continue;

    callersBySymbol[targetNode.id]?.push({
      edgeId: edge.id,
      callerId: sourceNode.id,
      callerName: sourceNode.name,
      callerKind: sourceNode.kind,
      filePath: edge.filePath,
      line: edge.line,
      snippet: edge.snippet,
      edgeKind: edge.kind,
    });

    calleesBySymbol[sourceNode.id]?.push({
      edgeId: edge.id,
      calleeId: targetNode.id,
      calleeName: targetNode.name,
      calleeKind: targetNode.kind,
      targetFilePath: targetNode.filePath,
      callSiteLine: edge.line,
      snippet: edge.snippet,
      edgeKind: edge.kind,
    });
  }

  // 4. Compute Blast Radius (reverse BFS from each symbol)
  const blastRadiusBySymbol: Record<string, BlastRadius> = {};
  for (const sym of symbolNodes) {
    const directSet = new Set(
      (callersBySymbol[sym.id] || []).map((c) => c.callerId)
    );
    const visited = new Set<string>([sym.id]);
    const queue: string[] = [sym.id];
    const affectedFiles = new Set<string>([sym.filePath]);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const incoming = callersBySymbol[curr] || [];
      for (const ref of incoming) {
        if (!visited.has(ref.callerId)) {
          visited.add(ref.callerId);
          queue.push(ref.callerId);
          affectedFiles.add(ref.filePath);
        }
      }
    }

    visited.delete(sym.id);
    const transitiveCount = visited.size;
    const riskLevel: BlastRadius['riskLevel'] =
      transitiveCount >= 6 ? 'HIGH' : transitiveCount >= 2 ? 'MODERATE' : 'LOW';

    blastRadiusBySymbol[sym.id] = {
      symbolId: sym.id,
      directCallers: directSet.size,
      transitiveCallers: transitiveCount,
      affectedFiles: Array.from(affectedFiles),
      affectedSymbolIds: Array.from(visited),
      riskLevel,
    };
  }

  // 5. Build Architecture Map (file-level dependency DAG)
  const archEdgeMap = new Map<string, ArchModuleEdge>();

  for (const edge of edges) {
    if (edge.kind === 'imports') {
      const srcFile = edge.source.replace(/^file:/, '');
      const tgtFile = edge.target.replace(/^file:/, '');
      const key = `${srcFile}->${tgtFile}`;
      const existing = archEdgeMap.get(key) || {
        id: `arch:${key}`,
        sourceFile: srcFile,
        targetFile: tgtFile,
        weight: 0,
        importCount: 0,
        callCount: 0,
        symbolsReferenced: [],
      };
      existing.importCount += 1;
      existing.weight += 1;
      archEdgeMap.set(key, existing);
    } else if (edge.kind === 'calls' || edge.kind === 'references' || edge.kind === 'type_of') {
      const srcNode = nodeMap.get(edge.source);
      const tgtNode = nodeMap.get(edge.target);
      if (srcNode && tgtNode && srcNode.filePath !== tgtNode.filePath) {
        const key = `${srcNode.filePath}->${tgtNode.filePath}`;
        const existing = archEdgeMap.get(key) || {
          id: `arch:${key}`,
          sourceFile: srcNode.filePath,
          targetFile: tgtNode.filePath,
          weight: 0,
          importCount: 0,
          callCount: 0,
          symbolsReferenced: [],
        };
        existing.callCount += 1;
        existing.weight += 1;
        if (!existing.symbolsReferenced.includes(tgtNode.name)) {
          existing.symbolsReferenced.push(tgtNode.name);
        }
        archEdgeMap.set(key, existing);
      }
    }
  }

  const archEdges = Array.from(archEdgeMap.values());
  const archNodes: ArchModuleNode[] = normalizedFiles.map((f) => {
    const { layer, layerName, group } = classifyLayer(f.filePath);
    const fileSyms = symbolsByFile.get(f.filePath) || [];
    const inDegree = archEdges.filter((e) => e.targetFile === f.filePath).length;
    const outDegree = archEdges.filter((e) => e.sourceFile === f.filePath).length;
    return {
      id: `file:${f.filePath}`,
      filePath: f.filePath,
      label: f.filePath.split('/').pop() || f.filePath,
      group,
      layer,
      layerName,
      symbolCount: fileSyms.length,
      loc: filesRecord[f.filePath].loc,
      inDegree,
      outDegree,
      symbols: fileSyms.map((s) => s.name),
    };
  });

  // 6. Compute Entry Points & Dead Code
  const entryPoints: EntryPointItem[] = [];
  const deadCode: DeadCodeItem[] = [];

  for (const sym of symbolNodes) {
    const incomingCount = (callersBySymbol[sym.id] || []).length;

    // Count downstream reach via forward BFS
    const visitedDownstream = new Set<string>([sym.id]);
    const q: string[] = [sym.id];
    while (q.length > 0) {
      const curr = q.shift()!;
      for (const callee of calleesBySymbol[curr] || []) {
        if (!visitedDownstream.has(callee.calleeId)) {
          visitedDownstream.add(callee.calleeId);
          q.push(callee.calleeId);
        }
      }
    }
    const downstreamReach = visitedDownstream.size - 1;

    const isHttpRoute = sym.kind === 'route' || sym.filePath.includes('/api/');
    const isAppPage =
      sym.filePath.startsWith('app/') &&
      (sym.filePath.endsWith('page.tsx') || sym.filePath.endsWith('layout.tsx'));
    const isTestFile = sym.filePath.endsWith('.test.ts');

    if (isHttpRoute || isAppPage || isTestFile || (sym.exported && incomingCount === 0 && downstreamReach > 0)) {
      const category: EntryPointItem['category'] = isHttpRoute
        ? 'HTTP Route'
        : isAppPage
          ? 'UI Entry / Page'
          : isTestFile
            ? 'Test Suite'
            : 'Exported API';

      entryPoints.push({
        symbolId: sym.id,
        name: sym.name,
        kind: sym.kind,
        filePath: sym.filePath,
        startLine: sym.startLine,
        category,
        downstreamReach,
        signature: sym.signature,
      });
    } else if (incomingCount === 0) {
      deadCode.push({
        symbolId: sym.id,
        name: sym.name,
        kind: sym.kind,
        filePath: sym.filePath,
        startLine: sym.startLine,
        exported: sym.exported,
        loc: sym.loc,
        reason: sym.exported
          ? 'Exported symbol with 0 callers or references across workspace'
          : 'Unreferenced local symbol with 0 internal callers',
      });
    }
  }

  return {
    projectName,
    indexedAt: new Date().toISOString(),
    stats: {
      fileCount: normalizedFiles.length,
      symbolCount: symbolNodes.length,
      edgeCount: edges.length,
      totalLoc,
      entryPointCount: entryPoints.length,
      deadCodeCount: deadCode.length,
    },
    files: filesRecord,
    nodes,
    edges,
    callersBySymbol,
    calleesBySymbol,
    blastRadiusBySymbol,
    architecture: {
      nodes: archNodes,
      edges: archEdges,
    },
    entryPoints,
    deadCode,
  };
}

export function findSymbolFlow(
  snapshot: CodeGraphSnapshot,
  fromSymbolId: string,
  toSymbolId: string
): FlowPathResult {
  const nodeMap = new Map<string, CodeNode>(snapshot.nodes.map((n) => [n.id, n]));
  const startNode = nodeMap.get(fromSymbolId);
  const targetNode = nodeMap.get(toSymbolId);

  if (!startNode || !targetNode) {
    return { fromSymbolId, toSymbolId, found: false, hops: [] };
  }

  if (fromSymbolId === toSymbolId) {
    return {
      fromSymbolId,
      toSymbolId,
      found: true,
      hops: [
        {
          symbolId: startNode.id,
          name: startNode.name,
          kind: startNode.kind,
          filePath: startNode.filePath,
          startLine: startNode.startLine,
          signature: startNode.signature,
        },
      ],
    };
  }

  interface QueueItem {
    symbolId: string;
    path: FlowHop[];
  }

  const visited = new Set<string>([fromSymbolId]);
  const queue: QueueItem[] = [
    {
      symbolId: fromSymbolId,
      path: [
        {
          symbolId: startNode.id,
          name: startNode.name,
          kind: startNode.kind,
          filePath: startNode.filePath,
          startLine: startNode.startLine,
          signature: startNode.signature,
        },
      ],
    },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const outgoing = snapshot.calleesBySymbol[current.symbolId] || [];

    for (const calleeRef of outgoing) {
      if (visited.has(calleeRef.calleeId)) continue;
      const nextNode = nodeMap.get(calleeRef.calleeId);
      if (!nextNode) continue;

      const updatedPath = [...current.path];
      // Annotate previous hop with the call site that transitions to nextNode
      const prevHopIndex = updatedPath.length - 1;
      updatedPath[prevHopIndex] = {
        ...updatedPath[prevHopIndex],
        callLine: calleeRef.callSiteLine,
        callSnippet: calleeRef.snippet,
        edgeKind: calleeRef.edgeKind,
      };

      const nextHop: FlowHop = {
        symbolId: nextNode.id,
        name: nextNode.name,
        kind: nextNode.kind,
        filePath: nextNode.filePath,
        startLine: nextNode.startLine,
        signature: nextNode.signature,
      };

      const candidatePath = [...updatedPath, nextHop];

      if (calleeRef.calleeId === toSymbolId) {
        return {
          fromSymbolId,
          toSymbolId,
          found: true,
          hops: candidatePath,
        };
      }

      visited.add(calleeRef.calleeId);
      queue.push({
        symbolId: calleeRef.calleeId,
        path: candidatePath,
      });
    }
  }

  return {
    fromSymbolId,
    toSymbolId,
    found: false,
    hops: [],
  };
}
