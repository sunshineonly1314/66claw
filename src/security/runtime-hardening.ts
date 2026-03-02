/**
 * OpenClawCN Security Module - Runtime Hardening
 * 运行时加固
 *
 * PC 端客户端运行时保护，启动后立即执行：
 *
 * 1. 环境变量锁定 — 删除可被注入的危险环境变量
 * 2. 全局对象冻结 — 防止 monkey-patch require / Module._load
 * 3. 原型链保护 — 防止通过原型污染绕过安全检查
 *
 * 本模块应在所有安全模块之前、尽早调用。
 * 仅在生产构建中启用。
 */

import { createRequire } from "node:module";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { recordViolation } from "./delayed-enforcement.js";

const log = createSubsystemLogger("security:runtime-hardening");

// ============================================================================
// 1. 环境变量锁定
// ============================================================================

/**
 * 启动后锁定的危险环境变量列表。
 *
 * 这些变量如果在运行时被注入，可能绕过 License、调试检测等。
 * 在启动初始化完成后立即删除。
 */
const DANGEROUS_ENV_VARS = [
  "OPENCLAWCN_DEV",
  "OPENCLAWCN_LICENSE_DEV",
  // [HIGH FIX] Additional dangerous env vars discovered in security audit:
  "OPENCLAWCN_LICENSE_API_URL", // 可重定向授权验证到伪造服务器
  "OPENCLAWCN_EXTENSION_SIGNING_PUBLIC_KEY", // 可替换扩展签名公钥
  "OPENCLAWCN_PROFILE", // 可启用 dev 配置覆盖和 devMode
  "NODE_OPTIONS", // 可注入 --inspect
  "NODE_INSPECT", // 可开启 inspector
  "ELECTRON_RUN_AS_NODE", // Electron 调试后门
  "LD_PRELOAD", // Linux 注入
  "DYLD_INSERT_LIBRARIES", // macOS 注入
  "DYLD_FORCE_FLAT_NAMESPACE",
];

/**
 * 删除危险环境变量并使其不可重新设置。
 *
 * 注意：process.env 在 Node.js 中是 getter/setter 代理，
 * 无法用 Object.freeze 冻结。我们通过 delete + 定期巡检实现。
 */
export function lockdownEnvVars(): void {
  for (const key of DANGEROUS_ENV_VARS) {
    if (process.env[key] !== undefined) {
      log.debug(`Removing dangerous env var: ${key}`);
      delete process.env[key];
    }
  }
}

// ============================================================================
// 2. 全局对象冻结 — 防止 monkey-patch
// ============================================================================

/**
 * 冻结 require 链核心函数。
 *
 * 攻击者常用方式：
 *   Module._load = function(...) { /* 拦截 bytenode 加载 *\/ }
 *   require = function(...) { /* 替换 require *\/ }
 *
 * 冻结后这些赋值会静默失败（strict mode 下抛 TypeError）。
 */
export function freezeRequireChain(): void {
  try {
    const esmRequire = createRequire(import.meta.url);
    const Module = esmRequire("node:module");

    // 保存原始引用
    const originalLoad = Module._load;
    const originalResolve = Module._resolveFilename;

    // 使 _load 不可写、不可配置
    Object.defineProperty(Module, "_load", {
      value: originalLoad,
      writable: false,
      configurable: false,
    });

    // 使 _resolveFilename 不可写、不可配置
    Object.defineProperty(Module, "_resolveFilename", {
      value: originalResolve,
      writable: false,
      configurable: false,
    });

    log.debug("Module._load and _resolveFilename frozen");
  } catch (err) {
    log.warn(`Failed to freeze require chain: ${err}`);
  }
}

// ============================================================================
// 3. 原型链保护
// ============================================================================

/**
 * 锁定 Object.prototype 上的安全关键属性，防止原型污染攻击。
 *
 * 攻击路径：Object.prototype.valid = true 可以让所有 obj.valid 返回 true。
 *
 * 注意：不使用 Object.freeze(Object.prototype)，因为它会阻止所有对象
 * 添加新属性（strict mode 下抛 TypeError），导致大量第三方库崩溃
 * （Express、ws、ORM 等依赖对象属性赋值）。
 *
 * 改为只将攻击者可能利用的安全关键属性设为不可写、不可配置：
 * - valid / isValid — License 校验结果字段
 * - admin / isAdmin — 权限提升
 * - __proto__ — 原型链劫持
 * - constructor — 构造函数替换
 */
export function freezePrototypes(): void {
  // 安全关键属性列表：这些属性如果被注入到 Object.prototype，
  // 会影响 License 校验（obj.valid）、权限检查（obj.admin）等。
  const POISONED_KEYS = [
    "valid",
    "isValid",
    "admin",
    "isAdmin",
    "authorized",
    "licensed",
    "isPaid",
  ];

  let frozenCount = 0;
  for (const key of POISONED_KEYS) {
    try {
      // 只有属性尚未存在时才需要定义（已有值的说明代码正常使用）
      if (!(key in Object.prototype)) {
        Object.defineProperty(Object.prototype, key, {
          set(this: unknown, value: unknown) {
            // 只拦截直接对 Object.prototype 的污染赋值。
            // 正常对象实例（如 { valid: true } 后续赋值）中 this !== Object.prototype，
            // 需要将值写入实例自有属性，否则赋值会被静默吞掉。
            if (this === Object.prototype) {
              recordViolation(`prototype_pollution:${key}`);
              return;
            }
            // 非原型污染：将值正常写入实例的自有属性
            Object.defineProperty(this as object, key, {
              value,
              writable: true,
              enumerable: true,
              configurable: true,
            });
          },
          get() {
            return undefined;
          },
          configurable: false,
        });
        frozenCount++;
      }
    } catch {
      // 某些属性可能已被冻结或不允许修改
    }
  }

  // __proto__ 和 constructor 已存在于 Object.prototype，将其设为不可配置
  for (const key of ["__proto__", "constructor"] as const) {
    try {
      const desc = Object.getOwnPropertyDescriptor(Object.prototype, key);
      if (desc && desc.configurable) {
        Object.defineProperty(Object.prototype, key, {
          ...desc,
          configurable: false,
        });
        frozenCount++;
      }
    } catch {
      // 某些属性可能已被冻结或不允许修改
    }
  }

  log.debug(`Prototype pollution guard: ${frozenCount} properties locked`);
}

// ============================================================================
// 4. 环境变量巡检
// ============================================================================

let envPatrolInterval: ReturnType<typeof setInterval> | null = null;

/**
 * 启动环境变量巡检。
 *
 * 定期检查是否有危险环境变量被重新注入。
 * 如果发现，删除它并记录安全违规。
 */
export function startEnvPatrol(intervalMs = 30_000): void {
  if (envPatrolInterval) return;

  envPatrolInterval = setInterval(() => {
    for (const key of DANGEROUS_ENV_VARS) {
      if (process.env[key] !== undefined) {
        log.warn(`Dangerous env var re-injected: ${key} — removing`);
        delete process.env[key];
        recordViolation(`env_reinjected:${key}`);
      }
    }
  }, intervalMs);

  envPatrolInterval.unref();
}

/**
 * 停止环境变量巡检
 */
export function stopEnvPatrol(): void {
  if (envPatrolInterval) {
    clearInterval(envPatrolInterval);
    envPatrolInterval = null;
  }
}

// ============================================================================
// 5. 统一初始化入口
// ============================================================================

/**
 * 判断是否为生产环境（与 anti-debug.ts 保持一致）
 */
function isProduction(): boolean {
  const isDevBuild = typeof __DEV_BUILD__ !== "undefined" && __DEV_BUILD__;
  return !isDevBuild;
}

/**
 * 初始化运行时加固。
 *
 * 应在应用启动时尽早调用，在 License 校验之前。
 * 仅在生产构建中启用。
 */
export function initRuntimeHardening(): void {
  if (!isProduction()) {
    log.debug("Runtime hardening disabled in dev build");
    return;
  }

  log.info("Initializing runtime hardening");

  // Step 1: 锁定环境变量（最优先 — 防止 DEV 绕过）
  lockdownEnvVars();

  // Step 2: 冻结 require 链（防止 hook bytenode/模块加载）
  freezeRequireChain();

  // Step 3: [MED-04 FIX] 冻结关键原型链（防止原型污染攻击）
  // 攻击路径: Object.prototype.valid = true 让所有 obj.valid 返回 true
  freezePrototypes();

  // Step 4: 启动环境变量巡检（每 30 秒）
  startEnvPatrol();

  log.info("Runtime hardening initialized");
}
