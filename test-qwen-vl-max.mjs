/**
 * Test qwen-vl-max (vision model) instead of qwen-max
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const QWEN_API_KEY = "sk-c44f643a792a448cb474e89970509f10";
const QWEN_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const QWEN_MODEL = "qwen-vl-max"; // ← Vision专用模型

console.log("=== Testing qwen-vl-max Vision ===\n");

// Find latest screenshot
const tmpDir = os.tmpdir();
const files = fs.readdirSync(tmpDir);
const screenshots = files
  .filter((f) => f.startsWith("wechat-read-") && f.endsWith(".png"))
  .map((f) => ({
    name: f,
    path: path.join(tmpDir, f),
    mtime: fs.statSync(path.join(tmpDir, f)).mtime,
  }))
  .sort((a, b) => b.mtime - a.mtime);

if (screenshots.length === 0) {
  console.error("❌ No screenshots found");
  process.exit(1);
}

const screenshot = screenshots[0];
console.log(`✓ Screenshot: ${screenshot.name}`);
console.log(`  Size: ${(fs.statSync(screenshot.path).size / 1024).toFixed(2)} KB\n`);

const imageBuffer = fs.readFileSync(screenshot.path);
const base64Image = imageBuffer.toString("base64");

console.log(`Testing ${QWEN_MODEL}...\n`);

try {
  const response = await fetch(`${QWEN_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${QWEN_API_KEY}`,
    },
    body: JSON.stringify({
      model: QWEN_MODEL,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "请分析这张微信聊天窗口截图，提取最近的 5 条消息。要求：1. 从最新的消息开始往前数 5 条；2. 对于每条消息提取：sender (发送者昵称，自己发的标记为'我')、content (消息内容)、time (时间戳)；3. 以 JSON 格式返回。",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ API failed: ${response.status}`);
    console.error(errorText);
    process.exit(1);
  }

  const data = await response.json();

  console.log("✅ Vision analysis successful!\n");
  console.log("=".repeat(70));
  console.log("Response:");
  console.log("=".repeat(70));
  console.log(data.choices[0].message.content);
  console.log("=".repeat(70));
  console.log(`\nUsage:`, data.usage);

} catch (err) {
  console.error(`❌ Error: ${err.message}`);
  process.exit(1);
}
