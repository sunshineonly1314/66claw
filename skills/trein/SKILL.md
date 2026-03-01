---
name: trein
name_zh: Trein
description: 通过 trein CLI 查询荷兰铁路公司（NS）的列车发车信息、行程规划、运行异常及车站检索。
description_zh: 通过 trein CLI 查询荷兰铁路公司（NS）的列车发车信息、行程规划、运行异常及车站检索。
homepage: https://github.com/joelkuijper/trein
metadata: {"clawdbot":{"emoji":"🚆","requires":{"bins":["trein"],"env":["NS_API_KEY"]},"primaryEnv":"NS_API_KEY","install":[{"id":"npm","kind":"node","package":"trein","bins":["trein"],"label":"Install trein (npm)"},{"id":"download-mac-arm","kind":"download","url":"https://github.com/joelkuijper/trein/releases/latest/download/trein-darwin-arm64","bins":["trein"],"label":"Download (macOS Apple Silicon)","os":["darwin"]},{"id":"download-mac-x64","kind":"download","url":"https://github.com/joelkuijper/trein/releases/latest/download/trein-darwin-x64","bins":["trein"],"label":"Download (macOS Intel)","os":["darwin"]},{"id":"download-linux","kind":"download","url":"https://github.com/joelkuijper/trein/releases/latest/download/trein-linux-x64","bins":["trein"],"label":"Download (Linux x64)","os":["linux"]}]}}
---
# trein —— 荷兰铁路 CLI 工具

一款面向 NS（荷兰铁路公司）API 的命令行工具，支持实时列车发车查询、行程规划、运行异常通告及车站检索。

## 安装

npm (recommended):
```bash
npm i -g trein
```

或从 [GitHub 发布页](https://github.com/joelkuijper/trein/releases) 下载独立二进制文件。

## 配置

请访问 https://apiportal.ns.nl/ 获取 API 密钥，并完成设置：
```bash
export NS_API_KEY="your-api-key"
```

或创建 `~/.config/trein/trein.config.json` 文件：
```json
{ "apiKey": "your-api-key" }
```

## 命令列表

### 列车发车信息
```bash
trein departures "Amsterdam Centraal"
trein d amsterdam
trein d amsterdam --json  # structured output
```

### 行程规划
```bash
trein trip "Utrecht" "Den Haag Centraal"
trein t utrecht denhaag --json
```

### 运行异常通告
```bash
trein disruptions
trein disruptions --json
```

### 车站检索
```bash
trein stations rotterdam
trein s rotterdam --json
```

### 别名（快捷方式）
```bash
trein alias set home "Amsterdam Centraal"
trein alias set work "Rotterdam Centraal"
trein alias list
trein d home  # uses alias
```

## 使用提示
- 所有命令均可添加 `--json` 参数，以获得结构化输出，便于解析
- 车站名称支持模糊匹配（例如输入 “adam” 可匹配到 “Amsterdam Centraal”）
- 别名保存于配置文件中，可在命令中替代车站全名使用