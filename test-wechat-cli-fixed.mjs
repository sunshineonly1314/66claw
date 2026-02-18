/**
 * Test wechat_read via spawning openclawcn agent command
 * Fixed: added --session-id parameter
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
    "--session-id",
    "test-wechat-read",
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
  }

  // Show last 100 lines of output
  const stdoutLines = stdout.split("\n");
  const stderrLines = stderr.split("\n");

  if (stdoutLines.length > 100) {
    console.log("\n--- STDOUT (last 100 lines) ---");
    console.log(stdoutLines.slice(-100).join("\n"));
  } else if (stdout) {
    console.log("\n--- STDOUT ---");
    console.log(stdout);
  }

  if (stderrLines.length > 100) {
    console.log("\n--- STDERR (last 100 lines) ---");
    console.log(stderrLines.slice(-100).join("\n"));
  } else if (stderr) {
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
