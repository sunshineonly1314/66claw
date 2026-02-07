# Clawdbot 前端页面修改方案

> **文档版本**：v1.0  
> **创建日期**：2026-01-30  
> **目标**：优化用户体验，让小白用户也能轻松使用

---

## 一、核心问题分析

### 1.1 当前痛点

| 问题 | 影响 | 优先级 |
|-----|------|--------|
| 用户不知道有审批弹窗 | AI 操作超时被拒绝，用户困惑 | 🔴 高 |
| "白名单"术语太技术 | 用户不理解，无法自行配置 | 🔴 高 |
| 审批通知不够醒目 | 用户可能错过 | 🟡 中 |
| 安全模式说明不够清晰 | 用户不知道选哪个 | 🟡 中 |
| 没有可视化的信任列表管理 | 用户无法方便地管理 | 🟢 低 |

### 1.2 目标用户画像

| 用户类型 | 特点 | 需求 |
|---------|------|------|
| 小白用户 | 不懂技术，只想"一句话让 AI 干活" | 简单、直观、不要问太多 |
| 普通用户 | 有基础电脑知识，希望安全 | 平衡功能和安全 |
| 开发者 | 懂技术，需要完整功能 | 灵活配置，不要限制 |

---

## 二、修改方案总览

### 2.1 需要修改的页面/组件

| 页面/组件 | 文件位置 | 修改内容 |
|----------|---------|---------|
| 配置向导-安全模式选择 | `src/gateway/setup-page.ts` | 优化文案、增加能力说明 |
| 操作审批弹窗 | 新增组件 | 全新设计，更友好 |
| 信任列表管理 | 新增页面 | 可视化管理信任的操作 |
| 控制台首页 | `src/gateway/setup-page.ts` | 增加审批入口提示 |
| 对话界面 | `src/canvas-host/` | 增加等待确认状态 |

### 2.2 修改优先级

```
Phase 1 (紧急): 审批弹窗优化、文案修改
Phase 2 (重要): 信任列表管理界面
Phase 3 (优化): 对话界面状态提示
```

---

## 三、Phase 1: 审批弹窗优化

### 3.1 当前问题

- 审批通知可能不够醒目
- 用户不理解"allow-once"、"allow-always"是什么意思
- 没有倒计时显示

### 3.2 设计方案

#### 3.2.1 审批弹窗 UI 设计

```
┌─────────────────────────────────────────────────────────┐
│  🔔 AI 需要你的确认                              ⏱️ 1:45  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  AI 想要执行：                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │  pip install pandas                              │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  📍 位置：C:\Users\你\Documents\project                 │
│                                                         │
│  💡 这是安装 Python 库的命令，通常是安全的。            │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  ✅ 允许    │  │  ⭐ 信任    │  │  ❌ 拒绝    │     │
│  │  仅这一次   │  │  以后都信任 │  │             │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                                                         │
│  ⏱️ 如果不操作，2分钟后将自动拒绝                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### 3.2.2 代码实现位置

**新增文件**：`src/gateway/components/exec-approval-modal.ts`

```typescript
// 审批弹窗组件
export interface ExecApprovalModalProps {
  id: string;
  command: string;
  cwd?: string;
  expiresAtMs: number;
  onDecision: (decision: 'allow-once' | 'allow-always' | 'deny') => void;
}

export function renderExecApprovalModal(props: ExecApprovalModalProps): string {
  const remainingMs = props.expiresAtMs - Date.now();
  const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  
  return `
    <div class="exec-approval-modal" data-approval-id="${props.id}">
      <div class="modal-header">
        <span class="modal-icon">🔔</span>
        <span class="modal-title">AI 需要你的确认</span>
        <span class="modal-timer" id="timer-${props.id}">${minutes}:${seconds.toString().padStart(2, '0')}</span>
      </div>
      
      <div class="modal-body">
        <div class="command-label">AI 想要执行：</div>
        <div class="command-box">
          <code>${escapeHtml(props.command)}</code>
        </div>
        
        ${props.cwd ? `<div class="command-cwd">📍 位置：${escapeHtml(props.cwd)}</div>` : ''}
        
        <div class="command-hint">
          ${getCommandHint(props.command)}
        </div>
      </div>
      
      <div class="modal-actions">
        <button class="btn btn-allow-once" onclick="resolveApproval('${props.id}', 'allow-once')">
          <span class="btn-icon">✅</span>
          <span class="btn-text">允许</span>
          <span class="btn-hint">仅这一次</span>
        </button>
        
        <button class="btn btn-allow-always" onclick="resolveApproval('${props.id}', 'allow-always')">
          <span class="btn-icon">⭐</span>
          <span class="btn-text">信任</span>
          <span class="btn-hint">以后都信任</span>
        </button>
        
        <button class="btn btn-deny" onclick="resolveApproval('${props.id}', 'deny')">
          <span class="btn-icon">❌</span>
          <span class="btn-text">拒绝</span>
        </button>
      </div>
      
      <div class="modal-footer">
        ⏱️ 如果不操作，${minutes > 0 ? minutes + '分' : ''}${seconds}秒后将自动拒绝
      </div>
    </div>
  `;
}

// 根据命令生成友好的提示
function getCommandHint(command: string): string {
  const cmd = command.toLowerCase().trim();
  
  if (cmd.startsWith('pip install') || cmd.startsWith('pip3 install')) {
    return '💡 这是安装 Python 库的命令，通常是安全的。';
  }
  if (cmd.startsWith('npm install') || cmd.startsWith('pnpm install')) {
    return '💡 这是安装 Node.js 包的命令，通常是安全的。';
  }
  if (cmd.startsWith('git ')) {
    return '💡 这是 Git 版本控制命令。';
  }
  if (cmd.includes('rm ') || cmd.includes('del ') || cmd.includes('delete')) {
    return '⚠️ 这个命令可能会删除文件，请谨慎确认！';
  }
  
  return '💡 请确认这是你想要执行的操作。';
}
```

#### 3.2.3 样式设计

**新增文件**：`src/gateway/styles/exec-approval.css`

```css
.exec-approval-modal {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 400px;
  background: #1e1e2e;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  border: 1px solid #313244;
  z-index: 10000;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.modal-header {
  display: flex;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #313244;
}

.modal-icon {
  font-size: 24px;
  margin-right: 12px;
}

.modal-title {
  flex: 1;
  font-size: 16px;
  font-weight: 600;
  color: #cdd6f4;
}

.modal-timer {
  font-family: monospace;
  font-size: 18px;
  color: #f9e2af;
  background: rgba(249, 226, 175, 0.1);
  padding: 4px 8px;
  border-radius: 6px;
}

.modal-body {
  padding: 16px;
}

.command-label {
  font-size: 14px;
  color: #9399b2;
  margin-bottom: 8px;
}

.command-box {
  background: #11111b;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}

.command-box code {
  font-family: 'Fira Code', monospace;
  font-size: 14px;
  color: #89b4fa;
  word-break: break-all;
}

.command-cwd {
  font-size: 13px;
  color: #9399b2;
  margin-bottom: 12px;
}

.command-hint {
  font-size: 13px;
  color: #a6e3a1;
  padding: 8px 12px;
  background: rgba(166, 227, 161, 0.1);
  border-radius: 6px;
}

.command-hint.warning {
  color: #fab387;
  background: rgba(250, 179, 135, 0.1);
}

.modal-actions {
  display: flex;
  gap: 12px;
  padding: 16px;
  border-top: 1px solid #313244;
}

.modal-actions .btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-allow-once {
  background: rgba(166, 227, 161, 0.1);
  color: #a6e3a1;
}

.btn-allow-once:hover {
  background: rgba(166, 227, 161, 0.2);
}

.btn-allow-always {
  background: rgba(137, 180, 250, 0.1);
  color: #89b4fa;
}

.btn-allow-always:hover {
  background: rgba(137, 180, 250, 0.2);
}

.btn-deny {
  background: rgba(243, 139, 168, 0.1);
  color: #f38ba8;
}

.btn-deny:hover {
  background: rgba(243, 139, 168, 0.2);
}

.btn-icon {
  font-size: 24px;
  margin-bottom: 4px;
}

.btn-text {
  font-size: 14px;
  font-weight: 600;
}

.btn-hint {
  font-size: 11px;
  opacity: 0.7;
  margin-top: 2px;
}

.modal-footer {
  padding: 12px 16px;
  background: rgba(249, 226, 175, 0.05);
  border-radius: 0 0 12px 12px;
  font-size: 12px;
  color: #9399b2;
  text-align: center;
}
```

#### 3.2.4 WebSocket 监听

**修改文件**：`src/gateway/setup-page.ts`

在页面初始化时添加 WebSocket 监听：

```typescript
// 在页面加载时连接 WebSocket
function initApprovalListener() {
  const ws = new WebSocket(`ws://${window.location.host}/ws`);
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.event === 'exec.approval.requested') {
      showApprovalModal(data.payload);
    }
    
    if (data.event === 'exec.approval.resolved') {
      hideApprovalModal(data.payload.id);
    }
  };
  
  ws.onclose = () => {
    // 断线重连
    setTimeout(initApprovalListener, 3000);
  };
}

function showApprovalModal(approval) {
  const container = document.getElementById('approval-container');
  if (!container) return;
  
  const html = renderExecApprovalModal({
    id: approval.id,
    command: approval.request.command,
    cwd: approval.request.cwd,
    expiresAtMs: approval.expiresAtMs,
    onDecision: (decision) => resolveApproval(approval.id, decision)
  });
  
  container.innerHTML = html;
  
  // 启动倒计时
  startCountdown(approval.id, approval.expiresAtMs);
  
  // 播放提示音
  playNotificationSound();
}

function resolveApproval(id, decision) {
  fetch('/api/exec/approval/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, decision })
  });
  
  hideApprovalModal(id);
}

function hideApprovalModal(id) {
  const modal = document.querySelector(`[data-approval-id="${id}"]`);
  if (modal) {
    modal.classList.add('fade-out');
    setTimeout(() => modal.remove(), 300);
  }
}

function startCountdown(id, expiresAtMs) {
  const timerEl = document.getElementById(`timer-${id}`);
  if (!timerEl) return;
  
  const interval = setInterval(() => {
    const remaining = Math.max(0, expiresAtMs - Date.now());
    const seconds = Math.floor(remaining / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    
    timerEl.textContent = `${minutes}:${secs.toString().padStart(2, '0')}`;
    
    // 最后 30 秒变红
    if (seconds <= 30) {
      timerEl.classList.add('urgent');
    }
    
    if (seconds <= 0) {
      clearInterval(interval);
    }
  }, 1000);
}
```

---

## 四、Phase 1: 安全模式选择优化

### 4.1 当前问题

- "完全保护"、"智能保护"、"关闭保护"不够直观
- 用户不知道每个模式能做什么

### 4.2 设计方案

#### 4.2.1 新的安全模式卡片设计

**修改文件**：`src/gateway/setup-page.ts`

```html
<!-- 安全模式选择 - 新设计 -->
<div class="security-options">
  
  <!-- 智能保护（推荐） -->
  <div class="security-card recommended selected" data-security="standard">
    <div class="card-badge">推荐</div>
    <div class="card-icon">🔒</div>
    <div class="card-title">智能模式</div>
    <div class="card-subtitle">平衡功能与安全</div>
    
    <div class="card-abilities">
      <div class="ability-section">
        <div class="ability-title">✅ 可以做</div>
        <ul class="ability-list can-do">
          <li>浏览网页、搜索信息</li>
          <li>读写你指定的文件夹</li>
          <li>运行常用程序（Python、Node等）</li>
          <li>新操作会先问你</li>
        </ul>
      </div>
      <div class="ability-section">
        <div class="ability-title">❌ 不能做</div>
        <ul class="ability-list cannot-do">
          <li>访问其他文件夹</li>
          <li>删除任何文件</li>
          <li>执行危险命令</li>
        </ul>
      </div>
    </div>
    
    <div class="card-footer">
      适合：大多数用户
    </div>
  </div>
  
  <!-- 完全保护 -->
  <div class="security-card" data-security="full">
    <div class="card-icon">🛡️</div>
    <div class="card-title">安全模式</div>
    <div class="card-subtitle">最大程度保护你的电脑</div>
    
    <div class="card-abilities">
      <div class="ability-section">
        <div class="ability-title">✅ 可以做</div>
        <ul class="ability-list can-do">
          <li>浏览网页、搜索信息</li>
          <li>AI 对话、生成内容</li>
          <li>分析你上传的文件</li>
        </ul>
      </div>
      <div class="ability-section">
        <div class="ability-title">❌ 不能做</div>
        <ul class="ability-list cannot-do">
          <li>读写你电脑上的文件</li>
          <li>执行任何系统命令</li>
          <li>安装软件</li>
        </ul>
      </div>
    </div>
    
    <div class="card-footer">
      适合：有重要文件、共用电脑
    </div>
  </div>
  
  <!-- 关闭保护 -->
  <div class="security-card warning" data-security="trust">
    <div class="card-badge warning">需谨慎</div>
    <div class="card-icon">⚡</div>
    <div class="card-title">完全模式</div>
    <div class="card-subtitle">解锁全部功能</div>
    
    <div class="card-abilities">
      <div class="ability-section">
        <div class="ability-title">✅ 可以做</div>
        <ul class="ability-list can-do">
          <li>所有功能，无限制</li>
          <li>读写任何文件</li>
          <li>执行任何命令</li>
          <li>删除文件</li>
        </ul>
      </div>
      <div class="ability-section">
        <div class="ability-title">⚠️ 风险</div>
        <ul class="ability-list warning">
          <li>AI 可能误删文件</li>
          <li>可能被恶意文档利用</li>
          <li>操作无法撤销</li>
        </ul>
      </div>
    </div>
    
    <div class="card-footer warning">
      适合：独立设备、技术高手
    </div>
  </div>
  
</div>
```

#### 4.2.2 选择引导

```html
<!-- 不知道选哪个？ -->
<div class="security-guide">
  <div class="guide-title">
    <span class="material-icons">help_outline</span>
    不知道选哪个？
  </div>
  <div class="guide-items">
    <div class="guide-item" onclick="selectSecurity('standard')">
      <div class="guide-scenario">💻 日常使用</div>
      <div class="guide-arrow">→</div>
      <div class="guide-result">智能模式</div>
    </div>
    <div class="guide-item" onclick="selectSecurity('full')">
      <div class="guide-scenario">🔒 有重要文件</div>
      <div class="guide-arrow">→</div>
      <div class="guide-result">安全模式</div>
    </div>
    <div class="guide-item" onclick="selectSecurity('trust')">
      <div class="guide-scenario">🔧 我是技术人员</div>
      <div class="guide-arrow">→</div>
      <div class="guide-result">完全模式</div>
    </div>
  </div>
</div>
```

---

## 五、Phase 2: 信任列表管理界面

### 5.1 设计目标

让用户可以可视化地管理"已信任的操作"，而不是让他们编辑配置文件。

### 5.2 UI 设计

**新增页面**：`/settings/trusted-operations`

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚙️ 设置 > 已信任的操作                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  💡 已信任的操作可以直接执行，不需要你确认。                     │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  🔍 搜索操作...                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ── 系统默认（46 个） ──────────────────────────────────────    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  📁 Windows 常用                                   [展开] │   │
│  │  notepad, explorer, calc, code, cmd, powershell...      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  🛠️ 开发工具                                       [展开] │   │
│  │  python, node, npm, git, curl...                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ── 你添加的（3 个） ───────────────────────────────────────    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  pip                                              [删除] │   │
│  │  添加于 2026-01-30 14:23                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  conda                                            [删除] │   │
│  │  添加于 2026-01-30 15:01                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ➕ 添加新的信任操作                                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 API 设计

```typescript
// GET /api/settings/trusted-operations
// 获取信任列表
{
  "system": [
    { "name": "notepad", "category": "Windows 常用", "description": "记事本" },
    { "name": "explorer", "category": "Windows 常用", "description": "文件资源管理器" },
    // ...
  ],
  "user": [
    { "name": "pip", "addedAt": "2026-01-30T14:23:00Z" },
    { "name": "conda", "addedAt": "2026-01-30T15:01:00Z" },
  ]
}

// POST /api/settings/trusted-operations
// 添加信任操作
{ "name": "pip" }

// DELETE /api/settings/trusted-operations/:name
// 删除信任操作
```

---

## 六、Phase 3: 对话界面状态提示

### 6.1 设计目标

当 AI 在等待用户确认时，对话界面应该有明确的提示。

### 6.2 UI 设计

在对话界面中添加状态提示：

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  👤 帮我安装 pandas 库                                          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  🤖 好的，我需要运行 pip install pandas 来安装。         │   │
│  │                                                         │   │
│  │  ⏳ 等待你的确认...                                      │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │  pip install pandas                              │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  │                                                         │   │
│  │  👆 请在右上角的弹窗中确认                              │   │
│  │     还剩 1:45                                           │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 七、实施计划

### 7.1 Phase 1（紧急，3 天）

| 任务 | 负责人 | 预计工时 |
|-----|-------|---------|
| 审批弹窗组件开发 | 前端 | 4h |
| 审批弹窗样式 | 前端 | 2h |
| WebSocket 监听 | 前端 | 2h |
| 安全模式卡片优化 | 前端 | 3h |
| 文案修改 | 产品 | 2h |
| 测试 | QA | 4h |

### 7.2 Phase 2（重要，5 天）

| 任务 | 负责人 | 预计工时 |
|-----|-------|---------|
| 信任列表管理页面 | 前端 | 8h |
| 信任列表 API | 后端 | 4h |
| 设置页面入口 | 前端 | 2h |
| 测试 | QA | 4h |

### 7.3 Phase 3（优化，3 天）

| 任务 | 负责人 | 预计工时 |
|-----|-------|---------|
| 对话界面状态提示 | 前端 | 6h |
| 与审批系统联动 | 前端 | 4h |
| 测试 | QA | 4h |

---

## 八、术语映射表（重要！）

为保证文案一致性，全项目使用以下术语：

| 技术术语 | 用户术语 | 使用场景 |
|---------|---------|---------|
| allowlist / whitelist | 已信任的操作 | 所有用户界面 |
| safeBins | 信任列表 | 配置界面 |
| allow-once | 允许（仅这一次） | 审批弹窗 |
| allow-always | 信任（以后都信任） | 审批弹窗 |
| deny | 拒绝 | 审批弹窗 |
| security: deny | 安全模式 | 安全模式选择 |
| security: allowlist | 智能模式 | 安全模式选择 |
| security: full / trust | 完全模式 | 安全模式选择 |
| exec approval | 操作确认 | 所有用户界面 |
| timeout | 超时 / 自动拒绝 | 审批弹窗 |

---

## 九、验收标准

### 9.1 审批弹窗

- [ ] 弹窗在 0.5 秒内显示
- [ ] 倒计时实时更新
- [ ] 最后 30 秒变红提醒
- [ ] 三个按钮功能正常
- [ ] 断线自动重连
- [ ] 有提示音

### 9.2 安全模式选择

- [ ] 文案清晰易懂
- [ ] 能力列表准确
- [ ] 选择后有反馈
- [ ] 二次确认（完全模式）

### 9.3 信任列表管理

- [ ] 显示系统默认操作
- [ ] 显示用户添加的操作
- [ ] 可以添加新操作
- [ ] 可以删除用户添加的操作
- [ ] 搜索功能

---

## 十、相关文件

| 文件 | 修改内容 |
|-----|---------|
| `src/gateway/setup-page.ts` | 安全模式卡片、审批监听 |
| `src/gateway/components/exec-approval-modal.ts` | 新增：审批弹窗组件 |
| `src/gateway/styles/exec-approval.css` | 新增：审批弹窗样式 |
| `src/gateway/server-methods/exec-approval.ts` | API 无需修改 |
| `src/gateway/pages/trusted-operations.ts` | 新增：信任列表页面 |
| `src/canvas-host/a2ui/` | 对话界面状态提示 |

---

## 附录：完整的系统默认信任操作

```json
{
  "Windows 常用": [
    "notepad", "explorer", "calc", "mspaint", "code",
    "cmd", "powershell", "start", "where", "dir",
    "type", "echo", "set", "cd", "mkdir", "copy"
  ],
  "开发工具": [
    "python", "python3", "node", "npm", "pnpm",
    "bun", "git", "curl", "wget"
  ],
  "Linux 基础": [
    "ls", "cat", "grep", "find", "head", "tail",
    "wc", "sort", "uniq", "jq", "cp", "mv",
    "mkdir", "touch", "chmod", "pwd", "which", "env"
  ],
  "浏览器": [
    "chrome", "msedge", "firefox"
  ]
}
```
