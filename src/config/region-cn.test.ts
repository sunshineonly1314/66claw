import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CN_PROVIDERS,
  CN_REGION_CONFIG,
  detectChinaRegion,
  getAffiliateLink,
  getAffiliateLinks,
  getCnRegionConfig,
  getRecommendedProviders,
  isChannelHiddenInCn,
  isProviderHiddenInCn,
  isSkillDeprioritizedInCn,
  isSkillHiddenInCn,
} from "./region-cn.js";

describe("detectChinaRegion", () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = {
      OPENCLAWCN_REGION: process.env.OPENCLAWCN_REGION,
      TZ: process.env.TZ,
      LANG: process.env.LANG,
      LC_ALL: process.env.LC_ALL,
    };
    delete process.env.OPENCLAWCN_REGION;
    delete process.env.TZ;
    delete process.env.LANG;
    delete process.env.LC_ALL;
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    vi.restoreAllMocks();
  });

  it("returns true when OPENCLAWCN_REGION=cn", () => {
    process.env.OPENCLAWCN_REGION = "cn";
    expect(detectChinaRegion()).toBe(true);
  });

  it("returns false when OPENCLAWCN_REGION=global", () => {
    process.env.OPENCLAWCN_REGION = "global";
    expect(detectChinaRegion()).toBe(false);
  });

  it("detects Asia/Shanghai timezone via Intl", () => {
    vi.spyOn(Intl, "DateTimeFormat").mockReturnValue({
      resolvedOptions: () =>
        ({ timeZone: "Asia/Shanghai", locale: "en-US" }) as Intl.ResolvedDateTimeFormatOptions,
    } as Intl.DateTimeFormat);
    expect(detectChinaRegion()).toBe(true);
  });

  it("detects Asia/Chongqing timezone via Intl", () => {
    vi.spyOn(Intl, "DateTimeFormat").mockReturnValue({
      resolvedOptions: () =>
        ({ timeZone: "Asia/Chongqing", locale: "en-US" }) as Intl.ResolvedDateTimeFormatOptions,
    } as Intl.DateTimeFormat);
    expect(detectChinaRegion()).toBe(true);
  });

  it("detects Asia/Urumqi timezone via Intl", () => {
    vi.spyOn(Intl, "DateTimeFormat").mockReturnValue({
      resolvedOptions: () =>
        ({ timeZone: "Asia/Urumqi", locale: "en-US" }) as Intl.ResolvedDateTimeFormatOptions,
    } as Intl.DateTimeFormat);
    expect(detectChinaRegion()).toBe(true);
  });

  it("detects zh-CN locale via Intl", () => {
    vi.spyOn(Intl, "DateTimeFormat").mockReturnValue({
      resolvedOptions: () =>
        ({ timeZone: "America/New_York", locale: "zh-CN" }) as Intl.ResolvedDateTimeFormatOptions,
    } as Intl.DateTimeFormat);
    expect(detectChinaRegion()).toBe(true);
  });

  it("detects zh-Hans locale via Intl", () => {
    vi.spyOn(Intl, "DateTimeFormat").mockReturnValue({
      resolvedOptions: () =>
        ({
          timeZone: "America/New_York",
          locale: "zh-Hans-CN",
        }) as Intl.ResolvedDateTimeFormatOptions,
    } as Intl.DateTimeFormat);
    expect(detectChinaRegion()).toBe(true);
  });

  it("detects TZ=Asia/Shanghai", () => {
    vi.spyOn(Intl, "DateTimeFormat").mockReturnValue({
      resolvedOptions: () =>
        ({ timeZone: "UTC", locale: "en-US" }) as Intl.ResolvedDateTimeFormatOptions,
    } as Intl.DateTimeFormat);
    process.env.TZ = "Asia/Shanghai";
    expect(detectChinaRegion()).toBe(true);
  });

  it("detects TZ=Asia/Urumqi", () => {
    vi.spyOn(Intl, "DateTimeFormat").mockReturnValue({
      resolvedOptions: () =>
        ({ timeZone: "UTC", locale: "en-US" }) as Intl.ResolvedDateTimeFormatOptions,
    } as Intl.DateTimeFormat);
    process.env.TZ = "Asia/Urumqi";
    expect(detectChinaRegion()).toBe(true);
  });

  it("detects TZ=CST-8", () => {
    vi.spyOn(Intl, "DateTimeFormat").mockReturnValue({
      resolvedOptions: () =>
        ({ timeZone: "UTC", locale: "en-US" }) as Intl.ResolvedDateTimeFormatOptions,
    } as Intl.DateTimeFormat);
    process.env.TZ = "CST-8";
    expect(detectChinaRegion()).toBe(true);
  });

  it("detects LANG=zh_CN.UTF-8", () => {
    vi.spyOn(Intl, "DateTimeFormat").mockReturnValue({
      resolvedOptions: () =>
        ({ timeZone: "UTC", locale: "en-US" }) as Intl.ResolvedDateTimeFormatOptions,
    } as Intl.DateTimeFormat);
    process.env.LANG = "zh_CN.UTF-8";
    expect(detectChinaRegion()).toBe(true);
  });

  it("returns false for US timezone and locale", () => {
    vi.spyOn(Intl, "DateTimeFormat").mockReturnValue({
      resolvedOptions: () =>
        ({ timeZone: "America/New_York", locale: "en-US" }) as Intl.ResolvedDateTimeFormatOptions,
    } as Intl.DateTimeFormat);
    expect(detectChinaRegion()).toBe(false);
  });

  it("handles Intl.DateTimeFormat throwing gracefully", () => {
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(() => {
      throw new Error("Intl not available");
    });
    expect(detectChinaRegion()).toBe(false);
  });
});

describe("CN_PROVIDERS", () => {
  it("contains tencent-hunyuan provider", () => {
    expect(CN_PROVIDERS["tencent-hunyuan"]).toBeDefined();
    expect(CN_PROVIDERS["tencent-hunyuan"].envVar).toBe("HUNYUAN_SECRET_ID");
    expect(CN_PROVIDERS["tencent-hunyuan"].models.length).toBeGreaterThan(0);
  });

  it("all providers have required fields", () => {
    for (const [id, provider] of Object.entries(CN_PROVIDERS)) {
      expect(provider.id, id + ": id").toBe(id);
      expect(provider.name, id + ": name").toBeTruthy();
      expect(provider.apiEndpoint, id + ": apiEndpoint").toBeTruthy();
      expect(provider.envVar, id + ": envVar").toBeTruthy();
      expect(provider.docsUrl, id + ": docsUrl").toBeTruthy();
      expect(provider.models.length, id + ": models").toBeGreaterThan(0);
    }
  });

  it("has correct API endpoints for CN providers", () => {
    expect(CN_PROVIDERS.siliconflow.apiEndpoint).toBe("https://api.siliconflow.cn/v1");
    expect(CN_PROVIDERS.moonshot.apiEndpoint).toBe("https://api.moonshot.cn/v1");
    expect(CN_PROVIDERS.deepseek.apiEndpoint).toBe("https://api.deepseek.com");
    expect(CN_PROVIDERS["aliyun-bailian"].apiEndpoint).toBe(
      "https://dashscope.aliyuncs.com/compatible-mode/v1",
    );
    expect(CN_PROVIDERS["volcengine-ark"].apiEndpoint).toBe(
      "https://ark.cn-beijing.volces.com/api/v3",
    );
  });

  it("moonshot endpoint uses .cn not .ai", () => {
    expect(CN_PROVIDERS.moonshot.apiEndpoint).toContain(".cn");
    expect(CN_PROVIDERS.moonshot.apiEndpoint).not.toContain(".ai");
  });
});

describe("CN_REGION_CONFIG", () => {
  it("includes tencent-hunyuan in recommendedProviders", () => {
    expect(CN_REGION_CONFIG.recommendedProviders).toContain("tencent-hunyuan");
  });

  it("includes dingtalk and feishu in recommendedChannels", () => {
    expect(CN_REGION_CONFIG.recommendedChannels).toContain("dingtalk");
    expect(CN_REGION_CONFIG.recommendedChannels).toContain("feishu");
  });

  it("hides international-only channels", () => {
    expect(CN_REGION_CONFIG.hiddenChannels).toContain("telegram");
    expect(CN_REGION_CONFIG.hiddenChannels).toContain("discord");
    expect(CN_REGION_CONFIG.hiddenChannels).toContain("whatsapp");
  });

  it("hides clawdhub skill", () => {
    expect(isSkillHiddenInCn("clawdhub")).toBe(true);
  });

  it("deprioritizes overseas-dependent skills", () => {
    expect(isSkillDeprioritizedInCn("gemini")).toBe(true);
    expect(isSkillDeprioritizedInCn("oracle")).toBe(true);
    expect(isSkillDeprioritizedInCn("voice-call")).toBe(true);
  });

  it("does NOT deprioritize openai-whisper (local CLI, not API)", () => {
    expect(isSkillDeprioritizedInCn("openai-whisper")).toBe(false);
  });
});

describe("utility functions", () => {
  it("getCnRegionConfig returns full config", () => {
    const cfg = getCnRegionConfig();
    expect(cfg.recommendedProviders.length).toBeGreaterThan(0);
    expect(cfg.providers).toBeDefined();
    expect(cfg.affiliateLinks).toBeDefined();
  });

  it("getRecommendedProviders returns provider objects in order", () => {
    const providers = getRecommendedProviders();
    expect(providers.length).toBeGreaterThan(0);
    expect(providers[0].id).toBe("kimi-code");
  });

  it("getAffiliateLinks returns sorted by priority", () => {
    const links = getAffiliateLinks();
    expect(links.length).toBeGreaterThan(0);
    for (let i = 1; i < links.length; i++) {
      expect(links[i].priority).toBeGreaterThanOrEqual(links[i - 1].priority);
    }
  });

  it("getAffiliateLink returns null for unknown provider", () => {
    expect(getAffiliateLink("nonexistent")).toBeNull();
  });

  it("isChannelHiddenInCn returns true for telegram", () => {
    expect(isChannelHiddenInCn("telegram")).toBe(true);
  });

  it("isChannelHiddenInCn returns false for dingtalk", () => {
    expect(isChannelHiddenInCn("dingtalk")).toBe(false);
  });

  it("isProviderHiddenInCn returns true for openrouter", () => {
    expect(isProviderHiddenInCn("openrouter")).toBe(false);
  });

  it("isProviderHiddenInCn returns false for siliconflow", () => {
    expect(isProviderHiddenInCn("siliconflow")).toBe(false);
  });
});
