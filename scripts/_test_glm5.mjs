/**
 * Quick test: Can we call ZhipuAI/GLM-5 on ModelScope API-Inference?
 *
 * Usage: MODELSCOPE_API_KEY=xxx node scripts/_test_glm5.mjs
 * Or: set the key below for one-off testing.
 */

const API_KEY = process.env.MODELSCOPE_API_KEY || "";
const BASE_URL = "https://api-inference.modelscope.cn/v1";
const MODEL = "ZhipuAI/GLM-5";

if (!API_KEY) {
  console.error("ERROR: MODELSCOPE_API_KEY not set.");
  console.error("Get yours at: https://modelscope.cn/my/myaccesstoken");
  process.exit(1);
}

async function testBasic() {
  console.log(`\n=== Test 1: Basic chat (${MODEL}) ===`);
  const start = Date.now();
  const resp = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: "你好，请用一句话介绍你自己" }],
      temperature: 0.3,
      max_tokens: 100,
    }),
  });
  const elapsed = Date.now() - start;
  console.log(`Status: ${resp.status} (${elapsed}ms)`);

  const text = await resp.text();
  try {
    const json = JSON.parse(text);
    if (json.choices?.[0]?.message?.content) {
      console.log(`Reply: ${json.choices[0].message.content}`);
      console.log(`Tokens: ${JSON.stringify(json.usage)}`);
    } else {
      console.log(`Body: ${text.slice(0, 500)}`);
    }
  } catch {
    console.log(`Raw: ${text.slice(0, 500)}`);
  }
  return resp.status === 200;
}

async function testMemoryConsolidation() {
  console.log(`\n=== Test 2: Memory consolidation task (${MODEL}) ===`);

  const fakeProfile = [
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

  const systemPrompt = [
    "你是记忆整理器。分析以下用户记忆列表，执行三个任务：",
    "",
    "1. **合并重复**：将含义相同或高度相似的条目合并为一条（保留最完整的表述）",
    "2. **标记过时**：识别可能已过期的待办事项或过时信息",
    "3. **保护规则**：identity 和 correction 类条目绝不删除，只能合并",
    "",
    "输出纯 JSON，格式：",
    '{',
    '  "merge": [{"keep": {"category":"...", "key":"...", "value":"合并后的值"}, "remove_keys": [{"category":"...", "key":"..."}]}],',
    '  "stale": [{"category":"...", "key":"...", "reason":"..."}],',
    '  "unchanged_count": 数字',
    '}',
    "",
    "禁止返回 markdown 代码块，只返回纯 JSON。",
  ].join("\n");

  const start = Date.now();
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
        { role: "user", content: `当前记忆列表：\n${fakeProfile}` },
      ],
      temperature: 0.1,
      max_tokens: 1024,
    }),
  });
  const elapsed = Date.now() - start;
  console.log(`Status: ${resp.status} (${elapsed}ms)`);

  const text = await resp.text();
  try {
    const json = JSON.parse(text);
    const content = json.choices?.[0]?.message?.content?.trim() ?? "";
    console.log(`\nRaw response:\n${content}`);
    console.log(`\nTokens: ${JSON.stringify(json.usage)}`);

    // Try to parse the consolidation result
    const cleaned = content
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();
    try {
      const result = JSON.parse(cleaned);
      console.log("\n--- Parsed consolidation result ---");
      if (result.merge?.length > 0) {
        console.log(`Merges: ${result.merge.length}`);
        for (const m of result.merge) {
          console.log(`  KEEP: [${m.keep.category}] ${m.keep.key}: ${m.keep.value}`);
          console.log(`  REMOVE: ${m.remove_keys?.map(k => `[${k.category}] ${k.key}`).join(", ")}`);
        }
      }
      if (result.stale?.length > 0) {
        console.log(`Stale entries: ${result.stale.length}`);
        for (const s of result.stale) {
          console.log(`  [${s.category}] ${s.key}: ${s.reason}`);
        }
      }
      console.log(`Unchanged: ${result.unchanged_count}`);
      console.log("\n✅ GLM-5 successfully parsed consolidation task!");
    } catch {
      console.log("\n❌ Failed to parse as JSON — model returned non-JSON output");
    }
  } catch {
    console.log(`Raw: ${text.slice(0, 500)}`);
  }
}

async function main() {
  const basicOk = await testBasic();
  if (basicOk) {
    await testMemoryConsolidation();
  }
  console.log("\n=== Done ===");
}

main().catch(console.error);
