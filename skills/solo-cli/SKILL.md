---
name: solo-cli
name_zh: Solo CLI
description: 通过 CLI 或 TUI 监控并操作 SOLO.ro 会计平台（摘要、收入、支出、队列、电子发票、公司信息）。当用户要求查询其会计数据、查看发票/支出/电子发票文档，或需将任务安全转化为 solo-cli 命令时使用。
description_zh: 通过 CLI 或 TUI 监控并操作 SOLO.ro 会计平台（摘要、收入、支出、队列、电子发票、公司信息）。当用户要求查询其会计数据、查看发票/支出/电子发票文档，或需将任务安全转化为 solo-cli 命令时使用。
---
# SOLO CLI

## 概述
使用 solo-cli 通过命令行界面（CLI）或交互式终端用户界面（TUI）访问 SOLO.ro 会计平台数据。

## 安装
若 `solo-cli` 命令不可用，请通过 Homebrew 安装：
```bash
brew install rursache/tap/solo-cli
```

## 默认设置与安全性
- 配置文件位置：`~/.config/solo-cli/config.json`（首次运行时自动创建）
- 使用 `--config` 或 `-c` 指定自定义配置路径
- 凭据本地存储；绝不会作为命令行参数传递
- 会话 Cookie 缓存至 `~/.config/solo-cli/cookies.json`，以加快后续登录速度

## 快速入门
- 配置：编辑 `~/.config/solo-cli/config.json`，填入用户名/密码
- 摘要：`solo-cli summary`
- 指定年份摘要：`solo-cli summary 2025`
- 收入：`solo-cli revenues`
- 支出：`solo-cli expenses`
- 队列：`solo-cli queue`
- 电子发票：`solo-cli efactura`
- 公司信息：`solo-cli company`
- 上传：`solo-cli upload file.pdf`
- 删除：`solo-cli queue delete <ID>`
- TUI：`solo-cli`（不指定命令时默认启用）
- 演示：`solo-cli demo`

## 配置
配置文件结构：
```json
{
  "username": "your_email@solo.ro",
  "password": "your_password",
  "company_id": "12345",
  "page_size": 100,
  "user_agent": "Mozilla/5.0 ..."
}
```

| 字段 | 是否必需 | 描述 |
|-------|----------|-------------|
| username | 是 | SOLO.ro 登录邮箱 |
| password | 是 | SOLO.ro 密码 |
| company_id | 否 | 用于显示公司档案的公司 ID（可在 /settings#!/company 页面的 Network 标签页中查找） |
| page_size | 否 | 每次获取的条目数量（默认值：100） |
| user_agent | 否 | 自定义 HTTP 用户 agent 字符串 |

## 命令

### summary [年份]
显示指定年份的账户摘要。
```bash
solo-cli summary          # Current year
solo-cli summary 2025     # Specific year
```
输出：年份、收入、支出、税款

### revenues
列出收入发票。
```bash
solo-cli revenues
solo-cli rev              # Alias
```
输出：发票编号、金额、币种、付款状态、客户名称

### expenses
列出支出。
```bash
solo-cli expenses
solo-cli exp              # Alias
```
输出：金额、币种、类别、供应商名称

### queue
列出支出队列中待处理的文档，或删除其中条目。
```bash
solo-cli queue            # List queue
solo-cli q                # Alias
solo-cli queue delete 123 # Delete item by ID
solo-cli q del 123        # Alias
```
输出：文档名称、已等待天数、是否逾期（含 ID）

### efactura
列出电子发票（e-Factura）文档。
```bash
solo-cli efactura
solo-cli ei               # Alias
```
输出：序列号、金额、币种、日期、交易方名称

### company
显示公司档案。
```bash
solo-cli company
```
输出：公司名称、CUI（罗马尼亚税务登记号）、注册号、地址

### upload <文件>
上传支出文档（PDF 或图片格式）。
```bash
solo-cli upload invoice.pdf
solo-cli up invoice.pdf   # Alias
```
输出：上传状态及确认信息

### demo
使用模拟数据启动 TUI（用于截图或测试，不调用真实 API）。
```bash
solo-cli demo
```

### tui
启动交互式 TUI 模式（未指定命令时默认启用）。
```bash
solo-cli tui
solo-cli                  # Same as above
```

## 全局选项

| 选项 | 短格式 | 描述 |
|--------|-------|-------------|
| --config | -c | 自定义配置文件路径 |
| --help | -h | 显示帮助信息 |
| --version | -v | 显示版本号 |

## 示例
```bash
# Basic usage
solo-cli summary
solo-cli revenues

# Custom config
solo-cli -c ~/work-config.json summary

# Pipe to grep
solo-cli expenses | grep -i "food"

# View specific year
solo-cli summary 2024

# Upload a document
solo-cli upload invoice.pdf

# Delete a queued item
solo-cli queue delete 123456
```

## 认证流程
1. 启动时，从 `~/.config/solo-cli/cookies.json` 加载 Cookie
2. 通过一次测试 API 调用验证 Cookie 有效性
3. 若有效，则复用缓存会话
4. 若无效或缺失，则使用配置文件中的凭据执行登录
5. 将新生成的 Cookie 保存供下次会话使用

## 故障排除
- **“凭据缺失”**：在 config.json 中填写您的 SOLO.ro 用户名和密码
- **“认证失败”**：检查凭据是否正确
- **“配置文件 JSON 格式错误”**：修复 config.json 中的语法错误
- **公司信息未显示**：在配置中添加 company_id（可选字段）