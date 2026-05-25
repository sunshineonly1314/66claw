/**
 * Merge protection consistency tests.
 *
 * Verifies that config/cn-protected-files.json and .gitattributes
 * are in sync — every file in the JSON should have a merge=ours
 * entry in .gitattributes.
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
