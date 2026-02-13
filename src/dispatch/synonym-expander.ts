/**
 * Synonym Expander — multi-language intent keyword enrichment.
 *
 * Problem: Users express the same intent in many different ways.
 *   - "帮我画一只猫" / "生成猫的图片" / "AI作画" / "来张猫图" / "cat illustration"
 *   - All mean "image generation" but use vastly different keywords.
 *
 * Solution: Maintain a built-in synonym table that maps common expressions
 * to canonical keywords already in the dispatch config. This expands the
 * effective keyword coverage WITHOUT requiring users to enumerate every variant
 * in dispatch.yaml.
 *
 * Design:
 *   - Bi-directional: given a canonical keyword, returns all synonyms
 *   - Bilingual: covers CN↔EN for the same concept
 *   - Intent-scoped: synonyms are grouped by intent to avoid cross-contamination
 *   - Extensible: users can add custom synonyms via dispatch.yaml
 *   - Performance: pre-compiled at config load time, not runtime
 */

// CJK character detection — single CJK chars are valid words (e.g. "画" = draw)
const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;

/** Minimum term length for matching. CJK single chars are meaningful; ASCII needs ≥2. */
function isTermTooShort(term: string): boolean {
  if (term.length === 0) return true;
  if (term.length === 1) return !CJK_RE.test(term);
  return false;
}

// ---------------------------------------------------------------------------
// Built-in synonym groups
// ---------------------------------------------------------------------------

/**
 * Each group maps an intent ID to sets of semantically equivalent terms.
 * Terms within a set are interchangeable — if any one matches, all others
 * in the set are considered matched too.
 *
 * Structure: intentId → array of synonym sets
 * Each synonym set is an array of strings that all mean the same thing.
 */
const BUILTIN_SYNONYM_GROUPS: Record<string, string[][]> = {
  image_generation: [
    // Core "generate image" concept
    ["画", "画图", "画画", "绘画", "绘图", "作画", "生图", "生成图", "AI绘画", "AI画图", "来张"],
    ["draw", "paint", "sketch", "illustrate", "doodle"],
    ["generate image", "create image", "make image", "produce image", "render image"],
    ["图片", "图像", "插图", "画作", "作品"],
    ["image", "picture", "illustration", "artwork", "photo", "graphic"],
    // Style modifiers (helps with "画一张油画风格的" → still image_generation)
    ["油画", "水彩", "素描", "漫画", "卡通", "写实", "3D"],
    ["oil painting", "watercolor", "pencil sketch", "cartoon", "realistic", "3d render"],
  ],

  wechat_operation: [
    ["微信", "wechat", "wx"],
    ["发消息", "发微信", "发送消息", "传话", "告诉", "通知"],
    ["send message", "text", "message"],
    ["未读消息", "新消息", "消息记录", "聊天记录"],
    ["unread messages", "chat history", "message log"],
    ["联系人", "好友", "群聊", "朋友圈"],
    ["contact", "friend", "group chat", "moments"],
  ],

  database_query: [
    ["数据库", "database", "db", "数据表", "表"],
    ["查询", "检索", "查找数据", "筛选"],
    ["query", "filter", "lookup"],
    ["SQL", "sql语句", "sql查询"],
    ["建表", "创建表", "表结构", "字段", "列"],
    ["create table", "schema", "column", "field", "index"],
    ["INSERT", "UPDATE", "DELETE", "JOIN", "GROUP BY", "ORDER BY", "WHERE"],
  ],

  coding: [
    ["代码", "code", "源码", "程序"],
    ["编程", "programming", "coding", "开发", "development"],
    ["debug", "调试", "排错", "排查bug", "找bug"],
    ["debugging", "troubleshoot", "fix bug", "bug fix"],
    ["函数", "方法", "function", "method", "class", "类"],
    ["重构", "refactor", "优化代码", "改进代码"],
    ["编译", "compile", "构建", "build", "打包", "bundle"],
    ["单元测试", "测试", "test", "unit test", "测试用例"],
    ["接口", "api", "API", "endpoint", "路由", "route"],
  ],

  desktop_control: [
    ["打开", "启动", "运行", "open", "launch", "start", "run"],
    ["截图", "截屏", "screenshot", "screen capture", "屏幕截图"],
    ["点击", "click", "双击", "double click", "右键", "right click"],
    ["窗口", "window", "应用", "application", "app", "软件", "program"],
    ["桌面", "desktop", "任务栏", "taskbar", "系统托盘", "system tray"],
    ["最小化", "最大化", "关闭窗口", "minimize", "maximize", "close window"],
  ],

  web_browsing: [
    ["搜索", "search", "查找", "查询", "搜一下", "帮我查"],
    ["浏览", "browse", "访问", "visit", "打开网页"],
    ["网页", "网站", "网址", "webpage", "website", "url", "链接", "link"],
    ["上网", "互联网", "internet", "online", "在线"],
  ],

  audio_processing: [
    ["语音", "voice", "音频", "audio", "录音", "recording"],
    ["转文字", "转录", "transcribe", "transcription", "语音识别", "speech to text", "STT"],
    ["播放", "play", "listen", "听"],
    ["音乐", "music", "歌曲", "song"],
  ],

  smart_home_query: [
    ["冰箱", "空调", "窗帘", "门锁", "扫地机", "洗衣机", "热水器", "加湿器"],
    ["smart home", "IoT", "智能家居", "home automation"],
    ["状态", "state", "status", "怎么样"],
    ["温度", "湿度", "temperature", "humidity"],
    ["家里", "室内", "房间", "屋里", "home", "room", "indoor"],
    ["家电", "设备", "appliance", "device", "sensor"],
  ],

  smart_home_control: [
    ["开灯", "关灯", "turn on light", "turn off light"],
    ["开空调", "关空调", "turn on AC", "turn off AC"],
    ["打开窗帘", "关窗帘", "open curtain", "close curtain"],
    ["调温", "调亮度", "调音量", "set temperature", "set brightness", "set volume"],
    ["场景", "模式", "scene", "mode"],
    ["回家模式", "睡眠模式", "离家模式", "home mode", "sleep mode", "away mode"],
  ],

  robot_command: [
    ["机器狗", "机器人", "robot", "robot dog"],
    ["拿快递", "取快递", "送东西", "pick up", "deliver", "fetch"],
    ["巡逻", "patrol", "巡视", "巡检"],
    ["机械臂", "robot arm", "robotic arm"],
  ],
};

// ---------------------------------------------------------------------------
// Compiled synonym index
// ---------------------------------------------------------------------------

/** Maps a lowercased term → set of all synonymous terms (within the same intent). */
export type SynonymIndex = Map<string, Set<string>>;

/** Maps intentId → SynonymIndex for that intent. */
export type IntentSynonymMap = Map<string, SynonymIndex>;

let _compiledIndex: IntentSynonymMap | null = null;

/** Custom synonym groups registered from dispatch.yaml intent definitions. */
let _customGroups: Record<string, string[][]> | null = null;

/**
 * Register custom synonym groups from dispatch.yaml intent definitions.
 * Call this during config compilation. The groups are merged into the index
 * on the next `getSynonymIndex()` call (after invalidation).
 */
export function registerCustomSynonyms(groups: Record<string, string[][]>): void {
  _customGroups = Object.keys(groups).length > 0 ? groups : null;
}

/**
 * Get or build the compiled synonym index.
 * Lazily compiled on first access, then cached.
 * Includes both built-in and custom synonym groups from dispatch.yaml.
 */
export function getSynonymIndex(): IntentSynonymMap {
  if (!_compiledIndex) {
    _compiledIndex = buildSynonymIndex(BUILTIN_SYNONYM_GROUPS, _customGroups ?? undefined);
  }
  return _compiledIndex;
}

/**
 * Build a synonym index from synonym groups.
 * Each term maps to the full set of its synonyms (including itself).
 */
export function buildSynonymIndex(
  groups: Record<string, string[][]>,
  customGroups?: Record<string, string[][]>,
): IntentSynonymMap {
  const index: IntentSynonymMap = new Map();

  // Process built-in groups
  for (const [intentId, synonymSets] of Object.entries(groups)) {
    let intentIndex = index.get(intentId);
    if (!intentIndex) {
      intentIndex = new Map();
      index.set(intentId, intentIndex);
    }
    addSynonymSetsToIndex(intentIndex, synonymSets);
  }

  // Merge custom groups (from dispatch.yaml)
  if (customGroups) {
    for (const [intentId, synonymSets] of Object.entries(customGroups)) {
      let intentIndex = index.get(intentId);
      if (!intentIndex) {
        intentIndex = new Map();
        index.set(intentId, intentIndex);
      }
      addSynonymSetsToIndex(intentIndex, synonymSets);
    }
  }

  return index;
}

function addSynonymSetsToIndex(index: SynonymIndex, synonymSets: string[][]): void {
  for (const synonymSet of synonymSets) {
    const lowerTerms = synonymSet.map((s) => s.toLowerCase());

    // Find if any term already exists in the index — if so, merge into that set
    let sharedSet: Set<string> | null = null;
    for (const term of lowerTerms) {
      const existing = index.get(term);
      if (existing) {
        sharedSet = existing;
        break;
      }
    }

    // Create or merge into the shared set
    if (!sharedSet) {
      sharedSet = new Set(lowerTerms);
    } else {
      for (const term of lowerTerms) {
        sharedSet.add(term);
      }
    }

    // Point ALL terms (both new and previously existing) to the SAME Set object.
    // This is critical: calculateSynonymBoost deduplicates by Set reference identity,
    // so all terms in the same synonym group MUST share the same Set instance.
    for (const term of sharedSet) {
      index.set(term, sharedSet);
    }
  }
}

// ---------------------------------------------------------------------------
// Expansion API
// ---------------------------------------------------------------------------

/**
 * Expand a user prompt with synonym-boosted keyword matching.
 *
 * Instead of modifying the prompt text, this returns additional keywords
 * that should be treated as "matched" for each intent, based on the
 * synonyms of words found in the prompt.
 *
 * Returns a map of intentId → set of canonical keywords that matched
 * through synonym expansion.
 */
export function expandPromptWithSynonyms(
  promptLower: string,
  synonymMap: IntentSynonymMap,
): Map<string, string[]> {
  const expansions = new Map<string, string[]>();

  for (const [intentId, intentIndex] of synonymMap) {
    const matchedSynonyms: string[] = [];

    for (const [term, synonymSet] of intentIndex) {
      // Check if this synonym term appears in the prompt
      if (promptLower.includes(term) && !isTermTooShort(term)) {
        // Add all canonical synonyms (the other terms in the set)
        for (const synonym of synonymSet) {
          if (synonym !== term && !matchedSynonyms.includes(synonym)) {
            matchedSynonyms.push(synonym);
          }
        }
      }
    }

    if (matchedSynonyms.length > 0) {
      expansions.set(intentId, matchedSynonyms);
    }
  }

  return expansions;
}

/**
 * Calculate a synonym-based confidence boost for an intent.
 *
 * When synonyms of the intent's keywords are found in the prompt,
 * we can increase confidence that this intent is correct.
 *
 * Boost calculation:
 *   - Each matched synonym set contributes +0.05 (up to +0.2 max)
 *   - This is additive with the base rule-based confidence
 */
export function calculateSynonymBoost(
  promptLower: string,
  intentId: string,
  synonymMap: IntentSynonymMap,
): { boost: number; matchedTerms: string[] } {
  const intentIndex = synonymMap.get(intentId);
  if (!intentIndex) return { boost: 0, matchedTerms: [] };

  const matchedTerms: string[] = [];
  const matchedSets = new Set<Set<string>>(); // dedupe by set reference

  for (const [term, synonymSet] of intentIndex) {
    if (isTermTooShort(term)) continue; // Skip short terms to avoid false positives
    if (promptLower.includes(term) && !matchedSets.has(synonymSet)) {
      matchedSets.add(synonymSet);
      matchedTerms.push(term);
    }
  }

  // Each unique matched synonym set contributes +0.05, capped at +0.2
  const boost = Math.min(0.2, matchedSets.size * 0.05);
  return { boost, matchedTerms };
}

/**
 * Invalidate the compiled synonym index (e.g., on config reload).
 */
export function invalidateSynonymIndex(): void {
  _compiledIndex = null;
}
