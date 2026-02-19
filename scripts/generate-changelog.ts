#!/usr/bin/env node
/**
 * Changelog Generator
 *
 * 将 versionrecord.md（agent 技术日志）转换为用户可读的 CHANGELOG.md
 *
 * Usage:
 *   pnpm release:changelog                        # 生成 CHANGELOG.md
 *   pnpm release:changelog --version 2026.2.18    # 指定当前版本号
 *   pnpm release:changelog --format json          # 输出 JSON（供 manifest 使用）
 *   pnpm release:changelog --dry-run              # 预览不写入文件
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { parseArgs } from "node:util";

// ============================================================================
// Types
// ============================================================================

interface VersionRecordEntry {
  timestamp: string; // "2026-02-18 01:00"
  versionTag?: string; // from <!-- version: X.Y.Z --> comment
  sections: SectionEntry[];
}

interface SectionEntry {
  category: string; // "New Feature", "Bug Fix", etc.
  items: ItemEntry[];
}

interface ItemEntry {
  title: string; // bold title
  description: string; // one-line description
}

interface ChangelogVersion {
  version: string;
  date?: string;
  unreleased: boolean;
  categories: Map<string, ItemEntry[]>;
}

interface ChangelogOutput {
  versions: Array<{
    version: string;
    date?: string;
    unreleased: boolean;
    categories: Record<string, Array<{ title: string; description: string }>>;
  }>;
}

// ============================================================================
// Category mapping: technical → user-facing (Chinese)
// ============================================================================

const CATEGORY_MAP: Record<string, string> = {
  "New Feature": "新功能",
  "Enhancement": "改进",
  "Bug Fix": "修复",
  "Refactor": "改进", // 用户角度看重构也是改进
  "Performance": "性能优化",
  "UI/UX": "界面优化",
  "Config": "配置",
  "Security": "安全",
  "Build": "构建",
};

// Categories to exclude from user-facing changelog
const EXCLUDED_CATEGORIES = new Set([
  "Test",
  "Docs",
  "Architecture",
  "Research",
  "Files Changed",
  "Files New",
  "Files Modified",
]);

// Section headers to skip entirely
const EXCLUDED_SECTION_PREFIXES = [
  "Files Changed",
  "Files New",
  "Files Modified",
  "Test",
  "Architecture",
  "Research",
];

// ============================================================================
// Parser: versionrecord.md → structured entries
// ============================================================================

function parseVersionRecord(content: string): VersionRecordEntry[] {
  const entries: VersionRecordEntry[] = [];
  const lines = content.split("\n");
  let currentEntry: VersionRecordEntry | null = null;
  let currentSection: SectionEntry | null = null;
  let insideExcludedSection = false;
  let insideCodeBlock = false;
  let insideTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track code blocks
    if (line.trim().startsWith("```")) {
      insideCodeBlock = !insideCodeBlock;
      continue;
    }
    if (insideCodeBlock) continue;

    // Track table blocks (lines starting with |)
    if (line.trim().startsWith("|")) {
      insideTable = true;
      continue;
    } else if (insideTable && line.trim() === "") {
      insideTable = false;
      continue;
    }
    if (insideTable) continue;

    // H2: timestamp entry header (## 2026-02-18 01:00)
    const h2Match = line.match(/^## (\d{4}-\d{2}-\d{2} \d{2}:\d{2})/);
    if (h2Match) {
      if (currentEntry) entries.push(currentEntry);
      currentEntry = {
        timestamp: h2Match[1],
        sections: [],
      };
      currentSection = null;
      insideExcludedSection = false;

      // Check next line for version tag comment
      const nextLine = lines[i + 1];
      if (nextLine) {
        const versionTagMatch = nextLine.match(
          /<!--\s*version:\s*([\d.]+)\s*-->/
        );
        if (versionTagMatch) {
          currentEntry.versionTag = versionTagMatch[1];
        }
      }
      continue;
    }

    if (!currentEntry) continue;

    // H3: category header (### New Feature)
    const h3Match = line.match(/^### (.+)/);
    if (h3Match) {
      const categoryRaw = h3Match[1].trim();
      // Strip trailing info like "(3 轮审计，共 14 个 bug)"
      const category = categoryRaw.split("（")[0].split("(")[0].trim();

      // Check if this section should be excluded
      insideExcludedSection = EXCLUDED_SECTION_PREFIXES.some(
        (prefix) =>
          category.startsWith(prefix) || EXCLUDED_CATEGORIES.has(category)
      );

      if (!insideExcludedSection) {
        currentSection = { category, items: [] };
        currentEntry.sections.push(currentSection);
      } else {
        currentSection = null;
      }
      continue;
    }

    // H4: sub-header (#### xxx) — skip
    if (line.startsWith("####")) continue;

    // Skip excluded sections
    if (insideExcludedSection) continue;
    if (!currentSection) continue;

    // Bullet items: - **title** — description
    const itemMatch = line.match(
      /^- \*\*(.+?)\*\*\s*[—–\-]\s*(.+)/
    );
    if (itemMatch) {
      let title = itemMatch[1].trim();
      const description = itemMatch[2].trim();

      // Clean up technical bug ID prefixes like [R1-BUG-2], [#2], [Fix], [设计缺陷-1]
      title = title.replace(/^\[.*?\]\s*/, "");

      // Skip items with overly technical titles (file paths, function names)
      if (
        title.includes(".ts") ||
        title.includes(".js") ||
        title.includes("src/") ||
        title.includes("test.ts")
      ) {
        continue;
      }

      currentSection.items.push({
        title,
        description,
      });
      continue;
    }

    // Simple bullet items without bold: - description
    const simpleBulletMatch = line.match(/^- (.+)/);
    if (simpleBulletMatch && !line.startsWith("- **")) {
      const desc = simpleBulletMatch[1].trim();
      // Skip items that look like file paths, code, or raw metrics
      if (
        desc.startsWith("`") ||
        desc.includes(".ts") ||
        desc.includes(".js") ||
        desc.includes("src/") ||
        desc.match(/\d+ms/) || // Performance metrics like "平均 5.45ms"
        desc.match(/QPS\s*\d/) ||
        desc.match(/entries\/sec/) ||
        desc.match(/\d+[xX]\d+/) || // Dimension specs like "9535×1024"
        desc.match(/brute-force|embedding API/)
      ) {
        continue;
      }
      currentSection.items.push({
        title: "",
        description: desc,
      });
    }
  }

  if (currentEntry) entries.push(currentEntry);
  return entries;
}

// ============================================================================
// Git tag → version/date mapping
// ============================================================================

interface VersionTag {
  version: string;
  date: string; // YYYY-MM-DD
  timestamp: number;
}

function getVersionTags(): VersionTag[] {
  try {
    // Get tags with dates
    const output = execSync(
      'git tag -l "v*" --format="%(refname:short)|%(creatordate:short)"',
      { encoding: "utf-8" }
    ).trim();

    if (!output) return [];

    return output
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [tag, date] = line.split("|");
        const version = tag.replace(/^v/, "");
        return {
          version,
          date: date || "",
          timestamp: date ? new Date(date).getTime() : 0,
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp); // newest first
  } catch {
    return [];
  }
}

// ============================================================================
// Group entries by version
// ============================================================================

function groupByVersion(
  entries: VersionRecordEntry[],
  currentVersion: string
): ChangelogVersion[] {
  const tags = getVersionTags();
  const versions = new Map<string, ChangelogVersion>();

  // Sort entries by timestamp (oldest first for processing)
  const sortedEntries = [...entries].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp)
  );

  for (const entry of sortedEntries) {
    let version: string;
    let isUnreleased = false;

    if (entry.versionTag) {
      // Explicit version tag from <!-- version: X.Y.Z -->
      version = entry.versionTag;
    } else {
      // Find which version this timestamp falls into
      const entryTime = new Date(
        entry.timestamp.replace(" ", "T") + ":00"
      ).getTime();
      const matchingTag = tags.find((t) => t.timestamp <= entryTime);

      if (matchingTag) {
        // Check if there's a newer tag after this one
        const newerTag = tags.find(
          (t) => t.timestamp > matchingTag.timestamp && t.timestamp <= entryTime
        );
        if (newerTag) {
          version = newerTag.version;
        } else {
          // Entry is after the latest tag → unreleased
          version = currentVersion;
          isUnreleased = true;
        }
      } else {
        // No tags exist or entry is before all tags
        version = currentVersion;
        isUnreleased = true;
      }
    }

    if (!versions.has(version)) {
      const tag = tags.find((t) => t.version === version);
      versions.set(version, {
        version,
        date: tag?.date,
        unreleased: isUnreleased,
        categories: new Map(),
      });
    }

    const versionGroup = versions.get(version)!;

    for (const section of entry.sections) {
      const userCategory =
        CATEGORY_MAP[section.category] || CATEGORY_MAP["Enhancement"];

      if (!versionGroup.categories.has(userCategory)) {
        versionGroup.categories.set(userCategory, []);
      }

      const items = versionGroup.categories.get(userCategory)!;
      for (const item of section.items) {
        // Deduplicate by title
        if (item.title && items.some((i) => i.title === item.title)) continue;
        items.push(item);
      }
    }
  }

  // Sort versions: unreleased first, then by version descending
  return Array.from(versions.values()).sort((a, b) => {
    if (a.unreleased && !b.unreleased) return -1;
    if (!a.unreleased && b.unreleased) return 1;
    return b.version.localeCompare(a.version, undefined, { numeric: true });
  });
}

// ============================================================================
// Render: versions → CHANGELOG.md
// ============================================================================

// Category display order (most important first)
const CATEGORY_ORDER = [
  "新功能",
  "改进",
  "修复",
  "界面优化",
  "性能优化",
  "安全",
  "配置",
  "构建",
];

function renderMarkdown(versions: ChangelogVersion[]): string {
  const lines: string[] = [];
  lines.push("# 更新日志");
  lines.push("");
  lines.push(
    "> 此文件由 `pnpm release:changelog` 从 versionrecord.md 自动生成。"
  );
  lines.push("");

  for (const ver of versions) {
    // Version header
    if (ver.unreleased) {
      lines.push(`## ${ver.version} (未发布)`);
    } else if (ver.date) {
      lines.push(`## ${ver.version} (${ver.date})`);
    } else {
      lines.push(`## ${ver.version}`);
    }
    lines.push("");

    // Categories in defined order
    const orderedCategories = CATEGORY_ORDER.filter((c) =>
      ver.categories.has(c)
    );
    // Add any categories not in the predefined order
    for (const c of ver.categories.keys()) {
      if (!orderedCategories.includes(c)) {
        orderedCategories.push(c);
      }
    }

    for (const category of orderedCategories) {
      const items = ver.categories.get(category);
      if (!items || items.length === 0) continue;

      lines.push(`### ${category}`);

      for (const item of items) {
        if (item.title) {
          lines.push(`- ${item.title} — ${item.description}`);
        } else {
          lines.push(`- ${item.description}`);
        }
      }
      lines.push("");
    }

    lines.push("---");
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

function renderJson(versions: ChangelogVersion[]): ChangelogOutput {
  return {
    versions: versions.map((ver) => ({
      version: ver.version,
      date: ver.date,
      unreleased: ver.unreleased,
      categories: Object.fromEntries(
        Array.from(ver.categories.entries()).map(([cat, items]) => [
          cat,
          items.map((i) => ({ title: i.title, description: i.description })),
        ])
      ),
    })),
  };
}

// ============================================================================
// Version marker injection into versionrecord.md
// ============================================================================

function injectVersionMarker(
  versionRecordPath: string,
  version: string
): void {
  const content = fs.readFileSync(versionRecordPath, "utf-8");
  const lines = content.split("\n");

  // Find the first ## entry that doesn't already have a version marker
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^## \d{4}-\d{2}-\d{2}/)) {
      const nextLine = lines[i + 1] || "";
      if (!nextLine.includes("<!-- version:")) {
        // Insert version marker after the ## line
        lines.splice(i + 1, 0, `<!-- version: ${version} -->`);
        break;
      } else {
        // Already has a version marker, stop
        break;
      }
    }
  }

  fs.writeFileSync(versionRecordPath, lines.join("\n"), "utf-8");
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const { values } = parseArgs({
    options: {
      version: { type: "string", short: "v" },
      format: { type: "string", short: "f", default: "markdown" },
      "dry-run": { type: "boolean", default: false },
      "inject-marker": { type: "boolean", default: false },
    },
  });

  const rootDir = process.cwd();
  const versionRecordPath = path.join(rootDir, "versionrecord.md");
  const changelogPath = path.join(rootDir, "CHANGELOG.md");

  // Determine version
  let currentVersion = values.version as string;
  if (!currentVersion) {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(rootDir, "package.json"), "utf-8")
    );
    currentVersion = pkg.version;
  }

  console.log(`Changelog Generator`);
  console.log(`  Version: ${currentVersion}`);
  console.log(`  Format: ${values.format}`);
  console.log("");

  // Read versionrecord.md
  if (!fs.existsSync(versionRecordPath)) {
    console.error(`versionrecord.md not found at: ${versionRecordPath}`);
    process.exit(1);
  }

  const versionRecordContent = fs.readFileSync(versionRecordPath, "utf-8");

  // Parse
  console.log("1. Parsing versionrecord.md...");
  const entries = parseVersionRecord(versionRecordContent);
  console.log(`   Found ${entries.length} entries`);

  // Count total items across all entries
  let totalItems = 0;
  for (const entry of entries) {
    for (const section of entry.sections) {
      totalItems += section.items.length;
    }
  }
  console.log(`   Total items (after filtering): ${totalItems}`);

  // Group by version
  console.log("2. Grouping by version...");
  const versions = groupByVersion(entries, currentVersion);
  console.log(`   Grouped into ${versions.length} version(s)`);

  // Render
  console.log("3. Rendering...");

  if (values.format === "json") {
    const jsonOutput = renderJson(versions);
    if (values["dry-run"]) {
      console.log(JSON.stringify(jsonOutput, null, 2));
    } else {
      const jsonPath = path.join(rootDir, "CHANGELOG.json");
      fs.writeFileSync(jsonPath, JSON.stringify(jsonOutput, null, 2), "utf-8");
      console.log(`   Written to: ${jsonPath}`);
    }
  } else {
    const markdown = renderMarkdown(versions);
    if (values["dry-run"]) {
      console.log("");
      console.log("=== Preview ===");
      console.log(markdown);
    } else {
      fs.writeFileSync(changelogPath, markdown, "utf-8");
      console.log(`   Written to: ${changelogPath}`);
    }
  }

  // Inject version marker if requested
  if (values["inject-marker"]) {
    console.log("4. Injecting version marker into versionrecord.md...");
    injectVersionMarker(versionRecordPath, currentVersion);
    console.log(`   Injected <!-- version: ${currentVersion} -->`);
  }

  console.log("");
  console.log("Done!");
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
