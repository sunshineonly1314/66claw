import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the auth-profiles module to avoid filesystem access
vi.mock("./auth-profiles.js", () => ({
  ensureAuthProfileStore: vi.fn(),
  listProfilesForProvider: vi.fn().mockReturnValue([]),
  resolveApiKeyForProfile: vi.fn(),
  resolveAuthProfileOrder: vi.fn().mockReturnValue([]),
  resolveAuthStorePathForDisplay: vi.fn(),
}));

// Mock the shell-env module
vi.mock("../infra/shell-env.js", () => ({
  getShellEnvAppliedKeys: vi.fn().mockReturnValue([]),
}));

describe("hasProviderCredentials – local providers", () => {
  beforeEach(() => {
    vi.resetModules();
    // Clear any env vars that could interfere
    delete process.env.OLLAMA_API_KEY;
    delete process.env.VLLM_API_KEY;
    delete process.env.LMSTUDIO_API_KEY;
    delete process.env.LLAMACPP_API_KEY;
    delete process.env.LOCALAI_API_KEY;
  });

  it("returns true for ollama without any credentials", async () => {
    const { hasProviderCredentials } = await import("./model-auth.js");
    expect(hasProviderCredentials("ollama", undefined)).toBe(true);
  });

  it("returns true for vllm without any credentials", async () => {
    const { hasProviderCredentials } = await import("./model-auth.js");
    expect(hasProviderCredentials("vllm", undefined)).toBe(true);
  });

  it("returns true for lmstudio without any credentials", async () => {
    const { hasProviderCredentials } = await import("./model-auth.js");
    expect(hasProviderCredentials("lmstudio", undefined)).toBe(true);
  });

  it("returns true for llamacpp without any credentials", async () => {
    const { hasProviderCredentials } = await import("./model-auth.js");
    expect(hasProviderCredentials("llamacpp", undefined)).toBe(true);
  });

  it("returns true for localai without any credentials", async () => {
    const { hasProviderCredentials } = await import("./model-auth.js");
    expect(hasProviderCredentials("localai", undefined)).toBe(true);
  });

  it("is case-insensitive via normalizeProviderId", async () => {
    const { hasProviderCredentials } = await import("./model-auth.js");
    // normalizeProviderId lowercases the provider name
    expect(hasProviderCredentials("Ollama", undefined)).toBe(true);
  });

  it("does NOT return true for non-local provider without credentials", async () => {
    const { hasProviderCredentials } = await import("./model-auth.js");
    // A cloud provider with no env var, no profile, no config key → false
    expect(hasProviderCredentials("moonshot", undefined)).toBe(false);
  });
});
