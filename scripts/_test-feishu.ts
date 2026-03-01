/**
 * 直接测试飞书连接 — 绕过 gateway，模拟页面逻辑
 */
import axios from "axios";
import * as Lark from "@larksuiteoapi/node-sdk";

const APP_ID = "cli_a928042430381bc8";
const APP_SECRET = "0bQlj511pmdzTzOVIqy4qbIgOweuvJkK";
const DOMAIN = "https://open.feishu.cn";

// ============================================================
// Test 1: Raw HTTP — 获取 tenant_access_token
// ============================================================
async function testRawToken() {
  console.log("=== Test 1: Raw HTTP tenant_access_token ===");
  try {
    const res = await axios.post(
      `${DOMAIN}/open-apis/auth/v3/tenant_access_token/internal`,
      { app_id: APP_ID, app_secret: APP_SECRET },
      { timeout: 10000, proxy: false },
    );
    console.log("Status:", res.status);
    console.log("Response:", JSON.stringify(res.data, null, 2));
    return res.data?.tenant_access_token;
  } catch (err: any) {
    console.error("FAILED:", err.message);
    if (err.response) {
      console.error("HTTP Status:", err.response.status);
      console.error("Body:", err.response.data);
    }
    if (err.code) console.error("Code:", err.code);
    return null;
  }
}

// ============================================================
// Test 2: Raw HTTP — 用 token 获取 bot info
// ============================================================
async function testBotInfo(token: string) {
  console.log("\n=== Test 2: Raw HTTP bot/v3/info ===");
  try {
    const res = await axios.get(`${DOMAIN}/open-apis/bot/v3/info`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000,
      proxy: false,
    });
    console.log("Status:", res.status);
    console.log("Response:", JSON.stringify(res.data, null, 2));
  } catch (err: any) {
    console.error("FAILED:", err.message);
    if (err.response) {
      console.error("HTTP Status:", err.response.status);
      console.error("Body:", err.response.data);
    }
  }
}

// ============================================================
// Test 3: 使用 Lark SDK (跟代码里一样的方式)
// ============================================================
async function testLarkSDK() {
  console.log("\n=== Test 3: Lark SDK client.request ===");
  const noProxyHttp = axios.create({ proxy: false });
  noProxyHttp.interceptors.request.use((req) => {
    if (req.headers) req.headers["User-Agent"] = "oapi-node-sdk/1.0.0";
    return req;
  }, undefined, { synchronous: true });
  noProxyHttp.interceptors.response.use((resp) => {
    if ((resp.config as any)["$return_headers"]) {
      return { data: resp.data, headers: resp.headers } as any;
    }
    return resp.data as any;
  });

  const client = new Lark.Client({
    appId: APP_ID,
    appSecret: APP_SECRET,
    appType: Lark.AppType.SelfBuild,
    domain: Lark.Domain.Feishu,
    httpInstance: noProxyHttp as any,
  });

  try {
    const response = await client.request({
      method: "GET",
      url: `${DOMAIN}/open-apis/bot/v3/info`,
      timeout: 10000,
    }) as any;
    console.log("Response:", JSON.stringify(response, null, 2));
  } catch (err: any) {
    console.error("FAILED:", err.message);
    console.error("Full error:", err);
  }
}

// ============================================================
// Test 4: DNS 解析和网络连通性
// ============================================================
async function testNetwork() {
  console.log("\n=== Test 4: Network connectivity ===");
  const dns = await import("node:dns");

  try {
    const result = await dns.promises.resolve4("open.feishu.cn");
    console.log("DNS resolve open.feishu.cn:", result);
  } catch (err: any) {
    console.error("DNS FAILED:", err.message);
  }

  // Simple TCP connect test
  const net = await import("node:net");
  await new Promise<void>((resolve) => {
    const sock = net.connect(443, "open.feishu.cn", () => {
      console.log("TCP connect to open.feishu.cn:443 OK");
      sock.destroy();
      resolve();
    });
    sock.on("error", (err) => {
      console.error("TCP connect FAILED:", err.message);
      resolve();
    });
    sock.setTimeout(5000, () => {
      console.error("TCP connect TIMEOUT");
      sock.destroy();
      resolve();
    });
  });
}

// ============================================================
// Run all tests
// ============================================================
async function main() {
  await testNetwork();
  const token = await testRawToken();
  if (token) {
    await testBotInfo(token);
  }
  await testLarkSDK();
}

main().catch(console.error);
