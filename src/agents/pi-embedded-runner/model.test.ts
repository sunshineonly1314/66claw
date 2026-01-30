import { describe, expect, it } from "vitest";

import { buildInlineProviderModels } from "./model.js";

const makeModel = (id: string) => ({
  id,
  name: id,
  reasoning: false,
  input: ["text"] as const,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 1,
  maxTokens: 1,
});

describe("buildInlineProviderModels", () => {
  it("attaches provider ids to inline models", () => {
    const providers = {
      " alpha ": { models: [makeModel("alpha-model")] },
      beta: { models: [makeModel("beta-model")] },
    };

    const result = buildInlineProviderModels(providers);

    expect(result).toEqual([
      { ...makeModel("alpha-model"), provider: "alpha", baseUrl: undefined, api: undefined },
      { ...makeModel("beta-model"), provider: "beta", baseUrl: undefined, api: undefined },
    ]);
  });

  it("inherits baseUrl from provider config", () => {
    const providers = {
      qwen: {
        baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        models: [makeModel("qwen-plus")],
      },
    };

    const result = buildInlineProviderModels(providers);

    expect(result).toHaveLength(1);
    expect(result[0].baseUrl).toBe("https://dashscope.aliyuncs.com/compatible-mode/v1");
    expect(result[0].provider).toBe("qwen");
  });

  it("inherits api from provider config when model has no api", () => {
    const providers = {
      deepseek: {
        api: "openai-responses" as const,
        models: [makeModel("deepseek-chat")],
      },
    };

    const result = buildInlineProviderModels(providers);

    expect(result).toHaveLength(1);
    expect(result[0].api).toBe("openai-responses");
  });

  it("model-level api takes precedence over provider-level api", () => {
    const providers = {
      custom: {
        api: "openai-responses" as const,
        models: [{ ...makeModel("custom-model"), api: "anthropic-messages" as const }],
      },
    };

    const result = buildInlineProviderModels(providers);

    expect(result).toHaveLength(1);
    expect(result[0].api).toBe("anthropic-messages");
  });

  it("inherits both baseUrl and api from provider config", () => {
    const providers = {
      zhipu: {
        baseUrl: "https://open.bigmodel.cn/api/paas/v4",
        api: "openai-responses" as const,
        models: [makeModel("glm-4-plus")],
      },
    };

    const result = buildInlineProviderModels(providers);

    expect(result).toHaveLength(1);
    expect(result[0].baseUrl).toBe("https://open.bigmodel.cn/api/paas/v4");
    expect(result[0].api).toBe("openai-responses");
    expect(result[0].provider).toBe("zhipu");
  });
});
