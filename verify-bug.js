// 验证 extractLikeTerms 和转义逻辑

function extractLikeTerms(raw) {
  // 第一步: 清理特殊字符 (包括 % 和 _)
  const cleaned = raw.replace(/['"{}()\[\]*?%_]/g, " ").trim();
  console.log(`Step 1 - 输入: "${raw}"`);
  console.log(`Step 1 - 清理后: "${cleaned}"`);

  const terms = [];

  // CJK 块按 2 字滑窗拆分
  const cjkBlocks = cleaned.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]+/g) || [];
  for (const block of cjkBlocks) {
    const chars = [...block];
    for (let i = 0; i < chars.length - 1; i++) {
      terms.push(chars[i] + chars[i + 1]);
    }
  }

  // 英文单词（≥3 字符）
  const ascii = cleaned
    .replace(/[^a-zA-Z0-9\s_-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);
  terms.push(...ascii);

  console.log(`Step 2 - 提取的 terms:`, terms);
  return [...new Set(terms)].slice(0, 10);
}

function testLikeEscape(query) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`测试查询: "${query}"`);
  console.log("=".repeat(60));

  const likeTerms = extractLikeTerms(query);

  console.log(`\nStep 3 - 转义处理:`);
  for (const term of likeTerms) {
    // 检查是否包含需要转义的字符
    const hasPercent = term.includes("%");
    const hasUnderscore = term.includes("_");
    const hasBackslash = term.includes("\\");

    console.log(`  term: "${term}"`);
    console.log(`    包含 %: ${hasPercent}`);
    console.log(`    包含 _: ${hasUnderscore}`);
    console.log(`    包含 \\: ${hasBackslash}`);

    // 代码中的转义逻辑
    const safeTerm = term.replace(/[%_\\]/g, "\\$&");
    const changed = term !== safeTerm;

    console.log(`    转义后: "${safeTerm}"`);
    console.log(`    是否改变: ${changed}`);

    if (!changed && (hasPercent || hasUnderscore || hasBackslash)) {
      console.log(`    ⚠️ 警告: 包含特殊字符但转义无效!`);
    }
  }
}

// 测试用例
console.log("\n" + "=".repeat(60));
console.log("BUG 验证测试开始");
console.log("=".repeat(60));

testLikeEscape("test%");
testLikeEscape("test_a");
testLikeEscape("C:\\Program Files");
testLikeEscape("包含%的工具");
testLikeEscape("100%_success");

console.log("\n" + "=".repeat(60));
console.log("结论分析");
console.log("=".repeat(60));
console.log(`
关键发现:
1. extractLikeTerms 在第一步就删除了 % 和 _ (行353)
2. 因此后续提取的 terms 中永远不会包含 % 或 _
3. 行322 的转义逻辑 replace(/[%_\\]/g, ...) 永远不会匹配到 % 或 _
4. 这确实是一个 Dead Code (转义逻辑对 % 和 _ 无效)

但是,这是不是 BUG?
- 如果数据库字段本身包含 % 或 _ (如 "test%private"),搜索时会怎样?
- 答案: extractLikeTerms("test%") 返回 ["test"],然后 LIKE "%test%"
- 这会匹配 "test%private" 也会匹配 "testxprivate" (因为 % 通配符)
- 所以这确实是一个潜在的 BUG: 无法精确匹配字段名中的特殊字符
`);
