/**
 * Integration tests for field-level encryption in the config I/O pipeline.
 *
 * These tests use the real content-vault encryption (machine-bound AES-256-CBC)
 * to verify the full read → decrypt → write → encrypt round-trip.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createConfigIO } from "./io.js";
import { isEncryptedValue } from "./field-encrypt.js";
import { setEncryptionConfigOverride } from "../security/content-vault.js";

// ============================================================================
// Helpers
// ============================================================================

async function withTempConfig(
  configContent: string,
  run: (configPath: string) => Promise<void>,
): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclawcn-field-enc-"));
  const configPath = path.join(dir, "openclawcn.json");
  await fs.writeFile(configPath, configContent, "utf-8");
  try {
    await run(configPath);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

function createIO(configPath: string) {
  return createConfigIO({
    configPath,
    // Use a minimal env to avoid side effects from the test runner's env
    env: { HOME: os.tmpdir() } as unknown as NodeJS.ProcessEnv,
  });
}

// ============================================================================
// Tests
// ============================================================================

describe("field encryption I/O integration", () => {
  beforeEach(() => {
    // These tests validate encryption behavior, so explicitly enable it
    setEncryptionConfigOverride(true);
  });

  afterEach(() => {
    setEncryptionConfigOverride(undefined);
  });

  it("plaintext config → load → write → file contains ENC{} for sensitive fields", async () => {
    const config = JSON.stringify(
      {
        gateway: { auth: { token: "my-secret-token", mode: "token" } },
      },
      null,
      2,
    );

    await withTempConfig(config, async (configPath) => {
      const io = createIO(configPath);

      // Load: should see plaintext
      const loaded = io.loadConfig();
      expect(loaded.gateway?.auth?.token).toBe("my-secret-token");
      expect(loaded.gateway?.auth?.mode).toBe("token");

      // Write back the loaded config
      const { snapshot, writeOptions } = await io.readConfigFileSnapshotForWrite();
      await io.writeConfigFile(snapshot.config, writeOptions);

      // Read the raw file and verify encryption
      const written = await fs.readFile(configPath, "utf-8");
      const parsed = JSON.parse(written);
      expect(isEncryptedValue(parsed.gateway.auth.token)).toBe(true);
      expect(parsed.gateway.auth.mode).toBe("token"); // non-sensitive, not encrypted
    });
  });

  it("ENC{} config → load → write → ciphertext unchanged (no churn)", async () => {
    // First, create a config with encrypted values
    const config = JSON.stringify(
      {
        gateway: { auth: { token: "will-be-encrypted", mode: "token" } },
      },
      null,
      2,
    );

    await withTempConfig(config, async (configPath) => {
      const io = createIO(configPath);

      // First write to encrypt
      const { snapshot: snap1, writeOptions: opts1 } = await io.readConfigFileSnapshotForWrite();
      await io.writeConfigFile(snap1.config, opts1);

      // Read encrypted file
      const afterFirstWrite = await fs.readFile(configPath, "utf-8");
      const parsed1 = JSON.parse(afterFirstWrite);
      const encValue1 = parsed1.gateway.auth.token;
      expect(isEncryptedValue(encValue1)).toBe(true);

      // Second write — should NOT change the ciphertext
      const io2 = createIO(configPath);
      const { snapshot: snap2, writeOptions: opts2 } = await io2.readConfigFileSnapshotForWrite();
      expect(snap2.config.gateway?.auth?.token).toBe("will-be-encrypted"); // decrypted
      await io2.writeConfigFile(snap2.config, opts2);

      const afterSecondWrite = await fs.readFile(configPath, "utf-8");
      const parsed2 = JSON.parse(afterSecondWrite);
      expect(parsed2.gateway.auth.token).toBe(encValue1); // same ciphertext
    });
  });

  it("modifying a sensitive value produces new ciphertext", async () => {
    const config = JSON.stringify(
      {
        gateway: { auth: { token: "old-token" } },
      },
      null,
      2,
    );

    await withTempConfig(config, async (configPath) => {
      const io = createIO(configPath);

      // First write to encrypt
      const { snapshot: snap1, writeOptions: opts1 } = await io.readConfigFileSnapshotForWrite();
      await io.writeConfigFile(snap1.config, opts1);

      const afterFirst = await fs.readFile(configPath, "utf-8");
      const enc1 = JSON.parse(afterFirst).gateway.auth.token;

      // Now change the value
      const io2 = createIO(configPath);
      const { snapshot: snap2, writeOptions: opts2 } = await io2.readConfigFileSnapshotForWrite();
      const modifiedConfig = {
        ...snap2.config,
        gateway: {
          ...snap2.config.gateway,
          auth: { ...snap2.config.gateway?.auth, token: "new-token" },
        },
      };
      await io2.writeConfigFile(modifiedConfig, opts2);

      const afterSecond = await fs.readFile(configPath, "utf-8");
      const enc2 = JSON.parse(afterSecond).gateway.auth.token;
      expect(isEncryptedValue(enc2)).toBe(true);
      expect(enc2).not.toBe(enc1); // different ciphertext

      // Verify the new value can be loaded
      const io3 = createIO(configPath);
      const loaded = io3.loadConfig();
      expect(loaded.gateway?.auth?.token).toBe("new-token");
    });
  });

  it("${VAR} references are preserved alongside encrypted fields", async () => {
    const config = JSON.stringify(
      {
        gateway: {
          auth: { token: "${MY_GW_TOKEN}", password: "literal-password" },
        },
      },
      null,
      2,
    );

    const env = {
      HOME: os.tmpdir(),
      MY_GW_TOKEN: "resolved-token-value",
    } as unknown as NodeJS.ProcessEnv;

    await withTempConfig(config, async (configPath) => {
      const io = createConfigIO({ configPath, env });

      // Load: ${VAR} resolved, password is plaintext
      const loaded = io.loadConfig();
      expect(loaded.gateway?.auth?.token).toBe("resolved-token-value");
      expect(loaded.gateway?.auth?.password).toBe("literal-password");

      // Write back
      const { snapshot, writeOptions } = await io.readConfigFileSnapshotForWrite();
      await io.writeConfigFile(snapshot.config, writeOptions);

      // Verify: ${VAR} preserved, literal password encrypted
      const written = await fs.readFile(configPath, "utf-8");
      const parsed = JSON.parse(written);
      expect(parsed.gateway.auth.token).toBe("${MY_GW_TOKEN}"); // restored, not encrypted
      expect(isEncryptedValue(parsed.gateway.auth.password)).toBe(true); // encrypted
    });
  });

  it("encrypts license.key field", async () => {
    const config = JSON.stringify(
      {
        license: { key: "ABCD-1234-EFGH-5678" },
      },
      null,
      2,
    );

    await withTempConfig(config, async (configPath) => {
      const io = createIO(configPath);
      const { snapshot, writeOptions } = await io.readConfigFileSnapshotForWrite();
      await io.writeConfigFile(snapshot.config, writeOptions);

      const written = await fs.readFile(configPath, "utf-8");
      const parsed = JSON.parse(written);
      expect(isEncryptedValue(parsed.license.key)).toBe(true);

      // Verify round-trip
      const io2 = createIO(configPath);
      const loaded = io2.loadConfig();
      expect(loaded.license?.key).toBe("ABCD-1234-EFGH-5678");
    });
  });

  it("readConfigFileSnapshot decrypts fields in snapshot.config", async () => {
    const config = JSON.stringify(
      {
        gateway: { auth: { token: "plain-token" } },
      },
      null,
      2,
    );

    await withTempConfig(config, async (configPath) => {
      const io = createIO(configPath);

      // First, encrypt via write
      const { snapshot: snap1, writeOptions: opts1 } = await io.readConfigFileSnapshotForWrite();
      await io.writeConfigFile(snap1.config, opts1);

      // Now read snapshot of encrypted file
      const io2 = createIO(configPath);
      const snapshot = await io2.readConfigFileSnapshot();
      expect(snapshot.valid).toBe(true);
      expect(snapshot.config.gateway?.auth?.token).toBe("plain-token"); // decrypted in config

      // snapshot.parsed should retain the raw ENC{} value
      const parsedToken = (snapshot.parsed as any)?.gateway?.auth?.token;
      expect(typeof parsedToken).toBe("string");
      expect(isEncryptedValue(parsedToken)).toBe(true);
    });
  });

  it("encryption disabled → sensitive fields stay plaintext on disk", async () => {
    setEncryptionConfigOverride(false);
    const config = JSON.stringify(
      {
        gateway: { auth: { token: "my-secret-token", mode: "token" } },
      },
      null,
      2,
    );

    await withTempConfig(config, async (configPath) => {
      const io = createIO(configPath);

      // Load: plaintext
      const loaded = io.loadConfig();
      expect(loaded.gateway?.auth?.token).toBe("my-secret-token");

      // Write back
      const { snapshot, writeOptions } = await io.readConfigFileSnapshotForWrite();
      await io.writeConfigFile(snapshot.config, writeOptions);

      // Verify: still plaintext on disk
      const written = await fs.readFile(configPath, "utf-8");
      const parsed = JSON.parse(written);
      expect(parsed.gateway.auth.token).toBe("my-secret-token");
      expect(isEncryptedValue(parsed.gateway.auth.token)).toBe(false);
    });
  });

  it("switching from encrypted to plaintext: old ENC{} decrypted on read, plaintext on write", async () => {
    // First, write with encryption ON
    setEncryptionConfigOverride(true);
    const config = JSON.stringify(
      {
        gateway: { auth: { token: "secret-value" } },
      },
      null,
      2,
    );

    await withTempConfig(config, async (configPath) => {
      const io1 = createIO(configPath);
      const { snapshot: snap1, writeOptions: opts1 } = await io1.readConfigFileSnapshotForWrite();
      await io1.writeConfigFile(snap1.config, opts1);

      // Verify encrypted on disk
      const afterEncrypt = await fs.readFile(configPath, "utf-8");
      expect(isEncryptedValue(JSON.parse(afterEncrypt).gateway.auth.token)).toBe(true);

      // Now switch to encryption OFF
      setEncryptionConfigOverride(false);
      const io2 = createIO(configPath);

      // Load: ENC{} should still be decrypted (read always decrypts)
      const loaded = io2.loadConfig();
      expect(loaded.gateway?.auth?.token).toBe("secret-value");

      // Write back with encryption off
      const { snapshot: snap2, writeOptions: opts2 } = await io2.readConfigFileSnapshotForWrite();
      await io2.writeConfigFile(snap2.config, opts2);

      // Verify: plaintext on disk now
      const afterPlaintext = await fs.readFile(configPath, "utf-8");
      const parsed = JSON.parse(afterPlaintext);
      expect(parsed.gateway.auth.token).toBe("secret-value");
      expect(isEncryptedValue(parsed.gateway.auth.token)).toBe(false);
    });
  });
});
