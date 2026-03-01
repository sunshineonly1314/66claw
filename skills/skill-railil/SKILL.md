---
name: skill-railil
name_zh: 芬兰铁路技能
description: 使用 railil CLI 查询以色列铁路（Israel Rail）列车时刻表。支持车站间路线的模糊搜索、按日期/时间筛选，并可输出为多种格式（JSON、Markdown、表格）。
description_zh: 使用 railil CLI 查询以色列铁路（Israel Rail）列车时刻表。支持车站间路线的模糊搜索、按日期/时间筛选，并可输出为多种格式（JSON、Markdown、表格）。
homepage: https://github.com/lirantal/railil
metadata: {"clawdbot":{"emoji":"🚆","requires":{"bins":["railil"]},"install":[{"id":"node","kind":"node","package":"railil","bins":["railil"],"label":"Install railil (npm)"}]}}
---
# Railil CLI

一款用于查询以色列铁路列车时刻表的命令行工具。

## 安装

```bash
npm install -g railil
```

## 使用方法

CLI 支持车站名称的模糊匹配。

### 基础搜索

查询两站之间即将出发的列车：

```bash
railil --from "Tel Aviv" --to "Haifa"
```

### 日期与时间

查询指定日期和时间的车次：

```bash
railil --from "Beer Sheva" --to "Tel Aviv" --time 08:00 --date 2023-11-01
```

### 输出格式

如需机器可读输出或特定格式化，请使用 `--output` 参数。  
支持的格式包括：`text`（默认）、`json`、`table`、`markdown`。

**JSON 输出（推荐用于 agents）：**  
```bash
railil --from "Tel Aviv" --to "Haifa" --output json
```

**Markdown 输出：**  
```bash
railil --from "Tel Aviv" --to "Haifa" --output markdown
```

### 参数选项

- `-f, --from <station>`：始发站名称（支持模糊匹配）。  
- `-t, --to <station>`：到达站名称（支持模糊匹配）。  
- `-d, --date <date>`：出行日期。  
- `-h, --time <time>`：出行时间（HH:MM 格式）。  
- `-l, --limit <number>`：限制返回结果数量。  
- `-o, --output <format>`：输出格式（`json`、`text`、`table`、`markdown`）。  
- `--help`：显示帮助信息。

## 示例

**查找从本·古里安机场前往耶路撒冷的接下来 3 班列车：**  
```bash
railil --from "Ben Gurion" --to "Jerusalem" --limit 3
```

**以 JSON 格式获取明日早上的时刻表：**  
```bash
railil --from "Haifa" --to "Tel Aviv" --time 07:30 --output json
```