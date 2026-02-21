# SkillsProxy 21 个问题的逐条回复

> 回复人：客户端团队
> 日期：2026-02-20

以下逐条回答，不废话，直接给结论。

---

## 需求 1：MCP 索引自动同步

### Q1: ModelScope API Token 谁来申请？

**客户端团队提供。** 我们已经有现成的 Token，客户端代码里用的就是 `MODELSCOPE_API_TOKEN` 环境变量。我后续直接给你 Token 值，你配到 253 的环境变量或同步脚本里即可。

不需要你自己申请账号。

### Q2: 数据去重策略

**对，ModelScope 为主，Registry 补充。** 具体规则：

1. 先从 ModelScope 抓（数据最全、字段最丰富）
2. 再从官方 Registry 抓
3. 按 `serverId` 去重，**先入为主**（ModelScope 的条目已存在的，Registry 的同 ID 条目直接丢弃）
4. 最终合并写入一份 JSON

客户端的去重逻辑就是这样写的（`marketplace-sync.ts:323-334`），你服务端保持一致即可。

### Q3: 字段映射

**我们有现成的映射逻辑，你直接抄。** 看客户端代码 `src/mcp/marketplace/modelscope-source.ts` 第 625-689 行的 `normalizeToMarketplaceItem` 函数，里面就是 ModelScope API 返回字段 → 客户端 `McpMarketplaceItem` 的完整映射：

```
ModelScope 返回字段          → 客户端字段
─────────────────────────────────────────
id / server_id / name       → serverId（斜杠替换为连字符）
name / friendly_name        → friendlyName
description                 → description
version / latest_version    → version
tags                        → tags
npm_package                 → npmPackage
pypi_package                → pypiPackage
sse_url                     → sseUrl
security_score              → securityScore
requires_api_key            → requiresApiKey
api_key_name                → apiKeyName
api_key_guide_url           → apiKeyGuideUrl
platforms                   → platforms（默认 ["linux","macos","windows"]）
is_official                 → isOfficial
created_at / gmt_create     → isNew（30天内为 true）
tool_count                  → toolCount
capabilities                → capabilities
example_prompts             → examplePrompts
tool_names                  → toolNames
```

官方 Registry 那边字段名不一样，但更简单，你自己看 Registry 返回的 JSON 结构映射就行。核心就是保证 `serverId` 和 `npmPackage`/`pypiPackage` 正确——这两个是客户端安装 MCP server 时必须要用的。

### Q4: 中文优先的具体逻辑

**上游只有英文就直接用英文，不需要你做机器翻译。**

MCP 工具市场跟 Skills 不一样。Skills 是面向终端用户展示的技能列表，需要翻译。MCP 工具大部分是开发者工具，英文名称和描述完全可接受（如 "filesystem"、"Brave Search" 这些翻译了反而奇怪）。

所以：
- `friendlyName` 和 `description`：有中文就用中文，没有就直接放英文原文
- 不需要调百炼翻译
- 如果 ModelScope 本身返回了中文（很多国产 MCP 服务有中文），直接用

### Q5: 3000+ 的验收标准

**弹性标准，但要有底线。**

- 正常情况下 ModelScope 能抓到 7000+，合并 Registry 后总量应该在 7000-10000 之间
- 如果 ModelScope 策略变了抓不到那么多，只要 **≥ 2000 条且包含主流工具**（filesystem、sqlite、fetch、github、puppeteer、brave-search 等 Top 50 必须有），就算验收通过
- 低于 1000 条算同步异常，需要告警
- **关键指标不是总数，而是"包含 npmPackage 或 pypiPackage 的条目数"**——这些才是客户端能安装的。光有 serverId 没有安装方式的条目对用户没用

---

## 需求 2：二进制工具下载

### Q6: GitHub API 限流

**两个方案都要做：**

1. **GitHub Token**：我提供一个 GitHub Personal Access Token 给你，配到同步脚本的环境变量里。有 Token 的话限额是 5000 次/小时，7 个仓库每小时查一次完全够
2. **gh-proxy 用于文件下载**：你说得对，gh-proxy 代理的是文件下载不是 API。查版本用 GitHub API（带 Token），下载文件走 gh-proxy

两个 Token（ModelScope + GitHub）我后面一起给你。

### Q7: 平台文件名匹配规则

**客户端先查 `/latest`，再自己拼 URL。** 具体流程（看 `skills-install.ts:1046-1068`）：

1. 客户端根据 `process.platform` 判断平台，映射为：
   - `win32` → `windows-x64`
   - `darwin` → `darwin-universal`
   - 其他 → `linux-x64`

2. 从原始 GitHub URL 中提取文件名（`path.basename`）

3. 拼接最终 URL：`{baseUrl}/api/binaries/{tool}/{platform}/{filename}`

**所以你的目录结构必须是：**
```
/data/binaries/{tool}/{platform}/{filename}
```

我刚看了 253 服务器上 `/data/binaries/` 的实际布局，**已经就是这个结构了**（每个工具下面有 `darwin-universal/`、`linux-x64/`、`windows-x64/` 子目录）。文件也有了（ffmpeg 360MB、gh 53MB、sherpa-onnx 224MB 等），总共 956MB。

**所以你的数据实际上已经在那了！** 问题是 Java 代码只给 signal-cli 写了 Controller，其他 6 个工具没有。

但其实你**不需要给每个工具写 Java Controller**。看 90 上 Docker Nginx 的配置：

```nginx
location /api/binaries/ {
    alias /data/binaries/;
    error_page 404 = @java_backend;
}
```

**Nginx 已经在做静态文件服务了！** 客户端请求 `/api/binaries/ffmpeg/linux-x64/ffmpeg-master-latest-linux64-gpl-shared.tar.xz`，Nginx 会直接从 `/data/binaries/ffmpeg/linux-x64/` 下返回文件。

**你真正需要补的是：**
1. 每个工具目录下加一个 `latest.json`（目前一个都没有）
2. `/api/binaries/{tool}/latest` 和 `/api/binaries/{tool}/versions` 这两个元数据接口（Java 实现，或者也可以用 Nginx 直接返回静态 JSON）
3. 自动同步脚本（定时检查 GitHub 新版本、下载、更新 latest.json）

### Q8: ffmpeg macOS

**客户端已经处理了。** 平台映射用的是 `darwin-universal`，253 服务器上 `/data/binaries/ffmpeg/darwin-universal/` 目录已经存在了。BtbN 的 Release 确实没有 macOS 原生构建，但 253 上面那个 `darwin-universal` 目录里如果有文件，客户端就能下载。

你检查一下 `/data/binaries/ffmpeg/darwin-universal/` 里面有没有文件。如果没有，macOS 用户会 fallback 到 GitHub 代理或 brew 安装，不会卡死。

### Q9: sherpa-onnx 具体需要哪些文件

客户端需要的是**共享库版本 + TTS 模型**：

从 253 上已有的文件来看：
- `sherpa-onnx-v1.12.23-linux-x64-shared.tar.bz2`（共享库）
- `vits-piper-en_US-lessac-high.tar.bz2`（TTS 模型，在 model/ 子目录）

**文件名 pattern 过滤：**
- 共享库：`sherpa-onnx-v*-{platform}-shared.tar.bz2`（只要 shared 版本，不要 static）
- 模型：`vits-piper-*.tar.bz2`（语音模型包）
- 每个平台 1 个共享库 + 1 个模型 ≈ 60-80MB
- **不需要下载所有几十个 Release assets**，只下 linux-x64-shared + darwin-arm64-shared + windows-x64-shared + 模型

### Q10: 磁盘空间上限

**我刚看了 253 服务器：**

```
/dev/vda3  40G  19G  19G  50%
/data/binaries/ = 956MB（8个工具已经在了）
```

剩余 19GB，完全够。就算加上 skills、capabilities、MCP 索引，总量也就 3-4GB。磁盘不是问题。

但要注意：如果后续加自动同步保留多版本，建议设上限（每工具保留最近 2 版，定时清理旧版本），避免无限膨胀。

---

## P1 相关

### Q11: Skills 上游仓库访问方式

**GitHub 上的 `clawdbot/skills`。** 253 服务器在上海阿里云，访问 GitHub 不稳定。你有两个选择：
1. 走 `gh-proxy.com` 代理 clone：`git clone https://gh-proxy.com/https://github.com/clawdbot/skills.git`
2. 先 clone 到一个能稳定访问 GitHub 的中转机，再 rsync 到 253

建议方案 1，简单直接。如果 gh-proxy 抽风就重试，加个 retry 逻辑即可。

### Q12: 阿里百炼 API 额度和费用

**当前额度够。** 我们用的是 qwen-plus 模型，百炼 API 按 token 计费：
- 每个 skill 的 SKILL.md 平均 200-500 token，翻译输出差不多同量
- 980 个 skill 全量翻译一次约 50-100 万 token，费用约 10-20 元人民币
- 增量翻译（每天只翻新增/变更的）费用忽略不计

**不需要设上限。** 翻译缓存已经有了（`.translate_cache.json`），只翻新的。但在同步脚本里加个日志记录每次翻译了多少条、花了多少 token 是好习惯。

费用走项目账号，不需要你管。

### Q13: 翻译质量回退

**不需要专门的回滚机制。** 原因：
1. 翻译结果是存到文件里的，git 可以追溯
2. 如果某次翻译质量差，下次增量同步时不会覆盖（因为缓存里已有这条记录）
3. 要修正的话，手动删除 `.translate_cache.json` 中对应条目，下次同步会重新翻译

如果你实在担心，可以在自动同步脚本里加一步：翻译完成后、写入 `skills-gitee-temp/` 之前，做个快照（cp -r 到 backup 目录），保留最近 3 天的快照。

---

## 需求 4：能力包

### Q14: 能力包内容物清单

**说实话我也不完全确定每个包里有什么。** 这些包是之前手动打的，没有构建文档。

建议你**直接解压现有的 zip 看内容**，然后写文档。如果 253 上 `/data/binaries/` 旁边有个 capabilities 目录，里面的 zip 解压看看就知道了。

从客户端代码 `capability-manager.ts` 推断：
- `browser-pack.zip`：应该是 Playwright/Puppeteer 的浏览器二进制（Chromium），给 browser 能力用的
- `files-pack.zip`：文件操作相关的辅助工具
- 其他包类似

如果 253 上找不到这些 zip，那说明这个功能确实还没部署——客户端代码写了但服务端是空的。你查完之后告诉我实际情况。

### Q15: WSL 子路径

**对，WSL 包是同样功能但 Linux 版本。** 逻辑是：
- Windows 原生用户下载 `/api/capabilities/{filename}`
- Windows + WSL 用户下载 `/api/capabilities/wsl/{filename}`（因为 WSL 里跑的是 Linux 环境，需要 Linux 版本的二进制）

---

## P2 相关

### Q16: 阿里云 OSS bucket 和 AK

**用项目现有的 OSS。** bucket 和 AK 我后面单独给你（不在文档里写）。如果没有现成的 bucket，我让运维开一个。你先把脚本写好，AK 留环境变量占位。

### Q17: 90 服务器的权限

**你有 253 的 root 权限对吧？90 的 root 权限我给你。** SSH 密钥我后面发你。

你需要做的：
1. 在 90 上配 rsync 定时从 253 同步 `/data/binaries/`、skills 和 mcp-index.json
2. 修改 90 上 Docker Nginx 的配置，增加健康检查和 fallback

### Q18: RTO 预期

**30 秒可接受。** Nginx 健康检查间隔设 10 秒，连续 3 次失败后切到 fallback，相当于最长 30 秒感知到 253 故障。对于我们的场景够了——用户不会感知到 30 秒的延迟，因为 sync 本身就是后台异步的。

---

## 通用问题

### Q19: 测试环境

**直接在 253 上改。** 我们没有单独的 dev/staging 环境。但注意：
1. Java 应用改动先在本地编译测试通过再部署
2. Nginx 配置改动用 `nginx -t` 验证后再 reload
3. 同步脚本先手动跑一次确认没问题，再加 cron

如果你担心风险，可以在 253 上用 Docker 跑一个测试实例（不同端口），验证没问题后再替换生产。

### Q20: 上线节奏

**可以分批，建议顺序：**

1. **先上二进制工具的 latest.json + 元数据接口**（最简单，数据已经在盘上了，只差 JSON 和接口）
2. **再上 MCP 索引自动同步**（工作量最大，但也最重要）
3. **然后 Skills 自动同步 cron**
4. **最后 P2 的备份和 fallback**

每批上完验证没问题再下一批。

### Q21: 监控告警

**写日志就行，暂时不接告警通道。** 原因：
1. 我们目前没有统一的告警平台
2. 同步任务失败不会影响在线服务（客户端有本地缓存和多层 fallback）
3. 你在同步脚本里把成功/失败、条目数、耗时写到日志文件就够了

后续如果要接钉钉 webhook 告警，我再给你 webhook URL。现阶段不要求。

---

## 总结

**核心结论：**
1. ModelScope Token + GitHub Token 我提供，OSS AK 和 90 服务器权限我安排
2. 二进制文件其实已经在 253 上了（956MB），你不需要重新下载，**只差 latest.json 和自动更新**
3. MCP 索引不需要翻译，字段映射直接抄客户端代码
4. 直接在 253 上开发测试，分批上线
5. 先搞 P0，P1/P2 后面排

**我后面单独给你的东西：**
- [ ] ModelScope API Token
- [ ] GitHub Personal Access Token
- [ ] 阿里云 OSS bucket + AK/SK
- [ ] 90 服务器 SSH 权限

你收到这些之后就可以开工了。P0 的两个需求对齐了吗？还有疑问随时问。
