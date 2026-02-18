export type HybridSource = string;

export type HybridVectorResult = {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  source: HybridSource;
  snippet: string;
  vectorScore: number;
  // [CN-PATCH:memory-p0] 冷热分层搜索所需的时间戳
  updatedAt?: number;
};

export type HybridKeywordResult = {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  source: HybridSource;
  snippet: string;
  textScore: number;
  // [CN-PATCH:memory-p0] 冷热分层搜索所需的时间戳
  updatedAt?: number;
};

// [CN-PATCH:memory-p0] CJK 字符检测，用于 trigram tokenizer 的最小长度过滤
const CJK_PATTERN = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;

export function buildFtsQuery(raw: string): string | null {
  // [CN-PATCH:memory-p0] 增加 CJK 统一表意文字匹配，修复中文用户 FTS5 关键字搜索完全失效的问题
  // 上游原正则: /[A-Za-z0-9_]+/g — 只匹配英文，完全忽略中文字符
  // trigram tokenizer 要求子串 >= 3 unicode 字符，CJK token 短于 3 字符时跳过（靠 vector search 覆盖）
  // 英文 token 不受此限制（unicode61 下短英文词仍可精确匹配）
  //
  // 合并策略：先用 matchAll 提取 token（带位置信息），然后将被标点/引号切割但**原文中相邻
  // （中间无空格）**的 CJK token 合并，避免标点导致关键词丢失
  // 例如 '测试"注入"攻击' → 三个 CJK token 之间只有引号 → 合并为 "测试注入攻击"
  // 但 '内存优化 的 关键点' → token 之间有空格 → 不合并，保持独立
  const CJK_OR_WORD = /[A-Za-z0-9_]+|[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]+/g;
  const matches = [...raw.matchAll(CJK_OR_WORD)];
  if (matches.length === 0) return null;

  // 合并相邻 CJK token（原文中间无空格时才合并）
  const merged: string[] = [];
  let prevEnd = -1;
  for (const m of matches) {
    const text = m[0].trim();
    if (!text) continue;
    const isCjk = CJK_PATTERN.test(text);
    const matchStart = m.index!;
    const lastIdx = merged.length - 1;

    // 检查：前一个 token 也是 CJK，且中间无空格 → 合并
    if (isCjk && lastIdx >= 0 && CJK_PATTERN.test(merged[lastIdx]) && prevEnd >= 0) {
      const gap = raw.slice(prevEnd, matchStart);
      if (!/\s/.test(gap)) {
        // 中间只有标点/引号，无空格 → 合并
        merged[lastIdx] += text;
        prevEnd = matchStart + m[0].length;
        continue;
      }
    }

    merged.push(text);
    prevEnd = matchStart + m[0].length;
  }

  const tokens = merged.filter((t) => {
    // CJK token 必须 >= 3 字符（trigram 最小窗口限制）
    if (CJK_PATTERN.test(t)) return t.length >= 3;
    return true;
  });
  if (tokens.length === 0) {
    return null;
  }
  const quoted = tokens.map((t) => `"${t.replaceAll('"', "")}"`);
  return quoted.join(" AND ");
}

export function bm25RankToScore(rank: number): number {
  const normalized = Number.isFinite(rank) ? Math.max(0, rank) : 999;
  return 1 / (1 + normalized);
}

export function mergeHybridResults(params: {
  vector: HybridVectorResult[];
  keyword: HybridKeywordResult[];
  vectorWeight: number;
  textWeight: number;
}): Array<{
  path: string;
  startLine: number;
  endLine: number;
  score: number;
  snippet: string;
  source: HybridSource;
  // [CN-PATCH:memory-p0] 冷热分层搜索所需的时间戳
  updatedAt?: number;
}> {
  const byId = new Map<
    string,
    {
      id: string;
      path: string;
      startLine: number;
      endLine: number;
      source: HybridSource;
      snippet: string;
      vectorScore: number;
      textScore: number;
      updatedAt?: number;
    }
  >();

  for (const r of params.vector) {
    byId.set(r.id, {
      id: r.id,
      path: r.path,
      startLine: r.startLine,
      endLine: r.endLine,
      source: r.source,
      snippet: r.snippet,
      vectorScore: r.vectorScore,
      textScore: 0,
      updatedAt: r.updatedAt,
    });
  }

  for (const r of params.keyword) {
    const existing = byId.get(r.id);
    if (existing) {
      existing.textScore = r.textScore;
      if (r.snippet && r.snippet.length > 0) {
        existing.snippet = r.snippet;
      }
      // [CN-PATCH:memory-p0] 优先使用 keyword 的 updatedAt（可能更精确）
      if (r.updatedAt != null) {
        existing.updatedAt = r.updatedAt;
      }
    } else {
      byId.set(r.id, {
        id: r.id,
        path: r.path,
        startLine: r.startLine,
        endLine: r.endLine,
        source: r.source,
        snippet: r.snippet,
        vectorScore: 0,
        textScore: r.textScore,
        updatedAt: r.updatedAt,
      });
    }
  }

  const merged = Array.from(byId.values()).map((entry) => {
    const score = params.vectorWeight * entry.vectorScore + params.textWeight * entry.textScore;
    return {
      path: entry.path,
      startLine: entry.startLine,
      endLine: entry.endLine,
      score,
      snippet: entry.snippet,
      source: entry.source,
      updatedAt: entry.updatedAt,
    };
  });

  return merged.toSorted((a, b) => b.score - a.score);
}
