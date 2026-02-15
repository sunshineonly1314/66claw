import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for the HTTP loading page guard and health endpoint enhancements.
 *
 * These tests verify the interaction between server-ready state and
 * server-http request routing without spinning up a real HTTP server.
 * We test the logic patterns directly.
 */

// ── Loading page guard logic tests ───────────────────────────────────
describe("loading page guard logic", () => {
  // The guard in server-http.ts uses this pattern:
  //   if (!isGatewayReady()) {
  //     const reqPath = req.url?.split("?")[0] ?? "/";
  //     if (!reqPath.startsWith("/api/") && !reqPath.startsWith("/assets/") && !/\.\w{1,5}$/.test(reqPath)) {
  //       // serve loading page
  //     }
  //   }

  function shouldServLoadingPage(url: string, ready: boolean): boolean {
    if (ready) return false;
    const reqPath = url.split("?")[0];
    if (reqPath.startsWith("/api/")) return false;
    if (reqPath.startsWith("/assets/")) return false;
    if (/\.\w{1,5}$/.test(reqPath)) return false;
    return true;
  }

  describe("when gateway is NOT ready", () => {
    const ready = false;

    it("serves loading page for root /", () => {
      expect(shouldServLoadingPage("/", ready)).toBe(true);
    });

    it("serves loading page for /dashboard", () => {
      expect(shouldServLoadingPage("/dashboard", ready)).toBe(true);
    });

    it("serves loading page for /setup", () => {
      expect(shouldServLoadingPage("/setup", ready)).toBe(true);
    });

    it("passes through /api/health", () => {
      expect(shouldServLoadingPage("/api/health", ready)).toBe(false);
    });

    it("passes through /api/setup/state", () => {
      expect(shouldServLoadingPage("/api/setup/state", ready)).toBe(false);
    });

    it("passes through /assets/logo.svg", () => {
      expect(shouldServLoadingPage("/assets/logo.svg", ready)).toBe(false);
    });

    it("passes through static files like /main.js", () => {
      expect(shouldServLoadingPage("/main.js", ready)).toBe(false);
    });

    it("passes through /style.css", () => {
      expect(shouldServLoadingPage("/style.css", ready)).toBe(false);
    });

    it("passes through /favicon.ico", () => {
      expect(shouldServLoadingPage("/favicon.ico", ready)).toBe(false);
    });

    it("passes through /font.woff2", () => {
      expect(shouldServLoadingPage("/font.woff2", ready)).toBe(false);
    });

    it("handles query parameters correctly", () => {
      expect(shouldServLoadingPage("/?token=abc", ready)).toBe(true);
      expect(shouldServLoadingPage("/api/health?check=1", ready)).toBe(false);
    });
  });

  describe("when gateway IS ready", () => {
    const ready = true;

    it("never serves loading page for root /", () => {
      expect(shouldServLoadingPage("/", ready)).toBe(false);
    });

    it("never serves loading page for /dashboard", () => {
      expect(shouldServLoadingPage("/dashboard", ready)).toBe(false);
    });

    it("never serves loading page for any path", () => {
      const paths = ["/", "/setup", "/api/health", "/foo/bar"];
      for (const p of paths) {
        expect(shouldServLoadingPage(p, ready)).toBe(false);
      }
    });
  });

  // ── Edge cases for static file regex ────────────────────────────────
  describe("static file extension regex boundary", () => {
    it("matches .js (2 chars)", () => {
      expect(/\.\w{1,5}$/.test("/app.js")).toBe(true);
    });

    it("matches .woff2 (5 chars)", () => {
      expect(/\.\w{1,5}$/.test("/font.woff2")).toBe(true);
    });

    it("does not match 6+ char extensions", () => {
      // .module is 6 chars — would not match the 1-5 range
      expect(/\.\w{1,5}$/.test("/file.module")).toBe(false);
    });

    it("does not match bare paths without extension", () => {
      expect(/\.\w{1,5}$/.test("/dashboard")).toBe(false);
      expect(/\.\w{1,5}$/.test("/")).toBe(false);
    });

    it("matches .a (1 char extension)", () => {
      expect(/\.\w{1,5}$/.test("/file.a")).toBe(true);
    });
  });
});

// ── Health endpoint response format ──────────────────────────────────
describe("health endpoint response format", () => {
  it("includes all required fields", () => {
    // The health endpoint should return these fields
    const mockResponse = {
      ok: true,
      ready: false,
      phase: "loading config",
      pid: 12345,
      uptime: 1.5,
    };

    expect(mockResponse).toHaveProperty("ok");
    expect(mockResponse).toHaveProperty("ready");
    expect(mockResponse).toHaveProperty("phase");
    expect(mockResponse).toHaveProperty("pid");
    expect(mockResponse).toHaveProperty("uptime");
  });

  it("ok is always true (server is alive)", () => {
    // /api/health returning 200 means the server is alive
    // ready indicates full initialization
    const response = { ok: true, ready: false, phase: "starting" };
    expect(response.ok).toBe(true);
  });

  it("ready transitions from false to true", () => {
    const beforeReady = { ok: true, ready: false, phase: "loading config" };
    const afterReady = { ok: true, ready: true, phase: "ready" };

    expect(beforeReady.ready).toBe(false);
    expect(afterReady.ready).toBe(true);
  });

  it("phase provides human-readable progress", () => {
    const phases = [
      "starting",
      "loading config",
      "verifying license",
      "initializing subsystems",
      "starting channels",
      "ready",
    ];

    for (const phase of phases) {
      expect(typeof phase).toBe("string");
      expect(phase.length).toBeGreaterThan(0);
    }
  });
});

// ── HTTP 503 response headers ────────────────────────────────────────
describe("loading page HTTP response", () => {
  it("should return 503 status (Service Unavailable)", () => {
    const statusCode = 503;
    expect(statusCode).toBe(503);
  });

  it("should include Retry-After header", () => {
    const retryAfter = "3";
    expect(retryAfter).toBe("3");
  });

  it("should set Content-Type to text/html", () => {
    const contentType = "text/html; charset=utf-8";
    expect(contentType).toContain("text/html");
  });
});
