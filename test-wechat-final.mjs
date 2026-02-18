/**
 * Final end-to-end test for wechat_read with qwen-max vision
 * This script simulates the complete flow via gateway WebSocket
 */

import WebSocket from "ws";

const GATEWAY_URL = "ws://127.0.0.1:18789";
const AUTH_TOKEN = "0af7d5a857f099f19206af0e338dca92cd7e5062a6f77b1f";

console.log("=== Final WeChat Read Test ===\n");

async function testWechatRead() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(GATEWAY_URL);

    ws.on("open", () => {
      console.log("✓ Connected to gateway\n");

      // Authenticate
      ws.send(JSON.stringify({
        method: "auth",
        params: { token: AUTH_TOKEN },
        id: "auth-1",
      }));
    });

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.id === "auth-1") {
          console.log("✓ Authenticated\n");

          // Send wechat_read request
          console.log("Sending wechat_read request...\n");
          ws.send(JSON.stringify({
            method: "chat.message",
            params: {
              message: "使用 wechat_read 工具读取 TecBin 的最近5条消息",
            },
            id: "test-1",
          }));
        } else if (msg.id === "test-1") {
          console.log("✅ Received response:");
          console.log(JSON.stringify(msg, null, 2));
          ws.close();
          resolve(msg);
        } else if (msg.method === "chat.push") {
          // Chat push events
          console.log(`[PUSH] ${msg.params?.event}: ${msg.params?.text?.substring(0, 100) || ""}`);
        }
      } catch (err) {
        console.error("Parse error:", err.message);
      }
    });

    ws.on("error", (err) => {
      console.error("❌ WebSocket error:", err.message);
      reject(err);
    });

    ws.on("close", () => {
      console.log("\n=== Connection closed ===");
    });

    // Timeout after 60 seconds
    setTimeout(() => {
      console.error("❌ Test timeout");
      ws.close();
      reject(new Error("Timeout"));
    }, 60000);
  });
}

testWechatRead().catch(console.error);
