/**
 * models-config 序列化与 authStore 穿透测试
 *
 * 验证:
 * 1. ensureOpenClawCNModelsJson 并发调用序列化（不互相覆盖）
 * 2. authStore 参数正确穿透到 resolveImplicitProviders（跳过磁盘 I/O）
 * 3. 序列化链在异常后不阻塞后续调用
 * 4. 内容未变化时跳过写入（幂等性）
 */

import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withTempHome as withTempHomeBase } from "../../test/helpers/temp-home.js";
import type { OpenClawCNConfig } from "../config/config.js";

async function withTempHome<T>(fn: (home: string) => Promise<T>): Promise<T> {
  return withTempHomeBase(fn, { prefix: "openclawcn-models-serial-" });
}

describe("models-config serialization", () => {
  let previousHome: string | undefined;

  beforeEach(() => {
    previousHome = process.env.HOME;
  });

  afterEach(() => {
    process.env.HOME = previousHome;
  });

  it("serializes concurrent calls — last writer wins without corruption", async () => {
    await withTempHome(async () => {
      vi.resetModules();
      const { ensureOpenClawCNModelsJson } = await import("./models-config.js");
      const { resolveOpenClawCNAgentDir } = await import("./agent-paths.js");

      const agentDir = resolveOpenClawCNAgentDir();

      const configA: OpenClawCNConfig = {
        models: {
          providers: {
            "provider-a": {
              baseUrl: "http://a.test/v1",
              apiKey: "key-a",
              api: "openai-completions",
              models: [
                {
                  id: "model-a",
                  name: "Model A",
                  reasoning: false,
                  input: ["text"],
                  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                  contextWindow: 8000,
                  maxTokens: 2000,
                },
              ],
            },
          },
        },
      };

      const configB: OpenClawCNConfig = {
        models: {
          providers: {
            "provider-b": {
              baseUrl: "http://b.test/v1",
              apiKey: "key-b",
              api: "openai-completions",
              models: [
                {
                  id: "model-b",
                  name: "Model B",
                  reasoning: false,
                  input: ["text"],
                  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                  contextWindow: 8000,
                  maxTokens: 2000,
                },
              ],
            },
          },
        },
      };

      // Fire both concurrently
      const [resultA, resultB] = await Promise.all([
        ensureOpenClawCNModelsJson(configA),
        ensureOpenClawCNModelsJson(configB),
      ]);

      // Both should complete without error
      expect(resultA.agentDir).toBe(agentDir);
      expect(resultB.agentDir).toBe(agentDir);

      // At least one wrote
      expect(resultA.wrote || resultB.wrote).toBe(true);

      // The file should be valid JSON
      const modelPath = path.join(agentDir, "models.json");
      const raw = await fs.readFile(modelPath, "utf8");
      const parsed = JSON.parse(raw) as { providers: Record<string, unknown> };

      // Since mode=merge and calls are serialized, the second call merges
      // onto the first call's result. Both providers should be present.
      expect(parsed.providers).toHaveProperty("provider-a");
      expect(parsed.providers).toHaveProperty("provider-b");
    });
  });

  it("chain is not blocked after a call throws", async () => {
    await withTempHome(async () => {
      vi.resetModules();
      const modelsConfig = await import("./models-config.js");

      // First call with an impossible agentDir to trigger mkdir/write error
      // (we make agentDir point to a file, not a directory)
      const tempFile = path.join(process.env.HOME!, "not-a-dir");
      await fs.writeFile(tempFile, "block");

      // This should fail (trying to mkdir inside a file)
      const failResult = modelsConfig.ensureOpenClawCNModelsJson(
        {
          models: {
            providers: {
              test: {
                baseUrl: "http://test/v1",
                apiKey: "k",
                api: "openai-completions",
                models: [
                  {
                    id: "m",
                    name: "M",
                    reasoning: false,
                    input: ["text"],
                    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                    contextWindow: 8000,
                    maxTokens: 2000,
                  },
                ],
              },
            },
          },
        },
        path.join(tempFile, "subdir"),
      );
      await expect(failResult).rejects.toThrow();

      // Subsequent call should NOT be blocked
      const { resolveOpenClawCNAgentDir } = await import("./agent-paths.js");
      const agentDir = resolveOpenClawCNAgentDir();
      const okResult = await modelsConfig.ensureOpenClawCNModelsJson({
        models: {
          providers: {
            recovery: {
              baseUrl: "http://recover/v1",
              apiKey: "k2",
              api: "openai-completions",
              models: [
                {
                  id: "r",
                  name: "R",
                  reasoning: false,
                  input: ["text"],
                  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                  contextWindow: 8000,
                  maxTokens: 2000,
                },
              ],
            },
          },
        },
      });

      expect(okResult.wrote).toBe(true);
      const raw = await fs.readFile(path.join(agentDir, "models.json"), "utf8");
      const parsed = JSON.parse(raw) as { providers: Record<string, unknown> };
      expect(parsed.providers).toHaveProperty("recovery");
    });
  });

  it("skips write when content is identical (idempotent)", async () => {
    await withTempHome(async () => {
      vi.resetModules();
      const { ensureOpenClawCNModelsJson } = await import("./models-config.js");

      const config: OpenClawCNConfig = {
        models: {
          providers: {
            "idem-test": {
              baseUrl: "http://idem/v1",
              apiKey: "k",
              api: "openai-completions",
              models: [
                {
                  id: "x",
                  name: "X",
                  reasoning: false,
                  input: ["text"],
                  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                  contextWindow: 8000,
                  maxTokens: 2000,
                },
              ],
            },
          },
        },
      };

      const first = await ensureOpenClawCNModelsJson(config);
      expect(first.wrote).toBe(true);

      // Same config again
      const second = await ensureOpenClawCNModelsJson(config);
      expect(second.wrote).toBe(false);
    });
  });

  it("passes authStore through to resolveImplicitProviders", async () => {
    await withTempHome(async () => {
      vi.resetModules();

      // Set MINIMAX env var to ensure implicit provider resolution happens
      const prevMinimax = process.env.MINIMAX_API_KEY;
      delete process.env.MINIMAX_API_KEY;

      try {
        const { ensureOpenClawCNModelsJson } = await import("./models-config.js");
        const { resolveOpenClawCNAgentDir } = await import("./agent-paths.js");

        // Pass a fake authStore with a minimax profile
        const fakeAuthStore = {
          version: 1,
          profiles: {
            "minimax:default": {
              type: "api_key" as const,
              provider: "minimax",
              key: "sk-fake-minimax-from-store",
            },
          },
        };

        const result = await ensureOpenClawCNModelsJson({}, undefined, fakeAuthStore);
        expect(result.wrote).toBe(true);

        const modelPath = path.join(resolveOpenClawCNAgentDir(), "models.json");
        const raw = await fs.readFile(modelPath, "utf8");
        const parsed = JSON.parse(raw) as {
          providers: Record<string, { apiKey?: string }>;
        };

        // The minimax provider should be present from the passed auth store
        expect(parsed.providers).toHaveProperty("minimax");
      } finally {
        if (prevMinimax === undefined) delete process.env.MINIMAX_API_KEY;
        else process.env.MINIMAX_API_KEY = prevMinimax;
      }
    });
  });
});
