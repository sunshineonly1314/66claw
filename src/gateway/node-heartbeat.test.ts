/**
 * Tests for the node heartbeat ping/pong logic.
 *
 * The heartbeat implementation lives inside ws-connection.ts as a closure.
 * Rather than pulling in the full WebSocket connection machinery, we test
 * the *behavioral contract* by simulating the same state machine:
 *
 *   - Every WS_PING_INTERVAL_MS, check `missedPongs >= WS_PING_MAX_MISSED`
 *   - If yes → close
 *   - If no → ping(), missedPongs++
 *   - On pong → missedPongs = 0
 *
 * This ensures the logic is correct independent of the ws library.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WS_PING_INTERVAL_MS, WS_PING_MAX_MISSED } from "./server-constants.js";

// ── Simulate heartbeat state machine ───────────────────────────────────

type HeartbeatState = {
  missedPongs: number;
  closed: boolean;
  closeCode: number | null;
  closeReason: string | null;
  pingCount: number;
  timer: ReturnType<typeof setInterval> | null;
};

function createHeartbeatSimulator() {
  const state: HeartbeatState = {
    missedPongs: 0,
    closed: false,
    closeCode: null,
    closeReason: null,
    pingCount: 0,
    timer: null,
  };

  function start() {
    state.missedPongs = 0;
    state.timer = setInterval(() => {
      if (state.missedPongs >= WS_PING_MAX_MISSED) {
        state.closed = true;
        state.closeCode = 4001;
        state.closeReason = "ping timeout";
        if (state.timer) {
          clearInterval(state.timer);
          state.timer = null;
        }
        return;
      }
      // Simulate socket.ping() succeeding
      state.pingCount++;
      state.missedPongs++;
    }, WS_PING_INTERVAL_MS);
  }

  function receivePong() {
    state.missedPongs = 0;
  }

  function stop() {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
  }

  return { state, start, receivePong, stop };
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("node heartbeat ping/pong state machine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not close immediately after start", () => {
    const hb = createHeartbeatSimulator();
    hb.start();
    expect(hb.state.closed).toBe(false);
    expect(hb.state.pingCount).toBe(0);
    hb.stop();
  });

  it("sends first ping after one interval", () => {
    const hb = createHeartbeatSimulator();
    hb.start();
    vi.advanceTimersByTime(WS_PING_INTERVAL_MS);
    expect(hb.state.pingCount).toBe(1);
    expect(hb.state.missedPongs).toBe(1);
    expect(hb.state.closed).toBe(false);
    hb.stop();
  });

  it("stays alive when pongs are received", () => {
    const hb = createHeartbeatSimulator();
    hb.start();

    // 10 ping cycles with pong received each time
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(WS_PING_INTERVAL_MS);
      hb.receivePong();
    }

    expect(hb.state.closed).toBe(false);
    expect(hb.state.pingCount).toBe(10);
    expect(hb.state.missedPongs).toBe(0);
    hb.stop();
  });

  it("closes after exactly WS_PING_MAX_MISSED missed pongs", () => {
    const hb = createHeartbeatSimulator();
    hb.start();

    // Miss WS_PING_MAX_MISSED pongs (each advances 1 interval)
    for (let i = 0; i < WS_PING_MAX_MISSED; i++) {
      vi.advanceTimersByTime(WS_PING_INTERVAL_MS);
      expect(hb.state.closed).toBe(false);
    }

    // The (WS_PING_MAX_MISSED + 1)th interval triggers close
    vi.advanceTimersByTime(WS_PING_INTERVAL_MS);
    expect(hb.state.closed).toBe(true);
    expect(hb.state.closeCode).toBe(4001);
    expect(hb.state.closeReason).toBe("ping timeout");
  });

  it("total timeout equals (WS_PING_MAX_MISSED + 1) * interval", () => {
    // After start, we need MAX_MISSED pings (each incrementing missedPongs),
    // plus one more interval to detect the threshold breach.
    const expectedTimeoutMs = (WS_PING_MAX_MISSED + 1) * WS_PING_INTERVAL_MS;

    const hb = createHeartbeatSimulator();
    hb.start();

    // Just before total timeout — not closed yet
    vi.advanceTimersByTime(expectedTimeoutMs - 1);
    expect(hb.state.closed).toBe(false);

    // At total timeout — closed
    vi.advanceTimersByTime(1);
    expect(hb.state.closed).toBe(true);
    hb.stop();
  });

  it("for default settings: 3 missed + 1 detect = 4 intervals = 180s", () => {
    expect(WS_PING_MAX_MISSED).toBe(3);
    expect(WS_PING_INTERVAL_MS).toBe(45_000);
    const totalTimeoutMs = (WS_PING_MAX_MISSED + 1) * WS_PING_INTERVAL_MS;
    expect(totalTimeoutMs).toBe(180_000); // 3 minutes
  });

  it("late pong resets counter even after partial misses", () => {
    const hb = createHeartbeatSimulator();
    hb.start();

    // Miss 2 pongs
    vi.advanceTimersByTime(WS_PING_INTERVAL_MS * 2);
    expect(hb.state.missedPongs).toBe(2);

    // Receive a pong
    hb.receivePong();
    expect(hb.state.missedPongs).toBe(0);

    // Miss 2 more — should NOT close (needs 3 + detect)
    vi.advanceTimersByTime(WS_PING_INTERVAL_MS * 2);
    expect(hb.state.closed).toBe(false);

    hb.stop();
  });

  it("does not send more pings after close", () => {
    const hb = createHeartbeatSimulator();
    hb.start();

    // Force close
    vi.advanceTimersByTime(WS_PING_INTERVAL_MS * (WS_PING_MAX_MISSED + 1));
    expect(hb.state.closed).toBe(true);
    const pingsAtClose = hb.state.pingCount;

    // Advance more time — no new pings
    vi.advanceTimersByTime(WS_PING_INTERVAL_MS * 5);
    expect(hb.state.pingCount).toBe(pingsAtClose);
  });

  it("exactly WS_PING_MAX_MISSED pings are sent before close (not MAX_MISSED+1)", () => {
    const hb = createHeartbeatSimulator();
    hb.start();

    vi.advanceTimersByTime(WS_PING_INTERVAL_MS * (WS_PING_MAX_MISSED + 1));
    expect(hb.state.closed).toBe(true);

    // Pings sent: intervals 1..MAX_MISSED each sent a ping.
    // Interval MAX_MISSED+1 detected the breach and closed without pinging.
    expect(hb.state.pingCount).toBe(WS_PING_MAX_MISSED);
  });

  // ── Boundary: recover after MAX_MISSED - 1 misses ───────────────────

  it("recovers if pong arrives just before MAX_MISSED threshold", () => {
    const hb = createHeartbeatSimulator();
    hb.start();

    // Miss MAX_MISSED - 1 pongs
    vi.advanceTimersByTime(WS_PING_INTERVAL_MS * (WS_PING_MAX_MISSED - 1));
    expect(hb.state.missedPongs).toBe(WS_PING_MAX_MISSED - 1);

    // Receive pong just in time
    hb.receivePong();
    expect(hb.state.missedPongs).toBe(0);

    // Advance 2 more intervals — still under threshold
    vi.advanceTimersByTime(WS_PING_INTERVAL_MS * 2);
    expect(hb.state.missedPongs).toBe(2);
    expect(hb.state.closed).toBe(false);

    // Receive pong again
    hb.receivePong();
    expect(hb.state.missedPongs).toBe(0);

    hb.stop();
  });

  // ── Edge: start with zero missedPongs ────────────────────────────────

  it("starts with missedPongs = 0", () => {
    const hb = createHeartbeatSimulator();
    hb.start();
    expect(hb.state.missedPongs).toBe(0);
    hb.stop();
  });
});
