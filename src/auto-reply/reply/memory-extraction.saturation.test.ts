/**
 * Memory Extraction Saturation Test
 *
 * 核心问题：当 profile 中已有记忆越来越多时，提取 LLM 的表现是变好还是变差？
 *
 * 测试设计：
 * - 同一条用户消息 "我叫王五，我喜欢用 Rust"
 * - 分别在 0 / 10 / 25 / 40 / 50 条已有记忆的背景下提取
 * - 观察：提取准确率、响应延迟、是否产生幻觉
 */

import { describe, it, expect } from "vitest";
import { parseExtractionResult } from "./memory-extraction.js";

const API_KEY = process.env.SILICONFLOW_API_KEY;
const BASE_URL = "https://api.siliconflow.cn/v1";
const MODEL = "Qwen/Qwen3-8B";

async function callQwen(
  systemPrompt: string,
  userPrompt: string,
): Promise<{ raw: string; elapsed: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  const start = Date.now();
  try {
    const resp = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 1024,
      }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`);
    }
    const json = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return { raw: json.choices?.[0]?.message?.content?.trim() ?? "", elapsed: Date.now() - start };
  } finally {
    clearTimeout(timer);
  }
}

// ── Generate fake existing profile entries ──

function generateFakeProfile(count: number): string {
  if (count === 0) return "（暂无）";
  const categories = ["preference", "correction", "fact", "identity", "todo", "procedure"];
  const entries: string[] = [];
  const fakeEntries = [
    { cat: "identity", key: "用户姓名", value: "张三" },
    { cat: "identity", key: "职业", value: "全栈工程师" },
    { cat: "identity", key: "公司", value: "字节跳动" },
    { cat: "preference", key: "编程语言", value: "喜欢 TypeScript，不要 JavaScript" },
    { cat: "preference", key: "缩进", value: "2 个空格，不要 tab" },
    { cat: "preference", key: "注释语言", value: "中文注释" },
    { cat: "preference", key: "CSS框架", value: "TailwindCSS" },
    { cat: "preference", key: "代码风格", value: "简洁，不要过度注释" },
    { cat: "correction", key: "包管理器", value: "用 pnpm 不用 npm" },
    { cat: "correction", key: "状态管理", value: "用 Zustand 不用 Redux" },
    { cat: "correction", key: "Node版本", value: "Node 20 不是 Node 18" },
    { cat: "correction", key: "API前缀", value: "/api/v2 不是 /api/v1" },
    { cat: "fact", key: "技术栈", value: "React + Vite + TailwindCSS" },
    { cat: "fact", key: "数据库", value: "PostgreSQL" },
    { cat: "fact", key: "项目结构", value: "monorepo + turborepo" },
    { cat: "fact", key: "部署平台", value: "AWS ECS + Terraform" },
    { cat: "fact", key: "CI/CD", value: "GitHub Actions" },
    { cat: "procedure", key: "PR规范", value: "提交前跑 lint 和 test" },
    { cat: "procedure", key: "命名规范", value: "组件 PascalCase，工具 camelCase" },
    { cat: "procedure", key: "Git规范", value: "conventional commits 格式" },
    { cat: "todo", key: "登录页bug", value: "这周修好登录页面的 bug" },
    { cat: "todo", key: "数据库迁移", value: "下月迁移 MySQL 到 PostgreSQL" },
    { cat: "preference", key: "组件类型", value: "函数组件不要类组件" },
    { cat: "preference", key: "错误处理", value: "用 try-catch 不要 .catch()" },
    { cat: "preference", key: "变量命名", value: "camelCase 不要 snake_case" },
    { cat: "fact", key: "API风格", value: "REST + OpenAPI 3.0 规范" },
    { cat: "fact", key: "测试框架", value: "Vitest + Testing Library" },
    { cat: "fact", key: "环境", value: "macOS + VS Code" },
    { cat: "procedure", key: "Review流程", value: "至少2人review才能merge" },
    { cat: "procedure", key: "分支策略", value: "trunk-based development" },
    { cat: "correction", key: "日志工具", value: "用 winston 不用 console.log" },
    { cat: "correction", key: "HTTP客户端", value: "用 ky 不用 axios" },
    { cat: "preference", key: "响应式", value: "移动优先设计" },
    { cat: "preference", key: "图片格式", value: "WebP 优先" },
    { cat: "fact", key: "域名", value: "app.example.com" },
    { cat: "fact", key: "缓存策略", value: "Redis + CDN" },
    { cat: "fact", key: "消息队列", value: "RabbitMQ" },
    { cat: "todo", key: "性能优化", value: "Q2 完成首屏加载优化" },
    { cat: "todo", key: "国际化", value: "Q3 支持英语和日语" },
    { cat: "procedure", key: "发布流程", value: "dev → staging → production 三阶段" },
    { cat: "preference", key: "动画库", value: "Framer Motion" },
    { cat: "preference", key: "表单库", value: "React Hook Form + Zod" },
    { cat: "fact", key: "认证方式", value: "JWT + refresh token" },
    { cat: "fact", key: "支付接入", value: "Stripe" },
    { cat: "correction", key: "ORM选择", value: "用 Prisma 不用 TypeORM" },
    { cat: "correction", key: "打包工具", value: "用 Vite 不用 Webpack" },
    { cat: "procedure", key: "日志规范", value: "结构化 JSON 日志" },
    { cat: "procedure", key: "监控", value: "Sentry + Datadog" },
    { cat: "todo", key: "文档", value: "本月补齐 API 文档" },
    { cat: "preference", key: "IDE配置", value: "统一 .editorconfig + prettier" },
  ];

  for (let i = 0; i < Math.min(count, fakeEntries.length); i++) {
    entries.push(`- [${fakeEntries[i].cat}] ${fakeEntries[i].key}: ${fakeEntries[i].value}`);
  }
  return entries.join("\n");
}

function buildSystemPrompt(existingProfile: string): string {
  return [
    "你是用户记忆提取器。分析对话，提取值得长期记住的用户信息。",
    "",
    "输出格式：JSON数组，每项包含 category、key、value 三个字段。",
    '示例：[{"category":"preference","key":"编程语言","value":"喜欢 TypeScript，不要 Python"}]',
    "",
    "category 取值：preference | correction | fact | identity | todo | procedure",
    "- preference: 用户偏好（语言、工具、风格等）",
    "- correction: 用户纠正你的错误（必须记住）",
    "- fact: 项目事实、技术决策",
    "- identity: 用户身份信息（名字、角色、团队）",
    "- todo: 待办事项",
    "- procedure: 用户建立的规则/流程",
    "",
    "key: 简短标识（2-20字），用于去重（相同 category+key 会覆盖旧值）",
    "value: 具体内容（10-100字）",
    "",
    "规则：",
    "1. 只提取用户明确表达的信息，禁止推测",
    "2. 纠正类（correction）优先级最高，必须提取",
    "3. 已有记忆中已存在的信息不要重复提取",
    "4. 闲聊、问候、临时指令不提取",
    "5. 最多提取5条，宁缺毋滥",
    "",
    "已有记忆：",
    existingProfile,
    "",
    "无内容可提取时返回空数组：[]",
    "禁止返回 markdown 代码块，只返回纯 JSON。",
  ].join("\n");
}

// ══════════════════════════════════════════════════════════
// Test Suite
// ══════════════════════════════════════════════════════════

describe.skipIf(!API_KEY)("memory saturation tests", () => {
  // ── Test 1: Same new message, different profile sizes ──

  it("extraction quality vs profile size (NEW information)", async () => {
    const sizes = [0, 10, 25, 40, 50];
    // User says something NEW that's not in any existing profile
    const userPrompt =
      "用户消息：\n我叫王五，我是做机器学习的，我喜欢用 Rust 写高性能代码\n\n助手回复：\n好的王五！Rust 确实很适合 ML 推理优化。";

    type Result = {
      size: number;
      promptChars: number;
      raw: string;
      parsed: ReturnType<typeof parseExtractionResult>;
      elapsed: number;
      hasIdentity: boolean;
      hasPreference: boolean;
      hasDuplicate: boolean;
    };

    const results: Result[] = [];

    for (const size of sizes) {
      const profile = generateFakeProfile(size);
      const systemPrompt = buildSystemPrompt(profile);
      const promptChars = systemPrompt.length + userPrompt.length;

      const { raw, elapsed } = await callQwen(systemPrompt, userPrompt);
      const parsed = parseExtractionResult(raw);

      // Check quality
      const allText = parsed
        .map((e) => `${e.category} ${e.key} ${e.value}`)
        .join(" ")
        .toLowerCase();
      const hasIdentity = allText.includes("王五") || allText.includes("机器学习");
      const hasPreference = allText.includes("rust");
      // Check for duplicates from existing profile
      const existingKeys = ["张三", "typescript", "pnpm", "zustand"];
      const hasDuplicate = existingKeys.some((k) => allText.includes(k));

      results.push({
        size,
        promptChars,
        raw,
        parsed,
        elapsed,
        hasIdentity,
        hasPreference,
        hasDuplicate,
      });
    }

    // Print report
    console.log("\n╔════════════════════════════════════════════════════════════════════════╗");
    console.log("║     Saturation Test 1: NEW Info vs Profile Size                        ║");
    console.log('║     Input: "我叫王五，我喜欢用 Rust"                                     ║');
    console.log("╠════════════════════════════════════════════════════════════════════════╣");
    console.log("║  Profile  │ Prompt  │ Latency │ Entries │ Identity │ Pref │ Duplicate  ║");
    console.log("╠════════════════════════════════════════════════════════════════════════╣");

    for (const r of results) {
      const id = r.hasIdentity ? "✅" : "❌";
      const pref = r.hasPreference ? "✅" : "❌";
      const dup = r.hasDuplicate ? "⚠️" : "✅";
      console.log(
        `║  ${String(r.size).padStart(3)} 条   │ ${String(r.promptChars).padStart(5)}c │ ${String(r.elapsed).padStart(5)}ms │   ${r.parsed.length}     │    ${id}    │  ${pref}  │     ${dup}     ║`,
      );
      for (const e of r.parsed) {
        console.log(`║    └─ [${e.category}] ${e.key}: ${e.value.slice(0, 40)}`.padEnd(74) + "║");
      }
    }
    console.log("╚════════════════════════════════════════════════════════════════════════╝");

    // Assertions
    for (const r of results) {
      // Should always find the new identity (王五) regardless of profile size
      expect(r.hasIdentity).toBe(true);
      // Should NOT duplicate existing entries
      expect(r.hasDuplicate).toBe(false);
    }
  }, 60_000);

  // ── Test 2: Same EXISTING message, different profile sizes ──

  it("deduplication quality vs profile size (EXISTING information)", async () => {
    const sizes = [0, 10, 25, 40, 50];
    // User says something that ALREADY EXISTS in the profile (张三, TypeScript)
    const userPrompt = "用户消息：\n我叫张三，我喜欢用 TypeScript\n\n助手回复：\n好的张三！";

    type Result = {
      size: number;
      parsed: ReturnType<typeof parseExtractionResult>;
      elapsed: number;
      extractedCount: number;
      isDuplicate: boolean;
    };

    const results: Result[] = [];

    for (const size of sizes) {
      const profile = generateFakeProfile(size);
      const systemPrompt = buildSystemPrompt(profile);

      const { raw, elapsed } = await callQwen(systemPrompt, userPrompt);
      const parsed = parseExtractionResult(raw);

      // For size=0, extraction is expected (no existing profile to dedupe against)
      // For size≥10, 张三 and TypeScript are already in the profile → should return []
      const isDuplicate = size >= 10 && parsed.length > 0;

      results.push({ size, parsed, elapsed, extractedCount: parsed.length, isDuplicate });
    }

    console.log("\n╔════════════════════════════════════════════════════════════════════════╗");
    console.log("║     Saturation Test 2: DEDUP — Same Info Already in Profile             ║");
    console.log('║     Input: "我叫张三，我喜欢用 TypeScript" (already stored)               ║');
    console.log("╠════════════════════════════════════════════════════════════════════════╣");
    console.log("║  Profile  │ Latency │ Entries │ Dedup OK │ Details                      ║");
    console.log("╠════════════════════════════════════════════════════════════════════════╣");

    for (const r of results) {
      const expected = r.size === 0 ? "N/A (空)" : r.extractedCount === 0 ? "✅ 去重" : "❌ 重复";
      const detail =
        r.extractedCount > 0
          ? r.parsed.map((e) => `[${e.category}] ${e.key}`).join(", ")
          : "(empty)";
      console.log(
        `║  ${String(r.size).padStart(3)} 条   │ ${String(r.elapsed).padStart(5)}ms │   ${r.extractedCount}     │ ${expected.padEnd(8)} │ ${detail.slice(0, 30).padEnd(30)} ║`,
      );
    }
    console.log("╚════════════════════════════════════════════════════════════════════════╝");

    // For profiles with ≥10 entries (which include 张三 and TypeScript):
    // The LLM should NOT re-extract these → extractedCount should be 0
    const dedupeFailures = results.filter((r) => r.isDuplicate);
    console.log(
      `\n  Dedup failures: ${dedupeFailures.length}/${results.filter((r) => r.size >= 10).length}`,
    );

    // Allow some tolerance — small models aren't perfect deduplicators
    expect(dedupeFailures.length).toBeLessThanOrEqual(2);
  }, 60_000);

  // ── Test 3: Latency scaling ──

  it("latency scaling with profile size", async () => {
    const sizes = [0, 10, 25, 40, 50];
    const userPrompt = "用户消息：\n帮我优化这个函数的性能\n\n助手回复：\n好的，让我看看。";

    const latencies: Array<{ size: number; elapsed: number; promptChars: number }> = [];

    for (const size of sizes) {
      const profile = generateFakeProfile(size);
      const systemPrompt = buildSystemPrompt(profile);
      const { elapsed } = await callQwen(systemPrompt, userPrompt);
      latencies.push({ size, elapsed, promptChars: systemPrompt.length + userPrompt.length });
    }

    console.log("\n╔════════════════════════════════════════════════════════════════════════╗");
    console.log("║     Saturation Test 3: Latency Scaling                                  ║");
    console.log("╠════════════════════════════════════════════════════════════════════════╣");

    for (const l of latencies) {
      const bar = "█".repeat(Math.round(l.elapsed / 100));
      console.log(
        `║  ${String(l.size).padStart(3)} 条 (${String(l.promptChars).padStart(5)}c)  ${String(l.elapsed).padStart(5)}ms  ${bar.padEnd(30)} ║`,
      );
    }

    const slowest = Math.max(...latencies.map((l) => l.elapsed));
    const fastest = Math.min(...latencies.map((l) => l.elapsed));
    console.log("╠════════════════════════════════════════════════════════════════════════╣");
    console.log(
      `║  Fastest: ${fastest}ms   Slowest: ${slowest}ms   Ratio: ${(slowest / fastest).toFixed(1)}x`.padEnd(
        74,
      ) + "║",
    );
    console.log("╚════════════════════════════════════════════════════════════════════════╝");

    // Latency should not degrade more than 5x even at 50 entries
    expect(slowest / fastest).toBeLessThan(5);
  }, 60_000);

  // ── Test 4: Noise resistance — meaningless chatter at various profile sizes ──

  it("noise resistance (闲聊 should produce [] regardless of profile size)", async () => {
    const sizes = [0, 25, 50];
    const noiseMessages = [
      "用户消息：\n嗯嗯好的\n\n助手回复：\n还有什么需要帮助的吗？",
      "用户消息：\n这个看起来不错\n\n助手回复：\n谢谢！",
      "用户消息：\n帮我 debug 一下这个函数\n\n助手回复：\n好的，让我看看代码。",
    ];

    let totalTests = 0;
    let falsePositives = 0;

    console.log("\n╔════════════════════════════════════════════════════════════════════════╗");
    console.log("║     Saturation Test 4: Noise Resistance (should all be [])              ║");
    console.log("╠════════════════════════════════════════════════════════════════════════╣");

    for (const size of sizes) {
      const profile = generateFakeProfile(size);
      const systemPrompt = buildSystemPrompt(profile);

      for (const userPrompt of noiseMessages) {
        totalTests++;
        const { raw } = await callQwen(systemPrompt, userPrompt);
        const parsed = parseExtractionResult(raw);
        const icon = parsed.length === 0 ? "✅" : "❌";
        if (parsed.length > 0) falsePositives++;

        const msgPreview = userPrompt.split("\n")[1]?.slice(0, 20) ?? "";
        console.log(
          `║  ${icon} ${String(size).padStart(3)} 条  "${msgPreview}"  → ${parsed.length === 0 ? "[]" : `${parsed.length} entries`}`.padEnd(
            74,
          ) + "║",
        );
        for (const e of parsed) {
          console.log(`║    └─ [${e.category}] ${e.key}: ${e.value.slice(0, 35)}`.padEnd(74) + "║");
        }
      }
    }

    console.log("╠════════════════════════════════════════════════════════════════════════╣");
    console.log(
      `║  False positives: ${falsePositives}/${totalTests} (${Math.round((falsePositives / totalTests) * 100)}%)`.padEnd(
        74,
      ) + "║",
    );
    console.log("╚════════════════════════════════════════════════════════════════════════╝");

    // At most 30% false positive rate on noise (small models aren't perfect)
    expect(falsePositives / totalTests).toBeLessThanOrEqual(0.3);
  }, 90_000);
});
