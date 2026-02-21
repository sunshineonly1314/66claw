import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock content-vault before importing the module under test
const mockEncryptConfigField = vi.fn();
const mockDecryptConfigField = vi.fn();
const mockIsEncryptionEnabled = vi.fn();

vi.mock("../security/content-vault.js", () => ({
  encryptConfigField: (...args: unknown[]) => mockEncryptConfigField(...args),
  decryptConfigField: (...args: unknown[]) => mockDecryptConfigField(...args),
  isEncryptionEnabled: () => mockIsEncryptionEnabled(),
}));

import {
  isEncryptedValue,
  decryptConfigFields,
  encryptConfigFields,
  clearFieldEncryptCache,
} from "./field-encrypt.js";

// ============================================================================
// Test helpers
// ============================================================================

/**
 * Simple deterministic encrypt/decrypt mock:
 * - encryptContent("hello") → Buffer from "ENCRYPTED:hello"
 * - decryptContent(buf) → extracts plaintext from "ENCRYPTED:..."
 */
function setupMocks(enabled = true) {
  mockIsEncryptionEnabled.mockReturnValue(enabled);

  mockEncryptConfigField.mockImplementation((plaintext: string) => {
    return Buffer.from(`ENCRYPTED:${plaintext}`);
  });

  mockDecryptConfigField.mockImplementation((buf: Buffer) => {
    const str = buf.toString("utf-8");
    if (!str.startsWith("ENCRYPTED:")) {
      throw new Error("Content vault: decryption failed");
    }
    return str.slice("ENCRYPTED:".length);
  });
}

/** Create a fake ENC{...} value that our mock can decrypt */
function fakeEnc(plaintext: string): string {
  const buf = Buffer.from(`ENCRYPTED:${plaintext}`);
  return `ENC{${buf.toString("base64")}}`;
}

// ============================================================================
// Tests
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  clearFieldEncryptCache();
  setupMocks();
});

afterEach(() => {
  clearFieldEncryptCache();
});

describe("isEncryptedValue", () => {
  it("detects ENC{...} format", () => {
    expect(isEncryptedValue("ENC{dGVzdA==}")).toBe(true);
    expect(isEncryptedValue("ENC{abc123+/=}")).toBe(true);
  });

  it("rejects non-ENC strings", () => {
    expect(isEncryptedValue("")).toBe(false);
    expect(isEncryptedValue("hello")).toBe(false);
    expect(isEncryptedValue("sk-ant-api03-xxx")).toBe(false);
    expect(isEncryptedValue("${OPENAI_API_KEY}")).toBe(false);
  });

  it("rejects partial ENC format", () => {
    expect(isEncryptedValue("ENC{")).toBe(false);
    expect(isEncryptedValue("ENC{}")).toBe(false);
    expect(isEncryptedValue("ENC")).toBe(false);
    expect(isEncryptedValue("{base64}")).toBe(false);
  });
});

describe("decryptConfigFields", () => {
  it("decrypts ENC{...} strings", () => {
    const input = { key: fakeEnc("secret-value") };
    const result = decryptConfigFields(input);
    expect(result).toEqual({ key: "secret-value" });
  });

  it("passes through non-encrypted strings unchanged", () => {
    const input = { key: "plain-text-value" };
    const result = decryptConfigFields(input);
    expect(result).toEqual({ key: "plain-text-value" });
  });

  it("handles deeply nested objects", () => {
    const input = {
      models: {
        providers: {
          openai: { apiKey: fakeEnc("sk-openai-key") },
          anthropic: { apiKey: fakeEnc("sk-ant-key") },
        },
      },
      gateway: { auth: { token: fakeEnc("gw-token") } },
      name: "my-bot",
    };
    const result = decryptConfigFields(input) as Record<string, unknown>;
    expect((result as any).models.providers.openai.apiKey).toBe("sk-openai-key");
    expect((result as any).models.providers.anthropic.apiKey).toBe("sk-ant-key");
    expect((result as any).gateway.auth.token).toBe("gw-token");
    expect((result as any).name).toBe("my-bot");
  });

  it("handles arrays", () => {
    const input = { items: [fakeEnc("val1"), "plain", fakeEnc("val2")] };
    const result = decryptConfigFields(input);
    expect(result).toEqual({ items: ["val1", "plain", "val2"] });
  });

  it("returns non-objects unchanged", () => {
    expect(decryptConfigFields(42)).toBe(42);
    expect(decryptConfigFields(null)).toBe(null);
    expect(decryptConfigFields(true)).toBe(true);
  });

  it("passes through when encryption is disabled", () => {
    setupMocks(false);
    const enc = fakeEnc("secret");
    const input = { key: enc };
    const result = decryptConfigFields(input);
    expect(result).toEqual({ key: enc }); // NOT decrypted
  });

  it("returns ENC{...} as-is on decryption failure (graceful degradation)", () => {
    mockDecryptConfigField.mockImplementation(() => {
      throw new Error("wrong machine");
    });
    const enc = fakeEnc("secret");
    const input = { key: enc };
    const result = decryptConfigFields(input);
    expect(result).toEqual({ key: enc }); // returned as-is, not crashed
  });

  it("handles mixed encrypted and plain values", () => {
    const input = {
      gateway: {
        auth: { token: fakeEnc("my-token"), mode: "token" },
        port: 3000,
      },
    };
    const result = decryptConfigFields(input) as any;
    expect(result.gateway.auth.token).toBe("my-token");
    expect(result.gateway.auth.mode).toBe("token");
    expect(result.gateway.port).toBe(3000);
  });
});

describe("encryptConfigFields", () => {
  it("encrypts sensitive fields (gateway.auth.token)", () => {
    const input = {
      gateway: { auth: { token: "my-secret-token" } },
    };
    const result = encryptConfigFields(input) as any;
    expect(isEncryptedValue(result.gateway.auth.token)).toBe(true);
    // Verify the encrypted content can be decrypted back
    expect(mockEncryptConfigField).toHaveBeenCalledWith("my-secret-token");
  });

  it("does NOT encrypt non-sensitive fields", () => {
    const input = {
      gateway: { auth: { mode: "token" }, port: 3000 },
    };
    const result = encryptConfigFields(input) as any;
    expect(result.gateway.auth.mode).toBe("token");
    expect(result.gateway.port).toBe(3000);
  });

  it("skips ${VAR} env var references", () => {
    const input = {
      gateway: { auth: { token: "${GATEWAY_TOKEN}" } },
    };
    const result = encryptConfigFields(input) as any;
    expect(result.gateway.auth.token).toBe("${GATEWAY_TOKEN}");
    expect(mockEncryptConfigField).not.toHaveBeenCalled();
  });

  it("skips empty strings", () => {
    const input = {
      gateway: { auth: { token: "" } },
    };
    const result = encryptConfigFields(input) as any;
    expect(result.gateway.auth.token).toBe("");
    expect(mockEncryptConfigField).not.toHaveBeenCalled();
  });

  it("skips already-encrypted ENC{...} values", () => {
    const enc = fakeEnc("already-encrypted");
    const input = {
      gateway: { auth: { token: enc } },
    };
    const result = encryptConfigFields(input) as any;
    expect(result.gateway.auth.token).toBe(enc);
    expect(mockEncryptConfigField).not.toHaveBeenCalled();
  });

  it("reuses existing ciphertext when value is unchanged", () => {
    const existingEnc = fakeEnc("my-token");
    const diskParsed = {
      gateway: { auth: { token: existingEnc } },
    };
    const input = {
      gateway: { auth: { token: "my-token" } },
    };
    const result = encryptConfigFields(input, diskParsed) as any;
    // Should reuse the disk ciphertext, not encrypt fresh
    expect(result.gateway.auth.token).toBe(existingEnc);
    expect(mockEncryptConfigField).not.toHaveBeenCalled();
  });

  it("produces new ciphertext when value has changed", () => {
    const existingEnc = fakeEnc("old-token");
    const diskParsed = {
      gateway: { auth: { token: existingEnc } },
    };
    const input = {
      gateway: { auth: { token: "new-token" } },
    };
    const result = encryptConfigFields(input, diskParsed) as any;
    // old-token != new-token, so it must encrypt fresh
    expect(isEncryptedValue(result.gateway.auth.token)).toBe(true);
    expect(mockEncryptConfigField).toHaveBeenCalledWith("new-token");
  });

  it("passes through when encryption is disabled", () => {
    setupMocks(false);
    const input = {
      gateway: { auth: { token: "plaintext" } },
    };
    const result = encryptConfigFields(input) as any;
    expect(result.gateway.auth.token).toBe("plaintext");
    expect(mockEncryptConfigField).not.toHaveBeenCalled();
  });

  it("encrypts license.key", () => {
    const input = { license: { key: "ABCD-1234-EFGH" } };
    const result = encryptConfigFields(input) as any;
    expect(isEncryptedValue(result.license.key)).toBe(true);
    expect(mockEncryptConfigField).toHaveBeenCalledWith("ABCD-1234-EFGH");
  });

  it("encrypts wildcard-pattern fields (models.providers.*.apiKey)", () => {
    const input = {
      models: {
        providers: {
          openai: { apiKey: "sk-openai-123" },
          anthropic: { apiKey: "sk-ant-456" },
        },
      },
    };
    const result = encryptConfigFields(input) as any;
    expect(isEncryptedValue(result.models.providers.openai.apiKey)).toBe(true);
    expect(isEncryptedValue(result.models.providers.anthropic.apiKey)).toBe(true);
  });

  it("encrypts talk.apiKey", () => {
    const input = { talk: { apiKey: "talk-secret" } };
    const result = encryptConfigFields(input) as any;
    expect(isEncryptedValue(result.talk.apiKey)).toBe(true);
  });

  it("handles missing diskParsed gracefully", () => {
    const input = {
      gateway: { auth: { token: "new-token" } },
    };
    const result = encryptConfigFields(input, undefined) as any;
    expect(isEncryptedValue(result.gateway.auth.token)).toBe(true);
  });

  it("fails open: stores plaintext if encryption throws", () => {
    mockEncryptConfigField.mockImplementation(() => {
      throw new Error("crypto failure");
    });
    const input = {
      gateway: { auth: { token: "my-token" } },
    };
    const result = encryptConfigFields(input) as any;
    // Should keep plaintext rather than lose data
    expect(result.gateway.auth.token).toBe("my-token");
  });
});

describe("round-trip: encrypt then decrypt", () => {
  it("full config round-trip preserves all values", () => {
    const original = {
      gateway: { auth: { token: "gw-token-123", mode: "token" }, port: 3000 },
      models: {
        providers: {
          openai: { apiKey: "sk-openai-xxx", model: "gpt-4" },
        },
      },
      license: { key: "LICENSE-KEY-123", status: "active" },
      talk: { apiKey: "talk-api-key" },
      agents: [{ name: "agent1", description: "test" }],
    };

    const encrypted = encryptConfigFields(original) as any;

    // Verify sensitive fields are encrypted
    expect(isEncryptedValue(encrypted.gateway.auth.token)).toBe(true);
    expect(isEncryptedValue(encrypted.models.providers.openai.apiKey)).toBe(true);
    expect(isEncryptedValue(encrypted.license.key)).toBe(true);
    expect(isEncryptedValue(encrypted.talk.apiKey)).toBe(true);

    // Verify non-sensitive fields are NOT encrypted
    expect(encrypted.gateway.auth.mode).toBe("token");
    expect(encrypted.gateway.port).toBe(3000);
    expect(encrypted.models.providers.openai.model).toBe("gpt-4");
    expect(encrypted.license.status).toBe("active");

    // Decrypt and verify
    const decrypted = decryptConfigFields(encrypted) as any;
    expect(decrypted.gateway.auth.token).toBe("gw-token-123");
    expect(decrypted.models.providers.openai.apiKey).toBe("sk-openai-xxx");
    expect(decrypted.license.key).toBe("LICENSE-KEY-123");
    expect(decrypted.talk.apiKey).toBe("talk-api-key");
    expect(decrypted.gateway.auth.mode).toBe("token");
    expect(decrypted.gateway.port).toBe(3000);
  });
});
