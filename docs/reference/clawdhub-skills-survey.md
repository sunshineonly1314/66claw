# ClawdHub 技能库调研报告

## 一、https://clawdhub.com 当前状态

- **站点**：https://clawdhub.com（与 MoltHub 同源，clawdhub.com 为 Clawdbot 使用的技能注册表）
- **Registry 发现**：`https://clawdhub.com/.well-known/clawdhub.json` 返回 `apiBase` / `registry` 为 `https://clawdhub.com`
- **公开 API 基址**：`https://clawdhub.com`（v1 能力与 [moltbot/molthub](https://github.com/moltbot/molthub) 一致）

## 二、技能总数与列表方式

- **总数**：对 `GET /api/v1/skills?limit=100` 做完整分页遍历（至 `nextCursor` 为 `null`）得到 **共 984 个技能**（2025-01 实测：11 页，无重复 slug）。
- **列表 API**：
  - `GET https://clawdhub.com/api/v1/skills?limit=100`
  - 可选：`&cursor=<nextCursor>` 翻页，`&sort=updated|downloads|stars|installsCurrent|installsAllTime|trending`
- **单条结构**：每个 item 含 `slug`、`displayName`、`summary`、`tags`、`stats`、`latestVersion` 等，**`slug` 即安装时用的 ID**。

## 三、是否能把「所有技能」下载到本地 / 再放到 Gitee？

**可以。** 两种用法都支持：

### 方案 A：先全部下载到本地，再「按需安装」

1. **拿全量 slug 列表**  
   用列表 API 循环分页（`limit=100` + `cursor=nextCursor`），直到 `nextCursor` 为 `null`，收集所有 `slug`。
2. **按 slug 下载到本地目录**  
   - 用 **clawdhub CLI**：对每个 slug 执行 `clawdhub install <slug>`，默认会装到当前目录下 `./skills/<slug>/`。  
   - 或直接用 **下载 API**：  
     MoltHub/ClawdHub 的 HTTP 路由里有 `ApiRoutes.download`（GET），CLI 的「按版本下载 zip」会请求该接口。  
     若你要自己做脚本，可参考 [molthub/convex/http.ts](https://github.com/moltbot/molthub/blob/main/convex/http.ts) 里 `downloadZip` 与路由注册，以及 clawdhub CLI 源码中的下载 URL 构造（一般形态为：registry + download 路径 + slug + version/tag）。
3. **「需要时再安装」**  
   你本地已经有一份「全量 skills 目录」后，要装到某个 Clawdbot 工作区时，可以：
   - 从该目录拷贝对应 `<slug>` 子目录到目标 `skills/`，或  
   - 在 `~/.clawdbot/clawdbot.json` 里用 `skills.load.extraDirs` 把你的「全量技能根目录」加进去，由 Clawdbot 按需加载（仍以 workspace / managed / bundled 的优先级为准）。

### 方案 B：下载到本地后再推到 Gitee，需要时从 Gitee 拉

1. **同上**，用列表 API 拿到全部 slug，再用 CLI 或下载 API 把每个技能解压到本地一个总目录（例如 `./clawdhub-skills-mirror/`）。
2. **将该目录做成一个 Git 仓库并推到 Gitee**  
   - 每个技能一个子目录，目录名为 `slug`，其内为当前使用的版本（例如 `latest` 对应版本）解压后的内容。  
   - 之后更新时：再跑一遍「列表 → 按 slug 下载/更新」，然后 `git add/commit/push` 到 Gitee。
3. **需要时从 Gitee 拉**  
   - 方式 1：`git clone` 或 `git pull` 你的 Gitee 仓库到某目录，再在 `skills.load.extraDirs` 里指向这个目录；  
   - 方式 2：写一个小脚本/任务，按需从 Gitee 拉取指定 slug 子目录到当前 workspace 的 `skills/` 下，再启动 Clawdbot。

两种方案都只依赖「列表 API + 按 slug 下载」（或等价地使用 `clawdhub install`），不要求登录；登录仅在你需要「发布/更新技能到 clawdhub.com」时才用。

## 四、实现时需注意

1. **速率与礼貌爬取**  
   - 列表 API 的限速见 [molthub convex/httpApiV1.ts](https://github.com/moltbot/molthub/blob/main/convex/httpApiV1.ts)（例如 read 类 120 次/分钟/IP）。  
   - 建议：分页与下载都加间隔（如 1–2 秒），避免触发 429。
2. **版本与标签**  
   - 列表里每个 skill 的 `latestVersion.version` 和 `tags.latest` 表示当前「latest」指向的版本。  
   - 若要做「按版本归档」，可再调 `GET /api/v1/skills/<slug>/versions` 拿到版本列表，再按需下载对应版本的 zip。
3. **License / 再分发**  
   - 技能作者各自授权不同，把整库镜像到 Gitee 再公开时，需自行确认不违反各技能的 license 与 ClawdHub 使用条款；若仅内网或私有 Gitee 使用，一般更易满足合规。
4. **与现有加载优先级的关系**  
   - Clawdbot 的加载顺序（从高到低）：workspace → managed → bundled → extraDirs。  
   - 把「全量下载目录」或「Gitee 克隆目录」配成 `skills.load.extraDirs` 后，只有在你没有在 workspace/managed 里覆盖同名技能时，才会用到这些镜像里的版本。

## 五、小结

| 问题 | 结论 |
|------|------|
| clawdhub.com 有多少技能？ | **984 个**（按 `/api/v1/skills` 分页遍历至结束得到的唯一 slug 数，2025-01 实测）。 |
| 能否一次性下载到本地？ | **能**。用列表 API 拿全量 slug，再用 `clawdhub install <slug>` 或下载 API 写入本地目录。 |
| 能否再放到 Gitee，需要时再拉？ | **能**。把本地「全量技能目录」做成 Git 仓推到 Gitee，需要时用 `extraDirs` 或按需拷贝到 workspace。 |
| 列表/下载的入口？ | 列表：`GET https://clawdhub.com/api/v1/skills?limit=100&cursor=...`；下载：使用 clawdhub CLI 或与 `ApiRoutes.download` 对应的 GET 接口（参见 molthub 与 clawdhub CLI 实现）。 |

以上结论基于对 [clawdhub.com](https://clawdhub.com)、[.well-known/clawdhub.json](https://clawdhub.com/.well-known/clawdhub.json)、[molthub 的 HTTP API 与 Convex 路由](https://github.com/moltbot/molthub/tree/main/convex) 及 Clawdbot 文档的阅读与实测。
