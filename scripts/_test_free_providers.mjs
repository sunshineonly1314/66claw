/**
 * Benchmark: Ant Ling + Meituan LongCat on memory consolidation task.
 * Both are free (500K tokens/day each).
 *
 * Usage: node scripts/_test_free_providers.mjs
 */

const PROVIDERS = [
  {
    name: "蚂蚁百灵 ling-1t",
    baseUrl: "https://api.tbox.cn/api/llm/v1",
    model: "ling-1t",
    apiKey: "sk-studio-32004aa83de04ea4b6c8b6d7d4534c52",
  },
  {
    name: "蚂蚁百灵 ring-1t",
    baseUrl: "https://api.tbox.cn/api/llm/v1",
    model: "ring-1t",
    apiKey: "sk-studio-32004aa83de04ea4b6c8b6d7d4534c52",
  },
  {
    name: "美团 LongCat Flash",
    baseUrl: "https://api.longcat.chat/openai/v1",
    model: "longcat-flash-chat",
    apiKey: "ak_2sd5Xz1qd5AP0vd5J17Yf4vl2Oe1O",
  },
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

async function testProvider(provider) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);

    const resp = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
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
      return { ...provider, status: resp.status, elapsed, error: text.slice(0, 300), jsonOk: false, merges: 0, stale: 0 };
    }

    const json = JSON.parse(text);
    const content = json.choices?.[0]?.message?.content?.trim() ?? "";
    const tokens = json.usage;

    // Parse consolidation JSON
    const cleaned = content
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .replace(/^[^{\[]*/, "") // strip leading non-JSON text
      .trim();

    let result = null;
    try {
      result = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try { result = JSON.parse(match[0]); } catch {}
      }
    }

    const merges = result?.merge?.length ?? 0;
    const stale = result?.stale?.length ?? 0;
    const unchanged = result?.unchanged_count ?? "?";

    // Quality check: expected merges
    let mergeQuality = "?";
    if (result?.merge) {
      const removeKeys = result.merge.flatMap(m =>
        (m.remove_keys || m.removeKeys || []).map(k => typeof k === "string" ? k : k.key)
      );
      const found = ["编程语言偏好", "包管理器", "前端框架"].filter(k => removeKeys.includes(k));
      mergeQuality = `${found.length}/3`;
    }

    // Quality check: expected stale todos
    let staleQuality = "?";
    if (result?.stale) {
      const staleKeys = result.stale.map(s => s.key);
      const found = ["登录页bug", "数据库迁移"].filter(k => staleKeys.includes(k));
      staleQuality = `${found.length}/2`;
    }

    return {
      ...provider, status: 200, elapsed, jsonOk: !!result,
      merges, stale, unchanged, mergeQuality, staleQuality,
      tokens, raw: content,
    };
  } catch (err) {
    return { ...provider, status: "ERR", elapsed: Date.now() - start, error: err.message, jsonOk: false, merges: 0, stale: 0 };
  }
}

async function main() {
  console.log("Testing free providers: 蚂蚁百灵 + 美团 LongCat");
  console.log("Task: Memory consolidation (11 entries, 3 expected merges, 2 expected stale)\n");

  // Run all in parallel
  const results = await Promise.all(PROVIDERS.map(testProvider));

  // Print table
  console.log("╔════════════════════════════╤════════╤══════════╤══════╤════════╤═══════╤═══════════╤═══════════╗");
  console.log("║ Provider                    │ Status │ Latency  │ JSON │ Merges │ Stale │ Merge Q   │ Stale Q   ║");
  console.log("╠════════════════════════════╪════════╪══════════╪══════╪════════╪═══════╪═══════════╪═══════════╣");

  for (const r of results) {
    const name = r.name.padEnd(26);
    const status = String(r.status).padEnd(6);
    const latency = (r.elapsed + "ms").padStart(8);
    const json = r.jsonOk ? "  ✅  " : "  ❌  ";
    const merges = String(r.merges).padStart(4) + "  ";
    const stale = String(r.stale).padStart(3) + "   ";
    const mq = (r.mergeQuality || "-").padEnd(9);
    const sq = (r.staleQuality || "-").padEnd(9);
    console.log(`║ ${name} │ ${status} │ ${latency} │${json}│ ${merges}│ ${stale}│ ${mq} │ ${sq} ║`);
  }

  console.log("╚════════════════════════════╧════════╧══════════╧══════╧════════╧═══════╧═══════════╧═══════════╝");

  // Print full responses
  for (const r of results) {
    console.log(`\n━━━ ${r.name} ━━━`);
    if (r.error) {
      console.log(`ERROR: ${r.error}`);
    } else {
      console.log(`Tokens: ${JSON.stringify(r.tokens)}`);
      console.log(`Response:\n${r.raw}`);
    }
  }
}

main().catch(console.error);
