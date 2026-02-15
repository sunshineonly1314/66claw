import { describe, expect, it, beforeEach } from "vitest";

import {
  markGatewayReady,
  isGatewayReady,
  setGatewayPhase,
  getGatewayPhase,
  resetGatewayReady,
} from "./server-ready.js";

describe("server-ready", () => {
  beforeEach(() => {
    resetGatewayReady();
  });

  // ── Basic state transitions ────────────────────────────────────────
  it("starts in not-ready state", () => {
    expect(isGatewayReady()).toBe(false);
  });

  it("starts with 'starting' phase", () => {
    expect(getGatewayPhase()).toBe("starting");
  });

  it("markGatewayReady transitions to ready", () => {
    markGatewayReady();
    expect(isGatewayReady()).toBe(true);
  });

  it("markGatewayReady sets phase to 'ready'", () => {
    markGatewayReady();
    expect(getGatewayPhase()).toBe("ready");
  });

  // ── Phase management ───────────────────────────────────────────────
  it("setGatewayPhase updates the phase string", () => {
    setGatewayPhase("loading config");
    expect(getGatewayPhase()).toBe("loading config");
  });

  it("setGatewayPhase can be called multiple times", () => {
    setGatewayPhase("loading config");
    setGatewayPhase("verifying license");
    setGatewayPhase("initializing subsystems");
    expect(getGatewayPhase()).toBe("initializing subsystems");
  });

  it("setGatewayPhase does not affect ready state", () => {
    setGatewayPhase("anything");
    expect(isGatewayReady()).toBe(false);
  });

  // ── Reset (SIGUSR1 restart scenario) ───────────────────────────────
  it("resetGatewayReady clears ready flag", () => {
    markGatewayReady();
    expect(isGatewayReady()).toBe(true);
    resetGatewayReady();
    expect(isGatewayReady()).toBe(false);
  });

  it("resetGatewayReady resets phase to 'starting'", () => {
    setGatewayPhase("ready");
    resetGatewayReady();
    expect(getGatewayPhase()).toBe("starting");
  });

  it("resetGatewayReady then markGatewayReady works (restart cycle)", () => {
    // Simulate a full startup → restart → startup cycle
    markGatewayReady();
    expect(isGatewayReady()).toBe(true);

    resetGatewayReady();
    expect(isGatewayReady()).toBe(false);
    expect(getGatewayPhase()).toBe("starting");

    setGatewayPhase("loading config");
    setGatewayPhase("verifying license");
    markGatewayReady();
    expect(isGatewayReady()).toBe(true);
    expect(getGatewayPhase()).toBe("ready");
  });

  // ── Edge cases ─────────────────────────────────────────────────────
  it("markGatewayReady is idempotent", () => {
    markGatewayReady();
    markGatewayReady();
    expect(isGatewayReady()).toBe(true);
    expect(getGatewayPhase()).toBe("ready");
  });

  it("resetGatewayReady is idempotent", () => {
    resetGatewayReady();
    resetGatewayReady();
    expect(isGatewayReady()).toBe(false);
    expect(getGatewayPhase()).toBe("starting");
  });

  it("setGatewayPhase accepts empty string", () => {
    setGatewayPhase("");
    expect(getGatewayPhase()).toBe("");
  });

  it("markGatewayReady overrides any custom phase", () => {
    setGatewayPhase("custom-phase");
    markGatewayReady();
    expect(getGatewayPhase()).toBe("ready");
  });
});
