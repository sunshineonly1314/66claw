---
name: skills-search
description: 从 CLI 搜索 skills.sh 注册表。在 skills.sh 生态系统中发现和查找 agent skills。
metadata:
  version: 1.0.4
  tags: ["search", "skills.sh", "cli"]
  clawdbot:
    requires:
      bins: ["node"]
    install:
      - id: "skill-install"
        kind: "skill"
        source: "clawdhub"
        slug: "skills-search"
        label: "安装 skills-search skill"
---

# Skills.sh 搜索 CLI

直接从终端搜索 skills 的 skills.sh 注册表。

## 安装（Clawdbot）

```bash
clawdhub install skills-search
```

## 使用方法

```bash
# Search for skills by name
skills-search "postgres"
skills-search "web design"
skills-search "twitter"

# Show most popular skills
skills-search --popular
skills-search --popular --limit 10

# Search with install command
skills-search "web design" --show-install
```

## 示例

```
❯ skills-search "web design"
🔍 Searching skills.sh for "web design"...

✅ web-design-guidelines (16,922 installs)
   Source: vercel-labs/agent-skills
   Install: npx skills add vercel-labs/agent-skills

✅ frontend-design (566 installs)
   Source: anthropics/skills
   Install: npx skills add anthropics/skills
```

### 热门 Skills

```
❯ skills-search --popular --limit 5
📈 Top 5 most popular skills:

✅ vercel-react-best-practices (22,475 installs)
   Source: vercel-labs/agent-skills

✅ web-design-guidelines (17,135 installs)
   Source: vercel-labs/agent-skills

✅ upgrading-expo (1,192 installs)
   Source: expo/skills
...
```

## 自动化（Clawdbot）

### 步骤 1：搜索 skill

```bash
npx @thesethrose/skills-search "react"
```

### 步骤 2：通过 skills CLI 安装已发现的 skill

发现 skill 后，使用 `skills` CLI 安装：

```bash
npx skills add vercel-labs/agent-skills
```

**TUI 导航指引：**

`skills` CLI 使用交互式菜单。请留意提示并据此导航：

1. **选择 skills** → 使用 `space` 切换所需 skills，按 `enter` 确认  
2. **选择 agents** → 使用 `up`/`down` 导航，用 `Clawdbot` 选择 `space`，按 `enter` 确认  
3. **安装范围** → 推荐选择 “Project”（项目级），使用 `enter`  
4. **确认** → 按 `enter` 继续  

**重要提示：** TUI 界面可能变更。请留意菜单选项，并在提示选择 agents 时选择 `Clawdbot`。若对任一选项不确定，请向用户寻求指导。

### 步骤 3：验证安装

```bash
ls ~/.clawdbot/workspace/.agents/skills/
```

## 添加您自己的 skill

Skills.sh 会自动索引包含 `SKILL.md` 文件的 GitHub 仓库。要添加您的 skill，请执行：

1. **创建 skill 文件夹**，并在 GitHub 仓库中放入 `SKILL.md`  
2. **发布至 ClawdHub**，以支持 Clawdbot 特定发现：  
   ```bash
   clawdhub publish ./your-skill/ --slug your-skill --name "Your Skill" --version 1.0.0
   ```  
3. **在 Clawdbot 中安装：**  
   ```bash
   clawdhub install your-skill
   ```  

## 注意事项

- 查询地址为 https://skills.sh/api/skills（官方 skills.sh API）  
- 结果按安装次数排序（最热门者居首）  
- **仅限 Clawdbot：** 须通过 `clawdhub install skills-search` 安装  
- Skills.sh 排行榜需 GitHub 仓库（ClawdHub 专属 skills 无需）  