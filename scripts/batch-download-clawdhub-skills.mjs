#!/usr/bin/env node
/**
 * Batch download all ClawdHub skills to a local directory (no install into clawdbot).
 * Uses GET /api/v1/download?slug=&tag=latest, unzips into CLAWDHUB_MIRROR/skills/<slug>/.
 * Writes download-report.json for classify script and network-failed handling.
 *
 * Usage: node scripts/batch-download-clawdhub-skills.mjs
 * Env:   CLAWDHUB_MIRROR (default ./clawdhub-skills-mirror)
 *        CLAWDHUB_REGISTRY (default https://clawdhub.com)
 *        CLAWDHUB_DELAY_MS (default 1500, delay between requests)
 */

import fs from "node:fs";
import path from "node:path";

const REGISTRY = process.env.CLAWDHUB_REGISTRY || "https://clawdhub.com";
const MIRROR = path.resolve(process.env.CLAWDHUB_MIRROR || "clawdhub-skills-mirror");
const DELAY_MS = Number(process.env.CLAWDHUB_DELAY_MS) || 1500;
const SKILLS_DIR = path.join(MIRROR, "skills");
const REPORT_PATH = path.join(MIRROR, "download-report.json");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchAllSlugs() {
  const slugs = [];
  let cursor = null;
  while (true) {
    const url =
      `${REGISTRY}/api/v1/skills?limit=100` +
      (cursor ? "&cursor=" + encodeURIComponent(cursor) : "");
    const res = await fetch(url);
    if (!res.ok) throw new Error(`list skills: ${res.status} ${res.statusText}`);
    const data = await res.json();
    const items = data.items || [];
    for (const it of items) if (it.slug) slugs.push(it.slug);
    cursor = data.nextCursor || null;
    if (!cursor || items.length === 0) break;
  }
  return slugs;
}

async function unzipBufferToDir(buffer, outDir) {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) {
      fs.mkdirSync(path.join(outDir, name), { recursive: true });
      continue;
    }
    const buf = await entry.async("nodebuffer");
    const dest = path.join(outDir, name);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
  }
}

async function downloadOne(slug) {
  const url = `${REGISTRY}/api/v1/download?slug=${encodeURIComponent(slug)}&tag=latest`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    return { ok: false, status: res.status, message: res.statusText };
  }
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("zip") && !ct.includes("octet-stream")) {
    const text = await res.text();
    return { ok: false, status: res.status, message: text.slice(0, 200) };
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const outDir = path.join(SKILLS_DIR, slug);
  fs.mkdirSync(outDir, { recursive: true });
  await unzipBufferToDir(buf, outDir);
  return { ok: true };
}

async function main() {
  fs.mkdirSync(SKILLS_DIR, { recursive: true });

  let slugs = [];
  try {
    console.log("Fetching slug list from", REGISTRY, "...");
    slugs = await fetchAllSlugs();
    console.log("Total slugs:", slugs.length);
  } catch (e) {
    console.error("Failed to fetch slug list:", e.message);
    process.exit(1);
  }

  const report = { ok: [], failed: [], ts: new Date().toISOString() };
  const skipIfExists = true;

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    const skillDir = path.join(SKILLS_DIR, slug);
    const hasSkillMd = fs.existsSync(path.join(skillDir, "SKILL.md"));

    if (skipIfExists && hasSkillMd) {
      report.ok.push(slug);
      if ((i + 1) % 50 === 0) console.log(`[${i + 1}/${slugs.length}] skipped (exists): ${slug}`);
      continue;
    }

    try {
      const result = await downloadOne(slug);
      if (result.ok) {
        report.ok.push(slug);
      } else {
        report.failed.push({
          slug,
          status: result.status,
          message: (result.message || "").slice(0, 300),
        });
      }
    } catch (err) {
      report.failed.push({
        slug,
        status: "error",
        message: (err?.message || String(err)).slice(0, 300),
      });
    }

    if ((i + 1) % 20 === 0 || i === slugs.length - 1) {
      console.log(`[${i + 1}/${slugs.length}] ok=${report.ok.length} failed=${report.failed.length}`);
    }
    if (i < slugs.length - 1) await sleep(DELAY_MS);
  }

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
  console.log("\nDone. Mirror:", MIRROR);
  console.log("OK:", report.ok.length, "Failed:", report.failed.length);
  console.log("Report:", REPORT_PATH);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
