---
name: antigravity-balance
name_zh: 反重力平衡
description: 检查 Google Antigravity AI 模型配额/令牌余额。当用户询问其 Antigravity 使用情况、剩余令牌数、模型限制、配额状态或速率限制时使用。该 skill 通过检测本地 Antigravity 语言服务器进程并查询其 API 实现功能。
description_zh: 检查 Google Antigravity AI 模型配额/令牌余额。当用户询问其 Antigravity 使用情况、剩余令牌数、模型限制、配额状态或速率限制时使用。该 skill 通过检测本地 Antigravity 语言服务器进程并查询其 API 实现功能。
---
# Antigravity Balance

检查您的 Antigravity AI 模型配额与令牌余额。

## 快速开始

```bash
# Check quota (auto-detects local Antigravity process)
node scripts/agquota.js

# JSON output for parsing
node scripts/agquota.js --json

# Verbose output (debugging)
node scripts/agquota.js -v
```

## 工作原理

1. **进程检测**：查找正在运行的 `language_server_macos_arm`（或对应平台的等效进程）
2. **提取连接信息**：从进程参数中解析 `--extension_server_port` 和 `--csrf_token`
3. **端口发现**：扫描邻近端口以定位 HTTPS API 端点（通常为 extensionPort + 1）
4. **调用本地 API**：访问 `https://127.0.0.1:{port}/exa.language_server_pb.LanguageServerService/GetUserStatus`
5. **显示配额信息**：展示剩余百分比、重置时间及模型信息

## 输出格式

默认输出包含：
- 用户名、邮箱地址与订阅等级（tier）
- 模型名称及剩余配额百分比
- 可视化进度条（颜色编码：绿色表示 >50%，黄色表示 >20%，红色表示 ≤20%）
- 配额重置倒计时（例如：“4 小时 32 分钟”）

JSON 输出（`--json`）返回结构化数据：
```json
{
  "user": { "name": "...", "email": "...", "tier": "..." },
  "models": [
    { "label": "Claude Sonnet 4.5", "remainingPercent": 80, "resetTime": "..." }
  ],
  "timestamp": "2026-01-28T01:00:00.000Z"
}
```

## 要求

- Node.js（使用内置的 `https` 模块）
- Antigravity（或 Windsurf）必须处于运行状态

## 故障排除

若脚本执行失败，请按以下步骤排查：
1. 确保 Antigravity/Windsurf 正在运行
2. 检查语言服务器进程是否存在：`ps aux | grep language_server`
3. 该进程参数中必须包含 `--app_data_dir antigravity`（用于区别于其他 Codeium 衍生版本）

## 平台特定的进程名称

| 平台 | 进程名称 |
|----------|--------------|
| macOS（ARM） | `language_server_macos_arm` |
| macOS（Intel） | `language_server_macos` |
| Linux | `language_server_linux` |
| Windows | `language_server_windows_x64.exe` |