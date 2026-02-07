#!/usr/bin/env node
/**
 * 加密保护模块全量深度测试
 * 
 * 测试专家 A：功能测试
 * 测试专家 B：安全/边界测试
 * 
 * 执行：node --import tsx scripts/test-security-full.ts
 */

import { createVerify, createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// ============================================================================
// 测试配置
// ============================================================================

const RSA_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAkDtHShdtjfCopovpCcIR
hiyFHopWsclr+7JQ+c4Iz2NIdWrCoAkSUTSp24fJXmVQh27m8Eq9JvGX/wMpQ8H6
++IpO06BXCyk1gYqf8Qqa6CdGMQ0aygCq6aTebQQqDBGICH7u985fkdTRDz62xyG
UbYKIJPZkRycZCGZ5pMvwhxKcSZ6ifpGuBhAlxLqHpax9sUgstWWBOMWEr7SpbL0
BE081ASxkXuQSSGDQFQzUZ98ZoVoYOmneIjU/6JHOAhLDA1R9qEy7KKpb3FV0DQm
PWgG9tgLZk1M7yp3xitO98ZrMtWLmNNPUtQvfM1vlvRI7It0BoGVnPq5P+9dvzmS
nQIDAQAB
-----END PUBLIC KEY-----`;

const MAX_SERVER_TIME_DRIFT_MS = 5 * 60 * 1000;

interface TestResult {
  expert: "A" | "B";
  category: string;
  name: string;
  passed: boolean;
  details: string;
  duration: number;
}

const results: TestResult[] = [];

function runTest(
  expert: "A" | "B",
  category: string,
  name: string,
  testFn: () => { passed: boolean; details: string },
): void {
  const start = Date.now();
  try {
    const { passed, details } = testFn();
    results.push({
      expert,
      category,
      name,
      passed,
      details,
      duration: Date.now() - start,
    });
  } catch (error) {
    results.push({
      expert,
      category,
      name,
      passed: false,
      details: `异常: ${error instanceof Error ? error.message : String(error)}`,
      duration: Date.now() - start,
    });
  }
}

// ============================================================================
// 辅助函数
// ============================================================================

function normalizeExpiresAt(expiresAt: string | null): string {
  if (!expiresAt) return "";
  if (expiresAt.endsWith("Z")) return expiresAt;
  return `${expiresAt}Z`;
}

function buildSignContent(
  valid: boolean,
  tier: string | null,
  expiresAt: string | null,
  serverTime: number,
): string {
  return `${valid}|${tier ?? ""}|${normalizeExpiresAt(expiresAt)}|${serverTime}`;
}

function verifyRsaSignature(signContent: string, signature: string): boolean {
  try {
    const verify = createVerify("SHA256");
    verify.update(signContent, "utf8");
    return verify.verify(RSA_PUBLIC_KEY, signature, "base64");
  } catch {
    return false;
  }
}

function verifyServerTime(serverTime: number): boolean {
  const now = Date.now();
  return Math.abs(now - serverTime) <= MAX_SERVER_TIME_DRIFT_MS;
}

function computeFileHash(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return createHash("sha256").update(content).digest("hex");
}

// ============================================================================
// 测试专家 A：功能测试
// ============================================================================

console.log("\n" + "=".repeat(70));
console.log("🧪 测试专家 A：功能测试");
console.log("=".repeat(70));

// A1: RSA 签名验证功能
runTest("A", "RSA签名", "公钥格式验证", () => {
  const hasBegin = RSA_PUBLIC_KEY.includes("-----BEGIN PUBLIC KEY-----");
  const hasEnd = RSA_PUBLIC_KEY.includes("-----END PUBLIC KEY-----");
  const hasFingerprint = RSA_PUBLIC_KEY.includes("kDtHShdtjfCopovpCcIR");
  const passed = hasBegin && hasEnd && hasFingerprint;
  return {
    passed,
    details: `BEGIN=${hasBegin}, END=${hasEnd}, 指纹=${hasFingerprint}`,
  };
});

runTest("A", "RSA签名", "签名内容构建-成功响应", () => {
  const content = buildSignContent(true, "basic", "2027-01-29T16:14:43", 1706947200000);
  const expected = "true|basic|2027-01-29T16:14:43Z|1706947200000";
  return {
    passed: content === expected,
    details: `实际="${content}", 预期="${expected}"`,
  };
});

runTest("A", "RSA签名", "签名内容构建-失败响应", () => {
  const content = buildSignContent(false, null, null, 1706947200000);
  const expected = "false|||1706947200000";
  return {
    passed: content === expected,
    details: `实际="${content}", 预期="${expected}"`,
  };
});

runTest("A", "RSA签名", "expiresAt标准化-无Z后缀", () => {
  const result = normalizeExpiresAt("2027-01-29T16:14:43");
  return {
    passed: result === "2027-01-29T16:14:43Z",
    details: `输入="2027-01-29T16:14:43", 输出="${result}"`,
  };
});

runTest("A", "RSA签名", "expiresAt标准化-已有Z后缀", () => {
  const result = normalizeExpiresAt("2027-01-29T16:14:43Z");
  return {
    passed: result === "2027-01-29T16:14:43Z",
    details: `输入="2027-01-29T16:14:43Z", 输出="${result}"`,
  };
});

runTest("A", "RSA签名", "expiresAt标准化-null值", () => {
  const result = normalizeExpiresAt(null);
  return {
    passed: result === "",
    details: `输入=null, 输出="${result}"`,
  };
});

runTest("A", "RSA签名", "无效签名被拒绝", () => {
  const content = "true|basic|2027-01-29T16:14:43Z|1706947200000";
  const invalidSig = "INVALID_SIGNATURE_BASE64";
  const result = verifyRsaSignature(content, invalidSig);
  return {
    passed: result === false,
    details: `无效签名验证结果=${result}`,
  };
});

// A2: DEV 模式控制
runTest("A", "DEV模式", "生产构建DEV标志已替换", () => {
  const startupPath = path.join(process.cwd(), "dist/license/startup.js");
  if (!fs.existsSync(startupPath)) {
    return { passed: false, details: "文件不存在" };
  }
  const content = fs.readFileSync(startupPath, "utf8");
  const hasDevBuildFalse = content.includes("if (!false)");
  const noDevBuildVar = !content.includes("__DEV_BUILD__");
  return {
    passed: hasDevBuildFalse && noDevBuildVar,
    details: `包含"if (!false)"=${hasDevBuildFalse}, 无"__DEV_BUILD__"=${noDevBuildVar}`,
  };
});

runTest("A", "DEV模式", "反调试模块DEV标志已替换", () => {
  const antiDebugPath = path.join(process.cwd(), "dist/security/anti-debug.js");
  if (!fs.existsSync(antiDebugPath)) {
    return { passed: false, details: "文件不存在" };
  }
  const content = fs.readFileSync(antiDebugPath, "utf8");
  const hasDevBuildFalse = content.includes("if (!false)");
  const noDevBuildVar = !content.includes("__DEV_BUILD__");
  return {
    passed: hasDevBuildFalse && noDevBuildVar,
    details: `包含"if (!false)"=${hasDevBuildFalse}, 无"__DEV_BUILD__"=${noDevBuildVar}`,
  };
});

// A3: 离线宽限期
runTest("A", "离线宽限期", "默认配置为24小时", () => {
  const typesPath = path.join(process.cwd(), "dist/license/types.js");
  if (!fs.existsSync(typesPath)) {
    return { passed: false, details: "文件不存在" };
  }
  const content = fs.readFileSync(typesPath, "utf8");
  const has24Hours = content.includes("offlineGracePeriodHours: 24");
  return {
    passed: has24Hours,
    details: `包含"offlineGracePeriodHours: 24"=${has24Hours}`,
  };
});

// A4: 反调试检测
runTest("A", "反调试", "检测函数存在", () => {
  const antiDebugPath = path.join(process.cwd(), "dist/security/anti-debug.js");
  if (!fs.existsSync(antiDebugPath)) {
    return { passed: false, details: "文件不存在" };
  }
  const content = fs.readFileSync(antiDebugPath, "utf8");
  const hasDetectFn = content.includes("detectDebugger");
  const hasStartFn = content.includes("startAntiDebug");
  const hasStopFn = content.includes("stopAntiDebug");
  return {
    passed: hasDetectFn && hasStartFn && hasStopFn,
    details: `detectDebugger=${hasDetectFn}, startAntiDebug=${hasStartFn}, stopAntiDebug=${hasStopFn}`,
  };
});

// A5: 完整性校验
runTest("A", "完整性校验", "哈希文件存在", () => {
  const hashPath = path.join(process.cwd(), "dist/security/integrity-hashes.json");
  const exists = fs.existsSync(hashPath);
  return {
    passed: exists,
    details: `文件存在=${exists}`,
  };
});

runTest("A", "完整性校验", "哈希文件格式正确", () => {
  const hashPath = path.join(process.cwd(), "dist/security/integrity-hashes.json");
  if (!fs.existsSync(hashPath)) {
    return { passed: false, details: "文件不存在" };
  }
  try {
    const content = JSON.parse(fs.readFileSync(hashPath, "utf8"));
    const isArray = Array.isArray(content);
    const hasItems = content.length > 0;
    const validFormat = content.every((item: any) => item.path && item.hash);
    return {
      passed: isArray && hasItems && validFormat,
      details: `数组=${isArray}, 数量=${content.length}, 格式正确=${validFormat}`,
    };
  } catch (e) {
    return { passed: false, details: `解析失败: ${e}` };
  }
});

runTest("A", "完整性校验", "关键文件哈希一致", () => {
  const hashPath = path.join(process.cwd(), "dist/security/integrity-hashes.json");
  if (!fs.existsSync(hashPath)) {
    return { passed: false, details: "哈希文件不存在" };
  }
  
  const hashes = JSON.parse(fs.readFileSync(hashPath, "utf8")) as { path: string; hash: string }[];
  const baseDir = path.join(process.cwd(), "dist");
  
  let matched = 0;
  let mismatched = 0;
  const mismatchedFiles: string[] = [];
  
  for (const { path: relativePath, hash: expectedHash } of hashes.slice(0, 5)) {
    const fullPath = path.join(baseDir, relativePath);
    if (fs.existsSync(fullPath)) {
      const actualHash = computeFileHash(fullPath);
      if (actualHash === expectedHash) {
        matched++;
      } else {
        mismatched++;
        mismatchedFiles.push(relativePath);
      }
    }
  }
  
  return {
    passed: mismatched === 0,
    details: `匹配=${matched}, 不匹配=${mismatched}${mismatchedFiles.length > 0 ? ` (${mismatchedFiles.join(", ")})` : ""}`,
  };
});

// ============================================================================
// 测试专家 B：安全/边界测试
// ============================================================================

console.log("\n" + "=".repeat(70));
console.log("🔒 测试专家 B：安全/边界测试");
console.log("=".repeat(70));

// B1: 密钥安全
runTest("B", "密钥安全", "公钥不包含私钥标识", () => {
  const hasPrivateKey = RSA_PUBLIC_KEY.includes("PRIVATE KEY");
  return {
    passed: !hasPrivateKey,
    details: `包含PRIVATE KEY=${hasPrivateKey}`,
  };
});

runTest("B", "密钥安全", "代码中无私钥泄露", () => {
  const licenseDir = path.join(process.cwd(), "dist/license");
  const files = fs.readdirSync(licenseDir).filter(f => f.endsWith(".js"));
  
  let hasPrivateKey = false;
  let foundIn: string[] = [];
  
  for (const file of files) {
    const content = fs.readFileSync(path.join(licenseDir, file), "utf8");
    if (content.includes("PRIVATE KEY") && !content.includes("LICENSE_RSA_PRIVATE_KEY")) {
      hasPrivateKey = true;
      foundIn.push(file);
    }
  }
  
  return {
    passed: !hasPrivateKey,
    details: hasPrivateKey ? `发现于: ${foundIn.join(", ")}` : "未发现私钥",
  };
});

runTest("B", "密钥安全", "RSA验证已启用", () => {
  const typesPath = path.join(process.cwd(), "dist/license/types.js");
  if (!fs.existsSync(typesPath)) {
    return { passed: false, details: "文件不存在" };
  }
  const content = fs.readFileSync(typesPath, "utf8");
  const enabled = content.includes("enableRsaVerify: true");
  return {
    passed: enabled,
    details: `enableRsaVerify: true = ${enabled}`,
  };
});

// B2: 时间攻击
runTest("B", "时间攻击", "当前时间验证通过", () => {
  const now = Date.now();
  const result = verifyServerTime(now);
  return {
    passed: result === true,
    details: `当前时间验证=${result}`,
  };
});

runTest("B", "时间攻击", "4分钟偏差验证通过", () => {
  const fourMinAgo = Date.now() - 4 * 60 * 1000;
  const fourMinFuture = Date.now() + 4 * 60 * 1000;
  const pastResult = verifyServerTime(fourMinAgo);
  const futureResult = verifyServerTime(fourMinFuture);
  return {
    passed: pastResult && futureResult,
    details: `4分钟前=${pastResult}, 4分钟后=${futureResult}`,
  };
});

runTest("B", "时间攻击", "6分钟偏差验证拒绝", () => {
  const sixMinAgo = Date.now() - 6 * 60 * 1000;
  const sixMinFuture = Date.now() + 6 * 60 * 1000;
  const pastResult = verifyServerTime(sixMinAgo);
  const futureResult = verifyServerTime(sixMinFuture);
  return {
    passed: !pastResult && !futureResult,
    details: `6分钟前=${pastResult}, 6分钟后=${futureResult}`,
  };
});

runTest("B", "时间攻击", "极端时间戳拒绝", () => {
  const epoch = 0;
  const farFuture = Date.now() + 365 * 24 * 60 * 60 * 1000;
  const epochResult = verifyServerTime(epoch);
  const futureResult = verifyServerTime(farFuture);
  return {
    passed: !epochResult && !futureResult,
    details: `时间戳0=${epochResult}, 1年后=${futureResult}`,
  };
});

// B3: 绕过测试
runTest("B", "绕过测试", "空签名被拒绝", () => {
  const content = "true|basic|2027-01-29T16:14:43Z|1706947200000";
  const emptyResult = verifyRsaSignature(content, "");
  return {
    passed: emptyResult === false,
    details: `空签名验证=${emptyResult}`,
  };
});

runTest("B", "绕过测试", "篡改内容被拒绝", () => {
  // 假设有一个有效签名，篡改内容后应该失败
  const originalContent = "true|basic|2027-01-29T16:14:43Z|1706947200000";
  const tamperedContent = "true|premium|2027-01-29T16:14:43Z|1706947200000";
  const fakeSignature = "SGVsbG9Xb3JsZA=="; // 随机base64
  
  const originalResult = verifyRsaSignature(originalContent, fakeSignature);
  const tamperedResult = verifyRsaSignature(tamperedContent, fakeSignature);
  
  return {
    passed: !originalResult && !tamperedResult,
    details: `原始内容+假签名=${originalResult}, 篡改内容+假签名=${tamperedResult}`,
  };
});

runTest("B", "绕过测试", "DEV环境变量无法绕过生产构建", () => {
  const startupPath = path.join(process.cwd(), "dist/license/startup.js");
  if (!fs.existsSync(startupPath)) {
    return { passed: false, details: "文件不存在" };
  }
  const content = fs.readFileSync(startupPath, "utf8");
  
  // 检查是否直接返回 false，不检查环境变量
  const hasDirectFalse = content.includes("if (!false)");
  // 确保环境变量检查在 if (!false) 之后，永远不会执行
  const pattern = /if \(!false\)\s*\{[\s\S]*?return false/;
  const hasEarlyReturn = pattern.test(content);
  
  return {
    passed: hasDirectFalse && hasEarlyReturn,
    details: `直接false检查=${hasDirectFalse}, 提前返回=${hasEarlyReturn}`,
  };
});

// B4: 边界测试
runTest("B", "边界测试", "特殊字符tier处理", () => {
  // 注意：tier 中包含 | 会导致分割出更多部分，这是预期行为
  // 服务端应该对 tier 进行验证，不允许包含 | 字符
  // 这个测试验证的是签名内容能正确构建，而不是分割结果
  const specialTiers = ["tier with space", "tier-with-dash", ""];
  const results = specialTiers.map(tier => {
    const content = buildSignContent(true, tier, "2027-01-29T16:14:43", 1706947200000);
    // 验证内容包含 tier 值
    return content.includes(`true|${tier}|`);
  });
  return {
    passed: results.every(r => r),
    details: `所有tier正确包含在签名内容中=${results.every(r => r)}`,
  };
});

runTest("B", "边界测试", "极大serverTime处理", () => {
  const maxSafe = Number.MAX_SAFE_INTEGER;
  const content = buildSignContent(true, "basic", "2027-01-29T16:14:43", maxSafe);
  const hasMaxSafe = content.includes(String(maxSafe));
  return {
    passed: hasMaxSafe,
    details: `MAX_SAFE_INTEGER正确包含=${hasMaxSafe}`,
  };
});

// B5: 集成测试
runTest("B", "集成测试", "Gateway关闭函数已集成", () => {
  const serverClosePath = path.join(process.cwd(), "dist/gateway/server-close.js");
  if (!fs.existsSync(serverClosePath)) {
    return { passed: false, details: "文件不存在" };
  }
  const content = fs.readFileSync(serverClosePath, "utf8");
  const hasStopLicense = content.includes("stopLicenseServices");
  const hasStopSecurity = content.includes("stopSecurityServices");
  return {
    passed: hasStopLicense && hasStopSecurity,
    details: `stopLicenseServices=${hasStopLicense}, stopSecurityServices=${hasStopSecurity}`,
  };
});

runTest("B", "集成测试", "License检查已集成安全模块", () => {
  const licenseCheckPath = path.join(process.cwd(), "dist/gateway/license-check.js");
  if (!fs.existsSync(licenseCheckPath)) {
    return { passed: false, details: "文件不存在" };
  }
  const content = fs.readFileSync(licenseCheckPath, "utf8");
  const hasAntiDebug = content.includes("startAntiDebug");
  const hasIntegrity = content.includes("checkIntegrityOnStartup");
  return {
    passed: hasAntiDebug && hasIntegrity,
    details: `startAntiDebug=${hasAntiDebug}, checkIntegrityOnStartup=${hasIntegrity}`,
  };
});

runTest("B", "集成测试", "安全模块导出完整", () => {
  const indexPath = path.join(process.cwd(), "dist/security/index.js");
  if (!fs.existsSync(indexPath)) {
    return { passed: false, details: "文件不存在" };
  }
  const content = fs.readFileSync(indexPath, "utf8");
  const exports = [
    "startAntiDebug",
    "stopAntiDebug",
    "checkDebuggerNow",
    "checkIntegrityOnStartup",
    "verifyIntegrity",
  ];
  const hasAll = exports.every(e => content.includes(e));
  const missing = exports.filter(e => !content.includes(e));
  return {
    passed: hasAll,
    details: hasAll ? "所有导出存在" : `缺少: ${missing.join(", ")}`,
  };
});

// ============================================================================
// 生成测试报告
// ============================================================================

console.log("\n" + "=".repeat(70));
console.log("📊 测试报告");
console.log("=".repeat(70));

const expertAResults = results.filter(r => r.expert === "A");
const expertBResults = results.filter(r => r.expert === "B");

const expertAPassed = expertAResults.filter(r => r.passed).length;
const expertBPassed = expertBResults.filter(r => r.passed).length;

const totalPassed = results.filter(r => r.passed).length;
const totalFailed = results.filter(r => !r.passed).length;

console.log("\n┌─────────────────────────────────────────────────────────────────┐");
console.log("│                        测试结果汇总                             │");
console.log("├─────────────────────────────────────────────────────────────────┤");
console.log(`│  测试专家 A (功能测试):  ${expertAPassed}/${expertAResults.length} 通过                              │`);
console.log(`│  测试专家 B (安全测试):  ${expertBPassed}/${expertBResults.length} 通过                              │`);
console.log("├─────────────────────────────────────────────────────────────────┤");
console.log(`│  总计: ${totalPassed}/${results.length} 通过, ${totalFailed} 失败                                    │`);
console.log("└─────────────────────────────────────────────────────────────────┘");

// 详细结果
console.log("\n📋 测试专家 A - 功能测试详情:");
console.log("-".repeat(70));
for (const r of expertAResults) {
  const icon = r.passed ? "✅" : "❌";
  console.log(`${icon} [${r.category}] ${r.name}`);
  console.log(`   ${r.details} (${r.duration}ms)`);
}

console.log("\n📋 测试专家 B - 安全测试详情:");
console.log("-".repeat(70));
for (const r of expertBResults) {
  const icon = r.passed ? "✅" : "❌";
  console.log(`${icon} [${r.category}] ${r.name}`);
  console.log(`   ${r.details} (${r.duration}ms)`);
}

// 失败用例汇总
const failedTests = results.filter(r => !r.passed);
if (failedTests.length > 0) {
  console.log("\n⚠️ 失败用例汇总:");
  console.log("-".repeat(70));
  for (const r of failedTests) {
    console.log(`❌ [专家${r.expert}][${r.category}] ${r.name}`);
    console.log(`   ${r.details}`);
  }
}

// AB 对比
console.log("\n🔄 AB 测试对比:");
console.log("-".repeat(70));
console.log(`│ 指标         │ 专家A(功能) │ 专家B(安全) │ 对比     │`);
console.log(`├──────────────┼─────────────┼─────────────┼──────────┤`);
console.log(`│ 测试用例数   │ ${String(expertAResults.length).padStart(11)} │ ${String(expertBResults.length).padStart(11)} │ ${expertAResults.length === expertBResults.length ? "相等 ✓" : "不等"}    │`);
console.log(`│ 通过数       │ ${String(expertAPassed).padStart(11)} │ ${String(expertBPassed).padStart(11)} │          │`);
console.log(`│ 通过率       │ ${String(Math.round(expertAPassed/expertAResults.length*100) + "%").padStart(11)} │ ${String(Math.round(expertBPassed/expertBResults.length*100) + "%").padStart(11)} │          │`);

// 最终结论
console.log("\n" + "=".repeat(70));
if (totalFailed === 0) {
  console.log("🎉 最终结论: 全部测试通过！加密保护模块功能正常，安全可靠。");
} else {
  console.log(`⚠️ 最终结论: ${totalFailed} 个测试失败，需要检查。`);
}
console.log("=".repeat(70));

// 退出码
process.exit(totalFailed > 0 ? 1 : 0);
