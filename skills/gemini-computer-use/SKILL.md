---
name: gemini-computer-use
name_zh: Gemini电脑操作
description: 使用 Playwright 构建并运行基于 Gemini 2.5 Computer Use 模型的浏览器控制 agents。当用户希望借助 Gemini Computer Use 模型自动化网页浏览器任务、需要实现 agent 循环（截图 → function_call → 操作 → function_response），或要求为高风险 UI 操作集成安全确认机制时启用。
description_zh: 使用 Playwright 构建并运行基于 Gemini 2.5 Computer Use 模型的浏览器控制 agents。当用户希望借助 Gemini Computer Use 模型自动化网页浏览器任务、需要实现 agent 循环（截图 → function_call → 操作 → function_response），或要求为高风险 UI 操作集成安全确认机制时启用。
---
# Gemini 计算机使用（Computer Use）

## 快速开始

1. 加载环境变量文件并设置您的 API 密钥：  

   ```bash
   cp env.example env.sh
   $EDITOR env.sh
   source env.sh
   ```  

2. 创建虚拟环境并安装依赖项：  

   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install google-genai playwright
   playwright install chromium
   ```  

3. 使用 prompt 运行 agent 脚本：  

   ```bash
   python scripts/computer_use_agent.py \
     --prompt "Find the latest blog post title on example.com" \
     --start-url "https://example.com" \
     --turn-limit 6
   ```  

## 浏览器选择

- 默认：Playwright 自带的 Chromium（无需设置环境变量）。  
- 选用 Chrome 或 Edge 浏览器通道，请设置 `COMPUTER_USE_BROWSER_CHANNEL`。  
- 使用自定义 Chromium 内核浏览器（如 Brave），请设置 `COMPUTER_USE_BROWSER_EXECUTABLE`。  

若同时设置了上述两个变量，则 `COMPUTER_USE_BROWSER_EXECUTABLE` 优先级更高。

## 核心工作流（agent 循环）

1. 截取当前屏幕快照，并将用户目标 + 截图一同发送给模型。  
2. 解析模型响应中的 `function_call` 操作指令。  
3. 在 Playwright 中逐条执行这些操作。  
4. 若遇到 `safety_decision` 操作且其 `require_confirmation` 属性为 true，则必须先向用户请求确认，再执行。  
5. 发送 `function_response` 对象，其中包含最新页面 URL 与截图。  
6. 重复上述流程，直至模型仅返回纯文本（不含任何操作指令），或达到预设轮次上限。

## 运维建议

- 请在沙箱化的浏览器配置文件或容器中运行。  
- 使用 `--exclude` 参数屏蔽您不希望模型执行的高风险操作。  
- 保持视口尺寸为 1440×900，除非有特殊需求需调整。

## 相关资源

- 主脚本：`scripts/computer_use_agent.py`  
- 参考文档：`references/google-computer-use.md`  
- 环境变量模板：`env.example`  