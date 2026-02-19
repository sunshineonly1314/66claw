import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));

function normalizeBase(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "/";
  if (trimmed === "./") return "./";
  if (trimmed.endsWith("/")) return trimmed;
  return `${trimmed}/`;
}

export default defineConfig(({ command }) => {
  const envBase = process.env.CLAWDBOT_CONTROL_UI_BASE_PATH?.trim();
  const base = envBase ? normalizeBase(envBase) : "./";
  return {
    base,
    publicDir: path.resolve(here, "public"),
    optimizeDeps: {
      include: ["lit/directives/repeat.js"],
    },
    build: {
      outDir: path.resolve(here, "../dist/control-ui"),
      emptyOutDir: true,
      // Source maps disabled in production builds to prevent reverse engineering.
      // Only enable in dev mode for debugging.
      sourcemap: command === "serve",
    },
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      proxy: {
        // Dev mode: proxy /api/ requests to Gateway so token auto-discovery works
        "/api": {
          target: "http://127.0.0.1:18789",
          changeOrigin: true,
        },
      },
    },
  };
});
