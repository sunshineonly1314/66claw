import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { GatewayRequestHandlers } from "./types.js";
import { getResolvedLoggerSettings } from "../../logging.js";
import { clamp } from "../../utils.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateLogsTailParams,
} from "../protocol/index.js";

const DEFAULT_LIMIT = 500;
const DEFAULT_MAX_BYTES = 250_000;
const MAX_LIMIT = 5000;
const MAX_BYTES = 1_000_000;
const ROLLING_LOG_RE = /^openclawcn-\d{4}-\d{2}-\d{2}\.log$/;

function isDesktopMode(): boolean {
  return process.env.OPENCLAWCN_DESKTOP_MODE === "1";
}

/**
 * Resolve the sidecar.log path for Tauri desktop mode.
 * Windows: <app_dir>/sidecar.log  (app_dir = process.cwd() set by Tauri)
 * macOS:   ~/Library/Logs/ClawdbotCN/sidecar.log
 */
function resolveSidecarLogPath(): string {
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Logs", "ClawdbotCN", "sidecar.log");
  }
  // Windows (and fallback for other platforms): cwd is set to app_dir by Tauri
  return path.join(process.cwd(), "sidecar.log");
}

function isRollingLogFile(file: string): boolean {
  return ROLLING_LOG_RE.test(path.basename(file));
}

async function resolveLogFile(file: string): Promise<string> {
  const stat = await fs.stat(file).catch(() => null);
  if (stat) {
    return file;
  }
  if (!isRollingLogFile(file)) {
    return file;
  }

  const dir = path.dirname(file);
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => null);
  if (!entries) {
    return file;
  }

  const candidates = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && ROLLING_LOG_RE.test(entry.name))
      .map(async (entry) => {
        const fullPath = path.join(dir, entry.name);
        const fileStat = await fs.stat(fullPath).catch(() => null);
        return fileStat ? { path: fullPath, mtimeMs: fileStat.mtimeMs } : null;
      }),
  );
  const sorted = candidates
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .toSorted((a, b) => b.mtimeMs - a.mtimeMs);
  if (sorted[0]?.path) {
    return sorted[0].path;
  }

  // In desktop mode, rolling log files may not exist — fall back to sidecar.log
  if (isDesktopMode()) {
    const sidecar = resolveSidecarLogPath();
    const sidecarStat = await fs.stat(sidecar).catch(() => null);
    if (sidecarStat) {
      return sidecar;
    }
  }

  return file;
}

async function readLogSlice(params: {
  file: string;
  cursor?: number;
  limit: number;
  maxBytes: number;
}) {
  const stat = await fs.stat(params.file).catch(() => null);
  if (!stat) {
    return {
      cursor: 0,
      size: 0,
      lines: [] as string[],
      truncated: false,
      reset: false,
    };
  }

  const size = stat.size;
  const maxBytes = clamp(params.maxBytes, 1, MAX_BYTES);
  const limit = clamp(params.limit, 1, MAX_LIMIT);
  let cursor =
    typeof params.cursor === "number" && Number.isFinite(params.cursor)
      ? Math.max(0, Math.floor(params.cursor))
      : undefined;
  let reset = false;
  let truncated = false;
  let start = 0;

  if (cursor != null) {
    if (cursor > size) {
      reset = true;
      start = Math.max(0, size - maxBytes);
      truncated = start > 0;
    } else {
      start = cursor;
      if (size - start > maxBytes) {
        reset = true;
        truncated = true;
        start = Math.max(0, size - maxBytes);
      }
    }
  } else {
    start = Math.max(0, size - maxBytes);
    truncated = start > 0;
  }

  if (size === 0 || size <= start) {
    return {
      cursor: size,
      size,
      lines: [] as string[],
      truncated,
      reset,
    };
  }

  const handle = await fs.open(params.file, "r");
  try {
    let prefix = "";
    if (start > 0) {
      const prefixBuf = Buffer.alloc(1);
      const prefixRead = await handle.read(prefixBuf, 0, 1, start - 1);
      prefix = prefixBuf.toString("utf8", 0, prefixRead.bytesRead);
    }

    const length = Math.max(0, size - start);
    const buffer = Buffer.alloc(length);
    const readResult = await handle.read(buffer, 0, length, start);
    const text = buffer.toString("utf8", 0, readResult.bytesRead);
    let lines = text.split("\n");
    if (start > 0 && prefix !== "\n") {
      lines = lines.slice(1);
    }
    if (lines.length > 0 && lines[lines.length - 1] === "") {
      lines = lines.slice(0, -1);
    }
    if (lines.length > limit) {
      lines = lines.slice(lines.length - limit);
    }

    cursor = size;

    return {
      cursor,
      size,
      lines,
      truncated,
      reset,
    };
  } finally {
    await handle.close();
  }
}

export const logsHandlers: GatewayRequestHandlers = {
  "logs.reveal": async ({ respond }) => {
    let dir: string;
    if (isDesktopMode()) {
      const sidecar = resolveSidecarLogPath();
      const sidecarStat = await fs.stat(sidecar).catch(() => null);
      dir = sidecarStat ? path.dirname(sidecar) : path.dirname(getResolvedLoggerSettings().file);
    } else {
      dir = path.dirname(getResolvedLoggerSettings().file);
    }
    const platform = process.platform;
    let bin: string;
    if (platform === "win32") {
      bin = "explorer";
    } else if (platform === "darwin") {
      bin = "open";
    } else {
      bin = "xdg-open";
    }
    execFile(bin, [dir], (err) => {
      if (err) {
        // Windows explorer returns exit code 1 even on success when opening a folder.
        if (platform === "win32" && (err as any).code === 1) {
          respond(true, { ok: true, path: dir }, undefined);
          return;
        }
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INTERNAL_ERROR, `Failed to open folder: ${err.message}`),
        );
        return;
      }
      respond(true, { ok: true, path: dir }, undefined);
    });
  },
  "logs.tail": async ({ params, respond }) => {
    if (!validateLogsTailParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid logs.tail params: ${formatValidationErrors(validateLogsTailParams.errors)}`,
        ),
      );
      return;
    }

    const p = params as { cursor?: number; limit?: number; maxBytes?: number };
    const configuredFile = getResolvedLoggerSettings().file;
    try {
      const file = await resolveLogFile(configuredFile);
      const result = await readLogSlice({
        file,
        cursor: p.cursor,
        limit: p.limit ?? DEFAULT_LIMIT,
        maxBytes: p.maxBytes ?? DEFAULT_MAX_BYTES,
      });
      respond(true, { file, ...result }, undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `log read failed: ${String(err)}`),
      );
    }
  },
};
