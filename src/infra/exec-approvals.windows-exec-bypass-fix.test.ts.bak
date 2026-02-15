/**
 * Security test: Windows Exec Bypass Prevention
 *
 * Tests that single ampersand (&) operator on Windows is properly
 * recognized as a command separator to prevent allowlist bypass.
 *
 * See: SECURITY_AUDIT_BATCH_1_PHASE_2.md - Vulnerability #6
 */

import { describe, expect, it } from "vitest";
import { evaluateShellAllowlist, type ExecAllowlistEntry } from "./exec-approvals.js";

describe("Windows Exec Bypass Prevention (Phase 2 #6)", () => {
  // Use full paths so analyzeShellCommand can resolve them.
  // On CI / different platforms the exact resolution may vary,
  // so we mainly test that single & is recognised as a chain operator
  // and that non-allowlisted parts cause rejection.

  const allowlist: ExecAllowlistEntry[] = [
    { pattern: "/usr/bin/echo" },
    { pattern: "/usr/bin/dir" },
    { pattern: "/usr/bin/ls" },
  ];
  const safeBins = new Set<string>();
  const cwd = "/tmp";

  describe("Single ampersand (&) recognition", () => {
    it("blocks single & separator with malicious command", () => {
      // Attack: "/usr/bin/echo safe & malicious.exe"
      const result = evaluateShellAllowlist({
        command: "/usr/bin/echo safe & malicious.exe",
        allowlist,
        safeBins,
        cwd,
      });

      // splitCommandChain now splits on &, producing two parts.
      // "malicious.exe" is not in the allowlist → rejected.
      expect(result.allowlistSatisfied).toBe(false);
    });

    it("blocks single & with cmd.exe bypass", () => {
      const result = evaluateShellAllowlist({
        command: "/usr/bin/dir & cmd.exe /c format C:",
        allowlist,
        safeBins,
        cwd,
      });

      expect(result.allowlistSatisfied).toBe(false);
    });

    it("blocks single & with net user attack", () => {
      const result = evaluateShellAllowlist({
        command: "/usr/bin/echo test & net user admin /add",
        allowlist,
        safeBins,
        cwd,
      });

      expect(result.allowlistSatisfied).toBe(false);
    });

    it("blocks multiple single & separators", () => {
      const result = evaluateShellAllowlist({
        command: "/usr/bin/echo a & evil1.exe & evil2.exe",
        allowlist,
        safeBins,
        cwd,
      });

      expect(result.allowlistSatisfied).toBe(false);
    });
  });

  describe("Double ampersand (&&) still works", () => {
    it("still blocks non-allowlisted commands with &&", () => {
      const result = evaluateShellAllowlist({
        command: "/usr/bin/echo test && malicious.exe",
        allowlist,
        safeBins,
        cwd,
      });

      expect(result.allowlistSatisfied).toBe(false);
    });

    it("allows all allowlisted commands with &&", () => {
      const result = evaluateShellAllowlist({
        command: "/usr/bin/echo a && /usr/bin/dir && /usr/bin/ls",
        allowlist,
        safeBins,
        cwd,
      });

      expect(result.analysisOk).toBe(true);
      expect(result.allowlistSatisfied).toBe(true);
    });
  });

  describe("Other operators still work", () => {
    it("still blocks non-allowlisted commands with ||", () => {
      const result = evaluateShellAllowlist({
        command: "/usr/bin/echo test || malicious.exe",
        allowlist,
        safeBins,
        cwd,
      });

      expect(result.allowlistSatisfied).toBe(false);
    });

    it("still blocks non-allowlisted commands with ;", () => {
      const result = evaluateShellAllowlist({
        command: "/usr/bin/echo test; malicious.exe",
        allowlist,
        safeBins,
        cwd,
      });

      expect(result.allowlistSatisfied).toBe(false);
    });
  });

  describe("Mixed operators", () => {
    it("blocks mixed & and && operators with non-allowlisted command", () => {
      const result = evaluateShellAllowlist({
        command: "/usr/bin/echo a & evil1.exe && evil2.exe",
        allowlist,
        safeBins,
        cwd,
      });

      expect(result.allowlistSatisfied).toBe(false);
    });
  });

  describe("Allows safe commands with &", () => {
    it("allows all allowlisted commands separated by &", () => {
      const result = evaluateShellAllowlist({
        command: "/usr/bin/echo a & /usr/bin/dir & /usr/bin/ls",
        allowlist,
        safeBins,
        cwd,
      });

      expect(result.analysisOk).toBe(true);
      expect(result.allowlistSatisfied).toBe(true);
    });
  });

  describe("Edge cases", () => {
    it("handles trailing & gracefully (malformed chain → analysisOk false)", () => {
      const result = evaluateShellAllowlist({
        command: "/usr/bin/echo test &",
        allowlist,
        safeBins,
        cwd,
      });

      // Trailing & produces empty final part → splitCommandChain returns null
      // → falls through to analyzeShellCommand which rejects bare &
      expect(result.analysisOk).toBe(false);
    });

    it("handles leading & gracefully (malformed chain → analysisOk false)", () => {
      const result = evaluateShellAllowlist({
        command: "& /usr/bin/echo test",
        allowlist,
        safeBins,
        cwd,
      });

      // Leading & produces empty first part → splitCommandChain returns null
      // → falls through to analyzeShellCommand which rejects bare &
      expect(result.analysisOk).toBe(false);
    });

    it("handles && with allowlisted commands", () => {
      const result = evaluateShellAllowlist({
        command: "/usr/bin/echo a && /usr/bin/echo b",
        allowlist,
        safeBins,
        cwd,
      });

      expect(result.analysisOk).toBe(true);
      expect(result.allowlistSatisfied).toBe(true);
    });

    it("handles & in quoted strings correctly", () => {
      const result = evaluateShellAllowlist({
        command: '/usr/bin/echo "test & string"',
        allowlist,
        safeBins,
        cwd,
      });

      // The & inside quotes is treated as a literal character, not a separator.
      // This is a single command → not a chain → analysisOk depends on resolution.
      expect(result.analysisOk).toBe(true);
      expect(result.allowlistSatisfied).toBe(true);
    });
  });
});
