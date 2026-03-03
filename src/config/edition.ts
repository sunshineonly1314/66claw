/**
 * 服务端 edition 判断工具
 *
 * 优先读取环境变量 VITE_EDITION，其次读取 build-info.json 中的 edition 字段。
 * 默认为 "cn"（内销）。
 */
import { createRequire } from "node:module";

function readEditionFromBuildInfo(): string | null {
  try {
    const require = createRequire(import.meta.url);
    for (const candidate of ["../build-info.json", "../../build-info.json", "./build-info.json"]) {
      try {
        const info = require(candidate) as { edition?: string };
        if (info.edition) return info.edition;
      } catch {
        // ignore missing candidate
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export const EDITION: "cn" | "overseas" =
  process.env.VITE_EDITION === "overseas"
    ? "overseas"
    : readEditionFromBuildInfo() === "overseas"
      ? "overseas"
      : "cn";

export const isCN = EDITION === "cn";
export const isOverseas = EDITION === "overseas";
