/**
 * [CN-PATCH:memory-p0] defaults.ts — 内存系统配置注入专项测试
 *
 * 测试覆盖：
 * 1. Block 17: memorySearch.sources 注入
 * 2. Block 18: memorySearch.experimental.sessionMemory 注入
 * 3. Block 19: session.maintenance 注入
 * 4. Block 17→18 交叉覆盖测试（spread 安全性）
 * 5. 用户已有值不被覆盖
 * 6. 与上游 applyAgentDefaults / applySessionDefaults 的链式兼容
 * 7. 边界条件 + 设计缺陷探测
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { applyCnDefaults, applyAgentDefaults, applySessionDefaults } from "./defaults.js";
import { _resetChinaRegionCache } from "./region-cn.js";
import type { OpenClawCNConfig } from "./types.js";

// ============================================================================
// 辅助
// ============================================================================

function setCnRegion(value: boolean) {
  _resetChinaRegionCache();
  vi.stubEnv("OPENCLAWCN_REGION", value ? "cn" : "global");
}

// ============================================================================
// 1. Block 17: memorySearch.sources
// ============================================================================

describe("applyCnDefaults — Block 17: memorySearch.sources [CN-PATCH:memory-p0]", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("空 config → sources = ['memory', 'sessions']", () => {
    setCnRegion(true);
    const result = applyCnDefaults({});
    expect(result.agents?.defaults?.memorySearch?.sources).toEqual(["memory", "sessions"]);
  });

  it("非 CN 区域不注入 sources", () => {
    setCnRegion(false);
    const result = applyCnDefaults({});
    expect(result.agents?.defaults?.memorySearch?.sources).toBeUndefined();
  });

  it("用户已设置 sources → 不覆盖", () => {
    setCnRegion(true);
    const cfg: OpenClawCNConfig = {
      agents: {
        defaults: {
          memorySearch: {
            sources: ["memory"],
          },
        },
      },
    };
    const result = applyCnDefaults(cfg);
    expect(result.agents?.defaults?.memorySearch?.sources).toEqual(["memory"]);
  });

  it("sources 设为空数组 → 视为已设置，不覆盖", () => {
    setCnRegion(true);
    const cfg: OpenClawCNConfig = {
      agents: {
        defaults: {
          memorySearch: {
            sources: [],
          },
        },
      },
    };
    const result = applyCnDefaults(cfg);
    // 空数组 !== undefined，所以不覆盖
    expect(result.agents?.defaults?.memorySearch?.sources).toEqual([]);
  });
});

// ============================================================================
// 2. Block 18: memorySearch.experimental.sessionMemory
// ============================================================================

describe("applyCnDefaults — Block 18: sessionMemory [CN-PATCH:memory-p0]", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("空 config → sessionMemory = true", () => {
    setCnRegion(true);
    const result = applyCnDefaults({});
    expect(result.agents?.defaults?.memorySearch?.experimental?.sessionMemory).toBe(true);
  });

  it("用户已设置 sessionMemory=false → 不覆盖", () => {
    setCnRegion(true);
    const cfg: OpenClawCNConfig = {
      agents: {
        defaults: {
          memorySearch: {
            experimental: {
              sessionMemory: false,
            },
          },
        },
      },
    };
    const result = applyCnDefaults(cfg);
    expect(result.agents?.defaults?.memorySearch?.experimental?.sessionMemory).toBe(false);
  });
});

// ============================================================================
// 3. Block 19: session.maintenance
// ============================================================================

describe("applyCnDefaults — Block 19: session.maintenance [CN-PATCH:memory-p0]", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("session 未定义时不凭空创建 session 对象", () => {
    setCnRegion(true);
    const result = applyCnDefaults({});
    // Block 19 守卫：session === undefined → 跳过注入
    expect(result.session).toBeUndefined();
  });

  it("session 存在但 maintenance 未定义 → 注入 pruneAfter + maxEntries", () => {
    setCnRegion(true);
    const result = applyCnDefaults({ session: {} });
    expect(result.session?.maintenance?.pruneAfter).toBe("120d");
    expect(result.session?.maintenance?.maxEntries).toBe(5000);
  });

  it("用户已设置 pruneAfter → 不覆盖 pruneAfter，但注入 maxEntries", () => {
    setCnRegion(true);
    const cfg: OpenClawCNConfig = {
      session: {
        maintenance: {
          pruneAfter: "30d",
        },
      },
    };
    const result = applyCnDefaults(cfg);
    expect(result.session?.maintenance?.pruneAfter).toBe("30d");
    expect(result.session?.maintenance?.maxEntries).toBe(5000); // 独立注入
  });

  it("用户已设置 maxEntries 但未设 pruneAfter → 注入 pruneAfter，保留 maxEntries", () => {
    setCnRegion(true);
    const cfg: OpenClawCNConfig = {
      session: {
        maintenance: {
          maxEntries: 100,
        },
      },
    };
    const result = applyCnDefaults(cfg);
    expect(result.session?.maintenance?.pruneAfter).toBe("120d");
    expect(result.session?.maintenance?.maxEntries).toBe(100); // 用户值保留
  });

  it("用户未设置 maxEntries 且未设 pruneAfter → 注入 pruneAfter + 默认 maxEntries=5000", () => {
    setCnRegion(true);
    const cfg: OpenClawCNConfig = {
      session: {
        maintenance: {},
      },
    };
    const result = applyCnDefaults(cfg);
    expect(result.session?.maintenance?.pruneAfter).toBe("120d");
    expect(result.session?.maintenance?.maxEntries).toBe(5000);
  });
});

// ============================================================================
// 4. Block 17→18 交叉覆盖安全性
// ============================================================================

describe("applyCnDefaults — Block 17/18 交叉安全 [CN-PATCH:memory-p0]", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("Block 18 不覆盖 Block 17 设置的 sources", () => {
    setCnRegion(true);
    const result = applyCnDefaults({});
    // Block 17 先设置 sources=["memory","sessions"]
    // Block 18 再设置 experimental.sessionMemory=true
    // Block 18 使用 ...memSearch18（Block 17 结果的 memorySearch），所以 sources 被保留
    expect(result.agents?.defaults?.memorySearch?.sources).toEqual(["memory", "sessions"]);
    expect(result.agents?.defaults?.memorySearch?.experimental?.sessionMemory).toBe(true);
  });

  it("用户只设了 sources → Block 18 仍注入 sessionMemory", () => {
    setCnRegion(true);
    const cfg: OpenClawCNConfig = {
      agents: {
        defaults: {
          memorySearch: {
            sources: ["memory"], // 用户设置
          },
        },
      },
    };
    const result = applyCnDefaults(cfg);
    expect(result.agents?.defaults?.memorySearch?.sources).toEqual(["memory"]); // 保留用户值
    expect(result.agents?.defaults?.memorySearch?.experimental?.sessionMemory).toBe(true); // 新注入
  });

  it("用户只设了 sessionMemory → Block 17 仍注入 sources", () => {
    setCnRegion(true);
    const cfg: OpenClawCNConfig = {
      agents: {
        defaults: {
          memorySearch: {
            experimental: {
              sessionMemory: false,
            },
          },
        },
      },
    };
    const result = applyCnDefaults(cfg);
    expect(result.agents?.defaults?.memorySearch?.sources).toEqual(["memory", "sessions"]); // 新注入
    expect(result.agents?.defaults?.memorySearch?.experimental?.sessionMemory).toBe(false); // 保留用户值
  });

  it("memorySearch 已有其他字段 → 不被 Block 17/18 覆盖", () => {
    setCnRegion(true);
    const cfg: OpenClawCNConfig = {
      agents: {
        defaults: {
          memorySearch: {
            maxResults: 42,
            minScore: 0.5,
          },
        },
      },
    };
    const result = applyCnDefaults(cfg);
    expect(result.agents?.defaults?.memorySearch?.maxResults).toBe(42);
    expect(result.agents?.defaults?.memorySearch?.minScore).toBe(0.5);
    expect(result.agents?.defaults?.memorySearch?.sources).toEqual(["memory", "sessions"]);
    expect(result.agents?.defaults?.memorySearch?.experimental?.sessionMemory).toBe(true);
  });
});

// ============================================================================
// 5. 不可变性
// ============================================================================

describe("applyCnDefaults — Block 17/18/19 不可变性 [CN-PATCH:memory-p0]", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("不修改输入 config 对象（深层嵌套也安全）", () => {
    setCnRegion(true);
    const cfg: OpenClawCNConfig = {
      agents: {
        defaults: {
          memorySearch: {
            maxResults: 10,
          },
        },
      },
      session: {},
    };
    const cfgBefore = JSON.parse(JSON.stringify(cfg));
    applyCnDefaults(cfg);
    expect(cfg).toEqual(cfgBefore);
  });
});

// ============================================================================
// 6. 与上游链式调用兼容性
// ============================================================================

describe("applyCnDefaults + applySessionDefaults 链 [CN-PATCH:memory-p0]", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("CN defaults 在 applySessionDefaults 之后仍生效（session 已存在时）", () => {
    setCnRegion(true);
    // session 必须已存在，Block 19 才会注入 maintenance
    const cfg: OpenClawCNConfig = { session: {} };
    const afterSession = applySessionDefaults(cfg);
    const afterCn = applyCnDefaults(afterSession);
    expect(afterCn.agents?.defaults?.memorySearch?.sources).toEqual(["memory", "sessions"]);
    expect(afterCn.agents?.defaults?.memorySearch?.experimental?.sessionMemory).toBe(true);
    expect(afterCn.session?.maintenance?.pruneAfter).toBe("120d");
  });

  it("session 未定义时 CN 不注入 maintenance（不凭空创建 session）", () => {
    setCnRegion(true);
    const cfg: OpenClawCNConfig = {};
    const afterSession = applySessionDefaults(cfg);
    const afterCn = applyCnDefaults(afterSession);
    // session 未定义 → Block 19 守卫跳过 → session 保持 undefined
    expect(afterCn.session).toBeUndefined();
    // memorySearch 等不依赖 session 的注入仍正常工作
    expect(afterCn.agents?.defaults?.memorySearch?.sources).toEqual(["memory", "sessions"]);
  });

  it("applySessionDefaults 设置的 maintenance 被 CN 覆盖（如果 pruneAfter 未定义）", () => {
    setCnRegion(true);
    const cfg: OpenClawCNConfig = { session: {} };
    const afterSession = applySessionDefaults(cfg);
    const afterCn = applyCnDefaults(afterSession);
    // CN 注入 pruneAfter="120d"
    expect(afterCn.session?.maintenance?.pruneAfter).toBeDefined();
  });
});

// ============================================================================
// 7. 设计缺陷探测
// ============================================================================

describe("applyCnDefaults — 设计缺陷探测 [CN-PATCH:memory-p0]", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("用户只设 pruneAfter 时，maxEntries 仍获得 CN 默认值 5000", () => {
    // pruneAfter 和 maxEntries 独立检查
    // 用户设了 pruneAfter="30d" 但没设 maxEntries → 保留用户 pruneAfter，注入 CN maxEntries
    setCnRegion(true);
    const cfg: OpenClawCNConfig = {
      session: {
        maintenance: {
          pruneAfter: "30d",
          // maxEntries 未设置
        },
      },
    };
    const result = applyCnDefaults(cfg);
    expect(result.session?.maintenance?.pruneAfter).toBe("30d"); // 用户值保留
    expect(result.session?.maintenance?.maxEntries).toBe(5000); // CN 默认值注入
  });

  it("BUG-PROBE: sources 和 sessionMemory 不是原子操作", () => {
    // 如果用户设了 sources=["memory", "sessions"] 但没设 sessionMemory
    // Block 17 跳过（sources 已定义），Block 18 注入 sessionMemory=true
    // 结果：正确 ✓
    //
    // 但如果用户设了 sources=["memory", "sessions"] 且 sessionMemory=false
    // Block 17 跳过，Block 18 跳过
    // 结果：sources 包含 "sessions" 但 sessionMemory=false → normalizeSources 会过滤掉 sessions
    // 这是预期行为（用户显式禁用 sessionMemory）
    setCnRegion(true);
    const cfg: OpenClawCNConfig = {
      agents: {
        defaults: {
          memorySearch: {
            sources: ["memory", "sessions"],
            experimental: {
              sessionMemory: false,
            },
          },
        },
      },
    };
    const result = applyCnDefaults(cfg);
    expect(result.agents?.defaults?.memorySearch?.sources).toEqual(["memory", "sessions"]);
    expect(result.agents?.defaults?.memorySearch?.experimental?.sessionMemory).toBe(false);
    // ⚠️ 这种配置组合下，sources 包含 "sessions" 但实际不生效
    // normalizeSources() 会过滤掉 sessions（因为 sessionMemory=false）
    // 用户可能困惑：为什么设了 sources 但没效果
  });

  it("BUG-PROBE: experimental 对象的其他字段被 Block 18 spread 保留", () => {
    setCnRegion(true);
    const cfg: OpenClawCNConfig = {
      agents: {
        defaults: {
          memorySearch: {
            experimental: {
              someFutureFlag: true,
            } as any,
          },
        },
      },
    };
    const result = applyCnDefaults(cfg);
    expect((result.agents?.defaults?.memorySearch?.experimental as any)?.someFutureFlag).toBe(true);
    expect(result.agents?.defaults?.memorySearch?.experimental?.sessionMemory).toBe(true);
  });
});
