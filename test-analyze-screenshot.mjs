/**
 * Direct test of analyzeScreenshotWithQwen function
 * This tests the vision API integration independently
 */

import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log("=== Testing analyzeScreenshotWithQwen ===\n");

// Load config to get qwen API key
const configPath = join(process.env.USERPROFILE || process.env.HOME, ".openclawcn", "openclawcn.json");
const configData = fs.readFileSync(configPath, "utf-8");
const config = JSON.parse(configData);

const qwenProvider = config.models?.providers?.qwen;

if (!qwenProvider?.apiKey) {
  console.error("❌ qwen provider not configured");
  process.exit(1);
}

console.log("✓ Found qwen provider config");
console.log(`  API key: ${qwenProvider.apiKey.substring(0, 10)}...`);
console.log(`  Base URL: ${qwenProvider.baseUrl}\n`);

// Find the most recent wechat screenshot in temp
const tempDir = process.env.TEMP || process.env.TMP || "/tmp";
const files = fs.readdirSync(tempDir);
const wechatScreenshots = files
  .filter(f => f.startsWith("wechat-read-") && f.endsWith(".png"))
  .map(f => ({
    name: f,
    path: join(tempDir, f),
    mtime: fs.statSync(join(tempDir, f)).mtime,
  }))
  .sort((a, b) => b.mtime - a.mtime);

if (wechatScreenshots.length === 0) {
  console.error("❌ No wechat screenshots found in temp directory");
  console.log(`   Searched in: ${tempDir}`);
  process.exit(1);
}

const screenshot = wechatScreenshots[0];
console.log(`✓ Found screenshot: ${screenshot.name}`);
console.log(`  Modified: ${screenshot.mtime.toLocaleString()}\n`);

// Read screenshot as base64
const screenshotBuf = fs.readFileSync(screenshot.path);
const screenshotBase64 = screenshotBuf.toString("base64");
console.log(`✓ Screenshot loaded: ${(screenshotBuf.length / 1024).toFixed(2)} KB\n`);

// Call qwen vision API
const visionPrompt = `请分析这张微信聊天窗口截图，提取最近的 5 条消息。

要求:
1. 从最新的消息开始往前数 5 条
2. 对于每条消息，提取以下信息:
   - sender: 发送者昵称 (如果是自己发的，标记为 "我")
   - content: 消息内容 (纯文本，如果是图片/语音/文件，标记为 [图片]/[语音]/[文件])
   - time: 时间戳 (如果可见)
3. 按时间顺序返回 (最早的在前，最新的在后)

请以 JSON 格式返回:
\`\`\`json
{
  "contact": "聊天对象名称",
  "messages": [
    {"sender": "张三", "content": "你好", "time": "14:30"},
    {"sender": "我", "content": "你好！", "time": "14:31"}
  ]
}
\`\`\`

如果截图中没有消息或无法识别，返回空的 messages 数组。`;

console.log("Calling qwen-max vision API...\n");

const baseUrl = qwenProvider.baseUrl || "https://dashscope.aliyuncs.com/compatible-mode/v1";
const apiKey = qwenProvider.apiKey;

try {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "qwen-max",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: visionPrompt },
            {
              type: "image_url",
              image_url: { url: `data:image/png;base64,${screenshotBase64}` },
            },
          ],
        },
      ],
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ API call failed: ${response.status}`);
    console.error(errorText);
    process.exit(1);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    console.error("❌ No content in response");
    console.log(JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log("✅ Vision analysis successful!\n");
  console.log("=== Analysis Result ===");
  console.log(content);
  console.log("\n=== Usage ===");
  console.log(JSON.stringify(data.usage, null, 2));

  // Try to extract JSON from the response
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      console.log("\n=== Parsed Messages ===");
      console.log(JSON.stringify(parsed, null, 2));
      console.log(`\n✅ Successfully extracted ${parsed.messages?.length || 0} messages!`);
    } catch (err) {
      console.log("\n⚠️ Could not parse JSON from response");
    }
  }

} catch (err) {
  console.error("❌ Error:", err.message);
  process.exit(1);
}
