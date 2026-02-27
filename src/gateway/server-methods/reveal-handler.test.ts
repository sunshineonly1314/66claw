/**
 * Tests for config.reveal and logs.reveal execFile error handling.
 * Verifies that explorer.exe exit code 1 on Windows is treated as success.
 */
import { execFile } from "node:child_process";
import { describe, expect, it, vi, beforeEach } from "vitest";

// ────────────────────────────────────────────────────────────────────
// Test the error-handling logic extracted from config.ts / logs.ts
// ────────────────────────────────────────────────────────────────────

/**
 * Extracted logic from config.reveal/logs.reveal for testability.
 * Returns true if the error should be reported to the user.
 */
function shouldReportRevealError(err: Error | null, platform: string): boolean {
  if (!err) return false;
  const code = (err as NodeJS.ErrnoException).code;
  const isSystemError = typeof code === "string";
  return isSystemError || platform !== "win32";
}

describe("reveal handler error classification", () => {
  it("treats null error as success", () => {
    expect(shouldReportRevealError(null, "win32")).toBe(false);
    expect(shouldReportRevealError(null, "darwin")).toBe(false);
    expect(shouldReportRevealError(null, "linux")).toBe(false);
  });

  it("treats explorer exit code 1 as success on Windows", () => {
    // Node.js creates Error with numeric exit code when process exits non-zero
    const err = new Error("Command failed: explorer") as NodeJS.ErrnoException;
    (err as any).code = 1; // numeric exit code, not string system error
    expect(shouldReportRevealError(err, "win32")).toBe(false);
  });

  it("treats ENOENT as real error on all platforms", () => {
    const err = new Error("spawn explorer ENOENT") as NodeJS.ErrnoException;
    err.code = "ENOENT"; // string system error
    expect(shouldReportRevealError(err, "win32")).toBe(true);
    expect(shouldReportRevealError(err, "darwin")).toBe(true);
    expect(shouldReportRevealError(err, "linux")).toBe(true);
  });

  it("treats EPERM as real error on all platforms", () => {
    const err = new Error("EPERM") as NodeJS.ErrnoException;
    err.code = "EPERM";
    expect(shouldReportRevealError(err, "win32")).toBe(true);
    expect(shouldReportRevealError(err, "darwin")).toBe(true);
  });

  it("treats any error on macOS/Linux as real failure", () => {
    // On non-Windows, open/xdg-open return meaningful exit codes
    const err = new Error("Command failed");
    expect(shouldReportRevealError(err, "darwin")).toBe(true);
    expect(shouldReportRevealError(err, "linux")).toBe(true);
  });

  it("ignores non-system errors on Windows (numeric exit code)", () => {
    const err = new Error("Command failed") as any;
    err.code = 1;
    expect(shouldReportRevealError(err, "win32")).toBe(false);

    const err2 = new Error("exit 2") as any;
    err2.code = 2;
    expect(shouldReportRevealError(err2, "win32")).toBe(false);
  });

  it("handles error without code property on Windows", () => {
    const err = new Error("Unknown error");
    // No .code set at all → code is undefined → typeof undefined !== "string" → not system error
    // On win32: isSystemError=false, platform=win32 → !isSystemError && platform===win32 → false
    expect(shouldReportRevealError(err, "win32")).toBe(false);
    // On linux: platform !== "win32" → true
    expect(shouldReportRevealError(err, "linux")).toBe(true);
  });
});
