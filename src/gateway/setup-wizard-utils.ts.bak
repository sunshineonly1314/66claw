/**
 * Setup Wizard - Utility Functions
 * 配置向导的辅助工具函数
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SetupApiResponse } from "./setup-wizard-types.js";

// ============================================================================
// 常量 (Constants)
// ============================================================================

export const SETUP_API_PREFIX = "/api/setup";
export const SETUP_UI_PATH = "/setup";

// ============================================================================
// 辅助函数 (Helper Functions)
// ============================================================================

export function sendJson(res: ServerResponse, status: number, body: SetupApiResponse): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.end(JSON.stringify(body));
}

export async function readJsonBody<T>(req: IncomingMessage): Promise<T | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const body = Buffer.concat(chunks).toString("utf8");
        resolve(JSON.parse(body) as T);
      } catch {
        resolve(null);
      }
    });
    req.on("error", () => resolve(null));
  });
}

export function resolveSetupUiRoot(): string | null {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, "../control-ui"),
    path.resolve(here, "../../dist/control-ui"),
    path.resolve(process.cwd(), "dist", "control-ui"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "index.html"))) return dir;
  }
  return null;
}

/**
 * 将目录路径转换为 Docker bind 格式
 * Convert directory path to Docker bind format
 */
export function formatDockerBind(hostPath: string): string {
  // 获取目录名作为容器内路径
  const dirName = path.basename(hostPath);
  const containerPath = `/trusted/${dirName}`;
  return `${hostPath}:${containerPath}:rw`;
}
