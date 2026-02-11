/**
 * Gateway Methods - Support QR Code
 * 技术支持群二维码专用 Gateway 方法（简化版）
 *
 * 直接返回本地静态二维码图片，无远程拉取。
 */

import { loadConfig } from "../../config/config.js";
import { getDeviceId } from "../../license/device-id.js";
import { getSupportQrcode } from "../../license/index.js";
import type { GatewayRequestHandlers } from "./types.js";

export const supportQrcodeHandlers: GatewayRequestHandlers = {
  /**
   * support.qrcode.preload - 返回本地二维码
   */
  "support.qrcode.preload": async ({ respond }) => {
    const config = loadConfig();
    const keyType = (config.license?.keyType ?? "test") as "test" | "trial" | "standard";
    const deviceId = config.license?.deviceId || getDeviceId();

    const qrcode = getSupportQrcode(keyType, deviceId);
    respond(true, {
      status: qrcode ? "valid" : "failed",
      qrcode,
      expiresAt: null,
      remainingMs: 0,
      purchaseUrl: null,
      source: "local",
    });
  },

  /**
   * support.qrcode.status - 查询状态（简化版）
   */
  "support.qrcode.status": async ({ respond }) => {
    respond(true, { hasCached: true, isExpired: false });
  },
};
