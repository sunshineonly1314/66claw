---
name: monarch-money
name_zh: Monarch Money
description: 用于 Monarch Money 预算管理的 TypeScript 库与 CLI。支持按日期/商户/金额搜索交易、更新分类、列出账户与预算、管理身份验证。当用户询问 Monarch Money 交易、希望对支出进行分类、需要查找特定交易，或希望自动化预算任务时使用。
description_zh: 用于 Monarch Money 预算管理的 TypeScript 库与 CLI。支持按日期/商户/金额搜索交易、更新分类、列出账户与预算、管理身份验证。当用户询问 Monarch Money 交易、希望对支出进行分类、需要查找特定交易，或希望自动化预算任务时使用。
metadata:
  clawdbot:
    requires:
      env: ["MONARCH_EMAIL", "MONARCH_PASSWORD", "MONARCH_MFA_SECRET"]
    install:
      - id: node
        kind: node
        package: "."
        bins: ["monarch-money"]
        label: "Install Monarch Money CLI"
---
# Monarch Money

用于 Monarch Money 预算自动化的 CLI 与 TypeScript 库。

## 前置条件

### 环境变量（必需）

| 变量 | 是否必需 | 描述 |
|----------|----------|-------------|
| `MONARCH_EMAIL` | **是** | Monarch Money 账户邮箱 |
| `MONARCH_PASSWORD` | **是** | Monarch Money 账户密码 |
| `MONARCH_MFA_SECRET` | **是** | MFA 的 TOTP 密钥（见下文） |

### 获取您的 MFA 密钥

Monarch Money 要求启用 MFA。请生成 TOTP 密钥：

1. 登录 https://app.monarchmoney.com
2. 进入 设置 > 安全 > 双重身份验证
3. 若 MFA 已启用：先禁用再重新启用，以获取新密钥
4. 显示二维码时：点击“无法扫描？查看设置密钥”
5. 复制密钥（base32 字符串，如 `JBSWY3DPEHPK3PXP`）
6. 使用认证器应用在 Monarch Money 中完成 MFA 设置
7. 设置密钥：`export MONARCH_MFA_SECRET="YOUR_SECRET"`

## 快速入门

```bash
# Check setup
monarch-money doctor

# Login (uses env vars by default)
monarch-money auth login

# List transactions
monarch-money tx list --limit 10

# List categories
monarch-money cat list
```

## CLI 命令

### 身份验证

```bash
# Login with environment variables
monarch-money auth login

# Login with explicit credentials
monarch-money auth login -e email@example.com -p password --mfa-secret SECRET

# Check auth status
monarch-money auth status

# Logout
monarch-money auth logout
```

### 交易

```bash
# List recent transactions
monarch-money tx list --limit 20

# Search by date
monarch-money tx list --start-date 2026-01-01 --end-date 2026-01-31

# Search by merchant
monarch-money tx list --merchant "Walmart"

# Get transaction by ID
monarch-money tx get <transaction_id>

# Update category
monarch-money tx update <id> --category <category_id>

# Update merchant name
monarch-money tx update <id> --merchant "New Name"

# Add notes
monarch-money tx update <id> --notes "My notes here"
```

### 分类

```bash
# List all categories
monarch-money cat list

# List with IDs (for updates)
monarch-money cat list --show-ids
```

### 账户

```bash
# List accounts
monarch-money acc list

# Show account details
monarch-money acc get <account_id>
```

### 医生（诊断）

```bash
# Run diagnostic checks
monarch-money doctor
```

检查项：
- 环境变量是否已设置
- API 连通性
- 会话有效性
- Node.js 版本

## 库使用方式

直接导入并使用 TypeScript 库：

```typescript
import { MonarchClient } from 'monarch-money';

const client = new MonarchClient({ baseURL: 'https://api.monarch.com' });

// Login
await client.login({
  email: process.env.MONARCH_EMAIL,
  password: process.env.MONARCH_PASSWORD,
  mfaSecretKey: process.env.MONARCH_MFA_SECRET
});

// Get transactions
const transactions = await client.transactions.getTransactions({ limit: 10 });

// Get categories
const categories = await client.categories.getCategories();

// Get accounts
const accounts = await client.accounts.getAll();
```

## 常见工作流

### 查找并更新某笔交易

```bash
# 1. Find the transaction
monarch-money tx list --date 2026-01-15 --merchant "Target"

# 2. Get category ID
monarch-money cat list --show-ids

# 3. Update the transaction
monarch-money tx update <transaction_id> --category <category_id>
```

### 按日期范围搜索交易

```bash
monarch-money tx list --start-date 2026-01-01 --end-date 2026-01-31 --limit 100
```

### 检查预算状态

```bash
monarch-money acc list
```

## 错误处理

| 错误 | 解决方案 |
|-------|----------|
| “未登录” | 运行 `monarch-money auth login` |
| “需要 MFA 验证码” | 设置 `MONARCH_MFA_SECRET` 环境变量 |
| “凭据无效” | 在 app.monarchmoney.com 验证邮箱/密码是否有效 |
| “会话已过期” | 再次运行 `monarch-money auth login` |

## 会话管理

会话缓存在本地路径 `~/.mm/session.json`。首次登录后，后续命令将复用已保存的会话以加快执行速度。

清除会话：`monarch-money auth logout`

## 参考资料

- [API.md](references/API.md) — GraphQL API 详情与高级用法
- [TROUBLESHOOTING.md](references/TROUBLESHOOTING.md) — 常见问题与解决方案