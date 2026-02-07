/**
 * MiniMax API Key 验证测试
 * 使用安装向导中相同的验证逻辑
 * 
 * 运行方式: MINIMAX_API_KEY=sk-xxx npx vitest run src/gateway/minimax-apikey-verify.test.ts
 */
import { describe, expect, it } from "vitest";
import { isTruthyEnvValue } from "../infra/env.js";

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY ?? "";
const MINIMAX_ENDPOINT = "https://api.minimaxi.com/anthropic";
const MINIMAX_MODEL = process.env.MINIMAX_MODEL?.trim() || "MiniMax-M2.1";
const LIVE = isTruthyEnvValue(process.env.MINIMAX_LIVE_TEST) || isTruthyEnvValue(process.env.LIVE);

const describeLive = LIVE && MINIMAX_API_KEY ? describe : describe.skip;

describeLive("MiniMax M2.1 API Key 验证 (安装向导逻辑)", () => {
  it("确认 /messages 端点不存在 (回归测试)", async () => {
    // 确保 /messages 端点确实返回 404，验证 /v1/messages 是正确路径
    const wrongUrl = `${MINIMAX_ENDPOINT}/messages`;
    const testHeaders = {
      "x-api-key": MINIMAX_API_KEY,
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
    };
    const testBody = JSON.stringify({
      model: MINIMAX_MODEL,
      messages: [{ role: "user", content: "Hi" }],
      max_tokens: 1,
    });

    console.log("测试错误 URL:", wrongUrl);

    const response = await fetch(wrongUrl, {
      method: "POST",
      headers: testHeaders,
      body: testBody,
      signal: AbortSignal.timeout(30000),
    });

    console.log("错误 URL 返回状态:", response.status, response.statusText);
    // 预期：404 Not Found（因为路径错误）
    expect(response.status).toBe(404);
  }, 35000);

  it("验证 API Key 是否可用 - 修复后的逻辑 (正确 URL: /v1/messages)", async () => {
    // 修复后应该使用 /v1/messages
    const correctUrl = `${MINIMAX_ENDPOINT}/v1/messages`;
    const testHeaders = {
      "x-api-key": MINIMAX_API_KEY,
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
    };
    const testBody = JSON.stringify({
      model: MINIMAX_MODEL,
      messages: [{ role: "user", content: "Hi" }],
      max_tokens: 1,
    });

    console.log("测试正确 URL:", correctUrl);
    console.log("测试模型:", MINIMAX_MODEL);
    console.log("API Key 前缀:", MINIMAX_API_KEY.substring(0, 20) + "...");

    const response = await fetch(correctUrl, {
      method: "POST",
      headers: testHeaders,
      body: testBody,
      signal: AbortSignal.timeout(30000),
    });

    console.log("HTTP 状态码:", response.status, response.statusText);

    if (response.ok) {
      const data = await response.json();
      console.log("响应成功:", JSON.stringify(data, null, 2).substring(0, 500));
      expect(response.ok).toBe(true);
    } else {
      const errorText = await response.text();
      console.log("错误响应:", errorText);
      
      let errorMessage = "API Key 无效";
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        } else if (errorJson.message) {
          errorMessage = errorJson.message;
        }
      } catch {
        if (response.status === 401) {
          errorMessage = "API Key 无效或已过期";
        } else if (response.status === 403) {
          errorMessage = "API Key 权限不足";
        } else if (response.status === 429) {
          errorMessage = "请求频率超限，请稍后重试";
        }
      }
      
      console.log("解析后的错误信息:", errorMessage);
      // 如果验证失败，测试也失败，显示具体原因
      expect.fail(`API Key 验证失败: ${errorMessage} (HTTP ${response.status})`);
    }
  }, 35000);

  it("验证 API Key 是否可用 - 使用 minimax.live.test.ts 相同逻辑 (pi-ai completeSimple)", async () => {
    // 与 minimax.live.test.ts 中相同的逻辑，使用 pi-ai 库
    const { completeSimple } = await import("@mariozechner/pi-ai");
    // 直接内联模型定义
    const model = {
      id: MINIMAX_MODEL,
      name: `MiniMax ${MINIMAX_MODEL}`,
      api: "anthropic-messages" as const,
      provider: "minimax",
      baseUrl: MINIMAX_ENDPOINT,
      reasoning: false,
      input: ["text" as const],
      cost: { input: 15, output: 60, cacheRead: 2, cacheWrite: 10 },
      contextWindow: 200000,
      maxTokens: 8192,
    };

    console.log("使用 pi-ai completeSimple 测试...");
    console.log("Model:", JSON.stringify(model, null, 2));

    try {
      const res = await completeSimple(
        model,
        {
          messages: [
            {
              role: "user",
              content: "Reply with the word ok.",
              timestamp: Date.now(),
            },
          ],
        },
        { apiKey: MINIMAX_API_KEY, maxTokens: 64 },
      );

      const text = res.content
        .filter((block) => block.type === "text")
        .map((block) => block.text.trim())
        .join(" ");

      console.log("响应文本:", text);
      console.log("停止原因:", res.stopReason);
      console.log("Token 使用:", res.usage);

      expect(text.length).toBeGreaterThan(0);
      console.log("✅ API Key 验证成功！");
    } catch (error) {
      console.error("❌ API 调用失败:", error);
      expect.fail(`API 调用失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, 35000);
});
