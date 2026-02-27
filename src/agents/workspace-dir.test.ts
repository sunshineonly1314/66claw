/**
 * Tests for workspace-dir.ts – normalizeWorkspaceDir and resolveWorkspaceRoot.
 * Covers the drive-root guard added to resolveWorkspaceRoot.
 */
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeWorkspaceDir, resolveWorkspaceRoot } from "./workspace-dir.js";

describe("normalizeWorkspaceDir", () => {
  it("returns null for empty/undefined input", () => {
    expect(normalizeWorkspaceDir()).toBeNull();
    expect(normalizeWorkspaceDir("")).toBeNull();
    expect(normalizeWorkspaceDir("  ")).toBeNull();
  });

  it("returns null for filesystem roots", () => {
    expect(normalizeWorkspaceDir("/")).toBeNull();
    if (process.platform === "win32") {
      expect(normalizeWorkspaceDir("C:\\")).toBeNull();
      expect(normalizeWorkspaceDir("D:\\")).toBeNull();
    }
  });

  it("returns resolved path for valid directories", () => {
    const result = normalizeWorkspaceDir("/some/valid/dir");
    expect(result).toBe(path.resolve("/some/valid/dir"));
  });

  it("expands tilde paths", () => {
    const result = normalizeWorkspaceDir("~/.openclawcn/workspace");
    expect(result).not.toBeNull();
    expect(result!.endsWith(".openclawcn" + path.sep + "workspace")).toBe(true);
  });
});

describe("resolveWorkspaceRoot", () => {
  it("returns normalized dir when valid input is provided", () => {
    const result = resolveWorkspaceRoot("/some/valid/dir");
    expect(result).toBe(path.resolve("/some/valid/dir"));
  });

  it("returns cwd when no input and cwd is not root", () => {
    const cwd = path.resolve(process.cwd());
    const parsed = path.parse(cwd);
    if (cwd !== parsed.root) {
      const result = resolveWorkspaceRoot();
      expect(result).toBe(cwd);
    }
  });

  it("rejects filesystem roots as workspace", () => {
    if (process.platform === "win32") {
      const result = resolveWorkspaceRoot("C:\\");
      // Should not return C:\ — should fall back to cwd or home-based path
      expect(result).not.toBe("C:\\");
    }
    const result = resolveWorkspaceRoot("/");
    expect(result).not.toBe("/");
  });

  it("returns a non-empty absolute path in all cases", () => {
    const result = resolveWorkspaceRoot();
    expect(result.length).toBeGreaterThan(0);
    expect(path.isAbsolute(result)).toBe(true);
  });
});
