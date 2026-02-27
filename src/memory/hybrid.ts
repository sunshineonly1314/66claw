import { applyMMRToHybridResults, type MMRConfig, DEFAULT_MMR_CONFIG } from "./mmr.js";

export type HybridSource = string;

export { type MMRConfig, DEFAULT_MMR_CONFIG };

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
  // FIX: SQLite FTS5 bm25() 返回负值，越负 = 越相关。
  // 旧版 abs/(1+abs) 饱和过快：x=9→0.9, x=19→0.95，高分区分度低。
  // 改用 log(1+abs) / log(1+abs+K) — 对数变换保留更宽的有效区间：
  //   x=1→0.19, x=5→0.44, x=10→0.55, x=20→0.63, x=50→0.73, x=100→0.79
  // K=100 控制饱和速度，与 vectorScore (cosine, 0-1) 范围兼容。
  const absRank = Number.isFinite(rank) ? Math.abs(rank) : 0;
  if (absRank === 0) return 0;
  const K = 100;
  return Math.log(1 + absRank) / Math.log(1 + absRank + K);
}

export function mergeHybridResults(params: {
  vector: HybridVectorResult[];
  keyword: HybridKeywordResult[];
  vectorWeight: number;
  textWeight: number;
  /** MMR configuration for diversity-aware re-ranking */
  mmr?: Partial<MMRConfig>;
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
    const totalWeight = params.vectorWeight + params.textWeight;
    const normVector = totalWeight > 0 ? params.vectorWeight / totalWeight : 0.5;
    const normText = totalWeight > 0 ? params.textWeight / totalWeight : 0.5;
    const score = normVector * entry.vectorScore + normText * entry.textScore;
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

  const sorted = merged.toSorted((a, b) => b.score - a.score);

  // Apply MMR re-ranking if enabled
  const mmrConfig = { ...DEFAULT_MMR_CONFIG, ...params.mmr };
  if (mmrConfig.enabled) {
    return applyMMRToHybridResults(sorted, mmrConfig);
  }

  return sorted;
}
