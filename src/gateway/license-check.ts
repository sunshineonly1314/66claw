/**
 * Gateway License Verification Integration
 * Gateway 授权验证集成
 *
 * 在 Gateway 启动时进行授权验证，并启动安全保护机制
 */

import type { OpenClawCNConfig } from "../config/config.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import {
  verifyLicenseOnStartup,
  type StartupVerifyResult,
  type LicenseClientState,
  type LicenseModuleConfig,
  LicenseErrorCode,
  startTokenAutoRefresh,
  stopTokenAutoRefresh,
  hasValidToken,
  getTokenStatusSummary,
  refreshToken,
  loadLicenseCache,
  DEFAULT_LICENSE_CONFIG,
} from "../license/index.js";
import { loadConfig } from "../config/config.js";
import { detectChinaRegion } from "../config/region-cn.js";
import {
  startAntiDebug,
  stopAntiDebug,
  checkIntegrityOnStartup,
  startIntegrityPatrol,
  initAiTamperProtection,
  verifyCheckpoint,
  registerProtectedFunction,
  reportSecurityViolation,
  recordViolation,
} from "../security/index.js";

const log = createSubsystemLogger("gateway:license");

// 全局 license 状态（用于 Gateway 方法访问）
let globalLicenseState: LicenseClientState | null = null;

/**
 * In-memory snapshot of the encrypted license cache.
 * Loaded asynchronously at startup, read synchronously by isLicenseValid().
 * This avoids making the hot-path isLicenseValid() async while still
 * supporting AES-256-GCM encrypted cache files.
 */
let _memoryCacheFallback: { valid: boolean; expiresAt: string | null } | null = null;

/**
 * Pre-load the license cache from encrypted storage into memory.
 * Called once during gateway startup (async context).
 */
async function preloadLicenseCacheToMemory(): Promise<void> {
  try {
    const cache = await loadLicenseCache();
    if (cache && cache.valid && cache.expiresAt) {
      _memoryCacheFallback = { valid: cache.valid, expiresAt: cache.expiresAt };
    }
  } catch (e) {
    log.debug(`Failed to preload license cache to memory: ${e}`);
  }
}

/**
 * 从内存缓存加载 license 信息（用于后备验证）
 * Synchronous — reads from in-memory snapshot populated at startup.
 */
function loadLicenseCacheForFallback(): { valid: boolean; expiresAt: string | null } | null {
  return _memoryCacheFallback;
}

/**
 * 检查 license 是否已过期
 */
function checkLicenseExpiry(expiresAtMs: number): boolean {
  if (Date.now() > expiresAtMs) {
    log.warn("License expired at runtime (detected by expiry check)");
    return false;
  }
  return true;
}

// 授权验证的独立副本（用于分散验证）
let _licenseValidSnapshot = false;
let _licenseExpiresAt: number | null = null;

// pending 状态：验证进行中时阻止使用，避免 TOCTOU 竞态
let _licensePending = false;

/**
 * 检查是否启用 CN 版本的授权验证
 * 只有 OpenClawCN 版本需要进行授权验证
 */
export function isLicenseCheckEnabled(config: OpenClawCNConfig): boolean {
  // 检查是否是 CN 版本（通过配置或环境变量）
  const isCnVersion =
    process.env.OPENCLAWCN_CN === "1" ||
    process.env.OPENCLAWCN_REGION === "cn" ||
    config.license?.key !== undefined;

  return isCnVersion;
}

/**
 * Gateway 启动时的授权验证
 *
 * 验证流程：
 * 1. 检查文件完整性（可选，防止代码被篡改）
 * 2. 验证授权许可证
 * 3. 启动反调试检测（生产环境）
 *
 * @param config - 配置对象
 * @returns 验证结果
 */
export async function checkLicenseOnGatewayStart(
  config: OpenClawCNConfig,
  options?: { skipIntegrity?: boolean },
): Promise<StartupVerifyResult | null> {
  // 检查是否需要验证
  if (!isLicenseCheckEnabled(config)) {
    log.debug("License check skipped (not CN version)");
    return null;
  }

  log.info("Checking license on gateway start...");
  _licensePending = true;

  // Pre-load encrypted license cache into memory (async → sync fallback)
  await preloadLicenseCacheToMemory();

  // 步骤 1：文件完整性校验（可通过 skipIntegrity 跳过，用于测试/并行启动）
  if (!options?.skipIntegrity) {
    // 安全策略：任何完整性校验失败/异常都必须阻止启动
    try {
      const integrityPassed = await checkIntegrityOnStartup({
        exitOnFailure: true, // 检测到篡改时强制退出程序
        useServerHashes: true, // 优先从服务端获取哈希（5秒超时，回退到本地）
        apiBaseUrl: DEFAULT_LICENSE_CONFIG.apiBaseUrl,
      });
      if (!integrityPassed) {
        // 此处理论上不会执行，因为 exitOnFailure=true 时会直接 exit
        log.error("SECURITY VIOLATION: File tampering detected, refusing to start");
        console.error("[安全警告] 检测到文件被篡改，程序退出");
        process.exit(1);
      }
      log.debug("Integrity check passed");
    } catch (error) {
      // 安全策略：完整性校验出错时必须阻止启动
      log.error(
        `SECURITY VIOLATION: Integrity check error: ${error instanceof Error ? error.message : String(error)}`,
      );
      console.error("[安全警告] 完整性校验失败，程序退出");
      process.exit(1);
    }
  }

  // 步骤 2：授权验证
  // 中国区自动配置备用 URL 和更长离线宽限期
  const cnLicenseOverrides: Partial<LicenseModuleConfig> | undefined = detectChinaRegion()
    ? {
        apiFallbackUrls: [
          // 主域名回源（obplugins.cn 不可用时兜底）
          "https://www.tecbinai.com/api/api/v1/license",
        ],
        offlineGracePeriodHours: 48, // CN 用户跨境网络不稳定，宽限期 48h
      }
    : undefined;

  try {
    // 30 秒超时保护：防止网络不通时 license 校验永远卡住
    // 超时后自动 fallback 到离线模式（使用本地缓存）
    const LICENSE_VERIFY_TIMEOUT_MS = 30_000;
    // Guard flag: if the timeout fires first, the still-running verify
    // promise's callbacks (e.g. onInvalid) must not mutate global state
    // that the fallback path has already set.
    let licenseCheckAborted = false;
    const verifyPromise = verifyLicenseOnStartup({
      config: cnLicenseOverrides,
      onInvalid: () => {
        // Guard: if we already timed out, don't mutate global state
        if (licenseCheckAborted) return;
        log.warn("License became invalid during runtime");
      },
    });
    const timeoutPromise = new Promise<never>((_, reject) => {
      const t = setTimeout(
        () => reject(new Error("License verification timed out after 30s")),
        LICENSE_VERIFY_TIMEOUT_MS,
      );
      // Don't keep process alive just for this timer
      t.unref?.();
    });
    let result: Awaited<typeof verifyPromise>;
    try {
      result = await Promise.race([verifyPromise, timeoutPromise]);
    } catch (raceErr) {
      // Mark aborted so the still-running verify promise won't mutate state
      licenseCheckAborted = true;
      throw raceErr;
    }

    // 保存全局状态
    globalLicenseState = result.clientState;

    // Refresh in-memory cache from encrypted storage (async result now settled)
    await preloadLicenseCacheToMemory();

    // 同步更新独立副本（用于分散验证）
    _licenseValidSnapshot = result.clientState.valid;
    if (result.clientState.license?.expiresAt) {
      _licenseExpiresAt = new Date(result.clientState.license.expiresAt).getTime();
    }

    if (result.canProceed) {
      if (result.offlineMode) {
        log.info("License check passed (offline mode)");
      } else {
        log.info("License check passed", {
          tier: result.clientState.license?.tier,
          daysRemaining: result.clientState.license?.daysRemaining,
        });
      }

      // 步骤 3：启动反调试检测（仅在授权验证成功后）
      startAntiDebug({
        enabled: true,
        checkIntervalMs: 30000, // 30 秒检测一次
      });
      log.debug("Anti-debug protection started");

      // 步骤 4：初始化 AI 篡改防护
      initAiTamperProtection();

      // 注册受保护的函数
      registerProtectedFunction("isLicenseValid", isLicenseValid);
      registerProtectedFunction("getGatewayLicenseState", getGatewayLicenseState);
      log.debug("AI tamper protection initialized");

      // 步骤 5：启动运行时完整性巡检 + 延迟惩罚联动
      startIntegrityPatrol({
        intervalMs: 5 * 60 * 1000, // 5 分钟一次
        sampleSize: 3, // 每次随机检查 3 个文件
        onTamper: (tamperedFiles) => {
          log.error(`Runtime integrity violation: ${tamperedFiles.join(", ")}`);
          reportSecurityViolation("runtime_integrity_tamper", { tamperedFiles });
          // Feed into delayed enforcement system (Knife 7)
          for (const f of tamperedFiles) {
            recordViolation(`integrity:${f}`);
          }
        },
      });
      log.debug("Runtime integrity patrol started");

      // 步骤 5：启动短期令牌自动刷新
      let cfg: ReturnType<typeof loadConfig>;
      try {
        cfg = loadConfig();
      } catch (cfgErr) {
        log.warn(`Failed to load config for token refresh setup: ${cfgErr}`);
        cfg = {} as ReturnType<typeof loadConfig>;
      }
      const licenseKey = cfg.license?.key;
      if (licenseKey) {
        startTokenAutoRefresh(licenseKey, {
          intervalMs: 30 * 60 * 1000, // 30 分钟检查一次
          onInvalid: () => {
            log.warn("Token became invalid, license features may be restricted");
            // 更新全局状态
            if (globalLicenseState) {
              globalLicenseState = {
                ...globalLicenseState,
                valid: false,
                error: "令牌已失效，请检查网络连接",
              };
              _licenseValidSnapshot = false;
            }
          },
        });
        log.debug("Token auto-refresh started");
      }
    } else {
      log.error(`License check failed: ${result.error}`);
    }

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const isTimeout = errorMsg.includes("timed out");
    log.error(`License check error${isTimeout ? " (timeout)" : ""}: ${errorMsg}`);

    // 超时或网络错误时尝试 fallback 到本地缓存
    // 这对 CN 用户至关重要 — 网络不稳定不应阻止启动
    const localCache = loadLicenseCacheForFallback();
    if (localCache && localCache.valid && localCache.expiresAt) {
      const expiresAt = new Date(localCache.expiresAt).getTime();
      if (Date.now() < expiresAt) {
        log.info(`License fallback to local cache (valid until ${localCache.expiresAt})`);
        const fallbackResult: StartupVerifyResult = {
          canProceed: true,
          valid: true,
          offlineMode: true,
          deviceId: "",
          nextCheckAfterHours: 1,
          error: null,
          errorCode: null,
          response: null,
          clientState: {
            checking: false,
            valid: true,
            offlineMode: true,
            error: null,
            errorCode: null,
            license: null,
            device: null,
            renewalReminder: null,
            forceUpdate: null,
            pendingNotifications: [],
            lastVerifiedAt: Date.now(),
            deviceSwitchInfo: null,
            deviceSwitchCooldown: null,
          },
        };
        globalLicenseState = fallbackResult.clientState;
        _licenseValidSnapshot = true;
        return fallbackResult;
      }
    }

    const failResult: StartupVerifyResult = {
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
        deviceSwitchInfo: null,
        deviceSwitchCooldown: null,
      },
    };
    // fail-close: 更新全局状态确保 isLicenseValid() 返回 false
    globalLicenseState = failResult.clientState;
    _licenseValidSnapshot = false;
    return failResult;
  } finally {
    _licensePending = false;
  }
}

/**
 * 停止安全保护服务
 */
export function stopSecurityServices(): void {
  stopAntiDebug();
  stopTokenAutoRefresh();
  log.debug("Security services stopped");
}

/**
 * 获取当前 License 状态
 */
export function getGatewayLicenseState(): LicenseClientState | null {
  // pending 期间返回合成状态，避免 UI 崩溃或显示错误信息
  if (_licensePending) {
    return {
      checking: true,
      valid: false,
      offlineMode: false,
      error: "授权验证中，请稍候...",
      errorCode: null,
      license: null,
      device: null,
      renewalReminder: null,
      forceUpdate: null,
      pendingNotifications: [],
      lastVerifiedAt: null,
      deviceSwitchInfo: null,
      deviceSwitchCooldown: null,
    } as LicenseClientState;
  }
  return globalLicenseState;
}

/**
 * 更新 License 状态
 */
export function updateGatewayLicenseState(state: LicenseClientState): void {
  globalLicenseState = state;

  // 同步更新独立副本（用于分散验证）
  _licenseValidSnapshot = state.valid;
  if (state.license?.expiresAt) {
    _licenseExpiresAt = new Date(state.license.expiresAt).getTime();
  }
}

/**
 * 检查 License 是否有效（用于运行时检查）
 *
 * 此函数会同时检查：
 * 1. 全局状态中的 valid 标志
 * 2. 本地缓存中的过期时间（expiresAt）
 * 3. 分散验证检查点（防止函数被篡改）
 * 4. 短期令牌有效性（核心防护，但有容错机制）
 */
export function isLicenseValid(): boolean {
  // pending 期间：验证尚未完成，不允许使用（防止 TOCTOU 竞态）
  if (_licensePending) {
    return false;
  }
  if (!globalLicenseState) {
    return true; // 未初始化时默认有效（非 CN 版本）
  }

  // 核心防护：检查短期令牌
  // 【修复 v2】Token 检查失败时，回退到 license 缓存验证
  // 这样即使 Token 服务暂时不可用，用户仍可使用已验证的授权
  if (!hasValidToken()) {
    const tokenStatus = getTokenStatusSummary();
    log.debug(
      `Token check: hasToken=${tokenStatus.hasToken}, isValid=${tokenStatus.isValid}, failureCount=${tokenStatus.failureCount}`,
    );

    // 如果令牌无效且全局状态显示有效，可能是篡改
    if (globalLicenseState.valid && tokenStatus.hasToken) {
      reportSecurityViolation("token_invalid_but_state_valid", {
        tokenStatus,
        globalValid: globalLicenseState.valid,
      });
      return false; // 有 token 但无效，说明可能被篡改
    }

    // 【修复 v3】如果没有 token，使用本地缓存作为后备验证
    // 这解决了以下场景：
    // 1. Token 服务暂时不可用
    // 2. 网络问题导致 token 刷新失败
    // 3. 首次启动/激活后 token 还在获取中
    // 4. 设备切换冷却中（本地有有效缓存但在线验证失败）

    // 尝试后台获取 token（如果有 key）
    triggerBackgroundTokenRefresh();

    // 【修复 v3】检查本地缓存作为后备验证
    // 即使在线验证失败（如设备冷却），只要本地缓存有效且未过期就允许使用
    const localCache = loadLicenseCacheForFallback();

    if (localCache && localCache.valid && localCache.expiresAt) {
      const expiresAt = new Date(localCache.expiresAt).getTime();
      // Guard against invalid date strings (NaN) which would cause
      // checkLicenseExpiry to behave unpredictably.
      if (!Number.isFinite(expiresAt)) {
        log.warn("Token unavailable and local cache has invalid expiresAt");
        return false;
      }
      if (Date.now() < expiresAt) {
        log.debug(
          `Token unavailable, using local cache as fallback (cache valid until ${localCache.expiresAt})`,
        );
        // 继续执行后续验证，但跳过 globalLicenseState.valid 检查
        return checkLicenseExpiry(expiresAt);
      } else {
        log.warn("Token unavailable and local cache expired");
        return false;
      }
    }

    // 如果没有本地缓存，检查全局状态
    if (globalLicenseState.valid && globalLicenseState.license?.expiresAt) {
      const expiresAt = new Date(globalLicenseState.license.expiresAt).getTime();
      if (Date.now() < expiresAt) {
        log.debug(
          "Token unavailable, using global state as fallback (license valid and not expired)",
        );
        // 继续执行后续验证
      } else {
        log.warn("Token unavailable and license expired");
        return false;
      }
    } else if (!globalLicenseState.valid) {
      log.warn("Token unavailable and license invalid (no local cache)");
      return false;
    } else {
      // license valid 但没有 expiresAt（不应该发生，但为安全起见处理）
      log.debug("Token unavailable, license valid but no expiry info - allowing access");
    }
  }

  // 分散验证检查点 1：检查独立副本是否与全局状态一致
  // 如果不一致，说明有人试图绕过验证
  const checkpoint1 = verifyCheckpoint("license_state_consistency", () => {
    if (_licenseValidSnapshot !== globalLicenseState?.valid) {
      reportSecurityViolation("license_state_mismatch", {
        snapshot: _licenseValidSnapshot,
        current: globalLicenseState?.valid,
      });
      return false;
    }
    return true;
  });

  if (!checkpoint1) {
    return false;
  }

  // 首先检查全局状态
  if (!globalLicenseState.valid) {
    return false;
  }

  // 然后检查本地缓存的过期时间
  if (globalLicenseState.license?.expiresAt) {
    const expiresAt = new Date(globalLicenseState.license.expiresAt).getTime();

    // 分散验证检查点 2：检查过期时间是否与独立副本一致
    const checkpoint2 = verifyCheckpoint("license_expiry_consistency", () => {
      if (_licenseExpiresAt !== null && Math.abs(_licenseExpiresAt - expiresAt) > 1000) {
        reportSecurityViolation("license_expiry_mismatch", {
          snapshot: _licenseExpiresAt,
          current: expiresAt,
        });
        return false;
      }
      return true;
    });

    if (!checkpoint2) {
      return false;
    }

    if (Date.now() > expiresAt) {
      log.warn("License expired at runtime (detected by local expiry check)");
      // 更新全局状态
      globalLicenseState = {
        ...globalLicenseState,
        valid: false,
        error: "授权已过期，请续费后继续使用",
        errorCode: LicenseErrorCode.ERROR_KEY_EXPIRED,
      };
      _licenseValidSnapshot = false;
      return false;
    }
  }

  return true;
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

// 后台 Token 刷新状态
let _backgroundRefreshPending = false;
let _lastBackgroundRefreshAttempt = 0;
let _consecutiveRefreshFailures = 0;
const BACKGROUND_REFRESH_BASE_COOLDOWN_MS = 30 * 1000; // 30 秒基础冷却
const BACKGROUND_REFRESH_MAX_COOLDOWN_MS = 10 * 60 * 1000; // 最大 10 分钟冷却

/**
 * 触发后台 Token 刷新
 * 用于在宽限期内或宽限期过期时尝试恢复 token
 * 使用指数退避策略：连续失败时逐步增大冷却间隔
 */
function triggerBackgroundTokenRefresh(): void {
  // 防止频繁刷新
  if (_backgroundRefreshPending) {
    return;
  }

  const now = Date.now();
  // Exponential backoff: 30s, 60s, 120s, ... up to 10min max
  // Clamp exponent to avoid Infinity from Math.pow on very large failure counts
  const cooldownMs = Math.min(
    BACKGROUND_REFRESH_BASE_COOLDOWN_MS * Math.pow(2, Math.min(_consecutiveRefreshFailures, 20)),
    BACKGROUND_REFRESH_MAX_COOLDOWN_MS,
  );
  if (now - _lastBackgroundRefreshAttempt < cooldownMs) {
    return;
  }

  let cfg: ReturnType<typeof loadConfig>;
  try {
    cfg = loadConfig();
  } catch (cfgErr) {
    log.debug(`Background refresh: config load failed: ${cfgErr}`);
    return;
  }
  const licenseKey = cfg.license?.key;
  if (!licenseKey) {
    return;
  }

  _backgroundRefreshPending = true;
  _lastBackgroundRefreshAttempt = now;

  log.debug(
    `Triggering background token refresh (attempt after ${_consecutiveRefreshFailures} failures, cooldown ${Math.round(cooldownMs / 1000)}s)...`,
  );

  refreshToken(licenseKey)
    .then((success) => {
      if (success) {
        log.info("Background token refresh succeeded");
        _consecutiveRefreshFailures = 0; // Reset backoff on success
        // 更新 lastVerifiedAt 以重置宽限期计时
        if (globalLicenseState) {
          globalLicenseState = {
            ...globalLicenseState,
            lastVerifiedAt: Date.now(),
          };
        }
      } else {
        _consecutiveRefreshFailures++;
        log.debug(
          `Background token refresh failed (consecutive: ${_consecutiveRefreshFailures}), will retry later`,
        );
      }
    })
    .catch((err) => {
      _consecutiveRefreshFailures++;
      log.debug(
        `Background token refresh error (consecutive: ${_consecutiveRefreshFailures}): ${err}`,
      );
    })
    .finally(() => {
      _backgroundRefreshPending = false;
    });
}
