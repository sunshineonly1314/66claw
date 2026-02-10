/**
 * Security test: Windows Exec Bypass Prevention
 *
 * Tests that single ampersand (&) operator on Windows is properly
 * recognized as a command separator to prevent allowlist bypass.
 *
 * See: SECURITY_AUDIT_BATCH_1_PHASE_2.md - Vulnerability #6
 */

import { describe, expect, it } from "vitest";
import { evaluateShellAllowlist } from "./exec-approvals.js";

describe("Windows Exec Bypass Prevention (Phase 2 #6)", () => {
  const allowlist = ["echo", "dir", "ls"];

  describe("Single ampersand (&) recognition", () => {
    it("blocks single & separator with malicious command", () => {
      // Attack: "echo safe & malicious.exe"
      const result = evaluateShellAllowlist({
        command: "echo safe & malicious.exe",
        allowlist,
      });

      expect(result.analysisOk).toBe(true);
      expect(result.foundChain).toBe(true);
      expect(result.parts).toHaveLength(2);
      expect(result.parts?.[0]).toEqual({ command: "echo", isAllowed: true });
      expect(result.parts?.[1]).toEqual({ command: "malicious.exe", isAllowed: false });
      expect(result.allowedReason).toBeNull();
      expect(result.blockedReason).toBeDefined();
      expect(result.blockedReason).toMatch(/malicious\.exe.*not.*allowlist/i);
    });

    it("blocks single & with cmd.exe bypass", () => {
      // Attack: "dir & cmd.exe /c format C:"
      const result = evaluateShellAllowlist({
        command: "dir & cmd.exe /c format C:",
        allowlist,
      });

      expect(result.analysisOk).toBe(true);
      expect(result.foundChain).toBe(true);
      expect(result.parts).toHaveLength(2);
      expect(result.parts?.[0]).toEqual({ command: "dir", isAllowed: true });
      expect(result.parts?.[1]).toEqual({ command: "cmd.exe", isAllowed: false });
      expect(result.blockedReason).toMatch(/cmd\.exe.*not.*allowlist/i);
    });

    it("blocks single & with net user attack", () => {
      // Attack: "echo test & net user admin /add"
      const result = evaluateShellAllowlist({
        command: "echo test & net user admin /add",
        allowlist,
      });

      expect(result.analysisOk).toBe(true);
      expect(result.foundChain).toBe(true);
      expect(result.parts).toHaveLength(2);
      expect(result.parts?.[0]).toEqual({ command: "echo", isAllowed: true });
      expect(result.parts?.[1]).toEqual({ command: "net", isAllowed: false });
      expect(result.blockedReason).toMatch(/net.*not.*allowlist/i);
    });

    it("blocks single & with del command", () => {
      // Attack: "dir & del /F /Q C:\\*"
      const result = evaluateShellAllowlist({
        command: "dir & del /F /Q C:\\\\*",
        allowlist,
      });

      expect(result.analysisOk).toBe(true);
      expect(result.foundChain).toBe(true);
      expect(result.parts).toHaveLength(2);
      expect(result.parts?.[0]).toEqual({ command: "dir", isAllowed: true });
      expect(result.parts?.[1]).toEqual({ command: "del", isAllowed: false });
      expect(result.blockedReason).toMatch(/del.*not.*allowlist/i);
    });

    it("blocks multiple single & separators", () => {
      // Attack: "echo a & evil1.exe & evil2.exe"
      const result = evaluateShellAllowlist({
        command: "echo a & evil1.exe & evil2.exe",
        allowlist,
      });

      expect(result.analysisOk).toBe(true);
      expect(result.foundChain).toBe(true);
      expect(result.parts).toHaveLength(3);
      expect(result.parts?.[0]).toEqual({ command: "echo", isAllowed: true });
      expect(result.parts?.[1]).toEqual({ command: "evil1.exe", isAllowed: false });
      expect(result.parts?.[2]).toEqual({ command: "evil2.exe", isAllowed: false });
      expect(result.blockedReason).toMatch(/evil1\.exe.*not.*allowlist/i);
    });
  });

  describe("Double ampersand (&&) still works", () => {
    it("still recognizes && operator", () => {
      const result = evaluateShellAllowlist({
        command: "echo test && malicious.exe",
        allowlist,
      });

      expect(result.analysisOk).toBe(true);
      expect(result.foundChain).toBe(true);
      expect(result.parts).toHaveLength(2);
      expect(result.parts?.[0]).toEqual({ command: "echo", isAllowed: true });
      expect(result.parts?.[1]).toEqual({ command: "malicious.exe", isAllowed: false });
      expect(result.blockedReason).toMatch(/malicious\.exe.*not.*allowlist/i);
    });

    it("allows all commands with &&", () => {
      const result = evaluateShellAllowlist({
        command: "echo a && dir && ls",
        allowlist,
      });

      expect(result.analysisOk).toBe(true);
      expect(result.foundChain).toBe(true);
      expect(result.parts).toHaveLength(3);
      expect(result.parts?.[0]).toEqual({ command: "echo", isAllowed: true });
      expect(result.parts?.[1]).toEqual({ command: "dir", isAllowed: true });
      expect(result.parts?.[2]).toEqual({ command: "ls", isAllowed: true });
      expect(result.allowedReason).toBeDefined();
      expect(result.blockedReason).toBeNull();
    });
  });

  describe("Pipe (|) and semicolon (;) still work", () => {
    it("still recognizes | operator", () => {
      const result = evaluateShellAllowlist({
        command: "echo test | evil.bat",
        allowlist,
      });

      expect(result.analysisOk).toBe(true);
      expect(result.foundChain).toBe(true);
      expect(result.parts).toHaveLength(2);
      expect(result.parts?.[0]).toEqual({ command: "echo", isAllowed: true });
      expect(result.parts?.[1]).toEqual({ command: "evil.bat", isAllowed: false });
      expect(result.blockedReason).toMatch(/evil\.bat.*not.*allowlist/i);
    });

    it("still recognizes || operator", () => {
      const result = evaluateShellAllowlist({
        command: "echo test || malicious.exe",
        allowlist,
      });

      expect(result.analysisOk).toBe(true);
      expect(result.foundChain).toBe(true);
      expect(result.parts).toHaveLength(2);
      expect(result.parts?.[0]).toEqual({ command: "echo", isAllowed: true });
      expect(result.parts?.[1]).toEqual({ command: "malicious.exe", isAllowed: false });
      expect(result.blockedReason).toMatch(/malicious\.exe.*not.*allowlist/i);
    });

    it("still recognizes ; operator", () => {
      const result = evaluateShellAllowlist({
        command: "echo test; malicious.exe",
        allowlist,
      });

      expect(result.analysisOk).toBe(true);
      expect(result.foundChain).toBe(true);
      expect(result.parts).toHaveLength(2);
      expect(result.parts?.[0]).toEqual({ command: "echo", isAllowed: true });
      expect(result.parts?.[1]).toEqual({ command: "malicious.exe", isAllowed: false });
      expect(result.blockedReason).toMatch(/malicious\.exe.*not.*allowlist/i);
    });
  });

  describe("Mixed operators", () => {
    it("blocks mixed & and && operators", () => {
      const result = evaluateShellAllowlist({
        command: "echo a & evil1.exe && evil2.exe",
        allowlist,
      });

      expect(result.analysisOk).toBe(true);
      expect(result.foundChain).toBe(true);
      expect(result.parts).toHaveLength(3);
      expect(result.blockedReason).toMatch(/evil1\.exe.*not.*allowlist/i);
    });

    it("blocks mixed & and | operators", () => {
      const result = evaluateShellAllowlist({
        command: "echo a & evil1.exe | evil2.exe",
        allowlist,
      });

      expect(result.analysisOk).toBe(true);
      expect(result.foundChain).toBe(true);
      expect(result.parts).toHaveLength(3);
      expect(result.blockedReason).toMatch(/evil1\.exe.*not.*allowlist/i);
    });
  });

  describe("Allows safe commands with &", () => {
    it("allows all whitelisted commands with &", () => {
      const result = evaluateShellAllowlist({
        command: "echo a & dir & ls",
        allowlist,
      });

      expect(result.analysisOk).toBe(true);
      expect(result.foundChain).toBe(true);
      expect(result.parts).toHaveLength(3);
      expect(result.parts?.[0]).toEqual({ command: "echo", isAllowed: true });
      expect(result.parts?.[1]).toEqual({ command: "dir", isAllowed: true });
      expect(result.parts?.[2]).toEqual({ command: "ls", isAllowed: true });
      expect(result.allowedReason).toBeDefined();
      expect(result.blockedReason).toBeNull();
    });
  });

  describe("Edge cases", () => {
    it("handles & at end of command", () => {
      const result = evaluateShellAllowlist({
        command: "echo test &",
        allowlist,
      });

      // Should handle gracefully - either parse empty second command or ignore trailing &
      expect(result.analysisOk).toBe(true);
    });

    it("handles & at start of command", () => {
      const result = evaluateShellAllowlist({
        command: "& echo test",
        allowlist,
      });

      // Should handle gracefully
      expect(result.analysisOk).toBe(true);
    });

    it("handles multiple consecutive & operators", () => {
      const result = evaluateShellAllowlist({
        command: "echo a && echo b",
        allowlist,
      });

      expect(result.analysisOk).toBe(true);
      expect(result.foundChain).toBe(true);
      expect(result.parts).toHaveLength(2);
    });

    it("handles & in quoted strings", () => {
      const result = evaluateShellAllowlist({
        command: 'echo "test & string" & malicious.exe',
        allowlist,
      });

      // The & inside quotes should be treated as literal,
      // but the & outside quotes should split commands
      expect(result.analysisOk).toBe(true);
      expect(result.foundChain).toBe(true);
      expect(result.blockedReason).toMatch(/malicious\.exe.*not.*allowlist/i);
    });
  });
});
