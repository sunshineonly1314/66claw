import { defineConfig } from "tsdown";

const env = {
  NODE_ENV: "production",
};

/** Native addons that cannot be bundled by rolldown. */
const external = ["sherpa-onnx-node"];

/**
 * Packages that must remain as require() calls in the plugin-sdk bundle.
 *
 * @whiskeysockets/baileys is used by the WhatsApp onboarding adapter
 * (exported from plugin-sdk). Desktop builds strip baileys from node_modules
 * (it has git+ssh sub-deps unreachable in CN CI), so the plugin-sdk bundle
 * must NOT inline it — otherwise every plugin that loads plugin-sdk crashes
 * with "Cannot find module '@whiskeysockets/baileys'" even if the plugin
 * itself has nothing to do with WhatsApp.
 *
 * A stub package is injected by prepare-resources.{sh,ps1} so the require()
 * resolves to a no-op at runtime in desktop builds.
 */
const pluginSdkExternal = [...external, "@whiskeysockets/baileys"];

export default defineConfig([
  {
    entry: "src/index.ts",
    env,
    external,
    fixedExtension: false,
    platform: "node",
  },
  {
    entry: "src/entry.ts",
    env,
    external,
    fixedExtension: false,
    platform: "node",
  },
  {
    // Ensure this module is bundled as an entry so legacy CLI shims can resolve its exports.
    entry: "src/cli/daemon-cli.ts",
    env,
    external,
    fixedExtension: false,
    platform: "node",
  },
  {
    entry: "src/infra/warning-filter.ts",
    env,
    external,
    fixedExtension: false,
    platform: "node",
  },
  {
    entry: "src/plugin-sdk/index.ts",
    outDir: "dist/plugin-sdk",
    env,
    external: pluginSdkExternal,
    fixedExtension: false,
    platform: "node",
  },
  {
    entry: "src/plugin-sdk/account-id.ts",
    outDir: "dist/plugin-sdk",
    env,
    external,
    fixedExtension: false,
    platform: "node",
  },
  {
    entry: "src/extensionAPI.ts",
    env,
    external,
    fixedExtension: false,
    platform: "node",
  },
  {
    entry: ["src/hooks/bundled/*/handler.ts", "src/hooks/llm-slug-generator.ts"],
    env,
    external,
    fixedExtension: false,
    platform: "node",
  },
]);
