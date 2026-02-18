/**
 * Complete test: wechat_read tool with qwen-max vision
 */

import { runHelper } from "./dist/tools-desktop-control-BhC21hkz.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

console.log("=== WeChat Read Test ===\n");

// Step 1: Test focus
console.log("Step 1: Testing window focus...");
const listOut = runHelper(["-Action", "list_windows"], 8000);
const lines = listOut.split(/\r?\n/).filter(Boolean);

console.log(`Found ${lines.length} windows:`);
for (const line of lines.slice(0, 10)) {
  const [title] = line.split("|||");
  console.log(`  - ${title}`);
}

const wechatLine = lines.find(l => {
  const [title] = l.split("|||");
  return title === "微信" || title === "WeChat";
});

if (!wechatLine) {
  console.error("❌ WeChat window not found!");
  process.exit(1);
}

const [title, , x, y, w, h] = wechatLine.split("|||");
console.log(`✓ Found WeChat: ${title} at (${x},${y}) ${w}×${h}\n`);

// Step 2: Test focus
console.log("Step 2: Focusing WeChat...");
const focusResult = runHelper(["-Action", "focus", "-Window", title], 5000);
console.log(`Focus result: ${focusResult}\n`);

await new Promise(r => setTimeout(r, 2000));

// Step 3: Take screenshot
console.log("Step 3: Taking screenshot...");
const tmpPath = path.join(os.tmpdir(), `wechat-test-${Date.now()}.png`);
const screenshotResult = runHelper(["-Action", "screenshot", "-OutputPath", tmpPath], 15000);
console.log(`Screenshot result: ${screenshotResult}`);

if (fs.existsSync(tmpPath)) {
  const size = fs.statSync(tmpPath).size;
  console.log(`✓ Screenshot saved: ${tmpPath} (${(size/1024).toFixed(2)} KB)\n`);
} else {
  console.error("❌ Screenshot failed!");
  process.exit(1);
}

// Step 4: Test qwen-max vision API
console.log("Step 4: Testing qwen-max vision...");
const imageBuffer = fs.readFileSync(tmpPath);
const base64Image = imageBuffer.toString("base64");

const response = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer sk-c44f643a792a448cb474e89970509f10",
  },
  body: JSON.stringify({
    model: "qwen-max",
    messages: [{
      role: "user",
      content: [
        { type: "text", text: "这是什么窗口？请简单描述截图内容。" },
        { type: "image_url", image_url: { url: `data:image/png;base64,${base64Image}` } },
      ],
    }],
    max_tokens: 500,
  }),
});

if (!response.ok) {
  const error = await response.text();
  console.error(`❌ Qwen API failed: ${response.status} ${error}`);
  process.exit(1);
}

const data = await response.json();
console.log("✅ Qwen vision analysis:");
console.log(data.choices[0].message.content);
console.log(`\nUsage: ${JSON.stringify(data.usage)}`);

console.log("\n=== All tests passed! ===");
