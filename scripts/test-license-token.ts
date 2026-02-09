/**
 * 联调脚本：测试 /token 接口
 *
 * 用法：
 *   node --import tsx scripts/test-license-token.ts
 *   CLAWDBOT_LICENSE_KEY=your-key node --import tsx scripts/test-license-token.ts
 *
 * 会从环境变量 CLAWDBOT_LICENSE_KEY 或配置文件读取授权码，请求生产环境 /token。
 *
 * 注意：避免使用 `npx tsx` 运行此脚本，在 Windows 上可能导致双重执行。
 */

import { createHmac, createVerify, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// 防止重复执行的标志
const EXECUTION_FLAG = "__LICENSE_TOKEN_TEST_EXECUTED__";
if ((globalThis as Record<string, unknown>)[EXECUTION_FLAG]) {
  // 已经执行过，跳过
  process.exit(0);
}
(globalThis as Record<string, unknown>)[EXECUTION_FLAG] = true;

// ============================================================================
// 配置
// ============================================================================

const API_BASE_URL = "https://www.obplugins.cn/api/api/v1/license";

// 服务端 RSA 公钥（用于验证令牌签名）
const SERVER_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAkDtHShdtjfCopovpCcIR
hiyFHopWsclr+7JQ+c4Iz2NIdWrCoAkSUTSp24fJXmVQh27m8Eq9JvGX/wMpQ8H6
++IpO06BXCyk1gYqf8Qqa6CdGMQ0aygCq6aTebQQqDBGICH7u985fkdTRDz62xyG
UbYKIJPZkRycZCGZ5pMvwhxKcSZ6ifpGuBhAlxLqHpax9sUgstWWBOMWEr7SpbL0
BE081ASxkXuQSSGDQFQzUZ98ZoVoYOmneIjU/6JHOAhLDA1R9qEy7KKpb3FV0DQm
PWgG9tgLZk1M7yp3xitO98ZrMtWLmNNPUtQvfM1vlvRI7It0BoGVnPq5P+9dvzmS
nQIDAQAB
-----END PUBLIC KEY-----`;

// ============================================================================
// 工具函数
// ============================================================================

function getDeviceId(): string {
  // 尝试多个可能的存储路径
  const possiblePaths = [
    join(homedir(), ".clawdbot", ".device_id"),  // 项目标准路径
    join(homedir(), ".clawdbot", "device-id"),   // 兼容旧路径
  ];
  
  for (const deviceIdPath of possiblePaths) {
    if (existsSync(deviceIdPath)) {
      const id = readFileSync(deviceIdPath, "utf-8").trim();
      if (id && id.length >= 16) {
        return id;
      }
    }
  }
  
  // 如果没有，生成一个临时的（注意：这不会被绑定）
  console.warn("⚠️  未找到设备 ID 文件，使用临时 ID（需先运行 clawdbot 初始化）");
  return randomBytes(16).toString("hex");
}

function generateNonce(): string {
  return randomBytes(16).toString("hex");
}

function generateSign(licenseKey: string, deviceId: string, timestamp: number, nonce: string, hmacKey: string): string {
  const signContent = `${licenseKey}|${deviceId}|${timestamp}|${nonce}`;
  return createHmac("sha256", hmacKey).update(signContent).digest("hex");
}

function verifyTokenSignature(token: {
  tokenId: string;
  licenseKey: string;
  deviceId: string;
  issuedAt: number;
  expiresAt: number;
  allowedFeatures: string[];
  signature: string;
}): boolean {
  try {
    const signContent = [
      token.tokenId,
      token.licenseKey,
      token.deviceId,
      token.issuedAt.toString(),
      token.expiresAt.toString(),
      token.allowedFeatures.join(","),
    ].join("|");

    const verifier = createVerify("RSA-SHA256");
    verifier.update(signContent);
    verifier.end();

    return verifier.verify(SERVER_PUBLIC_KEY, token.signature, "base64");
  } catch {
    return false;
  }
}

function loadLicenseKeyFromConfig(): string {
  try {
    const configPath = join(homedir(), ".clawdbot", "config.json");
    if (existsSync(configPath)) {
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      return config?.license?.key || "";
    }
  } catch {
    // ignore
  }
  return "";
}

// ============================================================================
// 主函数
// ============================================================================

// 退出码（延迟退出，避免 libuv 断言失败）
let exitCode = 0;

async function main(): Promise<void> {
  const licenseKey = process.env.CLAWDBOT_LICENSE_KEY || loadLicenseKeyFromConfig();

  if (!licenseKey || licenseKey.length < 5) {
    console.error("请设置授权码：");
    console.error("  方式1: CLAWDBOT_LICENSE_KEY=your-key node --import tsx scripts/test-license-token.ts");
    console.error("  方式2: 在 ~/.clawdbot/config.json 中设置 license.key");
    exitCode = 1;
    return;
  }

  const deviceId = getDeviceId();
  const timestamp = Date.now();
  const nonce = generateNonce();
  const sign = generateSign(licenseKey, deviceId, timestamp, nonce, licenseKey);

  console.log("联调 /token 接口");
  console.log("  授权码:", licenseKey.substring(0, 8) + "***");
  console.log("  设备ID:", deviceId);
  console.log("  地址:", `${API_BASE_URL}/token`);
  console.log("");

  try {
    const response = await fetch(`${API_BASE_URL}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey, deviceId, timestamp, nonce, sign }),
    });

    if (!response.ok) {
      console.log(`❌ HTTP 错误: ${response.status} ${response.statusText}`);
      const text = await response.text().catch(() => "");
      if (text) console.log("  响应:", text.substring(0, 200));
      exitCode = 1;
      return;
    }

    const rawData = await response.json();
    
    // 服务端返回格式: { code, message, data: TokenResponse }
    const data = rawData?.data || rawData;

    if (data.success && data.token) {
      const token = data.token;
      const sigOk = verifyTokenSignature(token);
      const expiresInMin = Math.round((token.expiresAt - Date.now()) / 60000);

      console.log("✅ 获取令牌成功");
      console.log("  tokenId:", token.tokenId);
      console.log("  issuedAt:", new Date(token.issuedAt).toISOString());
      console.log("  expiresAt:", new Date(token.expiresAt).toISOString());
      console.log("  剩余有效:", expiresInMin, "分钟");
      console.log("  签名验证:", sigOk ? "✅ 通过" : "❌ 失败");
      console.log("  allowedFeatures:", token.allowedFeatures?.join(", ") || "*");
    } else {
      console.log("❌ 获取令牌失败");
      console.log("  errorCode:", data.errorCode);
      console.log("  errorMessage:", data.errorMessage);
      exitCode = 1;
    }
  } catch (err) {
    console.error("❌ 请求异常:", err instanceof Error ? err.message : String(err));
    exitCode = 1;
  }
}

// 执行主函数，使用延迟退出避免 libuv 断言失败
main()
  .catch((err) => {
    console.error("❌ 未捕获异常:", err);
    exitCode = 1;
  })
  .finally(() => {
    // 使用 setImmediate 延迟退出，让 Node.js 有机会清理异步资源
    // 这可以避免 Windows 上的 UV_HANDLE_CLOSING 断言失败
    setImmediate(() => {
      process.exitCode = exitCode;
    });
  });
