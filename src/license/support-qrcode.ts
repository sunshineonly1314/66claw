/**
 * Support QR Code Management
 * 技术支持群二维码管理
 *
 * 从本地文件夹读取企微群二维码图片，根据用户类型和设备 ID 稳定分配。
 *
 * 目录结构：
 *   {stateDir}/qrcodes/official/  ← 正式用户群二维码
 *   {stateDir}/qrcodes/test/      ← 试用用户群二维码
 *
 * 分配策略：hash(deviceId) % 图片数量 → 同一用户始终看到同一群码
 * 缓存策略：内存缓存 5 分钟 TTL，避免频繁磁盘 IO
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { resolveStateDir } from "../config/paths.js";
import type { SupportQrcodeConfig } from "./types.js";


const log = createSubsystemLogger("license:support-qrcode");

// ============================================================================
// 配置
// ============================================================================

/** 支持的图片扩展名 */
const SUPPORTED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

/** 缓存 TTL：5 分钟（文件替换后最多 5 分钟生效） */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** 群名映射配置文件名 */
const GROUP_CONFIG_FILENAME = "config.json";

// ============================================================================
// 内存缓存
// ============================================================================

interface CacheEntry {
  /** 图片文件列表（排序后） */
  files: string[];
  /** base64 缓存: 文件名 → data URL */
  base64Map: Map<string, string>;
  /** 群名映射: 文件名 → 显示名 */
  nameMap: Map<string, string>;
  /** 缓存时间 */
  cachedAt: number;
}

/** 按类型的缓存: "official" | "test" */
const cache = new Map<string, CacheEntry>();

// ============================================================================
// 购买链接配置
// ============================================================================

/** 购买配置文件路径: {stateDir}/qrcodes/purchase.json */
interface PurchaseConfig {
  /** 闲鱼购买链接 */
  url: string;
  /** 是否启用 */
  enabled: boolean;
}

let purchaseConfigCache: { config: PurchaseConfig | null; cachedAt: number } | null = null;

// ============================================================================
// 核心逻辑
// ============================================================================

/**
 * 获取二维码目录路径
 */
function getQrcodeDir(type: "official" | "test"): string {
  const stateDir = resolveStateDir();
  return path.join(stateDir, "qrcodes", type);
}

/**
 * 获取购买配置文件路径
 */
function getPurchaseConfigPath(): string {
  const stateDir = resolveStateDir();
  return path.join(stateDir, "qrcodes", "purchase.json");
}

/**
 * 稳定 hash：同一 deviceId 始终返回相同索引
 *
 * 【B Review】使用 SHA256 而不是简单的字符串 hash：
 *   - SHA256 分布均匀，避免 hot spot
 *   - 确定性：跨平台、跨运行结果一致
 *   - 不可逆：不会泄露 deviceId 信息
 */
function stableHash(deviceId: string, modulus: number): number {
  if (modulus <= 0) return 0;
  const hash = crypto.createHash("sha256").update(deviceId).digest();
  // 取前 4 字节作为 uint32，再取模
  const uint32 = hash.readUInt32BE(0);
  return uint32 % modulus;
}

/**
 * 扫描目录，获取排序后的图片文件列表
 *
 * 【B Review】边界处理：
 *   - 目录不存在 → 返回空数组（不报错，优雅降级）
 *   - 空目录 → 返回空数组
 *   - 非图片文件 → 过滤掉
 *   - 文件名排序 → 保证顺序稳定（否则 hash 分配会变）
 */
function scanImageFiles(dir: string): string[] {
  try {
    if (!fs.existsSync(dir)) {
      return [];
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const imageFiles = entries
      .filter((entry) => {
        if (!entry.isFile()) return false;
        const ext = path.extname(entry.name).toLowerCase();
        return SUPPORTED_EXTENSIONS.has(ext);
      })
      .map((entry) => entry.name)
      .sort(); // 排序保证稳定性

    return imageFiles;
  } catch (error) {
    log.warn(`Failed to scan QR code directory: ${dir}`, { error });
    return [];
  }
}

/**
 * 读取群名映射配置
 *
 * 格式：{ "group-1.png": "高级技术群 1", ... }
 * 如果不存在或解析失败，返回空 Map
 */
function loadGroupNameMap(dir: string): Map<string, string> {
  const configPath = path.join(dir, GROUP_CONFIG_FILENAME);
  try {
    if (!fs.existsSync(configPath)) {
      return new Map();
    }
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, string>;

    const map = new Map<string, string>();
    for (const [filename, displayName] of Object.entries(parsed)) {
      if (typeof displayName === "string" && displayName.trim()) {
        map.set(filename, displayName.trim());
      }
    }
    return map;
  } catch (error) {
    log.debug(`Failed to load group name config: ${configPath}`, { error });
    return new Map();
  }
}

/**
 * 读取单个图片文件并转为 base64 data URL
 *
 * 【B Review】安全边界：
 *   - 文件不存在 → 返回 null
 *   - 文件过大（>2MB）→ 跳过，避免内存爆炸
 *   - MIME 类型根据扩展名推断
 */
function readImageAsBase64(filePath: string): string | null {
  try {
    const stat = fs.statSync(filePath);

    // 安全限制：单个二维码图片不应超过 2MB
    if (stat.size > 2 * 1024 * 1024) {
      log.warn(`QR code image too large (${stat.size} bytes), skipping: ${filePath}`);
      return null;
    }

    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
    };
    const mime = mimeMap[ext] ?? "image/png";

    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch (error) {
    log.warn(`Failed to read QR code image: ${filePath}`, { error });
    return null;
  }
}

/**
 * 获取或刷新缓存
 *
 * 【B Review】缓存策略：
 *   - TTL 到期后重新扫描目录（支持运维热替换图片）
 *   - 懒加载 base64：首次分配到该图片时才读文件
 *   - 如果图片文件数量变化，hash 分配会自动调整
 */
function getOrRefreshCache(type: "official" | "test"): CacheEntry | null {
  const now = Date.now();
  const existing = cache.get(type);

  if (existing && now - existing.cachedAt < CACHE_TTL_MS) {
    return existing;
  }

  const dir = getQrcodeDir(type);
  const files = scanImageFiles(dir);

  if (files.length === 0) {
    // 目录为空或不存在，清除缓存
    cache.delete(type);
    return null;
  }

  const nameMap = loadGroupNameMap(dir);

  const entry: CacheEntry = {
    files,
    base64Map: existing?.base64Map ?? new Map(), // 复用已缓存的 base64
    nameMap,
    cachedAt: now,
  };

  // 清除不再存在的文件的 base64 缓存
  const fileSet = new Set(files);
  for (const key of entry.base64Map.keys()) {
    if (!fileSet.has(key)) {
      entry.base64Map.delete(key);
    }
  }

  cache.set(type, entry);
  return entry;
}

// ============================================================================
// 公共 API
// ============================================================================

/**
 * 获取技术支持群二维码
 *
 * @param keyType - 用户 key 类型（test/trial → test 文件夹，standard → official 文件夹）
 * @param deviceId - 设备 ID（用于稳定分配）
 * @returns 二维码配置，如果没有可用图片则返回 null
 *
 * 【B Review】整体边界覆盖：
 *   ✅ 目录不存在 → null
 *   ✅ 目录为空 → null
 *   ✅ 图片读取失败 → null
 *   ✅ 图片过大 → 跳过
 *   ✅ deviceId 为空 → 默认 index 0
 *   ✅ 文件删除/替换 → 缓存 TTL 后自动刷新
 *   ✅ 配置文件缺失 → 用文件名作群名（优雅降级）
 */
export function getSupportQrcode(
  keyType: "test" | "trial" | "standard",
  deviceId: string,
): SupportQrcodeConfig | null {
  const type = keyType === "standard" ? "official" : "test";

  const cacheEntry = getOrRefreshCache(type);
  if (!cacheEntry || cacheEntry.files.length === 0) {
    return null;
  }

  // 稳定分配
  const index = stableHash(deviceId || "default", cacheEntry.files.length);
  const selectedFile = cacheEntry.files[index];

  if (!selectedFile) {
    return null;
  }

  // 懒加载 base64
  let base64 = cacheEntry.base64Map.get(selectedFile);
  if (!base64) {
    const dir = getQrcodeDir(type);
    const filePath = path.join(dir, selectedFile);
    base64 = readImageAsBase64(filePath) ?? undefined;

    if (!base64) {
      log.warn(`Failed to load QR code for device ${deviceId.substring(0, 8)}...: ${selectedFile}`);
      return null;
    }

    cacheEntry.base64Map.set(selectedFile, base64);
  }

  // 群名：优先配置文件映射，fallback 到文件名（去扩展名）
  const groupName =
    cacheEntry.nameMap.get(selectedFile) ??
    path.basename(selectedFile, path.extname(selectedFile));

  return { base64, groupName };
}

/**
 * 获取购买链接
 *
 * 从 {stateDir}/qrcodes/purchase.json 读取配置
 *
 * @returns 购买链接，如果未配置或已禁用则返回 null
 *
 * 【B Review】边界：
 *   ✅ 文件不存在 → null
 *   ✅ JSON 格式错误 → null（不崩溃）
 *   ✅ enabled=false → null
 *   ✅ url 为空 → null
 *   ✅ 缓存 5 分钟，支持运维热更新
 */
export function getPurchaseUrl(): string | null {
  const now = Date.now();

  if (purchaseConfigCache && now - purchaseConfigCache.cachedAt < CACHE_TTL_MS) {
    const cfg = purchaseConfigCache.config;
    return cfg?.enabled && cfg.url ? cfg.url : null;
  }

  const configPath = getPurchaseConfigPath();

  try {
    if (!fs.existsSync(configPath)) {
      purchaseConfigCache = { config: null, cachedAt: now };
      return null;
    }

    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw) as PurchaseConfig;

    if (!parsed || typeof parsed.url !== "string") {
      purchaseConfigCache = { config: null, cachedAt: now };
      return null;
    }

    purchaseConfigCache = {
      config: {
        url: parsed.url.trim(),
        enabled: parsed.enabled !== false, // 默认启用
      },
      cachedAt: now,
    };

    return purchaseConfigCache.config!.enabled && purchaseConfigCache.config!.url
      ? purchaseConfigCache.config!.url
      : null;
  } catch (error) {
    log.debug(`Failed to load purchase config: ${configPath}`, { error });
    purchaseConfigCache = { config: null, cachedAt: now };
    return null;
  }
}

/**
 * 为 license 信息注入技术支持二维码和购买链接
 *
 * 在 verify 响应返回后调用，直接修改 license 对象。
 * 这是一个"装饰器"模式：远程服务器不需要改动，本地网关负责注入。
 *
 * @param license - license 信息对象（会被直接修改）
 * @param deviceId - 设备 ID
 *
 * 【B Review】
 *   ✅ license 为 null → 不处理
 *   ✅ keyType 未定义 → 不处理
 *   ✅ 本地二维码始终注入（支持运维热更新图片后即时生效）
 *   ✅ 购买链接也始终从配置读取（支持热更新链接）
 */
export function enrichLicenseWithSupport(
  license: { keyType?: string; supportQrcode?: SupportQrcodeConfig; purchaseUrl?: string } | null | undefined,
  deviceId: string,
): void {
  if (!license || !license.keyType) return;

  const keyType = license.keyType as "test" | "trial" | "standard";

  // 服务端返回的二维码优先（远程 preload 拉取的）
  // 仅在服务端未提供时，才回退到本地文件夹（运维热替换场景）
  if (!license.supportQrcode?.base64) {
    const qrcode = getSupportQrcode(keyType, deviceId);
    if (qrcode) {
      license.supportQrcode = qrcode;
    }
  }

  // 购买链接（仅试用用户）
  // 优先保留服务端返回的 purchaseUrl，仅在服务端未提供时回退到本地配置
  if (keyType === "test" || keyType === "trial") {
    if (!license.purchaseUrl) {
      const url = getPurchaseUrl();
      if (url) {
        license.purchaseUrl = url;
      }
    }
  } else {
    // 正式用户不返回购买链接
    license.purchaseUrl = undefined;
  }
}

/**
 * 从远程 API 获取购买链接（作为本地配置的备选方案）
 *
 * API: GET https://www.obplugins.cn/api/config/purchase-url
 * 响应: { code: 200, data: { xianyu: "..." } }
 *
 * 服务端调用，不受 CORS 限制。
 * 结果缓存 10 分钟，避免频繁请求。
 */
let remotePurchaseUrlCache: { url: string | null; cachedAt: number } | null = null;
const REMOTE_PURCHASE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 分钟

export async function fetchRemotePurchaseUrl(): Promise<string | null> {
  const now = Date.now();

  if (remotePurchaseUrlCache && now - remotePurchaseUrlCache.cachedAt < REMOTE_PURCHASE_CACHE_TTL_MS) {
    return remotePurchaseUrlCache.url;
  }

  const urls = ["https://www.obplugins.cn/api/config/purchase-url"];

  for (const apiUrl of urls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const resp = await fetch(apiUrl, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!resp.ok) continue;

      const data = (await resp.json()) as { code?: number; data?: { xianyu?: string } };
      const url = data?.code === 200 && data?.data?.xianyu ? data.data.xianyu : null;

      remotePurchaseUrlCache = { url, cachedAt: now };
      return url;
    } catch (error) {
      log.debug(`Failed to fetch remote purchase URL from ${apiUrl}`, { error });
      continue;
    }
  }

  remotePurchaseUrlCache = { url: null, cachedAt: now };
  return null;
}

/**
 * 清除所有缓存（用于测试）
 */
export function clearSupportQrcodeCache(): void {
  cache.clear();
  purchaseConfigCache = null;
  remotePurchaseUrlCache = null;
}
