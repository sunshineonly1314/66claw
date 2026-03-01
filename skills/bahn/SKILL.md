---
name: bahn
name_zh: 德铁
description: 使用 bahn-cli 工具查询德国铁路（Deutsche Bahn）列车班次。当您需要查询德国车站之间的列车连接、查看发车时间或协助旅行规划时使用。支持“Berlin Hbf”、“München”、“Hannover”等常见车站名称。
description_zh: 使用 bahn-cli 工具查询德国铁路（Deutsche Bahn）列车班次。当您需要查询德国车站之间的列车连接、查看发车时间或协助旅行规划时使用。支持“Berlin Hbf”、“München”、“Hannover”等常见车站名称。
---
# 德国铁路（Deutsche Bahn）CLI

使用 `bahn-cli` 工具查询列车班次。

## 安装

该工具应全局安装或安装至工作区。若尚未安装：

```bash
cd ~/Code/bahn-cli && npm install
```

## 使用方法

查询列车连接：

```bash
cd ~/Code/bahn-cli && node index.js search "<from>" "<to>" [options]
```

### 选项

- `--date YYYY-MM-DD` —— 出发日期（默认为当天）
- `--time HH:MM` —— 出发时间（默认为当前时间）
- `--results <number>` —— 显示结果数量（默认为 5 条）

### 示例

查询汉诺威（Hannover）至波恩（Bonn）的列车连接：
```bash
cd ~/Code/bahn-cli && node index.js search "Hannover Hbf" "Bonn Hbf" --results 3
```

指定日期与时间查询：
```bash
cd ~/Code/bahn-cli && node index.js search "Berlin" "München" --date 2026-02-05 --time 14:30
```

## 车站名称

- 使用常见的德语车站名称
- “Hbf” 表示 Hauptbahnhof（主火车站）
- 示例： “Berlin Hbf”、“München Hbf”、“Frankfurt(Main)Hbf”、“Köln Hbf”
- 车站名称不区分大小写

## 输出内容

该工具显示以下信息：
- 出发与到达时间
- 站台编号
- 总行程时长
- 换乘次数
- 含换乘连接的中途停靠站
- 列车编号（如 ICE、IC、RE 等）

## 注意事项

- 该 CLI 使用 db-vendo-client 库
- 输出中部分车站名称可能显示为 “undefined”（属显示问题，不影响功能）
- 直达列车优先列出
- 时间采用 24 小时制