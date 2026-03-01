#!/usr/bin/env node
/**
 * Sync All Skills from ClawdSkillsProxy
 *
 * Downloads ALL remote skills to the local `skills/` directory so that
 * production builds ship with every skill bundled (no remote dependency).
 *
 * Usage:
 *   pnpm tsx scripts/sync-all-skills.ts
 *   pnpm tsx scripts/sync-all-skills.ts --dry-run   # preview only
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  fetchProxySkillsIndex,
  getDefaultProxyConfig,
  installProxySkillsBatch,
} from "../src/agents/skills/clawdskillsproxy-registry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SKILLS_DIR = path.join(ROOT, "skills");
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log("=== Sync All Skills from ClawdSkillsProxy ===\n");

  // 1. Get proxy config
  const config = getDefaultProxyConfig();
  if (!config) {
    console.error("ERROR: ClawdSkillsProxy not configured. Set OPENCLAWCN_SKILLS_PROXY_URL and OPENCLAWCN_SKILLS_PROXY_TOKEN.");
    process.exit(1);
  }

  // 2. Fetch remote index
  console.log("Fetching remote skills index...");
  const result = await fetchProxySkillsIndex(config);
  if (!result.ok) {
    console.error("ERROR: Failed to fetch index:", result.error);
    process.exit(1);
  }

  const remoteSkills = result.index!.skills;
  console.log(`Remote skills: ${remoteSkills.length}`);

  // 3. Check which are already bundled locally
  const bundledDirs = new Set(
    fs.existsSync(SKILLS_DIR)
      ? fs.readdirSync(SKILLS_DIR).filter((d) => !d.startsWith("."))
      : [],
  );
  console.log(`Already bundled: ${bundledDirs.size}`);

  // 4. Find missing — use `path` (skillId) as the canonical identifier,
  //    since that's what the server uses for storage and download.
  const missing = remoteSkills.filter((s) => {
    const skillId = s.path || s.name;
    return !bundledDirs.has(skillId);
  });
  console.log(`Missing (to download): ${missing.length}\n`);

  if (missing.length === 0) {
    console.log("All skills are already bundled. Nothing to do.");
    return;
  }

  if (DRY_RUN) {
    console.log("DRY RUN - would download:");
    for (const s of missing) {
      console.log(`  - ${s.name || s.path}`);
    }
    return;
  }

  // 5. Batch download missing skills to skills/ directory
  //    Use `path` (skillId) — this is the key the server uses for downloads.
  const missingNames = missing.map((s) => s.path || s.name);

  // Split into batches of 50 for progress reporting
  const BATCH = 50;
  let totalInstalled = 0;
  let totalFailed = 0;
  const allFailed: Array<{ name: string; error: string }> = [];

  for (let i = 0; i < missingNames.length; i += BATCH) {
    const batch = missingNames.slice(i, i + BATCH);
    const batchNum = Math.floor(i / BATCH) + 1;
    const totalBatches = Math.ceil(missingNames.length / BATCH);
    console.log(`Batch ${batchNum}/${totalBatches}: downloading ${batch.length} skills...`);

    const batchResult = await installProxySkillsBatch(batch, config, SKILLS_DIR);
    totalInstalled += batchResult.installed.length;
    totalFailed += batchResult.failed.length;
    allFailed.push(...batchResult.failed);

    console.log(`  installed: ${batchResult.installed.length}, failed: ${batchResult.failed.length}`);
  }

  console.log(`\n=== Done ===`);
  console.log(`Installed: ${totalInstalled}`);
  console.log(`Failed: ${totalFailed}`);

  if (allFailed.length > 0) {
    console.log(`\nFailed skills:`);
    for (const f of allFailed) {
      console.log(`  - ${f.name}: ${f.error}`);
    }
  }

  // 6. Final count
  const finalCount = fs.readdirSync(SKILLS_DIR).filter((d) => !d.startsWith(".")).length;
  console.log(`\nTotal skills in skills/: ${finalCount}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
