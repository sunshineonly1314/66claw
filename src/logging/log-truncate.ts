/**
 * Smart log truncation for upload.
 *
 * Reduces log content to a target size (default 100KB) while maximizing
 * diagnostic value. Preserves error context, startup sequences, and
 * deduplicates repetitive messages.
 */

import fs from "node:fs";
import path from "node:path";
import { parseLogLine } from "./parse-log-line.js";
import { sanitizeText } from "./sanitize.js";

const DEFAULT_TARGET_BYTES = 100 * 1024; // 100 KB

export interface TruncateOptions {
  /** Maximum output size in bytes. Default: 100KB. */
  targetBytes?: number;
  /** Hint about the failure type to optimize truncation strategy. */
  failureHint?: "startup" | "crash" | "general";
}

interface ScoredLine {
  raw: string;
  score: number;
  time?: string;
  level?: string;
  subsystem?: string;
}

const LEVEL_SCORES: Record<string, number> = {
  fatal: 100,
  error: 80,
  warn: 40,
  info: 10,
  debug: 2,
  trace: 1,
};

/**
 * Read a log file from disk (last `maxReadBytes`), parse and return scored lines.
 */
function readAndScoreFile(filePath: string, maxReadBytes: number): ScoredLine[] {
  let text: string;
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size === 0) return [];
    const start = Math.max(0, stat.size - maxReadBytes);
    const fd = fs.openSync(filePath, "r");
    try {
      const buf = Buffer.alloc(Math.min(stat.size, maxReadBytes));
      fs.readSync(fd, buf, 0, buf.length, start);
      text = buf.toString("utf8");
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return [];
  }

  const rawLines = text.split("\n");
  // Drop first line if we started mid-file (may be incomplete).
  if (rawLines.length > 1 && text.length >= maxReadBytes) {
    rawLines.shift();
  }

  const scored: ScoredLine[] = [];
  for (const raw of rawLines) {
    if (!raw.trim()) continue;
    const parsed = parseLogLine(raw);
    const level = parsed?.level ?? "info";
    scored.push({
      raw,
      score: LEVEL_SCORES[level] ?? 10,
      time: parsed?.time,
      level,
      subsystem: parsed?.subsystem,
    });
  }
  return scored;
}

/**
 * Deduplicate consecutive lines with the same subsystem and message content.
 * Keeps the first and last occurrence, inserts a "[...repeated N times]" marker.
 */
function deduplicateConsecutive(lines: ScoredLine[]): ScoredLine[] {
  if (lines.length <= 2) return lines;
  const result: ScoredLine[] = [];
  let repeatCount = 0;
  let prevKey = "";

  for (let i = 0; i < lines.length; i++) {
    const key = `${lines[i].subsystem ?? ""}|${lines[i].raw.slice(0, 200)}`;
    if (key === prevKey) {
      repeatCount++;
      continue;
    }
    if (repeatCount > 1) {
      result.push({
        raw: `[...repeated ${repeatCount} times]`,
        score: 1,
        level: "info",
      });
    } else if (repeatCount === 1 && result.length > 0) {
      // Just one repeat — keep it.
      result.push(lines[i - 1]);
    }
    result.push(lines[i]);
    prevKey = key;
    repeatCount = 0;
  }
  if (repeatCount > 1) {
    result.push({
      raw: `[...repeated ${repeatCount} times]`,
      score: 1,
      level: "info",
    });
  } else if (repeatCount === 1) {
    result.push(lines[lines.length - 1]);
  }
  return result;
}

/**
 * Truncate collected log lines to fit within the target byte size.
 *
 * Strategy:
 * 1. Always keep all fatal/error lines (with 3-line context each).
 * 2. Keep the first 30 lines (startup context) and last 100 lines.
 * 3. Keep warn lines up to 50.
 * 4. Fill remaining budget with most recent info lines.
 * 5. If still over budget, drop from the middle.
 */
function fitToBudget(lines: ScoredLine[], targetBytes: number, hint: string): string[] {
  // Dedup first.
  const deduped = deduplicateConsecutive(lines);

  // Partition by priority.
  const errorLines = new Set<number>();
  const warnLines: number[] = [];
  const infoLines: number[] = [];

  for (let i = 0; i < deduped.length; i++) {
    const lvl = deduped[i].level ?? "info";
    if (lvl === "fatal" || lvl === "error") {
      // Include context: 3 lines before and after.
      for (let j = Math.max(0, i - 3); j <= Math.min(deduped.length - 1, i + 3); j++) {
        errorLines.add(j);
      }
    } else if (lvl === "warn") {
      warnLines.push(i);
    } else {
      infoLines.push(i);
    }
  }

  // Build the keep set and maintain a running byte total to avoid O(n*m) recomputation.
  const keep = new Set<number>();
  let runningTotal = 0;

  const addToKeep = (idx: number) => {
    if (!keep.has(idx)) {
      keep.add(idx);
      runningTotal += deduped[idx].raw.length + 1;
    }
  };

  // 1. All error lines + context.
  for (const idx of errorLines) addToKeep(idx);

  // 2. Startup lines (first 30) — especially important for "startup" hint.
  const startupCount = hint === "startup" ? 60 : 30;
  for (let i = 0; i < Math.min(startupCount, deduped.length); i++) addToKeep(i);

  // 3. Recent tail (last 100 lines).
  for (let i = Math.max(0, deduped.length - 100); i < deduped.length; i++) addToKeep(i);

  // 4. Warn lines (up to 50).
  for (const idx of warnLines.slice(-50)) addToKeep(idx);

  // 5. Fill with recent info (iterate from newest to oldest).
  for (let i = infoLines.length - 1; i >= 0; i--) {
    addToKeep(infoLines[i]);
    if (runningTotal > targetBytes * 0.9) break;
  }

  // Collect and sort by original order.
  const sortedIndices = Array.from(keep).sort((a, b) => a - b);
  const result: string[] = [];
  let totalBytes = 0;
  let prevIdx = -1;

  for (const idx of sortedIndices) {
    // Insert gap marker if there's a discontinuity.
    if (prevIdx >= 0 && idx - prevIdx > 1) {
      const gapLine = `[...${idx - prevIdx - 1} lines omitted...]`;
      if (totalBytes + gapLine.length + 1 < targetBytes) {
        result.push(gapLine);
        totalBytes += gapLine.length + 1;
      }
    }
    const line = deduped[idx].raw;
    if (totalBytes + line.length + 1 > targetBytes) {
      // Hard budget exceeded — truncate remaining.
      result.push(`[...truncated, ${deduped.length - idx} remaining lines omitted...]`);
      break;
    }
    result.push(line);
    totalBytes += line.length + 1;
    prevIdx = idx;
  }

  return result;
}

/**
 * Collect logs from multiple sources, merge, sanitize, and truncate
 * to the target size for upload.
 *
 * @param sources Array of log file paths to read (in priority order).
 * @param options Truncation options.
 * @returns Sanitized, truncated log lines ready for upload.
 */
export function collectAndTruncateLogs(sources: string[], options: TruncateOptions = {}): string[] {
  const targetBytes = options.targetBytes ?? DEFAULT_TARGET_BYTES;
  const hint = options.failureHint ?? "general";

  // Budget per source: divide evenly, but bias toward the first source.
  const perSourceBytes = Math.floor((targetBytes * 1.5) / Math.max(sources.length, 1));

  // Read and score all sources.
  let allLines: ScoredLine[] = [];
  for (const source of sources) {
    const scored = readAndScoreFile(source, perSourceBytes);
    allLines = allLines.concat(scored);
  }

  if (allLines.length === 0) {
    return ["[no log data available]"];
  }

  // Sort by time if available, otherwise keep source order.
  allLines.sort((a, b) => {
    if (a.time && b.time) return a.time.localeCompare(b.time);
    return 0;
  });

  // Fit to budget.
  const truncated = fitToBudget(allLines, targetBytes, hint);

  // Sanitize all lines.
  return truncated.map(sanitizeText);
}

/**
 * Resolve all log file paths that should be collected for a diagnostic upload.
 * Returns paths in priority order: app.jsonl > crash.log > audit.jsonl > legacy rolling log.
 */
export function resolveUploadLogSources(stateDir: string, legacyLogDir?: string): string[] {
  const logsDir = path.join(stateDir, "logs");
  const sources: string[] = [];

  // Primary: ULF unified log.
  sources.push(path.join(logsDir, "app.jsonl"));

  // Crash log (sidecar/Rust output).
  sources.push(path.join(logsDir, "crash.log"));

  // Config audit log.
  sources.push(path.join(logsDir, "audit.jsonl"));

  // Legacy rolling log (if different directory).
  if (legacyLogDir && legacyLogDir !== logsDir) {
    try {
      const entries = fs.readdirSync(legacyLogDir, { withFileTypes: true });
      const rollingRe = /^openclawcn-\d{4}-\d{2}-\d{2}\.log$/;
      const candidates = entries
        .filter((e) => e.isFile() && rollingRe.test(e.name))
        .map((e) => {
          const fp = path.join(legacyLogDir, e.name);
          try {
            return { path: fp, mtimeMs: fs.statSync(fp).mtimeMs };
          } catch {
            return null;
          }
        })
        .filter((c): c is NonNullable<typeof c> => Boolean(c))
        .sort((a, b) => b.mtimeMs - a.mtimeMs);
      if (candidates[0]) {
        sources.push(candidates[0].path);
      }
    } catch {
      // ignore
    }
  }

  return sources;
}
