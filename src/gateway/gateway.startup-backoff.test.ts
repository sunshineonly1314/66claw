/**
 * TC-09: WebSocket backoff 算法验证
 *
 * 由于 GatewayBrowserClient 依赖浏览器 WebSocket API，
 * 这里测试的是 backoff 算法本身，验证 3s/15s 上限行为。
 */

import { describe, it, expect } from "vitest";

/**
 * 从 gateway.ts scheduleReconnect 中提取的 backoff 算法:
 *   backoffMs = Math.min(backoffMs * 1.7, maxBackoff)
 * 起始值: 800ms
 */
function computeBackoffSequence(maxBackoff: number, steps: number): number[] {
  let backoffMs = 800;
  const delays: number[] = [];
  for (let i = 0; i < steps; i++) {
    delays.push(Math.round(backoffMs));
    backoffMs = Math.min(backoffMs * 1.7, maxBackoff);
  }
  return delays;
}

describe("TC-09: WebSocket backoff 算法", () => {

  it("3s cap 序列: 800 → 1360 → 2312 → 3000 → 3000 ...", () => {
    const delays = computeBackoffSequence(3_000, 8);

    expect(delays[0]).toBe(800);
    expect(delays[1]).toBe(1360);
    expect(delays[2]).toBe(2312);
    expect(delays[3]).toBe(3000);  // capped
    expect(delays[4]).toBe(3000);
    expect(delays[5]).toBe(3000);
    expect(delays[6]).toBe(3000);
    expect(delays[7]).toBe(3000);
  });

  it("15s cap 序列: 800 → ... → 15000", () => {
    const delays = computeBackoffSequence(15_000, 10);

    expect(delays[0]).toBe(800);
    expect(delays[1]).toBe(1360);
    expect(delays[2]).toBe(2312);
    expect(delays[3]).toBe(3930);   // ~3930.4
    expect(delays[4]).toBe(6682);   // ~6681.7
    expect(delays[5]).toBe(11359);  // ~11358.9
    expect(delays[6]).toBe(15000);  // capped
    expect(delays[7]).toBe(15000);
  });

  it("3s 启动模式比 15s 默认模式更快到达上限", () => {
    const startup = computeBackoffSequence(3_000, 10);
    const normal = computeBackoffSequence(15_000, 10);

    // 3s cap: reaches cap at index 3
    const startupCapIndex = startup.findIndex((d) => d >= 3_000);
    // 15s cap: reaches cap at index 6
    const normalCapIndex = normal.findIndex((d) => d >= 15_000);

    expect(startupCapIndex).toBe(3);  // 4th attempt
    expect(normalCapIndex).toBe(6);   // 7th attempt
    expect(startupCapIndex).toBeLessThan(normalCapIndex);
  });

  it("成功后重置到 800ms 并使用 15s cap", () => {
    // Simulate: startup with 3s cap, connect succeeds, switch to 15s
    const startupDelays = computeBackoffSequence(3_000, 5);
    expect(startupDelays[4]).toBe(3000);

    // After success: backoffMs resets to 800 (line 244 in gateway.ts)
    // and maxBackoff switches to 15000 (via setMaxBackoffMs)
    const reconnectDelays = computeBackoffSequence(15_000, 5);
    expect(reconnectDelays[0]).toBe(800);  // reset
    expect(reconnectDelays[4]).toBe(6682); // not capped at 3000 anymore
  });

  it("总等待时间: 3s cap 首次连接 vs 15s cap", () => {
    // How long until the 10th retry attempt?
    const startup = computeBackoffSequence(3_000, 10);
    const normal = computeBackoffSequence(15_000, 10);

    const startupTotal = startup.reduce((a, b) => a + b, 0);
    const normalTotal = normal.reduce((a, b) => a + b, 0);

    // 3s cap: ~24s for 10 attempts
    expect(startupTotal).toBeLessThan(30_000);
    // 15s cap: ~72s for 10 attempts
    expect(normalTotal).toBeGreaterThan(50_000);

    // Startup is significantly faster to retry
    expect(startupTotal).toBeLessThan(normalTotal * 0.5);
  });
});
