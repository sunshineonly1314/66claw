/**
 * 安全存储模块测试
 * Secure Storage Module Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  encrypt,
  decrypt,
  saveSecureJson,
  loadSecureJson,
  isEncrypted,
  migrateToEncrypted,
  rollbackToPlaintext,
} from "./secure-storage.js";

// ============================================================================
// 测试辅助函数
// ============================================================================

const TEST_DIR = path.join(os.tmpdir(), "openclawcn-secure-storage-test");
const TEST_FILE = path.join(TEST_DIR, "test-data.json");

beforeEach(() => {
  // 创建测试目录
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }
});

afterEach(() => {
  // 清理测试文件
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

// ============================================================================
// 测试套件
// ============================================================================

describe("安全存储 - 加密/解密", () => {
  describe("encrypt + decrypt", () => {
    it("应该成功加密和解密字符串", async () => {
      const plaintext = "Hello, World!";

      const encrypted = await encrypt(plaintext);
      expect(encrypted.encrypted).toBeTruthy();
      expect(encrypted.iv).toBeTruthy();
      expect(encrypted.authTag).toBeTruthy();

      const decrypted = await decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("应该加密和解密包含中文的字符串", async () => {
      const plaintext = "你好，世界！这是一个测试 🎉";

      const encrypted = await encrypt(plaintext);
      const decrypted = await decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("应该加密和解密 JSON 字符串", async () => {
      const data = {
        apiKey: "sk-test-key-123",
        userId: "user-456",
        metadata: {
          name: "测试用户",
          email: "test@example.com",
        },
      };

      const plaintext = JSON.stringify(data);
      const encrypted = await encrypt(plaintext);
      const decrypted = await decrypt(encrypted);

      expect(JSON.parse(decrypted)).toEqual(data);
    });

    it("应该为相同明文生成不同的 IV 和密文", async () => {
      const plaintext = "same message";

      const encrypted1 = await encrypt(plaintext);
      const encrypted2 = await encrypt(plaintext);

      // IV 应该不同
      expect(encrypted1.iv).not.toBe(encrypted2.iv);

      // 密文应该不同
      expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);

      // 但解密后应该相同
      const decrypted1 = await decrypt(encrypted1);
      const decrypted2 = await decrypt(encrypted2);

      expect(decrypted1).toBe(plaintext);
      expect(decrypted2).toBe(plaintext);
    });

    it("应该拒绝篡改的密文", async () => {
      const plaintext = "secret message";
      const encrypted = await encrypt(plaintext);

      // 篡改密文
      const tamperedEncrypted = {
        ...encrypted,
        encrypted: encrypted.encrypted.replace(/[A-Z]/g, "X"),
      };

      await expect(decrypt(tamperedEncrypted)).rejects.toThrow();
    });

    it("应该拒绝篡改的认证标签", async () => {
      const plaintext = "secret message";
      const encrypted = await encrypt(plaintext);

      // 篡改认证标签
      const tamperedEncrypted = {
        ...encrypted,
        authTag: "AAAAAAAAAAAAAAAAAAAAAA==",
      };

      await expect(decrypt(tamperedEncrypted)).rejects.toThrow();
    });

    it("应该处理空字符串", async () => {
      const plaintext = "";

      const encrypted = await encrypt(plaintext);
      const decrypted = await decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("应该处理很长的字符串", async () => {
      const plaintext = "A".repeat(10000);

      const encrypted = await encrypt(plaintext);
      const decrypted = await decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe("saveSecureJson + loadSecureJson", () => {
    it("应该保存和加载加密的 JSON 数据", async () => {
      const data = {
        apiKey: "sk-test-key-789",
        userId: "user-101",
      };

      await saveSecureJson(TEST_FILE, data);
      expect(fs.existsSync(TEST_FILE)).toBe(true);

      const loaded = await loadSecureJson(TEST_FILE);
      expect(loaded).toEqual(data);
    });

    it("应该为不存在的文件返回 null", async () => {
      const nonExistent = path.join(TEST_DIR, "non-existent.json");
      const loaded = await loadSecureJson(nonExistent);

      expect(loaded).toBeNull();
    });

    it("应该创建不存在的目录", async () => {
      const deepPath = path.join(TEST_DIR, "a", "b", "c", "data.json");

      await saveSecureJson(deepPath, { test: "data" });
      expect(fs.existsSync(deepPath)).toBe(true);

      const loaded = await loadSecureJson(deepPath);
      expect(loaded).toEqual({ test: "data" });
    });

    it("应该设置文件权限为 0600", async () => {
      const data = { secret: "value" };

      await saveSecureJson(TEST_FILE, data);

      // 检查权限 (在 Unix 系统上)
      if (process.platform !== "win32") {
        const stats = fs.statSync(TEST_FILE);
        const mode = stats.mode & 0o777;
        expect(mode).toBe(0o600);
      }
    });

    it("应该保存复杂的嵌套对象", async () => {
      const data = {
        profiles: {
          "profile-1": {
            type: "oauth",
            accessToken: "token-1",
            refreshToken: "refresh-1",
            expiresAt: 1234567890,
          },
          "profile-2": {
            type: "api_key",
            apiKey: "key-2",
          },
        },
        order: ["profile-1", "profile-2"],
        lastGood: "profile-1",
      };

      await saveSecureJson(TEST_FILE, data);
      const loaded = await loadSecureJson(TEST_FILE);

      expect(loaded).toEqual(data);
    });
  });

  describe("isEncrypted", () => {
    it("应该识别加密文件", async () => {
      await saveSecureJson(TEST_FILE, { test: "data" });
      expect(isEncrypted(TEST_FILE)).toBe(true);
    });

    it("应该识别明文 JSON 文件", () => {
      const plaintextData = { test: "data" };
      fs.writeFileSync(TEST_FILE, JSON.stringify(plaintextData));

      expect(isEncrypted(TEST_FILE)).toBe(false);
    });

    it("应该对不存在的文件返回 false", () => {
      const nonExistent = path.join(TEST_DIR, "non-existent.json");
      expect(isEncrypted(nonExistent)).toBe(false);
    });

    it("应该对无效 JSON 文件返回 false", () => {
      fs.writeFileSync(TEST_FILE, "not valid json {");
      expect(isEncrypted(TEST_FILE)).toBe(false);
    });
  });

  describe("migrateToEncrypted", () => {
    it("应该将明文文件迁移到加密文件", async () => {
      // 创建明文文件
      const plaintextData = {
        apiKey: "sk-test-key",
        userId: "user-123",
      };
      fs.writeFileSync(TEST_FILE, JSON.stringify(plaintextData));

      // 迁移
      const success = await migrateToEncrypted(TEST_FILE);
      expect(success).toBe(true);

      // 验证文件已加密
      expect(isEncrypted(TEST_FILE)).toBe(true);

      // 验证备份文件存在
      expect(fs.existsSync(TEST_FILE + ".backup")).toBe(true);

      // 验证数据完整性
      const loaded = await loadSecureJson(TEST_FILE);
      expect(loaded).toEqual(plaintextData);
    });

    it("应该跳过已加密的文件", async () => {
      const data = { test: "data" };
      await saveSecureJson(TEST_FILE, data);

      const success = await migrateToEncrypted(TEST_FILE);
      expect(success).toBe(true);

      // 不应该创建备份
      expect(fs.existsSync(TEST_FILE + ".backup")).toBe(false);
    });

    it("应该对不存在的文件返回 false", async () => {
      const nonExistent = path.join(TEST_DIR, "non-existent.json");
      const success = await migrateToEncrypted(nonExistent);

      expect(success).toBe(false);
    });
  });

  describe("rollbackToPlaintext", () => {
    it("应该将加密文件回滚到明文", async () => {
      const data = {
        apiKey: "sk-test-key",
        userId: "user-123",
      };

      // 保存加密文件
      await saveSecureJson(TEST_FILE, data);
      expect(isEncrypted(TEST_FILE)).toBe(true);

      // 回滚到明文
      const success = await rollbackToPlaintext(TEST_FILE);
      expect(success).toBe(true);

      // 验证文件不再加密
      expect(isEncrypted(TEST_FILE)).toBe(false);

      // 验证备份文件存在
      expect(fs.existsSync(TEST_FILE + ".encrypted.backup")).toBe(true);

      // 验证数据完整性
      const raw = fs.readFileSync(TEST_FILE, "utf8");
      const loaded = JSON.parse(raw);
      expect(loaded).toEqual(data);
    });

    it("应该跳过明文文件", async () => {
      const data = { test: "data" };
      fs.writeFileSync(TEST_FILE, JSON.stringify(data));

      const success = await rollbackToPlaintext(TEST_FILE);
      expect(success).toBe(true);

      // 不应该创建备份
      expect(fs.existsSync(TEST_FILE + ".encrypted.backup")).toBe(false);
    });

    it("应该对不存在的文件返回 false", async () => {
      const nonExistent = path.join(TEST_DIR, "non-existent.json");
      const success = await rollbackToPlaintext(nonExistent);

      expect(success).toBe(false);
    });
  });
});

describe("性能测试", () => {
  it("加密应该在 10ms 内完成", async () => {
    const plaintext = "test data";

    const start = performance.now();
    await encrypt(plaintext);
    const end = performance.now();

    expect(end - start).toBeLessThan(10);
  });

  it("解密应该在 10ms 内完成", async () => {
    const plaintext = "test data";
    const encrypted = await encrypt(plaintext);

    const start = performance.now();
    await decrypt(encrypted);
    const end = performance.now();

    expect(end - start).toBeLessThan(10);
  });
});
