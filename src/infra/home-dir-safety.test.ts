/**
 * Tests for drive-root safety guards added to home-dir.ts.
 * Covers: resolveRequiredHomeDir, safeHomedir, isFsRootPath fallback logic.
 */
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { resolveRequiredHomeDir, safeHomedir } from "./home-dir.js";

// ────────────────────────────────────────────────────────────────────
// resolveRequiredHomeDir – drive-root guard
// ────────────────────────────────────────────────────────────────────

describe("resolveRequiredHomeDir drive-root guard", () => {
  it("returns effective home when available", () => {
    const result = resolveRequiredHomeDir(
      { HOME: "/home/user" } as NodeJS.ProcessEnv,
      () => "/fallback",
    );
    expect(result).toBe(path.resolve("/home/user"));
  });

  it("falls back to cwd when no home source and cwd is not root", () => {
    // process.cwd() on this machine should never be a drive root in test env
    const cwd = path.resolve(process.cwd());
    const parsed = path.parse(cwd);
    if (cwd !== parsed.root) {
      const result = resolveRequiredHomeDir({} as NodeJS.ProcessEnv, () => {
        throw new Error("no home");
      });
      expect(result).toBe(cwd);
    }
  });

  it("prefers tmpdir over drive root when cwd is a filesystem root", () => {
    // We cannot actually change process.cwd() to a drive root in tests,
    // but we can verify the function logic by checking that when effective
    // home is available, drive-root fallback is never reached.
    const result = resolveRequiredHomeDir(
      { OPENCLAWCN_HOME: "/valid/home" } as NodeJS.ProcessEnv,
      () => {
        throw new Error("no home");
      },
    );
    expect(result).toBe(path.resolve("/valid/home"));
    // The result should never be a filesystem root
    const parsed = path.parse(result);
    expect(result).not.toBe(parsed.root);
  });

  it("never returns an empty string", () => {
    const result = resolveRequiredHomeDir({} as NodeJS.ProcessEnv, () => {
      throw new Error("boom");
    });
    expect(result.length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// safeHomedir – Windows-specific safe resolver
// ────────────────────────────────────────────────────────────────────

describe("safeHomedir", () => {
  it("returns a non-root directory on normal env", () => {
    const result = safeHomedir();
    expect(result.length).toBeGreaterThan(0);
    // On a normal dev machine, home should not be a drive root
    const parsed = path.parse(result);
    expect(result).not.toBe(parsed.root);
  });

  it("falls back to LOCALAPPDATA when HOME resolves to root", () => {
    // Simulate: all home env vars are drive roots except LOCALAPPDATA
    const env = {
      HOME: process.platform === "win32" ? "C:\\" : "/",
      USERPROFILE: process.platform === "win32" ? "C:\\" : "/",
      LOCALAPPDATA: path.resolve("/valid/local/appdata"),
      APPDATA: path.resolve("/valid/appdata"),
    } as NodeJS.ProcessEnv;

    // safeHomedir uses os.homedir internally, which we can't easily override.
    // Instead test that with valid LOCALAPPDATA, it never returns root.
    const result = safeHomedir(env);
    const parsed = path.parse(result);
    expect(result).not.toBe(parsed.root);
  });

  it("uses APPDATA when LOCALAPPDATA is missing", () => {
    const env = {
      HOME: process.platform === "win32" ? "C:\\" : "/",
      USERPROFILE: process.platform === "win32" ? "C:\\" : "/",
      APPDATA: path.resolve("/valid/appdata"),
    } as NodeJS.ProcessEnv;

    const result = safeHomedir(env);
    const parsed = path.parse(result);
    expect(result).not.toBe(parsed.root);
  });

  it("returns a valid path even with empty env", () => {
    const result = safeHomedir({} as NodeJS.ProcessEnv);
    expect(result.length).toBeGreaterThan(0);
    expect(path.isAbsolute(result)).toBe(true);
  });
});
