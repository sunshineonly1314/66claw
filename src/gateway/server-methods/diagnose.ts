/**
 * diagnose.logs — 自我排障：读取 gateway / server / error 日志
 *
 * 从安装目录和状态目录下依次读取 gateway.log、gateway.err.log、
 * 当天的滚动应用日志，返回最近 N 行给前端用于 AI 分析。
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { GatewayRequestHandlers } from "./types.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import { getResolvedLoggerSettings } from "../../logging.js";

/** 每个日志文件最多返回的行数 */
const DEFAULT_TAIL_LINES = 200;
const MAX_TAIL_LINES = 1000;
/** 每个文件最多读取字节数 */
const MAX_BYTES_PER_FILE = 512_000;

const ROLLING_LOG_RE = /^openclawcn-\d{4}-\d{2}-\d{2}\.log$/;

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function resolveStateDir(): string {
  const override = process.env.OPENCLAWCN_STATE_DIR?.trim();
  if (override) {
    return path.resolve(override);
  }
  const home = process.env.HOME?.trim() || process.env.USERPROFILE?.trim() || os.homedir();
  return path.join(home, ".openclawcn");
}

function resolveDesktopLogDir(): string | null {
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA?.trim();
    if (localAppData) {
      return path.join(localAppData, "com.clawdbot.cn.desktop", "logs");
    }
  }
  if (process.platform === "darwin") {
    const home = process.env.HOME?.trim() || os.homedir();
    return path.join(home, "Library", "Logs", "ClawdbotCN");
  }
  return null;
}

function resolveTmpLogDir(): string {
  if (process.platform === "win32") {
    return path.join(os.tmpdir(), "openclawcn");
  }
  // POSIX: prefer /tmp/openclawcn
  const preferred = "/tmp/openclawcn";
  return preferred;
}

/** 读取文件的最后 N 行，最多读 maxBytes 字节 */
async function readTailLines(
  filePath: string,
  tailLines: number,
  maxBytes: number,
): Promise<{ lines: string[]; sizeBytes: number; exists: boolean }> {
  const stat = await fs.stat(filePath).catch(() => null);
  if (!stat || !stat.isFile()) {
    return { lines: [], sizeBytes: 0, exists: false };
  }

  const size = stat.size;
  if (size === 0) {
    return { lines: [], sizeBytes: 0, exists: true };
  }

  const start = Math.max(0, size - maxBytes);
  const length = size - start;

  const handle = await fs.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, start);
    const text = buffer.toString("utf8", 0, bytesRead);

    let lines = text.split("\n");
    // 如果从文件中间开始读，丢弃第一行（可能不完整）
    if (start > 0 && lines.length > 0) {
      lines = lines.slice(1);
    }
    // 删除末尾空行
    if (lines.length > 0 && lines[lines.length - 1] === "") {
      lines = lines.slice(0, -1);
    }
    // 只保留最后 N 行
    if (lines.length > tailLines) {
      lines = lines.slice(lines.length - tailLines);
    }

    return { lines, sizeBytes: size, exists: true };
  } finally {
    await handle.close();
  }
}

/** 查找今天的滚动日志文件，如果不存在则找最近的 */
async function findRollingLogFile(logDir: string): Promise<string | null> {
  const today = new Date().toISOString().slice(0, 10);
  const todayFile = path.join(logDir, `openclawcn-${today}.log`);
  const todayStat = await fs.stat(todayFile).catch(() => null);
  if (todayStat) {
    return todayFile;
  }

  // fallback: 找最近修改的
  const entries = await fs.readdir(logDir, { withFileTypes: true }).catch(() => null);
  if (!entries) {
    return null;
  }
  const candidates = await Promise.all(
    entries
      .filter((e) => e.isFile() && ROLLING_LOG_RE.test(e.name))
      .map(async (e) => {
        const fp = path.join(logDir, e.name);
        const st = await fs.stat(fp).catch(() => null);
        return st ? { path: fp, mtimeMs: st.mtimeMs } : null;
      }),
  );
  const sorted = candidates
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return sorted[0]?.path ?? null;
}

// ---------------------------------------------------------------------------
// 额外检查函数
// ---------------------------------------------------------------------------

async function checkGatewayProcess(): Promise<string> {
  // 简单检查：尝试连接默认端口
  const port = process.env.OPENCLAWCN_GATEWAY_PORT?.trim() || "18789";
  return `Gateway port: ${port} (check via netstat/lsof)`;
}

async function checkConfigFile(stateDir: string): Promise<{
  exists: boolean;
  path: string;
  sizeBytes: number;
}> {
  const configPath = path.join(stateDir, "openclawcn.json");
  const stat = await fs.stat(configPath).catch(() => null);
  return {
    exists: Boolean(stat),
    path: configPath,
    sizeBytes: stat?.size ?? 0,
  };
}

// ---------------------------------------------------------------------------
// 导出 handler
// ---------------------------------------------------------------------------

export interface DiagnoseLogsResult {
  timestamp: string;
  platform: string;
  stateDir: string;
  configFile: { exists: boolean; path: string; sizeBytes: number };
  logs: Array<{
    name: string;
    path: string;
    exists: boolean;
    sizeBytes: number;
    lines: string[];
  }>;
  gatewayInfo: string;
}

export const diagnoseHandlers: GatewayRequestHandlers = {
  "diagnose.logs": async ({ params, respond }) => {
    const p = params as { tailLines?: unknown };
    const rawTail = typeof p.tailLines === "number" && Number.isFinite(p.tailLines)
      ? Math.floor(p.tailLines)
      : DEFAULT_TAIL_LINES;
    const tailLines = Math.min(Math.max(1, rawTail), MAX_TAIL_LINES);

    try {
      const stateDir = resolveStateDir();
      const logsDir = path.join(stateDir, "logs");
      const tmpLogDir = resolveTmpLogDir();
      const desktopLogDir = resolveDesktopLogDir();

      // 构建要读取的日志文件列表
      const logFiles: Array<{ name: string; filePath: string }> = [
        { name: "gateway.log", filePath: path.join(logsDir, "gateway.log") },
        { name: "gateway.err.log", filePath: path.join(logsDir, "gateway.err.log") },
      ];

      // 滚动应用日志
      const rollingFile = await findRollingLogFile(tmpLogDir);
      if (rollingFile) {
        logFiles.push({ name: "app-rolling.log", filePath: rollingFile });
      } else {
        // 也检查 getResolvedLoggerSettings 的路径
        const configured = getResolvedLoggerSettings().file;
        if (configured) {
          logFiles.push({ name: "app-rolling.log", filePath: configured });
        }
      }

      // 桌面版日志
      if (desktopLogDir) {
        logFiles.push({
          name: "desktop-gateway.log",
          filePath: path.join(desktopLogDir, "gateway.log"),
        });
      }

      // 配置审计日志
      logFiles.push({
        name: "config-audit.jsonl",
        filePath: path.join(logsDir, "config-audit.jsonl"),
      });

      // 并行读取所有日志
      const logResults = await Promise.all(
        logFiles.map(async ({ name, filePath }) => {
          const result = await readTailLines(filePath, tailLines, MAX_BYTES_PER_FILE);
          return {
            name,
            path: filePath,
            exists: result.exists,
            sizeBytes: result.sizeBytes,
            lines: result.lines,
          };
        }),
      );

      const configFile = await checkConfigFile(stateDir);
      const gatewayInfo = await checkGatewayProcess();

      const result: DiagnoseLogsResult = {
        timestamp: new Date().toISOString(),
        platform: `${process.platform} (${os.release()})`,
        stateDir,
        configFile,
        logs: logResults,
        gatewayInfo,
      };

      respond(true, result, undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `diagnose.logs failed: ${String(err)}`),
      );
    }
  },
};
