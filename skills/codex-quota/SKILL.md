---
name: codex-quota
name_zh: Codex配额
description: 使用本地会话日志检查 OpenAI Codex CLI 的速率限制状态（日/周配额）。便携式 Python 脚本。
description_zh: 使用本地会话日志检查 OpenAI Codex CLI 的速率限制状态（日/周配额）。便携式 Python 脚本。
---
# Skill：codex-quota

检查 OpenAI Codex CLI 的速率限制状态。

## 快速参考

```bash
# Run the included Python script
./codex-quota.py

# Or if installed to PATH
codex-quota
```

## 选项

```bash
codex-quota              # Show current quota (cached from latest session)
codex-quota --fresh      # Ping Codex first for live data
codex-quota --all        # Update all accounts, save to /tmp/codex-quota-all.json
codex-quota --json       # Output as JSON
codex-quota --help       # Show help
```

## 显示内容

- **主窗口**（5 小时）——短期速率限制
- **次窗口**（7 天）——每周速率限制
- 本地时区下的重置时间及倒计时
- 源会话文件及其时效

## 安装方法

将 `codex-quota.py` 复制至您的系统路径：
```bash
cp skills/codex-quota/codex-quota.py ~/bin/codex-quota
chmod +x ~/bin/codex-quota
```

## 工作原理

Codex CLI 将速率限制信息记录于每个会话文件（`~/.codex/sessions/YYYY/MM/DD/*.jsonl`）中，作为 `token_count` 事件的一部分。本工具：

1. 查找最新会话文件；
2. 提取其中最后一个 `rate_limits` 对象；
3. 格式化并展示该对象。

## 使用时机

- 启动高强度 Codex 工作前（检查周配额）；
- Codex 响应变慢时（可能遭遇速率限制）；
- 跨多个账户监控配额。