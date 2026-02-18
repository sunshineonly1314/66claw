/**
 * Test script to verify qwen-max vision capability
 * Uses the DashScope OpenAI-compatible API
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Qwen config
const QWEN_API_KEY = "sk-c44f643a792a448cb474e89970509f10";
const QWEN_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const QWEN_MODEL = "qwen-max";

async function testQwenVision() {
  // Find the latest WeChat screenshot
  const tmpDir = os.tmpdir();
  const files = fs.readdirSync(tmpDir);
  const wechatScreenshots = files
    .filter((f) => f.startsWith("wechat-read-") && f.endsWith(".png"))
    .map((f) => ({
      name: f,
      path: path.join(tmpDir, f),
      mtime: fs.statSync(path.join(tmpDir, f)).mtime,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  if (wechatScreenshots.length === 0) {
    console.error("❌ No WeChat screenshots found in temp directory");
    console.log("Expected files like: wechat-read-*.png in", tmpDir);
    return;
  }

  const screenshot = wechatScreenshots[0];
  console.log(`✓ Found screenshot: ${screenshot.name}`);
  console.log(`  Path: ${screenshot.path}`);
  console.log(`  Size: ${(fs.statSync(screenshot.path).size / 1024).toFixed(2)} KB\n`);

  // Read and encode as base64
  const imageBuffer = fs.readFileSync(screenshot.path);
  const base64Image = imageBuffer.toString("base64");

  console.log(`✓ Encoded image to base64 (${base64Image.length} chars)\n`);

  // Test qwen-max vision via OpenAI-compatible API
  console.log(`Testing qwen-max vision analysis...`);
  console.log(`Model: ${QWEN_MODEL}`);
  console.log(`Endpoint: ${QWEN_BASE_URL}/chat/completions\n`);

  const requestBody = {
    model: QWEN_MODEL,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "请分析这张微信聊天窗口截图，提取最近的 5 条消息。要求：1. 从最新的消息开始往前数 5 条；2. 对于每条消息提取：sender (发送者昵称，自己发的标记为'我')、content (消息内容)、time (时间戳)；3. 按时间顺序返回。",
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
    temperature: 0.7,
    max_tokens: 2000,
  };

  try {
    const response = await fetch(`${QWEN_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${QWEN_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API request failed: ${response.status} ${response.statusText}`);
      console.error(`Response: ${errorText}`);
      return;
    }

    const data = await response.json();

    if (data.error) {
      console.error(`❌ API error: ${data.error.message || JSON.stringify(data.error)}`);
      return;
    }

    console.log(`✅ Qwen-max vision analysis successful!\n`);
    console.log("═".repeat(70));
    console.log("Model Response:");
    console.log("═".repeat(70));
    console.log(data.choices[0].message.content);
    console.log("═".repeat(70));
    console.log(`\nUsage:`, data.usage);
    console.log(`\n✅ Test PASSED: qwen-max supports vision via OpenAI-compatible API`);
  } catch (err) {
    console.error(`❌ Test FAILED: ${err.message}`);
    console.error(err.stack);
  }
}

testQwenVision();
