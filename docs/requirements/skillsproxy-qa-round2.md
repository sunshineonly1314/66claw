# SkillsProxy 二轮确认 — 6 个问题回复

> 日期：2026-02-20

---

## Q1: latest.json 的格式确认

先纠正一个认知：**其他 6 个二进制工具（ffmpeg、gh、himalaya 等）的客户端下载流程根本不走 `/latest` 接口。**

我重新看了客户端代码（`skills-install.ts:1046-1068`），实际流程是：

1. 上游 skill 的安装描述里带了一个 GitHub Releases 下载 URL，如 `https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl-shared.tar.xz`
2. 客户端检测到这个 URL 匹配 `LARGE_PACKAGE_PROXY_MAP` 中的某个 repo（如 `BtbN/FFmpeg-Builds`）
3. 客户端**直接拼 SkillsProxy 的文件下载 URL**：`{baseUrl}/api/binaries/ffmpeg/{platform}/{filename}`
4. 不查 `/latest`，不查 `/versions`，直接下载文件

**唯一用 `/latest` 的是 signal-cli**，而且它解析的是 **GitHub Releases API 格式**（`tag_name` + `assets` 数组），见 `signal-install.ts:218-235`：

```typescript
const payload = await response.json() as {
  tag_name?: string;
  assets?: Array<{ name: string; browser_download_url: string }>;
};
const version = payload.tag_name?.replace(/^v/, "");
```

**所以你的 latest.json 格式应该兼容 GitHub Releases API 结构：**

```json
{
  "tag_name": "v0.13.24",
  "assets": [
    {
      "name": "signal-cli-0.13.24.tar.gz",
      "browser_download_url": "http://121.43.61.90/api/binaries/signal-cli/0.13.24/signal-cli-0.13.24.tar.gz"
    }
  ]
}
```

**对于其他 6 个工具，你不需要做 latest.json。** 客户端已经从上游 URL 中解析出文件名，直接拼路径下载。你只需要保证 `/data/binaries/{tool}/{platform}/{filename}` 下面文件存在就行。

但如果你想给这 6 个工具也做版本管理（自动同步脚本判断是否需要更新），那你在本地维护一个 `latest.json` 当作内部元数据用就好，不需要通过 API 暴露——客户端不会来查。

---

## Q2: /api/binaries/{tool}/latest 走 Java 还是 Nginx？

**结论：方案 C——不需要做这个接口（对非 signal-cli 工具而言）。**

如上所述，只有 signal-cli 会查 `/latest`。对于 signal-cli，你 Java 里已经有实现了（`BinariesController.java`），保持不变即可。

其他 6 个工具，客户端直接下载文件，Nginx `alias /data/binaries/` 已经能返回。**你什么都不需要改。**

如果你未来想统一所有工具都支持 `/latest`（方便管理），那建议 **方案 A：Nginx 静态返回**。在每个工具目录下放一个 `latest.json`，Nginx 加一条：

```nginx
location ~ ^/api/binaries/([^/]+)/latest$ {
    alias /data/binaries/$1/latest.json;
    default_type application/json;
}
```

比写 Java Controller 简单得多，而且数据是同步脚本更新的，跟 Java 应用无关。

---

## Q3: 自动同步脚本的语言

**Python 可以，没问题。** 跟现有的 `sync_and_translate.py` 保持一致，维护成本低。

建议统一放到一个目录下，比如 `/root/clawdskills/scripts/`：
- `sync_skills.py` — Skills 同步 + 翻译（现有脚本改造）
- `sync_binaries.py` — 二进制工具同步
- `sync_mcp_index.py` — MCP 索引同步

每个脚本独立可运行、有日志输出、crontab 单独调度。

---

## Q4: ModelScope 搜索策略的具体实现

**文件路径：`src/mcp/marketplace/modelscope-source.ts`**

全部细节都在这个文件里，以下按你的问题逐项回答：

### 14 个类别的值列表（第 57-72 行）

```
browser-automation
search
communication
customer-and-marketing
developer-tools
entertainment-and-media
file-systems
finance
knowledge-and-memory
location-services
art-and-culture
research-and-data
calendar-management
other
```

### PUT 请求 body 格式（第 191-196 行）

```json
{
  "search": "搜索关键词（空字符串或 a/ab 等）",
  "filter": {
    "category": "developer-tools"     // 可选，按类别过滤
    "is_hosted": true                  // 可选，按是否云托管过滤
  },
  "page_number": 1,
  "page_size": 100
}
```

注意：**ModelScope API 有个坑——`page_number × page_size ≤ 100`**（第 158-159 行注释），也就是说每次查询最多只能返回 100 条，不能翻页。所以才需要用不同的搜索关键词多次查询来凑齐数据。

### 搜索策略三阶段（第 225-273 行）

1. **Phase 1**：空关键词 + 14 个类别 + is_hosted=true/false（~18 次请求）
2. **Phase 2**：单字符搜索 a-z、0-9（~36 次请求）
3. **Phase 3**：双字符搜索 aa-zz（~676 次请求）

每次请求间隔 300ms（第 44 行 `restDelayMs`）。

### 去重逻辑（第 171 行、209-222 行）

用 `Set<string>` 按 `id` 去重，同一个 server 在不同搜索结果中出现只保留第一次的。

### 请求头（第 186-189 行）

```
Content-Type: application/json
Authorization: Bearer {MODELSCOPE_API_TOKEN}
User-Agent: OpenClawCN-MCP-Sync/1.0
```

**你完全可以把 `fetchViaRestApi` 函数（第 170-285 行）翻译成 Python 来用。** 逻辑不复杂，就是循环发 PUT 请求 + 去重。

---

## Q5: 官方 Registry 的两条路

**你的理解完全正确。有两条路，建议走路径 A。**

- **路径 A**：`gh-proxy.com` 代理的 `servers.json` 是一个**全量 JSON 文件**，一次 GET 请求拿到所有数据。简单可靠。
- **路径 B**：`registry.modelcontextprotocol.io/v0.1/servers` 是**分页 API**（用 `cursor` 参数翻页），需要多次请求。

需求文档里同时提到了两种，是因为客户端代码两种都支持（`registry-source.ts`）：CN 用户先试 gh-proxy 全量文件，失败了再试分页 API。

**你服务端做同步，直接用路径 A 即可。** 一次 HTTP GET 拿到全量 JSON，解析后按 `McpMarketplaceItem` 格式 normalize，跟 ModelScope 的结果合并去重。

如果 gh-proxy 偶尔抽风，脚本里加个 retry（重试 3 次，每次换一个代理）：
1. `https://gh-proxy.com/https://raw.githubusercontent.com/...`
2. `https://ghfast.top/https://raw.githubusercontent.com/...`

这两个代理地址客户端代码里也有（`registry-source.ts:19-21`），你直接用。

---

## Q6: cron 用系统 crontab 还是 Java 内置 Scheduler？

**你倾向的方案 C 是对的，我们也这么想。**

```
系统 crontab 调 Python 脚本    →  重 IO（网络请求、文件下载、磁盘写入）
Java @Scheduled                →  轻任务（定时 reload 内存数据、磁盘扫描）
```

具体分工：

| 任务 | 调度方式 | 频率 | 说明 |
|------|---------|------|------|
| MCP 索引同步 | crontab → `sync_mcp_index.py` | 每天凌晨 3 点 | 写入 `/data/mcp-index.json` |
| 二进制检查更新 | crontab → `sync_binaries.py` | 每 6 小时（不需要每小时） | 检查 GitHub、下载新版本 |
| Skills 同步翻译 | crontab → `sync_skills.py` | 每天凌晨 4 点 | Git pull + 增量翻译 |
| Java reload MCP 索引 | `@Scheduled` 或 file watch | 每 5 分钟 | 检测 `/data/mcp-index.json` 变化，重新加载到内存 |
| Java reload Skills 索引 | `@Scheduled`（已有） | 每 5 分钟 | 已实现，保持不变 |

**关于二进制同步频率的调整**：需求文档里写的"每小时"，实际上改成每 6 小时甚至每天一次都行。这些 GitHub 工具不会频繁发版，用户也不会每天都需要最新版。省点 GitHub API 配额。

Java 这边你只需要加一个：**检测 `/data/mcp-index.json` 文件变化后自动 reload 到内存**，替换掉现在从 classpath 里加载静态 JSON 的逻辑。其他都不用改 Java 代码。

---

## 总结

6 个问题核心结论：

1. **latest.json 只有 signal-cli 需要**，格式兼容 GitHub Releases API（`tag_name` + `assets`）。其他 6 个工具客户端不查 `/latest`，直接下载文件
2. **不需要给 6 个工具写 Java Controller**，Nginx 静态服务已经够了
3. **同步脚本用 Python**，跟现有保持一致
4. **ModelScope 搜索策略**在 `modelscope-source.ts:170-285`，可以直接翻译成 Python
5. **官方 Registry 走路径 A**（全量 JSON，一次 GET）
6. **方案 C**：crontab 调脚本做重 IO，Java 只负责定时 reload

P0 技术方案锁定，开写吧。
