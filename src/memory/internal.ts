import crypto from "node:crypto";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

export type MemoryFileEntry = {
  path: string;
  absPath: string;
  mtimeMs: number;
  size: number;
  hash: string;
};

export type MemoryChunk = {
  startLine: number;
  endLine: number;
  text: string;
  hash: string;
};

export function ensureDir(dir: string): string {
  try {
    fsSync.mkdirSync(dir, { recursive: true });
  } catch {}
  return dir;
}

export function normalizeRelPath(value: string): string {
  const trimmed = value.trim().replace(/^[./]+/, "");
  return trimmed.replace(/\\/g, "/");
}

export function normalizeExtraMemoryPaths(workspaceDir: string, extraPaths?: string[]): string[] {
  if (!extraPaths?.length) {
    return [];
  }
  const resolved = extraPaths
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) =>
      path.isAbsolute(value) ? path.resolve(value) : path.resolve(workspaceDir, value),
    );
  return Array.from(new Set(resolved));
}

export function isMemoryPath(relPath: string): boolean {
  const normalized = normalizeRelPath(relPath);
  if (!normalized) {
    return false;
  }
  if (normalized === "MEMORY.md" || normalized === "memory.md") {
    return true;
  }
  return normalized.startsWith("memory/");
}

async function walkDir(dir: string, files: string[]) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      continue;
    }
    if (entry.isDirectory()) {
      await walkDir(full, files);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (!entry.name.endsWith(".md")) {
      continue;
    }
    files.push(full);
  }
}

export async function listMemoryFiles(
  workspaceDir: string,
  extraPaths?: string[],
): Promise<string[]> {
  const result: string[] = [];
  const memoryFile = path.join(workspaceDir, "MEMORY.md");
  const altMemoryFile = path.join(workspaceDir, "memory.md");
  const memoryDir = path.join(workspaceDir, "memory");

  const addMarkdownFile = async (absPath: string) => {
    try {
      const stat = await fs.lstat(absPath);
      if (stat.isSymbolicLink() || !stat.isFile()) {
        return;
      }
      if (!absPath.endsWith(".md")) {
        return;
      }
      result.push(absPath);
    } catch {}
  };

  await addMarkdownFile(memoryFile);
  await addMarkdownFile(altMemoryFile);
  try {
    const dirStat = await fs.lstat(memoryDir);
    if (!dirStat.isSymbolicLink() && dirStat.isDirectory()) {
      await walkDir(memoryDir, result);
    }
  } catch {}

  const normalizedExtraPaths = normalizeExtraMemoryPaths(workspaceDir, extraPaths);
  if (normalizedExtraPaths.length > 0) {
    for (const inputPath of normalizedExtraPaths) {
      try {
        const stat = await fs.lstat(inputPath);
        if (stat.isSymbolicLink()) {
          continue;
        }
        if (stat.isDirectory()) {
          await walkDir(inputPath, result);
          continue;
        }
        if (stat.isFile() && inputPath.endsWith(".md")) {
          result.push(inputPath);
        }
      } catch {}
    }
  }
  if (result.length <= 1) {
    return result;
  }
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const entry of result) {
    let key = entry;
    try {
      key = await fs.realpath(entry);
    } catch {}
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(entry);
  }
  return deduped;
}

export function hashText(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function buildFileEntry(
  absPath: string,
  workspaceDir: string,
): Promise<MemoryFileEntry> {
  const stat = await fs.stat(absPath);
  const content = await fs.readFile(absPath, "utf-8");
  const hash = hashText(content);
  return {
    path: path.relative(workspaceDir, absPath).replace(/\\/g, "/"),
    absPath,
    mtimeMs: stat.mtimeMs,
    size: stat.size,
    hash,
  };
}

/**
 * [CN-PATCH:memory-fix] Split a long line at the best available semantic boundary.
 *
 * Priority: sentence end (。.！!？?) > comma/semicolon (，；,;) > space/word boundary > force cut.
 * Scans backwards from maxLen to find the best boundary within [minLen, maxLen].
 * minLen = maxLen × 0.5 to avoid producing tiny fragments.
 */
function splitLongLine(line: string, maxLen: number, out: string[]): void {
  let pos = 0;
  const minCut = Math.max(32, Math.floor(maxLen * 0.5));
  while (pos < line.length) {
    const remaining = line.length - pos;
    if (remaining <= maxLen) {
      out.push(line.slice(pos));
      break;
    }
    // Scan backwards from maxLen to find the best split point
    let bestPos = -1;
    let bestPriority = 0; // higher = better
    const windowEnd = pos + maxLen;
    const windowStart = pos + minCut;
    for (let i = windowEnd; i >= windowStart; i -= 1) {
      const ch = line[i - 1]; // character before split point
      const priority = splitPriority(ch);
      if (priority > bestPriority) {
        bestPriority = priority;
        bestPos = i;
        if (priority >= 4) break; // sentence boundary is good enough, stop early
      }
    }
    if (bestPos <= pos) {
      // No boundary found — force cut at maxLen
      bestPos = pos + maxLen;
    }
    out.push(line.slice(pos, bestPos));
    pos = bestPos;
  }
}

function splitPriority(ch: string | undefined): number {
  if (!ch) return 0;
  // Sentence terminators (highest priority)
  if (ch === "。" || ch === "." || ch === "！" || ch === "!" || ch === "？" || ch === "?") return 4;
  // Clause separators
  if (ch === "，" || ch === "," || ch === "；" || ch === ";" || ch === "、") return 3;
  // Parentheses / brackets close
  if (ch === "）" || ch === ")" || ch === "】" || ch === "]" || ch === "」") return 3;
  // Whitespace / word boundary
  if (ch === " " || ch === "\t") return 2;
  // CJK character boundary (each character is a word in CJK)
  if (ch.charCodeAt(0) >= 0x4e00 && ch.charCodeAt(0) <= 0x9fff) return 1;
  return 0;
}

/**
 * [CN-PATCH:memory-fix] Semantic-boundary-aware markdown chunking.
 *
 * Respects two types of semantic boundaries:
 * 1. Markdown headings (#, ##, ###, etc.) — always start a new chunk
 * 2. Session turn markers ("User: " / "Assistant: ") — keep Q&A pairs atomic
 *
 * The key insight for personal assistant long-term memory:
 * - A chunk should contain ONE coherent topic or ONE complete Q&A exchange
 * - Splitting a question from its answer destroys retrieval quality
 * - Splitting across markdown sections mixes unrelated topics in one embedding
 *
 * When a semantic unit exceeds maxChars, it is split at the best available
 * boundary (paragraph break > sentence end > word boundary) rather than
 * at an arbitrary character position.
 */
export function chunkMarkdown(
  content: string,
  chunking: { tokens: number; overlap: number },
): MemoryChunk[] {
  const lines = content.split("\n");
  if (lines.length === 0) {
    return [];
  }
  const maxChars = Math.max(32, chunking.tokens * 4);
  const overlapChars = Math.max(0, chunking.overlap * 4);
  const chunks: MemoryChunk[] = [];

  // --- Detect semantic boundaries ---
  // A "boundary" is a line index where a new semantic unit starts.
  // We always flush the current chunk at a boundary.
  const HEADING_RE = /^#{1,6}\s/;
  const SESSION_TURN_RE = /^(User|Assistant):\s/;

  type LineEntry = { line: string; lineNo: number };
  let current: LineEntry[] = [];
  let currentChars = 0;

  const flush = () => {
    if (current.length === 0) {
      return;
    }
    const firstEntry = current[0];
    const lastEntry = current[current.length - 1];
    if (!firstEntry || !lastEntry) {
      return;
    }
    const text = current.map((entry) => entry.line).join("\n");
    const startLine = firstEntry.lineNo;
    const endLine = lastEntry.lineNo;
    chunks.push({
      startLine,
      endLine,
      text,
      hash: hashText(text),
    });
  };

  const carryOverlap = () => {
    if (overlapChars <= 0 || current.length === 0) {
      current = [];
      currentChars = 0;
      return;
    }
    let acc = 0;
    const kept: LineEntry[] = [];
    for (let i = current.length - 1; i >= 0; i -= 1) {
      const entry = current[i];
      if (!entry) {
        continue;
      }
      acc += entry.line.length + 1;
      kept.unshift(entry);
      if (acc >= overlapChars) {
        break;
      }
    }
    current = kept;
    currentChars = kept.reduce((sum, entry) => sum + entry.line.length + 1, 0);
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    const lineNo = i + 1;

    // Check if this line is a semantic boundary
    const isBoundary = HEADING_RE.test(line) || SESSION_TURN_RE.test(line);

    // For session turns: "User:" starts a new Q&A pair, but "Assistant:" is
    // part of the same pair. Only flush on "User:" (which starts a new exchange),
    // unless the current chunk is already large.
    const isNewExchange = /^User:\s/.test(line);
    const isAssistantContinuation = /^Assistant:\s/.test(line);

    // Flush on heading boundary (always) or new User turn (new Q&A pair)
    if (isBoundary && current.length > 0) {
      if (HEADING_RE.test(line) || isNewExchange) {
        flush();
        // [CN-PATCH:memory-fix] Heading 和 User: 是硬语义边界。
        // 跨 heading 的 overlap 会把上一个话题的文本混入新话题的 embedding，
        // 直接破坏语义分割的设计初衷。硬边界处不 carry overlap。
        current = [];
        currentChars = 0;
      } else if (isAssistantContinuation && currentChars > maxChars * 0.8) {
        // Assistant turn and chunk already 80%+ full: flush to avoid overflow.
        // Assistant 续接不是硬边界，可以 carry overlap 保持上下文连贯。
        flush();
        carryOverlap();
      }
      // Otherwise (Assistant turn with room): keep in same chunk as User question
    }

    const segments: string[] = [];
    if (line.length === 0) {
      segments.push("");
    } else if (line.length <= maxChars) {
      segments.push(line);
    } else {
      // [CN-PATCH:memory-fix] Smart boundary splitting for long lines.
      // 按语义边界分割而非纯字符截断：句子结束 > 段落断点 > 词边界 > 强制截断。
      // 避免在词中间或 CJK 语义单元中间断开。
      splitLongLine(line, maxChars, segments);
    }
    for (const segment of segments) {
      const lineSize = segment.length + 1;
      if (currentChars + lineSize > maxChars && current.length > 0) {
        flush();
        carryOverlap();
      }
      current.push({ line: segment, lineNo });
      currentChars += lineSize;
    }
  }
  flush();
  return chunks;
}

/**
 * Remap chunk startLine/endLine from content-relative positions to original
 * source file positions using a lineMap.  Each entry in lineMap gives the
 * 1-indexed source line for the corresponding 0-indexed content line.
 *
 * This is used for session JSONL files where buildSessionEntry() flattens
 * messages into a plain-text string before chunking.  Without remapping the
 * stored line numbers would reference positions in the flattened text rather
 * than the original JSONL file.
 */
export function remapChunkLines(chunks: MemoryChunk[], lineMap: number[] | undefined): void {
  if (!lineMap || lineMap.length === 0) {
    return;
  }
  for (const chunk of chunks) {
    // startLine/endLine are 1-indexed; lineMap is 0-indexed by content line
    chunk.startLine = lineMap[chunk.startLine - 1] ?? chunk.startLine;
    chunk.endLine = lineMap[chunk.endLine - 1] ?? chunk.endLine;
  }
}

export function parseEmbedding(raw: string): number[] {
  try {
    const parsed = JSON.parse(raw) as number[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * FIX BUG-R2-6: 维度不匹配时使用 max 长度计算，短向量缺失维度视为 0。
 * 之前用 Math.min 截断导致范数偏小、分数虚高（例如 1536 维 vs 768 维）。
 * 正确行为：超出部分对 dot product 贡献为 0，但仍计入范数。
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) {
    return 0;
  }
  const len = Math.max(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i += 1) {
    const av = i < a.length ? (a[i] ?? 0) : 0;
    const bv = i < b.length ? (b[i] ?? 0) : 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<T[]> {
  if (tasks.length === 0) {
    return [];
  }
  const resolvedLimit = Math.max(1, Math.min(limit, tasks.length));
  const results: T[] = Array.from({ length: tasks.length });
  let next = 0;
  let firstError: unknown = null;

  const workers = Array.from({ length: resolvedLimit }, async () => {
    while (true) {
      if (firstError) {
        return;
      }
      const index = next;
      next += 1;
      if (index >= tasks.length) {
        return;
      }
      try {
        results[index] = await tasks[index]();
      } catch (err) {
        firstError = err;
        return;
      }
    }
  });

  await Promise.allSettled(workers);
  if (firstError) {
    throw firstError;
  }
  return results;
}
