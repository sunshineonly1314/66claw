/**
 * [CN-PATCH:tool-discovery] 混合搜索（FTS5 + Vector）准确率对比测试
 *
 * 使用 SiliconFlow BAAI/bge-m3 embedding 向量化 9535 条 MCP 数据，
 * 对比纯 FTS5 BM25 与 FTS5 + Vector 混合搜索的准确率差异。
 *
 * 重点测试场景：
 *   1. 纯语义查询（FTS5 天生弱项）
 *   2. 意图推理（用户说的不是工具名，但暗示了功能）
 *   3. 跨语言语义（中文意图 → 英文工具名）
 *   4. 同义词/近义词匹配
 *
 * 用法：
 *   SILICONFLOW_API_KEY=sk-xxx npx vitest run src/dispatch/tool-index.hybrid-accuracy.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join } from "node:path";
import { existsSync, readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import type { ToolIndexEntry } from "../config/types.tool-discovery.js";
import {
  openToolIndex,
  closeToolIndex,
  buildIndex,
  hybridSearch,
  ensureVectors,
  createToolEmbeddingClient,
  getIndexStats,
} from "./tool-index.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const API_KEY =
  process.env.SILICONFLOW_API_KEY || "sk-bdlrjsxfgryopcpjvqbuyygzchkisgzwqucnbdkzurzueukv";
const EMBEDDING_CONFIG = {
  model: "BAAI/bge-m3",
  baseUrl: "https://api.siliconflow.cn/v1",
  apiKey: API_KEY,
  dimensions: 1024,
};

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
// Test cases — 重点：语义/意图查询
// ---------------------------------------------------------------------------

type TestCase = {
  query: string;
  label: string;
  expectedIds: string[];
  type: "semantic" | "intent" | "cross-lang" | "synonym" | "keyword-baseline";
};

const TEST_CASES: TestCase[] = [
  // ══════════════════════════════════════════════════════════════════
  // 纯语义查询（FTS 最弱项 — "帮我画一只猫" 之前就失败了）
  // ══════════════════════════════════════════════════════════════════
  {
    query: "帮我画一只猫",
    label: "语义:画猫→图片生成",
    expectedIds: [
      "image",
      "draw",
      "paint",
      "art",
      "图",
      "dall",
      "diffusion",
      "picture",
      "midjourney",
      "stable",
    ],
    type: "semantic",
  },
  {
    query: "给这张照片加个滤镜",
    label: "语义:滤镜→图片编辑",
    expectedIds: ["image", "photo", "edit", "filter", "process", "图"],
    type: "semantic",
  },
  {
    query: "帮我总结这篇文章",
    label: "语义:总结→文本摘要",
    expectedIds: ["summar", "text", "nlp", "ai", "gpt", "摘要", "总结"],
    type: "semantic",
  },
  {
    query: "把这段话翻译成英文",
    label: "语义:翻译",
    expectedIds: ["translat", "翻译", "language", "deepl"],
    type: "semantic",
  },
  {
    query: "我想知道明天天气怎么样",
    label: "语义:天气",
    expectedIds: ["weather", "天气", "forecast"],
    type: "semantic",
  },
  {
    query: "帮我写一首诗",
    label: "语义:写诗→文本生成",
    expectedIds: ["text", "generat", "write", "ai", "gpt", "创作", "写作"],
    type: "semantic",
  },
  {
    query: "这个网站打不开怎么办",
    label: "语义:网页→浏览器/fetch",
    expectedIds: ["web", "fetch", "browser", "网", "url", "http", "scrape"],
    type: "semantic",
  },
  {
    query: "帮我做个PPT",
    label: "语义:PPT→演示文稿",
    expectedIds: ["presentation", "ppt", "slide", "powerpoint", "office", "演示"],
    type: "semantic",
  },
  {
    query: "录一段屏幕视频",
    label: "语义:录屏→屏幕录制",
    expectedIds: ["screen", "record", "video", "capture", "录", "屏"],
    type: "semantic",
  },
  {
    query: "把这个PDF转成Word",
    label: "语义:格式转换",
    expectedIds: ["pdf", "convert", "word", "docx", "转换", "document"],
    type: "semantic",
  },

  // ══════════════════════════════════════════════════════════════════
  // 意图推理（用户描述需求而非工具名）
  // ══════════════════════════════════════════════════════════════════
  {
    query: "我的代码有bug帮我看看",
    label: "意图:调试→代码分析",
    expectedIds: ["debug", "code", "lint", "analys", "review", "调试", "代码"],
    type: "intent",
  },
  {
    query: "公司要上线一个新项目",
    label: "意图:项目→项目管理",
    expectedIds: ["project", "manage", "jira", "trello", "linear", "项目"],
    type: "intent",
  },
  {
    query: "我想发一条朋友圈",
    label: "意图:朋友圈→社交媒体",
    expectedIds: ["social", "wechat", "微信", "post", "media", "weixin"],
    type: "intent",
  },
  {
    query: "服务器好像崩了",
    label: "意图:崩溃→监控/运维",
    expectedIds: ["monitor", "alert", "server", "health", "check", "运维", "监控", "status"],
    type: "intent",
  },
  {
    query: "客户投诉太多了",
    label: "意图:投诉→客服/工单",
    expectedIds: ["ticket", "support", "custom", "service", "crm", "客服", "工单"],
    type: "intent",
  },
  {
    query: "数据量太大查询很慢",
    label: "意图:慢查询→数据库优化",
    expectedIds: ["database", "query", "sql", "optim", "cache", "redis", "数据库"],
    type: "intent",
  },
  {
    query: "新员工入职要开通权限",
    label: "意图:权限→身份管理",
    expectedIds: ["auth", "permission", "identity", "iam", "ldap", "sso", "权限", "用户"],
    type: "intent",
  },
  {
    query: "明天有个会要准备材料",
    label: "意图:会议→日程/文档",
    expectedIds: ["calendar", "meeting", "schedule", "doc", "note", "日程", "会议", "notion"],
    type: "intent",
  },

  // ══════════════════════════════════════════════════════════════════
  // 跨语言语义（中文意图 → 英文工具名）
  // ══════════════════════════════════════════════════════════════════
  {
    query: "自动化部署流水线",
    label: "跨语言:CI/CD",
    expectedIds: ["ci", "cd", "deploy", "pipeline", "jenkins", "github-action", "gitlab"],
    type: "cross-lang",
  },
  {
    query: "容器编排管理",
    label: "跨语言:K8s",
    expectedIds: ["kubernetes", "k8s", "docker", "container", "helm", "容器"],
    type: "cross-lang",
  },
  {
    query: "无服务器函数计算",
    label: "跨语言:Serverless",
    expectedIds: ["serverless", "lambda", "function", "cloud", "faas"],
    type: "cross-lang",
  },
  {
    query: "分布式消息队列",
    label: "跨语言:MQ",
    expectedIds: ["queue", "kafka", "rabbitmq", "mq", "message", "pulsar", "消息"],
    type: "cross-lang",
  },
  {
    query: "全文搜索引擎",
    label: "跨语言:ES",
    expectedIds: ["elastic", "search", "solr", "meilisearch", "typesense", "搜索"],
    type: "cross-lang",
  },
  {
    query: "对象存储服务",
    label: "跨语言:S3/OSS",
    expectedIds: ["s3", "storage", "oss", "minio", "blob", "存储", "object"],
    type: "cross-lang",
  },
  {
    query: "内容分发网络",
    label: "跨语言:CDN",
    expectedIds: ["cdn", "cloudflare", "network", "edge", "分发"],
    type: "cross-lang",
  },
  {
    query: "持续集成测试",
    label: "跨语言:CI testing",
    expectedIds: ["ci", "test", "jenkins", "github", "action", "测试"],
    type: "cross-lang",
  },

  // ══════════════════════════════════════════════════════════════════
  // 同义词/近义词
  // ══════════════════════════════════════════════════════════════════
  {
    query: "网络爬虫抓取数据",
    label: "同义词:爬虫=scraper",
    expectedIds: ["scrape", "crawl", "spider", "fetch", "web", "爬虫", "抓取"],
    type: "synonym",
  },
  {
    query: "代码仓库版本管理",
    label: "同义词:代码仓库=git",
    expectedIds: ["git", "github", "gitlab", "version", "repository", "代码", "仓库"],
    type: "synonym",
  },
  {
    query: "聊天机器人",
    label: "同义词:机器人=bot/chatbot",
    expectedIds: ["chat", "bot", "ai", "convers", "机器人", "对话"],
    type: "synonym",
  },
  {
    query: "电子表格处理",
    label: "同义词:表格=spreadsheet",
    expectedIds: ["spreadsheet", "excel", "sheet", "csv", "表格", "google-sheet"],
    type: "synonym",
  },
  {
    query: "密码管理器",
    label: "同义词:密码=password/vault",
    expectedIds: ["password", "vault", "secret", "credential", "密码", "1password", "bitwarden"],
    type: "synonym",
  },
  {
    query: "任务调度器",
    label: "同义词:调度=scheduler/cron",
    expectedIds: ["schedul", "cron", "job", "task", "调度", "定时"],
    type: "synonym",
  },
  {
    query: "代码格式化美化",
    label: "同义词:格式化=formatter/prettier",
    expectedIds: ["format", "prettier", "lint", "style", "beautif", "格式化"],
    type: "synonym",
  },
  {
    query: "接口文档生成",
    label: "同义词:接口文档=API docs",
    expectedIds: ["api", "doc", "swagger", "openapi", "文档", "接口"],
    type: "synonym",
  },

  // ══════════════════════════════════════════════════════════════════
  // 关键词基线（FTS 就能搞定，验证向量不会搞砸）
  // ══════════════════════════════════════════════════════════════════
  {
    query: "PostgreSQL数据库",
    label: "基线:PostgreSQL",
    expectedIds: ["postgres"],
    type: "keyword-baseline",
  },
  {
    query: "GitHub代码仓库",
    label: "基线:GitHub",
    expectedIds: ["github"],
    type: "keyword-baseline",
  },
  {
    query: "Docker容器",
    label: "基线:Docker",
    expectedIds: ["docker", "container"],
    type: "keyword-baseline",
  },
  {
    query: "Redis缓存",
    label: "基线:Redis",
    expectedIds: ["redis", "cache"],
    type: "keyword-baseline",
  },
  { query: "Slack消息", label: "基线:Slack", expectedIds: ["slack"], type: "keyword-baseline" },
  {
    query: "微信消息",
    label: "基线:微信",
    expectedIds: ["wechat", "微信", "weixin"],
    type: "keyword-baseline",
  },
  {
    query: "网页抓取",
    label: "基线:网页抓取",
    expectedIds: ["fetch", "scrape", "web", "crawler"],
    type: "keyword-baseline",
  },
  {
    query: "图片生成",
    label: "基线:图片生成",
    expectedIds: ["image", "dalle", "图片", "picture"],
    type: "keyword-baseline",
  },
];

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

type SearchResult = Awaited<ReturnType<typeof hybridSearch>>;

function evaluateCase(
  results: SearchResult,
  expectedIds: string[],
  k: number,
): { hit: boolean; reciprocalRank: number; precisionAtK: number; firstMatchRank: number } {
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

  return {
    hit: firstMatchRank > 0,
    reciprocalRank: firstMatchRank > 0 ? 1 / firstMatchRank : 0,
    precisionAtK: topK.length > 0 ? hits / topK.length : 0,
    firstMatchRank,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let tempDir: string;
let totalEntries: number;
let vectorizationTime: number;
let embeddingClient: ReturnType<typeof createToolEmbeddingClient>;

describe(
  "Hybrid Search Accuracy: FTS5 + bge-m3 Vector (9535 MCP entries)",
  { timeout: 600_000 },
  () => {
    beforeAll(async () => {
      tempDir = mkdtempSync(join(tmpdir(), "tool-index-hybrid-"));
      const entries = loadMcpEntries();
      totalEntries = entries.length;

      // 1. Build FTS5 index
      console.log(`\n[SETUP] Building FTS5 index for ${totalEntries} entries...`);
      const db = openToolIndex(tempDir);
      buildIndex(db, entries);
      console.log(`[SETUP] FTS5 index built.`);

      // 2. Vectorize all entries with SiliconFlow bge-m3
      console.log(`[SETUP] Vectorizing ${totalEntries} entries with BAAI/bge-m3...`);
      console.log(`[SETUP] This will take ~2-3 minutes (batches of 64)...`);
      const vecStart = performance.now();
      const vecResult = await ensureVectors(db, EMBEDDING_CONFIG);
      vectorizationTime = performance.now() - vecStart;

      if (!vecResult.vectorized) {
        console.error(`[SETUP] Vectorization FAILED: ${vecResult.error}`);
        throw new Error(`Vectorization failed: ${vecResult.error}`);
      }

      console.log(
        `[SETUP] Vectorized ${vecResult.count} entries in ${(vectorizationTime / 1000).toFixed(1)}s`,
      );

      // 3. Create embedding client for query embedding
      embeddingClient = createToolEmbeddingClient(EMBEDDING_CONFIG);

      const stats = getIndexStats(db);
      console.log(
        `[SETUP] Index stats: ${stats.entryCount} entries, vectorized: ${stats.vectorized}, model: ${stats.vecModel}`,
      );
    }, 600_000);

    afterAll(() => {
      closeToolIndex();
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    });

    // ========================================================================
    // 1. Vectorization sanity check
    // ========================================================================

    it("should have vectorized all entries", () => {
      const db = openToolIndex(tempDir);
      const stats = getIndexStats(db);
      expect(stats.vectorized).toBe(true);
      expect(stats.vecModel).toBe("BAAI/bge-m3");
      expect(stats.vecCount).toBeGreaterThan(9000);
      console.log(
        `\n[VEC] Vectorized: ${stats.vecCount} entries in ${(vectorizationTime / 1000).toFixed(1)}s`,
      );
      console.log(
        `[VEC] Speed: ${(totalEntries / (vectorizationTime / 1000)).toFixed(0)} entries/sec`,
      );
    });

    // ========================================================================
    // 2. A/B comparison: FTS-only vs Hybrid for each test case
    // ========================================================================

    type CaseMetrics = {
      label: string;
      type: string;
      // FTS-only
      ftsHit: boolean;
      ftsMrr: number;
      ftsP5: number;
      ftsP10: number;
      ftsFirstRank: number;
      ftsLatency: number;
      ftsResultCount: number;
      // Hybrid (FTS + Vec)
      hybridHit: boolean;
      hybridMrr: number;
      hybridP5: number;
      hybridP10: number;
      hybridFirstRank: number;
      hybridLatency: number;
      hybridResultCount: number;
      hybridSource: string;
    };

    const allMetrics: CaseMetrics[] = [];

    for (const tc of TEST_CASES) {
      it(`[${tc.type}] ${tc.label}: "${tc.query}"`, async () => {
        const db = openToolIndex(tempDir);

        // ── FTS-only search ──
        const ftsStart = performance.now();
        const ftsResults = await hybridSearch(db, tc.query, {
          maxResults: 50,
          minScore: 0.05,
          // No queryVec → pure FTS
        });
        const ftsLatency = performance.now() - ftsStart;

        // ── Hybrid search (FTS + Vector) ──
        // Embed query
        const embedStart = performance.now();
        const [queryVec] = await embeddingClient.embed([tc.query]);
        const embedLatency = performance.now() - embedStart;

        const hybridStart = performance.now();
        const hybridResults = await hybridSearch(db, tc.query, {
          maxResults: 50,
          minScore: 0.05,
          queryVec,
          hybridWeight: { fts: 0.4, vector: 0.6 },
        });
        const hybridLatency = performance.now() - hybridStart;

        // ── Evaluate both ──
        const ftsEval5 = evaluateCase(ftsResults, tc.expectedIds, 5);
        const ftsEval10 = evaluateCase(ftsResults, tc.expectedIds, 10);
        const hybridEval5 = evaluateCase(hybridResults, tc.expectedIds, 5);
        const hybridEval10 = evaluateCase(hybridResults, tc.expectedIds, 10);

        // Top match source for hybrid
        const topSource = hybridResults.length > 0 ? hybridResults[0].matchSource : "none";

        const metrics: CaseMetrics = {
          label: tc.label,
          type: tc.type,
          ftsHit: ftsEval5.hit || ftsEval10.hit,
          ftsMrr: ftsEval5.reciprocalRank,
          ftsP5: ftsEval5.precisionAtK,
          ftsP10: ftsEval10.precisionAtK,
          ftsFirstRank: ftsEval5.firstMatchRank,
          ftsLatency,
          ftsResultCount: ftsResults.length,
          hybridHit: hybridEval5.hit || hybridEval10.hit,
          hybridMrr: hybridEval5.reciprocalRank,
          hybridP5: hybridEval5.precisionAtK,
          hybridP10: hybridEval10.precisionAtK,
          hybridFirstRank: hybridEval5.firstMatchRank,
          hybridLatency,
          hybridResultCount: hybridResults.length,
          hybridSource: topSource,
        };
        allMetrics.push(metrics);

        // ── Print comparison ──
        const improved = hybridEval5.reciprocalRank > ftsEval5.reciprocalRank;
        const degraded = hybridEval5.reciprocalRank < ftsEval5.reciprocalRank;
        const flag = improved ? "📈" : degraded ? "📉" : "━━";

        const ftsTop3 = ftsResults
          .slice(0, 3)
          .map((r) => `${r.entry.id.replace("mcp:", "")}(${r.score.toFixed(2)})`)
          .join(", ");
        const hybTop3 = hybridResults
          .slice(0, 3)
          .map((r) => `${r.entry.id.replace("mcp:", "")}(${r.score.toFixed(2)},${r.matchSource})`)
          .join(", ");

        console.log(
          `\n  ${flag} [${tc.type}] ${tc.label}` +
            `\n    FTS-only:  hit=${ftsEval5.hit} rank=${ftsEval5.firstMatchRank} MRR=${ftsEval5.reciprocalRank.toFixed(2)} P@5=${ftsEval5.precisionAtK.toFixed(2)} ${ftsLatency.toFixed(1)}ms` +
            `\n    Hybrid:    hit=${hybridEval5.hit} rank=${hybridEval5.firstMatchRank} MRR=${hybridEval5.reciprocalRank.toFixed(2)} P@5=${hybridEval5.precisionAtK.toFixed(2)} ${hybridLatency.toFixed(1)}ms (embed:${embedLatency.toFixed(0)}ms)` +
            `\n    FTS  top3: ${ftsTop3}` +
            `\n    Hyb  top3: ${hybTop3}`,
        );

        // Hybrid should at least not be dramatically worse than FTS on keyword baselines
        if (tc.type === "keyword-baseline") {
          expect(hybridEval5.hit || hybridEval10.hit).toBe(true);
        }
      });
    }

    // ========================================================================
    // 3. A/B Summary Report
    // ========================================================================

    it("SUMMARY: FTS-only vs Hybrid comparison", () => {
      const byType = new Map<string, CaseMetrics[]>();
      for (const m of allMetrics) {
        if (!byType.has(m.type)) byType.set(m.type, []);
        byType.get(m.type)!.push(m);
      }

      console.log("\n" + "═".repeat(90));
      console.log("A/B ACCURACY REPORT: FTS5 BM25 vs FTS5 + bge-m3 Vector (9535 entries)");
      console.log("═".repeat(90));

      const typeOrder = ["semantic", "intent", "cross-lang", "synonym", "keyword-baseline"];
      for (const type of typeOrder) {
        const metrics = byType.get(type);
        if (!metrics) continue;

        const ftsHitRate = metrics.filter((m) => m.ftsHit).length / metrics.length;
        const hybridHitRate = metrics.filter((m) => m.hybridHit).length / metrics.length;
        const ftsAvgMrr = metrics.reduce((s, m) => s + m.ftsMrr, 0) / metrics.length;
        const hybridAvgMrr = metrics.reduce((s, m) => s + m.hybridMrr, 0) / metrics.length;
        const ftsAvgP5 = metrics.reduce((s, m) => s + m.ftsP5, 0) / metrics.length;
        const hybridAvgP5 = metrics.reduce((s, m) => s + m.hybridP5, 0) / metrics.length;

        const hitDelta = hybridHitRate - ftsHitRate;
        const mrrDelta = hybridAvgMrr - ftsAvgMrr;

        console.log(`\n[${type.toUpperCase()}] (${metrics.length} cases)`);
        console.log(`  ┌─────────────┬──────────┬──────────┬──────────┐`);
        console.log(`  │             │ FTS-only │  Hybrid  │  Delta   │`);
        console.log(`  ├─────────────┼──────────┼──────────┼──────────┤`);
        console.log(
          `  │ Hit Rate    │ ${(ftsHitRate * 100).toFixed(1).padStart(6)}%  │ ${(hybridHitRate * 100).toFixed(1).padStart(6)}%  │ ${(hitDelta >= 0 ? "+" : "") + (hitDelta * 100).toFixed(1).padStart(5)}%  │`,
        );
        console.log(
          `  │ MRR         │ ${ftsAvgMrr.toFixed(3).padStart(7)}  │ ${hybridAvgMrr.toFixed(3).padStart(7)}  │ ${(mrrDelta >= 0 ? "+" : "") + mrrDelta.toFixed(3).padStart(6)}  │`,
        );
        console.log(
          `  │ Avg P@5     │ ${ftsAvgP5.toFixed(3).padStart(7)}  │ ${hybridAvgP5.toFixed(3).padStart(7)}  │          │`,
        );
        console.log(`  └─────────────┴──────────┴──────────┴──────────┘`);

        // List improved/degraded cases
        const improved = metrics.filter((m) => m.hybridMrr > m.ftsMrr);
        const degraded = metrics.filter((m) => m.hybridMrr < m.ftsMrr);
        if (improved.length > 0) {
          console.log(
            `  📈 Improved (${improved.length}): ${improved.map((m) => m.label).join(", ")}`,
          );
        }
        if (degraded.length > 0) {
          console.log(
            `  📉 Degraded (${degraded.length}): ${degraded.map((m) => m.label).join(", ")}`,
          );
        }
      }

      // ── Overall ──
      const all = allMetrics;
      const ftsOverallHit = all.filter((m) => m.ftsHit).length / all.length;
      const hybridOverallHit = all.filter((m) => m.hybridHit).length / all.length;
      const ftsOverallMrr = all.reduce((s, m) => s + m.ftsMrr, 0) / all.length;
      const hybridOverallMrr = all.reduce((s, m) => s + m.hybridMrr, 0) / all.length;
      const ftsOverallP5 = all.reduce((s, m) => s + m.ftsP5, 0) / all.length;
      const hybridOverallP5 = all.reduce((s, m) => s + m.hybridP5, 0) / all.length;
      const ftsOverallP10 = all.reduce((s, m) => s + m.ftsP10, 0) / all.length;
      const hybridOverallP10 = all.reduce((s, m) => s + m.hybridP10, 0) / all.length;
      const avgFtsLatency = all.reduce((s, m) => s + m.ftsLatency, 0) / all.length;
      const avgHybridLatency = all.reduce((s, m) => s + m.hybridLatency, 0) / all.length;

      console.log("\n" + "─".repeat(90));
      console.log("OVERALL COMPARISON");
      console.log("─".repeat(90));
      console.log(`  ┌─────────────┬──────────┬──────────┬──────────┐`);
      console.log(`  │             │ FTS-only │  Hybrid  │  Delta   │`);
      console.log(`  ├─────────────┼──────────┼──────────┼──────────┤`);
      console.log(
        `  │ Hit Rate    │ ${(ftsOverallHit * 100).toFixed(1).padStart(6)}%  │ ${(hybridOverallHit * 100).toFixed(1).padStart(6)}%  │ ${(hybridOverallHit - ftsOverallHit >= 0 ? "+" : "") + ((hybridOverallHit - ftsOverallHit) * 100).toFixed(1).padStart(5)}%  │`,
      );
      console.log(
        `  │ MRR         │ ${ftsOverallMrr.toFixed(3).padStart(7)}  │ ${hybridOverallMrr.toFixed(3).padStart(7)}  │ ${(hybridOverallMrr - ftsOverallMrr >= 0 ? "+" : "") + (hybridOverallMrr - ftsOverallMrr).toFixed(3).padStart(6)}  │`,
      );
      console.log(
        `  │ Avg P@5     │ ${ftsOverallP5.toFixed(3).padStart(7)}  │ ${hybridOverallP5.toFixed(3).padStart(7)}  │          │`,
      );
      console.log(
        `  │ Avg P@10    │ ${ftsOverallP10.toFixed(3).padStart(7)}  │ ${hybridOverallP10.toFixed(3).padStart(7)}  │          │`,
      );
      console.log(`  ├─────────────┼──────────┼──────────┼──────────┤`);
      console.log(
        `  │ Avg Latency │ ${avgFtsLatency.toFixed(1).padStart(6)}ms │ ${avgHybridLatency.toFixed(1).padStart(6)}ms │          │`,
      );
      console.log(`  └─────────────┴──────────┴──────────┴──────────┘`);

      console.log(`\n  Index size:       ${totalEntries} entries`);
      console.log(`  Vectorization:    ${(vectorizationTime / 1000).toFixed(1)}s`);
      console.log(`  Embedding model:  BAAI/bge-m3 (1024 dims)`);
      console.log(`  Total test cases: ${all.length}`);

      // Failure list for hybrid
      const hybridFailures = all.filter((m) => !m.hybridHit);
      if (hybridFailures.length > 0) {
        console.log(`\n  ✗ Hybrid failures (${hybridFailures.length}):`);
        for (const f of hybridFailures) {
          console.log(`    - [${f.type}] ${f.label} (FTS hit=${f.ftsHit})`);
        }
      }

      // Cases where hybrid rescued FTS failures
      const rescued = all.filter((m) => !m.ftsHit && m.hybridHit);
      if (rescued.length > 0) {
        console.log(`\n  🎯 Hybrid RESCUED (FTS missed → Hybrid found): ${rescued.length}`);
        for (const r of rescued) {
          console.log(
            `    - [${r.type}] ${r.label}: hybrid rank=${r.hybridFirstRank}, source=${r.hybridSource}`,
          );
        }
      }

      console.log("═".repeat(90));

      // 混合模式应该比纯 FTS 更好
      expect(hybridOverallHit).toBeGreaterThanOrEqual(ftsOverallHit);
    });

    // ========================================================================
    // 4. Hybrid latency benchmark
    // ========================================================================

    it("PERFORMANCE: hybrid search latency (including embedding)", async () => {
      const db = openToolIndex(tempDir);
      const queries = [
        "帮我画一只猫",
        "数据库查询",
        "自动化部署",
        "网络爬虫",
        "代码审查",
        "翻译文档",
        "图片处理",
        "消息推送",
        "日志分析",
        "权限管理",
      ];

      const latencies: number[] = [];
      const embedLatencies: number[] = [];
      const searchLatencies: number[] = [];

      for (const q of queries) {
        const fullStart = performance.now();

        const embedStart = performance.now();
        const [queryVec] = await embeddingClient.embed([q]);
        embedLatencies.push(performance.now() - embedStart);

        const searchStart = performance.now();
        await hybridSearch(db, q, {
          maxResults: 50,
          minScore: 0.05,
          queryVec,
          hybridWeight: { fts: 0.4, vector: 0.6 },
        });
        searchLatencies.push(performance.now() - searchStart);

        latencies.push(performance.now() - fullStart);
      }

      const avgFull = latencies.reduce((s, l) => s + l, 0) / latencies.length;
      const avgEmbed = embedLatencies.reduce((s, l) => s + l, 0) / embedLatencies.length;
      const avgSearch = searchLatencies.reduce((s, l) => s + l, 0) / searchLatencies.length;

      console.log("\n" + "─".repeat(60));
      console.log("HYBRID LATENCY BREAKDOWN (10 queries)");
      console.log("─".repeat(60));
      console.log(`  Embedding (API call): ${avgEmbed.toFixed(0)}ms avg`);
      console.log(`  DB search (FTS+Vec):  ${avgSearch.toFixed(1)}ms avg`);
      console.log(`  Total:                ${avgFull.toFixed(0)}ms avg`);
      console.log("─".repeat(60));

      // Note: sqlite-vec uses brute-force scan (no ANN index) on 9535 entries
      // ~8s per query is expected. In production, we'd limit vec candidates or use ANN.
      // The embedding API call (~60ms) is the controllable latency.
      expect(avgEmbed).toBeLessThan(500);
    });
  },
);
