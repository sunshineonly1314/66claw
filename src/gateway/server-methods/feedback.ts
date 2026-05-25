/**
 * 反馈提交 API
 * 接收用户反馈并存储到本地文件，同步到远程服务器
 */

import crypto from "node:crypto";
import { join } from "node:path";
import { appendFile, mkdir, writeFile, readFile } from "node:fs/promises";
import { resolveStateDir } from "../../config/paths.js";
import { getDeviceId } from "../../infra/device-id.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

/** 反馈 API 基础地址 */
const FEEDBACK_API_BASE_URL = "https://www.obplugins.cn/api/api/v1/feedback";

/** 请求超时时间 */
const REQUEST_TIMEOUT_MS = 30000;

/** 字段长度限制 */
const FIELD_LIMITS = {
  id: 64,
  deviceId: 128,
  content: 5000,
  contact: 200,
  attachments: 5,
  version: 20,
  platform: 50,
  page: 50,
  userAgent: 512,
} as const;

export interface FeedbackPayload {
  type: "suggestion" | "bug";
  content: string;
  contact?: string;
  attachments?: string[]; // base64 data URLs
  context?: {
    version?: string;
    platform?: string;
    page?: string;
    userAgent?: string;
    timestamp?: string;
  };
}

interface StoredFeedback extends FeedbackPayload {
  id: string;
  deviceId: string;
  createdAt: string;
  syncedToRemote: boolean;
}

interface RemoteFeedbackRequest {
  id: string;
  deviceId: string;
  type: "suggestion" | "bug";
  content: string;
  contact?: string;
  attachments?: string[];
  context?: FeedbackPayload["context"];
  createdAt: string;
}

interface RemoteFeedbackResponse {
  success: boolean;
  feedbackId?: string;
  message?: string;
}

/**
 * 获取反馈存储目录（与 OPENCLAWCN_STATE_DIR 一致，便于数据统一放在安装目录）
 */
function getFeedbackDir(): string {
  return join(resolveStateDir(), "feedback");
}

/**
 * 获取反馈文件路径
 */
function getFeedbackFilePath(): string {
  return join(getFeedbackDir(), "feedback.jsonl");
}

/**
 * 获取待同步队列文件路径
 */
function getPendingSyncPath(): string {
  return join(getFeedbackDir(), "pending-sync.json");
}

/**
 * 生成反馈ID
 */
function generateFeedbackId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomUUID().slice(0, 8);
  return `fb-${timestamp}-${random}`;
}

/**
 * 保存反馈到本地文件
 */
async function saveFeedbackToLocal(feedback: StoredFeedback): Promise<void> {
  const dir = getFeedbackDir();
  await mkdir(dir, { recursive: true });
  const filePath = getFeedbackFilePath();
  const line = JSON.stringify(feedback) + "\n";
  await appendFile(filePath, line, "utf-8");
}

/**
 * 添加到待同步队列
 */
async function addToPendingSync(feedbackId: string): Promise<void> {
  const dir = getFeedbackDir();
  await mkdir(dir, { recursive: true });
  const pendingPath = getPendingSyncPath();

  let pendingIds: string[] = [];
  try {
    const content = await readFile(pendingPath, "utf-8");
    pendingIds = JSON.parse(content);
  } catch {
    // 文件不存在或解析失败，使用空数组
  }

  if (!pendingIds.includes(feedbackId)) {
    pendingIds.push(feedbackId);
    await writeFile(pendingPath, JSON.stringify(pendingIds, null, 2), "utf-8");
  }
}

/**
 * 从待同步队列移除
 */
async function removeFromPendingSync(feedbackId: string): Promise<void> {
  const pendingPath = getPendingSyncPath();

  try {
    const content = await readFile(pendingPath, "utf-8");
    let pendingIds: string[] = JSON.parse(content);
    pendingIds = pendingIds.filter((id) => id !== feedbackId);
    await writeFile(pendingPath, JSON.stringify(pendingIds, null, 2), "utf-8");
  } catch {
    // 忽略错误
  }
}

/**
 * 同步反馈到远程服务器
 */
async function syncFeedbackToRemote(feedback: StoredFeedback): Promise<boolean> {
  const request: RemoteFeedbackRequest = {
    id: feedback.id,
    deviceId: feedback.deviceId,
    type: feedback.type,
    content: feedback.content,
    contact: feedback.contact,
    attachments: feedback.attachments,
    context: feedback.context,
    createdAt: feedback.createdAt,
  };

  // 中国区：先尝试国内反代，失败再回源
  const urls = [`${FEEDBACK_API_BASE_URL}/submit`];

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "OpenClawCN-Gateway/1.0",
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) continue;

      const result = (await response.json()) as RemoteFeedbackResponse;
      if (result.success === true) return true;
    } catch {
      continue;
    }
  }
  return false;
}

/**
 * 截断字符串到指定长度
 */
function truncate(str: string | undefined, maxLen: number): string | undefined {
  if (!str) return undefined;
  return str.length > maxLen ? str.slice(0, maxLen) : str;
}

export const feedbackHandlers: GatewayRequestHandlers = {
  /**
   * 健康检查接口
   */
  "feedback.health": async ({ respond }) => {
    const urls = [`${FEEDBACK_API_BASE_URL}/health`];

    for (const url of urls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(url, {
          method: "GET",
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          respond(true, { status: "ok", remote: true }, undefined);
          return;
        }
      } catch {
        continue;
      }
    }
    respond(true, { status: "degraded", remote: false, reason: "network_error" }, undefined);
  },

  /**
   * 提交反馈
   */
  "feedback.submit": async ({ respond, params, context }) => {
    const { logGateway } = context;

    try {
      // 安全地获取 payload
      const payload = params as Partial<FeedbackPayload>;

      // 验证必填字段
      if (!payload?.content?.trim()) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "反馈内容不能为空"));
        return;
      }

      const content = payload.content.trim();

      if (content.length < 5) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "反馈内容至少需要5个字符"),
        );
        return;
      }

      if (content.length > FIELD_LIMITS.content) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `反馈内容不能超过${FIELD_LIMITS.content}个字符`),
        );
        return;
      }

      // 验证附件数量
      if (payload.attachments && payload.attachments.length > FIELD_LIMITS.attachments) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `最多只能上传${FIELD_LIMITS.attachments}张图片`),
        );
        return;
      }

      // 获取设备 ID
      const deviceId = await getDeviceId();

      // 构建存储对象（截断字段防止超长）
      const feedback: StoredFeedback = {
        id: generateFeedbackId(),
        deviceId: truncate(deviceId, FIELD_LIMITS.deviceId) || deviceId,
        type: payload.type || "suggestion",
        content,
        contact: truncate(payload.contact?.trim(), FIELD_LIMITS.contact),
        attachments: payload.attachments?.slice(0, FIELD_LIMITS.attachments),
        context: payload.context
          ? {
              version: truncate(payload.context.version, FIELD_LIMITS.version),
              platform: truncate(payload.context.platform, FIELD_LIMITS.platform),
              page: truncate(payload.context.page, FIELD_LIMITS.page),
              userAgent: truncate(payload.context.userAgent, FIELD_LIMITS.userAgent),
              timestamp: payload.context.timestamp,
            }
          : undefined,
        createdAt: new Date().toISOString(),
        syncedToRemote: false,
      };

      // 保存到本地
      await saveFeedbackToLocal(feedback);
      logGateway.info(`Feedback saved: ${feedback.id} (type: ${feedback.type})`);

      // 同步到远程服务器
      const synced = await syncFeedbackToRemote(feedback);

      if (synced) {
        logGateway.info(`Feedback synced to remote: ${feedback.id}`);
        // 从待同步队列移除（如果存在）
        await removeFromPendingSync(feedback.id);
      } else {
        // 同步失败，添加到待同步队列
        logGateway.warn(`Feedback sync failed, added to pending: ${feedback.id}`);
        await addToPendingSync(feedback.id);
      }

      // 无论同步是否成功，都返回成功（本地已保存）
      respond(
        true,
        {
          id: feedback.id,
          synced,
          message: synced
            ? "反馈提交成功，感谢您的宝贵意见！"
            : "反馈已保存，将在网络恢复后自动同步",
        },
        undefined,
      );
    } catch (err) {
      logGateway.warn(`Feedback submit error: ${String(err)}`);
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "提交反馈失败，请稍后重试"));
    }
  },
};
