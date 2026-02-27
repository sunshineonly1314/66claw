import { describe, it, expect } from "vitest";
import { translateError, sanitizeErrorMessage, classifyErrorCode } from "./error-translate.js";

describe("translateError", () => {
  it("classifies FailoverError by reason", () => {
    const err = Object.assign(new Error("billing issue"), {
      name: "FailoverError",
      reason: "billing",
    });
    const result = translateError(err);
    expect(result.category).toBe("billing");
    expect(result.retryable).toBe(false);
    expect(result.userMessage).toContain("余额不足");
  });

  it("classifies by HTTP status 401", () => {
    const err = Object.assign(new Error("unauthorized"), { status: 401 });
    const result = translateError(err);
    expect(result.category).toBe("auth");
    expect(result.retryable).toBe(false);
  });

  it("classifies by HTTP status 402", () => {
    const err = Object.assign(new Error("payment required"), { status: 402 });
    const result = translateError(err);
    expect(result.category).toBe("billing");
  });

  it("classifies by HTTP status 429", () => {
    const err = Object.assign(new Error("too many requests"), { status: 429 });
    const result = translateError(err);
    expect(result.category).toBe("rate_limit");
    expect(result.retryable).toBe(true);
  });

  it("classifies by HTTP status 503", () => {
    const err = Object.assign(new Error("service unavailable"), { status: 503 });
    const result = translateError(err);
    expect(result.category).toBe("overloaded");
    expect(result.retryable).toBe(true);
  });

  it("classifies by errno code ECONNRESET", () => {
    const err = Object.assign(new Error("connection reset"), { code: "ECONNRESET" });
    const result = translateError(err);
    // ECONNRESET is in the timeout set
    expect(["timeout", "network"]).toContain(result.category);
    expect(result.retryable).toBe(true);
  });

  it("classifies by errno code ENOTFOUND", () => {
    const err = Object.assign(new Error("dns failure"), { code: "ENOTFOUND" });
    const result = translateError(err);
    expect(result.category).toBe("network");
    expect(result.retryable).toBe(true);
  });

  it("classifies by errno code ETIMEDOUT", () => {
    const err = Object.assign(new Error("timed out"), { code: "ETIMEDOUT" });
    const result = translateError(err);
    expect(result.category).toBe("timeout");
    expect(result.retryable).toBe(true);
  });

  it("classifies config error by code INVALID_CONFIG", () => {
    const err = Object.assign(new Error("bad config"), { code: "INVALID_CONFIG" });
    const result = translateError(err);
    expect(result.category).toBe("config");
    expect(result.retryable).toBe(false);
  });

  it("classifies by message pattern: 'invalid api key'", () => {
    const err = new Error("Invalid API Key provided");
    const result = translateError(err);
    expect(result.category).toBe("auth");
  });

  it("classifies by message pattern: 'quota exceeded'", () => {
    const err = new Error("You exceeded your current quota");
    const result = translateError(err);
    expect(result.category).toBe("billing");
  });

  it("classifies by message pattern: 'rate limit'", () => {
    const err = new Error("Rate limit reached for model");
    const result = translateError(err);
    expect(result.category).toBe("rate_limit");
  });

  it("classifies by message pattern: 'overloaded'", () => {
    const err = new Error("The server is overloaded");
    const result = translateError(err);
    expect(result.category).toBe("overloaded");
  });

  it("classifies by message pattern: 'fetch failed'", () => {
    const err = new TypeError("fetch failed");
    const result = translateError(err);
    expect(result.category).toBe("network");
  });

  it("classifies by message pattern: CN '认证失败'", () => {
    const err = new Error("认证失败");
    const result = translateError(err);
    expect(result.category).toBe("auth");
  });

  it("follows cause chain", () => {
    const cause = Object.assign(new Error("connect failed"), { code: "ECONNREFUSED" });
    const err = new Error("request failed", { cause });
    const result = translateError(err);
    expect(result.category).toBe("network");
    expect(result.retryable).toBe(true);
  });

  it("returns unknown for unrecognized errors", () => {
    const err = new Error("something weird happened");
    const result = translateError(err);
    expect(result.category).toBe("unknown");
    expect(result.retryable).toBe(true);
    expect(result.userMessage).toContain("稍后重试");
  });

  it("handles null/undefined", () => {
    expect(translateError(null).category).toBe("unknown");
    expect(translateError(undefined).category).toBe("unknown");
  });

  it("handles string errors", () => {
    const result = translateError("Rate limit exceeded");
    expect(result.category).toBe("rate_limit");
  });
});

describe("classifyErrorCode", () => {
  it("maps auth to AUTH_FAILED", () => {
    const err = Object.assign(new Error("unauthorized"), { status: 401 });
    expect(classifyErrorCode(err)).toBe("AUTH_FAILED");
  });

  it("maps billing to BILLING_EXCEEDED", () => {
    const err = Object.assign(new Error("payment required"), { status: 402 });
    expect(classifyErrorCode(err)).toBe("BILLING_EXCEEDED");
  });

  it("maps rate_limit to RATE_LIMITED", () => {
    const err = Object.assign(new Error("too many"), { status: 429 });
    expect(classifyErrorCode(err)).toBe("RATE_LIMITED");
  });

  it("maps timeout to AGENT_TIMEOUT", () => {
    const err = Object.assign(new Error("timed out"), { code: "ETIMEDOUT" });
    expect(classifyErrorCode(err)).toBe("AGENT_TIMEOUT");
  });

  it("returns null for unknown", () => {
    expect(classifyErrorCode(new Error("random"))).toBeNull();
  });
});

describe("sanitizeErrorMessage", () => {
  it("removes file paths", () => {
    const msg = "Error in /home/user/project/src/gateway/server.ts:42:10";
    const result = sanitizeErrorMessage(msg);
    expect(result).not.toContain("/home/user/");
    expect(result).not.toContain("server.ts");
  });

  it("removes stack trace lines", () => {
    const msg = "TypeError: foo\n    at Object.run (/a/b/c.js:10:5)\n    at main (/x/y.js:1:1)";
    const result = sanitizeErrorMessage(msg);
    expect(result).not.toContain("at Object.run");
    expect(result).not.toContain("at main");
  });

  it("strips common error prefixes", () => {
    const msg = "API Error: something went wrong";
    const result = sanitizeErrorMessage(msg);
    expect(result).not.toMatch(/^API Error:/i);
    expect(result).toContain("something went wrong");
  });

  it("truncates long messages", () => {
    const msg = "x".repeat(500);
    const result = sanitizeErrorMessage(msg);
    expect(result.length).toBeLessThanOrEqual(303); // 300 + "..."
  });

  it("preserves meaningful short messages", () => {
    const msg = "Connection refused";
    expect(sanitizeErrorMessage(msg)).toBe("Connection refused");
  });
});
