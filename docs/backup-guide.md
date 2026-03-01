# OpenClawCN 数据备份指南

> 适用于：所有版本用户（moltbot / moldbot / clawdbot / clawdbotcn / openclawcn）。
> 升级、重装系统、换电脑前，请先运行备份脚本。
> 脚本会自动检测哪些数据存在，不存在的自动跳过，不会报错。

---

## 一、需要备份的数据清单

### 1.1 数据在哪里？

你的数据可能分布在 **两个位置**，取决于你用的版本和配置：

| 位置 | 说明 | 谁会有 |
|------|------|--------|
| C 盘用户目录（Windows）或 `~/`（macOS） | 默认数据位置 | 所有用户都可能有 |
| 安装目录（如 `E:\openclawcn`） | 设了 `OPENCLAWCN_HOME` 后数据写在这里 | 新版本用户 / 便携模式用户 |

> **两边都要备份**，脚本会自动处理，存在就备份，不存在就跳过。

### 1.2 不同版本的目录名

| 目录名 | 对应版本 |
|--------|----------|
| `.moltbot/` | 最早版本 |
| `.moldbot/` | 早期版本 |
| `.clawdbot/` | 旧版本 |
| `.clawdbotcn/` | 早期 CN 版 |
| `.openclawcn/` | 当前版本 |

### 1.3 目录内的重要数据

以下是各版本可能存在的数据，**不是每个用户都有全部内容**，脚本会自动检测：

| 数据 | 重要性 | 说明 |
|------|--------|------|
| `memory/` | ★★★ 极高 | 记忆数据库，丢失不可恢复 |
| `workspace/memory/` | ★★★ 极高 | 用户画像、对话归档，丢失不可恢复 |
| `workspace/MEMORY.md` | ★★★ 极高 | 用户手写记忆笔记 |
| `credentials/` | ★★★ 极高 | 登录认证凭据，丢失需重新授权 |
| `.master-key` | ★★★ 极高 | 加密主密钥，丢失则加密数据无法解密 |
| `identity/` | ★★★ 极高 | 身份标识 |
| `sessions/` | ★★ 高 | 老版本的对话记录 |
| `agent/` | ★★ 高 | 老版本单 Agent 数据 |
| `agents/` | ★★ 高 | 新版本多 Agent 数据 + 会话记录 |
| `*.json` 配置文件 | ★★ 高 | 主配置（openclawcn.json / clawdbot.json 等） |
| `.env` | ★★ 高 | API 密钥、环境变量 |
| `workspace/*.md` | ★★ 高 | Agent 人设 / 指令（SOUL.md、AGENTS.md 等） |
| `extensions/` | ★ 中 | 扩展插件数据（WhatsApp 等） |
| `pairing/` | ★ 中 | 设备配对数据 |
| `media/` | ★ 中 | 媒体文件缓存 |
| `hooks/` | ★ 中 | 用户自写钩子脚本 |
| `telegram/` | ★ 中 | Telegram 数据（如果用了） |
| `voice-models/` | ★ 中 | 语音模型（如果用了） |
| 其它运行时目录 | - | 脚本整个目录打包，自动全部覆盖 |

> **不需要备份**（会自动重建）：`logs/`、`*-cache.json`、`tool-index.sqlite`、`skills-index.json` 等缓存文件。
> 但脚本是整个目录复制，所以这些也会一起带走，不影响使用。

---

## 二、Windows 用户备份命令（CMD）

### 使用方法

1. 按 `Win + R`，输入 `cmd`，回车打开命令提示符
2. **全选复制**下面的命令，在 CMD 窗口中**右键粘贴**，回车执行
3. 等待执行完毕，桌面会出现 `openclawcn-backup` 文件夹

```cmd
@echo off & setlocal
echo.
echo ============================================
echo    OpenClawCN 数据备份
echo ============================================
echo.
set "B=%USERPROFILE%\Desktop\openclawcn-backup"
mkdir "%B%" 2>nul
echo 备份位置: %B%
echo.
echo [1/3] 备份 C 盘用户目录...
for %%d in (.openclawcn .clawdbotcn .clawdbot .moldbot .moltbot) do (
    if exist "%USERPROFILE%\%%d" (
        xcopy "%USERPROFILE%\%%d" "%B%\C盘\%%d\" /E /I /H /Y /Q >nul 2>nul
        echo   [OK] %%d
    )
)
echo.
echo [2/3] 备份安装目录 E:\openclawcn ...
if exist "E:\openclawcn\.env" (
    mkdir "%B%\安装目录" 2>nul
    copy "E:\openclawcn\.env" "%B%\安装目录\.env" /Y >nul 2>nul
    echo   [OK] .env
)
if exist "E:\openclawcn\.portable" (
    copy "E:\openclawcn\.portable" "%B%\安装目录\.portable" /Y >nul 2>nul
    echo   [OK] .portable
)
for %%d in (.openclawcn .clawdbotcn .clawdbot .moldbot .moltbot) do (
    if exist "E:\openclawcn\data\%%d" (
        xcopy "E:\openclawcn\data\%%d" "%B%\安装目录-data\%%d\" /E /I /H /Y /Q >nul 2>nul
        echo   [OK] data\%%d
    )
)
echo.
echo [3/3] 验证备份...
echo.
echo -------- 备份结果 --------
set "OK=0"
set "MISS=0"
if exist "%B%\安装目录\.env" (echo   [OK] .env 配置文件 & set /a OK+=1) else (echo   [--] .env 未找到 & set /a MISS+=1)
if exist "%B%\C盘\.openclawcn" (echo   [OK] C盘 .openclawcn & set /a OK+=1) else (echo   [--] C盘 .openclawcn 未找到 & set /a MISS+=1)
if exist "%B%\C盘\.clawdbotcn" (echo   [OK] C盘 .clawdbotcn & set /a OK+=1) else (echo   [--] C盘 .clawdbotcn 未找到 & set /a MISS+=1)
if exist "%B%\C盘\.clawdbot" (echo   [OK] C盘 .clawdbot & set /a OK+=1) else (echo   [--] C盘 .clawdbot 未找到 & set /a MISS+=1)
if exist "%B%\C盘\.moldbot" (echo   [OK] C盘 .moldbot & set /a OK+=1) else (echo   [--] C盘 .moldbot 未找到 & set /a MISS+=1)
if exist "%B%\C盘\.moltbot" (echo   [OK] C盘 .moltbot & set /a OK+=1) else (echo   [--] C盘 .moltbot 未找到 & set /a MISS+=1)
if exist "%B%\安装目录-data\.openclawcn" (echo   [OK] 安装目录 .openclawcn & set /a OK+=1) else (echo   [--] 安装目录 .openclawcn 未找到 & set /a MISS+=1)
if exist "%B%\安装目录-data\.clawdbotcn" (echo   [OK] 安装目录 .clawdbotcn & set /a OK+=1) else (echo   [--] 安装目录 .clawdbotcn 未找到 & set /a MISS+=1)
if exist "%B%\安装目录-data\.clawdbot" (echo   [OK] 安装目录 .clawdbot & set /a OK+=1) else (echo   [--] 安装目录 .clawdbot 未找到 & set /a MISS+=1)
if exist "%B%\安装目录-data\.moldbot" (echo   [OK] 安装目录 .moldbot & set /a OK+=1) else (echo   [--] 安装目录 .moldbot 未找到 & set /a MISS+=1)
if exist "%B%\安装目录-data\.moltbot" (echo   [OK] 安装目录 .moltbot & set /a OK+=1) else (echo   [--] 安装目录 .moltbot 未找到 & set /a MISS+=1)
echo.
echo ============================================
echo   完成！[OK] 表示已备份，[--] 表示不存在已跳过
echo   备份文件夹: 桌面\openclawcn-backup
echo ============================================
echo.
pause
```

> 如果你的安装路径不是 `E:\openclawcn`，把脚本里的 `E:\openclawcn` 全部替换为你的实际路径。

---

## 三、macOS 用户备份命令（Terminal）

### 使用方法

1. 打开 **终端（Terminal）**
2. **全选复制**下面的命令，粘贴到终端，回车执行
3. 等待执行完毕，桌面会出现 `openclawcn-backup` 文件夹

```bash
#!/bin/bash
echo ""
echo "============================================"
echo "   OpenClawCN 数据备份"
echo "============================================"
echo ""
B=~/Desktop/openclawcn-backup
mkdir -p "$B"
echo "备份位置: $B"
echo ""

# -------- 改成你的安装路径 --------
INSTALL_DIR=~/openclawcn
# ----------------------------------

echo "[1/3] 备份用户主目录..."
for d in .openclawcn .clawdbotcn .clawdbot .moldbot .moltbot; do
  [ -d ~/"$d" ] && cp -a ~/"$d" "$B/用户主目录/$d" 2>/dev/null && echo "  [OK] ~/$d"
done

echo ""
echo "[2/3] 备份安装目录..."
mkdir -p "$B/安装目录" 2>/dev/null
[ -f "$INSTALL_DIR/.env" ] && cp "$INSTALL_DIR/.env" "$B/安装目录/.env" 2>/dev/null && echo "  [OK] .env"
[ -f "$INSTALL_DIR/.portable" ] && cp "$INSTALL_DIR/.portable" "$B/安装目录/.portable" 2>/dev/null && echo "  [OK] .portable"
for d in .openclawcn .clawdbotcn .clawdbot .moldbot .moltbot; do
  [ -d "$INSTALL_DIR/data/$d" ] && cp -a "$INSTALL_DIR/data/$d" "$B/安装目录-data/$d" 2>/dev/null && echo "  [OK] data/$d"
done

echo ""
echo "[3/3] 验证备份..."
echo ""
echo "-------- 备份结果 --------"
[ -f "$B/安装目录/.env" ] && echo "  [OK] .env 配置文件" || echo "  [--] .env 未找到"
for d in .openclawcn .clawdbotcn .clawdbot .moldbot .moltbot; do
  [ -d "$B/用户主目录/$d" ] && echo "  [OK] 主目录 $d" || echo "  [--] 主目录 $d 未找到"
  [ -d "$B/安装目录-data/$d" ] && echo "  [OK] 安装目录 $d" || echo "  [--] 安装目录 $d 未找到"
done
echo ""
echo "============================================"
echo "  完成！[OK] 表示已备份，[--] 表示不存在已跳过"
echo "  备份文件夹: 桌面/openclawcn-backup"
echo "============================================"
echo ""
du -sh "$B" 2>/dev/null
```

> 如果你的安装路径不是 `~/openclawcn`，请修改脚本开头的 `INSTALL_DIR=` 那一行。

---

## 四、备份后的文件夹结构

```
桌面/openclawcn-backup/
│
├── C盘/（Windows）或 用户主目录/（macOS）
│   ├── .openclawcn/        ← 当前版本（有就备份）
│   ├── .clawdbotcn/        ← 早期CN版（有就备份）
│   ├── .clawdbot/          ← 旧版（有就备份）
│   ├── .moldbot/           ← 更早版本（有就备份）
│   └── .moltbot/           ← 最早版本（有就备份）
│
├── 安装目录/
│   ├── .env                ← API 密钥配置 ★★★
│   └── .portable           ← 便携模式标记
│
└── 安装目录-data/
    ├── .openclawcn/        ← 同上，有就备份
    ├── .clawdbotcn/
    ├── .clawdbot/
    ├── .moldbot/
    └── .moltbot/

每个状态目录内部可能包含（取决于你的版本）：
├── memory/                 ← 记忆数据库 ★★★
├── credentials/            ← 认证凭据 ★★★
├── .master-key             ← 加密主密钥 ★★★
├── identity/               ← 身份标识 ★★★
├── workspace/              ← 工作区（记忆、人设、指令等）★★★
├── sessions/               ← 对话记录（老版本）★★
├── agent/                  ← Agent 数据（老版本单Agent）★★
├── agents/                 ← Agent 数据（新版本多Agent）★★
├── openclawcn.json         ← 主配置（新版本）★★
├── clawdbot.json           ← 主配置（老版本）★★
├── extensions/             ← 扩展插件 ★
├── pairing/                ← 配对数据 ★
├── media/                  ← 媒体缓存 ★
├── hooks/                  ← 钩子脚本 ★
└── ...                     ← 其它运行时数据

★★★ = 丢失不可恢复    ★★ = 需重新配置    ★ = 可自动重建
```

---

## 五、注意事项

1. **先停止 OpenClawCN 再备份**，避免数据库文件被锁定导致复制不完整
2. **C 盘和安装目录都要备份** — 老版本数据在 C 盘，新版本可能在安装目录，脚本两边都会处理
3. **`.env` 包含明文 API 密钥** — 备份后妥善保管，不要上传到公开位置
4. **`[--]` 未找到是正常的** — 说明你这个版本没有这个数据，不影响备份完整性
5. 安装路径不同的用户请替换脚本中的路径（Windows 替换 `E:\openclawcn`，macOS 替换 `~/openclawcn`）
