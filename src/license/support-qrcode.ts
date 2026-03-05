/**
 * Support QR Code Management
 * 技术支持群二维码管理（简化版）
 *
 * 3 张固定本地图片，按用户类型直接返回：
 *   data/qrcodes/zlq.jpg      → Setup 引导页（大模型选择 + 激活码页面）
 *   data/qrcodes/test.jpg     → 测试/试用用户 Chat 页面
 *   data/qrcodes/zhengshi.jpg → 正式用户 Chat 页面
 */

import fs from "node:fs";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";
import { isOverseas } from "../config/edition.js";
import type { SupportQrcodeConfig } from "./types.js";

const QRCODE_DIR = "qrcodes";

const QRCODE_MAP: Record<string, { file: string; groupName: string }> = {
  test: { file: "test.jpg", groupName: "测试体验群" },
  trial: { file: "test.jpg", groupName: "测试体验群" },
  standard: { file: "zhengshi.jpg", groupName: "正式用户群" },
};

const SETUP_QRCODE = { file: "zlq.jpg", groupName: "扫码加群领体验码" };

/** 内存缓存（每个文件只读一次磁盘） */
const base64Cache = new Map<string, string>();

/**
 * 解析二维码目录路径。
 * 优先使用 import.meta.dirname 计算的相对路径（与 setup-page.ts 保持一致），
 * 如果失败则回退到 resolveStateDir()。
 */
function resolveQrcodeDir(): string {
  // 路径 1: 相对于当前文件（编译后 dist/license/support-qrcode.js → ../../data/qrcodes）
  try {
    const dirFromModule = path.resolve(import.meta.dirname, "../../data", QRCODE_DIR);
    if (fs.existsSync(dirFromModule)) return dirFromModule;
  } catch {
    // import.meta.dirname 不可用时 fallback
  }
  // 路径 2: 通过 resolveStateDir()（<appRoot>/data/qrcodes 或 ~/.openclawcn/qrcodes）
  return path.join(resolveStateDir(), QRCODE_DIR);
}

function readQrcodeBase64(filename: string): string | null {
  const cached = base64Cache.get(filename);
  if (cached) return cached;

  const qrDir = resolveQrcodeDir();
  const filePath = path.join(qrDir, filename);
  try {
    const buf = fs.readFileSync(filePath);
    const b64 = `data:image/jpeg;base64,${buf.toString("base64")}`;
    base64Cache.set(filename, b64);
    return b64;
  } catch {
    return null;
  }
}

/**
 * OEM 版：从 dist/control-ui/ 或 ui/public/ 读取 OEM 技术支持二维码
 */
function readOemSupportQrcode(): string | null {
  const filename = "oem-support-qrcode.png";
  const cached = base64Cache.get(filename);
  if (cached) return cached;
  try {
    // 编译后 dist/license/ → ../../dist/control-ui/
    // Tauri 打包后 dist/license/ → ../../resources/dist/control-ui/
    // dev 模式 dist/license/ → ../../ui/public/  (不经过编译，直接src下)
    const candidates = [
      path.resolve(import.meta.dirname, "../../dist/control-ui", filename),
      path.resolve(import.meta.dirname, "../../resources/dist/control-ui", filename),
      path.resolve(import.meta.dirname, "../ui/public", filename),
    ];
    for (const filePath of candidates) {
      if (fs.existsSync(filePath)) {
        const buf = fs.readFileSync(filePath);
        const b64 = `data:image/png;base64,${buf.toString("base64")}`;
        base64Cache.set(filename, b64);
        return b64;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Chat 页面用 —— 按 keyType 返回对应二维码
 *
 * OEM overseas 版：优先使用 oem-support-qrcode.png
 * CN 自用版：test/trial → test.jpg, standard → zhengshi.jpg
 */
export function getSupportQrcode(
  keyType: "test" | "trial" | "standard",
  _deviceId?: string,
): SupportQrcodeConfig | null {
  // OEM 版：优先使用 OEM 技术支持二维码
  if (isOverseas) {
    const oemBase64 = readOemSupportQrcode();
    if (oemBase64) {
      return { base64: oemBase64, groupName: "技术支持" };
    }
    // fallback: OEM 未配置二维码时使用默认图片
  }
  const entry = QRCODE_MAP[keyType] ?? QRCODE_MAP.test;
  const base64 = readQrcodeBase64(entry.file);
  return base64 ? { base64, groupName: entry.groupName } : null;
}

/**
 * Setup 引导页用 —— 返回 zlq.jpg
 *
 * 用于大模型选择页和激活码激活页展示。
 */
export function getSetupQrcode(): SupportQrcodeConfig | null {
  const base64 = readQrcodeBase64(SETUP_QRCODE.file);
  return base64 ? { base64, groupName: SETUP_QRCODE.groupName } : null;
}

/**
 * 注入二维码到 license 对象（保持现有调用方不变）
 */
export function enrichLicenseWithSupport(
  license:
    | { keyType?: string; supportQrcode?: SupportQrcodeConfig; purchaseUrl?: string }
    | null
    | undefined,
  deviceId: string,
): void {
  if (!license || !license.keyType) return;
  const keyType = license.keyType as "test" | "trial" | "standard";
  if (!license.supportQrcode?.base64) {
    const qr = getSupportQrcode(keyType, deviceId);
    if (qr) license.supportQrcode = qr;
  }
  license.purchaseUrl = undefined;
}

/** 清除内存缓存（用于测试） */
export function clearSupportQrcodeCache(): void {
  base64Cache.clear();
}

/** 兼容旧调用（始终返回 null） */
export function getPurchaseUrl(): string | null {
  return null;
}

/** 兼容旧调用（始终返回 null） */
export async function fetchRemotePurchaseUrl(): Promise<string | null> {
  return null;
}
