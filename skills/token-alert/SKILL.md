---
name: token-alert
description: 🚨 监控会话 token 并在 75%/90%/95% 时发出警报
description_zh: 🚨 监控会话 token 并在 75%/90%/95% 时发出警报
---
# Token Alert 技能（skills）

🚨 **监控会话 token 并在 75%/90%/95% 时发出警报**

## 概述

Token Alert 技能（skills）自动监控您的 Clawdbot 会话 token 使用量，并在接近限额时发出警报。再也不会于对话中途丢失上下文！

## 特性

- ✅ **六级阈值系统** —— 在 25%、50%、75%、90%、95%、100% 时发出警报  
- ✅ **Material Design 进度条** —— 方块样式（▰/▱），带色彩渐变  
- ✅ **丰富 UI 仪表板** —— 带动画效果的交互式 HTML 仪表板  
- ✅ **会话状态** —— 按需显示当前 token 使用量  
- ✅ **Telegram 警报** —— 在触达限额前收到通知  
- ✅ **HEARTBEAT 集成** —— 可选的自动检查  
- ✅ **无状态设计** —— 无需状态文件，按需实时计算  
- ✅ **会话预估** —— 预测剩余会话数（平均约 50k）  

## 使用方法

### 交互式仪表板

向 Grym 提问：  
- “显示 token 仪表板”  
- “打开仪表板”  

或直接运行：  
```bash
python3 ~/clawd/skills/token-alert/scripts/show_dashboard.py
```  

### 终端检查

向 Grym 提问：  
- “我还剩多少 tokens？”  
- “检查 token 状态”  
- “token 使用情况？”  

或直接运行：  
```bash
python3 ~/clawd/skills/token-alert/scripts/check.py
```  

### 自动警报

Grym 将在以下情况自动向您发出警报：  
- 🟡 **25%** —— 低警告（约剩余 150k tokens）  
- 🟠 **50%** —— 中警告（约剩余 100k tokens）  
- 🔶 **75%** —— 高警告（约剩余 50k tokens）  
- 🔴 **90%** —— 关键警告（约剩余 20k tokens）  
- 🚨 **95%** —— 紧急！（剩余 <10k tokens）  

### 示例输出  

```
🔶 Token Alert: Achtung!

🔶 ▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▱▱▱▱▱▱ 78.0%
156,000 / 200,000 Tokens verwendet

⚠️ Status: High Warning (Rot-Orange Zone)
💡 Verbleibend: ~44k Tokens
⏰ Geschätzte Sessions: <1 Session

🔧 Empfehlung:
   ✅ Wichtige Entscheidungen jetzt treffen
   ✅ Neue Session vorbereiten
   ✅ Token-sparend arbeiten
```  

## 安装  

```bash
# Via ClawdHub
clawdhub install token-alert

# Manual
cd ~/clawd/skills
git clone https://github.com/r00tid/clawdbot-token-alert token-alert
```  

## 配置  

### HEARTBEAT 集成（可选）  

添加至 `~/clawd/HEARTBEAT.md`：  

```markdown
### Token Usage Check (täglich)
- [ ] `python3 ~/clawd/skills/token-alert/scripts/check.py`
- **Warning ab 70%:** "⚠️ Session bei XX% - Token-Sparend ab jetzt!"
```  

## 工作原理  

1. 使用 Clawdbot 的 `session_status` 工具  
2. 计算 token 使用量百分比  
3. 与阈值（75%、90%、95%）比对  
4. 若超过阈值，则发送 Telegram 警报  

## 技术细节  

### 文件  

```
skills/token-alert/
├── SKILL.md                    # This file
├── README.md                   # GitHub documentation
├── LICENSE                     # MIT License
├── .clawdhub/
│   └── manifest.json           # ClawdHub metadata
├── assets/
│   ├── dashboard-78-high.png   # Screenshot (High Warning)
│   └── dashboard-96-emergency.png  # Screenshot (Emergency)
└── scripts/
    ├── check.py                # Token checker (Terminal)
    ├── dashboard.html          # Rich UI dashboard
    └── show_dashboard.py       # Dashboard launcher
```  

### 依赖项  

- Python 3.8+  
- Clawdbot session_status 工具  
- 可选：已配置的 Telegram 频道  

### 脚本 API  

```python
# scripts/check.py
def get_session_tokens():
    """Get current session token usage via session_status tool"""
    
def check_thresholds(percent):
    """Check if usage exceeds thresholds"""
    
def format_alert(used, limit, percent, level):
    """Format alert message for Telegram"""
```  

## 适用场景  

- **执行长任务前** —— 检查是否拥有足够 token  
- **会话中** —— 长时间对话期间监控用量  
- **日常检查** —— 添加至 HEARTBEAT 实现自动监控  

## 局限性  

- 仅监控会话 token（不监控 Claude.ai API 限额）  
- 需处于活跃的 Clawdbot 会话中  
- 若接近阈值，警报频率可能较高  

## 未来增强  

- [ ] Claude.ai API 限额抓取（可选）  
- [ ] 历史 token 使用量追踪  
- [ ] 每周/每月用量报告  
- [ ] 与 `token-router` 技能（skills）集成  

## 支持  

- GitHub Issues：https://github.com/r00tid/clawdbot-token-alert/issues  
- ClawdHub：https://clawdhub.com/skills/token-alert  
- 文档：https://docs.clawd.bot  

## 许可证  

MIT 许可证 —— 详见 LICENSE 文件  

---  

由 Grym 🥜 用心打造 ❤️  