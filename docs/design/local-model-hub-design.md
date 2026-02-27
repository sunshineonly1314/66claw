# 本地模型智能下载中心 — 完整设计方案

## 一、设计目标

在现有模型设置页面的能力卡片内，通过 **Tab 切换** 将"在线模型"和"本地模型"融为统一体验。用户点击任意能力卡展开后，看到 `在线` / `本地` 两个 Tab，根据硬件条件智能推荐本地模型并提供一键安装。

## 二、当前页面结构 vs 改后结构

### 改前

```
┌ 能力卡片 2x3 grid ──────────────────────┐
│  聊天  编程  图片  视频  听说  记忆        │
│  [点击展开] → 在线模型列表 (quick-switch)  │
└──────────────────────────────────────────┘
────── <hr> ──────
已配置的服务商 (拖拽排序)
添加更多服务商 (按分组折叠)
```

### 改后

```
┌ 能力卡片 2x3 grid ──────────────────────┐
│  聊天  编程  图片  视频  听说  记忆        │
│  [点击展开] →                              │
│    ┌──────────────────────────────┐       │
│    │  [在线]  [本地]    ← Tab 切换 │       │
│    ├──────────────────────────────┤       │
│    │  (Tab 内容区)                 │       │
│    └──────────────────────────────┘       │
└──────────────────────────────────────────┘
────── 我的设备 ─────── (替换原 <hr>)
  RTX 4060 · 8GB VRAM · 32GB RAM
  [管理本地模型] [重新检测]
────────────────────────
已配置的服务商
添加更多服务商
```

## 三、能力卡 Tab 详细设计

### 3.1 Tab 交互规则

| 场景 | 默认 Tab | 说明 |
|------|---------|------|
| 有已配置的在线模型 | `在线` | 大多数用户走在线 |
| 无在线模型，有可安装的本地模型 | `本地` | 引导发现本地选项 |
| 无在线也无本地 | `在线` | 引导去添加服务商 |

Tab 状态存储在组件 state 中（`_quickSwitchTab: "online" | "local"`），不持久化。

### 3.2 在线 Tab（复用现有 quick-switch）

完全复用现有 `_renderQuickSwitch()` 逻辑，无需改动。

### 3.3 本地 Tab — 分能力视图

#### 3.3.1 单能力卡（聊天、编程、记忆）

聊天/编程/记忆目前没有本地模型支持，本地 Tab 显示：

```
┌────────────────────────────────────────┐
│  暂无可用的本地模型                      │
│  这些能力目前仅支持在线 API 服务         │
│  [切换到在线 Tab]                       │
└────────────────────────────────────────┘
```

> 未来接入 Ollama 后，聊天/编程卡的本地 Tab 可以列出 Ollama 可拉取的模型。

#### 3.3.2 听说卡（voice: audio + tts）

```
┌──────────────────────────────────────────────────┐
│  [在线]  [本地]                                    │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌─ 你的硬件 ─────────────────────────────────┐   │
│  │  RTX 4060 · 8GB VRAM → GPU 全能模式         │   │
│  └────────────────────────────────────────────┘   │
│                                                  │
│  ── 语音识别 (ASR) ──                             │
│  ┌────────────────────────────────────────────┐   │
│  │  ★ Qwen3-ASR 0.6B         GPU              │   │
│  │    实时流式 · 中英混合 · 延迟<200ms          │   │
│  │    ~1.8GB 下载 · ~3GB 显存                  │   │
│  │    [● 已安装 · 运行中]              [切换]   │   │
│  ├────────────────────────────────────────────┤   │
│  │    SenseVoice Small        CPU              │   │
│  │    离线可用 · 中英日韩 · 较慢                │   │
│  │    ~229MB 下载 · ~450MB 内存                │   │
│  │    [○ 未安装]                    [安装]      │   │
│  └────────────────────────────────────────────┘   │
│                                                  │
│  ── 语音合成 (TTS) ──                             │
│  ┌────────────────────────────────────────────┐   │
│  │  ★ Qwen3-TTS 0.6B         GPU              │   │
│  │    多音色 · 多语言 · 流式输出                │   │
│  │    ~2.4GB 下载 · ~2.8GB 显存                │   │
│  │    [○ 未安装]                    [安装]      │   │
│  ├────────────────────────────────────────────┤   │
│  │    Kokoro TTS 82M          CPU              │   │
│  │    离线可用 · 轻量 · 中英                    │   │
│  │    ~86MB 下载 · ~1.4GB 内存                 │   │
│  │    [○ 未安装]                    [安装]      │   │
│  ├────────────────────────────────────────────┤   │
│  │    Edge TTS                在线(免费)        │   │
│  │    微软在线语音 · 零资源占用                  │   │
│  │    [已启用]                      [切换]      │   │
│  └────────────────────────────────────────────┘   │
│                                                  │
│  ── 快捷操作 ──                                   │
│  推荐安装: Qwen3-ASR + Qwen3-TTS = 4.2GB         │
│  [一键安装推荐方案]                                │
│                                                  │
└──────────────────────────────────────────────────┘
```

#### 3.3.3 图片卡（image: vision + imageGen）

```
┌──────────────────────────────────────────────────┐
│  [在线]  [本地]                                    │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌─ 你的硬件 ─────────────────────────────────┐   │
│  │  RTX 4060 · 8GB VRAM → GPU 高质量模式       │   │
│  └────────────────────────────────────────────┘   │
│                                                  │
│  ── 图像生成 (ImageGen) ──                        │
│  ┌────────────────────────────────────────────┐   │
│  │  ★ SDXL Base 1.0            GPU             │   │
│  │    1024x1024 · 高质量 · ~10秒/张             │   │
│  │    ~6.5GB 下载 · ~3.5GB 显存                │   │
│  │    [○ 未安装]                    [安装]      │   │
│  ├────────────────────────────────────────────┤   │
│  │    SD-Turbo                  GPU             │   │
│  │    512x512 · 极速1步 · ~3秒/张              │   │
│  │    ~3.3GB 下载 · ~1.5GB 显存                │   │
│  │    [○ 未安装]                    [安装]      │   │
│  ├────────────────────────────────────────────┤   │
│  │    SD-Turbo (CPU)            CPU             │   │
│  │    512x512 · ~60秒/张 · 纯离线              │   │
│  │    ~3.3GB 下载 · ~2GB 内存                  │   │
│  │    [○ 未安装]                    [安装]      │   │
│  └────────────────────────────────────────────┘   │
│                                                  │
│  ── 图像理解 (Vision) ──                          │
│  暂无本地模型，请使用在线 API                       │
│  [切换到在线 Tab]                                 │
│                                                  │
└──────────────────────────────────────────────────┘
```

#### 3.3.4 视频卡（video: video + videoGen）

```
┌──────────────────────────────────────────────────┐
│  [在线]  [本地]                                    │
├──────────────────────────────────────────────────┤
│                                                  │
│  本地视频模型需要大量显存 (>16GB)                  │
│  你的 RTX 4060 (8GB) 暂不支持本地视频生成          │
│                                                  │
│  推荐使用在线 API:                                │
│  · 智谱 CogVideoX (已配置)                       │
│  · 火山方舟 视频生成                              │
│  [切换到在线 Tab]  [去配置服务商]                   │
│                                                  │
└──────────────────────────────────────────────────┘
```

### 3.4 本地模型行的状态机

每个模型行有 5 种状态，驱动 UI 渲染：

```
                 ┌─────────┐
                 │ not_available │  硬件不满足
                 └─────────┘
                      │
        (硬件满足)     ▼
              ┌──────────────┐
              │  installable │  可安装（显示 [安装] 按钮）
              └──────────────┘
                      │ 点击安装
                      ▼
              ┌──────────────┐
              │  installing  │  安装中（进度条 + 百分比 + 镜像信息）
              └──────────────┘
                      │ 安装完成
                      ▼
              ┌──────────────┐
              │  installed   │  已安装未运行（[启动] 按钮）
              └──────────────┘
                      │ 启动 sidecar
                      ▼
              ┌──────────────┐
              │  running     │  运行中（绿色状态 + [停止] + [切换到此模型]）
              └──────────────┘
```

### 3.5 安装中的进度渲染

复用现有 `VoiceInstallProgress` / `ImageGenInstallProgress` 类型：

```
┌────────────────────────────────────────────┐
│  Qwen3-ASR 0.6B                           │
│  ████████████░░░░░░░░  62%  1.1GB / 1.8GB │
│  正在下载 model.safetensors (魔搭)         │
│  速度: 23.5 MB/s                           │
│  [取消]                                    │
└────────────────────────────────────────────┘
```

### 3.6 推荐标记逻辑

对于每个能力的本地模型列表，标记 `★` 推荐的规则：

| 条件 | 推荐模型 |
|------|---------|
| NVIDIA GPU + VRAM >= 阈值 | GPU 版本（标 `★ GPU 推荐`） |
| 无 GPU 但 RAM 足够 | CPU 版本（标 `★ CPU 推荐`） |
| 硬件不足 | 无推荐，所有行标灰 + "硬件不满足" |

推荐排序：`★ 推荐` 在最上面，已安装次之，其余按显存/内存需求升序。

## 四、"我的设备"硬件概览条

替换现有 `<hr class="section-divider" />` 位置。

### 4.1 UI 设计

```
┌──────────────────────────────────────────────────────┐
│  💻 我的设备                                          │
│  NVIDIA RTX 4060 · 8GB VRAM · 32GB RAM · Win11 x64  │
│  本地模型: 1 运行中 · 2 已安装 · 3.4GB 已占用          │
│                                                      │
│  [管理本地模型]  [重新检测硬件]                         │
└──────────────────────────────────────────────────────┘
```

无 GPU 时：
```
│  CPU: Intel i7-12700 · 16核 · 32GB RAM · Win11 x64   │
│  未检测到独立显卡，部分模型将以 CPU 模式运行            │
```

macOS Apple Silicon 时：
```
│  Apple M2 Pro · 16GB 统一内存 · macOS 14.3           │
│  支持 Metal 加速 (GPU 模型可用)                       │
```

### 4.2 "管理本地模型"弹窗

点击 `[管理本地模型]` 打开弹窗（复用现有 `.modal-overlay` + `.modal` CSS 模式）：

```
┌─ 本地模型管理 ──────────────────────────────────────┐
│                                                     │
│  安装路径: E:\openclawcn\models                      │
│  磁盘空间: 已用 3.4GB / 可用 142GB                   │
│                                                     │
│  ── 运行中 ──────────────────────────────────────    │
│  ┌──────────────────────────────────────────────┐   │
│  │ Qwen3-ASR 0.6B   GPU   1.8GB  3.0GB VRAM    │   │
│  │                         [停止]  [卸载]        │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  ── 已停止 ──────────────────────────────────────    │
│  ┌──────────────────────────────────────────────┐   │
│  │ SenseVoice Small  CPU   229MB  450MB RAM     │   │
│  │                         [启动]  [卸载]        │   │
│  ├──────────────────────────────────────────────┤   │
│  │ Kokoro TTS 82M    CPU    86MB  1.4GB RAM     │   │
│  │                         [启动]  [卸载]        │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  ── 显存占用 ──────────────────────────────────────   │
│  ████████░░░░░░░░░░░░  3.0 / 8.0 GB (37%)          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## 五、数据流设计

### 5.1 前端状态

在 `model-config-view` 组件上新增 state：

```typescript
// Tab 状态
@state() _quickSwitchTab: "online" | "local" = "online";

// 本地模型数据（统一结构）
@state() _localModels: LocalModelUIState | null = null;
@state() _localModelsLoading: boolean = false;

// 硬件信息
@state() _hardware: HardwareSnapshot | null = null;

// 本地模型管理弹窗
@state() _localManageOpen: boolean = false;
```

### 5.2 统一本地模型 UI 类型

```typescript
/** 能力维度的本地模型列表 */
interface LocalCapabilityModels {
  /** 能力维度 key，如 "audio", "tts", "imageGen" */
  capability: string;
  /** 能力中文名 */
  label: string;
  /** 该能力下的本地模型 */
  models: LocalModelItem[];
}

/** 单个本地模型的 UI 状态 */
interface LocalModelItem {
  id: string;
  displayName: string;
  /** "gpu" | "cpu" | "online" (如 Edge TTS) */
  runMode: "gpu" | "cpu" | "online";
  /** 是否为推荐 */
  recommended: boolean;
  /** 简介描述 */
  description: string;
  /** 下载大小 (MB) */
  downloadSizeMB: number;
  /** 运行时内存/显存占用 (MB) */
  runtimeMemoryMB: number;
  /** 模型状态 */
  status: "not_available" | "installable" | "installing" | "installed" | "running";
  /** 安装进度 (仅 installing 状态) */
  installProgress?: {
    percent: number;
    message: string;
    detail?: string;
    mirror?: string;
    speed?: string;
  };
  /** 不可用原因 (仅 not_available 状态) */
  unavailableReason?: string;
}

/** 汇总到 UserCapability 维度的本地模型 */
interface LocalModelUIState {
  hardware: HardwareSnapshot;
  /** 按 UserCapability 分组的本地模型 */
  capModels: Record<string, LocalCapabilityModels[]>;
  /** 汇总统计 */
  summary: {
    runningCount: number;
    installedCount: number;
    totalDiskUsageMB: number;
  };
}
```

### 5.3 Gateway RPC 新增

```
local_engine.status   → 返回所有本地模型状态 + 硬件信息 + 汇总统计
local_engine.install  → 安装指定模型，流式返回进度
local_engine.uninstall → 卸载指定模型
local_engine.start    → 启动指定模型 sidecar
local_engine.stop     → 停止指定模型 sidecar
local_engine.hardware → 返回硬件检测结果（复用现有 getHardwareSnapshot）
```

`local_engine.status` 内部聚合现有的：
- `getVoiceSystemStatus()` → ASR/TTS 模型状态
- `getImageGenSystemStatus()` → ImageGen 模型状态
- `getHardwareSnapshot()` → 硬件信息

不新建独立系统，而是做一个聚合层。

### 5.4 前端 Controller

```
ui/src/ui/controllers/local-engine.ts
```

纯函数模块，导出：

```typescript
export function createInitialLocalModelState(): LocalModelUIState;
export async function loadLocalModelStatus(host: LocalEngineHost): Promise<void>;
export async function installLocalModel(host: LocalEngineHost, modelId: string): Promise<void>;
export async function uninstallLocalModel(host: LocalEngineHost, modelId: string): Promise<void>;
export async function startLocalModel(host: LocalEngineHost, modelId: string): Promise<void>;
export async function stopLocalModel(host: LocalEngineHost, modelId: string): Promise<void>;
export function handleLocalInstallProgress(state: LocalModelUIState, payload: unknown): void;
```

### 5.5 前端 View

```
ui/src/ui/views/local-model-tab.ts
```

纯渲染函数（不是 Web Component），导出：

```typescript
/** 能力卡展开后的本地 Tab 内容 */
export function renderLocalModelTab(props: {
  userCap: UserCapability;
  hardware: HardwareSnapshot | null;
  capModels: LocalCapabilityModels[];
  loading: boolean;
  onInstall: (modelId: string) => void;
  onStart: (modelId: string) => void;
  onStop: (modelId: string) => void;
  onSwitchToOnline: () => void;
}): TemplateResult;

/** "我的设备"概览条 */
export function renderDeviceBar(props: {
  hardware: HardwareSnapshot | null;
  summary: LocalModelUIState["summary"];
  onManage: () => void;
  onRedetect: () => void;
}): TemplateResult;

/** "管理本地模型"弹窗 */
export function renderLocalManageModal(props: {
  state: LocalModelUIState;
  onStart: (modelId: string) => void;
  onStop: (modelId: string) => void;
  onUninstall: (modelId: string) => void;
  onClose: () => void;
}): TemplateResult;
```

## 六、对现有代码的改动清单

### 6.1 前端改动

| 文件 | 改动内容 |
|------|---------|
| `ui/src/ui/views/model-config.ts` | 1. 能力卡展开增加 Tab 切换（在线/本地）<br>2. `_renderQuickSwitch()` 包裹在在线 Tab 内<br>3. 本地 Tab 调用 `renderLocalModelTab()`<br>4. `<hr>` 替换为 `renderDeviceBar()`<br>5. 增加本地管理弹窗渲染<br>6. 新增 state 字段和 handler |
| `ui/src/ui/views/local-model-tab.ts` | **新建** — 本地模型 Tab 渲染函数、设备概览条、管理弹窗 |
| `ui/src/ui/controllers/local-engine.ts` | **新建** — 本地模型 controller |
| `ui/src/ui/views/voice-tier-card.ts` | **不改** — 保留但不再被 model-config 引用（后续可删） |
| `ui/src/ui/views/imagegen-tier-card.ts` | **不改** — 同上 |
| `ui/src/ui/controllers/voice-tier.ts` | **不改** — 被 local-engine controller 内部调用 |
| `ui/src/ui/controllers/imagegen-tier.ts` | **不改** — 被 local-engine controller 内部调用 |

### 6.2 后端改动

| 文件 | 改动内容 |
|------|---------|
| `src/gateway/server-methods/local-engine.ts` | **新建** — 聚合 RPC handler |
| `src/gateway/cn-handlers.ts` | 注册 `localEngineHandlers` |
| `src/voice/hardware-detect.ts` | **不改** — 复用 |
| `src/voice/voice-tier.ts` | **不改** — 复用 |
| `src/voice/voice-models.ts` | **不改** — 复用 |
| `src/voice/voice-install.ts` | **小改** — 导出 `installSingleVoiceModel(modelId, onProgress)` 包装函数 (+50行) |
| `src/voice/gpu-sidecar.ts` | **不改** — 复用 |
| `src/imagegen/imagegen-tier.ts` | **不改** — 复用 |
| `src/imagegen/imagegen-models.ts` | **不改** — 复用 |
| `src/imagegen/imagegen-install.ts` | **小改** — 导出 `installSingleImageGenModel(modelId, onProgress)` 包装函数 (+40行) |
| `src/imagegen/sd-cpp-sidecar.ts` | **不改** — 复用 |

### 6.3 不改动的文件

所有现有的 tier 系统（voice / imagegen）不做任何修改。新建的 `local-engine.ts` 是纯聚合层，调用现有模块的公开 API。

## 七、实现步骤（按依赖关系排序）

### Phase 1: 后端聚合层（不影响现有 UI）

1. **新建 `src/gateway/server-methods/local-engine.ts`**
   - 实现 `local_engine.status` RPC — 聚合 voice/imagegen 状态 + 硬件快照
   - 实现 `local_engine.hardware` RPC — 暴露 `getHardwareSnapshot()`
   - 实现 `local_engine.install` RPC — 根据 modelId 路由到 voice 或 imagegen 安装流程
   - 实现 `local_engine.uninstall` / `start` / `stop` RPC — 路由到对应 sidecar

2. **改动 `src/gateway/cn-handlers.ts`**
   - 导入并注册 `localEngineHandlers`

### Phase 2: 前端 Controller + View（可独立开发）

3. **新建 `ui/src/ui/controllers/local-engine.ts`**
   - 类型定义（`LocalModelUIState`, `LocalModelItem` 等）
   - `loadLocalModelStatus()` — 调用 `local_engine.status`
   - `installLocalModel()` — 调用 `local_engine.install` + 监听 progress event
   - `startLocalModel()` / `stopLocalModel()` — 调用对应 RPC
   - `handleLocalInstallProgress()` — 处理 broadcast 事件更新进度

4. **新建 `ui/src/ui/views/local-model-tab.ts`**
   - `renderLocalModelTab()` — 能力卡内本地 Tab 内容
   - `renderDeviceBar()` — 硬件概览条
   - `renderLocalManageModal()` — 管理弹窗
   - 内联 CSS（跟随 model-config.ts 的 scoped styles 模式）

### Phase 3: 集成到 model-config-view

5. **改动 `ui/src/ui/views/model-config.ts`**
   - import local-engine controller 和 view
   - 增加 state 字段：`_quickSwitchTab`, `_localModels`, `_hardware`, `_localManageOpen`
   - 改造 `_renderCapCard()` — 单能力卡支持 Tab
   - 改造 `_renderMultiCapBody()` — 多能力卡增加 Tab
   - 改造 `_renderQuickSwitch()` — 包裹在"在线" Tab 内
   - 增加 `_renderLocalTab()` — 调用 `renderLocalModelTab()`
   - 替换 `<hr>` 为 `renderDeviceBar()`
   - 增加本地管理弹窗渲染
   - `connectedCallback()` 注册 local install progress event listener
   - `_loadData()` 增加 `loadLocalModelStatus()` 调用

### Phase 4: 优化和扩展

6. macOS Apple Silicon 支持
   - `hardware-detect.ts` 增加 Apple Silicon GPU 检测（Metal）
   - tier 引擎增加 macOS Metal 路径

7. 未来扩展入口
   - Ollama 本地 LLM 接入（聊天/编程卡本地 Tab）
   - 视频生成本地模型（视频卡本地 Tab）
   - 记忆/Embedding 本地模型

## 八、关键设计决策 & 理由

### Q: 为什么用 Tab 而不是混排？

Tab 方式：
- 信息密度可控 — 本地模型行包含下载大小、显存占用、安装按钮、进度条，信息量远大于在线模型行
- 行交互不同 — 在线模型点击即切换，本地模型可能需要安装→启动→切换多步
- 渐进披露 — 不关心本地模型的用户完全不受影响，只看在线 Tab

混排方式的问题：
- 本地模型行（带进度条、启动/停止按钮）和在线模型行视觉差异太大，混在一起显得杂乱
- 状态机复杂度高 — 安装中的模型不能切换，但在线模型可以，混排后按钮逻辑难统一

### Q: 为什么不做独立页面？

- 用户的核心操作流是"选能力 → 选模型"，本地模型是"模型"的一种来源
- 独立页面会割裂"能力"和"模型来源"的关联，用户要在两个页面间切换
- 嵌入 Tab 后，用户在同一个视觉上下文中完成"对比在线 vs 本地 → 决策 → 安装"的全流程

### Q: 硬件概览条为什么放在能力卡和服务商之间？

- 硬件信息是"本地能力"的基础，但不需要反复呈现
- 放在分割线位置：既替代了无意义的 `<hr>`，又提供了关键上下文
- 不放在页面顶部是因为大多数用户主要操作在线模型，硬件信息不是第一关注点

### Q: "一键安装推荐方案"覆盖哪些模型？

根据 tier 判定结果，计算推荐的模型集合：
- Voice: `VoiceTierDecision.asrModel` + `VoiceTierDecision.ttsModel`
- ImageGen: `ImageGenTierDecision.model`
- 排除已安装的和 Edge TTS（无需下载）
- 汇总为一次批量安装操作

### Q: 安装路径？

遵循项目规范：`E:\openclawcn\voice-models\` 和 `E:\openclawcn\imagegen-models\`。
管理弹窗中显示安装路径和磁盘可用空间。

## 九、CSS 策略

本地模型相关的 CSS 全部写在 `local-model-tab.ts` 的渲染函数中作为 inline styles，
或者在 `model-config-view` 的 `static styles = css\`...\`` 中增加对应类名。

新增 CSS 类名前缀统一使用 `lm-`（local-model）：
- `.lm-tab` / `.lm-tab-active` — Tab 按钮
- `.lm-section` — 子能力分组标题
- `.lm-item` / `.lm-item--recommended` — 模型行
- `.lm-progress` — 安装进度条
- `.lm-badge-gpu` / `.lm-badge-cpu` / `.lm-badge-online` — 运行模式标签
- `.lm-status-*` — 状态标记
- `.device-bar` — 硬件概览条
- `.local-manage-*` — 管理弹窗

## 十、审核发现的修正项 (2026-02-25)

### 修正 1: 多能力卡交互模式需要重构

**现状**: 多能力卡（图片/视频/听说）点击子能力行 → 直接弹全屏 Modal 选择器，没有展开面板这一步。
**问题**: 设计方案假设所有卡片都能展开 Tab 面板，但多能力卡没有展开行为。
**修正**: 多能力卡也改为先展开 Tab 面板，子能力行作为面板内的分组标题。"在线" Tab 内子能力行点击仍弹 Modal 选择器，"本地" Tab 内直接渲染模型列表。改动集中在 `_renderCapCard()` 的 `isMultiCap` 分支，约 80-120 行。

### 修正 2: 需要新增单模型安装 API

**现状**: `installVoiceTier()` 和 `installImageGenTier()` 只支持按 tier 整体安装。
**问题**: 设计中每个模型行有独立 `[安装]` 按钮，需要单模型安装能力。
**修正**: voice-install.ts 导出 `installSingleVoiceModel(modelId, onProgress)` (+50行)，imagegen-install.ts 导出 `installSingleImageGenModel(modelId, onProgress)` (+40行)。均复用现有下载函数，不改已有逻辑。

### 修正 3: "一键安装推荐" 需跨系统协调

**现状**: Voice 和 ImageGen 各有独立的 `_installing` lock。
**修正**: `local_engine.install_recommended` 内部串行调度 voice -> imagegen，进度 percent 拆为 0-60 / 60-100。聚合层处理，+30 行。

## 十一、风险和注意事项

1. **显存冲突** — 多个 GPU 模型同时运行可能 OOM。管理弹窗需要显示实时 VRAM 占用条，安装/启动前需要检查剩余 VRAM。

2. **长时间安装** — Qwen3-TTS 2.4GB 在慢网络下可能需要 10+ 分钟。进度条必须显示速度和预计剩余时间，支持断点续传（现有 mirror-download-engine 已支持）。

3. **Sidecar 进程管理** — 用户关闭 UI 后 sidecar 仍在运行。管理弹窗需要明确显示运行状态，"我的设备"概览条要有运行中模型计数。

4. **macOS 差异** — 当前 hardware-detect 仅支持 NVIDIA (nvidia-smi)。macOS Apple Silicon 需要额外的检测路径（`system_profiler SPDisplaysDataType`），Phase 4 处理。

5. **Ollama 集成** — 聊天/编程卡的本地 Tab 目前显示"暂无"，但类型设计已预留扩展。Ollama 模型的安装方式不同（`ollama pull`），需要独立的后端适配。

## 十二、审核结论

**方案可行**。核心架构验证通过：
- 前端能力卡有清晰的 Tab 嵌入点（单能力/多能力两条路径）
- 后端 `getVoiceSystemStatus()` / `getImageGenSystemStatus()` / `getHardwareSnapshot()` 提供全部所需数据
- 下载引擎（mirror rotation + integrity verify + 断点续传）已完整实现
- Gateway broadcast 机制完全兼容
- cn-handlers 注册一行代码

3 个修正项（多能力卡重构、单模型安装 API、跨系统协调）均为局部增量改动，总新增约 170 行后端 + 120 行前端重构。
