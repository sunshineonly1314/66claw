# Skills 全链路管道 PRD

> v1.0 | 2026-02-08 | 结合现有项目基础设施

## 1. 目标

建立从 **Skills 清洗 → 分类标签 → 存储 → 发布到 ClawdSkillsProxy → 用户端展示下载** 的完整管道，使用户能按分类浏览、按 CN 可用性筛选、一键安装。

---

## 2. 全链路数据流

```
skills/ 目录（用户手动添加 SKILL.md）
    │
    ▼ ① SkillWash Pipeline (已有 skillsqingxi/)
    ├─ Layer 1: 规则引擎 (结构校验 + 危险模式 + 黑名单)
    ├─ Layer 2: Qwen-Max 安全审计
    └─ Layer 3: 质量评估 + 分类标签 + 汉化翻译
    │
    ▼ ② 输出
    ├─ skills-index-v3.json          (精选索引，含分类/标签/CN状态)
    ├─ output/skills-zh/{name}/      (翻译后 SKILL.md)
    ├─ output/skills-en/{name}/      (英文原版 SKILL.md)
    └─ output/report/                (审计报告)
    │
    ▼ ③ 发布器 publisher.ts (新建)
    POST → ClawdSkillsProxy /api/skills/publish
    │
    ▼ ④ 用户端自动同步
    ~/.openclawcn/skills-index.json 定期刷新
    │
    ▼ ⑤ UI 展示
    分类浏览 + CN 筛选 + 标签搜索 + 一键安装
```

---

## 3. 标签分类体系

### 3.1 一级分类（10 个，与 Layer 3 prompt 已对齐）

| 分类 ID | 分类名 | 适用场景 | 代表技能 |
|---------|--------|---------|---------|
| `dev` | 开发工具 | 编程、代码审查、CI/CD、包管理、构建 | github, coding-agent, skill-creator, model-usage, oracle |
| `productivity` | 生产力工具 | 笔记、待办、日历、邮件、文件管理 | apple-notes, apple-reminders, things-mac, himalaya, trello, obsidian |
| `media` | 多媒体 | 图像/音频/视频处理、播放、格式转换 | video-frames, songsee, camsnap, gifgrep, peekaboo |
| `comm` | 通信协作 | 即时通讯、团队协作、语音通话 | slack, discord, bluebubbles, voice-call, wacli |
| `ai` | AI 工具 | AI 模型调用、图像生成、语音合成/识别 | gemini, openai-image-gen, openai-whisper, sherpa-onnx-tts |
| `smarthome` | 智能家居 | 设备控制、IoT 集成 | openhue, blucli, spotify-player |
| `security` | 安全工具 | 密钥管理、密码管理 | 1password |
| `data` | 数据工具 | 数据查询、天气/地理/API 集成 | weather, goplaces, local-places |
| `content` | 内容管理 | 博客、文档、CMS、内容监控 | blogwatcher, nano-pdf, summarize |
| `system` | 系统工具 | 系统配置、运维、部署、打包 | packaging, canvas, tmux |

### 3.2 子标签

每个技能 2-5 个子标签，由 Layer 3 质量评估自动生成（已在 `tags` 字段中输出）。

示例：
- `github` → `["git", "pull-request", "code-review", "cli"]`
- `sherpa-onnx-tts` → `["tts", "offline", "onnx", "multilingual"]`
- `weather` → `["weather", "forecast", "cli", "wttr.in"]`

### 3.3 CN 可用性（三级）

| 标签 | 含义 | UI 标记 | 判定规则 |
|------|------|---------|---------|
| `cn-native` | 中国大陆直连可用 | 🟢 可用 | cn_compatibility ≥ 8 且 cn_blocked = false |
| `cn-proxy` | 需镜像/代理后可用 | 🟡 需配置 | cn_compatibility 5-7 且 cn_blocked = false |
| `cn-blocked` | 核心功能被墙 | 🔴 不可用 | cn_blocked = true |

### 3.4 平台标签

从 SKILL.md frontmatter `metadata.openclawcn.os` 字段提取：

| 标签 | 含义 |
|------|------|
| `macos` | 支持 macOS |
| `linux` | 支持 Linux |
| `windows` | 支持 Windows |
| `all` | 全平台（无 os 声明时默认） |

---

## 4. Skills Index v3 Schema

### 4.1 顶层结构

```typescript
interface SkillsIndexV3 {
  schemaVersion: 3;
  generatedAt: string;              // ISO 8601
  pipelineVersion: string;          // "1.2.0"
  stats: {
    totalScanned: number;
    finalAccepted: number;
    byCategory: Record<string, number>;
    byTier: { S: number; A: number; B: number };
    byCnStatus: { native: number; proxy: number; blocked: number };
  };
  skills: EnrichedSkillMeta[];
}
```

### 4.2 单技能元数据

```typescript
interface EnrichedSkillMeta {
  // ===== 兼容 RemoteSkillMeta (v2) =====
  name: string;                     // 技能 ID (目录名)
  nameZh?: string;                  // 中文名称
  description: string;              // 英文描述
  descriptionZh?: string;           // 中文描述
  emoji?: string;                   // 图标
  path: string;                     // 等同 name
  version?: string;                 // 语义版本号
  tags?: string[];                  // 子标签 (2-5 个)
  author?: string;                  // 作者

  // ===== v3 新增：分类 =====
  category: string;                 // 一级分类 ID (dev/productivity/media/...)
  categoryZh: string;               // 一级分类中文名
  cnStatus: "cn-native" | "cn-proxy" | "cn-blocked";
  cnAlternative?: string;           // 被墙时的替代方案
  platforms: string[];              // ["macos","linux","windows"] 或 ["all"]

  // ===== v3 新增：质量 =====
  tier: "S" | "A" | "B";           // 评级
  overallScore: number;             // 综合评分 (5.0-10.0)

  // ===== v3 新增：安装 =====
  requiresBins?: string[];          // 所需二进制 (从 frontmatter 提取)
  installMethods?: string[];        // 安装方式 ["brew","npm","go","download"]
  estimatedSizeBytes?: number;      // 预估安装大小

  // ===== v3 新增：翻译 =====
  hasTranslation: boolean;          // 是否有中文翻译版
}
```

### 4.3 向后兼容

- v3 是 v2 的超集，所有 v2 字段保留
- `LocalSkillsIndex.remote` 数组中的元素类型从 `RemoteSkillMeta` 升级为 `EnrichedSkillMeta`
- 旧版客户端读取 v3 索引时，忽略未知字段，不会报错
- `schemaVersion: 3` 标识新格式

---

## 5. SkillWash Pipeline 改造

### 5.1 Layer 3 输出增强

在 `layer3-quality.ts` 的 `QualityResponse` 中，利用已有的 `category`、`tags`、`cn_blocked`、`cn_compatibility` 字段，在 `pipeline.ts` 的 `generateSkillsIndex()` 中映射为 v3 格式：

```
category (Qwen 输出的中文分类名)  →  categoryId 映射表  →  category (ID)
cn_blocked + cn_compatibility     →  cnStatus 三级标签
metadata.openclawcn.os              →  platforms
metadata.openclawcn.requires.bins   →  requiresBins
metadata.openclawcn.install[].kind  →  installMethods
```

### 5.2 分类映射表

```typescript
const CATEGORY_MAP: Record<string, string> = {
  "开发工具": "dev",
  "生产力工具": "productivity",
  "多媒体": "media",
  "通信协作": "comm",
  "AI 工具": "ai",
  "智能家居": "smarthome",
  "安全工具": "security",
  "数据工具": "data",
  "内容管理": "content",
  "系统工具": "system",
};
```

### 5.3 cnStatus 计算逻辑

```typescript
function computeCnStatus(cnBlocked: boolean, cnCompatibility: number): string {
  if (cnBlocked) return "cn-blocked";
  if (cnCompatibility >= 8) return "cn-native";
  return "cn-proxy";
}
```

### 5.4 平台/依赖提取

从 `parseSkillMd()` 解析的 frontmatter 中提取：
- `metadata.openclawcn.os` → `platforms`
- `metadata.openclawcn.requires.bins` + `requires.anyBins` → `requiresBins`
- `metadata.openclawcn.install[].kind` → `installMethods` (去重)

---

## 6. 发布器设计

### 6.1 文件

新建 `skillsqingxi/publisher.ts`

### 6.2 功能

```
读取 skills-index-v3.json
    ↓
对比 ClawdSkillsProxy 现有索引 (GET /api/skills/index)
    ↓
计算差异 (新增 / 更新 / 删除)
    ↓
打包变更技能的 SKILL.md (en + zh) 为 ZIP
    ↓
POST /api/skills/publish { index: v3, archive: ZIP }
    ↓
校验发布结果 (GET /api/skills/index 确认版本)
```

### 6.3 API 对接

```typescript
// 已有 API (clawdskillsproxy-registry.ts)
GET  /api/skills/index              → 获取当前索引
POST /api/skills/download           → 下载技能 ZIP

// 新增 API (需 Proxy 端支持)
POST /api/skills/publish            → 发布更新索引 + 技能包
  Headers: Authorization: Bearer <token>
  Body: multipart/form-data
    - index: skills-index-v3.json
    - archive: skills.zip (en + zh SKILL.md)
```

### 6.4 CLI 入口

```bash
# 发布到 ClawdSkillsProxy
bun skillsqingxi/run.ts --publish

# 全流程：清洗 + 发布
bun skillsqingxi/run.ts --dir skills/ --publish
```

---

## 7. UI 增强（用户端）

### 7.1 分类浏览

在 Skills 市场页面顶部增加分类 Tab 栏：

```
[ 全部 ] [ 开发工具 ] [ 生产力 ] [ 多媒体 ] [ AI ] [ 通信 ] [ 更多▼ ]
```

- 横向滚动，"更多" 下拉展开剩余分类
- 点击分类过滤列表
- 每个分类显示技能数量角标

### 7.2 CN 可用性筛选

- CN 用户默认: 仅显示 🟢 `cn-native` + 🟡 `cn-proxy`
- 提供 "显示全部（含需翻墙）" 开关
- 每个技能卡片右上角显示 CN 状态圆点

### 7.3 搜索与排序

- 搜索范围: `name` + `nameZh` + `description` + `descriptionZh` + `tags`
- 排序选项: 评分（默认）| 名称 | 分类 | 最近更新
- 平台筛选: 当前系统平台优先

### 7.4 技能卡片信息

```
┌──────────────────────────────────────┐
│ 🌤️ weather                    🟢 A  │
│ 查询天气预报，支持多城市            │
│                                      │
│ [数据工具]  #weather #forecast #cli  │
│ macOS · Linux · Windows              │
│                                      │
│                      [ 安装 ]        │
└──────────────────────────────────────┘
```

---

## 8. 现有代码改造点

### 8.1 `skillsqingxi/pipeline.ts`

`generateSkillsIndex()` 函数改造：

| 改动 | 说明 |
|------|------|
| `schemaVersion: 2` → `3` | 版本升级 |
| 新增 `CATEGORY_MAP` 映射 | Qwen 中文分类 → 分类 ID |
| 新增 `computeCnStatus()` | cn_blocked + cn_compatibility → 三级标签 |
| 新增 `stats.byCategory` / `byCnStatus` | 统计信息 |
| 提取 frontmatter 中的 bins/install | 填充 requiresBins/installMethods |
| 输出 `categoryZh` 字段 | 中文分类名 |

### 8.2 `skillsqingxi/types.ts`

新增 `EnrichedSkillMeta` 接口（或直接在 pipeline.ts 中定义）

### 8.3 `src/agents/skills/local-index.ts`

- `LocalSkillsIndex.remote` 兼容 v3 字段
- 新增 `getSkillsByCategory()` 便捷方法

### 8.4 `src/gateway/server-methods/skills-batch.ts`

- `categorizeSkill()` 改为读取索引中的 `category` 字段（当前是硬编码 keyword 匹配）
- 新增 `skills.market.categories` RPC → 返回分类列表及数量

### 8.5 `ui/src/ui/views/skills-batch-confirm.ts`

- 按分类分组展示
- 增加 CN 状态标识

---

## 9. 实施计划

### Phase 1: 标签体系 + Index v3（1-2 天）

| 任务 | 文件 | 说明 |
|------|------|------|
| CATEGORY_MAP 映射表 | `skillsqingxi/pipeline.ts` | 10 大类 ID ↔ 中文名 |
| computeCnStatus() | `skillsqingxi/pipeline.ts` | 三级 CN 标签计算 |
| generateSkillsIndex() 升级 v3 | `skillsqingxi/pipeline.ts` | 输出 EnrichedSkillMeta |
| EnrichedSkillMeta 类型 | `skillsqingxi/types.ts` | 新增接口 |
| 重跑 `--dir skills/` | CLI | 生成 skills-index-v3.json |

### Phase 2: 发布器（1 天）

| 任务 | 文件 | 说明 |
|------|------|------|
| publisher.ts | `skillsqingxi/publisher.ts` | 新建发布器 |
| --publish 参数 | `skillsqingxi/run.ts` | 接入 CLI |
| Proxy 端 publish API | ClawdSkillsProxy 服务端 | 需配合服务端开发 |

### Phase 3: UI 增强（2-3 天）

| 任务 | 文件 | 说明 |
|------|------|------|
| 分类 Tab 组件 | `ui/src/ui/views/` | 新建分类浏览视图 |
| CN 筛选逻辑 | `ui/src/ui/controllers/` | 默认过滤 cn-blocked |
| 搜索功能 | `ui/src/ui/controllers/` | 名称/标签模糊匹配 |
| 技能卡片改版 | `ui/src/ui/views/` | 增加分类/CN/评分信息 |
| skills.market.categories RPC | `src/gateway/server-methods/` | 分类列表接口 |

---

## 10. 验证方案

1. **Index v3 格式**: 重跑 SkillWash 后检查 skills-index-v3.json，确认 54 个技能的 category/cnStatus/platforms 均正确填充
2. **向后兼容**: 旧版客户端读取 v3 索引不报错，功能正常
3. **分类覆盖**: 10 大类覆盖全部 27 个收录技能，无"未分类"
4. **CN 分布**: 验证 cn-native/cn-proxy/cn-blocked 分布与实际一致
5. **发布验证**: publisher.ts 成功推送到 ClawdSkillsProxy，用户端可拉取
6. **UI 验证**: 分类 Tab 展示正确，CN 筛选生效，搜索命中
