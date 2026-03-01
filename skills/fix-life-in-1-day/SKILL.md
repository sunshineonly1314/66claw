---
name: fix-life-in-1-day
name_zh: 一日生活优化
version: 1.0.0
description: "一天之内彻底改变你的人生。基于 Dan Koe 爆款文章的 10 场心理训练。"
description_zh: 一天之内彻底改变你的人生。基于 Dan Koe 爆款文章的 10 场心理训练。
author: chip1cr
license: MIT
repository: https://github.com/pinkpixel/fix-life-in-1-day
metadata:
  clawdbot:
    emoji: "🧠"
    triggers: ["/life", "/architect"]
  tags: ["psychology", "self-improvement", "coaching", "life-design", "dan-koe"]
---
# 一天之内彻底改变你的人生 🧠

基于 Dan Koe 爆款文章的 10 场心理训练。

依据来源：
- 📝 [@thedankoe](https://x.com/thedankoe) — “如何一天之内彻底改变你的人生”
- 🔧 [@alex_prompter](https://x.com/alex_prompter) — 从 Dan 的文章中逆向工程出的 10 个 AI 提示词
- ⚡ [@chip1cr](https://x.com/chip1cr) — Clawdbot skill 实现

## 功能说明

引导用户完成 10 个结构化训练环节：

1. **反愿景架构师（The Anti-Vision Architect）** — 构建一幅你正逐渐滑向的那种人生的具象图景  
2. **隐藏目标解码器（The Hidden Goal Decoder）** — 揭示你实际上正在优化的目标  
3. **身份建构溯源者（The Identity Construction Tracer）** — 追溯限制性信念的起源  
4. **生活方式-结果对齐审计员（The Lifestyle-Outcome Alignment Auditor）** — 对比理想生活方式与实际生活方式  
5. **不协调引擎（The Dissonance Engine）** — 从舒适区迈向富有成效的张力状态  
6. **控制论调试器（The Cybernetic Debugger）** — 修复你的目标追求反馈回路  
7. **自我意识阶段导航员（The Ego Stage Navigator）** — 评估自身发展阶段并推动过渡  
8. **游戏架构工程师（The Game Architecture Engineer）** — 将人生设计为一场具有真实 stakes（利害关系）的游戏  
9. **条件反射挖掘者（The Conditioning Excavator）** — 区分继承而来的信念与自主选择的信念  
10. **一日重置架构师（The One-Day Reset Architect）** — 生成一套完整的、可在一天内执行的转变方案  

## 命令列表

| 命令 | 动作 |
|---------|--------|
| `/life` | 启动或继续（新用户将显示引导介绍） |
| `/life ru` | 以俄语启动 |
| `/life status` | 显示进度 |
| `/life session N` | 跳转至第 N 场训练 |
| `/life reset` | 重新开始 |

## 使用流程

### 当用户输入 `/life` 时

**步骤 1：** 检查是否需要展示引导介绍  
```bash
bash scripts/handler.sh intro en $WORKSPACE
```  

若 `showIntro: true` → 发送含图片的引导消息，并附带“🐇 跳入兔子洞”按钮（`life:begin`）  

若 `showIntro: false` → 执行 `start` 并显示当前阶段  

**步骤 2：** 获取当前状态  
```bash
bash scripts/handler.sh start en $WORKSPACE
```  

**步骤 3：** 格式化后向用户展示：  
```
🧠 **Life Architect** — Session {session}/10
**{title}**
Phase {phase}/{totalPhases}
━━━━━━━━━━━━━━━━━━━━━━━━━━━

{content}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
```  

**步骤 4：** 用户响应后，保存并进入下一环节：  
```bash
bash scripts/handler.sh save "USER_RESPONSE" $WORKSPACE
```  

## 处理器命令

```bash
handler.sh intro [en|ru]     # Check if should show intro
handler.sh start [en|ru]     # Start/continue session
handler.sh status            # Progress JSON
handler.sh session N         # Jump to session N
handler.sh save "text"       # Save response & advance
handler.sh skip              # Skip current phase
handler.sh reset             # Clear all progress
handler.sh callback <cb>     # Handle button callbacks
handler.sh lang en|ru        # Switch language
handler.sh reminders "07:00" "2026-01-27"  # Create Session 10 reminders
handler.sh insights          # Get accumulated insights
```  

## 回调函数（Callbacks）

- `life:begin` / `life:begin:ru` — 启动训练  
- `life:prev` — 返回上一阶段  
- `life:skip` — 跳过当前阶段  
- `life:save` — 保存并退出  
- `life:continue` — 继续  
- `life:lang:en` / `life:lang:ru` — 切换语言  
- `life:session:N` — 跳转至第 N 场训练  

## 文件

```
life-architect/
├── SKILL.md              # This file
├── assets/
│   └── intro.jpg         # Intro image
├── references/
│   ├── sessions.md       # Session overview
│   ├── sources.md        # Original sources
│   └── sessions/
│       ├── en/           # English sessions (1-10)
│       └── ru/           # Russian sessions (1-10)
└── scripts/
    ├── handler.sh        # Main command handler
    └── export.sh         # Export final document
```  

## 用户数据

存储于 `$WORKSPACE/memory/life-architect/`：  
- `state.json` — 进度追踪  
- `session-NN.md` — 用户响应内容  
- `insights.md` — 已完成训练环节的关键洞见  
- `final-document.md` — 导出的完整文档  

## 支持语言

- 英语（默认）  
- 俄语（完整翻译）  

## 依赖要求

- `jq`（JSON 处理器）  
- `bash` 4.0+  

## 许可证

MIT  