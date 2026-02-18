import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultSrcDir = path.join(repoRoot, "src", "canvas-host", "a2ui");
const defaultOutDir = path.join(repoRoot, "dist", "canvas-host", "a2ui");

export async function copyA2uiAssets(params?: { srcDir?: string; outDir?: string }) {
  const src = params?.srcDir ?? defaultSrcDir;
  const out = params?.outDir ?? defaultOutDir;
  await fs.stat(path.join(src, "index.html")).catch(() => {
    throw new Error(
      `Missing a2ui assets in ${src}. Run "pnpm canvas:a2ui:bundle" first.`,
    );
  });
  await fs.stat(path.join(src, "a2ui.bundle.js")).catch(() => {
    throw new Error(
      `Missing a2ui bundle in ${src}. Run "pnpm canvas:a2ui:bundle" first.`,
    );
  });
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.cp(src, out, { recursive: true });
}

async function main() {
  await copyA2uiAssets();
}

main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});
