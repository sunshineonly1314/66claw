---
name: solobuddy
name_zh: Solo伙伴
description: 面向独立开发者的“公开构建”伴侣——涵盖内容工作流、Twitter 互动、项目灵魂创建。一位鲜活的助手，而非工具。
description_zh: 面向独立开发者的“公开构建”伴侣——涵盖内容工作流、Twitter 互动、项目灵魂创建。一位鲜活的助手，而非工具。
homepage: https://github.com/gHashTag/bip-buddy
metadata: {"clawdbot":{"emoji":"🎯","requires":{"bins":["gh"],"optional":["bird"]},"config":["solobuddy.dataPath","solobuddy.voice"]}}
---
# SoloBuddy

面向“公开构建”的内容助手。一位鲜活的陪伴者，而非工具。

## 快速上手

1. 在 `~/.clawdbot/clawdbot.json` 中设置你的数据路径：  
```json
{
  "solobuddy": {
    "dataPath": "~/projects/my-bip-folder",
    "voice": "jester-sage"
  }
}
```

2. 创建目录结构（将路径替换为你自己的实际路径）：  
```bash
mkdir -p ~/projects/my-bip-folder/ideas ~/projects/my-bip-folder/drafts ~/projects/my-bip-folder/data
touch ~/projects/my-bip-folder/ideas/backlog.md
```

3. 开始使用：“show backlog”（显示待办清单）、“new idea”（新增想法）、“generate post”（生成帖子）

## 占位符说明

ClawdBot automatically replaces these in commands:  
- `{dataPath}` → 你所配置的 `solobuddy.dataPath`  
- `{baseDir}` → skill 安装目录  

## 数据结构

所有数据均存于 `{dataPath}`：  
- `ideas/backlog.md` —— 想法队列  
- `ideas/session-log.md` —— 会话快照  
- `drafts/` —— 进行中的工作  
- `data/my-posts.json` —— 已发布帖子  
- `data/activity-snapshot.json` —— 项目活动（每小时更新）  

## 语音风格

在 `solobuddy.voice` 中配置。可用选项如下：

| 语音风格 | 描述 |
|----------|------|
| `jester-sage` | 讽刺、直率、富有哲思（默认） |
| `technical` | 精准、详尽、结构清晰 |
| `casual` | 友好、轻松、对话感强 |
| `custom` | 使用 `{dataPath}/voice.md` |

语音详情请参阅 `{baseDir}/prompts/profile.md`。

## 模块

### 内容生成  
核心工作流：待办清单 → 草稿 → 发布。  
规则详见 `{baseDir}/prompts/content.md`。

### Twitter 专家  
面向 X/Twitter 的内容策略，含 2025 年算法洞察。  
详见 `{baseDir}/modules/twitter-expert.md`。

### Twitter 监控器（可选）  
主动互动支持——监控关注列表并建议评论。  
依赖：`bird` CLI。详见 `{baseDir}/modules/twitter-monitor.md`。

### 灵魂向导（Soul Wizard）  
基于文档创建项目人格。  
详见 `{baseDir}/references/soul-wizard.md`。

## 命令

### 待办清单（Backlog）

显示想法：  
```bash
cat {dataPath}/ideas/backlog.md
```

新增想法：  
```bash
echo "- [ ] New idea text" >> {dataPath}/ideas/backlog.md
```

### 会话日志（Session Log）

查看最近记录：  
```bash
tail -30 {dataPath}/ideas/session-log.md
```

添加新快照：  
```bash
echo -e "## $(date '+%Y-%m-%d %H:%M')\nText" >> {dataPath}/ideas/session-log.md
```

### 草稿（Drafts）

列出全部：`ls {dataPath}/drafts/`  
读取指定草稿：`cat {dataPath}/drafts/<name>.md`

保存草稿：  
```bash
cat > {dataPath}/drafts/<name>.md << 'EOF'
Content
EOF
```

### 发布（Publishing）

```bash
cd {dataPath} && git add . && git commit -m "content: add draft" && git push
```

## 项目活动（Project Activity）

读取活动快照，获取战略背景信息：  
```bash
cat {dataPath}/data/activity-snapshot.json
```

字段说明：  
- `daysSilent` —— 距上次提交的天数  
- `commitsToday/Yesterday/Week` —— 活动强度  
- `phase` —— 当前状态：活跃 / 保持势头 / 降温 / 沉寂 / 休眠  
- `insight` —— 人类可读摘要  

**阶段定义：**  
- `active` —— 今日有提交，项目正热  
- `momentum` —— 昨日活跃、今日静默（适合温和提醒）  
- `cooling` —— 已静默 2–3 天，动力减弱  
- `silent` —— 已静默 3–7 天，亟需关注  
- `dormant` —— 已静默 7 天以上，可能已暂停或放弃  

可用于提供战略性建议：  
- “sphere-777 今日提交 10 次——专注此处！”  
- “ReelStudio 已静默 5 天——是否需要介入？”  

## Telegram 集成

在 Telegram 中响应时，请附带内联按钮以支持快捷操作。

### 发送带按钮的消息

```bash
clawdbot message send --channel telegram --to "$CHAT_ID" --message "Text" \
  --buttons '[
    [{"text":"📋 Backlog","callback_data":"sb:backlog"}],
    [{"text":"✍️ Drafts","callback_data":"sb:drafts"}],
    [{"text":"💡 New Idea","callback_data":"sb:new_idea"}]
  ]'
```

### 回调数据格式

所有回调均以前缀 `sb:` 开头：  
- `sb:backlog` —— 显示想法  
- `sb:drafts` —— 列出草稿  
- `sb:new_idea` —— 提示输入新想法  
- `sb:generate:<N>` —— 基于第 N 个想法生成内容  
- `sb:save_draft` —— 将当前内容保存为草稿  
- `sb:publish` —— 提交并推送  
- `sb:activity` —— 显示项目活动  
- `sb:twitter` —— 检查 Twitter 互动机会  

### 主菜单

触发方式：“menu”、“start”，或完成某项操作后自动弹出：  
```json
[
  [{"text":"📋 Ideas","callback_data":"sb:backlog"}, {"text":"✍️ Drafts","callback_data":"sb:drafts"}],
  [{"text":"📊 Activity","callback_data":"sb:activity"}],
  [{"text":"💡 Add idea","callback_data":"sb:new_idea"}],
  [{"text":"🎯 Generate post","callback_data":"sb:generate_menu"}]
]
```

### 生成流程

显示待办清单后：  
```json
[
  [{"text":"1️⃣","callback_data":"sb:generate:1"}, {"text":"2️⃣","callback_data":"sb:generate:2"}, {"text":"3️⃣","callback_data":"sb:generate:3"}],
  [{"text":"◀️ Back","callback_data":"sb:menu"}]
]
```

生成内容后：  
```json
[
  [{"text":"💾 Save draft","callback_data":"sb:save_draft"}],
  [{"text":"🔄 Regenerate","callback_data":"sb:regenerate"}],
  [{"text":"◀️ Menu","callback_data":"sb:menu"}]
]
```

## 内容生成流程

1. 读取待办清单，选取一个想法  
2. 读取 `{baseDir}/prompts/content.md` 获取生成规则  
3. 读取 `{baseDir}/prompts/profile.md` 获取语音风格  
4. 按所配置的语音风格生成内容  
5. 展示按钮：保存 / 重新生成 / 返回主菜单  

## 灵魂创建（Soul Creation）

基于文档创建项目人格。

触发方式：“create soul for <path>”（为 <path> 创建灵魂）

完整五步向导详见 `{baseDir}/references/soul-wizard.md`：  
1. 扫描项目中的 `.md` 文件  
2. 提问：本质（生物 / 工具 / 向导 / 艺术家）  
3. 提问：语音（活泼 / 技术向 / 诗意 / 平静 / 强烈）  
4. 提问：哲学观（自动提取或自定义）  
5. 提问：梦想与痛点  
6. 保存至 `{dataPath}/data/project-souls/<name>.json`  

## 语言

匹配用户语言：  
- 输入为俄语 → 输出俄语 + 俄语按钮  
- 输入为英语 → 输出英语 + 英语按钮  