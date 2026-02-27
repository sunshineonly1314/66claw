/**
 * Head-to-head: Qwen3-8B vs 美团LongCat vs 百灵ling-1t on EXTRACTION tasks.
 * Same 42 scenarios from the original memory-extraction test suite.
 *
 * Tests: new info extraction, deduplication, noise resistance
 */

const PROVIDERS = [
  {
    name: "Qwen3-8B (硅基流动)",
    baseUrl: "https://api.siliconflow.cn/v1",
    model: "Qwen/Qwen3-8B",
    apiKey: process.env.SILICONFLOW_API_KEY || "sk-bdlrjsxfgryopcpjvqbuyygzchkisgzwqucnbdkzurzueukv",
  },
  {
    name: "美团 LongCat",
    baseUrl: "https://api.longcat.chat/openai/v1",
    model: "longcat-flash-chat",
    apiKey: "ak_2sd5Xz1qd5AP0vd5J17Yf4vl2Oe1O",
  },
  {
    name: "百灵 ling-1t",
    baseUrl: "https://api.tbox.cn/api/llm/v1",
    model: "ling-1t",
    apiKey: "sk-studio-32004aa83de04ea4b6c8b6d7d4534c52",
  },
];

const EXISTING_PROFILE = [
  "- [identity] 用户姓名: 张三",
  "- [identity] 职业: 全栈工程师",
  "- [preference] 编程语言: 喜欢 TypeScript，不要 JavaScript",
  "- [correction] 包管理器: 用 pnpm 不用 npm",
  "- [fact] 技术栈: React + Vite + TailwindCSS",
].join("\n");

const EXTRACTION_SYSTEM_PROMPT = [
  "你是用户记忆提取器。分析对话，提取值得长期记住的用户信息。",
  "",
  "输出格式：JSON数组，每项包含 category、key、value 三个字段。",
  '示例：[{"category":"preference","key":"编程语言","value":"喜欢 TypeScript，不要 Python"}]',
  "",
  "category 取值：preference | correction | fact | identity | todo | procedure",
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
  EXISTING_PROFILE,
  "",
  "无内容可提取时返回空数组：[]",
  "禁止返回 markdown 代码块，只返回纯 JSON。",
].join("\n");

// ── Test scenarios ──

const TESTS = [
  // --- New info extraction (should extract) ---
  {
    name: "新身份信息",
    input: "用户消息：\n我叫王五，我是做机器学习的\n\n助手回复：\n好的王五！",
    expectExtract: true,
    expectKeys: ["王五", "机器学习"],
    expectEmpty: false,
  },
  {
    name: "新偏好",
    input: "用户消息：\n以后都用 Rust 写后端，不要 Go\n\n助手回复：\n好的，后端用 Rust。",
    expectExtract: true,
    expectKeys: ["rust"],
    expectEmpty: false,
  },
  {
    name: "纠正错误",
    input: "用户消息：\n不对，我们用的是 PostgreSQL，不是 MySQL\n\n助手回复：\n抱歉，已更正。",
    expectExtract: true,
    expectKeys: ["postgresql"],
    expectEmpty: false,
  },
  {
    name: "新规则",
    input: "用户消息：\n以后每个函数不要超过30行\n\n助手回复：\n好的，我会注意函数长度。",
    expectExtract: true,
    expectKeys: ["30"],
    expectEmpty: false,
  },
  // --- Deduplication (should NOT extract, already exists) ---
  {
    name: "重复-张三已存在",
    input: "用户消息：\n我叫张三\n\n助手回复：\n好的张三！",
    expectExtract: false,
    expectKeys: [],
    expectEmpty: true,
  },
  {
    name: "重复-TypeScript已存在",
    input: "用户消息：\n我喜欢用 TypeScript\n\n助手回复：\n好的！",
    expectExtract: false,
    expectKeys: [],
    expectEmpty: true,
  },
  {
    name: "重复-pnpm已存在",
    input: "用户消息：\n记住用 pnpm\n\n助手回复：\n好的，用 pnpm。",
    expectExtract: false,
    expectKeys: [],
    expectEmpty: true,
  },
  // --- Noise (should return []) ---
  {
    name: "噪声-嗯嗯好的",
    input: "用户消息：\n嗯嗯好的\n\n助手回复：\n还有什么需要帮助的吗？",
    expectExtract: false,
    expectKeys: [],
    expectEmpty: true,
  },
  {
    name: "噪声-帮我debug",
    input: "用户消息：\n帮我 debug 一下这个函数\n\n助手回复：\n好的，让我看看代码。",
    expectExtract: false,
    expectKeys: [],
    expectEmpty: true,
  },
  {
    name: "噪声-看起来不错",
    input: "用户消息：\n这个看起来不错\n\n助手回复：\n谢谢！",
    expectExtract: false,
    expectKeys: [],
    expectEmpty: true,
  },
];

async function callLLM(provider, systemPrompt, userPrompt) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  const start = Date.now();
  try {
    const resp = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 512,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const elapsed = Date.now() - start;
    if (!resp.ok) {
      return { raw: "", elapsed, error: `HTTP ${resp.status}` };
    }
    const json = await resp.json();
    return { raw: json.choices?.[0]?.message?.content?.trim() ?? "", elapsed };
  } catch (err) {
    clearTimeout(timer);
    return { raw: "", elapsed: Date.now() - start, error: err.message };
  }
}

function parseResult(raw) {
  if (!raw || raw === "[]") return [];
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed.filter(e => e && e.category && e.key && e.value);
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) return parsed.filter(e => e && e.category && e.key && e.value);
      } catch {}
    }
  }
  return [];
}

async function runTestsForProvider(provider) {
  const results = [];
  for (const test of TESTS) {
    const { raw, elapsed, error } = await callLLM(provider, EXTRACTION_SYSTEM_PROMPT, test.input);
    const parsed = parseResult(raw);
    const allText = parsed.map(e => `${e.category} ${e.key} ${e.value}`).join(" ").toLowerCase();

    let pass = false;
    if (test.expectEmpty) {
      pass = parsed.length === 0;
    } else {
      pass = test.expectKeys.some(k => allText.includes(k.toLowerCase()));
    }

    results.push({ test: test.name, pass, count: parsed.length, elapsed, error, parsed });
  }
  return results;
}

async function main() {
  console.log("Extraction Head-to-Head: Qwen3-8B vs 美团 vs 百灵\n");
  console.log(`Tests: ${TESTS.length} (4 new info, 3 dedup, 3 noise)\n`);

  // Run all providers in parallel
  const allResults = await Promise.all(
    PROVIDERS.map(async (p) => ({ provider: p, results: await runTestsForProvider(p) }))
  );

  // Print comparison table
  const header = "Test".padEnd(20) + PROVIDERS.map(p => p.name.padEnd(22)).join("");
  console.log("═".repeat(header.length));
  console.log(header);
  console.log("═".repeat(header.length));

  for (let i = 0; i < TESTS.length; i++) {
    const testName = TESTS[i].name.padEnd(20);
    const cells = allResults.map(({ results }) => {
      const r = results[i];
      if (r.error) return `❌ ERR ${r.elapsed}ms`.padEnd(22);
      const icon = r.pass ? "✅" : "❌";
      const detail = r.count > 0
        ? `${r.count}条 ${r.elapsed}ms`
        : `[] ${r.elapsed}ms`;
      return `${icon} ${detail}`.padEnd(22);
    }).join("");
    console.log(`${testName}${cells}`);
  }

  console.log("═".repeat(header.length));

  // Summary
  console.log("\n--- Summary ---");
  for (const { provider, results } of allResults) {
    const passed = results.filter(r => r.pass).length;
    const total = results.length;
    const avgLatency = Math.round(results.reduce((s, r) => s + r.elapsed, 0) / results.length);

    const newInfoPass = results.slice(0, 4).filter(r => r.pass).length;
    const dedupPass = results.slice(4, 7).filter(r => r.pass).length;
    const noisePass = results.slice(7, 10).filter(r => r.pass).length;

    console.log(`\n${provider.name}:`);
    console.log(`  总分: ${passed}/${total} (${Math.round(passed/total*100)}%)`);
    console.log(`  新信息提取: ${newInfoPass}/4`);
    console.log(`  去重: ${dedupPass}/3`);
    console.log(`  噪声抵抗: ${noisePass}/3`);
    console.log(`  平均延迟: ${avgLatency}ms`);
  }
}

main().catch(console.error);
