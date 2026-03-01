---
name: screen-monitor
name_zh: 屏幕监控
description: 双模式屏幕共享与分析。模型无关（支持 Gemini/Claude/Qwen3-VL）。
description_zh: 双模式屏幕共享与分析。模型无关（支持 Gemini/Claude/Qwen3-VL）。
metadata: {"clawdbot":{"emoji":"🖥️","requires":{"model_features":["vision"]}}}
---
# 屏幕监控

该 skill 为 agent 提供两种方式来查看并交互您的屏幕。

## 🟢 路径 A：快速共享（WebRTC）
*最适合：快速视觉检查、受限浏览器环境，或非技术用户场景。*

### 工具
- **`screen_share_link`**：生成本地 WebRTC 门户 URL。
- **`screen_analyze`**：从该门户捕获当前帧，并使用视觉能力进行分析。

**用法：**
```bash
# Get the link
bash command:"{baseDir}/references/get-share-url.sh"

# Analyze
bash command:"{baseDir}/references/screen-analyze.sh"
```

---

## 🔵 路径 B：完全控制（浏览器中继）
*最适合：深度调试、UI 自动化，以及在标签页中执行点击/输入操作。*

### 设置步骤
1. 运行 `clawdbot browser extension install`。
2. 从 `clawdbot browser extension path` 加载已解包的扩展程序。
3. 点击 Chrome 工具栏中的 Clawdbot 图标以执行 **附加（Attach）**。

### 工具
- **`browser action:snapshot`**：对已附加的标签页截取精确截图。
- **`browser action:click`**：与页面元素交互（需启用 `profile="chrome"`）。

---

## 技术细节
- **端口**：18795（WebRTC 后端）
- **文件**：
  - `web/screen-share.html`：共享门户。
  - `references/backend-endpoint.js`：帧存储服务器。