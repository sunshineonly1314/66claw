---
name: george
name_zh: George
description: "使用 Playwright 自动化 George 网上银行（奥地利 Erste Bank / Sparkasse）：登录/会话（需手机端审批）、列出账户及余额、下载账单/导出文件/交易明细（CAMT53、MT940、CSV/JSON/OFX/XLSX）。当用户提及 George、Erste/Sparkasse、账户账单、CAMT53/MT940 或交易导出时启用。"
description_zh: 使用 Playwright 自动化 George 网上银行（奥地利 Erste Bank / Sparkasse）：登录/会话（需手机端审批）、列出账户及余额、下载账单/导出文件/交易明细（CAMT53、MT940、CSV/JSON/OFX/XLSX）。当用户提及 George、Erste/Sparkasse、账户账单、CAMT53/MT940 或交易导出时启用。
summary: "George（奥地利 Erste/Sparkasse）银行自动化：登录、账户/余额查询、账单与交易导出。"
version: 1.0.7
homepage: https://github.com/odrobnik/george-skill
metadata: {"clawdbot":{"emoji":"🏦","requires":{"bins":["python3","playwright"]}}}
---
# George 银行自动化

面向 **George（奥地利 Erste Bank / Sparkasse）** 的模块化自动化工具。

**入口点：** `{baseDir}/scripts/george.py`

## 设置

### 快速设置（推荐）

```bash
python3 {baseDir}/scripts/george.py setup

# First account sync (auto-fetches if config has none):
python3 {baseDir}/scripts/george.py accounts
```

`setup` 执行以下操作：
- 提示您输入 **George 用户编号 / 用户名** (`user_id`)  
- 写入 `~/.clawdbot/george/config.json`（账户以数组形式存储）  
- 确保已安装 Playwright，并自动安装 Chromium 浏览器  

### 手动设置（替代方案）

```bash
pipx install playwright
playwright install chromium

mkdir -p ~/.clawdbot/george
cat > ~/.clawdbot/george/config.json <<EOF
{
  "user_id": "YOUR_USER_ID",
  "accounts": {}
}
EOF

python3 {baseDir}/scripts/george.py accounts
```

## 命令

### 会话管理

```bash
python3 {baseDir}/scripts/george.py login
python3 {baseDir}/scripts/george.py logout
```

会话持久化保存于 `~/.clawdbot/george/.pw-profile/`（或 `--dir`）。

### 账户

```bash
python3 {baseDir}/scripts/george.py accounts          # list from config; if empty, fetch + save into config.json
python3 {baseDir}/scripts/george.py accounts --fetch  # refresh from George and update config.json
```

### 余额

```bash
python3 {baseDir}/scripts/george.py balances
```

### 账单（PDF 格式）

```bash
python3 {baseDir}/scripts/george.py statements -a main -y 2025 -q 4
```

注意：当前仅验证了 **Q4 账单 ID 映射**。

### 数据导出（记账用途）

```bash
python3 {baseDir}/scripts/george.py export              # CAMT53 (default)
python3 {baseDir}/scripts/george.py export --type mt940
```

### 交易明细

```bash
python3 {baseDir}/scripts/george.py transactions -a main                  # CSV (default)
python3 {baseDir}/scripts/george.py transactions -a main -f json
python3 {baseDir}/scripts/george.py transactions -a main -f ofx
python3 {baseDir}/scripts/george.py transactions -a main -f xlsx

python3 {baseDir}/scripts/george.py transactions -a main --from 01.01.2025 --to 31.01.2025
```

支持的格式：`csv`（默认）、`json`、`ofx`、`xlsx`

## 全局选项

```
--visible          Show browser window (debugging)
--dir DIR          State directory (default: ~/.clawdbot/george; override via GEORGE_DIR)
--login-timeout N  Seconds to wait for phone approval (default: 60)
--user-id ID       Override user number/username (or set GEORGE_USER_ID)
```

您也可将 `GEORGE_USER_ID=...` 放入 `~/.clawdbot/george/.env` 中。

## 输出 / 状态存储位置

- **配置文件：** `~/.clawdbot/george/config.json`（或 `--dir`）  
- **会话文件：** `~/.clawdbot/george/.pw-profile/`（或 `--dir`）  
- **下载目录：** `~/.clawdbot/george/data/`（或 `--dir`）  

## 安全须知

- 本 skill 会将 **银行文档与交易导出文件** 下载至本地磁盘，请将状态目录视为敏感数据。  
- 登录需通过 George App 进行 **手机端审批**；您的凭证 **不会** 存储于 skill 文件夹中。  
- 切勿记录 OAuth token（George 有时会在 URL 片段中返回 token）。