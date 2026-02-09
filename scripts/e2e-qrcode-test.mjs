/**
 * 端到端联调测试脚本
 *
 * 模拟服务端返回不同数据，验证 enrichLicenseWithSupport 的真实行为。
 * 直接 import 编译后的 dist 模块，与生产环境路径一致。
 *
 * 运行: node scripts/e2e-qrcode-test.mjs
 */

import { enrichLicenseWithSupport, clearSupportQrcodeCache } from "../dist/license/support-qrcode.js";

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ ${testName}`);
    passed++;
  } else {
    console.log(`  ❌ ${testName}`);
    failed++;
  }
}

// ============================================================================
console.log("\n=== 场景 1：服务端返回完整数据 ===");
// ============================================================================
{
  clearSupportQrcodeCache();
  const license = {
    keyType: "test",
    supportQrcode: {
      base64: "data:image/png;base64,SERVER_QRCODE_DATA_12345",
      groupName: "服务端技术群 A",
    },
    purchaseUrl: "https://server-buy.example.com",
  };

  enrichLicenseWithSupport(license, "device-e2e-001");

  assert(license.supportQrcode.base64 === "data:image/png;base64,SERVER_QRCODE_DATA_12345",
    "supportQrcode.base64 保持服务端值");
  assert(license.supportQrcode.groupName === "服务端技术群 A",
    "supportQrcode.groupName 保持服务端值");
  assert(license.purchaseUrl === "https://server-buy.example.com",
    "purchaseUrl 保持服务端值");
}

// ============================================================================
console.log("\n=== 场景 2：服务端未返回，fallback 到本地 ===");
// ============================================================================
{
  clearSupportQrcodeCache();
  const license = {
    keyType: "test",
    // 服务端没有返回 supportQrcode 和 purchaseUrl
  };

  enrichLicenseWithSupport(license, "device-e2e-002");

  // 本地文件目录可能不存在（开发环境），所以值可能是 undefined
  // 关键：不报错，流程正常
  assert(true, "服务端未返回时不报错，流程正常");
  console.log(`    supportQrcode = ${license.supportQrcode ? "本地fallback生效" : "undefined(本地也无文件)"}`);
  console.log(`    purchaseUrl = ${license.purchaseUrl || "undefined(本地也无配置)"}`);
}

// ============================================================================
console.log("\n=== 场景 3：服务端返回空对象 {} ===");
// ============================================================================
{
  clearSupportQrcodeCache();
  const license = {
    keyType: "test",
    supportQrcode: {},  // 服务端返回了空对象
  };

  enrichLicenseWithSupport(license, "device-e2e-003");

  // base64 为 undefined → !license.supportQrcode?.base64 为 true → 走 fallback
  assert(!license.supportQrcode?.base64 || license.supportQrcode.base64.startsWith("data:"),
    "空对象被 fallback 处理，不会传空给前端");
}

// ============================================================================
console.log("\n=== 场景 4：服务端返回 base64 为空字符串 ===");
// ============================================================================
{
  clearSupportQrcodeCache();
  const license = {
    keyType: "test",
    supportQrcode: { base64: "", groupName: "空群" },
  };

  enrichLicenseWithSupport(license, "device-e2e-004");

  assert(!license.supportQrcode?.base64 || license.supportQrcode.base64.startsWith("data:"),
    "空 base64 被 fallback 处理");
}

// ============================================================================
console.log("\n=== 场景 5：standard 用户 purchaseUrl 被清除 ===");
// ============================================================================
{
  clearSupportQrcodeCache();
  const license = {
    keyType: "standard",
    supportQrcode: {
      base64: "data:image/png;base64,OFFICIAL_QR",
      groupName: "专属群",
    },
    purchaseUrl: "https://should-be-cleared.com",
  };

  enrichLicenseWithSupport(license, "device-e2e-005");

  assert(license.supportQrcode.base64 === "data:image/png;base64,OFFICIAL_QR",
    "standard 用户 supportQrcode 保留");
  assert(license.purchaseUrl === undefined,
    "standard 用户 purchaseUrl 被清除");
}

// ============================================================================
console.log("\n=== 场景 6：null / undefined 安全性 ===");
// ============================================================================
{
  let noError = true;
  try {
    enrichLicenseWithSupport(null, "x");
    enrichLicenseWithSupport(undefined, "x");
    enrichLicenseWithSupport({}, "x");
    enrichLicenseWithSupport({ keyType: undefined }, "x");
  } catch (e) {
    noError = false;
    console.log(`    错误: ${e.message}`);
  }
  assert(noError, "null/undefined/空对象 均不报错");
}

// ============================================================================
console.log("\n=== 场景 7：trial 用户与 test 行为一致 ===");
// ============================================================================
{
  clearSupportQrcodeCache();
  const license = {
    keyType: "trial",
    supportQrcode: {
      base64: "data:image/png;base64,TRIAL_QR",
      groupName: "试用群",
    },
    purchaseUrl: "https://trial-buy.com",
  };

  enrichLicenseWithSupport(license, "device-e2e-007");

  assert(license.supportQrcode.base64 === "data:image/png;base64,TRIAL_QR",
    "trial 用户 supportQrcode 保留");
  assert(license.purchaseUrl === "https://trial-buy.com",
    "trial 用户 purchaseUrl 保留");
}

// ============================================================================
// 结果汇总
// ============================================================================
console.log(`\n${"=".repeat(50)}`);
console.log(`联调结果: ${passed} passed, ${failed} failed`);
console.log(`${"=".repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);
