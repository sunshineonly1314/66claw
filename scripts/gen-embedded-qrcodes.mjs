/**
 * Generate embedded-qrcodes.ts from data/qrcodes/*.jpg
 * Usage: node scripts/gen-embedded-qrcodes.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const qrDir = path.join(root, "data", "qrcodes");

const testBuf = fs.readFileSync(path.join(qrDir, "test.jpg"));
const zhengshiBuf = fs.readFileSync(path.join(qrDir, "zhengshi.jpg"));

const testB64 = "data:image/jpeg;base64," + testBuf.toString("base64");
const zhengshiB64 = "data:image/jpeg;base64," + zhengshiBuf.toString("base64");

const output = `/**
 * Embedded QR code images (base64)
 * Auto-generated from data/qrcodes/*.jpg — do not edit manually.
 * 本地打包的二维码图片，不依赖远程接口
 */

/** 测试体验群二维码 */
export const TEST_QRCODE = {
  base64: "${testB64}",
  groupName: "测试体验群",
} as const;

/** 正式用户群二维码 */
export const ZHENGSHI_QRCODE = {
  base64: "${zhengshiB64}",
  groupName: "正式用户群",
} as const;

/**
 * 根据 keyType 获取对应二维码（纯本地，无远程调用）
 */
export function getEmbeddedQrcode(keyType: string): { base64: string; groupName: string } {
  if (keyType === "standard") return ZHENGSHI_QRCODE;
  return TEST_QRCODE; // test / trial 都用 test 二维码
}
`;

const outPath = path.join(root, "ui", "src", "ui", "embedded-qrcodes.ts");
fs.writeFileSync(outPath, output, "utf8");
console.log("Written:", outPath);
console.log("  test.jpg base64 length:", testB64.length);
console.log("  zhengshi.jpg base64 length:", zhengshiB64.length);
