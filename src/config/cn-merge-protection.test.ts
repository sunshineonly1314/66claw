/**
 * Merge protection and encryption coverage consistency tests.
 *
 * Verifies that config/cn-protected-files.json and .gitattributes
 * are in sync — every file in the JSON should have a merge=ours
 * entry in .gitattributes.
 *
 * Also verifies that cn_encryption targets are consistent with
 * section1_cn_only and section2_modified_upstream.
 */

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");

/** Load and parse the CN protected files config */
function loadConfig() {
  const jsonPath = path.join(REPO_ROOT, "config/cn-protected-files.json");
  return JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
}

/** Collect all files and directories from a cn_encryption tier */
function getTierPaths(tier: { files?: string[]; directories?: string[] }): string[] {
  return [...(tier.files ?? []), ...(tier.directories ?? [])];
}

/** Check if a path falls under one of the section1 directories */
function isUnderSection1Dir(filePath: string, directories: string[]): boolean {
  return directories.some((dir) => filePath.startsWith(dir));
}

/**
 * Filter section1 files to those that are compilable source code
 * (exclude tests, docs, scripts, ui builds, yaml, json, markdown, shell scripts)
 *
 * Must stay in sync with validate-cn-encryption.ts isCompilableSource().
 */
function isCompilableSource(filePath: string): boolean {
  if (!filePath.endsWith(".ts")) return false;
  if (filePath.endsWith(".test.ts") || filePath.endsWith(".spec.ts")) return false;
  if (filePath.startsWith("docs/")) return false;
  if (filePath.startsWith("scripts/")) return false;
  if (filePath.startsWith(".github/")) return false;
  if (filePath.startsWith("config/")) return false;
  if (filePath.startsWith("cn/docs/")) return false;
  if (filePath.startsWith("skills/")) return false;
  if (filePath.startsWith("build/")) return false;
  if (filePath.startsWith("ui/")) return false;
  // Only src/ and extensions/ source files matter for encryption
  if (!filePath.startsWith("src/") && !filePath.startsWith("extensions/")) return false;
  return true;
}

describe("CN merge protection consistency", () => {
  it("cn-protected-files.json exists and is valid JSON", () => {
    const jsonPath = path.join(REPO_ROOT, "config/cn-protected-files.json");
    expect(fs.existsSync(jsonPath)).toBe(true);

    const raw = fs.readFileSync(jsonPath, "utf-8");
    const data = JSON.parse(raw);
    expect(data).toBeDefined();
    expect(typeof data).toBe("object");
  });

  it(".gitattributes exists", () => {
    const gaPath = path.join(REPO_ROOT, ".gitattributes");
    expect(fs.existsSync(gaPath)).toBe(true);
  });

  it("all CN-only files in JSON have merge=ours in .gitattributes", () => {
    const jsonPath = path.join(REPO_ROOT, "config/cn-protected-files.json");
    const gaPath = path.join(REPO_ROOT, ".gitattributes");

    const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    const gitattributes = fs.readFileSync(gaPath, "utf-8");

    // Extract all file paths from section1_cn_only.files
    const cnFiles: string[] = data.section1_cn_only?.files ?? [];

    const missing: string[] = [];
    for (const file of cnFiles) {
      // Check if this file appears in .gitattributes with merge=ours
      // Allow flexible whitespace and \r
      const pattern = file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`^${pattern}\\s+merge=ours`, "m");
      if (!regex.test(gitattributes)) {
        missing.push(file);
      }
    }

    expect(
      missing,
      `The following files are in cn-protected-files.json but missing from .gitattributes:\n${missing.join("\n")}`,
    ).toHaveLength(0);
  });

  it("all CN-only directories in JSON have merge=ours in .gitattributes", () => {
    const jsonPath = path.join(REPO_ROOT, "config/cn-protected-files.json");
    const gaPath = path.join(REPO_ROOT, ".gitattributes");

    const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    const gitattributes = fs.readFileSync(gaPath, "utf-8");

    const cnDirs: string[] = data.section1_cn_only?.directories ?? [];

    const missing: string[] = [];
    for (const dir of cnDirs) {
      // Directories in .gitattributes use /** suffix
      const pattern = dir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`^${pattern}/?\\*\\*\\s+merge=ours`, "m");
      if (!regex.test(gitattributes)) {
        // Also try without trailing /** (some entries use /*)
        const regex2 = new RegExp(`^${pattern}`, "m");
        if (!regex2.test(gitattributes)) {
          missing.push(dir);
        }
      }
    }

    expect(
      missing,
      `The following directories are in cn-protected-files.json but missing from .gitattributes:\n${missing.join("\n")}`,
    ).toHaveLength(0);
  });

  it("new multimodal files are included in merge protection", () => {
    const jsonPath = path.join(REPO_ROOT, "config/cn-protected-files.json");
    const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    const cnFiles: string[] = data.section1_cn_only?.files ?? [];

    const requiredFiles = [
      "src/agents/tools/image-gen-tool.ts",
      "ui/src/ui/chat/image-lightbox.ts",
      "ui/src/styles/chat/image-lightbox.css",
    ];

    for (const file of requiredFiles) {
      expect(cnFiles.includes(file), `${file} should be in cn-protected-files.json`).toBe(true);
    }
  });
});

describe("CN encryption coverage", () => {
  it("cn_encryption section exists and has valid structure", () => {
    const data = loadConfig();
    expect(data.cn_encryption).toBeDefined();
    expect(data.cn_encryption.bytecode).toBeDefined();
    expect(data.cn_encryption.obfuscate).toBeDefined();
    expect(Array.isArray(data.cn_encryption.bytecode.files)).toBe(true);
    expect(Array.isArray(data.cn_encryption.bytecode.directories)).toBe(true);
    expect(Array.isArray(data.cn_encryption.obfuscate.files)).toBe(true);
    expect(Array.isArray(data.cn_encryption.obfuscate.directories)).toBe(true);
  });

  it("all cn_encryption files are in section1_cn_only (confirmed CN code)", () => {
    const data = loadConfig();
    const section1Files = new Set<string>(data.section1_cn_only?.files ?? []);
    const section1Dirs: string[] = data.section1_cn_only?.directories ?? [];

    const allEncryptionPaths = [
      ...getTierPaths(data.cn_encryption.bytecode),
      ...getTierPaths(data.cn_encryption.obfuscate),
    ];

    const notInSection1: string[] = [];
    for (const p of allEncryptionPaths) {
      // license/ and security/ are core dirs not tracked in section1 — they're always ours
      if (p.startsWith("src/license/") || p.startsWith("src/security/")) continue;

      const inFiles = section1Files.has(p);
      const inDirs = isUnderSection1Dir(p, section1Dirs);
      if (!inFiles && !inDirs) {
        notInSection1.push(p);
      }
    }

    expect(
      notInSection1,
      `These encryption targets are NOT in section1_cn_only (may be upstream!):\n${notInSection1.join("\n")}`,
    ).toHaveLength(0);
  });

  it("section1 compilable source files are covered by cn_encryption", () => {
    const data = loadConfig();
    const section1Files: string[] = data.section1_cn_only?.files ?? [];
    const section1Dirs: string[] = data.section1_cn_only?.directories ?? [];

    // Collect all encryption paths (files + directories)
    const encFiles = new Set<string>([
      ...getTierPaths(data.cn_encryption.bytecode),
      ...getTierPaths(data.cn_encryption.obfuscate),
    ]);
    const encDirs: string[] = [
      ...(data.cn_encryption.bytecode.directories ?? []),
      ...(data.cn_encryption.obfuscate.directories ?? []),
    ];

    const uncovered: string[] = [];

    // Check individual files
    for (const file of section1Files) {
      if (!isCompilableSource(file)) continue;

      const inEncFiles = encFiles.has(file);
      const inEncDirs = encDirs.some((d) => file.startsWith(d));
      // Also check if the file is under a section1 directory that is in encryption
      const inSection1DirEncrypted = section1Dirs.some(
        (d) => file.startsWith(d) && encDirs.some((ed) => d.startsWith(ed) || ed.startsWith(d)),
      );

      if (!inEncFiles && !inEncDirs && !inSection1DirEncrypted) {
        uncovered.push(file);
      }
    }

    expect(
      uncovered,
      `These CN source files in section1 are NOT covered by cn_encryption:\n${uncovered.join("\n")}\nAdd them to cn_encryption.bytecode or cn_encryption.obfuscate.`,
    ).toHaveLength(0);
  });

  it("section2 (modified upstream) files are NOT in encryption targets", () => {
    const data = loadConfig();
    const section2Paths: string[] = (data.section2_modified_upstream?.files ?? []).map(
      (f: { path: string }) => f.path,
    );

    const allEncryptionFiles = [
      ...(data.cn_encryption.bytecode.files ?? []),
      ...(data.cn_encryption.obfuscate.files ?? []),
    ];

    const encryptionDirs = [
      ...(data.cn_encryption.bytecode.directories ?? []),
      ...(data.cn_encryption.obfuscate.directories ?? []),
    ];

    const wronglyEncrypted: string[] = [];
    for (const s2Path of section2Paths) {
      if (allEncryptionFiles.includes(s2Path)) {
        wronglyEncrypted.push(s2Path);
      } else if (encryptionDirs.some((d) => s2Path.startsWith(d))) {
        wronglyEncrypted.push(s2Path);
      }
    }

    expect(
      wronglyEncrypted,
      `These section2 (modified upstream) files should NOT be in cn_encryption:\n${wronglyEncrypted.join("\n")}`,
    ).toHaveLength(0);
  });
});
