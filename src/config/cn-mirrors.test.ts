import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BINARY_DOWNLOAD_MIRRORS,
  CLAWDSKILLSPROXY_CONFIG,
  CLI_TOOL_MIRRORS,
  getClawdSkillsProxyHeaders,
  getGitHubProxy,
  getGitHubProxies,
  getGitHubProxyUrls,
  getMirrorStats,
  getNpmMirrorUrl,
  getNpmMirrors,
  getPipMirrorUrl,
  getPipMirrors,
  getGoProxy,
  getHKBinaryTools,
  getNodeBinaryMirror,
  getSignalCliDownloadUrls,
  getToolInstallCommand,
  isToolHostedOnHK,
  listSupportedTools,
  PACKAGE_MANAGER_MIRRORS,
  shouldUseCNMirror,
} from "./cn-mirrors.js";

describe("token consistency", () => {
  it("signalCli mirror uses unified token clawdbotCN778", () => {
    expect(BINARY_DOWNLOAD_MIRRORS.signalCli.token).toBe("clawdbotCN778");
  });

  it("CLAWDSKILLSPROXY_CONFIG uses unified token clawdbotCN778", () => {
    expect(CLAWDSKILLSPROXY_CONFIG.token).toBe("clawdbotCN778");
  });

  it("getClawdSkillsProxyHeaders uses Bearer token", () => {
    const headers = getClawdSkillsProxyHeaders();
    expect(headers.Authorization).toBe("Bearer clawdbotCN778");
    expect(headers["User-Agent"]).toBe("OpenClawCN/1.0");
  });
});

describe("shouldUseCNMirror", () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = {
      OPENCLAWCN_USE_CN_MIRROR: process.env.OPENCLAWCN_USE_CN_MIRROR,
      OPENCLAWCN_REGION: process.env.OPENCLAWCN_REGION,
      TZ: process.env.TZ,
    };
    delete process.env.OPENCLAWCN_USE_CN_MIRROR;
    delete process.env.OPENCLAWCN_REGION;
    delete process.env.TZ;
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

  it("returns true when OPENCLAWCN_USE_CN_MIRROR=1", () => {
    process.env.OPENCLAWCN_USE_CN_MIRROR = "1";
    expect(shouldUseCNMirror()).toBe(true);
  });

  it("returns false when OPENCLAWCN_USE_CN_MIRROR=0", () => {
    process.env.OPENCLAWCN_USE_CN_MIRROR = "0";
    expect(shouldUseCNMirror()).toBe(false);
  });

  it("returns true when OPENCLAWCN_REGION=cn", () => {
    process.env.OPENCLAWCN_REGION = "cn";
    expect(shouldUseCNMirror()).toBe(true);
  });

  it("detects Shanghai timezone", () => {
    vi.spyOn(Intl, "DateTimeFormat").mockReturnValue({
      resolvedOptions: () =>
        ({ timeZone: "Asia/Shanghai" }) as Intl.ResolvedDateTimeFormatOptions,
    } as Intl.DateTimeFormat);
    expect(shouldUseCNMirror()).toBe(true);
  });

  it("detects Asia/Urumqi timezone", () => {
    vi.spyOn(Intl, "DateTimeFormat").mockReturnValue({
      resolvedOptions: () =>
        ({ timeZone: "Asia/Urumqi" }) as Intl.ResolvedDateTimeFormatOptions,
    } as Intl.DateTimeFormat);
    expect(shouldUseCNMirror()).toBe(true);
  });

  it("detects Etc/GMT-8 timezone (Windows, means UTC+8)", () => {
    vi.spyOn(Intl, "DateTimeFormat").mockReturnValue({
      resolvedOptions: () =>
        ({ timeZone: "Etc/GMT-8" }) as Intl.ResolvedDateTimeFormatOptions,
    } as Intl.DateTimeFormat);
    expect(shouldUseCNMirror()).toBe(true);
  });

  it("detects China Standard Time", () => {
    vi.spyOn(Intl, "DateTimeFormat").mockReturnValue({
      resolvedOptions: () =>
        ({ timeZone: "China Standard Time" }) as Intl.ResolvedDateTimeFormatOptions,
    } as Intl.DateTimeFormat);
    expect(shouldUseCNMirror()).toBe(true);
  });
});

describe("mirror URL helpers", () => {
  it("getNpmMirrorUrl returns Taobao mirror", () => {
    expect(getNpmMirrorUrl()).toBe("https://registry.npmmirror.com");
  });

  it("getPipMirrorUrl returns Tsinghua mirror", () => {
    expect(getPipMirrorUrl()).toBe("https://pypi.tuna.tsinghua.edu.cn/simple");
  });

  it("getGoProxy returns Qiniu mirror", () => {
    expect(getGoProxy()).toBe("https://goproxy.cn");
  });

  it("getNodeBinaryMirror returns Taobao node mirror", () => {
    expect(getNodeBinaryMirror()).toContain("npmmirror.com");
  });

  it("getNpmMirrors returns 3 entries", () => {
    const mirrors = getNpmMirrors();
    expect(mirrors.length).toBe(3);
    expect(mirrors[0]).toContain("npmmirror.com");
  });

  it("getPipMirrors returns 3 entries", () => {
    const mirrors = getPipMirrors();
    expect(mirrors.length).toBe(3);
    expect(mirrors[0]).toContain("tsinghua");
  });

  it("getGitHubProxies returns 3 entries", () => {
    const proxies = getGitHubProxies();
    expect(proxies.length).toBe(3);
    expect(proxies[0]).toContain("gh-proxy.com");
  });

  it("getGitHubProxy wraps github.com URLs", () => {
    const proxied = getGitHubProxy("https://github.com/user/repo/releases/v1.0.0");
    expect(proxied).toContain("gh-proxy.com");
    expect(proxied).toContain("github.com");
  });

  it("getGitHubProxy passes through non-github URLs", () => {
    const url = "https://example.com/file.tar.gz";
    expect(getGitHubProxy(url)).toBe(url);
  });

  it("getGitHubProxyUrls returns 3 proxied URLs for github URLs", () => {
    const urls = getGitHubProxyUrls("https://github.com/user/repo/file.tar.gz");
    expect(urls.length).toBe(3);
  });

  it("getGitHubProxyUrls returns original for non-github URLs", () => {
    const urls = getGitHubProxyUrls("https://example.com/file.tar.gz");
    expect(urls).toEqual(["https://example.com/file.tar.gz"]);
  });
});

describe("PACKAGE_MANAGER_MIRRORS", () => {
  it("all entries have primary and fallback", () => {
    for (const [name, config] of Object.entries(PACKAGE_MANAGER_MIRRORS)) {
      expect(config.primary, name + ": primary").toBeTruthy();
      expect(config.fallback, name + ": fallback").toBeTruthy();
      expect(config.description, name + ": description").toBeTruthy();
    }
  });
});

describe("Signal CLI mirrors", () => {
  it("getSignalCliDownloadUrls returns at least one URL", () => {
    const urls = getSignalCliDownloadUrls("0.13.4", "linux");
    expect(urls.length).toBeGreaterThan(0);
    expect(urls[urls.length - 1]).toContain("github.com");
  });
});

describe("HK binary hosting", () => {
  it("isToolHostedOnHK returns true for ordercli", () => {
    expect(isToolHostedOnHK("ordercli")).toBe(true);
  });

  it("isToolHostedOnHK returns false for unknown tool", () => {
    expect(isToolHostedOnHK("nonexistent")).toBe(false);
  });

  it("getHKBinaryTools returns list of tools", () => {
    const tools = getHKBinaryTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools).toContain("peekaboo");
  });
});

describe("CLI_TOOL_MIRRORS", () => {
  it("listSupportedTools returns non-empty list", () => {
    const tools = listSupportedTools();
    expect(tools.length).toBeGreaterThan(50);
  });

  it("getMirrorStats returns counts", () => {
    const stats = getMirrorStats();
    expect(stats.packageManagers).toBeGreaterThan(0);
    expect(stats.binaryMirrors).toBeGreaterThan(0);
    expect(stats.cliTools).toBeGreaterThan(50);
    expect(stats.toolsWithCNMirror).toBeGreaterThan(10);
  });

  it("no double-CN artifacts in tool names", () => {
    for (const toolName of Object.keys(CLI_TOOL_MIRRORS)) {
      expect(toolName).not.toContain("clawcncn");
      expect(toolName).not.toContain("openclawcncn");
    }
  });
});

describe("getToolInstallCommand", () => {
  it("returns npm install for jest on linux", () => {
    const cmd = getToolInstallCommand("jest", "linux");
    expect(cmd).not.toBeNull();
    expect(cmd?.command).toContain("npm");
  });

  it("returns null for unknown tool", () => {
    expect(getToolInstallCommand("nonexistent-tool", "linux")).toBeNull();
  });

  it("returns null for tool with no install methods", () => {
    expect(getToolInstallCommand("wttr", "linux")).toBeNull();
  });
});
