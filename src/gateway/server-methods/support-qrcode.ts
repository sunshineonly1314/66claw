/**
 * Gateway Methods - Support QR Code
 * 技术支持群二维码专用 Gateway 方法
 *
 * 提供二维码的预加载和状态查询功能。
 * 进入 chat 页面时 UI 主动调用，确保用户 hover 时立即看到二维码。
 */

import { loadConfig } from "../../config/config.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { getDeviceId } from "../../license/device-id.js";
import {
  preloadSupportQrcode,
  getQrcodeCacheStatus,
  getPurchaseUrl,
  fetchRemotePurchaseUrl,
  getSupportQrcode,
} from "../../license/index.js";
import type { GatewayRequestHandlers } from "./types.js";

const log = createSubsystemLogger("gateway:support-qrcode");

/**
 * 获取购买链接：本地配置优先，远程 API 备选
 * 仅试用/测试用户需要购买链接
 */
async function resolvePurchaseUrl(keyType: string): Promise<string | null> {
  if (keyType === "standard") return null;

  // 1. 本地配置文件
  const local = getPurchaseUrl();
  if (local) return local;

  // 2. 远程 API（服务端调用，无 CORS 限制）
  try {
    return await fetchRemotePurchaseUrl();
  } catch {
    return null;
  }
}

export const supportQrcodeHandlers: GatewayRequestHandlers = {
  /**
   * support.qrcode.preload - 预加载二维码
   *
   * 进入 chat 页面时 UI 主动调用。
   * 如果缓存有效直接返回，否则触发远程拉取。
   *
   * 返回：
   *   - status: "valid" | "refreshing" | "fetching" | "failed"
   *   - qrcode: { base64, groupName } | null
   *   - expiresAt: number | null
   *   - remainingMs: number
   *   - purchaseUrl: string | null (仅试用用户)
   */
  "support.qrcode.preload": async ({ respond }) => {
    const config = loadConfig();
    const key = config.license?.key;
    const keyType = (config.license?.keyType ?? "test") as "test" | "trial" | "standard";
    const deviceId = config.license?.deviceId || getDeviceId();

    // 购买链接（本地 → 远程 API）
    const purchaseUrl = await resolvePurchaseUrl(keyType);

    // 无授权码 → 尝试返回本地文件夹的二维码（兼容模式）
    if (!key) {
      const localQrcode = getSupportQrcode(keyType, deviceId);
      respond(true, {
        status: localQrcode ? "valid" : "failed",
        qrcode: localQrcode,
        expiresAt: null,
        remainingMs: 0,
        purchaseUrl,
        source: "local",
      });
      return;
    }

    try {
      // 尝试远程预加载
      const result = await preloadSupportQrcode(key, deviceId, keyType);

      // 如果远程拉取失败，回退到本地文件夹
      if (result.status === "failed" && !result.qrcode) {
        const localQrcode = getSupportQrcode(keyType, deviceId);
        if (localQrcode) {
          respond(true, {
            status: "valid",
            qrcode: localQrcode,
            expiresAt: null,
            remainingMs: 0,
            purchaseUrl,
            source: "local-fallback",
          });
          return;
        }
      }

      respond(true, {
        status: result.status,
        qrcode: result.qrcode,
        expiresAt: result.expiresAt,
        remainingMs: result.remainingMs,
        purchaseUrl,
        source: "remote",
      });
    } catch (error) {
      log.error("Failed to preload support QR code", { error });

      // 最终降级：本地文件夹
      const localQrcode = getSupportQrcode(keyType, deviceId);
      respond(true, {
        status: localQrcode ? "valid" : "failed",
        qrcode: localQrcode,
        expiresAt: null,
        remainingMs: 0,
        purchaseUrl,
        source: "local-fallback",
      });
    }
  },

  /**
   * support.qrcode.status - 查询缓存状态（调试用）
   */
  "support.qrcode.status": async ({ respond }) => {
    const cacheStatus = getQrcodeCacheStatus();
    respond(true, cacheStatus);
  },
};
