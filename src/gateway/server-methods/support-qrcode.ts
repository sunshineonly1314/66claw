/**
 * Gateway Methods - Support QR Code
 * 技术支持群二维码专用 Gateway 方法（简化版）
 *
 * 直接返回本地静态二维码图片，无远程拉取。
 */

import type { GatewayRequestHandlers } from "./types.js";

export const supportQrcodeHandlers: GatewayRequestHandlers = {
  /**
   * support.qrcode.preload - 返回本地二维码
   */
  "support.qrcode.preload": async ({ respond }) => {
    respond(true, {
      status: "disabled",
      qrcode: null,
      expiresAt: null,
      remainingMs: 0,
      purchaseUrl: null,
      source: "open-source",
    });
  },

  /**
   * support.qrcode.status - 查询状态（简化版）
   */
  "support.qrcode.status": async ({ respond }) => {
    respond(true, { hasCached: false, isExpired: false });
  },
};
