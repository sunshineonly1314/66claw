---
name: codex-account-switcher
name_zh: Codex账号切换
description: 管理多个 OpenAI Codex 账户。捕获当前登录令牌，并即时在账户间切换。
description_zh: 管理多个 OpenAI Codex 账户。捕获当前登录令牌，并即时在账户间切换。
metadata:
  clawdbot:
    emoji: "🎭"
    requires:
      bins: ["python3"]
---
# Codex 账户切换器

通过交换认证令牌文件，管理多个 OpenAI Codex 身份（例如个人账户与工作账户）。

## 使用方法

### 1. 列出账户
显示已保存的账户（当前激活的账户右侧标有 `ACTIVE`）。默认输出为紧凑格式。

- `--verbose` 包含刷新时间 + 令牌有效期（用于调试）
- `--json` 以 JSON 格式输出详细信息
```bash
./codex-accounts.py list
```

如需包含邮箱地址/诊断信息：
```bash
./codex-accounts.py list --verbose
```

### 2. 添加账户
交互式向导，用于捕获登录状态。

- **始终启动全新的浏览器登录流程**（`codex logout && codex login`），以便您明确选择要捕获的身份。
- 每次登录后，均会保存一份快照。
- 在交互式终端中，将询问您是否要添加另一个账户。
- 当以非交互方式调用（例如通过 Clawdbot）时，该工具以**单次运行模式**执行（不提示“是否添加另一个”）。
- 命名账户时，**按 Enter 键**可接受默认名称（即检测到的邮箱地址的本地部分，例如从 `oliver@…` 中提取的 `oliver`）。

```bash
./codex-accounts.py add
```

### 3. 切换账户
立即切换至另一活跃登录状态。
```bash
./codex-accounts.py use work
```

### 4. 自动切换至配额最优账户
检查所有账户，并自动切换至本周剩余配额最多的账户。
```bash
./codex-accounts.py auto
./codex-accounts.py auto --json
```

输出：
```
🔄 Checking quota for 2 account(s)...

  → sylvia... weekly 27% used
  → oliver... weekly 100% used

✅ Switched to: sylvia
   Weekly quota: 27% used (73% available)

All accounts:
   sylvia: 27% weekly ←
   oliver: 100% weekly
```

## 工作原理

- 将 `auth.json` 文件存储于 `~/.codex/accounts/<name>.json` 目录中。
- 通过对 JWT `id_token` 进行解码以提取邮箱地址，从而识别各账户。
- “切换”操作仅是将 `~/.codex/auth.json` 文件覆盖为已保存的对应副本。

## 安装方法

将脚本添加至您的系统路径，以便便捷调用：
```bash
ln -s $(pwd)/codex-accounts.py ~/bin/codex-accounts
```