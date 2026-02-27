/**
 * Update State — 更新状态持久化模块
 *
 * 将启动检查发现的可用更新信息持久化到 {stateDir}/available-update.json，
 * 供 Gateway RPC 层和 UI 在任意时刻查询。
 */

import fs from "node:fs/promises";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";
import type { InstallerUpdateCheckResult } from "./installer-updater.js";

// ─── Types ─────────────────────────────────────────────

export interface AvailableUpdateState {
  /** 目标版本号 */
  version: string;
  /** 更新模式 */
  updateType: "delta" | "full" | "installer";
  /** 更新日志 */
  changelog: { "zh-CN": string; "en-US": string };
  /** 检查时间 ISO */
  checkedAt: string;
  /** 用户是否已忽略此版本 */
  dismissed: boolean;
  /** 忽略时间 ISO */
  dismissedAt?: string;
  /** 是否强制更新 */
  mandatory?: boolean;
  /** installer 模式的下载链接 */
  installerUrl?: string;
  /** 缓存完整检查结果，update.execute 时直接使用（避免二次网络请求） */
  checkResult: InstallerUpdateCheckResult;
}

// ─── Constants ─────────────────────────────────────────

const STATE_FILENAME = "available-update.json";

function getStatePath(): string {
  return path.join(resolveStateDir(), STATE_FILENAME);
}

// ─── Public API ────────────────────────────────────────

/**
 * 读取当前可用的更新状态
 */
export async function getAvailableUpdate(): Promise<AvailableUpdateState | null> {
  try {
    const raw = await fs.readFile(getStatePath(), "utf-8");
    const parsed = JSON.parse(raw) as AvailableUpdateState;
    if (parsed && typeof parsed === "object" && parsed.version) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 存储可用更新状态
 */
export async function setAvailableUpdate(state: AvailableUpdateState): Promise<void> {
  const filePath = getStatePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  // 原子写入：先写 .tmp 再 rename，防止写入中崩溃导致 JSON 损坏
  const tmpPath = filePath + ".tmp";
  await fs.writeFile(tmpPath, JSON.stringify(state, null, 2), "utf-8");
  try {
    await fs.rename(tmpPath, filePath);
  } catch (renameErr) {
    // Windows 上 rename 可能因杀毒软件锁文件而失败 (EPERM/EBUSY)
    // 降级为直接覆盖写入，并清理残留 .tmp
    await fs.writeFile(filePath, JSON.stringify(state, null, 2), "utf-8");
    try {
      await fs.unlink(tmpPath);
    } catch {
      /* ignore */
    }
  }
}

/**
 * 清除可用更新状态（更新成功后调用）
 *
 * 传入 version 实现版本感知清除：如果在 execute 期间 check 写入了更新的版本，
 * 只清除已应用的版本，不误删更新的版本状态。
 */
export async function clearAvailableUpdate(version?: string): Promise<void> {
  try {
    if (version) {
      const current = await getAvailableUpdate();
      // 状态已是更新的版本 → 不清除
      if (current && current.version !== version) return;
    }
    await fs.unlink(getStatePath());
  } catch {
    // 文件不存在或删除失败，忽略
  }
}

/**
 * 标记指定版本为已忽略（用户点击"稍后"后调用）
 * 同版本不再弹出通知，但新版本会重新触发。
 */
export async function dismissAvailableUpdate(version: string): Promise<void> {
  const state = await getAvailableUpdate();
  if (!state || state.version !== version) return;
  state.dismissed = true;
  state.dismissedAt = new Date().toISOString();
  await setAvailableUpdate(state);
}
