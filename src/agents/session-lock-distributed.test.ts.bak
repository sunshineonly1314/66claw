import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initStateStore, closeStateStore } from "../infra/state-store/index.js";
import { acquireSessionLock } from "./session-lock-distributed.js";

describe("acquireSessionLock (distributed)", () => {
  beforeEach(async () => {
    await initStateStore({ backend: "memory" });
  });

  afterEach(async () => {
    await closeStateStore();
  });

  it("acquires and releases a lock", async () => {
    const lock = await acquireSessionLock({
      sessionFile: "/tmp/test-session.json",
      timeoutMs: 1000,
    });
    expect(lock).toBeDefined();
    expect(typeof lock.release).toBe("function");
    await lock.release();
  });

  it("serialises concurrent access to the same session", async () => {
    const order: string[] = [];

    const lock1 = await acquireSessionLock({
      sessionFile: "/tmp/test-serial.json",
      timeoutMs: 2000,
      staleMs: 5000,
    });
    order.push("lock1-acquired");

    // Try to acquire the same lock concurrently — should wait
    const lock2Promise = acquireSessionLock({
      sessionFile: "/tmp/test-serial.json",
      timeoutMs: 2000,
      staleMs: 5000,
    });

    // Release lock1 after a short delay
    setTimeout(async () => {
      order.push("lock1-releasing");
      await lock1.release();
    }, 50);

    const lock2 = await lock2Promise;
    order.push("lock2-acquired");
    await lock2.release();

    expect(order).toEqual(["lock1-acquired", "lock1-releasing", "lock2-acquired"]);
  });

  it("times out when lock is held too long", async () => {
    const lock = await acquireSessionLock({
      sessionFile: "/tmp/test-timeout.json",
      timeoutMs: 1000,
      staleMs: 5000,
    });

    // Try to acquire with short timeout — should fail
    await expect(
      acquireSessionLock({
        sessionFile: "/tmp/test-timeout.json",
        timeoutMs: 100,
        staleMs: 5000,
      }),
    ).rejects.toThrow(/timeout/i);

    await lock.release();
  });

  it("different session files do not contend", async () => {
    const lock1 = await acquireSessionLock({
      sessionFile: "/tmp/session-a.json",
      timeoutMs: 1000,
    });
    const lock2 = await acquireSessionLock({
      sessionFile: "/tmp/session-b.json",
      timeoutMs: 1000,
    });

    // Both should succeed immediately since different keys
    expect(lock1).toBeDefined();
    expect(lock2).toBeDefined();

    await lock1.release();
    await lock2.release();
  });

  it("lock can be re-acquired after release", async () => {
    const lock1 = await acquireSessionLock({
      sessionFile: "/tmp/test-reacquire.json",
      timeoutMs: 1000,
    });
    await lock1.release();

    const lock2 = await acquireSessionLock({
      sessionFile: "/tmp/test-reacquire.json",
      timeoutMs: 1000,
    });
    expect(lock2).toBeDefined();
    await lock2.release();
  });
});
