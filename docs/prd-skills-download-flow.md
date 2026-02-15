# PRD: Skills 批量下载安装流程

> 文档版本: 1.0
> 最后更新: 2026-02-08
> 负责人: TecbinAI
> UI 原型文件: `ui/1-chat-banner.html` ~ `ui/skills-complete.html`
> 镜像方案: `docs/skills-china-mirrors.md`

---

## 目录

1. [产品概述](#一产品概述)
2. [用户故事与目标](#二用户故事与目标)
3. [完整用户流程](#三完整用户流程)
4. [屏幕规格说明](#四屏幕规格说明)
5. [交互设计规范](#五交互设计规范)
6. [技术架构](#六技术架构)
7. [数据结构设计](#七数据结构设计)
8. [API 设计](#八api-设计)
9. [错误处理与边界情况](#九错误处理与边界情况)
10. [UI/UX 专家评审](#十uiux-专家评审)
11. [技术专家评审](#十一技术专家评审)
12. [实施路线图](#十二实施路线图)

---

## 一、产品概述

### 1.1 背景

OpenClawCN CN 的 Skills 系统依赖大量第三方工具（brew 包、npm 包、Go 工具、二进制文件等）。中国用户在安装这些依赖时面临两个核心问题：

1. **网络不可达** — GitHub Release、npmjs.org、proxy.golang.org 等被墙或极慢
2. **安装复杂** — 用户需要逐个手动安装，门槛极高

### 1.2 目标

提供**一键批量安装**体验：用户在首次使用时，通过国内镜像自动下载并安装所有 Skills 依赖，全程无感知无手动操作。

### 1.3 核心指标

| 指标 | 目标值 |
|------|--------|
| 安装完成率 | > 95%（至少 95% 的技能成功安装） |
| 平均安装耗时 | < 60 秒（100Mbps 宽带） |
| 镜像成功率 | > 98%（单次请求） |
| 用户放弃率 | < 10%（点了"立即安装"后取消的比例） |

### 1.4 用户角色

- **新用户** — 首次安装 OpenClawCN，完全不了解 Skills 体系
- **回访用户** — 更新版本后，需要增量安装新增的 Skills
- **开发者用户** — 想了解每个 Skill 的具体功能和依赖情况

---

## 二、用户故事与目标

### US-01: 新用户首次安装
> 作为新用户，我在 Chat 页看到提示后，想一键安装所有 AI 能力，不需要了解技术细节。

**验收标准:**
- Chat 页显示非侵入式安装横幅
- 一键触发安装，无需手动操作
- 安装过程有清晰进度反馈
- 安装完成后展示解锁的能力列表

### US-02: 网络不稳定时的降级体验
> 作为网络环境较差的用户，某些下载失败后，我想知道哪些失败了，能重试或跳过。

**验收标准:**
- 失败项有详细错误原因
- 可以单独重试失败项
- 可以跳过失败项，使用已成功的技能
- 失败信息可一键上报

### US-03: 增量更新
> 作为老用户，版本更新后新增了 2 个 Skills，我只需要安装这 2 个新的。

**验收标准:**
- 系统自动检测已安装和缺失的 Skills
- 仅下载缺失部分
- 展示"2 个新技能可安装"而非全部 18 个

### US-04: 故障上报闭环
> 作为用户，下载失败后我上报了问题，TecbinAI 应该据此添加国内镜像。

**验收标准:**
- 上报数据包含镜像名、URL、错误码、OS/Arch
- 不含任何用户个人信息
- 上报成功后给用户反馈

---

## 三、完整用户流程

```
┌─────────────────────────────────────────────────────┐
│                  首次进入 Chat 页                      │
│                       │                              │
│          ┌────── 检测 Skills 状态 ──────┐             │
│          │                             │             │
│     全部已安装                    有缺失项            │
│          │                             │             │
│      不显示横幅                  显示安装横幅           │
│                                        │             │
│                          ┌─────────────┼──────┐      │
│                          │             │      │      │
│                     点击"立即安装"  点击"稍后"  点击 ✕  │
│                          │             │      │      │
│                   [Screen 2]      关闭横幅  关闭横幅   │
│                    确认弹窗        (24h 后    (本次    │
│                          │        再提示)    不再提示) │
│                    点击"开始"                         │
│                          │                           │
│                   [Screen 3]                         │
│                    下载进度                           │
│                          │                           │
│              ┌───────────┼──────────┐                │
│              │                      │                │
│          全部成功              部分失败               │
│              │                      │                │
│       [Screen 5]            [Screen 4]               │
│       安装完成页             下载结果页                │
│              │                      │                │
│              │           ┌──────────┼──────┐         │
│              │           │          │      │         │
│              │       重试失败项  一键上报  继续使用    │
│              │           │          │      │         │
│              │      回到 Screen3   Toast   │         │
│              │                             │         │
│              └──────────── 进入 Chat ──────┘         │
└─────────────────────────────────────────────────────┘
```

### 关键分支逻辑

| 场景 | 触发条件 | 行为 |
|------|---------|------|
| 全新安装 | 检测到 0 个已安装 Skill | 显示完整横幅，"发现 18 个超能力" |
| 增量更新 | 检测到 2 个缺失 Skill | 显示精简横幅，"2 个新技能可安装" |
| 全部已安装 | 所有 Skill 均满足 | 不显示横幅 |
| 用户关闭横幅 | 点击 ✕ | 本次会话不再显示；24h 后下次进入再提示 |
| 用户点"稍后" | 点击"稍后"按钮 | 关闭横幅，24h 后再提示 |
| 安装中断 | 用户关闭页面/网络断开 | 下次进入自动检测，已下载的不重复下载（断点续传） |

---

## 四、屏幕规格说明

### Screen 1: Chat 页安装横幅

**原型文件**: `ui/1-chat-banner.html`

#### 布局结构
```
┌──────────────────────────────────────┐
│ ⚡ 图标  | 标题 + 描述          [✕]  │
│                                      │
│ ┌──────┬──────┬──────┐              │
│ │ 18   │103MB │ ~30s │  统计区域    │
│ │个技能 │预估大小│预估耗时│             │
│ └──────┴──────┴──────┘              │
│                                      │
│ [Gmail][摘要][语音][Hue]... pill预览  │
│                                      │
│ [ ⚡ 立即安装 ]  [稍后]   操作按钮    │
└──────────────────────────────────────┘
```

#### 元素规格

| 元素 | 规格 |
|------|------|
| 容器 | 圆角 14px, 背景 `#0e1017`, 边框 `rgba(255,255,255,0.05)` |
| 顶部装饰线 | 高 2px, 渐变 `cyan → transparent`, 左对齐 |
| 图标区 | 40×40px, 圆角 10px, 背景 `rgba(0,229,255,0.08)` |
| 标题 | 15px, 700 weight, 白色 |
| 描述 | 12.5px, 400 weight, `#7a7f96` |
| 统计区 | 深色内嵌卡片, 圆角 10px, JetBrains Mono 数字 |
| Pill 标签 | 圆角 100px, 背景 `rgba(255,255,255,0.04)`, 11px |
| 主按钮 | 渐变 `cyan → #00b8d4`, 圆角 10px, 14px 700weight |
| 次要按钮 | ghost 样式, 边框 `rgba(255,255,255,0.05)` |
| 关闭按钮 | 24×24px, 右上角, `✕`, hover 背景变亮 |

#### 数据来源
- **技能数量**: 调用 `skills.status` RPC, 统计 `missing.bins.length > 0` 的 skill 数
- **预估大小**: 从 `mirrors-manifest.json` 汇总所有缺失 skill 的 `size_bytes`
- **预估耗时**: 基于 `size / estimated_speed`, 首次默认假设 3 MB/s

#### 显示条件
```typescript
// 伪代码
const missingSkills = report.skills.filter(s => !s.eligible && s.incompatibleReason?.kind !== 'os');
const showBanner = missingSkills.length > 0 && !isDismissed() && !isInstallingNow();
```

#### 消失时机
- 用户点击"立即安装" → 切换到 Screen 2
- 用户点击"稍后" → `localStorage` 存 `skills_banner_dismissed_at = Date.now()`
- 用户点击 ✕ → 同上
- 24h 后清除 dismissed 状态，重新检测

---

### Screen 2: 确认弹窗

**原型文件**: `ui/2-download-confirm.html`

#### 布局结构
```
┌──────────────────────────────────────┐
│          ⚡ 图标 (56px)              │
│          安装 AI 超能力               │
│          描述文字                     │
│                                      │
│  ┌────────┐ ┌────────┐              │
│  │18 个    │ │103 MB  │              │
│  │技能数量  │ │下载大小 │              │
│  ├────────┤ ├────────┤              │
│  │~30 秒   │ │3 线程   │              │
│  │预估耗时  │ │并发线程 │              │
│  └────────┘ └────────┘              │
│                                      │
│  安装内容:                            │
│  🚀 生产力工具            4          │
│  🛠 开发工具              6          │
│  💻 平台专属              3          │
│  🎧 音频 & 媒体           3          │
│  🌐 智能硬件 & 服务        2          │
│                                      │
│  🇨🇳 已启用国内加速镜像              │
│  磁盘空间: ✓ 充足 (45.2 GB)         │
│                                      │
│  [     开始安装     ]                │
│        取消                          │
└──────────────────────────────────────┘
```

#### 元素规格

| 元素 | 规格 |
|------|------|
| 蒙层 | `rgba(0,0,0,0.65)`, `backdrop-filter: blur(8px)` |
| 弹窗 | max-width 440px, 圆角 18px, 进入动画 `scale(0.92→1) + translateY(20→0)` |
| 图标 | 56×56px, 圆角 16px |
| 四格数据 | 2×2 grid, gap 8px, 圆角 10px, JetBrains Mono 数字 |
| 分类列表 | 行高 36px, emoji + 名称 + 右对齐数字 |
| 镜像提示 | 绿色底, 圆角 10px, `🇨🇳` 前缀 |
| 磁盘检查 | 灰底, 绿色"✓ 充足" |
| 安装按钮 | 100% 宽度, 13px padding, 渐变 cyan |
| 取消按钮 | ghost, 文字居中 |

#### 交互细节
- **弹窗入场**: `cubic-bezier(0.34, 1.3, 0.64, 1)`, 350ms, 从下方弹入
- **点击蒙层**: 不关闭（防止误操作）
- **ESC 键**: 关闭弹窗，返回 Chat 页
- **磁盘空间不足**: 红色警告替换绿色提示，安装按钮置灰 + disable
- **预估耗时动态计算**: 可选 — 在弹窗出现时做一个小文件 speed test，更新耗时

#### 磁盘空间检查
```typescript
// 伪代码 — Gateway 端
async function checkDiskSpace(requiredBytes: number): Promise<{
  ok: boolean;
  available: number;
  required: number;
}> {
  const { available } = await checkDisk(installPath);
  return {
    ok: available > requiredBytes * 1.5, // 保留 50% 余量
    available,
    required: requiredBytes,
  };
}
```

---

### Screen 3: 下载进度

**原型文件**: `ui/3-download-progress.html`

#### 布局结构
```
┌──────────────────────────────────────┐
│          ⬇️ 正在安装超能力...          │
│       使用国内加速镜像，多线程下载中    │
│                                      │
│  ████████████████░░░░░░░░  65%       │
│  12/18  67MB/103MB  ↓ 4.2 MB/s      │
│                                      │
│  ● 当前镜像源: goproxy.cn · 延迟45ms │
│                                      │
│  ┌─ ✓ gogcli ──── 15.2MB · 3.2s ──┐ │
│  ├─ ✓ summarize ─ 12.0MB · 2.8s ──┤ │
│  ├─ ✓ oracle ──── npm · 1.5s ─────┤ │
│  ├─ ● sag ─── 下载中 5.1/8.4MB ───┤ │
│  │   ████████████░░░░░░░  60%      │ │
│  ├─ ↻ camsnap ── 切换 ghfast.top ──┤ │
│  │   ████░░░░░░░░░░░░░░░  25%     │ │
│  ├─ ● remindctl ─ 下载中 1.2/3.1 ──┤ │
│  ├─ … spogo ──── 等待中... ────────┤ │
│  ├─ … openhue ── 等待中... ────────┤ │
│  └─ … goplaces ─ 等待中... ────────┘ │
│                                      │
│  下载过程中可以最小化，后台继续安装     │
│            取消安装                   │
└──────────────────────────────────────┘
```

#### 任务卡片 4 种状态

| 状态 | 视觉 | 颜色 | 图标 |
|------|------|------|------|
| **已完成** done | 名称变淡, 显示大小和耗时 | 绿色勾 `#00e676` | ✓ (圆形绿底) |
| **下载中** active | 高亮边框, mini 进度条, spinner | 青色 `#00e5ff` | CSS spinner |
| **镜像切换** retry | 黄色边框, 显示切换信息 | 黄色 `#ffab00` | ↻ |
| **等待中** pending | 灰色, 名称变暗 | 灰色 `#4a4e63` | … |
| **失败** failed | 红色名称 | 红色 `#ff4081` | ✕ (圆形红底) |

#### 进度条规格

| 元素 | 规格 |
|------|------|
| 总进度条 | 高 6px, 圆角 3px, 渐变 `cyan → #00b8d4` |
| 光泽动画 | 右端 40px 宽, 1.5s 呼吸闪烁 |
| 单项进度条 | 高 3px, 圆角 2px, 在 task-info 内 |
| 速度显示 | JetBrains Mono, 绿色, `↓ X.X MB/s` |

#### 镜像指示器
- 绿色呼吸圆点 + 当前镜像名 + 延迟
- 镜像切换时短暂变黄，0.5s 后恢复绿色
- 格式: `● 当前镜像源: {name} · 延迟 {latency}ms`

#### 实时更新频率
- 进度百分比: 每 200ms 更新一次
- 速度: 每 1s 滑动窗口平均值
- 任务状态: 事件驱动（WebSocket push）

#### 并发可视化
- 同时最多 3 个 `active` 状态的任务卡片（对应 3 并发线程）
- 完成一个，下一个自动从 `pending` 变为 `active`

#### 取消安装
- 点击"取消安装"弹出确认: "已下载的文件将保留，下次可断点续传"
- 确认后停止所有下载线程，返回 Chat 页
- 已下载完的文件保留在本地，不删除

---

### Screen 4: 下载结果（部分失败）

**原型文件**: `ui/4-download-result.html`

#### 布局结构
```
┌──────────────────────────────────────┐
│           ⚠️ 安装基本完成              │
│     大部分技能已安装成功，少数需处理    │
│                                      │
│  ┌──────┐ ┌──────┐ ┌──────┐        │
│  │  16  │ │  2   │ │ 23s  │        │
│  │安装成功│ │安装失败│ │总耗时 │        │
│  └──────┘ └──────┘ └──────┘        │
│                                      │
│  ✓ 安装成功  16                      │
│  [gogcli][summarize][oracle]... pills │
│                                      │
│  ✕ 安装失败  2                       │
│  ┌─ 🗣️ sag ────── 3源均失败 ────┐   │
│  │  SHA256 校验失败 · 已重试 3 次  │   │
│  │  gh-proxy ✕ ghfast ✕ ghproxy ✕ │   │
│  └────────────────────────────────┘   │
│  ┌─ 💡 openhue ── 连接超时 ──────┐   │
│  │  所有镜像连接超时              │   │
│  │  gh-proxy ✕ ghfast ✕ ghproxy ✕ │   │
│  └────────────────────────────────┘   │
│                                      │
│  📮 上报问题帮助改进                   │
│  ┌────────────────────────────────┐   │
│  │ 将失败信息发送给 TecbinAI...    │   │
│  │ {"failures":[...]}  JSON预览   │   │
│  │ [📮 一键上报]  [↻ 重试失败项]   │   │
│  └────────────────────────────────┘   │
│                                      │
│  [  继续使用（已安装 16 个超能力）→ ]  │
│  失败的技能可随时在 /skills 中重新安装  │
└──────────────────────────────────────┘
```

#### 成功项展示 — 紧凑 Pill 模式
- 绿底圆角 pill, emoji + 名称
- 自动换行, gap 6px
- 超过 8 个折叠: "显示全部 16 个 ▾"

#### 失败项展示 — 详细卡片模式
每张失败卡片包含:
- **左边框**: 3px 红色 `#ff4081`
- **技能名**: 加粗, 14px
- **错误标签**: 红色 pill (如"3源均失败"、"连接超时")
- **详细原因**: JetBrains Mono, 灰色, 一行描述
- **镜像尝试记录**: 小 pill 标签, 删除线表示失败

#### 上报卡片
- 左边框 3px 黄色 `#ffab00`
- 预览 JSON (只读, 80px 高度截断)
- "一键上报"按钮: 黄色底, 点击后变绿色 ✓ + "已上报"
- "重试失败项"按钮: ghost 样式

#### 上报数据结构
```json
{
  "failures": [
    {
      "skill": "sag",
      "version": "1.2.0",
      "os": "win32",
      "arch": "x64",
      "mirrors_tried": [
        { "name": "gh-proxy.com", "error": "timeout", "latency_ms": 5000 },
        { "name": "ghfast.top", "error": "sha256_mismatch", "latency_ms": 3200 },
        { "name": "ghproxy.net", "error": "http_503", "latency_ms": 1800 }
      ]
    }
  ],
  "succeeded_count": 16,
  "total_count": 18,
  "duration_ms": 23000,
  "client_version": "1.2.0",
  "timestamp": "2026-02-08T12:00:00Z"
}
```

#### 隐私保证
上报数据**不包含**: 用户名、IP、设备 ID、API Key、聊天记录、文件路径

---

### Screen 5: 安装完成

**原型文件**: `ui/skills-complete.html`

#### 布局结构
```
┌──────────────────────────────────────┐
│      ⚡ (圆环 + 脉冲 + confetti)     │
│          超能力已就绪                 │
│    所有 Skills 已下载并安装完成        │
│                                      │
│   ┌──┐   ┌───┐   ┌──┐              │
│   │18│   │103│   │23│   数字递增     │
│   │个 │   │MB │   │秒│              │
│   └──┘   └───┘   └──┘              │
│                                      │
│  向下滑动查看全部能力 ↓               │
│                                      │
│  🚀 生产力                    4      │
│  ┌─ gogcli ──── Gmail/Calendar ───┐ │
│  ├─ summarize ─ 摘要网页/视频 ────┤ │
│  ├─ oracle ──── 交叉审查 ─────────┤ │
│  └─ obsidian-cli ── Obsidian ─────┘ │
│                                      │
│  🛠 开发工具                   6     │
│  ... (同上模式)                      │
│                                      │
│  💡 如何使用                          │
│  在对话中说出需求即可。输入 /skills    │
│  查看所有可用技能。                   │
│                                      │
│  [     开始对话 →     ]              │
│        稍后再看                      │
└──────────────────────────────────────┘
```

#### 动画编排时间线

| 时间点 | 动画 |
|--------|------|
| 0.0s | 页面载入 |
| 0.2s | Header fadeSlideUp 开始 |
| 0.5s | 圆环 ringExpand (0.6s 时长) |
| 0.8s | 脉冲圆环 ringPulseOut |
| 0.9s | ⚡ checkPop 弹入 |
| 1.0s | Confetti 粒子爆炸 (80 个粒子) |
| 1.1s | Stats bar fadeIn |
| 1.2s | 数字递增动画开始 (0→18, 0→103, 0→23) |
| 1.4s | 滚动提示出现 |
| 1.5s | 第一个分类 fadeIn |
| 1.5s+ | 卡片依次入场 (55ms 间隔) |
| 2.2s | CTA 按钮 fadeIn |

#### Confetti 粒子规格
- 粒子数: 80
- 颜色: `['#00e5ff','#b388ff','#00e676','#ffab00','#ff4081','#448aff','#1de9b6']`
- 发射源: 页面中心偏上 (35% height)
- 初速度: vx ∈ [-6, 6], vy ∈ [-4, -18]
- 重力: 0.25 ~ 0.4
- 衰减: opacity -= 0.008~0.016/frame
- 形状: 矩形 (3~9 × 2~6 px), 带旋转

#### 数字递增动画
- 缓动: ease-out cubic `1 - (1-t)^3`
- 时长: 技能数 1.2s, 大小 1.0s, 耗时 0.8s
- 整数取整, 无小数

---

## 五、交互设计规范

### 5.1 动效原则

| 原则 | 说明 |
|------|------|
| **有意义的运动** | 每个动画都传达信息（进入、完成、切换、错误），不做纯装饰动效 |
| **快速响应** | 按钮 hover 100ms, 状态切换 250ms, 页面转场 350ms |
| **层次感** | 用 stagger delay 建立视觉层次（先标题 → 后列表 → 最后 CTA） |
| **不阻塞** | 动画不阻塞用户操作，下载进度页随时可取消 |

### 5.2 转场动画

| 转场 | 动画 | 时长 |
|------|------|------|
| Chat → 确认弹窗 | 蒙层 fadeIn + 弹窗 scaleUp | 350ms |
| 确认弹窗 → 下载进度 | 弹窗 fadeOut → 进度页 fadeIn | 300ms |
| 下载进度 → 结果页 | 进度条变满 → crossFade 500ms | 500ms |
| 结果页 → 完成页 | fadeOut → fadeIn + confetti | 400ms |
| 完成页 → Chat | 全页 fadeOut 400ms → Chat 页 | 400ms |

### 5.3 色彩状态映射

| 状态 | 主色 | 用途 |
|------|------|------|
| 默认/信息 | `#00e5ff` cyan | 进度条、主按钮、链接 |
| 成功 | `#00e676` green | 勾选、完成、速度 |
| 警告/切换 | `#ffab00` amber | 镜像切换、上报 |
| 错误/失败 | `#ff4081` rose | 失败项、错误信息 |
| 禁用/等待 | `#4a4e63` dim | 待处理项、灰色文字 |

### 5.4 字体规范

| 用途 | 字体 | 大小 | 权重 |
|------|------|------|------|
| 大标题 | Noto Sans SC | 22px | 700 |
| 小标题 | Noto Sans SC | 15px | 700 |
| 正文 | Noto Sans SC | 13px | 400 |
| 辅助文字 | Noto Sans SC | 12px | 400 |
| 数字/代码 | JetBrains Mono | 14-22px | 600 |
| 技能名 | Space Grotesk | 13.5px | 700 |

### 5.5 触摸/点击反馈

| 元素 | hover | active |
|------|-------|--------|
| 主按钮 | brightness(1.1), translateY(-1px) | translateY(0) |
| Ghost 按钮 | border-color 变亮, 文字变亮 | opacity: 0.8 |
| 卡片 | background 变亮 | — |
| 关闭按钮 | background: rgba(255,255,255,0.05) | — |

### 5.6 滚动提示

Screen 5 的"向下滑动查看全部能力 ↓":
- 首屏底部居中, pill 样式
- ↓ 箭头 bounceDown 动画 (1.5s infinite)
- 用户滚动超过 60px 后: `opacity → 0, transition 300ms`, 不再显示
- 监听 `scroll` 事件, `{ passive: true }`

---

## 六、技术架构

### 6.1 现有技术栈

| 层 | 技术 |
|----|------|
| UI 框架 | **Lit** (LitElement + Web Components) |
| UI ↔ 后端 | **WebSocket** JSON-RPC via `GatewayBrowserClient` |
| 后端 | **Node.js** Gateway Server |
| Skill 元数据 | `skills/*/SKILL.md` frontmatter YAML + JSON metadata |
| Skill 安装 | `skills.install` RPC → 调用 brew/npm/go/download |
| 状态管理 | Lit reactive properties + controller pattern |

### 6.2 新增模块

```
┌────────────────────────────────────────────────────┐
│                     UI (Lit)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ Banner   │  │ Modal    │  │ Progress/Result  │ │
│  │ Component│→ │ Component│→ │ Component        │ │
│  └──────────┘  └──────────┘  └──────┬───────────┘ │
│                                      │ WebSocket   │
├──────────────────────────────────────┼─────────────┤
│                   Gateway Server     │             │
│  ┌──────────────────────────────┐    │             │
│  │ skills.batch-install  (NEW)  │◄───┘             │
│  │ skills.batch-progress (NEW)  │                  │
│  │ skills.batch-cancel   (NEW)  │                  │
│  │ skills.report-failure (NEW)  │                  │
│  │ skills.disk-check     (NEW)  │                  │
│  └──────────┬───────────────────┘                  │
│             │                                       │
│  ┌──────────▼───────────────────┐                  │
│  │    MirrorDownloadEngine      │ ← NEW            │
│  │  ┌─────────────────────────┐ │                  │
│  │  │ mirrors-manifest.json   │ │                  │
│  │  │ (镜像源 + 版本 + SHA256) │ │                  │
│  │  └─────────────────────────┘ │                  │
│  │  ┌─────────────────────────┐ │                  │
│  │  │ ConcurrentDownloader    │ │                  │
│  │  │ (3 并发 + 断点续传)      │ │                  │
│  │  └─────────────────────────┘ │                  │
│  │  ┌─────────────────────────┐ │                  │
│  │  │ MirrorSelector          │ │                  │
│  │  │ (3 源回退 + 测速)        │ │                  │
│  │  └─────────────────────────┘ │                  │
│  │  ┌─────────────────────────┐ │                  │
│  │  │ IntegrityVerifier       │ │                  │
│  │  │ (SHA256 校验)           │ │                  │
│  │  └─────────────────────────┘ │                  │
│  │  ┌─────────────────────────┐ │                  │
│  │  │ FailureReporter         │ │                  │
│  │  │ (批量上报 TecbinAI)      │ │                  │
│  │  └─────────────────────────┘ │                  │
│  └──────────────────────────────┘                  │
└────────────────────────────────────────────────────┘
```

### 6.3 MirrorDownloadEngine 工作流

```
输入: 待安装 Skill 列表
        │
        ▼
[1] 加载 mirrors-manifest.json
        │
        ▼
[2] 按 install.method 分组:
    ├─ go → 设置 GOPROXY 环境变量 (3 源逗号分隔), 执行 go install
    ├─ npm → 设置 NPM_CONFIG_REGISTRY (先 ping 选最快), 执行 npm install -g
    ├─ pypi → 设置 PIP_INDEX_URL (先 ping 选最快), 执行 uv pip install
    └─ github_release → 进入 ConcurrentDownloader
        │
        ▼
[3] ConcurrentDownloader (仅 github_release 类型):
    ├─ 信号量控制并发数 = 3
    ├─ 对每个文件:
    │   ├─ 尝试 mirror[0] → 失败 → mirror[1] → 失败 → mirror[2] → 失败 → fallback
    │   ├─ 支持 Range header 断点续传
    │   ├─ 下载完成 → SHA256 校验
    │   │   ├─ 通过 → 解压/安装 → 标记成功
    │   │   └─ 失败 → 删除文件 → 切下一个镜像
    │   └─ 实时推送进度 (WebSocket event)
    └─ 全部完成 → 汇总结果
        │
        ▼
[4] 结果汇总: { succeeded: [...], failed: [...], duration_ms }
```

### 6.4 镜像选择算法

```typescript
class MirrorSelector {
  // 启动时做一轮 ping 测速 (并行, 5s 超时)
  async warmup(sources: MirrorSource[]): Promise<MirrorSource[]> {
    const results = await Promise.all(
      sources.map(async (s) => {
        const start = Date.now();
        try {
          await fetch(s.url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
          return { ...s, latency: Date.now() - start, alive: true };
        } catch {
          return { ...s, latency: Infinity, alive: false };
        }
      })
    );
    // 按延迟排序, 死掉的放最后
    return results
      .filter(r => r.alive)
      .sort((a, b) => a.latency - b.latency);
  }

  // 下载时的回退逻辑
  async downloadWithFallback(
    mirrors: MirrorSource[],
    buildUrl: (mirror: MirrorSource) => string,
    opts: DownloadOptions,
  ): Promise<DownloadResult> {
    for (const mirror of mirrors) {
      try {
        const result = await this.download(buildUrl(mirror), opts);
        return { ...result, mirror: mirror.name };
      } catch (err) {
        this.reportMirrorFailure(mirror, err);
        continue; // 切下一个
      }
    }
    throw new AllMirrorsFailedError(mirrors);
  }
}
```

### 6.5 断点续传

```typescript
async function downloadWithResume(url: string, destPath: string): Promise<void> {
  let startByte = 0;
  // 检查本地已有的部分文件
  if (existsSync(destPath + '.partial')) {
    const stat = statSync(destPath + '.partial');
    startByte = stat.size;
  }

  const headers: Record<string, string> = {};
  if (startByte > 0) {
    headers['Range'] = `bytes=${startByte}-`;
  }

  const response = await fetch(url, { headers });

  if (response.status === 206) {
    // 续传 — append 到 partial 文件
    await appendToFile(destPath + '.partial', response.body);
  } else if (response.status === 200) {
    // 从头下载
    await writeToFile(destPath + '.partial', response.body);
  }

  // 下载完成 → 重命名
  renameSync(destPath + '.partial', destPath);
}
```

### 6.6 进度推送协议

Gateway → UI 的 WebSocket 事件:

```typescript
// 单个 Skill 进度更新
type SkillProgressEvent = {
  type: 'skill.progress';
  skill: string;
  stage: 'queued' | 'downloading' | 'retrying' | 'verifying' | 'installing' | 'done' | 'failed';
  percent?: number;        // 0-100
  bytes_downloaded?: number;
  bytes_total?: number;
  speed_bps?: number;      // bytes per second
  mirror?: string;         // 当前使用的镜像名
  error?: string;          // 失败原因
  retry_mirror?: string;   // 切换到的镜像名
};

// 总体进度更新
type BatchProgressEvent = {
  type: 'batch.progress';
  completed: number;
  total: number;
  bytes_downloaded: number;
  bytes_total: number;
  speed_bps: number;
  active_mirror?: string;
  active_mirror_latency_ms?: number;
};

// 批量完成
type BatchCompleteEvent = {
  type: 'batch.complete';
  succeeded: string[];
  failed: { skill: string; error: string; mirrors_tried: string[] }[];
  duration_ms: number;
};
```

---

## 七、数据结构设计

### 7.1 mirrors-manifest.json

完整 schema 见 `docs/skills-china-mirrors.md` 第四节。

核心字段:

```typescript
type MirrorsManifest = {
  version: string;
  updated: string; // ISO 8601
  mirrors: Record<InstallMethod, {
    env?: string;
    sources: { name: string; url: string; region: string }[];
    fallback: string | null;
  }>;
  download: {
    concurrency: number;      // 默认 3
    timeout_per_file_ms: number;
    retry_count: number;
    bandwidth_limit_percent: number;
    resume_support: boolean;
    verify: 'sha256' | 'md5' | 'none';
  };
  skills: Record<string, SkillManifestEntry>;
  system_deps: Record<string, SystemDepEntry>;
  telemetry: {
    report_url: string;
    enabled: boolean;
    fields: string[];
  };
};
```

### 7.2 本地安装状态

```typescript
// 存储在 ~/.openclawcn/skills-install-state.json
type SkillsInstallState = {
  version: string;
  installed: Record<string, {
    version: string;
    installed_at: string;
    method: string;
    mirror_used: string;
    sha256: string;
    size_bytes: number;
  }>;
  partial: Record<string, {
    bytes_downloaded: number;
    bytes_total: number;
    partial_path: string;
    started_at: string;
  }>;
  banner_dismissed_at?: string;
  last_batch_install_at?: string;
};
```

### 7.3 UI 状态 (Lit reactive)

```typescript
// 新增到 app 的 reactive state
type SkillsBatchState = {
  batchPhase: 'idle' | 'banner' | 'confirm' | 'downloading' | 'result' | 'complete';
  batchSkills: SkillBatchItem[];
  batchProgress: {
    completed: number;
    total: number;
    bytesDownloaded: number;
    bytesTotal: number;
    speedBps: number;
    activeMirror?: string;
    activeMirrorLatency?: number;
  };
  batchResult?: {
    succeeded: string[];
    failed: FailedSkillItem[];
    durationMs: number;
  };
  reportSent: boolean;
};

type SkillBatchItem = {
  name: string;
  icon: string;
  status: 'queued' | 'downloading' | 'retrying' | 'verifying' | 'done' | 'failed';
  progress?: number;
  bytesDownloaded?: number;
  bytesTotal?: number;
  detail?: string;
  mirror?: string;
  retryMirror?: string;
  error?: string;
};

type FailedSkillItem = {
  name: string;
  icon: string;
  error: string;
  mirrorsTried: { name: string; error: string }[];
};
```

---

## 八、API 设计

### 8.1 新增 Gateway RPC 方法

#### `skills.batch-check`

检查哪些 Skill 需要安装。

```typescript
// Request
{ method: 'skills.batch-check' }

// Response
{
  missing: {
    name: string;
    icon: string;
    category: string;
    size_bytes: number;
    method: string; // 'go' | 'npm' | 'github_release' | 'pypi'
  }[];
  total_size_bytes: number;
  estimated_seconds: number; // 基于默认 3MB/s 估算
  disk_available_bytes: number;
  disk_ok: boolean;
}
```

#### `skills.batch-install`

启动批量安装。

```typescript
// Request
{ method: 'skills.batch-install', params: { skills?: string[] } }
// skills 为空 = 安装全部缺失项

// Response (立即返回, 后续通过 WebSocket event 推送进度)
{ ok: true, batch_id: string }
```

#### `skills.batch-cancel`

取消正在进行的批量安装。

```typescript
// Request
{ method: 'skills.batch-cancel', params: { batch_id: string } }

// Response
{ ok: true, completed: string[], cancelled: string[] }
```

#### `skills.report-failures`

上报失败信息。

```typescript
// Request
{
  method: 'skills.report-failures',
  params: {
    failures: { skill: string; mirrors_tried: { name: string; error: string }[] }[];
    succeeded_count: number;
    total_count: number;
    duration_ms: number;
  }
}

// Response
{ ok: true, ticket_id?: string }
```

### 8.2 新增 WebSocket Events

| Event Type | 方向 | 说明 |
|-----------|------|------|
| `skill.progress` | Server → UI | 单个 Skill 进度更新 |
| `batch.progress` | Server → UI | 总体进度更新 (1s 频率) |
| `batch.complete` | Server → UI | 批量安装完成 |
| `batch.mirror-switch` | Server → UI | 镜像切换通知 |

---

## 九、错误处理与边界情况

### 9.1 错误分类与处理

| 错误类型 | 原因 | UI 表现 | 处理方式 |
|---------|------|---------|---------|
| 网络超时 | 镜像无响应 | 黄色"切换中" | 自动切下一个镜像 |
| HTTP 4xx | 资源不存在 | 红色"失败" | 切镜像; 3 源全 4xx → 上报 |
| HTTP 5xx | 镜像服务器错误 | 黄色"切换中" | 切镜像 |
| SHA256 不匹配 | 文件损坏/被篡改 | 红色"校验失败" | 删除文件, 切镜像重下 |
| 磁盘空间不足 | 磁盘满 | 弹窗警告 | 阻止安装, 提示清理空间 |
| 权限不足 | 无写入权限 | 红色"权限错误" | 提示以管理员身份运行 |
| 用户取消 | 主动取消 | 回到 Chat | 保留已下载文件 |
| 页面关闭 | 关闭浏览器 | — | 后台继续下载; 下次续传 |
| manifest 加载失败 | manifest 文件不可达 | 弹窗错误 | 使用本地内置 fallback 版本 |

### 9.2 边界场景

| 场景 | 处理 |
|------|------|
| **安装到一半断网** | 已完成的保留; 进行中的标记 partial; 下次续传 |
| **同时打开两个浏览器标签** | 第二个标签检测到 batch 正在进行, 显示只读进度 |
| **manifest 版本落后** | 启动时检查 manifest 版本, 如有新版自动更新 |
| **安装过程中 Gateway 重启** | 重启后恢复 install state; UI 重连后同步状态 |
| **0 个缺失技能** | 不显示横幅; 如果用户手动触发, 提示"全部已安装" |
| **所有 18 个全部失败** | Screen 4 标题变为"安装遇到问题"; 突出"一键上报"和"重试" |
| **macOS 专属技能在 Windows 上** | 自动跳过, 不计入失败数; 统计栏只显示适用当前平台的数量 |
| **用户多次点击安装按钮** | 第一次点击后按钮 disable; 进入 downloading 状态 |

### 9.3 安全考虑

| 风险 | 对策 |
|------|------|
| 中间人攻击 (MITM) | HTTPS + SHA256 双重校验 |
| 镜像投毒 | 所有文件 SHA256 校验, 值来自官方 manifest |
| manifest 被篡改 | manifest 自身做签名校验 (HMAC / 公钥验签) |
| 上报信息泄露 | 上报走 HTTPS; 不含个人信息; 用户可选择不上报 |
| 二进制文件执行风险 | 安装后做 checksum 二次确认; 可选签名验证 |

---

## 十、UI/UX 专家评审

### 10.1 评审结论: 通过 ✓ (附 8 条改进建议)

#### 优点

1. **流程清晰** — 5 个屏幕线性递进, 用户始终知道自己在哪一步
2. **非侵入式入口** — Banner 在 Chat 流中, 不阻塞首次使用
3. **透明度高** — 镜像源、速度、进度全部可见, 用户有安全感
4. **失败处理闭环** — 失败→查看原因→上报→重试→继续使用, 不卡死

#### 改进建议

| # | 问题 | 建议 | 优先级 |
|---|------|------|--------|
| UX-1 | Screen 3 下载列表可能很长 (18 项), 已完成的占大量空间 | 已完成项自动折叠: 显示 "✓ 已完成 12/18" 一行, 可展开查看 | P1 |
| UX-2 | Screen 1 横幅在移动端可能过高, 挤压 Chat 空间 | 移动端横幅改为底部 sheet 样式, 或缩减为单行提示 + 展开 | P1 |
| UX-3 | 没有安装中的声音/触觉反馈 | 安装完成时播放短促音效 (可选, 默认关闭) | P3 |
| UX-4 | Screen 4 成功项 pill 超过 8 个时一屏放不下 | 默认折叠, "显示全部 ▾" 展开 | P2 |
| UX-5 | 确认弹窗没有展示具体技能列表, 用户不知道装什么 | 增加"查看详情 ▾"展开, 显示所有技能名 + 一行描述 | P2 |
| UX-6 | 下载速度 0 时没有特殊处理 | 速度为 0 超过 10s → 显示"网络似乎卡住了, 尝试切换镜像..." | P1 |
| UX-7 | 没有进度通知 (如果用户切到别的标签) | 安装完成时用 `Notification API` 发一条系统通知 | P2 |
| UX-8 | Screen 5 滚动提示只在首次显示 | 如果用户从 Screen 4 的"继续使用"进来, 也应该显示 | P3 |

### 10.2 无障碍 (Accessibility)

| 项目 | 当前状态 | 建议 |
|------|---------|------|
| 键盘导航 | 缺失 | 所有按钮需要 `tabindex`, 弹窗需要焦点陷阱 |
| 屏幕阅读器 | 缺失 | 进度条需要 `role="progressbar"` + `aria-valuenow` |
| 色彩对比度 | 部分不足 | `#4a4e63` 在 `#07080d` 上对比度仅 3.1:1, 需提升至 4.5:1 |
| 动画偏好 | 缺失 | 需支持 `prefers-reduced-motion`, 关闭 confetti 和入场动画 |

---

## 十一、技术专家评审

### 11.1 评审结论: 可行 ✓ (附 9 条技术风险和建议)

#### 可行性确认

| 模块 | 可行性 | 现有基础 |
|------|--------|---------|
| UI 5 个屏幕 | ✅ 完全可行 | Lit 组件, 已有 Skills 页面模板 |
| WebSocket 进度推送 | ✅ 完全可行 | 已有 `GatewayBrowserClient` + event 机制 |
| 并发下载引擎 | ✅ 可行 | Node.js `fetch` + `Promise.all` + semaphore |
| 镜像回退 | ✅ 可行 | 简单的 for 循环 try-catch |
| SHA256 校验 | ✅ 可行 | Node.js `crypto.createHash('sha256')` |
| 断点续传 | ✅ 可行 | `Range` header + `.partial` 文件 |
| 失败上报 | ✅ 可行 | HTTP POST 到 TecbinAI API |
| manifest 管理 | ✅ 可行 | JSON 文件, 内置 + 远程更新 |

#### 技术风险与建议

| # | 风险 | 影响 | 建议 | 优先级 |
|---|------|------|------|--------|
| T-1 | `go install` 可能需要本地 Go 环境 | Windows 用户可能没装 Go | 对 Go 工具改用预编译二进制下载 (同 brew 方案), 不依赖 go install | P0 |
| T-2 | npm install -g 需要 Node.js 环境 | 如果用户没装 Node | OpenClawCN 自带 Node runtime; 或改用 npx 下载预打包版本 | P1 |
| T-3 | GitHub 代理镜像稳定性不可控 | 公共代理可能随时挂 | manifest 需要远程热更新能力, TecbinAI 能快速替换挂掉的镜像 | P0 |
| T-4 | 3 并发可能触发镜像限速 | 被 429 Too Many Requests | 实现指数退避 (exponential backoff): 1s→2s→4s; 动态降并发 | P1 |
| T-5 | SHA256 值需要持续维护 | 上游版本更新后 SHA256 变化 | 实现自动化 CI: 定期检查上游版本, 自动更新 manifest 中的 hash | P1 |
| T-6 | `.partial` 文件可能占用大量磁盘 | 中断后残留文件 | 实现清理机制: 超过 7 天的 partial 文件自动删除 | P2 |
| T-7 | Gateway 重启时 batch install 状态丢失 | 进度丢失 | install state 持久化到 `skills-install-state.json`, 重启后恢复 | P1 |
| T-8 | `Notification API` 需要浏览器权限 | 用户可能拒绝 | 降级: 如果权限被拒, 改用页面标题闪烁 `[✓ 安装完成] OpenClawCN` | P3 |
| T-9 | 中国 HTTPS 证书验证可能有 SNI 问题 | 部分镜像 TLS 握手失败 | 连接时设置较长的 TLS 超时 (10s), 失败后立即切镜像 | P2 |

### 11.2 性能预估

| 场景 | 预估 |
|------|------|
| 18 个 Skill 全量安装 (100Mbps) | 20~40 秒 |
| 18 个 Skill 全量安装 (10Mbps) | 90~180 秒 |
| 2 个增量安装 | 3~10 秒 |
| manifest 加载 | < 200ms (内置) / < 1s (远程) |
| 镜像 warmup 测速 | < 3s (并行 ping) |

### 11.3 开发工作量预估

| 模块 | 工作量 | 依赖 |
|------|--------|------|
| mirrors-manifest.json 编写 | 1 天 | 需要每个 Skill 的精确版本号和 SHA256 |
| MirrorDownloadEngine | 2~3 天 | Node.js, 需要测试断点续传和并发 |
| Gateway RPC 新增 4 个方法 | 1 天 | 基于现有 skills.install 扩展 |
| UI Screen 1 (Banner) | 0.5 天 | Lit 组件 |
| UI Screen 2 (Confirm) | 0.5 天 | Lit 组件 + modal |
| UI Screen 3 (Progress) | 1 天 | 最复杂, WebSocket 实时更新 |
| UI Screen 4 (Result) | 0.5 天 | Lit 组件 |
| UI Screen 5 (Complete) | 已完成 | — |
| 上报 API 对接 | 0.5 天 | TecbinAI 后端需配合 |
| 集成测试 | 1~2 天 | 模拟网络环境 |
| **合计** | **8~10 天** | — |

---

## 十二、实施路线图

### Phase 1: 基础设施 (第 1~3 天)

- [ ] 编写完整的 `mirrors-manifest.json` (含所有 Skill 的版本 + SHA256)
- [ ] 实现 `MirrorDownloadEngine` 核心模块
  - [ ] `MirrorSelector` — 测速 + 3 源回退
  - [ ] `ConcurrentDownloader` — 3 并发 + 断点续传
  - [ ] `IntegrityVerifier` — SHA256 校验
- [ ] 实现 `skills-install-state.json` 持久化

### Phase 2: Gateway API (第 3~4 天)

- [ ] 实现 `skills.batch-check` RPC
- [ ] 实现 `skills.batch-install` RPC (触发 + WebSocket 推送)
- [ ] 实现 `skills.batch-cancel` RPC
- [ ] 实现 `skills.report-failures` RPC
- [ ] 单元测试

### Phase 3: UI 组件 (第 4~6 天)

- [ ] `<skills-batch-banner>` — Screen 1
- [ ] `<skills-batch-confirm>` — Screen 2 (modal)
- [ ] `<skills-batch-progress>` — Screen 3
- [ ] `<skills-batch-result>` — Screen 4
- [ ] 集成 Screen 5 (已有)
- [ ] 转场动画 + 状态管理

### Phase 4: 联调 + 测试 (第 6~8 天)

- [ ] UI ↔ Gateway 联调
- [ ] 模拟慢网络测试 (tc 限速)
- [ ] 模拟镜像故障测试
- [ ] 断点续传测试
- [ ] 跨平台测试 (Windows / macOS / Linux)
- [ ] 上报功能对接 TecbinAI 后端

### Phase 5: 优化 + 发布 (第 8~10 天)

- [ ] 性能优化 (减少不必要的 re-render)
- [ ] 无障碍改进 (keyboard, aria, contrast)
- [ ] `prefers-reduced-motion` 支持
- [ ] manifest 远程热更新机制
- [ ] CI 自动更新 manifest SHA256
- [ ] 发布

---

## 附录

### A. 文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `ui/1-chat-banner.html` | UI 原型 | Screen 1 |
| `ui/2-download-confirm.html` | UI 原型 | Screen 2 |
| `ui/3-download-progress.html` | UI 原型 | Screen 3 |
| `ui/4-download-result.html` | UI 原型 | Screen 4 |
| `ui/skills-complete.html` | UI 原型 | Screen 5 |
| `docs/skills-china-mirrors.md` | 技术文档 | 镜像源测速 + manifest schema |
| `docs/prd-skills-download-flow.md` | PRD | 本文档 |

### B. 镜像源速度排名

详见 `docs/skills-china-mirrors.md`

### C. 术语表

| 术语 | 说明 |
|------|------|
| Skill | OpenClawCN 的一个能力模块, 依赖外部工具 |
| Mirror | 中国国内镜像源, 代理海外资源 |
| Fallback | 镜像失败后的直连回退 |
| Partial | 下载中断后的部分文件 (用于断点续传) |
| Manifest | 记录所有 Skill 版本、SHA256、镜像源的配置文件 |
| Warmup | 启动时的镜像测速过程 |
| Batch Install | 批量安装模式 (相对于逐个安装) |
