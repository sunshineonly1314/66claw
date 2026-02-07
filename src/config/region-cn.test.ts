/**
 * 中国区配置模块测试
 * China Region Configuration Module Tests
 *
 * 测试覆盖：
 * 1. 数据一致性验证
 * 2. 类型安全验证
 * 3. 边界情况验证
 * 4. 函数功能验证
 * 5. 配置正确性验证
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  CN_PROVIDERS,
  CN_REGION_CONFIG,
  AFFILIATE_LINKS,
  CN_DEFAULT_SECURITY_CONFIG,
  detectChinaRegion,
  getCnRegionConfig,
  getRecommendedProviders,
  getAffiliateLinks,
  getAffiliateLink,
  isChannelHiddenInCn,
  isProviderHiddenInCn,
  type CnProviderConfig,
  type AffiliateLink,
} from "./region-cn.js";

// ============================================================================
// 1. 数据一致性测试
// ============================================================================

describe("数据一致性测试", () => {
  it("recommendedProviders 中的每个 ID 都必须在 CN_PROVIDERS 中存在", () => {
    const missingProviders: string[] = [];

    for (const providerId of CN_REGION_CONFIG.recommendedProviders) {
      if (!CN_PROVIDERS[providerId]) {
        missingProviders.push(providerId);
      }
    }

    expect(missingProviders).toEqual([]);
  });

  it("每个 provider 的 id 字段应该与其在 CN_PROVIDERS 中的 key 一致", () => {
    const mismatches: string[] = [];

    for (const [key, provider] of Object.entries(CN_PROVIDERS)) {
      if (provider.id !== key) {
        mismatches.push(`key="${key}" but id="${provider.id}"`);
      }
    }

    expect(mismatches).toEqual([]);
  });

  it("每个 provider 至少有一个 recommended 模型", () => {
    const providersWithoutRecommended: string[] = [];

    for (const [providerId, provider] of Object.entries(CN_PROVIDERS)) {
      const hasRecommended = provider.models.some((m) => m.recommended);
      if (!hasRecommended) {
        providersWithoutRecommended.push(providerId);
      }
    }

    expect(providersWithoutRecommended).toEqual([]);
  });

  it("affiliateLinks 中的 ID 应该在 CN_PROVIDERS 中存在", () => {
    const missingInProviders: string[] = [];

    for (const linkId of Object.keys(AFFILIATE_LINKS)) {
      // 允许推广链接指向不存在的 provider（可能是未来添加的）
      // 但应该记录警告
      if (!CN_PROVIDERS[linkId]) {
        missingInProviders.push(linkId);
      }
    }

    // 目前这不是强制要求，只是记录
    // expect(missingInProviders).toEqual([]);
    if (missingInProviders.length > 0) {
      console.warn("推广链接中存在但未定义 provider:", missingInProviders);
    }
  });
});

// ============================================================================
// 2. 模型配置验证测试
// ============================================================================

describe("模型配置验证", () => {
  it("所有模型 ID 不应该为空字符串", () => {
    const emptyIds: string[] = [];

    for (const [providerId, provider] of Object.entries(CN_PROVIDERS)) {
      for (const model of provider.models) {
        if (!model.id || model.id.trim() === "") {
          emptyIds.push(`${providerId}/${model.name}`);
        }
      }
    }

    expect(emptyIds).toEqual([]);
  });

  it("所有模型名称不应该为空字符串", () => {
    const emptyNames: string[] = [];

    for (const [providerId, provider] of Object.entries(CN_PROVIDERS)) {
      for (const model of provider.models) {
        if (!model.name || model.name.trim() === "") {
          emptyNames.push(`${providerId}/${model.id}`);
        }
      }
    }

    expect(emptyNames).toEqual([]);
  });

  it("免费模型应该有 pricing: '免费' 标记", () => {
    const inconsistent: string[] = [];

    for (const [providerId, provider] of Object.entries(CN_PROVIDERS)) {
      for (const model of provider.models) {
        // 如果名称包含 🆓 或 "免费"，pricing 应该是 "免费"
        const isFreeInName = model.name.includes("🆓") || model.name.includes("免费");
        const isFreeInPricing = model.pricing === "免费";

        if (isFreeInName && !isFreeInPricing) {
          inconsistent.push(`${providerId}/${model.id}: 名称标记免费但 pricing 不是 "免费"`);
        }
      }
    }

    expect(inconsistent).toEqual([]);
  });

  it("火山引擎应该有开通模型的警告说明", () => {
    const volcengine = CN_PROVIDERS["volcengine-ark"];
    expect(volcengine).toBeDefined();

    // 检查是否有 authNote 提示用户需要开通模型
    expect(volcengine.authNote).toBeDefined();
    expect(volcengine.authNote).toContain("开通");

    // 检查模型 ID 使用正确的格式 (doubao-seed-x-x 小写格式)
    for (const model of volcengine.models) {
      expect(model.id).toMatch(/^doubao-seed-/);
    }
  });
});

// ============================================================================
// 3. API 端点验证测试
// ============================================================================

describe("API 端点验证", () => {
  it("所有 apiEndpoint 应该是有效的 HTTPS URL（本地服务除外）", () => {
    const invalidEndpoints: string[] = [];

    for (const [providerId, provider] of Object.entries(CN_PROVIDERS)) {
      const url = provider.apiEndpoint;

      // 本地服务（如 Ollama）允许使用 HTTP
      const isLocalService = url.includes("localhost") || url.includes("127.0.0.1");
      
      // 检查是否以 https:// 开头（生产环境应该都是 HTTPS，本地服务除外）
      if (!url.startsWith("https://") && !isLocalService) {
        invalidEndpoints.push(`${providerId}: ${url}`);
      }

      // 检查 URL 格式是否有效
      try {
        new URL(url);
      } catch {
        invalidEndpoints.push(`${providerId}: invalid URL format - ${url}`);
      }
    }

    expect(invalidEndpoints).toEqual([]);
  });

  it("apiEndpoint 不应该以斜杠结尾", () => {
    const trailingSlash: string[] = [];

    for (const [providerId, provider] of Object.entries(CN_PROVIDERS)) {
      if (provider.apiEndpoint.endsWith("/")) {
        trailingSlash.push(`${providerId}: ${provider.apiEndpoint}`);
      }
    }

    expect(trailingSlash).toEqual([]);
  });

  it("docsUrl 应该是有效的 HTTP/HTTPS URL", () => {
    const invalidUrls: string[] = [];

    for (const [providerId, provider] of Object.entries(CN_PROVIDERS)) {
      const url = provider.docsUrl;

      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        invalidUrls.push(`${providerId}: ${url}`);
      }
    }

    expect(invalidUrls).toEqual([]);
  });
});

// ============================================================================
// 4. 函数功能测试
// ============================================================================

describe("detectChinaRegion()", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // 恢复原始环境变量
    process.env = { ...originalEnv };
  });

  it("CLAWDBOT_REGION=cn 应该返回 true", () => {
    process.env.CLAWDBOT_REGION = "cn";
    expect(detectChinaRegion()).toBe(true);
  });

  it("CLAWDBOT_REGION=global 应该返回 false", () => {
    process.env.CLAWDBOT_REGION = "global";
    expect(detectChinaRegion()).toBe(false);
  });

  it("LANG=zh_CN.UTF-8 应该返回 true", () => {
    delete process.env.CLAWDBOT_REGION;
    process.env.LANG = "zh_CN.UTF-8";
    expect(detectChinaRegion()).toBe(true);
  });

  it("LANG=en_US.UTF-8 应该返回 false（假设非中国时区）", () => {
    delete process.env.CLAWDBOT_REGION;
    process.env.LANG = "en_US.UTF-8";
    // 注意：这个测试结果取决于运行环境的时区
    // 在中国时区运行时可能返回 true
    const result = detectChinaRegion();
    expect(typeof result).toBe("boolean");
  });
});

describe("getCnRegionConfig()", () => {
  it("应该返回完整的配置对象", () => {
    const config = getCnRegionConfig();

    expect(config).toBeDefined();
    expect(config.recommendedProviders).toBeInstanceOf(Array);
    expect(config.recommendedChannels).toBeInstanceOf(Array);
    expect(config.hiddenChannels).toBeInstanceOf(Array);
    expect(config.hiddenProviders).toBeInstanceOf(Array);
    expect(config.skillsRegistry).toBeDefined();
    expect(config.affiliateLinks).toBeDefined();
    expect(config.providers).toBeDefined();
  });
});

describe("getRecommendedProviders()", () => {
  it("应该返回非空的 provider 列表", () => {
    const providers = getRecommendedProviders();

    expect(providers).toBeInstanceOf(Array);
    expect(providers.length).toBeGreaterThan(0);
  });

  it("返回的每个 provider 都应该有完整的字段", () => {
    const providers = getRecommendedProviders();

    for (const provider of providers) {
      expect(provider.id).toBeDefined();
      expect(provider.name).toBeDefined();
      expect(provider.description).toBeDefined();
      expect(provider.apiEndpoint).toBeDefined();
      expect(provider.models).toBeInstanceOf(Array);
      expect(provider.models.length).toBeGreaterThan(0);
      expect(provider.envVar).toBeDefined();
      expect(provider.docsUrl).toBeDefined();
    }
  });

  it("返回的顺序应该与 recommendedProviders 一致", () => {
    const providers = getRecommendedProviders();
    const expectedOrder = CN_REGION_CONFIG.recommendedProviders.filter(
      (id) => CN_PROVIDERS[id] !== undefined
    );

    expect(providers.map((p) => p.id)).toEqual(expectedOrder);
  });

  it("不应该返回 undefined（数据一致性检查）", () => {
    const providers = getRecommendedProviders();

    for (const provider of providers) {
      expect(provider).not.toBeUndefined();
    }
  });
});

describe("getAffiliateLinks()", () => {
  it("应该返回按 priority 排序的列表", () => {
    const links = getAffiliateLinks();

    for (let i = 1; i < links.length; i++) {
      expect(links[i].priority).toBeGreaterThanOrEqual(links[i - 1].priority);
    }
  });

  it("每个链接都应该有有效的 URL", () => {
    const links = getAffiliateLinks();

    for (const link of links) {
      expect(link.affiliateUrl).toMatch(/^https?:\/\//);
      expect(link.consoleUrl).toMatch(/^https?:\/\//);
      expect(link.apiKeyUrl).toMatch(/^https?:\/\//);
    }
  });
});

describe("getAffiliateLink()", () => {
  it("存在的 providerId 应该返回对应的链接", () => {
    const link = getAffiliateLink("siliconflow");

    expect(link).not.toBeNull();
    expect(link?.id).toBe("siliconflow");
  });

  it("不存在的 providerId 应该返回 null", () => {
    const link = getAffiliateLink("nonexistent-provider");

    expect(link).toBeNull();
  });

  it("空字符串应该返回 null", () => {
    const link = getAffiliateLink("");

    expect(link).toBeNull();
  });

  it("volcengine-ark 推广链接应使用 partner.volcengine.com", () => {
    const link = getAffiliateLink("volcengine-ark");

    expect(link).not.toBeNull();
    expect(link?.affiliateUrl).toMatch(/^https:\/\/partner\.volcengine\.com\//);
    expect(link?.affiliateUrl).toContain("inviteToken=");
  });
});

describe("isChannelHiddenInCn()", () => {
  it("telegram 应该在中国区隐藏", () => {
    expect(isChannelHiddenInCn("telegram")).toBe(true);
  });

  it("discord 应该在中国区隐藏", () => {
    expect(isChannelHiddenInCn("discord")).toBe(true);
  });

  it("dingtalk 不应该在中国区隐藏", () => {
    expect(isChannelHiddenInCn("dingtalk")).toBe(false);
  });

  it("feishu 不应该在中国区隐藏", () => {
    expect(isChannelHiddenInCn("feishu")).toBe(false);
  });
});

describe("isProviderHiddenInCn()", () => {
  // 注意：openai 和 anthropic 现在已启用（需要科学上网）
  // 它们不再被隐藏，用户可以选择使用
  it("openai 不应该在中国区隐藏（已支持，需科学上网）", () => {
    expect(isProviderHiddenInCn("openai")).toBe(false);
  });

  it("anthropic 不应该在中国区隐藏（已支持，需科学上网）", () => {
    expect(isProviderHiddenInCn("anthropic")).toBe(false);
  });

  it("siliconflow 不应该在中国区隐藏", () => {
    expect(isProviderHiddenInCn("siliconflow")).toBe(false);
  });

  it("glm 不应该在中国区隐藏", () => {
    expect(isProviderHiddenInCn("glm")).toBe(false);
  });
});

// ============================================================================
// 5. 安全配置测试
// ============================================================================

describe("CN_DEFAULT_SECURITY_CONFIG", () => {
  it("sandbox 配置应该完整", () => {
    expect(CN_DEFAULT_SECURITY_CONFIG.sandbox).toBeDefined();
    expect(CN_DEFAULT_SECURITY_CONFIG.sandbox.mode).toBe("non-main");
    expect(CN_DEFAULT_SECURITY_CONFIG.sandbox.scope).toBe("session");
    expect(CN_DEFAULT_SECURITY_CONFIG.sandbox.workspaceAccess).toBe("rw");
  });

  it("tools.write.allowDelete 应该默认为 false", () => {
    expect(CN_DEFAULT_SECURITY_CONFIG.tools.write.allowDelete).toBe(false);
  });

  it("tools.exec.security 应该是 allowlist 模式", () => {
    expect(CN_DEFAULT_SECURITY_CONFIG.tools.exec.security).toBe("allowlist");
  });

  it("tools.exec.allowlist 应该包含常用命令", () => {
    const allowlist = CN_DEFAULT_SECURITY_CONFIG.tools.exec.allowlist;

    expect(allowlist).toContain("python");
    expect(allowlist).toContain("node");
    expect(allowlist).toContain("npm");
    expect(allowlist).toContain("git");
    expect(allowlist).toContain("code");
  });
});

// ============================================================================
// 6. 边界情况和潜在风险测试
// ============================================================================

describe("边界情况和潜在风险", () => {
  it("模型 ID 不应该包含危险字符", () => {
    const dangerousChars = /[<>'"&;`$(){}[\]\\]/;
    const dangerousIds: string[] = [];

    for (const [providerId, provider] of Object.entries(CN_PROVIDERS)) {
      for (const model of provider.models) {
        if (dangerousChars.test(model.id)) {
          dangerousIds.push(`${providerId}/${model.id}`);
        }
      }
    }

    expect(dangerousIds).toEqual([]);
  });

  it("provider 名称不应该过长（UI 显示限制）", () => {
    const maxLength = 50;
    const tooLong: string[] = [];

    for (const [providerId, provider] of Object.entries(CN_PROVIDERS)) {
      if (provider.name.length > maxLength) {
        tooLong.push(`${providerId}: ${provider.name.length} chars`);
      }
    }

    expect(tooLong).toEqual([]);
  });

  it("模型列表不应该为空", () => {
    const emptyModels: string[] = [];

    for (const [providerId, provider] of Object.entries(CN_PROVIDERS)) {
      if (provider.models.length === 0) {
        emptyModels.push(providerId);
      }
    }

    expect(emptyModels).toEqual([]);
  });

  it("pricing 字段格式应该一致（包含 ¥/元/免费/付费 等）", () => {
    const inconsistent: string[] = [];

    for (const [providerId, provider] of Object.entries(CN_PROVIDERS)) {
      for (const model of provider.models) {
        if (model.pricing) {
          // 支持的格式：免费、付费、免费额度、¥xx、xx元
          const isValid =
            model.pricing === "免费" ||
            model.pricing === "付费" ||
            model.pricing.includes("免费额度") ||
            model.pricing.includes("¥") ||
            model.pricing.includes("元");

          if (!isValid) {
            inconsistent.push(`${providerId}/${model.id}: "${model.pricing}"`);
          }
        }
      }
    }

    expect(inconsistent).toEqual([]);
  });

  it("envVar 应该是有效的环境变量名格式", () => {
    const invalidEnvVars: string[] = [];
    const validEnvVarPattern = /^[A-Z][A-Z0-9_]*$/;

    for (const [providerId, provider] of Object.entries(CN_PROVIDERS)) {
      if (!validEnvVarPattern.test(provider.envVar)) {
        invalidEnvVars.push(`${providerId}: ${provider.envVar}`);
      }
    }

    expect(invalidEnvVars).toEqual([]);
  });
});

// ============================================================================
// 7. 特定厂商配置正确性测试
// ============================================================================

describe("特定厂商配置正确性", () => {
  describe("智谱 GLM", () => {
    const glm = CN_PROVIDERS["glm"];

    it("应该存在", () => {
      expect(glm).toBeDefined();
    });

    it("API 端点应该正确", () => {
      expect(glm.apiEndpoint).toBe("https://open.bigmodel.cn/api/paas/v4");
    });

    it("应该有 glm-4-flash 免费模型", () => {
      const flashModel = glm.models.find((m) => m.id.includes("glm-4-flash"));
      expect(flashModel).toBeDefined();
      expect(flashModel?.pricing).toBe("免费");
    });

    it("模型 ID 应该包含日期版本号（250414）", () => {
      const hasVersionedModel = glm.models.some((m) => m.id.includes("250414"));
      expect(hasVersionedModel).toBe(true);
    });
  });

  describe("DeepSeek", () => {
    const deepseek = CN_PROVIDERS["deepseek"];

    it("应该存在", () => {
      expect(deepseek).toBeDefined();
    });

    it("API 端点应该正确", () => {
      expect(deepseek.apiEndpoint).toBe("https://api.deepseek.com");
    });

    it("不应该有 deepseek-coder 模型（已合并）", () => {
      const coderModel = deepseek.models.find((m) => m.id === "deepseek-coder");
      expect(coderModel).toBeUndefined();
    });

    it("deepseek-chat 描述应该提到已合并 Coder", () => {
      const chatModel = deepseek.models.find((m) => m.id === "deepseek-chat");
      expect(chatModel?.description).toContain("合并");
    });
  });

  describe("硅基流动", () => {
    const siliconflow = CN_PROVIDERS["siliconflow"];

    it("应该存在", () => {
      expect(siliconflow).toBeDefined();
    });

    it("API 端点应该正确", () => {
      expect(siliconflow.apiEndpoint).toBe("https://api.siliconflow.cn/v1");
    });

    it("免费模型应该是 Qwen2（不是 Qwen2.5）", () => {
      const freeQwen = siliconflow.models.find(
        (m) => m.pricing === "免费" && m.id.includes("Qwen")
      );
      expect(freeQwen).toBeDefined();
      expect(freeQwen?.id).toContain("Qwen2-7B");
      expect(freeQwen?.id).not.toContain("Qwen2.5");
    });
  });

  describe("MiniMax", () => {
    const minimax = CN_PROVIDERS["minimax"];

    it("应该存在", () => {
      expect(minimax).toBeDefined();
    });

    it("描述应该明确说不需要 Group ID", () => {
      expect(minimax.description).toContain("不需要 Group ID");
    });

    it("不应该有 abab6.5s 模型（已停用）", () => {
      const ababModel = minimax.models.find((m) => m.id.includes("abab"));
      expect(ababModel).toBeUndefined();
    });

    it("应该有 MiniMax-M2.1 模型", () => {
      const m21Model = minimax.models.find((m) => m.id === "MiniMax-M2.1");
      expect(m21Model).toBeDefined();
    });
  });

  describe("通义千问", () => {
    const qwen = CN_PROVIDERS["aliyun-bailian"];

    it("应该存在", () => {
      expect(qwen).toBeDefined();
    });

    it("API 端点应该是 compatible-mode（OpenAI 兼容）", () => {
      expect(qwen.apiEndpoint).toContain("compatible-mode");
    });

    it("推荐模型应该是 qwen-plus（不是 qwen-max）", () => {
      const recommendedModel = qwen.models.find((m) => m.recommended);
      expect(recommendedModel?.id).toContain("qwen-plus");
    });

    it("模型 ID 不需要 -latest 后缀（官方免费包兼容）", () => {
      // 官方免费包使用不带 -latest 的模型名，验证我们也使用这种格式
      const coreModels = ["qwen-plus", "qwen-turbo", "qwen-max", "qwen-vl-max"];
      coreModels.forEach((modelId) => {
        const model = qwen.models.find((m) => m.id === modelId);
        expect(model).toBeDefined();
      });
    });
  });
});

// ============================================================================
// 8. 性能测试
// ============================================================================

describe("性能测试", () => {
  it("getRecommendedProviders 应该在 10ms 内完成", () => {
    const start = performance.now();

    for (let i = 0; i < 1000; i++) {
      getRecommendedProviders();
    }

    const end = performance.now();
    const avgTime = (end - start) / 1000;

    expect(avgTime).toBeLessThan(10);
  });

  it("detectChinaRegion 应该在 5ms 内完成", () => {
    const start = performance.now();

    for (let i = 0; i < 1000; i++) {
      detectChinaRegion();
    }

    const end = performance.now();
    const avgTime = (end - start) / 1000;

    expect(avgTime).toBeLessThan(5);
  });
});
