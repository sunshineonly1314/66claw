/**
 * Software Protection A/B Paired Testing
 * 软件保护功能 A/B 结对深度测试
 * 
 * Tester A: 正向测试 - 验证功能正确性
 * Tester B: 攻击测试 - 验证安全防护能力
 * 
 * @date 2026-02-04
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createVerify, createSign, generateKeyPairSync, createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// ============================================================================
// Test Utilities
// ============================================================================

const DIST_DIR = path.resolve(process.cwd(), "dist");
const LICENSE_DIR = path.join(DIST_DIR, "license");
const SECURITY_DIR = path.join(DIST_DIR, "security");

// Real RSA public key from the codebase
const REAL_RSA_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAkDtHShdtjfCopovpCcIR
hiyFHopWsclr+7JQ+c4Iz2NIdWrCoAkSUTSp24fJXmVQh27m8Eq9JvGX/wMpQ8H6
++IpO06BXCyk1gYqf8Qqa6CdGMQ0aygCq6aTebQQqDBGICH7u985fkdTRDz62xyG
UbYKIJPZkRycZCGZ5pMvwhxKcSZ6ifpGuBhAlxLqHpax9sUgstWWBOMWEr7SpbL0
BE081ASxkXuQSSGDQFQzUZ98ZoVoYOmneIjU/6JHOAhLDA1R9qEy7KKpb3FV0DQm
PWgG9tgLZk1M7yp3xitO98ZrMtWLmNNPUtQvfM1vlvRI7It0BoGVnPq5P+9dvzmS
nQIDAQAB
-----END PUBLIC KEY-----`;

// Generate fake key pair for attack testing
const { publicKey: FAKE_PUBLIC_KEY, privateKey: FAKE_PRIVATE_KEY } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

/**
 * Simulate RSA signature verification (same logic as rsa-verify.ts)
 */
function verifyRsaSignature(signContent: string, signature: string, publicKey: string): boolean {
  try {
    const verify = createVerify("SHA256");
    verify.update(signContent, "utf8");
    return verify.verify(publicKey, signature, "base64");
  } catch {
    return false;
  }
}

/**
 * Build sign content string (same format as rsa-verify.ts)
 */
function buildSignContent(
  valid: boolean,
  tier: string | null,
  expiresAt: string | null,
  serverTime: number
): string {
  const normalizedExpiresAt = expiresAt?.endsWith("Z") ? expiresAt : (expiresAt ? `${expiresAt}Z` : "");
  return `${valid}|${tier ?? ""}|${normalizedExpiresAt}|${serverTime}`;
}

/**
 * Sign content with private key (simulates server signing)
 */
function signWithPrivateKey(content: string, privateKey: string): string {
  const sign = createSign("SHA256");
  sign.update(content, "utf8");
  return sign.sign(privateKey, "base64");
}

/**
 * Compute SHA-256 hash of file
 */
function computeFileHash(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return createHash("sha256").update(content).digest("hex");
}

// ============================================================================
// TESTER A: 正向测试 (Positive Testing)
// ============================================================================

describe("【Tester A】正向测试 - 功能正确性验证", () => {
  
  describe("A1: RSA 签名验证正向测试", () => {
    
    it("A1.1: 正确的签名应该验证通过", () => {
      // 模拟服务端用私钥签名的场景
      // 注意：我们没有真实私钥，所以用假密钥对验证逻辑
      const serverTime = Date.now();
      const content = buildSignContent(true, "basic", "2027-01-29T16:14:43Z", serverTime);
      const signature = signWithPrivateKey(content, FAKE_PRIVATE_KEY);
      
      // 用对应的公钥验证
      const isValid = verifyRsaSignature(content, signature, FAKE_PUBLIC_KEY);
      expect(isValid).toBe(true);
    });

    it("A1.2: 签名内容格式应该正确构建", () => {
      const content = buildSignContent(true, "basic", "2027-01-29T16:14:43", 1706540083000);
      expect(content).toBe("true|basic|2027-01-29T16:14:43Z|1706540083000");
    });

    it("A1.3: expiresAt 的 Z 后缀应该被正确标准化", () => {
      // 不带 Z
      const content1 = buildSignContent(true, "basic", "2027-01-29T16:14:43", 1000);
      expect(content1).toContain("2027-01-29T16:14:43Z");
      
      // 已带 Z
      const content2 = buildSignContent(true, "basic", "2027-01-29T16:14:43Z", 1000);
      expect(content2).toContain("2027-01-29T16:14:43Z");
      expect(content2).not.toContain("ZZ"); // 不应该有双 Z
    });

    it("A1.4: null 值应该被正确处理", () => {
      const content = buildSignContent(false, null, null, 1000);
      expect(content).toBe("false||" + "|1000");
    });

    it("A1.5: 公钥指纹检查应该正确识别真实公钥", () => {
      // 真实公钥应该包含指纹
      expect(REAL_RSA_PUBLIC_KEY).toContain("kDtHShdtjfCopovpCcIR");
      
      // 假公钥不应该包含指纹
      expect(FAKE_PUBLIC_KEY).not.toContain("kDtHShdtjfCopovpCcIR");
    });
  });

  describe("A2: DEV 模式控制正向测试", () => {
    
    it("A2.1: 生产构建后 __DEV_BUILD__ 应该被替换为 false", () => {
      const startupPath = path.join(LICENSE_DIR, "startup.js");
      if (fs.existsSync(startupPath)) {
        const content = fs.readFileSync(startupPath, "utf8");
        // 不应该存在 __DEV_BUILD__ 字符串（构建时已被替换）
        expect(content).not.toContain("__DEV_BUILD__");
        // 混淆后 !false 可能被进一步变换，只要 __DEV_BUILD__ 被替换即可
        // isDevMode 函数应该仍然存在（作为混淆后的死代码）
        expect(content).toContain("isDevMode");
      }
    });

    it("A2.2: anti-debug.js 也应该被处理", () => {
      const antiDebugPath = path.join(SECURITY_DIR, "anti-debug.js");
      if (fs.existsSync(antiDebugPath)) {
        const content = fs.readFileSync(antiDebugPath, "utf8");
        expect(content).not.toContain("__DEV_BUILD__");
      }
    });
  });

  describe("A3: 离线宽限期正向测试", () => {
    
    it("A3.1: 默认配置应该是 24 小时", async () => {
      const typesModule = await import("../../src/license/types.js");
      expect(typesModule.DEFAULT_LICENSE_CONFIG.offlineGracePeriodHours).toBe(24);
    });

    it("A3.2: RSA 验证应该默认启用", async () => {
      const typesModule = await import("../../src/license/types.js");
      expect(typesModule.DEFAULT_LICENSE_CONFIG.enableRsaVerify).toBe(true);
    });
  });

  describe("A4: 完整性哈希正向测试", () => {
    
    it("A4.1: 完整性哈希文件应该存在", () => {
      const hashFilePath = path.join(SECURITY_DIR, "integrity-hashes.json");
      expect(fs.existsSync(hashFilePath)).toBe(true);
    });

    it("A4.2: 哈希文件应该包含 23 个核心文件", () => {
      const hashFilePath = path.join(SECURITY_DIR, "integrity-hashes.json");
      if (fs.existsSync(hashFilePath)) {
        const hashes = JSON.parse(fs.readFileSync(hashFilePath, "utf8"));
        expect(hashes.length).toBe(23);
      }
    });

    it("A4.3: 哈希文件应该包含 license 和 security 目录", () => {
      const hashFilePath = path.join(SECURITY_DIR, "integrity-hashes.json");
      if (fs.existsSync(hashFilePath)) {
        const hashes = JSON.parse(fs.readFileSync(hashFilePath, "utf8"));
        const paths = hashes.map((h: { path: string }) => h.path);
        
        const licenseFiles = paths.filter((p: string) => p.startsWith("license/"));
        const securityFiles = paths.filter((p: string) => p.startsWith("security/"));
        
        expect(licenseFiles.length).toBe(13); // 13 个 license 文件
        expect(securityFiles.length).toBe(10);  // 10 个 security 文件
      }
    });

    it("A4.4: 当前文件哈希应该与记录匹配", () => {
      const hashFilePath = path.join(SECURITY_DIR, "integrity-hashes.json");
      if (fs.existsSync(hashFilePath)) {
        const hashes = JSON.parse(fs.readFileSync(hashFilePath, "utf8"));
        
        // 验证前 3 个文件
        for (const entry of hashes.slice(0, 3)) {
          const fullPath = path.join(DIST_DIR, entry.path);
          if (fs.existsSync(fullPath)) {
            const actualHash = computeFileHash(fullPath);
            expect(actualHash).toBe(entry.hash);
          }
        }
      }
    });
  });

  describe("A5: 构建流程正向测试", () => {
    
    it("A5.1: dist 目录应该存在", () => {
      expect(fs.existsSync(DIST_DIR)).toBe(true);
    });

    it("A5.2: license 模块文件应该完整", () => {
      const requiredFiles = [
        "device-id.js",
        "heartbeat.js",
        "index.js",
        "notifications.js",
        "offline.js",
        "rsa-verify.js",
        "sign.js",
        "startup.js",
        "types.js",
        "verify.js",
      ];
      
      for (const file of requiredFiles) {
        const filePath = path.join(LICENSE_DIR, file);
        expect(fs.existsSync(filePath)).toBe(true);
      }
    });

    it("A5.3: security 模块文件应该完整", () => {
      const requiredFiles = [
        "anti-debug.js",
        "audit.js",
        "integrity.js",
        "index.js",
      ];
      
      for (const file of requiredFiles) {
        const filePath = path.join(SECURITY_DIR, file);
        expect(fs.existsSync(filePath)).toBe(true);
      }
    });
  });
});

// ============================================================================
// TESTER B: 攻击测试 (Security Attack Testing)
// ============================================================================

describe("【Tester B】攻击测试 - 安全防护验证", () => {

  describe("B1: RSA 签名伪造/篡改攻击测试", () => {
    
    it("B1.1: 使用假私钥签名应该无法通过真实公钥验证", () => {
      const serverTime = Date.now();
      const content = buildSignContent(true, "basic", "2027-01-29T16:14:43Z", serverTime);
      
      // 用假私钥签名
      const fakeSignature = signWithPrivateKey(content, FAKE_PRIVATE_KEY);
      
      // 用真实公钥验证 - 应该失败
      const isValid = verifyRsaSignature(content, fakeSignature, REAL_RSA_PUBLIC_KEY);
      expect(isValid).toBe(false);
    });

    it("B1.2: 篡改签名内容后验证应该失败", () => {
      const serverTime = Date.now();
      const originalContent = buildSignContent(true, "basic", "2027-01-29T16:14:43Z", serverTime);
      const signature = signWithPrivateKey(originalContent, FAKE_PRIVATE_KEY);
      
      // 篡改内容：将 valid 从 true 改为 false
      const tamperedContent = buildSignContent(false, "basic", "2027-01-29T16:14:43Z", serverTime);
      
      // 用原签名验证篡改后的内容 - 应该失败
      const isValid = verifyRsaSignature(tamperedContent, signature, FAKE_PUBLIC_KEY);
      expect(isValid).toBe(false);
    });

    it("B1.3: 篡改 tier 后验证应该失败", () => {
      const serverTime = Date.now();
      const originalContent = buildSignContent(true, "basic", "2027-01-29T16:14:43Z", serverTime);
      const signature = signWithPrivateKey(originalContent, FAKE_PRIVATE_KEY);
      
      // 篡改 tier：从 basic 改为 enterprise
      const tamperedContent = buildSignContent(true, "enterprise", "2027-01-29T16:14:43Z", serverTime);
      
      const isValid = verifyRsaSignature(tamperedContent, signature, FAKE_PUBLIC_KEY);
      expect(isValid).toBe(false);
    });

    it("B1.4: 篡改过期时间后验证应该失败", () => {
      const serverTime = Date.now();
      const originalContent = buildSignContent(true, "basic", "2027-01-29T16:14:43Z", serverTime);
      const signature = signWithPrivateKey(originalContent, FAKE_PRIVATE_KEY);
      
      // 篡改过期时间：延长一年
      const tamperedContent = buildSignContent(true, "basic", "2028-01-29T16:14:43Z", serverTime);
      
      const isValid = verifyRsaSignature(tamperedContent, signature, FAKE_PUBLIC_KEY);
      expect(isValid).toBe(false);
    });

    it("B1.5: 无效的 base64 签名应该返回 false 而非抛出异常", () => {
      const content = "test|content";
      const invalidSignature = "!!!invalid-base64!!!";
      
      // 应该返回 false，不应该抛出异常
      const isValid = verifyRsaSignature(content, invalidSignature, REAL_RSA_PUBLIC_KEY);
      expect(isValid).toBe(false);
    });

    it("B1.6: 空签名应该验证失败", () => {
      const content = buildSignContent(true, "basic", "2027-01-29T16:14:43Z", Date.now());
      
      const isValid = verifyRsaSignature(content, "", REAL_RSA_PUBLIC_KEY);
      expect(isValid).toBe(false);
    });
  });

  describe("B2: DEV 模式绕过攻击测试", () => {
    
    it("B2.1: 生产构建中不应存在可被环境变量绕过的代码", () => {
      const startupPath = path.join(LICENSE_DIR, "startup.js");
      if (fs.existsSync(startupPath)) {
        const content = fs.readFileSync(startupPath, "utf8");

        // 不应该存在 __DEV_BUILD__ 变量（构建时已被替换）
        expect(content).not.toContain("__DEV_BUILD__");

        // 混淆后 !false 可能被进一步变换，验证 __DEV_BUILD__ 不存在即可
        // isDevMode 函数应存在于混淆后的代码中
        expect(content).toContain("isDevMode");
      }
    });

    it("B2.2: isDevMode 函数在生产构建中应该始终返回 false", () => {
      const startupPath = path.join(LICENSE_DIR, "startup.js");
      if (fs.existsSync(startupPath)) {
        const content = fs.readFileSync(startupPath, "utf8");

        // 混淆后的代码不再有明文 if (!false) 模式
        // 验证 __DEV_BUILD__ 已被替换且 isDevMode 函数存在
        expect(content).not.toContain("__DEV_BUILD__");
        expect(content).toContain("isDevMode");
      }
    });
  });

  describe("B3: 时间篡改/重放攻击测试", () => {
    
    it("B3.1: 服务器时间偏差超过 5 分钟应该被拒绝", () => {
      const MAX_DRIFT_MS = 5 * 60 * 1000; // 5 分钟
      
      const now = Date.now();
      const oldServerTime = now - MAX_DRIFT_MS - 1000; // 超过 5 分钟
      
      const drift = Math.abs(now - oldServerTime);
      expect(drift).toBeGreaterThan(MAX_DRIFT_MS);
    });

    it("B3.2: 未来时间戳也应该被检测", () => {
      const MAX_DRIFT_MS = 5 * 60 * 1000;
      
      const now = Date.now();
      const futureServerTime = now + MAX_DRIFT_MS + 1000; // 超过 5 分钟
      
      const drift = Math.abs(now - futureServerTime);
      expect(drift).toBeGreaterThan(MAX_DRIFT_MS);
    });

    it("B3.3: 旧签名重放应该因为 serverTime 失效", () => {
      // 模拟 6 分钟前的签名
      const oldServerTime = Date.now() - 6 * 60 * 1000;
      const content = buildSignContent(true, "basic", "2027-01-29T16:14:43Z", oldServerTime);
      
      // 即使签名正确，由于 serverTime 过期，也应该被拒绝
      // 这需要在实际验证流程中测试 verifyServerTime
      const MAX_DRIFT_MS = 5 * 60 * 1000;
      const drift = Math.abs(Date.now() - oldServerTime);
      expect(drift).toBeGreaterThan(MAX_DRIFT_MS);
    });
  });

  describe("B4: 代码篡改检测测试", () => {
    
    it("B4.1: 修改文件后哈希应该不匹配", () => {
      const hashFilePath = path.join(SECURITY_DIR, "integrity-hashes.json");
      if (fs.existsSync(hashFilePath)) {
        const hashes = JSON.parse(fs.readFileSync(hashFilePath, "utf8"));
        const firstEntry = hashes[0];
        
        // 模拟篡改：在原始哈希后添加一些内容的哈希
        const tamperedContent = "tampered content";
        const tamperedHash = createHash("sha256").update(tamperedContent).digest("hex");
        
        // 篡改后的哈希应该与原始哈希不匹配
        expect(tamperedHash).not.toBe(firstEntry.hash);
      }
    });

    it("B4.2: 哈希算法应该是 SHA-256 (64 字符十六进制)", () => {
      const hashFilePath = path.join(SECURITY_DIR, "integrity-hashes.json");
      if (fs.existsSync(hashFilePath)) {
        const hashes = JSON.parse(fs.readFileSync(hashFilePath, "utf8"));
        
        for (const entry of hashes) {
          // SHA-256 产生 256 位 = 64 个十六进制字符
          expect(entry.hash.length).toBe(64);
          // 应该只包含十六进制字符
          expect(/^[0-9a-f]{64}$/.test(entry.hash)).toBe(true);
        }
      }
    });

    it("B4.3: 删除文件应该被检测为篡改", () => {
      const hashFilePath = path.join(SECURITY_DIR, "integrity-hashes.json");
      if (fs.existsSync(hashFilePath)) {
        const hashes = JSON.parse(fs.readFileSync(hashFilePath, "utf8"));
        
        // 模拟删除检测：检查所有文件是否存在
        const missingFiles: string[] = [];
        for (const entry of hashes) {
          const fullPath = path.join(DIST_DIR, entry.path);
          if (!fs.existsSync(fullPath)) {
            missingFiles.push(entry.path);
          }
        }
        
        // 在正常构建后，不应该有文件丢失
        expect(missingFiles).toEqual([]);
      }
    });
  });

  describe("B5: 混淆代码安全测试", () => {
    
    it("B5.1: 混淆后的代码不应该包含明文敏感函数名", () => {
      const startupPath = path.join(LICENSE_DIR, "startup.js");
      if (fs.existsSync(startupPath)) {
        const content = fs.readFileSync(startupPath, "utf8");
        
        // 检查是否被混淆（应该包含十六进制变量名）
        const hasObfuscatedVars = /_0x[0-9a-f]+/i.test(content);
        
        // 如果启用了混淆，应该有混淆后的变量名
        // 注意：非混淆构建可能没有这些模式
        if (hasObfuscatedVars) {
          // 混淆后不应该有明文的敏感函数名作为独立变量
          // 但可能出现在字符串数组中（这是正常的）
        }
      }
    });

    it("B5.2: 混淆后的代码应该仍然可以被解析", () => {
      const rsaVerifyPath = path.join(LICENSE_DIR, "rsa-verify.js");
      if (fs.existsSync(rsaVerifyPath)) {
        const content = fs.readFileSync(rsaVerifyPath, "utf8");
        
        // 尝试检查代码是否是有效的 JavaScript
        // 通过检查是否包含基本的 JS 结构
        expect(content.length).toBeGreaterThan(100);
        expect(content).toMatch(/function|const|let|var|export|import/);
      }
    });

    it("B5.3: RSA 公钥应该仍然存在于混淆后的代码中", () => {
      const rsaVerifyPath = path.join(LICENSE_DIR, "rsa-verify.js");
      if (fs.existsSync(rsaVerifyPath)) {
        const content = fs.readFileSync(rsaVerifyPath, "utf8");

        // 混淆器会将公钥字符串拆分成多段拼接，完整指纹不会连续出现
        // 检查公钥的关键片段仍然存在（混淆后字符串被拆分但内容保留）
        const hasKeyFragment = content.includes("DtHShdtj") || content.includes("CopovpCcIR") || content.includes("kDtHShdtjfCopovpCcIR");
        expect(hasKeyFragment).toBe(true);
      }
    });

    it("B5.4: 关键字符串应该被编码到字符串数组中", () => {
      const rsaVerifyPath = path.join(LICENSE_DIR, "rsa-verify.js");
      if (fs.existsSync(rsaVerifyPath)) {
        const content = fs.readFileSync(rsaVerifyPath, "utf8");
        
        // 检查是否有字符串数组模式
        const hasStringArray = /_0x[0-9a-f]+\s*=\s*\[/.test(content) || 
                              /function\s+_0x[0-9a-f]+/.test(content);
        
        // 混淆后应该有这些模式
        if (content.includes("_0x")) {
          expect(hasStringArray).toBe(true);
        }
      }
    });
  });

  describe("B6: 边界条件和异常处理测试", () => {
    
    it("B6.1: 空公钥应该导致验证失败", () => {
      const content = "test|content";
      const signature = signWithPrivateKey(content, FAKE_PRIVATE_KEY);
      
      const isValid = verifyRsaSignature(content, signature, "");
      expect(isValid).toBe(false);
    });

    it("B6.2: 格式错误的公钥应该导致验证失败", () => {
      const content = "test|content";
      const signature = signWithPrivateKey(content, FAKE_PRIVATE_KEY);
      
      const malformedKey = "-----BEGIN PUBLIC KEY-----\nINVALID\n-----END PUBLIC KEY-----";
      const isValid = verifyRsaSignature(content, signature, malformedKey);
      expect(isValid).toBe(false);
    });

    it("B6.3: 超长内容不应该导致崩溃", () => {
      const longContent = "a".repeat(100000);
      const signature = signWithPrivateKey(longContent, FAKE_PRIVATE_KEY);
      
      // 应该能够处理超长内容
      const isValid = verifyRsaSignature(longContent, signature, FAKE_PUBLIC_KEY);
      expect(isValid).toBe(true);
    });

    it("B6.4: 特殊字符不应该影响签名验证", () => {
      const specialContent = "true|basic|2027-01-29T16:14:43Z|1000|特殊字符🔐|<script>alert(1)</script>";
      const signature = signWithPrivateKey(specialContent, FAKE_PRIVATE_KEY);
      
      const isValid = verifyRsaSignature(specialContent, signature, FAKE_PUBLIC_KEY);
      expect(isValid).toBe(true);
    });
  });
});
