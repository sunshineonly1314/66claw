/**
 * Profile overlay: automatically merges environment-specific config files
 * on top of the base config, similar to Spring Boot's application-{profile}.yml.
 *
 * File convention (same directory as base config):
 *   openclawcn.json           ← base config
 *   openclawcn.dev.json       ← dev profile overlay
 *   openclawcn.prod.json      ← production overlay
 *   openclawcn.local.json     ← local overrides (always loaded last, never committed)
 */

import path from "node:path";
import { deepMerge } from "./includes.js";

export type OverlayDeps = {
  fs: { existsSync(p: string): boolean; readFileSync(p: string, enc: "utf-8"): string };
  json5: { parse(raw: string): unknown };
  env: NodeJS.ProcessEnv;
  logger: Pick<typeof console, "warn">;
};

function resolveOverlayPath(configPath: string, suffix: string): string {
  const dir = path.dirname(configPath);
  const ext = path.extname(configPath);
  const base = path.basename(configPath, ext);
  return path.join(dir, `${base}.${suffix}${ext}`);
}

function tryLoadOverlay(
  overlayPath: string,
  deps: OverlayDeps,
): unknown {
  if (!deps.fs.existsSync(overlayPath)) {
    return {};
  }
  try {
    const raw = deps.fs.readFileSync(overlayPath, "utf-8");
    return deps.json5.parse(raw);
  } catch (err) {
    deps.logger.warn(`Failed to load profile overlay ${overlayPath}: ${String(err)}`);
    return {};
  }
}

export function applyProfileOverlay(
  config: unknown,
  configPath: string,
  deps: OverlayDeps,
): unknown {
  const profile = deps.env.OPENCLAWCN_PROFILE?.trim().toLowerCase();
  let result = config;

  // Layer 1: profile-specific overlay (e.g. openclawcn.dev.json)
  if (profile && profile !== "default") {
    const profilePath = resolveOverlayPath(configPath, profile);
    const overlay = tryLoadOverlay(profilePath, deps);
    if (overlay && typeof overlay === "object" && Object.keys(overlay as object).length > 0) {
      deps.logger.warn(`Loaded profile overlay: ${profilePath}`);
      result = deepMerge(result, overlay);
    }
  }

  // Layer 2: local overlay (openclawcn.local.json) — always loaded last
  const localPath = resolveOverlayPath(configPath, "local");
  const localOverlay = tryLoadOverlay(localPath, deps);
  if (localOverlay && typeof localOverlay === "object" && Object.keys(localOverlay as object).length > 0) {
    deps.logger.warn(`Loaded local overlay: ${localPath}`);
    result = deepMerge(result, localOverlay);
  }

  return result;
}
