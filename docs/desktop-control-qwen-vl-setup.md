# 🖥️ OpenClawCN 桌面控制 + Qwen-VL-Max 配置指南

**适用场景**: 国内用户使用通义千问 Qwen-VL-Max 实现 Windows 桌面自动化

**成本**: 约 100-200 元/月（1000-2000 次桌面控制流程）

---

## 📋 目录

1. [快速开始](#快速开始)
2. [工作原理](#工作原理)
3. [配置步骤](#配置步骤)
4. [使用示例](#使用示例)
5. [成本分析](#成本分析)
6. [常见问题](#常见问题)

---

## 🚀 快速开始

### 前置要求

- ✅ Windows 10/11 系统
- ✅ Node.js 18+ 已安装
- ✅ OpenClawCN 已安装
- ✅ 通义千问 API Key（免费注册即可获得）

### 30秒快速配置

```bash
# 1. 复制配置文件
cp config-desktop-control-cn.json5 ~/.openclawcn/config.json5

# 2. 编辑配置，替换 YOUR_DASHSCOPE_API_KEY
# 使用你喜欢的编辑器打开 ~/.openclawcn/config.json5

# 3. 启动网关
openclawcn gateway run

# 4. 测试桌面控制
# 在聊天界面输入:
desktop_control({action: "screenshot"})
```

---

## 🔍 工作原理

### 技术架构

```
┌─────────────────────────────────────────────────────────────────┐
│  OpenClawCN 桌面控制架构 (Qwen-VL-Max 驱动)                    │
└─────────────────────────────────────────────────────────────────┘

用户指令: "打开向日葵，输入设备码 123456，连接"
    ↓
┌─────────────────────────────────────────────────────────┐
│ Step 1: LLM 任务规划 (Qwen-Max, 纯文本)               │
│ → "需要: open_app + desktop_control (图片分析)"       │
│ 成本: ~0.01 元                                          │
└─────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────┐
│ Step 2: 启动应用 (open_app)                            │
│ → 查注册表/开始菜单 → 启动向日葵.exe                   │
│ 成本: 0 元 (无 LLM 调用)                               │
└─────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────┐
│ Step 3: 截图 (desktop_control screenshot)              │
│ → PowerShell 调用 Windows API                          │
│ → System.Drawing.Graphics.CopyFromScreen()             │
│ → 返回 1920x1080 PNG (base64)                          │
│ 成本: 0 元 (无 LLM 调用)                               │
└─────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────┐
│ Step 4: 图片分析 (自动切换到 Qwen-VL-Max)             │
│                                                         │
│ ┌─────────────────────────────────────────────────┐   │
│ │ modalityRouter 检测到图片附件                   │   │
│ │ → 当前模型: qwen-max (无 vision)                │   │
│ │ → 需要能力: vision (image_understand)           │   │
│ │ → 自动切换: qwen-vl-max ✅                      │   │
│ │ → 日志: "[ModalityRouter] 自动切换模型:        │   │
│ │         qwen/qwen-vl-max (检测到图片)"         │   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
│ → Qwen-VL-Max 分析截图:                                │
│   "我看到向日葵主界面，中间有'设备码'输入框           │
│    坐标约在 (450, 320)，下面有'密码'框 (450, 400)，   │
│    右下角有'连接'按钮 (520, 480)"                      │
│                                                         │
│ 图片 tokens: ~2000                                     │
│ 输出 tokens: ~500                                      │
│ 成本: ~0.05 元                                          │
└─────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────┐
│ Step 5: 坐标操作 (desktop_control click/type)          │
│ → click(450, 320)  # Windows API: SetCursorPos          │
│ → type("123456")   # SendInput KEYEVENTF_UNICODE        │
│ → key("tab")       # SendKeys {TAB}                     │
│ → type("password") # SendInput                          │
│ → click(520, 480)  # 点击连接按钮                       │
│ 成本: 0 元 (无 LLM 调用)                               │
└─────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────┐
│ Step 6: 验证结果 (再次截图 + Qwen-VL-Max)              │
│ → desktop_control({action: "screenshot"})               │
│ → Qwen-VL-Max: "看到'连接成功'提示 ✅"                 │
│ 成本: ~0.05 元                                          │
└─────────────────────────────────────────────────────────┘

总成本: ~0.11 元/次完整流程
```

### 关键技术点

#### 1. **自动模型切换（Modality Router）**

```typescript
// src/auto-reply/reply/get-reply.ts:280-302

const modalityRouterEnabled = dispatchCfg?.modalityRouter !== false;

if (modalityRouterEnabled) {
  const attachments = normalizeAttachments(finalized);
  const modalityRouting = await routeByModality({
    body: finalized.Body,
    attachments,              // ← 检测到图片
    currentModel: { provider: "qwen-dashscope", model: "qwen-max" },
  });

  if (modalityRouting?.switched) {
    provider = modalityRouting.provider;  // → "qwen-dashscope"
    model = modalityRouting.model;        // → "qwen-vl-max"
    log(`自动切换模型: ${provider}/${model} (${modalityRouting.reason})`);
  }
}
```

**工作流程**:
1. 检测消息中的附件（截图）
2. 识别需要的能力（`image_understand`）
3. 查询模型能力矩阵（Qwen-Max 无 vision → Qwen-VL-Max 有 vision）
4. 自动切换并记录日志

#### 2. **Windows 原生 API 控制**

```powershell
# src/agents/tools/desktop-control.ts PowerShell Helper Script

# 截图
$bitmap = New-Object System.Drawing.Bitmap($width, $height)
$g = [System.Drawing.Graphics]::FromImage($bitmap)
$g.CopyFromScreen($x, $y, 0, 0, ...)  # ← 物理像素截图
$bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

# 点击
[DllImport("user32.dll")] SetCursorPos(int x, int y);
[DllImport("user32.dll")] mouse_event(MOUSEEVENTF_LEFTDOWN, ...);

# 输入
[DllImport("user32.dll")] SendInput(uint nInputs, INPUT[] pInputs, ...);
# 使用 KEYEVENTF_UNICODE 支持全 Unicode（包括中文）
```

**不需要 OCR**！LLM 直接"看懂"截图，像人类一样估算坐标。

---

## ⚙️ 配置步骤

### 步骤 1: 获取 DashScope API Key

1. 访问 [阿里云 DashScope 控制台](https://dashscope.console.aliyun.com/)
2. 注册/登录阿里云账号
3. 开通 DashScope 服务（免费，无需付费）
4. 在"API-KEY 管理"页面创建 API Key
5. 复制 API Key（格式: `sk-xxxxxxxxxx`）

### 步骤 2: 配置 OpenClawCN

方式 A: 使用预制配置文件

```bash
# 复制配置模板
cp config-desktop-control-cn.json5 ~/.openclawcn/config.json5

# 编辑配置文件
# Windows: notepad C:\Users\<你的用户名>\.openclawcn\config.json5
# macOS/Linux: nano ~/.openclawcn/config.json5
```

方式 B: 手动创建配置

```json5
// ~/.openclawcn/config.json5
{
  agents: {
    defaultModel: "qwen-max",
    authProfiles: [
      {
        provider: "qwen-dashscope",
        model: "qwen-max",
        apiKey: "sk-你的API-Key",
      },
      {
        provider: "qwen-dashscope",
        model: "qwen-vl-max",
        apiKey: "sk-你的API-Key",  // 同一个 API Key
      },
    ],
  },

  dispatch: {
    modalityRouter: true,  // ← 必须启用！
  },

  models: {
    mode: "merge",
    providers: {
      "qwen-dashscope": {
        baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        apiKey: "sk-你的API-Key",
        api: "openai-completions",
        models: [
          {
            id: "qwen-max",
            name: "通义千问 Max",
            input: ["text"],
            contextWindow: 32000,
            maxTokens: 8192,
          },
          {
            id: "qwen-vl-max",
            name: "通义千问 VL Max",
            input: ["text", "image"],  // ← 支持图片
            contextWindow: 32000,
            maxTokens: 2000,
          },
        ],
      },
    },
  },
}
```

### 步骤 3: 验证配置

```bash
# 启动网关
openclawcn gateway run

# 应该看到日志:
# ✓ 已加载模型: qwen-max (文本)
# ✓ 已加载模型: qwen-vl-max (视觉)
# ✓ modalityRouter: enabled
# ✓ desktop_control 工具已注册 (Windows)
```

---

## 📝 使用示例

### 示例 1: 打开应用并截图

```
用户: 打开记事本并截图

AI 执行:
1. open_app({name: "notepad"})
2. desktop_control({action: "screenshot"})
   → Qwen-VL-Max 分析: "看到空白记事本窗口"
```

**成本**: ~0.05 元

---

### 示例 2: 向日葵远程控制

```
用户: 打开向日葵，输入设备码 123456，密码 abc123，然后连接

AI 执行:
1. open_app({name: "向日葵"})
2. desktop_control({action: "screenshot"})
   → 自动切换到 Qwen-VL-Max
   → 分析: "设备码框在 (450, 320)"
3. desktop_control({action: "click", x: 450, y: 320})
4. desktop_control({action: "type", text: "123456"})
5. desktop_control({action: "key", keys: "tab"})
6. desktop_control({action: "type", text: "abc123"})
7. desktop_control({action: "click", x: 520, y: 480})
8. desktop_control({action: "screenshot"})
   → 验证: "连接成功"
```

**成本**: ~0.11 元

---

### 示例 3: 批量窗口管理

```
用户: 列出所有打开的窗口，然后聚焦到 Chrome

AI 执行:
1. desktop_control({action: "list_windows"})
   → 返回: [{"title": "Google Chrome", ...}, ...]
   → 使用 Qwen-Max（纯文本）
2. desktop_control({action: "focus", window: "Chrome"})
```

**成本**: ~0.01 元（无图片分析）

---

## 💰 成本分析

### 定价详情（2026-02-18）

| 模型 | 输入 | 输出 | 平均成本 | 图片 tokens |
|------|------|------|---------|------------|
| **Qwen-Max** | 0.04 元/千 | 0.12 元/千 | ~5.6 元/百万 | N/A |
| **Qwen-VL-Max** | 0.02 元/千 | 0.02 元/千 | ~12 元/百万 | ~2000/张 |

### 实际使用成本

#### 场景 1: 简单桌面控制（1 次截图 + 1 次操作）

```
任务: "截图并点击坐标 (500, 300)"

成本分解:
- 截图（图片 2000 tokens）: 0.04 元
- LLM 分析（输出 200 tokens）: 0.004 元
- 坐标点击（无 LLM）: 0 元
────────────────────────────
总计: 0.044 元
```

#### 场景 2: 复杂自动化流程（3 次截图 + 多次操作）

```
任务: "打开向日葵，登录并连接设备"

成本分解:
- 规划任务（Qwen-Max 文本）: 0.01 元
- 截图 1（识别登录界面）: 0.05 元
- 点击/输入操作（无 LLM）: 0 元
- 截图 2（识别连接界面）: 0.05 元
- 点击连接（无 LLM）: 0 元
- 截图 3（验证结果）: 0.05 元
────────────────────────────
总计: 0.16 元
```

### 月度成本估算

| 使用量 | 简单任务成本 | 复杂任务成本 | 混合成本 |
|--------|------------|------------|---------|
| 100 次/月 | 4.4 元 | 16 元 | ~10 元 |
| 500 次/月 | 22 元 | 80 元 | ~50 元 |
| 1000 次/月 | 44 元 | 160 元 | ~100 元 |
| 2000 次/月 | 88 元 | 320 元 | ~200 元 |

**省钱 Tips**:
1. ✅ 文本任务自动使用 Qwen-Max（便宜 2 倍）
2. ✅ 只在必要时截图（减少图片 tokens）
3. ✅ 批量操作减少验证截图次数

---

## ❓ 常见问题

### Q1: 为什么需要两个模型配置？

**A**:
- **Qwen-Max**: 纯文本任务（任务规划、窗口列表）→ 成本低
- **Qwen-VL-Max**: 图片分析任务（截图识别、坐标定位）→ 功能强

modalityRouter 会自动选择最优模型，无需手动切换！

---

### Q2: 如何确认自动切换是否生效？

**A**: 查看日志中的 `[ModalityRouter]` 标记：

```
[ModalityRouter] 自动切换模型: qwen-dashscope/qwen-vl-max (检测到图片)
```

如果没有看到此日志，检查配置:
```json5
dispatch: {
  modalityRouter: true,  // ← 必须为 true
}
```

---

### Q3: API Key 填写错误会怎样？

**A**: 启动时会报错：

```
Error: Invalid API Key for qwen-dashscope
```

解决方法:
1. 确认 API Key 格式正确（`sk-xxxxxxxxxx`）
2. 检查是否复制完整（不要有空格）
3. 在 DashScope 控制台验证 Key 是否有效

---

### Q4: 成本太高怎么办？

**A**: 优化策略:

1. **减少验证截图**
   ```
   不推荐: 每步操作后都截图验证
   推荐: 只在关键步骤验证（如登录成功）
   ```

2. **使用窗口标题而非截图**
   ```
   不推荐: desktop_control({action: "screenshot"}) → "找到 Chrome"
   推荐: desktop_control({action: "list_windows"}) → 查找标题
   ```

3. **批量操作**
   ```
   不推荐: 点击 → 验证 → 点击 → 验证
   推荐: 点击 → 点击 → 点击 → 最后验证
   ```

4. **考虑混合 OCR 方案**（需要额外开发）
   - 简单文字识别用阿里云 OCR（0.003 元/次）
   - 复杂 UI 识别用 Qwen-VL-Max

---

### Q5: 支持多显示器吗？

**A**: ✅ 完全支持！

`desktop_control` 会自动处理多显示器：
- 截图会捕获全部虚拟屏幕
- 坐标系统自动处理偏移
- 日志中会显示显示器数量和偏移

示例输出:
```
屏幕截图 (3840x1080, fullscreen, 2个显示器)
多显示器偏移: -1920,0 — click 坐标需加上此偏移
```

---

### Q6: 支持高 DPI 缩放吗？

**A**: ✅ 完全支持！

PowerShell 脚本会自动调用:
```powershell
[DpiHelper]::SetProcessDPIAware()
```

确保物理像素坐标与截图坐标一致。

---

### Q7: 与 Claude/GPT-4o 比有什么区别？

**A**:

| 对比项 | Qwen-VL-Max | Claude 4.5 / GPT-4o |
|--------|-------------|---------------------|
| **成本** | 12 元/百万 tokens | 18-90 元/百万 tokens |
| **访问** | 国内直连，无需 VPN | 需要国际网络 |
| **合规** | 数据不出境 | 数据出境 |
| **视觉能力** | ⭐⭐⭐⭐ (4/5) | ⭐⭐⭐⭐⭐ (5/5) |
| **坐标准确度** | 90-95% | 95-98% |
| **中文理解** | ⭐⭐⭐⭐⭐ (5/5) | ⭐⭐⭐⭐ (4/5) |

**结论**: 国内用户推荐 Qwen-VL-Max（性价比高 + 无需翻墙）

---

## 🔧 故障排查

### 问题 1: `desktop_control` 工具未找到

**错误信息**:
```
Error: Unknown tool: desktop_control
```

**原因**: 仅在 Windows 系统加载

**解决方法**:
```typescript
// src/agents/tools/desktop-control.ts:889
export function createDesktopControlTool(): AnyAgentTool | null {
  if (process.platform !== "win32") return null;  // ← 非 Windows 返回 null
  // ...
}
```

确认你在 Windows 系统上运行！

---

### 问题 2: 截图返回黑屏

**原因**: DPI 感知未启用

**解决方法**: 检查 PowerShell 脚本中是否有:
```powershell
[DpiHelper]::SetProcessDPIAware()
```

如果问题仍然存在，手动设置兼容性:
- 右键 `openclawcn.exe`
- 属性 → 兼容性 → 更改高 DPI 设置
- 勾选"替代高 DPI 缩放行为"

---

### 问题 3: 点击坐标不准

**原因**: 多显示器偏移未处理

**解决方法**: 查看截图返回的偏移信息:
```
多显示器偏移: -1920,0 — click 坐标需加上此偏移
```

Qwen-VL-Max 应该会自动处理，但如果不准确，手动调整:
```
实际坐标 = 截图坐标 + 偏移
```

---

## 📚 参考资料

- [OpenClawCN 官方文档](https://github.com/your-org/openclawcn)
- [通义千问 API 文档](https://help.aliyun.com/zh/dashscope/)
- [Desktop Control 工具文档](../skills/desktop-control/SKILL.md)
- [Modality Router 原理](../src/dispatch/modality-router.ts)

---

## 💡 下一步

现在你已经完成配置，可以尝试:

1. **基础测试**: `desktop_control({action: "screenshot"})`
2. **列表窗口**: `desktop_control({action: "list_windows"})`
3. **自动化任务**: "打开记事本，输入 Hello World，保存到桌面"

祝你使用愉快！🎉
