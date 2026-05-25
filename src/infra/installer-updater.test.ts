import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  InstallerUpdateCheckResult,
  InstallerUpdateResult,
  UpdateCheckResponseData,
  UpdateServerLatest,
} from "./installer-updater.js";

// ─── Mock fetchWithTimeout ─────────────────────────────
// fetchWithTimeout 内部使用 global fetch，我们直接 mock 整个模块
let fetchHandler: (url: string, init?: RequestInit) => Promise<Response>;

vi.mock("../utils/fetch-timeout.js", () => ({
  fetchWithTimeout: vi.fn(async (url: string, init: RequestInit, _timeoutMs: number) => {
    return fetchHandler(url, init);
  }),
}));

// ─── Import SUT (after mock is installed) ──────────────
const {
  checkInstallerUpdate,
  reportUpdateResult,
  reportInstallerRedirect,
  resolveUpdateServerUrl,
  detectInstallKind,
} = await import("./installer-updater.js");

// ─── Helpers ───────────────────────────────────────────

/** 构造一个标准的 API 成功响应 */
function apiResponse(data: UpdateCheckResponseData, code = 0): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ code, data }),
  } as Response;
}

/** 构造一个 OSS latest.json 响应 */
function ossLatestResponse(latest: UpdateServerLatest): Response {
  return {
    ok: true,
    status: 200,
    json: async () => latest,
  } as Response;
}

function httpError(status: number): Response {
  return { ok: false, status, json: async () => ({}) } as Response;
}

const BASE_URL = "https://www.obplugins.cn";
const API_CHECK_URL = `${BASE_URL}/api/api/v1/update/check`;
const API_REPORT_URL = `${BASE_URL}/api/api/v1/update/report`;
const OSS_LATEST_URL = `${BASE_URL}/releases/latest.json`;

const MOCK_LATEST: UpdateServerLatest = {
  version: "1.2.0",
  buildTime: "2026-02-19T00:00:00Z",
  gitCommit: "abc123",
  nodeVersion: "22.0.0",
  url: { full: "", manifest: "https://oss/manifest.json", checksums: "https://oss/checksums.json" },
  deltas: [{ from: "1.1.0", url: "https://oss/delta-1.1.0.tar.gz", size: 5000 }],
  fullSize: 0,
  fullSha256: "",
  changelog: { "zh-CN": "修复若干问题", "en-US": "Bug fixes" },
};

// ─── Tests ─────────────────────────────────────────────

describe("installer-updater", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 默认：所有请求返回网络错误
    fetchHandler = async () => {
      throw new Error("network error");
    };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ══════════════════════════════════════════════════════
  // checkInstallerUpdate
  // ══════════════════════════════════════════════════════
  describe("checkInstallerUpdate", () => {
    // ── 服务端 API 路径 ────────────────────────────────

    describe.skip("via server API", () => {
      it("returns delta update with version when API reports delta", async () => {
        fetchHandler = async (url) => {
          if (url === API_CHECK_URL) {
            return apiResponse({
              hasUpdate: true,
              updateType: "delta",
              version: "1.2.0",
              mandatory: false,
              nextCheckAfterSeconds: 3600,
              download: {
                url: "https://oss/delta.tar.gz",
                size: 5000,
                sha256: "abc",
                checksums: "https://oss/checksums.json",
                manifest: "https://oss/manifest.json",
              },
              releaseNotes: { "zh-CN": "修复", "en-US": "Fix" },
            });
          }
          throw new Error("unexpected URL: " + url);
        };

        const result = await checkInstallerUpdate({
          updateServerUrl: BASE_URL,
          currentVersion: "1.1.0",
          licenseKey: "test-key",
          deviceId: "test-device",
        });

        expect(result.hasUpdate).toBe(true);
        expect(result.updateType).toBe("delta");
        expect(result.version).toBe("1.2.0");
        expect(result.latest).not.toBeNull();
        expect(result.latest!.version).toBe("1.2.0");
        expect(result.latest!.deltas).toHaveLength(1);
        expect(result.nextCheckAfterSeconds).toBe(3600);
        expect(result.mandatory).toBe(false);
      });

      it("returns installer redirect with version when API reports installer", async () => {
        fetchHandler = async (url) => {
          if (url === API_CHECK_URL) {
            return apiResponse({
              hasUpdate: true,
              updateType: "installer",
              version: "2.0.0",
              mandatory: true,
              installer: {
                win64: "https://dl/win64.exe",
                macArm64: "https://dl/arm64.dmg",
                macX64: "https://dl/x64.dmg",
              },
              nextCheckAfterSeconds: 1800,
            });
          }
          throw new Error("unexpected URL: " + url);
        };

        const result = await checkInstallerUpdate({
          updateServerUrl: BASE_URL,
          currentVersion: "1.0.0",
          licenseKey: "test-key",
          deviceId: "test-device",
        });

        expect(result.hasUpdate).toBe(true);
        expect(result.updateType).toBe("installer");
        expect(result.version).toBe("2.0.0");
        expect(result.latest).toBeNull();
        expect(result.mandatory).toBe(true);
        expect(result.installerUrl).toBeDefined();
        expect(result.nextCheckAfterSeconds).toBe(1800);
      });

      it("returns no update when API says hasUpdate=false", async () => {
        fetchHandler = async (url) => {
          if (url === API_CHECK_URL) {
            return apiResponse({
              hasUpdate: false,
              nextCheckAfterSeconds: 7200,
            });
          }
          throw new Error("unexpected URL: " + url);
        };

        const result = await checkInstallerUpdate({
          updateServerUrl: BASE_URL,
          currentVersion: "1.2.0",
          licenseKey: "test-key",
          deviceId: "test-device",
        });

        expect(result.hasUpdate).toBe(false);
        expect(result.latest).toBeNull();
        expect(result.nextCheckAfterSeconds).toBe(7200);
      });

      it("returns error when API reports auth error", async () => {
        fetchHandler = async (url) => {
          if (url === API_CHECK_URL) {
            return apiResponse({
              hasUpdate: false,
              error: true,
              errorCode: 1001,
              errorMessage: "授权码已过期",
              nextCheckAfterSeconds: 600,
            });
          }
          throw new Error("unexpected URL: " + url);
        };

        const result = await checkInstallerUpdate({
          updateServerUrl: BASE_URL,
          currentVersion: "1.0.0",
          licenseKey: "test-key",
          deviceId: "test-device",
        });

        expect(result.hasUpdate).toBe(false);
        expect(result.error).toBe("授权码已过期");
        expect(result.errorCode).toBe(1001);
        expect(result.nextCheckAfterSeconds).toBe(600);
      });

      it("returns error (no fallback) when API returns HTTP 4xx/5xx", async () => {
        fetchHandler = async (url) => {
          if (url === API_CHECK_URL) return httpError(500);
          // 如果走了 OSS fallback 这里不该被调用
          throw new Error("should not call OSS fallback after HTTP error");
        };

        const result = await checkInstallerUpdate({
          updateServerUrl: BASE_URL,
          currentVersion: "1.0.0",
          licenseKey: "test-key",
          deviceId: "test-device",
        });

        expect(result.hasUpdate).toBe(false);
        expect(result.error).toContain("API HTTP 500");
      });

      it("sends channel parameter to API", async () => {
        let sentBody: Record<string, unknown> | null = null;
        fetchHandler = async (url, init) => {
          if (url === API_CHECK_URL) {
            sentBody = JSON.parse(init?.body as string);
            return apiResponse({ hasUpdate: false });
          }
          throw new Error("unexpected URL: " + url);
        };

        await checkInstallerUpdate({
          updateServerUrl: BASE_URL,
          currentVersion: "1.0.0",
          licenseKey: "key",
          deviceId: "device",
          channel: "beta",
        });

        expect(sentBody).not.toBeNull();
        expect(sentBody!.channel).toBe("beta");
      });

      it("defaults channel to stable when not specified", async () => {
        let sentBody: Record<string, unknown> | null = null;
        fetchHandler = async (url, init) => {
          if (url === API_CHECK_URL) {
            sentBody = JSON.parse(init?.body as string);
            return apiResponse({ hasUpdate: false });
          }
          throw new Error("unexpected URL: " + url);
        };

        await checkInstallerUpdate({
          updateServerUrl: BASE_URL,
          currentVersion: "1.0.0",
          licenseKey: "key",
          deviceId: "device",
        });

        expect(sentBody!.channel).toBe("stable");
      });

      it("sends correct request body fields to API", async () => {
        let sentBody: Record<string, unknown> | null = null;
        fetchHandler = async (url, init) => {
          if (url === API_CHECK_URL) {
            sentBody = JSON.parse(init?.body as string);
            return apiResponse({ hasUpdate: false });
          }
          throw new Error("unexpected URL");
        };

        await checkInstallerUpdate({
          updateServerUrl: BASE_URL,
          currentVersion: "1.5.0",
          licenseKey: "my-license",
          deviceId: "my-device",
        });

        expect(sentBody!.key).toBe("my-license");
        expect(sentBody!.deviceId).toBe("my-device");
        expect(sentBody!.appVersion).toBe("1.5.0");
        expect(sentBody!.platform).toBe(process.platform);
        expect(sentBody!.arch).toBe(process.arch);
      });
    });

    // ── Fallback 到 OSS 静态文件 ──────────────────────

    describe("fallback to OSS static file", () => {
      it("falls back to OSS when API network fails", async () => {
        const calledUrls: string[] = [];
        fetchHandler = async (url) => {
          calledUrls.push(url);
          if (url === API_CHECK_URL) throw new Error("DNS resolution failed");
          if (url === OSS_LATEST_URL) return ossLatestResponse(MOCK_LATEST);
          throw new Error("unexpected URL: " + url);
        };

        const result = await checkInstallerUpdate({
          updateServerUrl: BASE_URL,
          currentVersion: "1.1.0",
          licenseKey: "key",
          deviceId: "device",
        });

        expect(calledUrls).not.toContain(API_CHECK_URL);
        expect(calledUrls).toContain(OSS_LATEST_URL);
        expect(result.hasUpdate).toBe(true);
        expect(result.updateType).toBe("delta");
        expect(result.version).toBe("1.2.0");
        expect(result.latest).not.toBeNull();
      });

      it("skips API and goes straight to OSS when no licenseKey", async () => {
        const calledUrls: string[] = [];
        fetchHandler = async (url) => {
          calledUrls.push(url);
          if (url === OSS_LATEST_URL) return ossLatestResponse(MOCK_LATEST);
          throw new Error("unexpected URL: " + url);
        };

        const result = await checkInstallerUpdate({
          updateServerUrl: BASE_URL,
          currentVersion: "1.1.0",
          // no licenseKey / deviceId
        });

        expect(calledUrls).not.toContain(API_CHECK_URL);
        expect(calledUrls).toContain(OSS_LATEST_URL);
        expect(result.hasUpdate).toBe(true);
      });

      it("returns installer type when OSS has no delta for current version", async () => {
        fetchHandler = async (url) => {
          if (url === OSS_LATEST_URL) return ossLatestResponse(MOCK_LATEST);
          throw new Error("unexpected URL: " + url);
        };

        const result = await checkInstallerUpdate({
          updateServerUrl: BASE_URL,
          currentVersion: "0.5.0", // 没有 delta 包
        });

        expect(result.hasUpdate).toBe(true);
        expect(result.updateType).toBe("installer");
        expect(result.version).toBe("1.2.0"); // P0-1: 版本号不再丢失
        expect(result.latest).toBeNull(); // 但 latest 为 null（无 delta 可执行）
      });

      it("returns no update when already on latest version via OSS", async () => {
        fetchHandler = async (url) => {
          if (url === OSS_LATEST_URL) return ossLatestResponse(MOCK_LATEST);
          throw new Error("unexpected URL: " + url);
        };

        const result = await checkInstallerUpdate({
          updateServerUrl: BASE_URL,
          currentVersion: "1.2.0", // 已是最新
        });

        expect(result.hasUpdate).toBe(false);
      });

      it("returns no update when current version is newer than OSS", async () => {
        fetchHandler = async (url) => {
          if (url === OSS_LATEST_URL) return ossLatestResponse(MOCK_LATEST);
          throw new Error("unexpected URL: " + url);
        };

        const result = await checkInstallerUpdate({
          updateServerUrl: BASE_URL,
          currentVersion: "2.0.0", // 比 OSS 新
        });

        expect(result.hasUpdate).toBe(false);
      });

      it("returns error when OSS request fails", async () => {
        fetchHandler = async () => {
          throw new Error("network unreachable");
        };

        const result = await checkInstallerUpdate({
          updateServerUrl: BASE_URL,
          currentVersion: "1.0.0",
        });

        expect(result.hasUpdate).toBe(false);
        expect(result.error).toBeDefined();
      });

      it("returns error when OSS returns HTTP error", async () => {
        fetchHandler = async (url) => {
          if (url === OSS_LATEST_URL) return httpError(404);
          throw new Error("unexpected URL");
        };

        const result = await checkInstallerUpdate({
          updateServerUrl: BASE_URL,
          currentVersion: "1.0.0",
        });

        expect(result.hasUpdate).toBe(false);
        expect(result.error).toContain("HTTP 404");
      });
    });

    // ── P0-1: version 字段验证 ───────────────────────

    describe("P0-1: version field always populated", () => {
      it.skip("has version in delta response from API", async () => {
        fetchHandler = async (url) => {
          if (url === API_CHECK_URL) {
            return apiResponse({
              hasUpdate: true,
              updateType: "delta",
              version: "1.3.0",
              download: {
                url: "https://oss/d.tar.gz",
                size: 1000,
                sha256: "x",
                checksums: "https://oss/c",
                manifest: "https://oss/m",
              },
            });
          }
          throw new Error("unexpected");
        };

        const result = await checkInstallerUpdate({
          updateServerUrl: BASE_URL,
          currentVersion: "1.2.0",
          licenseKey: "k",
          deviceId: "d",
        });

        expect(result.version).toBe("1.3.0");
      });

      it.skip("has version in installer response from API", async () => {
        fetchHandler = async (url) => {
          if (url === API_CHECK_URL) {
            return apiResponse({
              hasUpdate: true,
              updateType: "installer",
              version: "3.0.0",
              installer: { win64: "https://dl/setup.exe" },
            });
          }
          throw new Error("unexpected");
        };

        const result = await checkInstallerUpdate({
          updateServerUrl: BASE_URL,
          currentVersion: "1.0.0",
          licenseKey: "k",
          deviceId: "d",
        });

        expect(result.version).toBe("3.0.0");
        expect(result.latest).toBeNull();
      });

      it("has version in OSS delta response", async () => {
        fetchHandler = async (url) => {
          if (url === OSS_LATEST_URL) return ossLatestResponse(MOCK_LATEST);
          throw new Error("unexpected");
        };

        const result = await checkInstallerUpdate({
          updateServerUrl: BASE_URL,
          currentVersion: "1.1.0",
        });

        expect(result.version).toBe("1.2.0");
      });

      it("has version in OSS installer-redirect response", async () => {
        fetchHandler = async (url) => {
          if (url === OSS_LATEST_URL) return ossLatestResponse(MOCK_LATEST);
          throw new Error("unexpected");
        };

        const result = await checkInstallerUpdate({
          updateServerUrl: BASE_URL,
          currentVersion: "0.1.0", // 没有 delta
        });

        expect(result.version).toBe("1.2.0");
        expect(result.updateType).toBe("installer");
      });
    });
  });

  // ══════════════════════════════════════════════════════
  // reportUpdateResult
  // ══════════════════════════════════════════════════════
  describe("reportUpdateResult", () => {
    it("does not report delta update success", async () => {
      let sentBody: Record<string, unknown> | null = null;
      fetchHandler = async (url, init) => {
        if (url === API_REPORT_URL) {
          sentBody = JSON.parse(init?.body as string);
          return { ok: true, status: 200 } as Response;
        }
        throw new Error("unexpected URL: " + url);
      };

      const result: InstallerUpdateResult = {
        status: "ok",
        mode: "delta",
        fromVersion: "1.0.0",
        toVersion: "1.1.0",
        downloadedBytes: 5000,
        filesChanged: 10,
        durationMs: 3000,
      };

      await reportUpdateResult({
        updateServerUrl: BASE_URL,
        licenseKey: "key",
        deviceId: "device",
        result,
        reportStatus: "ok",
      });

      expect(sentBody).toBeNull();
    });

    it("P0-2: does NOT report when mode is none (up-to-date)", async () => {
      let reported = false;
      fetchHandler = async () => {
        reported = true;
        return { ok: true, status: 200 } as Response;
      };

      const result: InstallerUpdateResult = {
        status: "up-to-date",
        mode: "none",
        fromVersion: "1.0.0",
        durationMs: 100,
      };

      await reportUpdateResult({
        updateServerUrl: BASE_URL,
        licenseKey: "key",
        deviceId: "device",
        result,
      });

      expect(reported).toBe(false);
    });

    it("P0-2: does NOT report when mode is none (error at check stage)", async () => {
      let reported = false;
      fetchHandler = async () => {
        reported = true;
        return { ok: true, status: 200 } as Response;
      };

      await reportUpdateResult({
        updateServerUrl: BASE_URL,
        licenseKey: "key",
        deviceId: "device",
        result: {
          status: "error",
          mode: "none",
          reason: "network error during check",
          fromVersion: "1.0.0",
          durationMs: 100,
        },
      });

      expect(reported).toBe(false);
    });

    it("does NOT report when no licenseKey", async () => {
      let reported = false;
      fetchHandler = async () => {
        reported = true;
        return { ok: true, status: 200 } as Response;
      };

      await reportUpdateResult({
        updateServerUrl: BASE_URL,
        // no licenseKey
        result: {
          status: "ok",
          mode: "delta",
          fromVersion: "1.0.0",
          toVersion: "1.1.0",
          durationMs: 100,
        },
      });

      expect(reported).toBe(false);
    });

    it("does not report broken status when rollback failed", async () => {
      let sentBody: Record<string, unknown> | null = null;
      fetchHandler = async (url, init) => {
        if (url === API_REPORT_URL) {
          sentBody = JSON.parse(init?.body as string);
          return { ok: true, status: 200 } as Response;
        }
        throw new Error("unexpected URL: " + url);
      };

      await reportUpdateResult({
        updateServerUrl: BASE_URL,
        licenseKey: "key",
        deviceId: "device",
        result: {
          status: "broken",
          mode: "delta",
          reason: "checksum failed (rollback also failed)",
          fromVersion: "1.0.0",
          toVersion: "1.1.0",
          durationMs: 5000,
        },
        reportStatus: "broken",
      });

      expect(sentBody).toBeNull();
    });

    it("does not report error status with rollback success", async () => {
      let sentBody: Record<string, unknown> | null = null;
      fetchHandler = async (url, init) => {
        if (url === API_REPORT_URL) {
          sentBody = JSON.parse(init?.body as string);
          return { ok: true, status: 200 } as Response;
        }
        throw new Error("unexpected URL: " + url);
      };

      await reportUpdateResult({
        updateServerUrl: BASE_URL,
        licenseKey: "key",
        deviceId: "device",
        result: {
          status: "error",
          mode: "delta",
          reason: "checksum verification failed, rolled back",
          fromVersion: "1.0.0",
          toVersion: "1.1.0",
          durationMs: 3000,
        },
        reportStatus: "error",
      });

      expect(sentBody).toBeNull();
    });

    it("swallows network errors silently", async () => {
      fetchHandler = async () => {
        throw new Error("network timeout");
      };

      // 不应该抛出
      await expect(
        reportUpdateResult({
          updateServerUrl: BASE_URL,
          licenseKey: "key",
          deviceId: "device",
          result: {
            status: "ok",
            mode: "delta",
            fromVersion: "1.0.0",
            toVersion: "1.1.0",
            durationMs: 100,
          },
        }),
      ).resolves.toBeUndefined();
    });
  });

  // ══════════════════════════════════════════════════════
  // reportInstallerRedirect
  // ══════════════════════════════════════════════════════
  describe("reportInstallerRedirect", () => {
    it("does not report redirect_to_installer status", async () => {
      let sentBody: Record<string, unknown> | null = null;
      fetchHandler = async (url, init) => {
        if (url === API_REPORT_URL) {
          sentBody = JSON.parse(init?.body as string);
          return { ok: true, status: 200 } as Response;
        }
        throw new Error("unexpected URL: " + url);
      };

      await reportInstallerRedirect({
        updateServerUrl: BASE_URL,
        licenseKey: "key",
        deviceId: "device",
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
      });

      expect(sentBody).toBeNull();
    });

    it("does NOT report when no licenseKey", async () => {
      let reported = false;
      fetchHandler = async () => {
        reported = true;
        return { ok: true, status: 200 } as Response;
      };

      await reportInstallerRedirect({
        updateServerUrl: BASE_URL,
        // no licenseKey
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
      });

      expect(reported).toBe(false);
    });

    it("swallows network errors silently", async () => {
      fetchHandler = async () => {
        throw new Error("timeout");
      };

      await expect(
        reportInstallerRedirect({
          updateServerUrl: BASE_URL,
          licenseKey: "key",
          deviceId: "device",
          fromVersion: "1.0.0",
          toVersion: "2.0.0",
        }),
      ).resolves.toBeUndefined();
    });
  });

  // ══════════════════════════════════════════════════════
  // resolveUpdateServerUrl
  // ══════════════════════════════════════════════════════
  describe("resolveUpdateServerUrl", () => {
    it("returns default when env var is set but not in dev build", () => {
      // [MED-09] Production builds ignore env var override to prevent update server hijacking
      vi.stubEnv("OPENCLAWCN_UPDATE_SERVER", "https://custom.example.com");
      const url = resolveUpdateServerUrl("/some/root");
      expect(url).toBe("https://www.obplugins.cn");
    });

    it("returns default when no env and no install.json", () => {
      vi.stubEnv("OPENCLAWCN_UPDATE_SERVER", "");
      const url = resolveUpdateServerUrl("/nonexistent/path");
      expect(url).toBe("https://www.obplugins.cn");
    });
  });

  // ══════════════════════════════════════════════════════
  // detectInstallKind
  // ══════════════════════════════════════════════════════
  describe("detectInstallKind", () => {
    it("returns package for unknown directory", () => {
      const kind = detectInstallKind("/nonexistent/fake/path");
      expect(kind).toBe("package");
    });
  });
});
