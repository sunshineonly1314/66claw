#!/usr/bin/env node
/**
 * 独立许可证激活脚本
 *
 * 用法：
 *   node activate-license.cjs            （自动从本地配置读取授权码）
 *   node activate-license.cjs <授权码>    （手动指定授权码）
 *
 * 功能：
 *   1. 调用服务端 /verify 接口验证授权码
 *   2. 验证 RSA 签名（确保服务端响应未被篡改）
 *   3. 写入配置文件，完成激活
 *
 * 适用场景：
 *   - 用户无法通过 UI 界面激活时的临时方案
 *   - 服务端刚部署 RSA 签名后，用户需要重新激活
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// ============================================================================
// 配置
// ============================================================================

const API_BASE_URL = "https://www.obplugins.cn/api/api/v1/license";

const RSA_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuB00UMEJdP/XxmCJDGC5
x7DsZEJpWG2Gx+p8RmkMsoPh/eiWcwkSrO62Ijg3jrOO5i8UnZGzM1jzDEBdB8Gs
g0ADa9LkRHdNTSYpxE2hCyvvSMLfYX4i1yp0ucFO0PTmECMXSTg0/pxTPpI1GwGK
6rqH/3HjytryUlfAI4eRMmn1c2zQimXi49CgXzTMDOY8oTTaqeD7XQtAVCklO1pg
j0FDTjxSFGC9xnXU5ooW9IQXjyW3jZZLbxbgd8elGJD1EUYrHFa1xYF8r5yUr7GA
moWQ5xD2iEun3ykFZZ1pYso9ybBpPXXp8mIxD5+/JGaYirHpH/7JjKs5aTOCDaOZ
AQIDAQAB
-----END PUBLIC KEY-----`;

// ============================================================================
// 设备信息
// ============================================================================

function getDeviceId() {
  // 先从本地存储读取
  const stateDir = resolveStateDir();
  const deviceIdPath = path.join(stateDir, ".device_id");
  try {
    const id = fs.readFileSync(deviceIdPath, "utf8").trim();
    if (id) return id;
  } catch {}

  // 生成一个随机的
  const id = crypto.randomUUID().replace(/-/g, "");
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(deviceIdPath, id, "utf8");
  } catch {}
  return id;
}

function getDeviceName() {
  return os.hostname();
}

function getOsInfo() {
  return `${os.platform()} ${os.release()} ${os.arch()}`;
}

function resolveStateDir() {
  const home = os.homedir();
  const candidates = [
    path.join(home, ".openclawcn"),
    path.join(home, ".clawdbotcn"),
    path.join(home, ".clawdbot"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return path.join(home, ".openclawcn");
}

function resolveConfigPath() {
  const stateDir = resolveStateDir();
  const candidates = [
    path.join(stateDir, "openclawcn.json"),
    path.join(stateDir, "clawdbot.json"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return path.join(stateDir, "openclawcn.json");
}

// ============================================================================
// RSA 签名验证
// ============================================================================

function normalizeExpiresAt(expiresAt) {
  if (!expiresAt) return "";
  if (expiresAt.endsWith("Z")) return expiresAt;
  return `${expiresAt}Z`;
}

function verifyRsaSignature(signContent, signature) {
  try {
    const verify = crypto.createVerify("SHA256");
    verify.update(signContent, "utf8");
    return verify.verify(RSA_PUBLIC_KEY, signature, "base64");
  } catch (e) {
    console.error("RSA 验证异常:", e.message);
    return false;
  }
}

function verifyLicenseResponseSignature(valid, tier, expiresAt, serverTime, signature) {
  // 验证 serverTime 偏差
  const drift = Math.abs(Date.now() - serverTime);
  if (drift > 5 * 60 * 1000) {
    return { valid: false, error: `服务器时间偏差过大: ${drift}ms` };
  }

  // 构建签名内容：valid|tier|expiresAt|serverTime
  const signContent = `${valid}|${tier ?? ""}|${normalizeExpiresAt(expiresAt)}|${serverTime}`;
  console.log(`  签名内容: ${signContent}`);

  const isValid = verifyRsaSignature(signContent, signature);
  if (!isValid) {
    return { valid: false, error: "RSA 签名验证失败" };
  }
  return { valid: true };
}

// ============================================================================
// 主流程
// ============================================================================

async function activate(licenseKey) {
  console.log("=== OpenClawCN 许可证激活 ===\n");

  const deviceId = getDeviceId();
  const deviceName = getDeviceName();
  const osInfo = getOsInfo();

  console.log(`设备ID: ${deviceId}`);
  console.log(`设备名: ${deviceName}`);
  console.log(`系统: ${osInfo}\n`);

  // 1. 调用 /verify 接口
  console.log(">>> 正在连接服务端...");
  const requestBody = {
    key: licenseKey,
    deviceId,
    deviceName,
    appVersion: "1.0.0",
    osInfo,
    deviceFingerprint: deviceId,
    shownNotificationIds: [],
  };

  let response;
  try {
    const res = await fetch(`${API_BASE_URL}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    response = await res.json();
  } catch (e) {
    console.error(`\n连接失败: ${e.message}`);
    process.exit(1);
  }

  if (response.code !== 200) {
    console.error(`\n服务端返回错误: code=${response.code}, msg=${response.msg}`);
    process.exit(1);
  }

  const data = response.data;
  if (!data || typeof data.valid !== "boolean") {
    console.error("\n服务端返回了无效的响应数据");
    process.exit(1);
  }

  console.log(`  valid: ${data.valid}`);
  console.log(`  tier: ${data.license?.tier ?? "N/A"}`);
  console.log(`  expiresAt: ${data.license?.expiresAt ?? "N/A"}`);
  console.log(`  signature: ${data.signature ? "有" : "无"}`);

  if (!data.valid) {
    console.error(`\n授权码验证失败: ${data.errorMessage ?? "未知错误"} (errorCode: ${data.errorCode})`);
    process.exit(1);
  }

  // 2. RSA 签名验证
  console.log("\n>>> 验证 RSA 签名...");
  if (!data.signature) {
    console.error("  服务端响应缺少签名，无法验证！");
    process.exit(1);
  }

  const verifyResult = verifyLicenseResponseSignature(
    data.valid,
    data.license?.tier ?? null,
    data.license?.expiresAt ?? null,
    data.serverTime,
    data.signature,
  );

  if (!verifyResult.valid) {
    console.error(`  RSA 签名验证失败: ${verifyResult.error}`);
    process.exit(1);
  }

  console.log("  RSA 签名验证通过!\n");

  // 3. 写入配置文件
  console.log(">>> 写入配置...");
  const configPath = resolveConfigPath();
  let config = {};
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    config = JSON.parse(raw);
  } catch {}

  config.license = {
    ...(config.license || {}),
    key: licenseKey,
    status: data.license?.tier ?? "basic",
    expiresAt: data.license?.expiresAt ?? undefined,
    validatedAt: new Date().toISOString(),
    tier: data.license?.tier,
    tierName: data.license?.tierName,
    daysRemaining: data.license?.daysRemaining,
    keyType: data.license?.keyType,
    features: data.license?.features,
    deviceId: data.device?.deviceId,
    deviceLimit: data.device?.deviceLimit,
    boundDevices: data.device?.boundDevices,
  };

  const stateDir = path.dirname(configPath);
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
  console.log(`  配置已写入: ${configPath}`);

  console.log("\n=== 激活成功! ===");
  console.log(`  等级: ${data.license?.tier ?? "basic"} (${data.license?.tierName ?? ""})`);
  console.log(`  过期: ${data.license?.expiresAt ?? "永不"}`);
  console.log(`  剩余: ${data.license?.daysRemaining ?? "N/A"} 天`);
  console.log("\n请重启 OpenClawCN 使授权生效。");
}

// ============================================================================
// 从本地配置读取已有的授权码
// ============================================================================

function readExistingKey() {
  const configPath = resolveConfigPath();
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(raw);
    const key = config.license?.key;
    if (key && typeof key === "string" && key.trim().length > 0) {
      return key.trim();
    }
  } catch {}
  return null;
}

// ============================================================================
// 入口
// ============================================================================

let key = process.argv[2];
if (!key) {
  // 没传参数，尝试从本地配置读取
  key = readExistingKey();
  if (key) {
    console.log(`从本地配置读取到授权码: ${key.substring(0, 8)}...`);
  } else {
    console.error("未找到授权码。");
    console.error("用法: node activate-license.cjs <授权码>");
    console.error("  或确保本地已激活过（配置文件中存在授权码）");
    process.exit(1);
  }
}

activate(key).catch((e) => {
  console.error("激活异常:", e);
  process.exit(1);
});
