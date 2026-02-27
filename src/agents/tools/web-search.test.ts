import { describe, expect, it, afterEach } from "vitest";

import { __testing } from "./web-search.js";

const {
  inferPerplexityBaseUrlFromApiKey,
  resolvePerplexityBaseUrl,
  normalizeFreshness,
  resolveBochaApiKey,
  toBochaFreshness,
} = __testing;

describe("web_search perplexity baseUrl defaults", () => {
  it("detects a Perplexity key prefix", () => {
    expect(inferPerplexityBaseUrlFromApiKey("pplx-123")).toBe("direct");
  });

  it("detects an OpenRouter key prefix", () => {
    expect(inferPerplexityBaseUrlFromApiKey("sk-or-v1-123")).toBe("openrouter");
  });

  it("returns undefined for unknown key formats", () => {
    expect(inferPerplexityBaseUrlFromApiKey("unknown-key")).toBeUndefined();
  });

  it("prefers explicit baseUrl over key-based defaults", () => {
    expect(resolvePerplexityBaseUrl({ baseUrl: "https://example.com" }, "config", "pplx-123")).toBe(
      "https://example.com",
    );
  });

  it("defaults to direct when using PERPLEXITY_API_KEY", () => {
    expect(resolvePerplexityBaseUrl(undefined, "perplexity_env")).toBe("https://api.perplexity.ai");
  });

  it("defaults to OpenRouter when using OPENROUTER_API_KEY", () => {
    expect(resolvePerplexityBaseUrl(undefined, "openrouter_env")).toBe(
      "https://openrouter.ai/api/v1",
    );
  });

  it("defaults to direct when config key looks like Perplexity", () => {
    expect(resolvePerplexityBaseUrl(undefined, "config", "pplx-123")).toBe(
      "https://api.perplexity.ai",
    );
  });

  it("defaults to OpenRouter when config key looks like OpenRouter", () => {
    expect(resolvePerplexityBaseUrl(undefined, "config", "sk-or-v1-123")).toBe(
      "https://openrouter.ai/api/v1",
    );
  });

  it("defaults to OpenRouter for unknown config key formats", () => {
    expect(resolvePerplexityBaseUrl(undefined, "config", "weird-key")).toBe(
      "https://openrouter.ai/api/v1",
    );
  });
});

describe("web_search freshness normalization", () => {
  it("accepts Brave shortcut values", () => {
    expect(normalizeFreshness("pd")).toBe("pd");
    expect(normalizeFreshness("PW")).toBe("pw");
  });

  it("accepts valid date ranges", () => {
    expect(normalizeFreshness("2024-01-01to2024-01-31")).toBe("2024-01-01to2024-01-31");
  });

  it("rejects invalid date ranges", () => {
    expect(normalizeFreshness("2024-13-01to2024-01-31")).toBeUndefined();
    expect(normalizeFreshness("2024-02-30to2024-03-01")).toBeUndefined();
    expect(normalizeFreshness("2024-03-10to2024-03-01")).toBeUndefined();
  });
});

describe("web_search bocha freshness mapping", () => {
  it("maps Brave shortcuts to Bocha values", () => {
    expect(toBochaFreshness("pd")).toBe("oneDay");
    expect(toBochaFreshness("pw")).toBe("oneWeek");
    expect(toBochaFreshness("pm")).toBe("oneMonth");
    expect(toBochaFreshness("py")).toBe("oneYear");
  });

  it("maps Brave date range to Bocha date range format", () => {
    expect(toBochaFreshness("2024-01-01to2024-06-30")).toBe("2024-01-01..2024-06-30");
  });

  it("returns noLimit for unrecognized values", () => {
    expect(toBochaFreshness("unknown")).toBe("noLimit");
  });

  it("returns undefined for empty/undefined input", () => {
    expect(toBochaFreshness(undefined)).toBeUndefined();
    expect(toBochaFreshness("")).toBeUndefined();
  });
});

describe("web_search bocha API key resolution", () => {
  const origEnv = process.env.BOCHA_API_KEY;

  afterEach(() => {
    if (origEnv === undefined) {
      delete process.env.BOCHA_API_KEY;
    } else {
      process.env.BOCHA_API_KEY = origEnv;
    }
  });

  it("resolves from config apiKey", () => {
    expect(resolveBochaApiKey({ apiKey: "sk-bocha-test-key" })).toBe("sk-bocha-test-key");
  });

  it("resolves from BOCHA_API_KEY env var", () => {
    process.env.BOCHA_API_KEY = "sk-env-bocha-key";
    expect(resolveBochaApiKey({})).toBe("sk-env-bocha-key");
  });

  it("prefers config over env var", () => {
    process.env.BOCHA_API_KEY = "sk-env-bocha-key";
    expect(resolveBochaApiKey({ apiKey: "sk-config-bocha-key" })).toBe("sk-config-bocha-key");
  });

  it("returns undefined when no key is available", () => {
    delete process.env.BOCHA_API_KEY;
    expect(resolveBochaApiKey({})).toBeUndefined();
  });

  it("returns undefined for empty/undefined config", () => {
    delete process.env.BOCHA_API_KEY;
    expect(resolveBochaApiKey(undefined)).toBeUndefined();
    expect(resolveBochaApiKey({})).toBeUndefined();
  });
});
