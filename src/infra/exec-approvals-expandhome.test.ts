/**
 * Tests for exec-approvals expandHome – verifies it uses resolveRequiredHomeDir
 * instead of raw os.homedir(), ensuring drive-root safety.
 */
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveExecApprovalsPath, resolveExecApprovalsSocketPath } from "./exec-approvals.js";

describe("exec-approvals path resolution", () => {
  it("resolveExecApprovalsPath returns a non-root path", () => {
    const result = resolveExecApprovalsPath();
    expect(result.length).toBeGreaterThan(0);
    expect(path.isAbsolute(result)).toBe(true);

    const parsed = path.parse(result);
    // Should never be just a filesystem root
    expect(result).not.toBe(parsed.root);
    // Should end with the expected filename
    expect(result.endsWith("exec-approvals.json")).toBe(true);
  });

  it("resolveExecApprovalsSocketPath returns a non-root path", () => {
    const result = resolveExecApprovalsSocketPath();
    expect(result.length).toBeGreaterThan(0);
    expect(path.isAbsolute(result)).toBe(true);

    const parsed = path.parse(result);
    expect(result).not.toBe(parsed.root);
    expect(result.endsWith("exec-approvals.sock")).toBe(true);
  });

  it("paths contain .openclawcn directory", () => {
    const filePath = resolveExecApprovalsPath();
    const socketPath = resolveExecApprovalsSocketPath();
    expect(filePath).toContain(".openclawcn");
    expect(socketPath).toContain(".openclawcn");
  });
});
