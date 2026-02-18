/**
 * Test wechat_read via spawning openclawcn agent command
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log("=== Testing wechat_read via CLI ===\n");

const proc = spawn(
  "node",
  [
    "dist/index.js",
    "agent",
    "--message",
    "使用 wechat_read 工具读取 TecBin 的最近5条微信消息",
    "--timeout",
    "120000",
  ],
  {
    cwd: __dirname,
    stdio: ["pipe", "pipe", "pipe"],
    shell: false,
  }
);

let stdout = "";
let stderr = "";

proc.stdout.on("data", (chunk) => {
  const str = chunk.toString();
  stdout += str;
  process.stdout.write(str);
});

proc.stderr.on("data", (chunk) => {
  const str = chunk.toString();
  stderr += str;
  process.stderr.write(str);
});

proc.on("close", (code) => {
  console.log(`\n\n=== Process exited with code ${code} ===`);

  if (code === 0) {
    console.log("✅ Test passed!");
  } else {
    console.log("❌ Test failed!");
    console.log("\n--- STDOUT ---");
    console.log(stdout);
    console.log("\n--- STDERR ---");
    console.log(stderr);
  }

  process.exit(code);
});

// Timeout after 130s
setTimeout(() => {
  console.error("\n❌ Test timeout (130s)");
  proc.kill("SIGTERM");
  process.exit(1);
}, 130000);
