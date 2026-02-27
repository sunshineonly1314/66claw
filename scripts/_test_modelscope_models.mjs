/**
 * Benchmark: 5 ModelScope models on the same memory consolidation task.
 * Measures: latency, correctness, JSON parsing success.
 *
 * Usage: MODELSCOPE_API_KEY=xxx node scripts/_test_modelscope_models.mjs
 */

const API_KEY = process.env.MODELSCOPE_API_KEY || "";
const BASE_URL = "https://api-inference.modelscope.cn/v1";

if (!API_KEY) {
  console.error("ERROR: MODELSCOPE_API_KEY not set.");
  process.exit(1);
}

const MODELS = [
  "ZhipuAI/GLM-4.7",
  "moonshotai/Kimi-K2.5",
  "Qwen/Qwen3.5-397B-A17B",
  "MiniMax/MiniMax-M2.5",
  "ZhipuAI/GLM-4.7-Flash",
];

const FAKE_PROFILE = [
  "- [identity] 用户姓名: 张三",
  "- [identity] 职业: 全栈工程师",
  "- [preference] 编程语言: 喜欢 TypeScript，不要 JavaScript",
  "- [preference] 编程语言偏好: TypeScript 优先",
  "- [correction] 包管理器: 用 pnpm 不用 npm",
  "- [correction] 包管理工具: 项目使用 pnpm，不要 npm",
  "- [fact] 技术栈: React + Vite + TailwindCSS",
  "- [fact] 前端框架: React + Vite",
  "- [todo] 登录页bug: 这周修好登录页面的 bug",
  "- [todo] 数据库迁移: 下月迁移 MySQL 到 PostgreSQL",
  "- [procedure] PR规范: 提交前跑 lint 和 test",
].join("\n");

const SYSTEM_PROMPT = [
  "你是记忆整理器。分析以下用户记忆列表，执行三个任务：",
  "",
  "1. **合并重复**：将含义相同或高度相似的条目合并为一条（保留最完整的表述）",
  "2. **标记过时**：识别可能已过期的待办事项或过时信息",
  "3. **保护规则**：identity 和 correction 类条目绝不删除，只能合并",
  "",
  "输出纯 JSON，格式：",
  "{",
  '  "merge": [{"keep": {"category":"...", "key":"...", "value":"合并后的值"}, "remove_keys": [{"category":"...", "key":"..."}]}],',
  '  "stale": [{"category":"...", "key":"...", "reason":"..."}],',
  '  "unchanged_count": 数字',
  "}",
  "",
  "禁止返回 markdown 代码块，只返回纯 JSON。",
].join("\n");

async function testModel(model) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);

    const resp = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `当前记忆列表：\n${FAKE_PROFILE}` },
        ],
        temperature: 0.1,
        max_tokens: 1024,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const elapsed = Date.now() - start;
    const text = await resp.text();

    if (resp.status !== 200) {
      return { model, status: resp.status, elapsed, error: text.slice(0, 200), merges: 0, stale: 0, jsonOk: false };
    }

    const json = JSON.parse(text);
    const content = json.choices?.[0]?.message?.content?.trim() ?? "";
    const tokens = json.usage;

    // Try parse consolidation JSON
    const cleaned = content
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();

    let result = null;
    try {
      result = JSON.parse(cleaned);
    } catch {
      // Try extracting JSON from within text
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try { result = JSON.parse(match[0]); } catch {}
      }
    }

    const merges = result?.merge?.length ?? 0;
    const stale = result?.stale?.length ?? 0;
    const unchanged = result?.unchanged_count ?? "?";

    // Check quality: did it find the 3 expected merges?
    let mergeQuality = "?";
    if (result?.merge) {
      const removeKeys = result.merge.flatMap(m => m.remove_keys?.map(k => k.key) ?? []);
      const found = ["编程语言偏好", "包管理器", "前端框架"].filter(k => removeKeys.includes(k));
      mergeQuality = `${found.length}/3`;
    }

    // Check: did it flag todos as stale?
    let staleQuality = "?";
    if (result?.stale) {
      const staleKeys = result.stale.map(s => s.key);
      const found = ["登录页bug", "数据库迁移"].filter(k => staleKeys.includes(k));
      staleQuality = `${found.length}/2`;
    }

    return {
      model, status: 200, elapsed, jsonOk: !!result,
      merges, stale, unchanged, mergeQuality, staleQuality,
      tokens, raw: content.slice(0, 300),
    };
  } catch (err) {
    return { model, status: "ERR", elapsed: Date.now() - start, error: err.message, jsonOk: false, merges: 0, stale: 0 };
  }
}

async function main() {
  console.log("Testing 5 models on ModelScope API-Inference...");
  console.log("Task: Memory consolidation (11 entries, 3 expected merges, 2 expected stale)\n");

  // Run all 5 in parallel
  const results = await Promise.all(MODELS.map(testModel));

  // Print table
  console.log("╔══════════════════════════════════╤════════╤══════════╤══════╤════════╤═══════╤═══════════╤═══════════╗");
  console.log("║ Model                            │ Status │ Latency  │ JSON │ Merges │ Stale │ Merge Q   │ Stale Q   ║");
  console.log("╠══════════════════════════════════╪════════╪══════════╪══════╪════════╪═══════╪═══════════╪═══════════╣");

  for (const r of results) {
    const name = r.model.padEnd(32);
    const status = String(r.status).padEnd(6);
    const latency = (r.elapsed + "ms").padStart(8);
    const json = r.jsonOk ? "  ✅  " : "  ❌  ";
    const merges = String(r.merges).padStart(4) + "  ";
    const stale = String(r.stale).padStart(3) + "   ";
    const mq = (r.mergeQuality || "-").padEnd(9);
    const sq = (r.staleQuality || "-").padEnd(9);
    console.log(`║ ${name} │ ${status} │ ${latency} │${json}│ ${merges}│ ${stale}│ ${mq} │ ${sq} ║`);
  }

  console.log("╚══════════════════════════════════╧════════╧══════════╧══════╧════════╧═══════╧═══════════╧═══════════╝");

  // Print details for each
  console.log("\n--- Details ---");
  for (const r of results) {
    console.log(`\n[${r.model}]`);
    if (r.error) {
      console.log(`  ERROR: ${r.error}`);
    } else {
      console.log(`  Tokens: ${JSON.stringify(r.tokens)}`);
      console.log(`  Response preview: ${r.raw?.slice(0, 200)}`);
    }
  }
}

main().catch(console.error);
