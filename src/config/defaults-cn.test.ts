/**
 * CN 区域默认配置测试
 *
 * 测试覆盖：
 * 1. 门控测试：非 CN 区域不生效
 * 2. 填空测试：空 config 正确填入所有 CN 默认值
 * 3. 不覆盖测试：已有值不被覆盖
 * 4. 新增参数测试：thinkingDefault / blockStreaming / typingMode / contextPruning / browser
 * 5. 链集成测试：与 applyAgentDefaults 配合正确
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { applyCnDefaults, applyAgentDefaults } from "./defaults.js";
import { CN_DEFAULT_SECURITY_CONFIG } from "./region-cn.js";
import type { OpenClawCNConfig } from "./types.js";

// ============================================================================
// 辅助
// ============================================================================

let savedRegion: string | undefined;

function setCnRegion(value: boolean) {
  savedRegion = process.env.OPENCLAWCN_REGION;
  process.env.OPENCLAWCN_REGION = value ? "cn" : "global";
}

function restoreRegion() {
  if (savedRegion === undefined) {
    delete process.env.OPENCLAWCN_REGION;
  } else {
    process.env.OPENCLAWCN_REGION = savedRegion;
  }
}

// ============================================================================
// 1. 门控测试
// ============================================================================

describe("applyCnDefaults — 门控", () => {
  afterEach(() => restoreRegion());

  it("非 CN 区域返回原始 config 引用（不做任何修改）", () => {
    setCnRegion(false);
    const cfg: OpenClawCNConfig = {};
    const result = applyCnDefaults(cfg);
    expect(result).toBe(cfg); // 同引用
  });

  it("非 CN 区域不填充任何字段", () => {
    setCnRegion(false);
    const cfg: OpenClawCNConfig = {};
    const result = applyCnDefaults(cfg);
    expect(result.tools).toBeUndefined();
    expect(result.agents).toBeUndefined();
  });
});

// ============================================================================
// 2. 填空测试
// ============================================================================

describe("applyCnDefaults — 填空（空 config）", () => {
  afterEach(() => restoreRegion());

  it("tools.exec.security = 'full'（全权限模式，最大能力释放）", () => {
    setCnRegion(true);
    const result = applyCnDefaults({});
    expect(result.tools?.exec?.security).toBe("full");
  });

  it("tools.exec.ask = 'off'（不询问，直接执行）", () => {
    setCnRegion(true);
    const result = applyCnDefaults({});
    expect(result.tools?.exec?.ask).toBe("off");
  });

  it("tools.exec.safeBins 应包含 CN_DEFAULT_SECURITY_CONFIG 中的常用命令", () => {
    setCnRegion(true);
    const result = applyCnDefaults({});
    const safeBins = result.tools?.exec?.safeBins;
    expect(safeBins).toBeDefined();
    expect(safeBins).toContain("python");
    expect(safeBins).toContain("node");
    expect(safeBins).toContain("npm");
    expect(safeBins).toContain("git");
    expect(safeBins).toEqual(CN_DEFAULT_SECURITY_CONFIG.tools.exec.allowlist);
  });

  it("agents.defaults.sandbox.mode = 'off'（不使用沙箱，最大能力释放）", () => {
    setCnRegion(true);
    const result = applyCnDefaults({});
    expect(result.agents?.defaults?.sandbox?.mode).toBe("off");
  });

  it("agents.defaults.sandbox.scope = 'agent'（按 agent 隔离）", () => {
    setCnRegion(true);
    const result = applyCnDefaults({});
    expect(result.agents?.defaults?.sandbox?.scope).toBe("agent");
  });

  it("agents.defaults.sandbox.workspaceAccess = 'rw'", () => {
    setCnRegion(true);
    const result = applyCnDefaults({});
    expect(result.agents?.defaults?.sandbox?.workspaceAccess).toBe("rw");
  });

  it("agents.defaults.timeoutSeconds = 900", () => {
    setCnRegion(true);
    const result = applyCnDefaults({});
    expect(result.agents?.defaults?.timeoutSeconds).toBe(900);
  });
});

// ============================================================================
// 3. 不覆盖测试
// ============================================================================

describe("applyCnDefaults — 不覆盖已有值", () => {
  afterEach(() => restoreRegion());

  it("不覆盖 tools.exec.security = 'deny'", () => {
    setCnRegion(true);
    const cfg: OpenClawCNConfig = { tools: { exec: { security: "deny" } } };
    const result = applyCnDefaults(cfg);
    expect(result.tools?.exec?.security).toBe("deny");
  });

  it("不覆盖 tools.exec.ask = 'always'", () => {
    setCnRegion(true);
    const cfg: OpenClawCNConfig = { tools: { exec: { ask: "always" } } };
    const result = applyCnDefaults(cfg);
    expect(result.tools?.exec?.ask).toBe("always");
  });

  it("不覆盖 tools.exec.safeBins", () => {
    setCnRegion(true);
    const customBins = ["mybin"];
    const cfg: OpenClawCNConfig = { tools: { exec: { safeBins: customBins } } };
    const result = applyCnDefaults(cfg);
    expect(result.tools?.exec?.safeBins).toEqual(customBins);
  });

  it("不覆盖 agents.defaults.sandbox.mode = 'all'", () => {
    setCnRegion(true);
    const cfg: OpenClawCNConfig = {
      agents: { defaults: { sandbox: { mode: "all" } } },
    };
    const result = applyCnDefaults(cfg);
    expect(result.agents?.defaults?.sandbox?.mode).toBe("all");
  });

  it("不覆盖 agents.defaults.timeoutSeconds = 300", () => {
    setCnRegion(true);
    const cfg: OpenClawCNConfig = {
      agents: { defaults: { timeoutSeconds: 300 } },
    };
    const result = applyCnDefaults(cfg);
    expect(result.agents?.defaults?.timeoutSeconds).toBe(300);
  });

  it("不覆盖 agents.defaults.thinkingDefault = 'high'", () => {
    setCnRegion(true);
    const cfg: OpenClawCNConfig = {
      agents: { defaults: { thinkingDefault: "high" } },
    };
    const result = applyCnDefaults(cfg);
    expect(result.agents?.defaults?.thinkingDefault).toBe("high");
  });

  it("不覆盖 agents.defaults.blockStreamingDefault = 'off'", () => {
    setCnRegion(true);
    const cfg: OpenClawCNConfig = {
      agents: { defaults: { blockStreamingDefault: "off" } },
    };
    const result = applyCnDefaults(cfg);
    expect(result.agents?.defaults?.blockStreamingDefault).toBe("off");
  });
});

// ============================================================================
// 4. 新增参数测试
// ============================================================================

describe("applyCnDefaults — 新增参数", () => {
  afterEach(() => restoreRegion());

  it("agents.defaults.thinkingDefault = 'medium'（默认中等思考深度）", () => {
    setCnRegion(true);
    const result = applyCnDefaults({});
    expect(result.agents?.defaults?.thinkingDefault).toBe("medium");
  });

  it("agents.defaults.blockStreamingDefault = 'on'（IM 分块输出）", () => {
    setCnRegion(true);
    const result = applyCnDefaults({});
    expect(result.agents?.defaults?.blockStreamingDefault).toBe("on");
  });

  it("agents.defaults.blockStreamingBreak = 'text_end'", () => {
    setCnRegion(true);
    const result = applyCnDefaults({});
    expect(result.agents?.defaults?.blockStreamingBreak).toBe("text_end");
  });

  it("agents.defaults.typingMode = 'thinking'（显示思考状态）", () => {
    setCnRegion(true);
    const result = applyCnDefaults({});
    expect(result.agents?.defaults?.typingMode).toBe("thinking");
  });

  it("agents.defaults.contextPruning 不由 CN 无条件注入（依赖上游 Anthropic auth 检测）", () => {
    setCnRegion(true);
    // 空 config 无 Anthropic auth → 上游不注入 contextPruning → CN 也不注入
    const result = applyCnDefaults({});
    expect(result.agents?.defaults?.contextPruning?.mode).toBeUndefined();
  });

  it("sandbox.browser.allowHostControl = true（允许宿主浏览器）", () => {
    setCnRegion(true);
    const result = applyCnDefaults({});
    expect(result.agents?.defaults?.sandbox?.browser?.allowHostControl).toBe(true);
  });
});

// ============================================================================
// 5. 链集成测试
// ============================================================================

describe("applyCnDefaults — 与 applyAgentDefaults 链式调用", () => {
  afterEach(() => restoreRegion());

  it("CN 不设置 maxConcurrent，applyAgentDefaults 设为全局默认 4", () => {
    setCnRegion(true);
    const cfg: OpenClawCNConfig = {};
    const afterCn = applyCnDefaults(cfg);
    const afterAgent = applyAgentDefaults(afterCn);
    expect(afterAgent.agents?.defaults?.maxConcurrent).toBe(4);
  });

  it("CN 不设置 subagents.maxConcurrent，applyAgentDefaults 设为全局默认 8", () => {
    setCnRegion(true);
    const cfg: OpenClawCNConfig = {};
    const afterCn = applyCnDefaults(cfg);
    const afterAgent = applyAgentDefaults(afterCn);
    expect(afterAgent.agents?.defaults?.subagents?.maxConcurrent).toBe(8);
  });
});

// ============================================================================
// 6. 不可变性测试
// ============================================================================

describe("applyCnDefaults — 不可变性", () => {
  afterEach(() => restoreRegion());

  it("不修改输入 config 对象", () => {
    setCnRegion(true);
    const cfg: OpenClawCNConfig = {};
    const cfgBefore = JSON.stringify(cfg);
    applyCnDefaults(cfg);
    expect(JSON.stringify(cfg)).toBe(cfgBefore);
  });

  it("返回新对象（非同一引用）", () => {
    setCnRegion(true);
    const cfg: OpenClawCNConfig = {};
    const result = applyCnDefaults(cfg);
    expect(result).not.toBe(cfg);
  });
});
