/**
 * Unit tests for CN Encryption Target Resolver.
 *
 * Tests the core functions that drive the encryption pipeline:
 * - Config loading and validation (with config structure checks)
 * - Explicit bytecode directory resolution
 * - Individual bytecode file resolution
 * - Target classification (isCnTarget, isInExplicitBytecodeDir)
 * - Path handling edge cases (Windows backslashes, subdirectories)
 * - Config caching behavior
 */

import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs";
import {
  loadCnEncryptionConfig,
  resolveEncryptionTargets,
  getBytecodeDirs,
  getExplicitBytecodeDirs,
  getBytecodeIndividualFiles,
  isCnTarget,
  isInExplicitBytecodeDir,
} from "./resolve-cn-targets.js";

const ROOT_DIR = path.resolve(import.meta.dirname, "../../..");

describe("resolve-cn-targets", () => {
  // ── Config Loading ───────────────────────────────────────────────────

  describe("loadCnEncryptionConfig", () => {
    it("loads and parses cn_encryption from config file", () => {
      const config = loadCnEncryptionConfig(ROOT_DIR);
      expect(config).toBeDefined();
      expect(config.bytecode).toBeDefined();
      expect(config.obfuscate).toBeDefined();
    });

    it("config has expected structure", () => {
      const config = loadCnEncryptionConfig(ROOT_DIR);
      expect(Array.isArray(config.bytecode.files)).toBe(true);
      expect(Array.isArray(config.bytecode.directories)).toBe(true);
      expect(Array.isArray(config.obfuscate.files)).toBe(true);
      expect(Array.isArray(config.obfuscate.directories)).toBe(true);
    });

    it("bytecode tier has 3 explicit directories", () => {
      const config = loadCnEncryptionConfig(ROOT_DIR);
      expect(config.bytecode.directories).toHaveLength(3);
      expect(config.bytecode.directories).toContain("src/dispatch/");
      expect(config.bytecode.directories).toContain("src/license/");
      expect(config.bytecode.directories).toContain("src/security/");
    });

    it("throws for non-existent root directory", () => {
      expect(() => loadCnEncryptionConfig("/nonexistent/path")).toThrow(
        "CN config not found",
      );
    });
  });

  // ── Explicit Bytecode Dirs ───────────────────────────────────────────

  describe("getExplicitBytecodeDirs", () => {
    it("returns only the 3 explicitly declared directories", () => {
      const dirs = getExplicitBytecodeDirs(ROOT_DIR);
      expect(dirs).toEqual(["dispatch/", "license/", "security/"]);
    });

    it("does NOT include directories derived from individual file paths", () => {
      const dirs = getExplicitBytecodeDirs(ROOT_DIR);
      expect(dirs).not.toContain("gateway/");
      expect(dirs).not.toContain("agents/");
      expect(dirs).not.toContain("config/");
      expect(dirs).not.toContain("commands/");
      expect(dirs).not.toContain("infra/");
    });

    it("returns fewer dirs than deprecated getBytecodeDirs (when dist/ exists)", () => {
      const explicitDirs = getExplicitBytecodeDirs(ROOT_DIR);
      const targets = resolveEncryptionTargets(ROOT_DIR);
      const allDirs = getBytecodeDirs(ROOT_DIR, targets);

      // When dist/ doesn't exist (dev machine), targets.bytecode is empty
      // so getBytecodeDirs returns []. In that case, explicit dirs are still 3.
      if (allDirs.length > 0) {
        // Explicit should be strict subset when dist/ is built
        expect(explicitDirs.length).toBeLessThan(allDirs.length);
        for (const d of explicitDirs) {
          expect(allDirs).toContain(d.replace(/\/$/, ""));
        }
      } else {
        // No dist/ → getBytecodeDirs returns empty, but getExplicitBytecodeDirs
        // still returns the 3 config-declared dirs (config-driven, not filesystem-driven)
        expect(explicitDirs.length).toBe(3);
      }
    });
  });

  // ── Individual Bytecode Files ────────────────────────────────────────

  describe("getBytecodeIndividualFiles", () => {
    it("returns files NOT inside explicit bytecode directories", () => {
      const files = getBytecodeIndividualFiles(ROOT_DIR);
      const explicitDirs = getExplicitBytecodeDirs(ROOT_DIR);

      for (const file of files) {
        const rel = path.relative(path.join(ROOT_DIR, "dist"), file).replace(/\\/g, "/");
        const isInExplicit = explicitDirs.some((d) => rel.startsWith(d));
        expect(isInExplicit, `${rel} should NOT be in explicit dirs`).toBe(false);
      }
    });

    it("includes gateway, agents, config files from bytecode tier", () => {
      const files = getBytecodeIndividualFiles(ROOT_DIR);
      const relPaths = files.map((f) =>
        path.relative(path.join(ROOT_DIR, "dist"), f).replace(/\\/g, "/"),
      );

      expect(relPaths).toContain("gateway/cn-handlers.js");
      expect(relPaths).toContain("agents/modality-capability-checker.js");
      expect(relPaths).toContain("config/region-cn.js");
    });

    it("returns dist/ absolute paths with .js extension", () => {
      const files = getBytecodeIndividualFiles(ROOT_DIR);
      const distDir = path.join(ROOT_DIR, "dist");

      for (const file of files) {
        expect(file.endsWith(".js"), `${file} should end with .js`).toBe(true);
        expect(
          file.startsWith(distDir),
          `${file} should start with ${distDir}`,
        ).toBe(true);
      }
    });
  });

  // ── isInExplicitBytecodeDir ──────────────────────────────────────────

  describe("isInExplicitBytecodeDir", () => {
    it("returns true for files in dispatch/", () => {
      const file = path.join(ROOT_DIR, "dist", "dispatch", "engine.js");
      expect(isInExplicitBytecodeDir(file, ROOT_DIR)).toBe(true);
    });

    it("returns true for files in license/", () => {
      const file = path.join(ROOT_DIR, "dist", "license", "verify.js");
      expect(isInExplicitBytecodeDir(file, ROOT_DIR)).toBe(true);
    });

    it("returns true for files in security/", () => {
      const file = path.join(ROOT_DIR, "dist", "security", "integrity.js");
      expect(isInExplicitBytecodeDir(file, ROOT_DIR)).toBe(true);
    });

    it("returns false for files in gateway/", () => {
      const file = path.join(ROOT_DIR, "dist", "gateway", "cn-handlers.js");
      expect(isInExplicitBytecodeDir(file, ROOT_DIR)).toBe(false);
    });

    it("returns false for files in agents/", () => {
      const file = path.join(ROOT_DIR, "dist", "agents", "siliconflow-models.js");
      expect(isInExplicitBytecodeDir(file, ROOT_DIR)).toBe(false);
    });
  });

  // ── resolveEncryptionTargets ─────────────────────────────────────────

  describe("resolveEncryptionTargets", () => {
    it("returns bytecode and obfuscate arrays", () => {
      const targets = resolveEncryptionTargets(ROOT_DIR);
      expect(Array.isArray(targets.bytecode)).toBe(true);
      expect(Array.isArray(targets.obfuscate)).toBe(true);
    });

    it("bytecode targets are all absolute paths", () => {
      const targets = resolveEncryptionTargets(ROOT_DIR);
      for (const t of targets.bytecode) {
        expect(path.isAbsolute(t), `${t} should be absolute`).toBe(true);
      }
    });

    it("bytecode targets have no overlap with obfuscate targets", () => {
      const targets = resolveEncryptionTargets(ROOT_DIR);
      const bytecodeSet = new Set(targets.bytecode);
      for (const t of targets.obfuscate) {
        expect(bytecodeSet.has(t), `${t} in both tiers`).toBe(false);
      }
    });
  });

  // ── isCnTarget ───────────────────────────────────────────────────────

  describe("isCnTarget", () => {
    it("returns true for a known bytecode target", () => {
      const targets = resolveEncryptionTargets(ROOT_DIR);
      if (targets.bytecode.length > 0) {
        expect(isCnTarget(targets.bytecode[0], targets)).toBe(true);
      }
    });

    it("returns false for a random non-CN file", () => {
      const targets = resolveEncryptionTargets(ROOT_DIR);
      const fakePath = path.join(ROOT_DIR, "dist", "some-upstream-file.js");
      expect(isCnTarget(fakePath, targets)).toBe(false);
    });
  });

  // ── getBytecodeDirs (deprecated) ─────────────────────────────────────

  describe("getBytecodeDirs (deprecated)", () => {
    it("extracts top-level dirs from resolved bytecode targets", () => {
      const targets = resolveEncryptionTargets(ROOT_DIR);
      const dirs = getBytecodeDirs(ROOT_DIR, targets);

      // When dist/ doesn't exist (dev machine), targets.bytecode is empty
      // getBytecodeDirs derives dirs from resolved targets (filesystem-dependent)
      if (dirs.length > 0) {
        // Must include the 3 explicit dirs when dist/ is built
        expect(dirs).toContain("dispatch");
        expect(dirs).toContain("license");
        expect(dirs).toContain("security");
        // Also includes dirs from individual files (over-expansion — why it's deprecated)
        expect(dirs).toContain("gateway");
        expect(dirs).toContain("agents");
      }
      // Whether empty or not, the function should return an array
      expect(Array.isArray(dirs)).toBe(true);
    });

    it("returns sorted array", () => {
      const targets = resolveEncryptionTargets(ROOT_DIR);
      const dirs = getBytecodeDirs(ROOT_DIR, targets);
      const sorted = [...dirs].sort();
      expect(dirs).toEqual(sorted);
    });
  });

  // ── Config Validation ────────────────────────────────────────────────

  describe("config validation", () => {
    it("all bytecode.directories entries end with /", () => {
      const config = loadCnEncryptionConfig(ROOT_DIR);
      for (const dir of config.bytecode.directories) {
        expect(dir.endsWith("/"), `"${dir}" should end with /`).toBe(true);
      }
    });

    it("all bytecode.files entries end with .ts", () => {
      const config = loadCnEncryptionConfig(ROOT_DIR);
      for (const file of config.bytecode.files) {
        expect(file.endsWith(".ts"), `"${file}" should end with .ts`).toBe(true);
      }
    });

    it("all obfuscate.directories entries end with /", () => {
      const config = loadCnEncryptionConfig(ROOT_DIR);
      for (const dir of config.obfuscate.directories) {
        expect(dir.endsWith("/"), `"${dir}" should end with /`).toBe(true);
      }
    });

    it("all obfuscate.files entries end with .ts", () => {
      const config = loadCnEncryptionConfig(ROOT_DIR);
      for (const file of config.obfuscate.files) {
        expect(file.endsWith(".ts"), `"${file}" should end with .ts`).toBe(true);
      }
    });

    it("all bytecode.directories start with src/", () => {
      const config = loadCnEncryptionConfig(ROOT_DIR);
      for (const dir of config.bytecode.directories) {
        expect(dir.startsWith("src/"), `"${dir}" should start with src/`).toBe(true);
      }
    });

    it("no bytecode.files are inside explicit bytecode directories", () => {
      const config = loadCnEncryptionConfig(ROOT_DIR);
      const bytecodeDirs = config.bytecode.directories;

      for (const file of config.bytecode.files) {
        const isInDir = bytecodeDirs.some((d) => file.startsWith(d));
        expect(isInDir, `"${file}" is inside bytecode dir — should be discovered via directory scan, not listed individually`).toBe(false);
      }
    });

    it("config caching returns the same object on repeated calls", () => {
      const config1 = loadCnEncryptionConfig(ROOT_DIR);
      const config2 = loadCnEncryptionConfig(ROOT_DIR);
      // Should be the exact same reference due to caching
      expect(config1).toBe(config2);
    });
  });

  // ── Path Edge Cases ──────────────────────────────────────────────────

  describe("path edge cases", () => {
    it("isInExplicitBytecodeDir handles nested subdirectories", () => {
      // dispatch/sub/deep/file.js should still be in explicit dir
      const file = path.join(ROOT_DIR, "dist", "dispatch", "sub", "deep", "file.js");
      expect(isInExplicitBytecodeDir(file, ROOT_DIR)).toBe(true);
    });

    it("isInExplicitBytecodeDir handles files at dist root", () => {
      const file = path.join(ROOT_DIR, "dist", "index.js");
      expect(isInExplicitBytecodeDir(file, ROOT_DIR)).toBe(false);
    });

    it("isInExplicitBytecodeDir rejects dir names that start with explicit dir name", () => {
      // "dispatch-extra/" starts with "dispatch" but NOT "dispatch/"
      // This ensures we don't get false positives from prefix matching
      const file = path.join(ROOT_DIR, "dist", "dispatch-extra", "file.js");
      expect(isInExplicitBytecodeDir(file, ROOT_DIR)).toBe(false);
    });

    it("getBytecodeIndividualFiles does not return duplicates", () => {
      const files = getBytecodeIndividualFiles(ROOT_DIR);
      const unique = new Set(files);
      expect(files.length).toBe(unique.size);
    });

    it("getBytecodeIndividualFiles count matches config file count minus dir files", () => {
      const config = loadCnEncryptionConfig(ROOT_DIR);
      const explicitDirs = config.bytecode.directories;

      // Count files in config that are NOT inside explicit dirs
      const expectedCount = config.bytecode.files.filter(
        (f) => !explicitDirs.some((d) => f.startsWith(d)),
      ).length;

      const files = getBytecodeIndividualFiles(ROOT_DIR);
      expect(files.length).toBe(expectedCount);
    });
  });

  // ── Cross-tier consistency ─────────────────────────────────────────

  describe("cross-tier consistency", () => {
    it("no file appears in both bytecode and obfuscate tiers", () => {
      const config = loadCnEncryptionConfig(ROOT_DIR);
      const bytecodeFiles = new Set(config.bytecode.files);

      for (const file of config.obfuscate.files) {
        expect(bytecodeFiles.has(file), `"${file}" is in both bytecode and obfuscate tiers`).toBe(false);
      }
    });

    it("no directory appears in both bytecode and obfuscate tiers", () => {
      const config = loadCnEncryptionConfig(ROOT_DIR);
      const bytecodeDirs = new Set(config.bytecode.directories);

      for (const dir of config.obfuscate.directories) {
        expect(bytecodeDirs.has(dir), `"${dir}" is in both bytecode and obfuscate tiers`).toBe(false);
      }
    });
  });

  // ── Regression tests for second-round bugs ─────────────────────────

  describe("regression: resolveTier deduplication", () => {
    it("resolveEncryptionTargets returns no duplicate bytecode paths", () => {
      const targets = resolveEncryptionTargets(ROOT_DIR);
      const seen = new Set<string>();
      for (const t of targets.bytecode) {
        const normalized = path.resolve(t);
        expect(seen.has(normalized), `duplicate bytecode target: ${t}`).toBe(false);
        seen.add(normalized);
      }
    });

    it("resolveEncryptionTargets returns no duplicate obfuscate paths", () => {
      const targets = resolveEncryptionTargets(ROOT_DIR);
      const seen = new Set<string>();
      for (const t of targets.obfuscate) {
        const normalized = path.resolve(t);
        expect(seen.has(normalized), `duplicate obfuscate target: ${t}`).toBe(false);
        seen.add(normalized);
      }
    });
  });

  describe("regression: isCompilableSource consistency", () => {
    it("cn-merge-protection.test.ts and validate-cn-encryption.ts agree on isCompilableSource", () => {
      // Both files must filter: ui/, docs/, scripts/, .github/, config/, cn/docs/, skills/, build/
      // This test reads both files and verifies same filter prefixes
      const testFile = fs.readFileSync(
        path.join(ROOT_DIR, "src/config/cn-merge-protection.test.ts"), "utf-8"
      );
      const validateFile = fs.readFileSync(
        path.join(ROOT_DIR, "cn/scripts/build/validate-cn-encryption.ts"), "utf-8"
      );

      // Extract startsWith("xxx/") patterns from isCompilableSource in each file
      const extractPrefixes = (source: string): string[] => {
        const prefixes: string[] = [];
        // Find isCompilableSource function body
        const funcMatch = source.match(/function isCompilableSource[\s\S]*?^}/m);
        if (!funcMatch) return prefixes;
        const funcBody = funcMatch[0];
        const matches = funcBody.matchAll(/filePath\.startsWith\("([^"]+)"\)/g);
        for (const m of matches) {
          prefixes.push(m[1]);
        }
        return prefixes.sort();
      };

      const testPrefixes = extractPrefixes(testFile);
      const validatePrefixes = extractPrefixes(validateFile);

      expect(testPrefixes).toEqual(validatePrefixes);
    });
  });
});
