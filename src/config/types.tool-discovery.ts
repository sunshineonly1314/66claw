/**
 * [CN-PATCH:tool-discovery] 智能工具发现配置类型
 *
 * 与聊天 memorySearch 的 embedding 完全隔离：
 *   - 聊天 embedding → memorySearch.provider → memory.sqlite
 *   - 工具索引 embedding → toolDiscovery.embedding → tool-index.sqlite
 */

// ---------------------------------------------------------------------------
// Embedding 配置（独立于 Memory 的 EmbeddingProvider）
// ---------------------------------------------------------------------------

export type ToolDiscoveryEmbeddingConfig = {
  /** Embedding 模型名。默认 "BAAI/bge-m3"。 */
  model?: string;
  /** OpenAI 兼容的 embedding API base URL。默认 SiliconFlow。 */
  baseUrl?: string;
  /** API key（SiliconFlow 免费 key）。无 key 时降级为纯 FTS5 BM25。 */
  apiKey?: string;
  /** 向量维度。默认 1024（bge-m3 输出维度）。 */
  dimensions?: number;
  /** API 超时时间（毫秒）。默认 15000 (15秒)。 */
  timeout?: number;
};

// ---------------------------------------------------------------------------
// 搜索配置
// ---------------------------------------------------------------------------

export type ToolDiscoverySearchConfig = {
  /** 搜索返回的最大结果数。默认 50。 */
  maxResults?: number;
  /** 最低匹配分数（0-1）。默认 0.1。 */
  minScore?: number;
  /** RRF 融合权重。 */
  hybridWeight?: {
    /** FTS5 BM25 权重。默认 0.4。 */
    fts?: number;
    /** 向量搜索权重。默认 0.6。 */
    vector?: number;
  };
};

// ---------------------------------------------------------------------------
// MCP 按需加载配置
// ---------------------------------------------------------------------------

export type ToolDiscoveryMcpOnDemandConfig = {
  /** 是否启用 MCP 按需加载。默认 true。 */
  enabled?: boolean;
  /** 是否允许自动安装（无需 LLM 确认）。默认 false。 */
  autoInstall?: boolean;
  /** 最大并发加载数。默认 3。 */
  maxConcurrent?: number;
};

// ---------------------------------------------------------------------------
// 总配置
// ---------------------------------------------------------------------------

export type ToolDiscoveryConfig = {
  /** 是否启用智能工具发现。CN 区域默认 true。 */
  enabled?: boolean;

  /**
   * 独立 embedding 配置 — 与聊天 memorySearch 完全隔离。
   * 只用于工具索引的向量化，不影响聊天记录的 embedding。
   */
  embedding?: ToolDiscoveryEmbeddingConfig;

  /** 搜索参数。 */
  search?: ToolDiscoverySearchConfig;

  /** MCP 按需加载。 */
  mcpOnDemand?: ToolDiscoveryMcpOnDemandConfig;
};

// ---------------------------------------------------------------------------
// 搜索结果类型（tool-index.ts 和 tool-discovery.ts 共用）
// ---------------------------------------------------------------------------

export type ToolIndexEntry = {
  id: string;
  type: "skill" | "mcp" | "core";
  name: string;
  description: string;
  descriptionCn?: string;
  tags: string[];
  /** JSON 序列化的额外元数据（npmPackage、sseUrl、category 等）。 */
  metadataJson?: string;
};

export type ToolSearchResult = {
  entry: ToolIndexEntry;
  /** 综合得分 0-1。 */
  score: number;
  /** 匹配来源：fts / vector / both。 */
  matchSource: "fts" | "vector" | "both";
};

export type ToolDiscoveryResult = {
  /** 推荐的 skill 名列表。 */
  skillHints: string[];
  /** 推荐的 MCP server ID（通配符格式 mcp_{id}_*）。 */
  mcpToolHints: string[];
  /** 推荐的核心工具名。 */
  toolHints: string[];
  /** 可安装的 MCP 建议详情。 */
  mcpSuggestions: McpSuggestion[];
  /** 注入 system prompt 的工具摘要文本。 */
  toolSummaryPrompt: string;
  /** 整体置信度 0-1。 */
  confidence: number;
  /** 搜索延迟（ms）。 */
  searchLatencyMs: number;
  /** 原始搜索结果（供 tool-selector gate 二次筛选）。 */
  rawResults?: ToolSearchResult[];
};

export type McpSuggestion = {
  serverId: string;
  friendlyName: string;
  description: string;
  npmPackage?: string;
  sseUrl?: string;
  score: number;
};
