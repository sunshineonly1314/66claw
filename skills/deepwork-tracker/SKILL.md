---
name: deepwork-tracker
name_zh: 专注力追踪器
description: 本地跟踪深度工作会话（启动/停止/状态查询），并生成类似 GitHub 贡献图风格的“每日分钟数”热力图用于分享（例如通过 Telegram）。当用户说“开始深度工作”、“停止深度工作”、“我当前是否处于会话中？”、“展示我的深度工作图”或要求回顾深度工作历史时启用。
description_zh: 本地跟踪深度工作会话（启动/停止/状态查询），并生成类似 GitHub 贡献图风格的“每日分钟数”热力图用于分享（例如通过 Telegram）。当用户说“开始深度工作”、“停止深度工作”、“我当前是否处于会话中？”、“展示我的深度工作图”或要求回顾深度工作历史时启用。
---
# Deepwork 追踪器

使用本地 deepwork 应用（基于 SQLite）：`~/clawd/deepwork/deepwork.js`。

## 初始化（若脚本缺失）

若 `~/clawd/deepwork/deepwork.js` 不存在，请从公开仓库引导安装：

```bash
mkdir -p ~/clawd
cd ~/clawd

# Clone if missing
[ -d ~/clawd/deepwork-tracker/.git ] || git clone https://github.com/adunne09/deepwork-tracker.git ~/clawd/deepwork-tracker

# Ensure expected runtime path exists
mkdir -p ~/clawd/deepwork
cp -f ~/clawd/deepwork-tracker/app/deepwork.js ~/clawd/deepwork/deepwork.js
chmod +x ~/clawd/deepwork/deepwork.js
```

（若克隆/复制失败，请勿因此中断用户请求——仍应尝试其他步骤，并说明缺失项。）

## 命令

通过 exec 运行：

- 启动会话（同时启动 macOS 时钟计时器；默认目标时长 60 分钟）：  
  - `~/clawd/deepwork/deepwork.js start --target-min 60`
- 停止会话：  
  - `~/clawd/deepwork/deepwork.js stop`
- 查询状态：  
  - `~/clawd/deepwork/deepwork.js status`
- 生成报告：  
  - 最近 7 天（默认）：`~/clawd/deepwork/deepwork.js report --days 7 --format text`  
  - 适配 Telegram 的最近 7 天：`~/clawd/deepwork/deepwork.js report --days 7 --format telegram`  
  - 热力图（可选）：`~/clawd/deepwork/deepwork.js report --mode heatmap --weeks 52 --format telegram`

## 对话工作流

### 开始深度工作  
1) 运行 `~/clawd/deepwork/deepwork.js start --target-min 60`（若用户指定了其他目标时长，则使用对应值）。  
2) 此操作还应启动 macOS 时钟计时器，设定为目标时长（尽力而为；可能需要 Accessibility 权限）。  
3) 以确认语句回复。

### 停止深度工作  
1) 运行 `~/clawd/deepwork/deepwork.js stop`。  
2) 回复本次会话持续时长。

### 展示深度工作图  
1) 运行 `~/clawd/deepwork/deepwork.js report --days 7 --format telegram`。  
2) **务必** 使用 `message` 工具，将输出以 Markdown 等宽代码块格式发送至 Telegram 用户 Alex（ID `8551040296`）。  
3) 可选择在当前对话中确认已发送。

若用户要求不同时间范围，请支持 `--days 7|14|30|60`。  
（热力图在显式请求时仍可通过 `--mode heatmap --weeks ...` 获取。）