const { transformSync } = require("esbuild");
const fs = require("fs");
const path = require("path");

const EXTS = ["agent-team", "orchestrator", "dingtalk", "feishu", "openclawwechat", "memory-core"];
const ROOT = "E:/openclawcn";
const SKIP = [/\.test\.ts$/, /\.spec\.ts$/, /\.d\.ts$/, /__tests__/, /\/guided\/__test__/];

function findTs(dir) {
  const files = [];
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const fp = path.join(dir, e.name);
      if (e.name === "node_modules" || e.name === "__bytenode_backup") continue;
      if (e.isDirectory()) files.push(...findTs(fp));
      else if (e.name.endsWith(".ts") && !SKIP.some((p) => p.test(fp))) files.push(fp);
    }
  } catch (_) {}
  return files;
}

// Detect whether a compiled .js will be loaded via native require() (CJS) or jiti (ESM-capable).
// A bytecode-packed extension has a sibling .jsc file next to index.js; the loader uses
// native require() for those, which cannot handle ESM syntax (ERR_REQUIRE_ESM).
// Sub-files inside src/ are always required transitively from the CJS entry, so they must
// also be CJS.  Non-bytecode extensions are loaded by jiti (ESM-OK), but we compile them
// as CJS too for consistency and to avoid edge cases with dynamic import() inside jiti.
const FORMAT = "cjs";

let ok = 0;
let fail = 0;
for (const ext of EXTS) {
  const extDir = path.join(ROOT, "extensions", ext);
  if (!fs.existsSync(extDir)) {
    console.log(ext + ": directory not found, skipping");
    continue;
  }

  const indexTs = path.join(extDir, "index.ts");
  const srcDir = path.join(extDir, "src");
  const allTs = [];
  if (fs.existsSync(indexTs)) allTs.push(indexTs);
  if (fs.existsSync(srcDir)) allTs.push(...findTs(srcDir));

  if (allTs.length === 0) {
    console.log(ext + ": no .ts files found");
    continue;
  }

  let extOk = 0;
  let extFail = 0;
  for (const tsFile of allTs) {
    try {
      const code = fs.readFileSync(tsFile, "utf-8");
      const result = transformSync(code, {
        loader: "ts",
        format: FORMAT,
        platform: "node",
        target: "es2022",
        sourcefile: tsFile,
        // Keep dynamic import() calls intact so lazy imports work at runtime
        // (esbuild converts them to require() in CJS mode automatically)
      });
      if (result.warnings && result.warnings.length > 0) {
        for (const w of result.warnings) {
          console.log("WARN:", path.relative(ROOT, tsFile), w.text);
        }
      }
      const jsFile = tsFile.replace(/\.ts$/, ".js");
      fs.writeFileSync(jsFile, result.code, "utf-8");
      extOk++;
      ok++;
    } catch (err) {
      const msg = err && err.message ? err.message.split("\n")[0] : String(err);
      console.error("FAIL:", path.relative(ROOT, tsFile), msg);
      extFail++;
      fail++;
    }
  }
  console.log(ext + ": compiled " + extOk + "/" + allTs.length + " files" + (extFail > 0 ? " (" + extFail + " failed)" : ""));
}
console.log("Total: " + ok + " OK, " + fail + " FAIL");
if (fail > 0) process.exit(1);
