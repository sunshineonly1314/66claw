import { describe, it, expect } from "vitest";
import { recommendDmScope } from "./dm-scope-auto.js";
import type { OpenClawCNConfig } from "../config/config.js";
import type { ChannelPlugin } from "../channels/plugins/types.js";

/** Minimal mock plugin for testing. */
function mockPlugin(
  id: string,
  opts: {
    label?: string;
    accountIds?: string[];
    enabled?: boolean;
    dmPolicy?: { policy: string; allowFrom?: (string | number)[] };
  } = {},
): ChannelPlugin {
  const accountIds = opts.accountIds ?? ["default"];
  return {
    id: id as any,
    meta: { label: opts.label ?? id, order: 0 },
    capabilities: {} as any,
    config: {
      listAccountIds: () => accountIds,
      resolveAccount: (_cfg: any, _aid?: string | null) => ({ id: _aid ?? "default" }),
      isEnabled: () => opts.enabled ?? true,
      isConfigured: () => true,
      applyAccountConfig: (p: any) => p.cfg,
    } as any,
    security: opts.dmPolicy
      ? {
          resolveDmPolicy: () => ({
            policy: opts.dmPolicy!.policy,
            allowFrom: opts.dmPolicy!.allowFrom ?? [],
            allowFromPath: `channels.${id}.dm.allowFrom`,
            approveHint: "",
          }),
        }
      : undefined,
  } as ChannelPlugin;
}

function emptyCfg(overrides?: Partial<OpenClawCNConfig>): OpenClawCNConfig {
  return { ...(overrides ?? {}) } as OpenClawCNConfig;
}

describe("recommendDmScope", () => {
  it("returns 'main' when no channels are configured", () => {
    const result = recommendDmScope({ cfg: emptyCfg(), plugins: [] });
    expect(result.recommended).toBe("main");
    expect(result.shouldUpgrade).toBe(false);
    expect(result.reason).toBe("no_channels");
    expect(result.configuredChannelCount).toBe(0);
  });

  it("returns 'main' when single channel, single user, no open policy", () => {
    const plugin = mockPlugin("telegram", {
      dmPolicy: { policy: "pairing", allowFrom: ["+15551234"] },
    });
    const result = recommendDmScope({ cfg: emptyCfg(), plugins: [plugin] });
    expect(result.recommended).toBe("main");
    expect(result.shouldUpgrade).toBe(false);
    expect(result.reason).toBe("single_user");
  });

  it("returns 'per-peer' for single channel with multiple allowFrom users", () => {
    const plugin = mockPlugin("telegram", {
      dmPolicy: { policy: "allowlist", allowFrom: ["+15551234", "+15559999"] },
    });
    const result = recommendDmScope({ cfg: emptyCfg(), plugins: [plugin] });
    expect(result.recommended).toBe("per-peer");
    expect(result.shouldUpgrade).toBe(true);
    expect(result.reason).toBe("multi_user");
    expect(result.multiUserChannels).toEqual(["telegram"]);
  });

  it("returns 'per-peer' for single channel with store allowFrom > 1", () => {
    const plugin = mockPlugin("telegram", {
      dmPolicy: { policy: "pairing", allowFrom: [] },
    });
    const counts = new Map([["telegram", 3]]);
    const result = recommendDmScope({
      cfg: emptyCfg(),
      plugins: [plugin],
      allowFromCounts: counts,
    });
    expect(result.recommended).toBe("per-peer");
    expect(result.shouldUpgrade).toBe(true);
  });

  it("returns 'per-channel-peer' for multiple channels", () => {
    const tg = mockPlugin("telegram");
    const dc = mockPlugin("discord");
    const result = recommendDmScope({ cfg: emptyCfg(), plugins: [tg, dc] });
    expect(result.recommended).toBe("per-channel-peer");
    expect(result.shouldUpgrade).toBe(true);
    expect(result.reason).toBe("multi_channel");
  });

  it("returns 'per-channel-peer' for single channel with wildcard DM policy", () => {
    const plugin = mockPlugin("telegram", {
      dmPolicy: { policy: "allowlist", allowFrom: ["*"] },
    });
    const result = recommendDmScope({ cfg: emptyCfg(), plugins: [plugin] });
    expect(result.recommended).toBe("per-channel-peer");
    expect(result.shouldUpgrade).toBe(true);
    expect(result.reason).toBe("open_dm_policy");
  });

  it("returns 'per-channel-peer' for single channel with open DM policy", () => {
    const plugin = mockPlugin("telegram", {
      dmPolicy: { policy: "open", allowFrom: [] },
    });
    const result = recommendDmScope({ cfg: emptyCfg(), plugins: [plugin] });
    expect(result.recommended).toBe("per-channel-peer");
    expect(result.shouldUpgrade).toBe(true);
    expect(result.reason).toBe("open_dm_policy");
  });

  it("returns 'per-account-channel-peer' when a channel has multiple accounts", () => {
    const plugin = mockPlugin("telegram", { accountIds: ["default", "bot2"] });
    const result = recommendDmScope({ cfg: emptyCfg(), plugins: [plugin] });
    expect(result.recommended).toBe("per-account-channel-peer");
    expect(result.shouldUpgrade).toBe(true);
    expect(result.reason).toBe("multi_account");
  });

  it("never downgrades: keeps current if already stricter", () => {
    const cfg = emptyCfg({ session: { dmScope: "per-account-channel-peer" } as any });
    const plugin = mockPlugin("telegram");
    const result = recommendDmScope({ cfg, plugins: [plugin] });
    expect(result.recommended).toBe("per-account-channel-peer");
    expect(result.shouldUpgrade).toBe(false);
    expect(result.reason).toBe("already_stricter");
  });

  it("reports isExplicit=true when dmScope is defined in config", () => {
    const cfg = emptyCfg({ session: { dmScope: "per-peer" } as any });
    const result = recommendDmScope({ cfg, plugins: [] });
    expect(result.isExplicit).toBe(true);
    expect(result.current).toBe("per-peer");
  });

  it("reports isExplicit=false when dmScope is undefined", () => {
    const result = recommendDmScope({ cfg: emptyCfg(), plugins: [] });
    expect(result.isExplicit).toBe(false);
    expect(result.current).toBe("main");
  });

  it("skips disabled plugins", () => {
    const plugin = mockPlugin("telegram", {
      enabled: false,
      dmPolicy: { policy: "open", allowFrom: ["*"] },
    });
    const result = recommendDmScope({ cfg: emptyCfg(), plugins: [plugin] });
    expect(result.recommended).toBe("main");
    expect(result.configuredChannelCount).toBe(0);
  });

  it("skips plugins with no accounts", () => {
    const plugin = mockPlugin("telegram", { accountIds: [] });
    const result = recommendDmScope({ cfg: emptyCfg(), plugins: [plugin] });
    expect(result.recommended).toBe("main");
    expect(result.configuredChannelCount).toBe(0);
  });
});
