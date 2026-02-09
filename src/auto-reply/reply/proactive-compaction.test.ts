import { describe, expect, it } from "vitest";

import {
  DEFAULT_PROACTIVE_COMPACTION_THRESHOLD_RATIO,
  resolveProactiveCompactionSettings,
  shouldRunProactiveCompaction,
} from "./proactive-compaction.js";

describe("resolveProactiveCompactionSettings", () => {
  it("defaults to enabled with 0.88 threshold", () => {
    const settings = resolveProactiveCompactionSettings();
    expect(settings).not.toBeNull();
    expect(settings?.enabled).toBe(true);
    expect(settings?.thresholdRatio).toBe(
      DEFAULT_PROACTIVE_COMPACTION_THRESHOLD_RATIO,
    );
  });

  it("respects disable flag", () => {
    expect(
      resolveProactiveCompactionSettings({
        agents: {
          defaults: {
            compaction: { proactiveCompaction: { enabled: false } },
          },
        },
      }),
    ).toBeNull();
  });

  it("accepts custom threshold ratio", () => {
    const settings = resolveProactiveCompactionSettings({
      agents: {
        defaults: {
          compaction: { proactiveCompaction: { thresholdRatio: 0.75 } },
        },
      },
    });
    expect(settings?.thresholdRatio).toBe(0.75);
  });

  it("rejects invalid threshold ratio and falls back to default", () => {
    const settings = resolveProactiveCompactionSettings({
      agents: {
        defaults: {
          compaction: {
            proactiveCompaction: { thresholdRatio: 1.5 as unknown as number },
          },
        },
      },
    });
    expect(settings?.thresholdRatio).toBe(
      DEFAULT_PROACTIVE_COMPACTION_THRESHOLD_RATIO,
    );
  });

  it("rejects zero threshold ratio and falls back to default", () => {
    const settings = resolveProactiveCompactionSettings({
      agents: {
        defaults: {
          compaction: { proactiveCompaction: { thresholdRatio: 0 } },
        },
      },
    });
    expect(settings?.thresholdRatio).toBe(
      DEFAULT_PROACTIVE_COMPACTION_THRESHOLD_RATIO,
    );
  });

  it("rejects negative threshold ratio and falls back to default", () => {
    const settings = resolveProactiveCompactionSettings({
      agents: {
        defaults: {
          compaction: { proactiveCompaction: { thresholdRatio: -0.5 } },
        },
      },
    });
    expect(settings?.thresholdRatio).toBe(
      DEFAULT_PROACTIVE_COMPACTION_THRESHOLD_RATIO,
    );
  });
});

describe("shouldRunProactiveCompaction", () => {
  const defaultRatio = DEFAULT_PROACTIVE_COMPACTION_THRESHOLD_RATIO;

  it("skips when entry is missing", () => {
    expect(
      shouldRunProactiveCompaction({
        entry: undefined,
        contextWindowTokens: 200_000,
        thresholdRatio: defaultRatio,
      }),
    ).toBe(false);
  });

  it("skips when totalTokens is 0", () => {
    expect(
      shouldRunProactiveCompaction({
        entry: { totalTokens: 0 },
        contextWindowTokens: 200_000,
        thresholdRatio: defaultRatio,
      }),
    ).toBe(false);
  });

  it("skips when totalTokens is below threshold", () => {
    // 200k * 0.88 = 176k, so 100k should skip
    expect(
      shouldRunProactiveCompaction({
        entry: { totalTokens: 100_000 },
        contextWindowTokens: 200_000,
        thresholdRatio: defaultRatio,
      }),
    ).toBe(false);
  });

  it("triggers when totalTokens exceeds threshold", () => {
    // 200k * 0.88 = 176k, so 180k should trigger
    expect(
      shouldRunProactiveCompaction({
        entry: { totalTokens: 180_000 },
        contextWindowTokens: 200_000,
        thresholdRatio: defaultRatio,
      }),
    ).toBe(true);
  });

  it("triggers at exact threshold boundary", () => {
    // 200k * 0.88 = 176k
    expect(
      shouldRunProactiveCompaction({
        entry: { totalTokens: 176_000 },
        contextWindowTokens: 200_000,
        thresholdRatio: defaultRatio,
      }),
    ).toBe(true);
  });

  it("skips when proactive compaction already ran at current compactionCount", () => {
    expect(
      shouldRunProactiveCompaction({
        entry: {
          totalTokens: 190_000,
          compactionCount: 3,
          proactiveCompactionCount: 3,
        },
        contextWindowTokens: 200_000,
        thresholdRatio: defaultRatio,
      }),
    ).toBe(false);
  });

  it("triggers when proactive compaction ran at a different compactionCount", () => {
    expect(
      shouldRunProactiveCompaction({
        entry: {
          totalTokens: 190_000,
          compactionCount: 4,
          proactiveCompactionCount: 3,
        },
        contextWindowTokens: 200_000,
        thresholdRatio: defaultRatio,
      }),
    ).toBe(true);
  });

  it("triggers when proactiveCompactionCount is undefined", () => {
    expect(
      shouldRunProactiveCompaction({
        entry: {
          totalTokens: 190_000,
          compactionCount: 2,
        },
        contextWindowTokens: 200_000,
        thresholdRatio: defaultRatio,
      }),
    ).toBe(true);
  });

  it("respects custom threshold ratio", () => {
    // 200k * 0.5 = 100k, so 120k at 0.5 should trigger
    expect(
      shouldRunProactiveCompaction({
        entry: { totalTokens: 120_000 },
        contextWindowTokens: 200_000,
        thresholdRatio: 0.5,
      }),
    ).toBe(true);

    // 200k * 0.5 = 100k, so 80k at 0.5 should not trigger
    expect(
      shouldRunProactiveCompaction({
        entry: { totalTokens: 80_000 },
        contextWindowTokens: 200_000,
        thresholdRatio: 0.5,
      }),
    ).toBe(false);
  });

  it("handles small context window correctly", () => {
    // 16k * 0.88 = 14080, so 15k should trigger
    expect(
      shouldRunProactiveCompaction({
        entry: { totalTokens: 15_000 },
        contextWindowTokens: 16_000,
        thresholdRatio: defaultRatio,
      }),
    ).toBe(true);
  });
});
