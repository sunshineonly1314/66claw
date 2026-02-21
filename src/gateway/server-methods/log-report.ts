/**
 * 日志上报运维中心 API
 * 用户从日志页面提交问题描述、截图和最近日志，
 * 本地存储 + 远程同步到 tecbinhome 服务器，
 * 每设备每天限2次。
 */

import { join } from "node:path";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolveStateDir } from "../../config/paths.js";
import { getDeviceId } from "../../license/device-id.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

/** 远程 API 地址 */
const REPORT_API_BASE_URL = "https://www.obplugins.cn/api/api/v1/log-report";

/** 请求超时 */
const REQUEST_TIMEOUT_MS = 30_000;

/** 字段限制 */
const LIMITS = {
  id: 64,
  deviceId: 128,
  description: 2000,
  attachments: 3,
  logEntries: 500,
  /** 每设备每天最多提交次数 */
  maxPerDay: 2,
} as const;

// ── 类型 ──────────────────────────────────────────────────

export interface LogReportPayload {
  description: string;
  attachments?: string[]; // base64 data URLs
  logEntries?: string[]; // 最近日志原始行
  context?: {
    version?: string;
    platform?: string;
    hostname?: string;
    uptime?: number;
    timestamp?: string;
  };
}

interface StoredLogReport extends LogReportPayload {
  id: string;
  deviceId: string;
  createdAt: string;
  syncedToRemote: boolean;
  ticketCode?: string;
}

interface RemoteSubmitResponse {
  success: boolean;
  reportId?: string;
  ticketCode?: string;
  message?: string;
  error?: string;
  retryAfter?: string;
}

interface RemoteStatusResponse {
  success: boolean;
  report?: {
    ticketCode: string;
    status: "pending" | "analyzing" | "replied" | "closed";
    description: string;
    createdAt: string;
    reply?: {
      content: string;
      repliedAt: string;
    } | null;
  };
  error?: string;
  message?: string;
}

// ── 工具函数 ──────────────────────────────────────────────

function getReportDir(): string {
  return join(resolveStateDir(), "log-reports");
}

function getReportFilePath(): string {
  return join(getReportDir(), "reports.jsonl");
}

function getRateLimitPath(): string {
  return join(getReportDir(), "rate-limit.json");
}

function generateReportId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `rpt-${ts}-${rand}`;
}

function truncate(str: string | undefined, max: number): string | undefined {
  if (!str) return undefined;
  return str.length > max ? str.slice(0, max) : str;
}

/** 获取今天的日期键 (CST/UTC+8) */
function todayKey(): string {
  const now = new Date();
  const cst = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return cst.toISOString().slice(0, 10);
}

// ── 频次限制 ─────────────────────────────────────────────

interface RateLimitRecord {
  [deviceId: string]: { date: string; count: number };
}

/** 简单互斥锁，防止并发读写导致频次检查绕过 */
let rateLimitLock: Promise<void> = Promise.resolve();

async function withRateLimitLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = rateLimitLock;
  let resolve: () => void;
  rateLimitLock = new Promise<void>((r) => {
    resolve = r;
  });
  await prev;
  try {
    return await fn();
  } finally {
    resolve!();
  }
}

async function loadRateLimit(): Promise<RateLimitRecord> {
  try {
    const content = await readFile(getRateLimitPath(), "utf-8");
    return JSON.parse(content) as RateLimitRecord;
  } catch {
    return {};
  }
}

async function saveRateLimit(record: RateLimitRecord): Promise<void> {
  const dir = getReportDir();
  await mkdir(dir, { recursive: true });
  await writeFile(getRateLimitPath(), JSON.stringify(record, null, 2), "utf-8");
}

async function checkAndIncrementRate(
  deviceId: string,
): Promise<{ allowed: boolean; remaining: number }> {
  return withRateLimitLock(async () => {
    const record = await loadRateLimit();
    const today = todayKey();
    const entry = record[deviceId];

    if (!entry || entry.date !== today) {
      // 新的一天或首次
      record[deviceId] = { date: today, count: 1 };
      await saveRateLimit(record);
      return { allowed: true, remaining: LIMITS.maxPerDay - 1 };
    }

    if (entry.count >= LIMITS.maxPerDay) {
      return { allowed: false, remaining: 0 };
    }

    entry.count += 1;
    await saveRateLimit(record);
    return { allowed: true, remaining: LIMITS.maxPerDay - entry.count };
  });
}

async function getRemainingQuota(deviceId: string): Promise<number> {
  const record = await loadRateLimit();
  const today = todayKey();
  const entry = record[deviceId];
  if (!entry || entry.date !== today) return LIMITS.maxPerDay;
  return Math.max(0, LIMITS.maxPerDay - entry.count);
}

// ── 本地存储 ─────────────────────────────────────────────

async function saveReportToLocal(report: StoredLogReport): Promise<void> {
  const dir = getReportDir();
  await mkdir(dir, { recursive: true });
  // 本地只存摘要，不存 base64 图片和日志原文（防止磁盘膨胀）
  const summary = {
    id: report.id,
    deviceId: report.deviceId,
    description: report.description,
    attachmentCount: report.attachments?.length ?? 0,
    logEntryCount: report.logEntries?.length ?? 0,
    context: report.context,
    createdAt: report.createdAt,
    syncedToRemote: report.syncedToRemote,
    ticketCode: report.ticketCode,
  };
  const line = JSON.stringify(summary) + "\n";
  await appendFile(getReportFilePath(), line, "utf-8");
}

// ── 远程同步 ─────────────────────────────────────────────

async function syncReportToRemote(report: StoredLogReport): Promise<RemoteSubmitResponse | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(`${REPORT_API_BASE_URL}/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "OpenClawCN-Gateway/1.0",
      },
      body: JSON.stringify({
        id: report.id,
        deviceId: report.deviceId,
        description: report.description,
        attachments: report.attachments,
        logEntries: report.logEntries,
        context: report.context,
        createdAt: report.createdAt,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // 解析响应体（无论成功或失败都尝试解析，以获取服务端错误信息）
    if (!response.ok) {
      try {
        const body = (await response.json()) as RemoteSubmitResponse;
        // 保留服务端的错误信息（429 频率限制、409 重复ID 等）
        return {
          success: false,
          error: body.error,
          message: body.message,
          retryAfter: body.retryAfter,
        };
      } catch {
        return null;
      }
    }
    return (await response.json()) as RemoteSubmitResponse;
  } catch {
    return null;
  }
}

async function queryReportStatus(ticketCode: string): Promise<RemoteStatusResponse | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(
      `${REPORT_API_BASE_URL}/status?ticketCode=${encodeURIComponent(ticketCode)}`,
      {
        method: "GET",
        headers: { "User-Agent": "OpenClawCN-Gateway/1.0" },
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);
    if (!response.ok) {
      // 404 等非 200 响应也可能包含有用信息（如"未找到该工单"）
      try {
        const body = (await response.json()) as RemoteStatusResponse;
        return { success: false, message: body.message ?? "未找到该工单" };
      } catch {
        return null;
      }
    }
    return (await response.json()) as RemoteStatusResponse;
  } catch {
    return null;
  }
}

// ── Gateway Handlers ─────────────────────────────────────

export const logReportHandlers: GatewayRequestHandlers = {
  /**
   * 提交日志报告
   */
  "log_report.submit": async ({ respond, params, context }) => {
    const { logGateway } = context;

    try {
      const payload = params as Partial<LogReportPayload>;

      // 验证描述
      if (!payload.description?.trim()) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "请填写问题描述"));
        return;
      }

      const description = payload.description.trim();

      if (description.length < 5) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "问题描述至少需要5个字符"),
        );
        return;
      }

      if (description.length > LIMITS.description) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `问题描述不能超过${LIMITS.description}个字符`),
        );
        return;
      }

      // 验证附件
      if (payload.attachments && payload.attachments.length > LIMITS.attachments) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `最多只能上传${LIMITS.attachments}张截图`),
        );
        return;
      }

      // 获取设备 ID
      const deviceId = await getDeviceId();

      // 频次检查
      const rateCheck = await checkAndIncrementRate(deviceId);
      if (!rateCheck.allowed) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.UNAVAILABLE, "今天的报告次数已用完（每天最多2次），请明天再试"),
        );
        return;
      }

      // 构建报告（服务端要求 logEntries 非空，日志加载失败时插入占位条目）
      const logEntries = payload.logEntries?.length
        ? payload.logEntries.slice(0, LIMITS.logEntries)
        : ["[no log entries available]"];

      const report: StoredLogReport = {
        id: generateReportId(),
        deviceId: truncate(deviceId, LIMITS.deviceId) || deviceId,
        description,
        attachments: payload.attachments?.slice(0, LIMITS.attachments),
        logEntries,
        context: {
          version: truncate(payload.context?.version, 20) || "unknown",
          platform: truncate(payload.context?.platform, 50),
          hostname: truncate(payload.context?.hostname, 50),
          uptime: payload.context?.uptime,
          timestamp: payload.context?.timestamp || new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
        syncedToRemote: false,
      };

      // 保存到本地
      await saveReportToLocal(report);
      logGateway.info(`Log report saved: ${report.id}`);

      // 同步到远程
      const remoteResult = await syncReportToRemote(report);
      const synced = remoteResult?.success === true;
      const ticketCode = remoteResult?.ticketCode;

      if (synced) {
        logGateway.info(`Log report synced: ${report.id}, ticket: ${ticketCode}`);
      } else {
        const reason = remoteResult?.error ?? "network";
        logGateway.warn(`Log report sync failed: ${report.id}, reason: ${reason}`);
      }

      // 构造失败提示：优先使用服务端返回的消息
      let failMessage: string;
      if (remoteResult && !remoteResult.success && remoteResult.message) {
        failMessage = remoteResult.message;
      } else {
        failMessage =
          "报告已保存到本地但未能上传到运维中心（网络问题），本次提交仍计入今日配额。请检查网络后重试。";
      }

      respond(
        true,
        {
          id: report.id,
          synced,
          ticketCode: ticketCode ?? null,
          remaining: rateCheck.remaining,
          message: synced
            ? `报告已提交${ticketCode ? `，工单号: ${ticketCode}` : ""}。运维人员将尽快分析您的问题。`
            : failMessage,
        },
        undefined,
      );
    } catch (err) {
      logGateway.warn(`Log report submit error: ${String(err)}`);
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "提交报告失败，请稍后重试"));
    }
  },

  /**
   * 查询报告状态（通过工单号）
   */
  "log_report.status": async ({ respond, params, context }) => {
    const { logGateway } = context;
    const ticketCode = (params as { ticketCode?: string }).ticketCode;

    if (!ticketCode || typeof ticketCode !== "string" || ticketCode.length !== 6) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "请输入6位工单号"));
      return;
    }

    const result = await queryReportStatus(ticketCode.toUpperCase());

    if (!result) {
      respond(
        true,
        {
          found: false,
          message: "无法连接运维中心，请稍后重试",
        },
        undefined,
      );
      return;
    }

    if (!result.success || !result.report) {
      respond(
        true,
        {
          found: false,
          message: result.message ?? "未找到该工单",
        },
        undefined,
      );
      return;
    }

    logGateway.info(`Log report status queried: ${ticketCode} -> ${result.report.status}`);

    respond(
      true,
      {
        found: true,
        report: result.report,
      },
      undefined,
    );
  },

  /**
   * 查询今日剩余提交次数
   */
  "log_report.quota": async ({ respond }) => {
    const deviceId = await getDeviceId();
    const remaining = await getRemainingQuota(deviceId);
    respond(true, { remaining, maxPerDay: LIMITS.maxPerDay }, undefined);
  },
};
