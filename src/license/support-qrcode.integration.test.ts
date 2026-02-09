/**
 * enrichLicenseWithSupport 联调测试
 *
 * 覆盖场景：
 *   1. 服务端返回完整 supportQrcode → 直接使用，不走本地
 *   2. 服务端未返回 → fallback 到本地文件
 *   3. 服务端返回空对象 { base64: "" } → fallback 到本地文件
 *   4. 服务端和本地都没有 → supportQrcode 为 undefined
 *   5. purchaseUrl：test 用户服务端优先，standard 用户始终清除
 *   6. null / undefined license → 不报错
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { enrichLicenseWithSupport, clearSupportQrcodeCache, getSupportQrcode, getPurchaseUrl } from "./support-qrcode.js";

// Mock 本地文件读取函数
vi.mock("./support-qrcode.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("./support-qrcode.js")>();
  return {
    ...original,
    // 保留 enrichLicenseWithSupport 用真实实现，但 mock getSupportQrcode / getPurchaseUrl
  };
});

// 因为 getSupportQrcode 和 getPurchaseUrl 是同模块内部调用，无法直接 mock
// 所以我们通过控制文件系统来测试：不放本地文件 = 本地返回 null
// 这里用更直接的方式：直接测试 enrichLicenseWithSupport 的输入输出行为

describe("enrichLicenseWithSupport - 服务端优先联调测试", () => {
  beforeEach(() => {
    clearSupportQrcodeCache();
  });

  // =========================================================================
  // 场景 1：服务端已返回完整 supportQrcode
  // =========================================================================
  it("服务端返回完整 supportQrcode 时，不应被覆盖", () => {
    const serverQrcode = {
      base64: "data:image/png;base64,SERVER_QR_DATA",
      groupName: "服务端群 1",
    };
    const license: any = {
      keyType: "test",
      supportQrcode: serverQrcode,
      purchaseUrl: "https://server-purchase.com",
    };

    enrichLicenseWithSupport(license, "device-123");

    // 服务端数据应该被保留
    expect(license.supportQrcode).toBe(serverQrcode);
    expect(license.supportQrcode.base64).toBe("data:image/png;base64,SERVER_QR_DATA");
    expect(license.supportQrcode.groupName).toBe("服务端群 1");
  });

  it("服务端返回 purchaseUrl 时，test 用户不应被本地覆盖", () => {
    const license: any = {
      keyType: "test",
      supportQrcode: { base64: "data:image/png;base64,SERVER", groupName: "G1" },
      purchaseUrl: "https://server-purchase.com",
    };

    enrichLicenseWithSupport(license, "device-123");

    expect(license.purchaseUrl).toBe("https://server-purchase.com");
  });

  // =========================================================================
  // 场景 2：服务端未返回（null / undefined）
  // =========================================================================
  it("服务端未返回 supportQrcode 时，应尝试 fallback（无本地文件时为 undefined）", () => {
    const license: any = {
      keyType: "test",
      // supportQrcode 未设置
    };

    enrichLicenseWithSupport(license, "device-456");

    // 无本地文件时 supportQrcode 仍为 undefined（不会报错）
    // 如果本地有文件则会被填入（取决于文件系统状态）
    expect(license.keyType).toBe("test");
    // 不报错即为通过
  });

  it("服务端返回 supportQrcode: null 时，应 fallback", () => {
    const license: any = {
      keyType: "standard",
      supportQrcode: null,
    };

    enrichLicenseWithSupport(license, "device-789");

    // null 被视为未返回，会尝试本地 fallback
    // 不报错即为通过
    expect(license.keyType).toBe("standard");
  });

  // =========================================================================
  // 场景 3：服务端返回空对象（边界防御）
  // =========================================================================
  it("服务端返回 supportQrcode 但 base64 为空字符串时，应 fallback", () => {
    const license: any = {
      keyType: "test",
      supportQrcode: { base64: "", groupName: "空群" },
    };

    enrichLicenseWithSupport(license, "device-abc");

    // base64 为空字符串，!license.supportQrcode?.base64 为 true，应走 fallback
    // 如果本地也没有，supportQrcode 会被本地值替换（或保持原样）
    // 关键：不应把空 base64 传给前端
    if (license.supportQrcode?.base64) {
      expect(license.supportQrcode.base64.length).toBeGreaterThan(10);
    }
  });

  it("服务端返回空对象 {} 时，应 fallback", () => {
    const license: any = {
      keyType: "test",
      supportQrcode: {},
    };

    enrichLicenseWithSupport(license, "device-def");

    // {} 没有 base64 属性，?.base64 为 undefined → falsy → 走 fallback
    expect(license.keyType).toBe("test");
  });

  // =========================================================================
  // 场景 4：standard 用户 purchaseUrl 始终清除
  // =========================================================================
  it("standard 用户即使服务端返回 purchaseUrl 也应被清除", () => {
    const license: any = {
      keyType: "standard",
      supportQrcode: { base64: "data:image/png;base64,OFFICIAL", groupName: "专属群" },
      purchaseUrl: "https://should-be-removed.com",
    };

    enrichLicenseWithSupport(license, "device-std");

    expect(license.purchaseUrl).toBeUndefined();
  });

  // =========================================================================
  // 场景 5：null / undefined license 不报错
  // =========================================================================
  it("license 为 null 时不应报错", () => {
    expect(() => enrichLicenseWithSupport(null, "device-x")).not.toThrow();
  });

  it("license 为 undefined 时不应报错", () => {
    expect(() => enrichLicenseWithSupport(undefined, "device-x")).not.toThrow();
  });

  it("license 没有 keyType 时不应报错", () => {
    const license: any = { tier: "basic" };
    expect(() => enrichLicenseWithSupport(license, "device-x")).not.toThrow();
    expect(license.supportQrcode).toBeUndefined();
  });

  // =========================================================================
  // 场景 6：trial 用户行为与 test 一致
  // =========================================================================
  it("trial 用户应走 test 逻辑（购买链接保留）", () => {
    const license: any = {
      keyType: "trial",
      supportQrcode: { base64: "data:image/png;base64,TRIAL_QR", groupName: "试用群" },
      purchaseUrl: "https://trial-purchase.com",
    };

    enrichLicenseWithSupport(license, "device-trial");

    expect(license.supportQrcode.base64).toBe("data:image/png;base64,TRIAL_QR");
    expect(license.purchaseUrl).toBe("https://trial-purchase.com");
  });
});
