# 更新日志

> 此文件由 `pnpm release:changelog` 从 versionrecord.md 自动生成。

## 1.6.1 (未发布)

### 新功能
- 图片生成工具 — 新增 image-gen-tool，支持 DALL-E 3 / 通义万相(DashScope) / SiliconFlow 三个 provider，自动识别 13 种图片生成模型
- 图片灯箱预览 — 新增 image-lightbox 组件，支持点击图片全屏预览、Escape/点击背景关闭、无障碍访问(role=dialog)、body 滚动锁定
- 拖拽上传图片 — chat 视图新增 drag-and-drop 支持，拖拽图片文件到聊天区域即可添加为附件
- 智能工具发现系统（Tool Discovery） — 全新的 FTS5 BM25 + sqlite-vec 向量混合检索引擎，从 12k+ 工具中 <10ms 选出 ≤50 个最相关工具。出厂只带 FTS5 索引（~5MB），配置 SiliconFlow key 后首次启动自动向量化（BAAI/bge-m3，1024维，~40s），永久生效
- MCP 按需加载器 — 根据 tool-discovery 推荐结果动态安装 MCP server。支持 stdio（npx spawn）和 SSE（远程连接）两种模式，内置 SSE URL 白名单 + Marketplace 信任验证
- LLM 安装工具（install_mcp_server） — LLM 可调用的 MCP 安装工具，从 tool-discovery 推荐中触发按需安装

### 改进
- 多模态发送前检查 — 将 modality-guard 集成到 sendChatMessage 流程中，发送前自动检测是否配置了所需的多模态模型
- 工具结果图片渲染 — 扩展 grouped-render 的 extractImages，支持从 tool_result/toolresult 类型消息中提取 details.imageUrl 并渲染
- ChatAttachment 类型扩展 — 新增 fileName 和 fileSize 可选字段，拖拽上传时记录原始文件信息

### 修复
- Block 12 contextPruning 无条件注入 — `applyCnDefaults` 原 Block 12 无条件注入 `contextPruning.mode: "cache-ttl"`，但 cache-ttl 依赖 Anthropic prompt caching API，无 Anthropic auth 时不应注入。移除 CN 层面的注入，由上游 `applyContextPruningDefaults` 按 auth profile 正确处理
- Block 19 session 凭空创建 — `applyCnDefaults` Block 19 在 `session === undefined` 时凭空创建 `session.maintenance` 对象，打破上游 `expect(cfg.session).toBeUndefined()` 契约。增加 `if (next.session !== undefined)` 守卫，仅当 session 已存在时才注入 maintenance 默认值
- nix-integration 测试 Windows 环境隔离 — `CONFIG_PATH uses STATE_DIR` 测试在 Windows 上因用户真实 `~/.openclawcn/openclawcn.json` 存在而 shadow STATE_DIR 候选路径。用 `withTempHome` 隔离 home 目录
- buildFtsQuery CJK 标点分割 — 中文关键词被引号/标点切割为短 token 后被 trigram 最小长度过滤丢弃（如 `'测试"注入"攻击'` → 三个短 token 全部丢失）。实现间隙感知合并策略：用 `matchAll` 获取 token 位置，仅在 gap 无空白时合并相邻 CJK token
- search-tiering updatedAt=0 误判 — `!r.updatedAt` 将 `updatedAt=0`（Unix epoch）误判为"无时间戳"。改为 `r.updatedAt == null` 精确匹配 `undefined`/`null`
- Block 19 pruneAfter/maxEntries 非原子检查 — 原 Block 19 用 `pruneAfter === undefined` 作为唯一门控，用户只设 pruneAfter 时 maxEntries 无 CN 默认值。改为 `needsPruneAfter || needsMaxEntries` 独立检查
- RRF theoreticalMax 静态计算 — 纯 FTS 模式下 theoreticalMax 仍含 vecWeight 分量，导致 score 上界 < 1.0。改为根据实际启用的搜索路径动态计算
- LIKE 通配符删除不彻底 — extractLikeTerms 的 replace 只删 `%_` 不删 `\`，`\%` 作为 LIKE pattern 行为异常。改为 `[%_\\]` 全部清理
- FTS5 INSERT OR REPLACE 静默插入重复行 — FTS5 虚拟表无 PRIMARY KEY，`OR REPLACE` 不触发替换。改为 DELETE + INSERT 模式
- FTS5 WHERE id IN 删除不可靠 — UNINDEXED 列不支持 `IN (...)` 查询，被 safeExec 静默吞掉。改为逐行 `WHERE id = ?` 删除
- LIKE ESCAPE 子句缺失 — 转义了 `\%` `\_` 但 SQL 缺少 `ESCAPE '\\'`，转义无效。每个 LIKE 表达式添加 `ESCAPE '\\'`
- loadMCPBatch 并发计数双重扣减 — `loadMCPBatch` 调用 `loadMCPOnDemand` 导致 `_activeLoads` 双重递增。改为直接调用内部 `doLoadMCP`
- ensureVectors 中途失败后换模型导致混合维度 — 新增 `vec_model_pending` 元数据追踪正在使用的模型，防止混合维度向量
- SSE URL 子域名欺骗防御 — 完全重写 `isAllowedSSEUrl`，防止 `evil.anthropic.com.attacker.com`/Punycode/凭证注入等攻击
- Marketplace 验证字段完整性检查 — 对 `is_official`/`china_friendly_score`/`requires_vpn` 做类型+值+范围严格校验
- LIKE ESCAPE 转义统一 — 在 `on-demand-loader.ts` 的 Marketplace 查询中也加 `ESCAPE '\\'`
- sqlite-vec allowExtension — `DatabaseSync` 构造需 `{ allowExtension: true }` 才能加载扩展
- 空描述导致 SiliconFlow API 400 — embedding 批处理中空字符串 fallback 为 `r.id`

### 界面优化
- 拖拽视觉反馈 — 拖拽图片到聊天区域时显示虚线边框和"松开以添加图片"提示
- 图片点击交互优化 — 聊天中的图片从新窗口打开改为内联灯箱预览，cursor 改为 zoom-in

### 配置
- 合并保护更新 — 将 image-gen-tool.ts、image-lightbox.ts、image-lightbox.css 加入 cn-protected-files.json 和 .gitattributes

---

## 2026.2.15 (2026-02-16)

---
