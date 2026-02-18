/**
 * Test wechat_read tool with proper auth system
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Simulate tool execution with agent context
async function testWeChatReadTool() {
  console.log("=== Testing wechat_read Tool (with agent auth system) ===\n");

  // Agent dir (where models.json and auth-profiles.json are located)
  const agentDir = path.join(os.homedir(), ".openclawcn", "agents", "main", "agent");
  console.log(`Agent dir: ${agentDir}`);

  // Dynamically import the tool
  const { createWeChatReadTool } = await import("./dist/pi-embedded-CCIKFVsI.js");

  // Create tool with agent context (config and agentDir)
  const tool = createWeChatReadTool({
    agentDir,
    config: undefined, // Let it use agent's config from disk
  });

  console.log(`✓ Tool created: ${tool.name}`);
  console.log(`✓ Tool label: ${tool.label}\n`);

  // Read existing screenshot
  const screenshotPath = "wechat-read-1771379972588.png";
  if (!fs.existsSync(screenshotPath)) {
    console.error(`❌ Screenshot not found: ${screenshotPath}`);
    process.exit(1);
  }

  const screenshotBuf = fs.readFileSync(screenshotPath);
  console.log(`✓ Screenshot: ${screenshotPath}`);
  console.log(`  Size: ${(screenshotBuf.length / 1024).toFixed(2)} KB\n`);

  // Note: This test would need to mock the desktop-control.js functions
  // For now, we're testing that the tool can be created with the right auth flow

  console.log("✅ Tool creation with auth system successful!");
  console.log("\nNext step: Test in UI by asking:");
  console.log('  "尝试读取 TecBin 的微信消息"');
}

testWeChatReadTool().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
