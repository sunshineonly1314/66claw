/**
 * QQ 机器人 Ed25519 签名验证测试
 * QQ Bot Ed25519 Signature Verification Tests
 *
 * 测试 Webhook 签名验证功能
 */

import { describe, it, expect } from "vitest";
import crypto from "node:crypto";

// ============================================================================
// 测试辅助函数 (Test Helpers)
// ============================================================================

/**
 * 生成 Ed25519 密钥对 (用于测试)
 */
function generateEd25519KeyPair(): {
  publicKey: string;
  privateKey: string;
} {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");

  return {
    publicKey: publicKey.export({ type: "spki", format: "der" }).toString("hex"),
    privateKey: privateKey.export({ type: "pkcs8", format: "der" }).toString("hex"),
  };
}

/**
 * 使用 Ed25519 私钥签名
 */
function signWithEd25519(privateKeyHex: string, message: string): string {
  const privateKey = crypto.createPrivateKey({
    key: Buffer.from(privateKeyHex, "hex"),
    format: "der",
    type: "pkcs8",
  });

  const signature = crypto.sign(null, Buffer.from(message, "utf8"), privateKey);
  return signature.toString("hex");
}

/**
 * 验证 Ed25519 签名
 */
function verifyEd25519Signature(
  publicKeyHex: string,
  signatureHex: string,
  timestamp: string,
  body: string,
): boolean {
  try {
    const message = timestamp + body;

    const publicKey = crypto.createPublicKey({
      key: Buffer.from(publicKeyHex, "hex"),
      format: "der",
      type: "spki",
    });

    return crypto.verify(
      null,
      Buffer.from(message, "utf8"),
      publicKey,
      Buffer.from(signatureHex, "hex"),
    );
  } catch (error) {
    console.error("[test] Ed25519 verification error:", error);
    return false;
  }
}

/**
 * 验证时间戳
 */
function verifyTimestamp(timestamp: string, maxAgeSeconds: number = 300): boolean {
  try {
    const requestTime = Number.parseInt(timestamp, 10);
    if (Number.isNaN(requestTime)) {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);
    const age = Math.abs(now - requestTime);

    return age <= maxAgeSeconds;
  } catch {
    return false;
  }
}

// ============================================================================
// 测试套件 (Test Suites)
// ============================================================================

describe("QQBot Ed25519 签名验证", () => {
  describe("verifyEd25519Signature", () => {
    it("应该验证通过有效的签名", () => {
      // 生成测试密钥对
      const { publicKey, privateKey } = generateEd25519KeyPair();

      // 构造测试数据
      const timestamp = String(Math.floor(Date.now() / 1000));
      const body = JSON.stringify({ op: 0, d: { content: "test message" } });

      // 生成签名
      const message = timestamp + body;
      const signature = signWithEd25519(privateKey, message);

      // 验证签名
      const isValid = verifyEd25519Signature(publicKey, signature, timestamp, body);
      expect(isValid).toBe(true);
    });

    it("应该拒绝无效的签名", () => {
      const { publicKey } = generateEd25519KeyPair();

      const timestamp = String(Math.floor(Date.now() / 1000));
      const body = JSON.stringify({ op: 0, d: { content: "test message" } });

      // 使用错误的签名
      const invalidSignature = "0".repeat(128); // 128 个字符的 hex

      const isValid = verifyEd25519Signature(publicKey, invalidSignature, timestamp, body);
      expect(isValid).toBe(false);
    });

    it("应该拒绝被篡改的消息体", () => {
      const { publicKey, privateKey } = generateEd25519KeyPair();

      const timestamp = String(Math.floor(Date.now() / 1000));
      const body = JSON.stringify({ op: 0, d: { content: "test message" } });

      // 使用原始消息生成签名
      const message = timestamp + body;
      const signature = signWithEd25519(privateKey, message);

      // 篡改消息体
      const tamperedBody = JSON.stringify({ op: 0, d: { content: "tampered message" } });

      // 验证应该失败
      const isValid = verifyEd25519Signature(publicKey, signature, timestamp, tamperedBody);
      expect(isValid).toBe(false);
    });

    it("应该拒绝被篡改的时间戳", () => {
      const { publicKey, privateKey } = generateEd25519KeyPair();

      const timestamp = String(Math.floor(Date.now() / 1000));
      const body = JSON.stringify({ op: 0, d: { content: "test message" } });

      // 使用原始时间戳生成签名
      const message = timestamp + body;
      const signature = signWithEd25519(privateKey, message);

      // 篡改时间戳
      const tamperedTimestamp = String(Number.parseInt(timestamp, 10) + 100);

      // 验证应该失败
      const isValid = verifyEd25519Signature(publicKey, signature, tamperedTimestamp, body);
      expect(isValid).toBe(false);
    });

    it("应该处理空消息体", () => {
      const { publicKey, privateKey } = generateEd25519KeyPair();

      const timestamp = String(Math.floor(Date.now() / 1000));
      const body = "";

      const message = timestamp + body;
      const signature = signWithEd25519(privateKey, message);

      const isValid = verifyEd25519Signature(publicKey, signature, timestamp, body);
      expect(isValid).toBe(true);
    });

    it("应该处理包含特殊字符的消息体", () => {
      const { publicKey, privateKey } = generateEd25519KeyPair();

      const timestamp = String(Math.floor(Date.now() / 1000));
      const body = JSON.stringify({
        content: "测试消息 🎉 with emoji & special chars: <>&\"'",
      });

      const message = timestamp + body;
      const signature = signWithEd25519(privateKey, message);

      const isValid = verifyEd25519Signature(publicKey, signature, timestamp, body);
      expect(isValid).toBe(true);
    });

    it("应该拒绝格式错误的公钥", () => {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const body = JSON.stringify({ op: 0 });
      const signature = "0".repeat(128);

      // 无效的公钥格式
      const invalidPublicKey = "invalid_hex_key";

      const isValid = verifyEd25519Signature(invalidPublicKey, signature, timestamp, body);
      expect(isValid).toBe(false);
    });

    it("应该拒绝格式错误的签名", () => {
      const { publicKey } = generateEd25519KeyPair();
      const timestamp = String(Math.floor(Date.now() / 1000));
      const body = JSON.stringify({ op: 0 });

      // 无效的签名格式
      const invalidSignature = "not_a_hex_string!";

      const isValid = verifyEd25519Signature(publicKey, invalidSignature, timestamp, body);
      expect(isValid).toBe(false);
    });
  });

  describe("verifyTimestamp", () => {
    it("应该接受当前时间戳", () => {
      const now = String(Math.floor(Date.now() / 1000));
      expect(verifyTimestamp(now)).toBe(true);
    });

    it("应该接受 5 分钟内的时间戳", () => {
      const fiveMinutesAgo = String(Math.floor(Date.now() / 1000) - 299);
      expect(verifyTimestamp(fiveMinutesAgo)).toBe(true);
    });

    it("应该拒绝超过 5 分钟的时间戳", () => {
      const sixMinutesAgo = String(Math.floor(Date.now() / 1000) - 361);
      expect(verifyTimestamp(sixMinutesAgo)).toBe(false);
    });

    it("应该接受未来 5 分钟内的时间戳 (时钟偏差)", () => {
      const fiveMinutesLater = String(Math.floor(Date.now() / 1000) + 299);
      expect(verifyTimestamp(fiveMinutesLater)).toBe(true);
    });

    it("应该拒绝超过 5 分钟的未来时间戳", () => {
      const sixMinutesLater = String(Math.floor(Date.now() / 1000) + 361);
      expect(verifyTimestamp(sixMinutesLater)).toBe(false);
    });

    it("应该拒绝非数字时间戳", () => {
      expect(verifyTimestamp("not_a_number")).toBe(false);
      expect(verifyTimestamp("")).toBe(false);
      expect(verifyTimestamp("abc123")).toBe(false);
    });

    it("应该接受自定义的时间窗口", () => {
      const tenMinutesAgo = String(Math.floor(Date.now() / 1000) - 599);

      // 默认 5 分钟窗口应该拒绝
      expect(verifyTimestamp(tenMinutesAgo, 300)).toBe(false);

      // 自定义 10 分钟窗口应该接受
      expect(verifyTimestamp(tenMinutesAgo, 600)).toBe(true);
    });
  });

  describe("集成测试: 完整签名验证流程", () => {
    it("应该验证通过完整的 QQ Webhook 请求", () => {
      const { publicKey, privateKey } = generateEd25519KeyPair();

      // 模拟 QQ Webhook 请求
      const timestamp = String(Math.floor(Date.now() / 1000));
      const webhookBody = JSON.stringify({
        op: 0,
        t: "MESSAGE_CREATE",
        d: {
          id: "test-message-id",
          content: "Hello QQ Bot!",
          author: {
            id: "user-123",
            username: "测试用户",
          },
        },
      });

      // 生成签名
      const message = timestamp + webhookBody;
      const signature = signWithEd25519(privateKey, message);

      // 验证时间戳
      const isTimestampValid = verifyTimestamp(timestamp);
      expect(isTimestampValid).toBe(true);

      // 验证签名
      const isSignatureValid = verifyEd25519Signature(
        publicKey,
        signature,
        timestamp,
        webhookBody,
      );
      expect(isSignatureValid).toBe(true);
    });

    it("应该拒绝重放攻击 (旧时间戳)", () => {
      const { publicKey, privateKey } = generateEd25519KeyPair();

      // 使用 10 分钟前的时间戳
      const oldTimestamp = String(Math.floor(Date.now() / 1000) - 600);
      const webhookBody = JSON.stringify({
        op: 0,
        d: { content: "test" },
      });

      // 生成有效签名
      const message = oldTimestamp + webhookBody;
      const signature = signWithEd25519(privateKey, message);

      // 时间戳验证应该失败 (防止重放)
      const isTimestampValid = verifyTimestamp(oldTimestamp);
      expect(isTimestampValid).toBe(false);

      // 即使签名有效，也应该拒绝请求
      const isSignatureValid = verifyEd25519Signature(
        publicKey,
        signature,
        oldTimestamp,
        webhookBody,
      );
      expect(isSignatureValid).toBe(true); // 签名本身是有效的

      // 但由于时间戳过期，整个请求应该被拒绝
      const shouldAcceptRequest = isTimestampValid && isSignatureValid;
      expect(shouldAcceptRequest).toBe(false);
    });

    it("应该拒绝中间人篡改攻击", () => {
      const { publicKey, privateKey } = generateEd25519KeyPair();

      // 原始请求
      const timestamp = String(Math.floor(Date.now() / 1000));
      const originalBody = JSON.stringify({
        op: 0,
        d: { content: "transfer $100" },
      });

      // 生成原始签名
      const message = timestamp + originalBody;
      const signature = signWithEd25519(privateKey, message);

      // 攻击者篡改消息内容
      const tamperedBody = JSON.stringify({
        op: 0,
        d: { content: "transfer $10000" }, // 篡改金额
      });

      // 签名验证应该失败
      const isValid = verifyEd25519Signature(publicKey, signature, timestamp, tamperedBody);
      expect(isValid).toBe(false);
    });
  });

  describe("性能测试", () => {
    it("签名验证应该在 10ms 内完成", () => {
      const { publicKey, privateKey } = generateEd25519KeyPair();

      const timestamp = String(Math.floor(Date.now() / 1000));
      const body = JSON.stringify({
        op: 0,
        d: { content: "test message" },
      });

      const message = timestamp + body;
      const signature = signWithEd25519(privateKey, message);

      const startTime = performance.now();
      verifyEd25519Signature(publicKey, signature, timestamp, body);
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(10); // 应该在 10ms 内完成
    });
  });
});
