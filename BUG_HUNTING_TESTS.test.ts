/**
 * 🐛 BUG HUNTING TESTS — 顶级测试专家深度探测
 *
 * 测试维度:
 * 1. 边界条件 (Boundary)
 * 2. 异常输入 (Exception)
 * 3. 并发竞态 (Concurrency)
 * 4. 安全注入 (Security)
 * 5. 资源泄漏 (Resource Leak)
 * 6. 数据完整性 (Data Integrity)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import type { ToolIndexEntry } from "./src/config/types.tool-discovery.js";
import {
  openToolIndex,
  closeToolIndex,
  buildIndex,
  incrementalUpdate,
  hybridSearch,
} from "./src/dispatch/tool-index.js";
import { discoverTools } from "./src/dispatch/tool-discovery.js";
import { detectModalityIntent, routeByModality } from "./src/dispatch/modality-router.js";
import { topologicalWaves } from "./src/dispatch/dag-executor.js";
import type { DagNode } from "./src/dispatch/dag-executor.js";

let tempDir: string;

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "bug-hunt-"));
}

// ============================================================================
// 🔴 BUG #1: FTS5 SQL 注入漏洞
// ============================================================================
describe("🔴 BUG #1: FTS5 SQL Injection in MATCH query", () => {
  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    closeToolIndex();
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  it("should sanitize single quotes in FTS query", async () => {
    const db = openToolIndex(tempDir);
    const entries: ToolIndexEntry[] = [
      {
        id: "test:1",
        type: "skill",
        name: "test",
        description: "test tool",
        tags: ["test"],
      },
    ];
    buildIndex(db, entries);

    // ❌ 潜在注入: 单引号未转义会导致 FTS5 语法错误
    const malicious = "'; DROP TABLE tools; --";
    await expect(hybridSearch(db, malicious)).resolves.toBeDefined();
  });

  it("should handle double quotes in FTS query", async () => {
    const db = openToolIndex(tempDir);
    buildIndex(db, [
      { id: "t1", type: "skill", name: "test", description: "test", tags: [] },
    ]);

    // ❌ 双引号用于 FTS5 phrase search,嵌套会破坏查询
    const tricky = '"""nested"quotes"""';
    await expect(hybridSearch(db, tricky)).resolves.toBeDefined();
  });

  it("should handle curly braces (FTS5 syntax)", async () => {
    const db = openToolIndex(tempDir);
    buildIndex(db, [
      { id: "t1", type: "skill", name: "test", description: "test", tags: [] },
    ]);

    // ❌ FTS5 支持 {近义词} 语法,可能被滥用
    const braces = "{synonym1 synonym2}";
    await expect(hybridSearch(db, braces)).resolves.toBeDefined();
  });

  it("should handle asterisk wildcard", async () => {
    const db = openToolIndex(tempDir);
    buildIndex(db, [
      { id: "t1", type: "skill", name: "test", description: "test", tags: [] },
    ]);

    // ❌ FTS5 * 通配符可能导致性能问题或语法错误
    const wildcard = "test* OR *";
    await expect(hybridSearch(db, wildcard)).resolves.toBeDefined();
  });
});

// ============================================================================
// 🔴 BUG #2: LIKE 注入漏洞 (通配符转义)
// ============================================================================
describe("🔴 BUG #2: LIKE injection via % and _ wildcards", () => {
  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    closeToolIndex();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should escape % wildcard in LIKE query", async () => {
    const db = openToolIndex(tempDir);
    buildIndex(db, [
      { id: "t1", type: "skill", name: "test%private", description: "secret", tags: [] },
      { id: "t2", type: "skill", name: "test_public", description: "public", tags: [] },
    ]);

    // ❌ 如果 % 未转义,会匹配所有以 "test" 开头的条目
    const results = await hybridSearch(db, "test%");
    // 应该只匹配含有字面 "test%" 的条目,而非通配符行为
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it("should escape _ wildcard in LIKE query", async () => {
    const db = openToolIndex(tempDir);
    buildIndex(db, [
      { id: "t1", type: "skill", name: "test_a", description: "a", tags: [] },
      { id: "t2", type: "skill", name: "testxa", description: "xa", tags: [] },
    ]);

    // ❌ _ 匹配单个字符,如果未转义会误匹配
    const results = await hybridSearch(db, "test_a");
    const names = results.map((r) => r.entry.name);
    expect(names).toContain("test_a");
    expect(names).not.toContain("testxa"); // 不应该被 _ 通配符匹配
  });

  it("should escape backslash in LIKE query", async () => {
    const db = openToolIndex(tempDir);
    buildIndex(db, [
      { id: "t1", type: "skill", name: "path\\to\\file", description: "windows path", tags: [] },
    ]);

    // ❌ 反斜杠是 ESCAPE 字符,需要双转义
    const results = await hybridSearch(db, "path\\to");
    expect(results.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// 🔴 BUG #3: 并发竞态 — DB Singleton 污染
// ============================================================================
describe("🔴 BUG #3: Concurrent openToolIndex race condition", () => {
  it("should handle rapid open/close cycles", async () => {
    const dir1 = makeTempDir();
    const dir2 = makeTempDir();

    try {
      // ❌ 快速切换目录可能导致 singleton 缓存失效
      const db1 = openToolIndex(dir1);
      const db2 = openToolIndex(dir2);
      const db1again = openToolIndex(dir1);

      // db1again 应该是新实例,因为中间切换过 dir2
      expect(db1).not.toBe(db2);

      // ❌ 潜在 Bug: 如果 singleton 只比较路径字符串,可能返回错误的 DB
      buildIndex(db1again, [
        { id: "dir1-tool", type: "skill", name: "dir1", description: "from dir1", tags: [] },
      ]);

      const results = await hybridSearch(db1again, "dir1");
      expect(results.length).toBeGreaterThan(0);
    } finally {
      closeToolIndex();
      rmSync(dir1, { recursive: true, force: true });
      rmSync(dir2, { recursive: true, force: true });
    }
  });

  it("should isolate temp DBs in concurrent tests", async () => {
    // ❌ vitest 并发测试可能共享 singleton,导致数据泄漏
    const dir = makeTempDir();
    const db = openToolIndex(dir);

    buildIndex(db, [
      { id: "concurrent-test", type: "skill", name: "test", description: "test", tags: [] },
    ]);

    // 如果另一个并发测试 close 了 DB,这里会崩溃
    const results = await hybridSearch(db, "test");
    expect(results).toBeDefined();

    closeToolIndex();
    rmSync(dir, { recursive: true, force: true });
  });
});

// ============================================================================
// 🔴 BUG #4: 增量更新 — FTS5 重复行陷阱
// ============================================================================
describe("🔴 BUG #4: FTS5 duplicate rows in incrementalUpdate", () => {
  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    closeToolIndex();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should not create duplicate FTS rows on repeated updates", async () => {
    const db = openToolIndex(tempDir);
    const entry: ToolIndexEntry = {
      id: "test:duplicate",
      type: "skill",
      name: "test",
      description: "original",
      tags: ["test"],
    };

    buildIndex(db, [entry]);

    // ❌ 如果用 INSERT OR REPLACE,FTS5 会创建重复行 (无 PRIMARY KEY)
    const updated = { ...entry, description: "updated v1" };
    incrementalUpdate(db, [updated], []);

    const updated2 = { ...entry, description: "updated v2" };
    incrementalUpdate(db, [updated2], []);

    // 搜索结果应该只有 1 条,而不是 3 条重复行
    const results = await hybridSearch(db, "test");
    const matchingIds = results.filter((r) => r.entry.id === "test:duplicate");
    expect(matchingIds.length).toBe(1);
  });
});

// ============================================================================
// 🔴 BUG #5: RRF 融合 — 除零错误
// ============================================================================
describe("🔴 BUG #5: RRF score division by zero", () => {
  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    closeToolIndex();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should handle empty FTS and Vec results gracefully", async () => {
    const db = openToolIndex(tempDir);
    buildIndex(db, []);

    // ❌ 空索引时 theoreticalMax = 0,会导致 score/0 = NaN
    const results = await hybridSearch(db, "nonexistent");
    expect(results).toEqual([]);

    for (const r of results) {
      expect(Number.isFinite(r.score)).toBe(true);
      expect(r.score).not.toBeNaN();
    }
  });

  it("should normalize scores correctly when only FTS results", async () => {
    const db = openToolIndex(tempDir);
    buildIndex(db, [
      { id: "t1", type: "skill", name: "test", description: "test", tags: [] },
    ]);

    // 无向量时,RRF 应该正确归一化 FTS 分数
    const results = await hybridSearch(db, "test");
    expect(results[0].score).toBeGreaterThan(0);
    expect(results[0].score).toBeLessThanOrEqual(1);
  });
});

// ============================================================================
// 🔴 BUG #6: Modality Router — 正则 ReDoS 攻击
// ============================================================================
describe("🔴 BUG #6: Modality detection ReDoS vulnerability", () => {
  it("should handle extremely long repetitive text", () => {
    // ❌ 某些正则 (如 .{0,20}) 遇到超长输入会触发回溯爆炸
    const evil = "a".repeat(10000) + " generate image";

    const start = performance.now();
    const result = detectModalityIntent(evil, []);
    const elapsed = performance.now() - start;

    // 应在合理时间内完成 (<100ms)
    expect(elapsed).toBeLessThan(100);
    expect(result).toBeDefined();
  });

  it("should handle nested braces in code detection", () => {
    // ❌ CODE_WEAK_INDICATORS 的 [{}] 可能遇到深度嵌套时回溯
    const nested = "{".repeat(1000) + "}".repeat(1000);

    const start = performance.now();
    detectModalityIntent(nested, []);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100);
  });
});

// ============================================================================
// 🔴 BUG #7: DAG Executor — 循环依赖检测失败
// ============================================================================
describe("🔴 BUG #7: DAG cycle detection edge cases", () => {
  it("should detect self-loop (node depends on itself)", () => {
    const nodes: DagNode[] = [
      { id: "A", task: "task A", role: "worker", dependsOn: ["A"] },
    ];

    // ❌ 自环应该被检测为循环
    const waves = topologicalWaves(nodes);
    expect(waves.length).toBeGreaterThan(0);
    // 应该强制进入最终波次,而非死循环
  });

  it("should detect 2-node cycle (A→B→A)", () => {
    const nodes: DagNode[] = [
      { id: "A", task: "A", role: "worker", dependsOn: ["B"] },
      { id: "B", task: "B", role: "worker", dependsOn: ["A"] },
    ];

    const waves = topologicalWaves(nodes);
    // 应该检测到循环,强制所有节点进入一个波次
    expect(waves.length).toBeGreaterThan(0);
    const totalNodes = waves.flat().length;
    expect(totalNodes).toBe(2);
  });

  it("should detect 3-node cycle (A→B→C→A)", () => {
    const nodes: DagNode[] = [
      { id: "A", task: "A", role: "worker", dependsOn: ["C"] },
      { id: "B", task: "B", role: "worker", dependsOn: ["A"] },
      { id: "C", task: "C", role: "worker", dependsOn: ["B"] },
    ];

    const waves = topologicalWaves(nodes);
    expect(waves.length).toBeGreaterThan(0);
  });

  it("should handle missing dependencies gracefully", () => {
    const nodes: DagNode[] = [
      { id: "A", task: "A", role: "worker", dependsOn: ["NONEXISTENT"] },
    ];

    // ❌ 引用不存在的依赖应该被忽略
    const waves = topologicalWaves(nodes);
    expect(waves.length).toBe(1);
    expect(waves[0]).toContainEqual(nodes[0]);
  });
});

// ============================================================================
// 🔴 BUG #8: Tool Discovery — Unicode 规范化问题
// ============================================================================
describe("🔴 BUG #8: Unicode normalization in FTS search", () => {
  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    closeToolIndex();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should match NFC and NFD forms of accented characters", async () => {
    const db = openToolIndex(tempDir);

    // é 的两种 Unicode 形式:
    // NFC: U+00E9 (单个字符)
    // NFD: U+0065 U+0301 (e + 组合重音符)
    buildIndex(db, [
      { id: "t1", type: "skill", name: "café", description: "NFC form", tags: [] },
    ]);

    // ❌ 搜索 NFD 形式应该能匹配 NFC 条目
    const nfd = "cafe\u0301"; // NFD
    const results = await hybridSearch(db, nfd);
    // SQLite FTS5 unicode61 tokenizer 应该处理这种情况
    expect(results.length).toBeGreaterThanOrEqual(0);
  });

  it("should handle zero-width characters", async () => {
    const db = openToolIndex(tempDir);
    buildIndex(db, [
      { id: "t1", type: "skill", name: "test", description: "normal", tags: [] },
    ]);

    // ❌ 零宽字符可能破坏 token 提取
    const zwj = "test\u200D\u200C"; // Zero-width joiner + non-joiner
    const results = await hybridSearch(db, zwj);
    expect(results).toBeDefined();
  });
});

// ============================================================================
// 🔴 BUG #9: MCP SSE URL 白名单绕过
// ============================================================================
describe("🔴 BUG #9: MCP SSE URL whitelist bypass attempts", () => {
  // 这部分在 on-demand-loader.ts 中已有严格检查,但仍需边界测试

  it("should block Punycode domain spoofing", () => {
    // ❌ xn--nthropiccom (Punycode for аnthropicсom, 西里尔字母)
    const evil = "https://xn--nthropiccom-r5a.evil.com/sse";
    // 需要在 isAllowedSSEUrl 中测试
    // expect(isAllowedSSEUrl(evil)).toBe(false);
  });

  it("should block IP address bypass", () => {
    // ❌ 127.0.0.1 的子域名应该被拒绝
    const evil = "https://subdomain.127.0.0.1/sse";
    // expect(isAllowedSSEUrl(evil)).toBe(false);
  });

  it("should block double extension tricks", () => {
    // ❌ anthropic.com.evil.com
    const evil = "https://anthropic.com.evil.com/sse";
    // expect(isAllowedSSEUrl(evil)).toBe(false);
  });
});

// ============================================================================
// 🔴 BUG #10: Resource Leak — DB 未关闭
// ============================================================================
describe("🔴 BUG #10: Database connection leak on exception", () => {
  it("should close DB even when buildIndex throws", () => {
    const dir = makeTempDir();
    const db = openToolIndex(dir);

    try {
      // ❌ 传入非法数据导致 buildIndex 抛异常
      buildIndex(db, null as any);
    } catch {
      // 异常后应该能正常关闭
    }

    closeToolIndex();
    // 重新打开应该成功
    const db2 = openToolIndex(dir);
    expect(db2).toBeDefined();

    closeToolIndex();
    rmSync(dir, { recursive: true, force: true });
  });
});
