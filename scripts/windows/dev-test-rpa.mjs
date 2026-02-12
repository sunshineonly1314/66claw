#!/usr/bin/env node
// ============================================================================
// ClawdBot RPA Dev Test Script
// Send commands to the gateway via WebSocket and stream agent responses
//
// Usage:
//   node scripts/windows/dev-test-rpa.mjs "take a screenshot"
//   node scripts/windows/dev-test-rpa.mjs --debug "check wechat messages"
//   node scripts/windows/dev-test-rpa.mjs --session my-session "hello"
// ============================================================================
import WebSocket from "ws";
import { writeFileSync } from "node:fs";

const GATEWAY_URL = "ws://localhost:18789";
const TOKEN = "clawdbot2026";
const PROTOCOL_VERSION = 3;

// Parse args
const rawArgs = process.argv.slice(2);
const flags = { debug: false, session: "dev-rpa-test" };
const msgParts = [];

for (let i = 0; i < rawArgs.length; i++) {
  if (rawArgs[i] === "--debug") { flags.debug = true; continue; }
  if (rawArgs[i] === "--session" && rawArgs[i + 1]) { flags.session = rawArgs[++i]; continue; }
  msgParts.push(rawArgs[i]);
}

const message = msgParts.join(" ") || "take a screenshot of the desktop";

console.log(`\n=== ClawdBot RPA Test ===`);
console.log(`Session: ${flags.session}`);
console.log(`Message: ${message}`);
console.log(`Debug: ${flags.debug}\n`);

// WebSocket connection
const ws = new WebSocket(GATEWAY_URL);
let reqId = 0;
const pending = new Map();

function sendReq(method, params) {
  const id = `req-${++reqId}`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timeout: ${method}`));
    }, 120_000);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ type: "req", id, method, params }));
  });
}

ws.on("open", () => console.log("Connected to gateway..."));

ws.on("error", (err) => {
  console.error(`WebSocket error: ${err.message}`);
  process.exit(1);
});

ws.on("close", () => process.exit(0));

ws.on("message", async (raw) => {
  try {
    const msg = JSON.parse(raw.toString());

    if (flags.debug) {
      console.log(`[DBG] ${JSON.stringify(msg).slice(0, 200)}`);
    }

    // 1. Server challenge → respond with connect
    if (msg.type === "event" && msg.event === "connect.challenge") {
      const res = await sendReq("connect", {
        minProtocol: PROTOCOL_VERSION,
        maxProtocol: PROTOCOL_VERSION,
        client: { id: "cli", displayName: "dev-test", version: "0.1", platform: "win32", mode: "cli" },
        auth: { token: TOKEN },
      });
      console.log("Authenticated!\n");

      // Send chat message
      const idempotencyKey = `dev-${Date.now()}`;
      const chatRes = await sendReq("chat.send", {
        sessionKey: flags.session,
        message,
        idempotencyKey,
      });

      if (chatRes?.runId) {
        console.log(`Agent run: ${chatRes.runId}\n---`);
        // Wait for streaming events — 3 min timeout
        setTimeout(() => { console.log("\n[3min timeout]"); ws.close(); }, 180_000);
      } else {
        console.log("Unexpected response:", JSON.stringify(chatRes).slice(0, 500));
        ws.close();
      }
      return;
    }

    // 2. RPC responses
    if (msg.type === "res" && msg.id && pending.has(msg.id)) {
      const { resolve, timer } = pending.get(msg.id);
      clearTimeout(timer);
      pending.delete(msg.id);
      resolve(msg.ok === false ? msg.error : (msg.payload ?? msg));
      return;
    }

    // 3. Agent streaming events
    if (msg.type === "event" && msg.event === "agent") {
      const p = msg.payload;
      if (!p) return;

      if (p.stream === "assistant") {
        // Text delta
        if (p.data?.delta) process.stdout.write(p.data.delta);
      } else if (p.stream === "tool_use") {
        console.log(`\n  [tool: ${p.data?.name || "?"}]`);
      } else if (p.stream === "tool_result") {
        const content = p.data?.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text") console.log(`  -> ${block.text.slice(0, 500)}`);
            if (block.type === "image") {
              const kb = Math.round((block.source?.data?.length || 0) / 1024);
              console.log(`  -> [Screenshot ${kb}KB]`);
            }
          }
        } else if (typeof p.data?.text === "string") {
          console.log(`  -> ${p.data.text.slice(0, 500)}`);
        }
      } else if (p.stream === "lifecycle" && p.data?.phase === "end") {
        console.log(`\n---\nDone! (${((p.data.endedAt - (p.data.startedAt || p.data.endedAt)) / 1000).toFixed(1)}s)`);
        ws.close();
      }
      return;
    }

    // 4. Ignore health/tick/chat/presence events silently
  } catch (err) {
    console.error("Parse error:", err.message);
  }
});
