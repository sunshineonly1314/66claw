/**
 * Full extraction benchmark: all free models including LongCat-Flash-Lite
 */

const PROVIDERS = [
  {
    name: "百灵 ling-1t",
    baseUrl: "https://api.tbox.cn/api/llm/v1",
    model: "ling-1t",
    apiKey: "sk-studio-32004aa83de04ea4b6c8b6d7d4534c52",
  },
  {
    name: "美团 LongCat-Chat",
    baseUrl: "https://api.longcat.chat/openai/v1",
    model: "longcat-flash-chat",
    apiKey: "ak_2sd5Xz1qd5AP0vd5J17Yf4vl2Oe1O",
  },
  {
    name: "美团 LongCat-Lite",
    baseUrl: "https://api.longcat.chat/openai/v1",
    model: "longcat-flash-lite",
    apiKey: "ak_2sd5Xz1qd5AP0vd5J17Yf4vl2Oe1O",
  },
  {
    name: "百灵 ring-1t",
    baseUrl: "https://api.tbox.cn/api/llm/v1",
    model: "ring-1t",
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

const SYSTEM_PROMPT = [
  "你是用户记忆提取器。分析对话，提取值得长期记住的用户信息。",
  "",
  "输出格式：JSON数组，每项包含 category、key、value 三个字段。",
  '示例：[{"category":"preference","key":"编程语言","value":"喜欢 TypeScript，不要 Python"}]',
  "",
  "category 取值：preference | correction | fact | identity | todo | procedure",
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

const TESTS = [
  // New info
  { name: "新身份", input: "用户消息：\n我叫王五，我是做机器学习的\n\n助手回复：\n好的王五！", expectEmpty: false, keys: ["王五", "机器学习"] },
  { name: "新偏好", input: "用户消息：\n以后都用 Rust 写后端\n\n助手回复：\n好的。", expectEmpty: false, keys: ["rust"] },
  { name: "纠正", input: "用户消息：\n不对，用 PostgreSQL 不是 MySQL\n\n助手回复：\n已更正。", expectEmpty: false, keys: ["postgresql"] },
  { name: "新规则", input: "用户消息：\n函数不要超过30行\n\n助手回复：\n好的。", expectEmpty: false, keys: ["30"] },
  { name: "中英混合", input: "用户消息：\nremember 我们 deploy 用 Docker + K8s\n\n助手回复：\n好的。", expectEmpty: false, keys: ["docker", "k8s"] },
  // Dedup
  { name: "重复-张三", input: "用户消息：\n我叫张三\n\n助手回复：\n好的张三！", expectEmpty: true, keys: [] },
  { name: "重复-TS", input: "用户消息：\n我喜欢 TypeScript\n\n助手回复：\n好的！", expectEmpty: true, keys: [] },
  { name: "重复-pnpm", input: "用户消息：\n记住用 pnpm\n\n助手回复：\n好的。", expectEmpty: true, keys: [] },
  // Noise
  { name: "噪声-嗯嗯", input: "用户消息：\n嗯嗯好的\n\n助手回复：\n还有什么需要帮助的吗？", expectEmpty: true, keys: [] },
  { name: "噪声-debug", input: "用户消息：\n帮我 debug 一下\n\n助手回复：\n好的。", expectEmpty: true, keys: [] },
  { name: "噪声-不错", input: "用户消息：\n这个看起来不错\n\n助手回复：\n谢谢！", expectEmpty: true, keys: [] },
  // Edge cases
  { name: "不该提取-报错", input: "用户消息：\nTypeError: Cannot read property of undefined\n\n助手回复：\n这是因为对象为空。", expectEmpty: true, keys: [] },
];

async function callLLM(provider, userPrompt) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  const start = Date.now();
  try {
    const resp = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}` },
      body: JSON.stringify({
        model: provider.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 512,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) return { raw: "", elapsed: Date.now() - start, error: `HTTP ${resp.status}: ${(await resp.text()).slice(0, 100)}` };
    const json = await resp.json();
    return { raw: json.choices?.[0]?.message?.content?.trim() ?? "", elapsed: Date.now() - start };
  } catch (err) {
    clearTimeout(timer);
    return { raw: "", elapsed: Date.now() - start, error: err.message };
  }
}

function parse(raw) {
  if (!raw || raw === "[]") return [];
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  try { const p = JSON.parse(cleaned); if (Array.isArray(p)) return p.filter(e => e?.category && e?.key && e?.value); } catch {}
  const m = cleaned.match(/\[[\s\S]*\]/);
  if (m) { try { const p = JSON.parse(m[0]); if (Array.isArray(p)) return p.filter(e => e?.category && e?.key && e?.value); } catch {} }
  return [];
}

async function main() {
  console.log(`Extraction benchmark: ${PROVIDERS.length} models × ${TESTS.length} tests\n`);

  const allResults = await Promise.all(
    PROVIDERS.map(async (p) => {
      const results = [];
      for (const t of TESTS) {
        const { raw, elapsed, error } = await callLLM(p, t.input);
        const parsed = parse(raw);
        const allText = parsed.map(e => `${e.category} ${e.key} ${e.value}`).join(" ").toLowerCase();
        let pass;
        if (t.expectEmpty) {
          pass = parsed.length === 0;
        } else {
          pass = t.keys.some(k => allText.includes(k.toLowerCase()));
        }
        results.push({ name: t.name, pass, count: parsed.length, elapsed, error });
      }
      return { provider: p, results };
    })
  );

  // Table
  const colW = 20;
  const hdr = "Test".padEnd(16) + PROVIDERS.map(p => p.name.padEnd(colW)).join("");
  console.log("─".repeat(hdr.length));
  console.log(hdr);
  console.log("─".repeat(hdr.length));

  for (let i = 0; i < TESTS.length; i++) {
    const row = TESTS[i].name.padEnd(16) + allResults.map(({ results }) => {
      const r = results[i];
      if (r.error) return `❌ ERR`.padEnd(colW);
      const icon = r.pass ? "✅" : "❌";
      return `${icon} ${r.count}条 ${r.elapsed}ms`.padEnd(colW);
    }).join("");
    console.log(row);
  }

  console.log("─".repeat(hdr.length));

  // Summary
  console.log("\n═══ SUMMARY ═══\n");
  console.log("Model".padEnd(22) + "Total".padEnd(10) + "Extract".padEnd(10) + "Dedup".padEnd(10) + "Noise".padEnd(10) + "Edge".padEnd(10) + "Avg ms".padEnd(10));
  console.log("─".repeat(82));

  for (const { provider, results } of allResults) {
    const total = results.filter(r => r.pass).length;
    const extract = results.slice(0, 5).filter(r => r.pass).length;
    const dedup = results.slice(5, 8).filter(r => r.pass).length;
    const noise = results.slice(8, 11).filter(r => r.pass).length;
    const edge = results.slice(11).filter(r => r.pass).length;
    const avg = Math.round(results.filter(r => !r.error).reduce((s, r) => s + r.elapsed, 0) / results.filter(r => !r.error).length);
    console.log(
      provider.name.padEnd(22) +
      `${total}/${results.length}`.padEnd(10) +
      `${extract}/5`.padEnd(10) +
      `${dedup}/3`.padEnd(10) +
      `${noise}/3`.padEnd(10) +
      `${edge}/1`.padEnd(10) +
      `${avg}ms`.padEnd(10)
    );
  }
}

main().catch(console.error);
