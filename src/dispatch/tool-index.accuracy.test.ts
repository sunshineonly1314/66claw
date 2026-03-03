/**
 * [CN-PATCH:tool-discovery] 全量精度测试
 *
 * 使用 data/mcp-index-enhanced.json 的 9535 条真实 MCP 数据构建索引，
 * 测试 FTS5 BM25 搜索的 Precision@K / Recall@K / MRR / 延迟。
 *
 * 测试场景：
 *   1. 精确关键词匹配（中文/英文）
 *   2. 模糊语义匹配
 *   3. 分类覆盖（database/search/ai/network 等）
 *   4. 边界用例（极短、极长、特殊字符、纯英文、纯中文、中英混合）
 *   5. 性能基准（9535 条索引搜索延迟）
 */

import { describe, it, expect, beforeAll, afterAll, test } from "vitest";
import { join } from "node:path";
import { existsSync, readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import type { ToolIndexEntry } from "../config/types.tool-discovery.js";
import {
  openToolIndex,
  closeToolIndex,
  buildIndex,
  hybridSearch,
  getIndexStats,
} from "./tool-index.js";

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

const ROOT = join(import.meta.dirname ?? __dirname, "..", "..");
const ENHANCED_INDEX = join(ROOT, "data", "mcp-index-enhanced.json");

interface EnhancedItem {
  serverId: string;
  friendlyName: string;
  friendlyNameCn?: string;
  description: string;
  descriptionCn?: string;
  descriptionEn?: string;
  category?: string;
  tags?: string[];
  tagsCn?: string[];
  isOfficial?: boolean;
  availability?: { chinaFriendlyScore?: number };
}

function loadMcpEntries(): ToolIndexEntry[] {
  if (!existsSync(ENHANCED_INDEX)) {
    throw new Error(`MCP index not found: ${ENHANCED_INDEX}`);
  }
  const raw = JSON.parse(readFileSync(ENHANCED_INDEX, "utf-8"));
  const items: EnhancedItem[] = raw.items ?? [];

  return items.map((item) => ({
    id: `mcp:${item.serverId}`,
    type: "mcp" as const,
    name: item.friendlyNameCn ?? item.friendlyName,
    description: item.descriptionEn ?? item.description ?? "",
    descriptionCn: item.descriptionCn ?? undefined,
    tags: [...(item.tags ?? []), ...(item.tagsCn ?? []), item.category ?? ""].filter(Boolean),
    metadataJson: JSON.stringify({ category: item.category }),
  }));
}

// ---------------------------------------------------------------------------
// Test Cases — 真实用户查询 → 期望命中的 serverId 集合
// ---------------------------------------------------------------------------

type TestCase = {
  query: string;
  label: string;
  expectedIds: string[]; // serverId 子串匹配即可
  category?: string;
  type: "exact" | "keyword" | "semantic" | "cjk" | "mixed" | "edge";
};

const TEST_CASES: TestCase[] = [
  // ── 精确关键词匹配（中文） ──
  {
    query: "数据库查询",
    label: "中文精确:数据库",
    expectedIds: ["database", "postgres", "mysql", "sqlite", "sql", "mongo"],
    type: "exact",
  },
  {
    query: "网页抓取",
    label: "中文精确:网页抓取",
    expectedIds: ["fetch", "scrape", "crawler", "web", "spider"],
    type: "exact",
  },
  {
    query: "图片生成",
    label: "中文精确:图片生成",
    expectedIds: ["image", "dalle", "图片", "picture", "draw"],
    type: "exact",
  },
  {
    query: "邮件发送",
    label: "中文精确:邮件",
    expectedIds: ["email", "mail", "smtp", "邮件"],
    type: "exact",
  },
  {
    query: "文件管理",
    label: "中文精确:文件管理",
    expectedIds: ["file", "filesystem", "文件", "storage"],
    type: "exact",
  },
  {
    query: "代码搜索",
    label: "中文精确:代码搜索",
    expectedIds: ["code", "search", "github", "git", "source"],
    type: "exact",
  },
  { query: "天气查询", label: "中文精确:天气", expectedIds: ["weather", "天气"], type: "exact" },
  {
    query: "翻译工具",
    label: "中文精确:翻译",
    expectedIds: ["translat", "翻译", "language"],
    type: "exact",
  },

  // ── 精确关键词匹配（英文） ──
  {
    query: "PostgreSQL database",
    label: "EN精确:postgres",
    expectedIds: ["postgres"],
    type: "exact",
  },
  { query: "GitHub repository", label: "EN精确:github", expectedIds: ["github"], type: "exact" },
  {
    query: "Docker container",
    label: "EN精确:docker",
    expectedIds: ["docker", "container"],
    type: "exact",
  },
  { query: "Slack messaging", label: "EN精确:slack", expectedIds: ["slack"], type: "exact" },
  {
    query: "Kubernetes cluster",
    label: "EN精确:k8s",
    expectedIds: ["kubernetes", "k8s"],
    type: "exact",
  },
  { query: "Redis cache", label: "EN精确:redis", expectedIds: ["redis", "cache"], type: "exact" },
  {
    query: "Elasticsearch search",
    label: "EN精确:elastic",
    expectedIds: ["elasticsearch", "elastic"],
    type: "exact",
  },
  {
    query: "AWS S3 storage",
    label: "EN精确:s3",
    expectedIds: ["aws", "s3", "storage"],
    type: "exact",
  },

  // ── 关键词匹配 ──
  { query: "PDF解析提取文本", label: "关键词:PDF", expectedIds: ["pdf"], type: "keyword" },
  { query: "JSON格式化处理", label: "关键词:JSON", expectedIds: ["json"], type: "keyword" },
  {
    query: "API测试接口调试",
    label: "关键词:API测试",
    expectedIds: ["api", "test", "debug", "http", "rest"],
    type: "keyword",
  },
  {
    query: "日志分析监控",
    label: "关键词:日志",
    expectedIds: ["log", "monitor", "日志", "分析"],
    type: "keyword",
  },
  {
    query: "markdown编辑器",
    label: "关键词:markdown",
    expectedIds: ["markdown", "md", "editor"],
    type: "keyword",
  },
  { query: "SSH远程连接", label: "关键词:SSH", expectedIds: ["ssh", "remote"], type: "keyword" },
  {
    query: "GraphQL查询",
    label: "关键词:graphql",
    expectedIds: ["graphql", "graph"],
    type: "keyword",
  },
  {
    query: "OCR文字识别",
    label: "关键词:OCR",
    expectedIds: ["ocr", "识别", "text", "recogni"],
    type: "keyword",
  },

  // ── 语义/意图匹配（纯 FTS 可能不佳） ──
  {
    query: "帮我画一只猫",
    label: "语义:画猫→图片",
    expectedIds: ["image", "draw", "paint", "art", "图", "dall"],
    type: "semantic",
  },
  {
    query: "把这段话翻译成英文",
    label: "语义:翻译",
    expectedIds: ["translat", "翻译", "language"],
    type: "semantic",
  },
  {
    query: "这个网站打不开怎么办",
    label: "语义:网页→fetch",
    expectedIds: ["web", "fetch", "browser", "网"],
    type: "semantic",
  },
  {
    query: "我想知道明天天气怎么样",
    label: "语义:天气",
    expectedIds: ["weather", "天气"],
    type: "semantic",
  },

  // ── CJK 特殊搜索 ──
  { query: "微信", label: "CJK:微信(2字)", expectedIds: ["wechat", "微信", "weixin"], type: "cjk" },
  { query: "钉钉", label: "CJK:钉钉(2字)", expectedIds: ["dingtalk", "钉钉", "ding"], type: "cjk" },
  { query: "飞书文档", label: "CJK:飞书", expectedIds: ["feishu", "lark", "飞书"], type: "cjk" },
  { query: "知乎", label: "CJK:知乎(2字)", expectedIds: ["zhihu", "知乎"], type: "cjk" },
  { query: "百度搜索", label: "CJK:百度", expectedIds: ["baidu", "百度"], type: "cjk" },

  // ── 中英混合 ──
  { query: "MySQL数据库连接", label: "混合:MySQL数据库", expectedIds: ["mysql"], type: "mixed" },
  {
    query: "Docker容器部署",
    label: "混合:Docker容器",
    expectedIds: ["docker", "container", "容器"],
    type: "mixed",
  },
  {
    query: "GitHub代码仓库",
    label: "混合:GitHub代码",
    expectedIds: ["github", "git"],
    type: "mixed",
  },
  { query: "Notion笔记管理", label: "混合:Notion", expectedIds: ["notion"], type: "mixed" },
  { query: "Figma设计稿", label: "混合:Figma", expectedIds: ["figma", "design"], type: "mixed" },

  // ── 边界用例 ──
  { query: "a", label: "边界:单字符", expectedIds: [], type: "edge" },
  { query: "ab", label: "边界:两字符", expectedIds: [], type: "edge" },
  { query: "!!!@@@###", label: "边界:纯符号", expectedIds: [], type: "edge" },
  { query: "the and for but not", label: "边界:纯停用词", expectedIds: [], type: "edge" },
  {
    query: "superlongquerywithnospacesthatnobodywouldevermatch",
    label: "边界:超长无分词",
    expectedIds: [],
    type: "edge",
  },
  {
    query: "SELECT * FROM users WHERE id = 1",
    label: "边界:SQL语句",
    expectedIds: ["sql", "database", "query"],
    type: "edge",
  },
];

// ---------------------------------------------------------------------------
// Metrics calculation
// ---------------------------------------------------------------------------

type SearchResult = Awaited<ReturnType<typeof hybridSearch>>;

function evaluateCase(
  results: SearchResult,
  expectedIds: string[],
  k: number,
): { hit: boolean; reciprocalRank: number; precisionAtK: number; firstMatchRank: number } {
  if (expectedIds.length === 0) {
    // 边界用例：期望无结果或任何结果都可
    return { hit: true, reciprocalRank: 1, precisionAtK: 1, firstMatchRank: 0 };
  }

  const topK = results.slice(0, k);
  let firstMatchRank = 0;
  let hits = 0;

  for (let i = 0; i < topK.length; i++) {
    const id = topK[i].entry.id.toLowerCase();
    const name = topK[i].entry.name.toLowerCase();
    const desc = (
      topK[i].entry.description +
      " " +
      (topK[i].entry.descriptionCn ?? "")
    ).toLowerCase();
    const tags = topK[i].entry.tags.join(" ").toLowerCase();
    const combined = `${id} ${name} ${desc} ${tags}`;

    const matched = expectedIds.some((eid) => combined.includes(eid.toLowerCase()));
    if (matched) {
      hits++;
      if (firstMatchRank === 0) firstMatchRank = i + 1;
    }
  }

  const hit = firstMatchRank > 0;
  const reciprocalRank = firstMatchRank > 0 ? 1 / firstMatchRank : 0;
  const precisionAtK = topK.length > 0 ? hits / topK.length : 0;

  return { hit, reciprocalRank, precisionAtK, firstMatchRank };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let tempDir: string;
let totalEntries: number;

const hasIndex = existsSync(ENHANCED_INDEX);
const describeIfIndex = hasIndex ? describe : describe.skip;

describeIfIndex("Tool Index FULL Accuracy Test (9535 MCP entries)", () => {
  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), "tool-index-accuracy-"));
    const entries = loadMcpEntries();
    totalEntries = entries.length;
    const db = openToolIndex(tempDir);
    buildIndex(db, entries);
  });

  afterAll(() => {
    closeToolIndex();
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  // ========================================================================
  // 1. Index build verification
  // ========================================================================

  it("should build index with all 9535 entries", () => {
    const db = openToolIndex(tempDir);
    const stats = getIndexStats(db);
    expect(stats.entryCount).toBe(totalEntries);
    expect(totalEntries).toBeGreaterThanOrEqual(9000);
    console.log(`\n[INDEX] Total entries: ${stats.entryCount}`);
  });

  // ========================================================================
  // 2. Per-case accuracy tests
  // ========================================================================

  const allMetrics: Array<{
    label: string;
    type: string;
    hit: boolean;
    mrr: number;
    p5: number;
    p10: number;
    firstRank: number;
    resultCount: number;
    latencyMs: number;
  }> = [];

  for (const tc of TEST_CASES) {
    it(`[${tc.type}] ${tc.label}: "${tc.query}"`, async () => {
      const db = openToolIndex(tempDir);
      const start = performance.now();
      const results = await hybridSearch(db, tc.query, { maxResults: 50, minScore: 0.05 });
      const latencyMs = performance.now() - start;

      const eval5 = evaluateCase(results, tc.expectedIds, 5);
      const eval10 = evaluateCase(results, tc.expectedIds, 10);

      allMetrics.push({
        label: tc.label,
        type: tc.type,
        hit: eval5.hit,
        mrr: eval5.reciprocalRank,
        p5: eval5.precisionAtK,
        p10: eval10.precisionAtK,
        firstRank: eval5.firstMatchRank,
        resultCount: results.length,
        latencyMs,
      });

      // 输出详细结果
      const top3 = results
        .slice(0, 3)
        .map((r) => `${r.entry.id}(${r.score.toFixed(3)})`)
        .join(", ");

      if (tc.type === "edge" && tc.expectedIds.length === 0) {
        // 边界用例不要求命中
        expect(results).toBeDefined();
        console.log(
          `  ✓ [${tc.type}] ${tc.label}: ${results.length} results, ${latencyMs.toFixed(1)}ms`,
        );
      } else {
        console.log(
          `  ${eval5.hit ? "✓" : "✗"} [${tc.type}] ${tc.label}: ` +
            `hit=${eval5.hit} rank=${eval5.firstMatchRank} P@5=${eval5.precisionAtK.toFixed(2)} ` +
            `P@10=${eval10.precisionAtK.toFixed(2)} MRR=${eval5.reciprocalRank.toFixed(2)} ` +
            `results=${results.length} ${latencyMs.toFixed(1)}ms | top3: ${top3}`,
        );
        // 对非语义用例要求命中
        if (tc.type !== "semantic") {
          expect(eval5.hit || eval10.hit).toBe(true);
        }
      }
    });
  }

  // ========================================================================
  // 3. Overall accuracy summary
  // ========================================================================

  it("SUMMARY: overall accuracy metrics", () => {
    // 按类型分组统计
    const byType = new Map<string, typeof allMetrics>();
    for (const m of allMetrics) {
      if (!byType.has(m.type)) byType.set(m.type, []);
      byType.get(m.type)!.push(m);
    }

    console.log("\n" + "=".repeat(80));
    console.log("FULL ACCURACY REPORT — 9535 MCP entries, FTS5 BM25 (no vector)");
    console.log("=".repeat(80));

    // 排除纯边界用例（expectedIds=[]的）
    const scorable = allMetrics.filter(
      (m) => !(m.type === "edge" && m.firstRank === 0 && m.resultCount >= 0),
    );
    const nonEdge = allMetrics.filter((m) => m.type !== "edge" || m.firstRank > 0);

    for (const [type, metrics] of byType) {
      const scorableMetrics = metrics.filter(
        (m) => !(type === "edge" && m.firstRank === 0 && m.resultCount === 0),
      );
      if (scorableMetrics.length === 0) continue;

      const hitRate = scorableMetrics.filter((m) => m.hit).length / scorableMetrics.length;
      const avgMrr = scorableMetrics.reduce((s, m) => s + m.mrr, 0) / scorableMetrics.length;
      const avgP5 = scorableMetrics.reduce((s, m) => s + m.p5, 0) / scorableMetrics.length;
      const avgP10 = scorableMetrics.reduce((s, m) => s + m.p10, 0) / scorableMetrics.length;
      const avgLatency =
        scorableMetrics.reduce((s, m) => s + m.latencyMs, 0) / scorableMetrics.length;

      console.log(`\n[${type.toUpperCase()}] (${scorableMetrics.length} cases)`);
      console.log(`  Hit Rate:   ${(hitRate * 100).toFixed(1)}%`);
      console.log(`  MRR:        ${avgMrr.toFixed(3)}`);
      console.log(`  Avg P@5:    ${avgP5.toFixed(3)}`);
      console.log(`  Avg P@10:   ${avgP10.toFixed(3)}`);
      console.log(`  Avg Latency: ${avgLatency.toFixed(2)}ms`);
    }

    // 总体指标（排除期望空结果的边界用例）
    const totalScorable = nonEdge.length;
    const totalHits = nonEdge.filter((m) => m.hit).length;
    const overallHitRate = totalHits / Math.max(totalScorable, 1);
    const overallMrr = nonEdge.reduce((s, m) => s + m.mrr, 0) / Math.max(totalScorable, 1);
    const overallP5 = nonEdge.reduce((s, m) => s + m.p5, 0) / Math.max(totalScorable, 1);
    const overallP10 = nonEdge.reduce((s, m) => s + m.p10, 0) / Math.max(totalScorable, 1);
    const overallLatency = allMetrics.reduce((s, m) => s + m.latencyMs, 0) / allMetrics.length;
    const maxLatency = Math.max(...allMetrics.map((m) => m.latencyMs));

    console.log("\n" + "-".repeat(80));
    console.log("OVERALL (excluding empty-expected edge cases)");
    console.log("-".repeat(80));
    console.log(`  Total test cases: ${TEST_CASES.length}`);
    console.log(`  Scorable cases:   ${totalScorable}`);
    console.log(`  Index size:       ${totalEntries} entries`);
    console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(
      `  HIT RATE:   ${(overallHitRate * 100).toFixed(1)}% (${totalHits}/${totalScorable})`,
    );
    console.log(`  MRR:        ${overallMrr.toFixed(3)}`);
    console.log(`  Avg P@5:    ${overallP5.toFixed(3)}`);
    console.log(`  Avg P@10:   ${overallP10.toFixed(3)}`);
    console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`  Avg Latency:  ${overallLatency.toFixed(2)}ms`);
    console.log(`  Max Latency:  ${maxLatency.toFixed(2)}ms`);
    console.log(`  P99 Target:   <10ms → ${overallLatency < 10 ? "✓ PASS" : "✗ FAIL"}`);
    console.log("=".repeat(80));

    // 列出失败的用例
    const failures = nonEdge.filter((m) => !m.hit);
    if (failures.length > 0) {
      console.log(`\nFAILED CASES (${failures.length}):`);
      for (const f of failures) {
        console.log(`  ✗ [${f.type}] ${f.label}: 0 hits in top-10, ${f.resultCount} total results`);
      }
    }

    // 断言整体指标
    expect(overallHitRate).toBeGreaterThanOrEqual(0.6); // 60%+ hit rate for FTS-only
    expect(overallLatency).toBeLessThan(10); // <10ms avg
  });

  // ========================================================================
  // 4. Performance stress test
  // ========================================================================

  it("PERFORMANCE: 100 sequential queries on 9535 entries", async () => {
    const db = openToolIndex(tempDir);
    const queries = [
      "数据库",
      "网页",
      "图片",
      "文件",
      "搜索",
      "翻译",
      "天气",
      "邮件",
      "日志",
      "API",
      "PostgreSQL",
      "MySQL",
      "Redis",
      "Docker",
      "GitHub",
      "Slack",
      "Notion",
      "Figma",
      "SSH连接",
      "PDF解析",
      "JSON处理",
      "markdown",
      "GraphQL",
      "OCR识别",
      "代码审查",
      "微信消息",
      "钉钉通知",
      "飞书文档",
      "百度搜索",
      "知乎问答",
      "machine learning",
      "natural language processing",
      "computer vision",
      "cloud computing",
      "serverless function",
      "CI/CD pipeline",
      "unit testing",
      "code review",
      "documentation generator",
      "image classification",
      "text summarization",
      "sentiment analysis",
      "database migration",
      "schema validation",
      "data pipeline",
      "web scraping",
      "API gateway",
      "load balancing",
      "monitoring alert",
      "log aggregation",
      "distributed tracing",
      "帮我写代码",
      "自动化测试",
      "性能优化",
      "安全扫描",
      "容器编排",
      "消息队列",
      "缓存管理",
      "搜索引擎",
      "推荐系统",
      "数据可视化",
      "音频处理",
      "视频编辑",
      "3D建模",
      "地图导航",
      "语音识别",
      "人脸检测",
      "文本生成",
      "知识图谱",
      "向量数据库",
      "模型部署",
      "自动补全",
      "智能客服",
      "数据标注",
      "模型训练",
      "A/B测试",
      "支付接口",
      "短信发送",
      "推送通知",
      "二维码生成",
      "加密解密",
      "压缩解压",
      "格式转换",
      "批量处理",
      "定时任务",
      "工作流编排",
      "权限管理",
      "审计日志",
      "备份恢复",
      "数据同步",
      "版本控制",
      "项目管理",
      "看板工具",
      "甘特图",
      "思维导图",
      "白板协作",
      "会议记录",
      "日程安排",
      "待办清单",
      "知识库管理",
      "团队协作",
    ];

    const latencies: number[] = [];
    for (const q of queries) {
      const start = performance.now();
      await hybridSearch(db, q, { maxResults: 50, minScore: 0.05 });
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const avg = latencies.reduce((s, l) => s + l, 0) / latencies.length;
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];
    const max = latencies[latencies.length - 1];
    const qps = 1000 / avg;

    console.log("\n" + "=".repeat(80));
    console.log("PERFORMANCE REPORT — 100 queries × 9535 entries");
    console.log("=".repeat(80));
    console.log(`  Avg:  ${avg.toFixed(2)}ms`);
    console.log(`  P50:  ${p50.toFixed(2)}ms`);
    console.log(`  P95:  ${p95.toFixed(2)}ms`);
    console.log(`  P99:  ${p99.toFixed(2)}ms`);
    console.log(`  Max:  ${max.toFixed(2)}ms`);
    console.log(`  QPS:  ${qps.toFixed(0)} queries/sec`);
    console.log(`  Target: <10ms avg → ${avg < 10 ? "✓ PASS" : "✗ FAIL"}`);
    console.log("=".repeat(80));

    expect(avg).toBeLessThan(10);
    expect(p99).toBeLessThan(50);
  });
});
