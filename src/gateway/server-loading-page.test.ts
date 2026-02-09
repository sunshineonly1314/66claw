import { describe, expect, it } from "vitest";

import { generateLoadingPageHtml } from "./server-loading-page.js";

describe("server-loading-page", () => {
  const html = generateLoadingPageHtml();

  // ── Basic structure ────────────────────────────────────────────────
  it("returns valid HTML5 document", () => {
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
  });

  it("includes charset meta tag", () => {
    expect(html).toContain('charset="utf-8"');
  });

  it("includes viewport meta tag", () => {
    expect(html).toContain("viewport");
    expect(html).toContain("width=device-width");
  });

  it("includes a title", () => {
    expect(html).toMatch(/<title>.+<\/title>/);
  });

  // ── Visual elements ────────────────────────────────────────────────
  it("includes a spinner animation", () => {
    expect(html).toContain("spinner");
    expect(html).toContain("@keyframes spin");
  });

  it("includes a heading indicating startup", () => {
    expect(html).toMatch(/正在启动服务/);
  });

  it("includes a phase display element", () => {
    expect(html).toContain('id="phase"');
  });

  // ── Health polling script ──────────────────────────────────────────
  it("includes inline JavaScript", () => {
    expect(html).toContain("<script>");
    expect(html).toContain("</script>");
  });

  it("polls /api/health endpoint", () => {
    expect(html).toContain("/api/health");
  });

  it("checks for ready field in response", () => {
    expect(html).toContain("d.ready");
  });

  it("redirects to / when ready", () => {
    expect(html).toContain("location.replace(location.pathname+location.search)");
  });

  it("displays phase text from health response", () => {
    expect(html).toContain("d.phase");
  });

  it("handles fetch errors gracefully", () => {
    // On error, should show a user-friendly message, not crash
    expect(html).toContain("catch");
    expect(html).toContain("正在连接...");
  });

  it("uses setTimeout for polling (not setInterval)", () => {
    // setTimeout is preferred for polling as it avoids pile-up
    expect(html).toContain("setTimeout(poll");
  });

  it("polls every 1.5 seconds", () => {
    expect(html).toContain("1500");
  });

  // ── Security ───────────────────────────────────────────────────────
  it("does not include external resource references", () => {
    // Loading page should be fully self-contained
    expect(html).not.toContain("http://");
    expect(html).not.toContain("https://");
  });

  // ── Return type ────────────────────────────────────────────────────
  it("returns a string", () => {
    expect(typeof html).toBe("string");
  });

  it("is non-empty", () => {
    expect(html.length).toBeGreaterThan(100);
  });

  it("returns the same content on multiple calls (pure function)", () => {
    const html2 = generateLoadingPageHtml();
    expect(html).toBe(html2);
  });
});
