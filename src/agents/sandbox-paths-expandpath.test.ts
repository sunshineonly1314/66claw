/**
 * Tests for sandbox-paths.ts expandPath → resolveSandboxInputPath.
 * Verifies that tilde expansion uses safe homedir resolution.
 */
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveSandboxInputPath, resolveSandboxPath } from "./sandbox-paths.js";

describe("resolveSandboxInputPath tilde expansion", () => {
  it("expands ~ to a non-root directory", () => {
    const result = resolveSandboxInputPath("~", "/some/cwd");
    const parsed = path.parse(result);
    // Should never resolve to a filesystem root
    expect(result).not.toBe(parsed.root);
    expect(result.length).toBeGreaterThan(1);
  });

  it("expands ~/subdir correctly", () => {
    const result = resolveSandboxInputPath("~/subdir", "/some/cwd");
    expect(result.endsWith("subdir")).toBe(true);
    const parsed = path.parse(result);
    expect(result).not.toBe(parsed.root);
  });

  it("resolves relative paths against cwd", () => {
    const result = resolveSandboxInputPath("foo/bar", "/some/cwd");
    expect(result).toBe(path.resolve("/some/cwd", "foo/bar"));
  });

  it("passes absolute paths through", () => {
    const abs = path.resolve("/absolute/path/to/file");
    const result = resolveSandboxInputPath(abs, "/some/cwd");
    expect(result).toBe(abs);
  });
});

describe("resolveSandboxPath rejects paths outside root", () => {
  it("accepts paths inside the root", () => {
    const root = path.resolve("/workspace");
    const result = resolveSandboxPath({
      filePath: "subdir/file.txt",
      cwd: root,
      root,
    });
    expect(result.resolved).toBe(path.resolve(root, "subdir/file.txt"));
  });

  it("rejects paths that escape the root via ..", () => {
    const root = path.resolve("/workspace");
    expect(() =>
      resolveSandboxPath({
        filePath: "../../etc/passwd",
        cwd: root,
        root,
      }),
    ).toThrow(/escapes sandbox root/i);
  });

  it("rejects ~ paths that are outside the root", () => {
    // ~ resolves to home dir, which is almost certainly outside /workspace
    const root = path.resolve("/workspace");
    expect(() =>
      resolveSandboxPath({
        filePath: "~/some-file",
        cwd: root,
        root,
      }),
    ).toThrow(/escapes sandbox root/i);
  });
});
