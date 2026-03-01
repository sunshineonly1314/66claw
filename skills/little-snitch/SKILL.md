---
name: little-snitch
name_zh: Little Snitch
description: 控制 macOS 上的 Little Snitch 防火墙。查看日志、管理配置文件与规则组、监控网络流量。当用户希望检查防火墙活动、启用/禁用配置文件或屏蔽列表，或排查网络连接问题时使用。
description_zh: 控制 macOS 上的 Little Snitch 防火墙。查看日志、管理配置文件与规则组、监控网络流量。当用户希望检查防火墙活动、启用/禁用配置文件或屏蔽列表，或排查网络连接问题时使用。
---
# Little Snitch CLI

控制 macOS 上的 Little Snitch 网络监控器/防火墙。

## 设置

在 **Little Snitch → 偏好设置 → 安全性 → 允许通过终端访问** 中启用 CLI 访问权限。

启用后，终端中即可使用 `littlesnitch` 命令。

⚠️ **安全警告**：littlesnitch 命令功能极为强大，可能被恶意软件滥用。启用访问权限后，您必须采取防护措施，防止不受信任的进程获取 root 权限。

参考文档：https://help.obdev.at/littlesnitch5/adv-commandline

## 命令

| 命令 | 是否需 root 权限？ | 描述 |
|---------|-------|-------------|
| `--version` | 否 | 显示版本号 |
| `restrictions` | 否 | 显示许可证状态 |
| `log` | 否 | 读取日志消息 |
| `profile` | 是 | 启用/停用配置文件 |
| `rulegroup` | 是 | 启用/禁用规则组与屏蔽列表 |
| `log-traffic` | 是 | 打印流量日志数据 |
| `list-preferences` | 是 | 列出所有偏好设置 |
| `read-preference` | 是 | 读取某项偏好设置的值 |
| `write-preference` | 是 | 写入某项偏好设置的值 |
| `export-model` | 是 | 导出数据模型（备份） |
| `restore-model` | 是 | 从备份恢复 |
| `capture-traffic` | 是 | 捕获进程流量 |

## 示例

### 查看近期日志（无需 root）
```bash
littlesnitch log --last 10m --json
```

### 实时流式日志（无需 root）
```bash
littlesnitch log --stream
```

### 检查许可证状态（无需 root）
```bash
littlesnitch restrictions
```

### 启用配置文件（需 root）
```bash
sudo littlesnitch profile --activate "Silent Mode"
```

### 停用全部配置文件（需 root）
```bash
sudo littlesnitch profile --deactivate-all
```

### 启用/禁用规则组（需 root）
```bash
sudo littlesnitch rulegroup --enable "My Rules"
sudo littlesnitch rulegroup --disable "Blocklist"
```

### 查看流量历史记录（需 root）
```bash
sudo littlesnitch log-traffic --begin-date "2026-01-25 00:00:00"
```

### 实时流式流量（需 root）
```bash
sudo littlesnitch log-traffic --stream
```

### 备份配置（需 root）
```bash
sudo littlesnitch export-model > backup.json
```

## 日志选项

| 选项 | 描述 |
|--------|-------------|
| `--last <time>[m\|h\|d]` | 显示最近 N 分钟/小时/天内的条目 |
| `--stream` | 实时流式输出消息 |
| `--json` | 以 JSON 格式输出 |
| `--predicate <string>` | 使用谓词进行过滤 |

## 注意事项

- 仅支持 macOS
- 多数命令需 `sudo`（root 权限）
- 配置文件：预定义的规则集（例如“静默模式”、“提醒模式”）
- 规则组：自定义规则集合与屏蔽列表