/**
 * Gateway License Verification Integration
 * Gateway 授权验证集成
 *
 * 在 Gateway 启动时进行授权验证
 */

import type { ClawdbotConfig } from "../config/config.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import {
  verifyLicenseOnStartup,
  type StartupVerifyResult,
  type LicenseClientState,
} from "../license/index.js";

const log = createSubsystemLogger("gateway:license");

// 全局 license 状态（用于 Gateway 方法访问）
let globalLicenseState: LicenseClientState | null = null;

/**
 * 检查是否启用 CN 版本的授权验证
 * 只有 ClawdbotCN 版本需要进行授权验证
 */
function isLicenseCheckEnabled(config: ClawdbotConfig): boolean {
  // 检查是否是 CN 版本（通过配置或环境变量）
  const isCnVersion =
    process.env.CLAWDBOT_CN === "1" ||
    process.env.CLAWDBOT_REGION === "cn" ||
    config.license?.key !== undefined;

  return isCnVersion;
}

/**
 * Gateway 启动时的授权验证
 *
 * @param config - 配置对象
 * @returns 验证结果
 */
export async function checkLicenseOnGatewayStart(
  config: ClawdbotConfig,
): Promise<StartupVerifyResult | null> {
  // 检查是否需要验证
  if (!isLicenseCheckEnabled(config)) {
    log.debug("License check skipped (not CN version)");
    return null;
  }

  log.info("Checking license on gateway start...");

  try {
    const result = await verifyLicenseOnStartup({
      onInvalid: () => {
        log.warn("License became invalid during runtime");
        // 可以在这里添加通知客户端的逻辑
      },
    });

    // 保存全局状态
    globalLicenseState = result.clientState;

    if (result.canProceed) {
      if (result.offlineMode) {
        log.info("License check passed (offline mode)");
      } else {
        log.info("License check passed", {
          tier: result.clientState.license?.tier,
          daysRemaining: result.clientState.license?.daysRemaining,
        });
      }
    } else {
      log.error(`License check failed: ${result.error}`);
    }

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error(`License check error: ${errorMsg}`);

    return {
      canProceed: false,
      valid: false,
      offlineMode: false,
      deviceId: "",
      nextCheckAfterHours: 24,
      error: errorMsg,
      errorCode: null,
      response: null,
      clientState: {
        checking: false,
        valid: false,
        offlineMode: false,
        error: errorMsg,
        errorCode: null,
        license: null,
        device: null,
        renewalReminder: null,
        forceUpdate: null,
        pendingNotifications: [],
        lastVerifiedAt: null,
      },
    };
  }
}

/**
 * 获取当前 License 状态
 */
export function getGatewayLicenseState(): LicenseClientState | null {
  return globalLicenseState;
}

/**
 * 更新 License 状态
 */
export function updateGatewayLicenseState(state: LicenseClientState): void {
  globalLicenseState = state;
}

/**
 * 检查 License 是否有效（用于运行时检查）
 */
export function isLicenseValid(): boolean {
  if (!globalLicenseState) {
    return true; // 未初始化时默认有效（非 CN 版本）
  }
  return globalLicenseState.valid;
}

/**
 * 获取 License 功能列表
 */
export function getLicenseFeatures(): string[] {
  return globalLicenseState?.license?.features || [];
}

/**
 * 检查是否有特定功能权限
 */
export function hasLicenseFeature(feature: string): boolean {
  const features = getLicenseFeatures();
  return features.length === 0 || features.includes(feature);
}
