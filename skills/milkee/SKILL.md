---
name: milkee
description: 创建时间：2026-01-17 06:30
description_zh: 创建时间：2026-01-17 06:30
---
# MILKEE Skill — 完整安装说明
**创建时间**：2026-01-17 06:30  
**状态**：✅ 已投入生产环境  
**版本**：1.0  

---

## 📦 Skill 文件

位于：`/root/clawdbot/skills/milkee/`

### SKILL.md
- 完整文档说明  
- API 接口列表  
- 使用示例  
- 配置指南  

### scripts/milkee.py
- 支持全部 MILKEE 操作的 CLI 工具  
- 约 300 行 Python 代码  
- 支持模糊项目匹配  
- 支持计时器状态管理  

---

## ✅ 已实现功能

### 1. 项目（Projects）
- ✅ 列出全部项目  
- ✅ 创建新项目  
- ✅ 更新项目（名称、预算）  

### 2. 客户（Customers）
- ✅ 列出全部客户  
- ✅ 创建新客户（支持全部字段：姓名、街道、邮编、城市、电话、邮箱、网站）  
- ✅ 更新客户（支持全部字段）  

### 3. 工时追踪（Time Tracking）
- ✅ 启动计时器（支持模糊项目匹配）  
- ✅ 停止计时器（自动计算小时/分钟）  
- ✅ 显示今日全部工时  
- ✅ 计时器状态持久化（保存于 ~/.milkee_timer）  

### 4. 任务（Tasks）
- ✅ 列出全部任务  
- ✅ 创建任务  
- ✅ 更新任务（名称、状态）  

### 5. 产品（Products）
- ✅ 列出全部产品  
- ✅ 创建产品  
- ✅ 更新产品（名称、价格）  

---

## 🚀 快捷命令

### 工时追踪（核心功能）
```bash
# Start timer (smart fuzzy match)
python3 scripts/milkee.py start_timer "Website" "Building authentication"

# Stop timer (logs to MILKEE)
python3 scripts/milkee.py stop_timer

# Show today's times
python3 scripts/milkee.py list_times_today
```

### 项目（Projects）
```bash
python3 scripts/milkee.py list_projects
python3 scripts/milkee.py create_project "My Project" --customer-id 123 --budget 5000
python3 scripts/milkee.py update_project 456 --name "Updated" --budget 6000
```

### 客户（Customers）
```bash
python3 scripts/milkee.py list_customers

# Create with all fields
python3 scripts/milkee.py create_customer "Example AG" \
  --street "Musterstrasse 1" \
  --zip "8000" \
  --city "Zürich" \
  --phone "+41 44 123 45 67" \
  --email "info@example.ch" \
  --website "https://example.ch"

# Update specific fields
python3 scripts/milkee.py update_customer 123 --name "New Name" --phone "+41 44 999 88 77"
```

### 任务（Tasks）
```bash
python3 scripts/milkee.py list_tasks
python3 scripts/milkee.py create_task "Implement feature" --project-id 456
python3 scripts/milkee.py update_task 789 --name "New Name"
```

### 产品（Products）
```bash
python3 scripts/milkee.py list_products
python3 scripts/milkee.py create_product "Consulting Hour" --price 150
python3 scripts/milkee.py update_product 789 --price 175
```

---

## 🔐 配置说明

**配置文件**：`~/.clawdbot/clawdbot.json`

```json
"milkee": {
  "env": {
    "MILKEE_API_TOKEN": "USER_ID|API_KEY",
    "MILKEE_COMPANY_ID": "YOUR_COMPANY_ID"
  }
}
```

**凭据说明**：  
- 获取位置：MILKEE 设置 → API  
- 格式：USER_ID|API_KEY  

---

## 🎯 特色功能

### 模糊项目匹配（Fuzzy Project Matching）
当您输入“网站”时，skill 将：  
1. 从 MILKEE 获取全部项目列表  
2. 执行模糊匹配（基于 Levenshtein 距离）  
3. 自动选择最接近的匹配项  
4. 在该项目上启动计时器  

**示例**：  
```
Input: "website"
Matches: "Website Redesign Project" (96%+ match)
→ Timer starts on project
```  

### 计时器状态持久化（Timer Persistence）
- 将计时器状态保存至 `~/.milkee_timer`  
- 支持跨终端会话持续存在  
- 停止时自动计算已耗时长  

### 每日工时汇总（Daily Time Summary）
`list_times_today` 输出内容包括：  
- 今日全部工时条目  
- 每条目的持续时间  
- 当日总工时（小时/分钟）  

---

## 📊 测试结果

✅ 列出项目 — 功能正常  
✅ 模糊匹配 — 功能正常（可准确匹配项目名称）  
✅ API 认证 — 所有接口均可正常调用  
✅ 工时计算 — 结果准确  
✅ 计时器持久化 — 支持跨会话保持  

---

## 🔧 实现细节

- **语言**：Python 3.8+  
- **HTTP 客户端**：urllib（Python 标准库）  
- **模糊匹配**：SequenceMatcher（Python 标准库）  
- **计时器文件**：~/.milkee_timer（JSON 格式）  
- **依赖项**：无（仅使用 Python 标准库）  

---

## 📝 注意事项

- 公司 ID ≠ 用户 ID（两者均需从 MILKEE 设置中分别获取）  
- API Token 格式：USER_ID|API_KEY  
- 工时条目默认为可计费状态  
- 支持按小时计费（byHour）及固定预算（fixedBudget）两类项目  
- 无外部依赖（仅使用 Python 标准库）  

---

## 🎯 后续步骤

1. 使用您的 MILKEE 凭据完成配置  
2. 测试：`python3 scripts/milkee.py list_projects`  
3. 开始记录工时：`start_timer "ProjectName"`  
4. 查看每日汇总：`list_times_today`  

---

**状态**：已投入生产环境！ 🚀  
**创建者**：Seal 🦭  
**日期**：2026-01-17