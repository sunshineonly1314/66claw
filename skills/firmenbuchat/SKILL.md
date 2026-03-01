---
name: firmenbuchat
name_zh: Firmenbuch AT
description: 用于访问奥地利公司注册簿（HVD WebServices）的命令行工具（CLI）。
description_zh: 用于访问奥地利公司注册簿（HVD WebServices）的命令行工具（CLI）。
homepage: https://github.com/pasogott/firmenbuch-aip
version: 0.2.3
metadata: {"clawdbot":{"emoji":"🇦🇹","requires":{"bins":["firmenbuchat"]},"install":[{"id":"brew","kind":"brew","formula":"pasogott/tap/firmenbuchat","bins":["firmenbuchat"],"label":"Install firmenbuchat (brew)"},{"id":"uv","kind":"download","command":"uv add git+https://github.com/pasogott/firmenbuch-aip.git","label":"Install firmenbuchat (uv)"}]}}
---
# firmenbuchat

配置（API 密钥）
- `firmenbuchat config set-key`  
- `export FIRMENBUCH_API_KEY="dein-key"`  
- `.env`：`cp .env.example .env`，然后执行 `firmenbuchat --env-file /pfad/zu/.env <command>`  

帮助（全部命令）
- `firmenbuchat help`  

常用命令
- 版本：`firmenbuchat version`  
- 信息：`firmenbuchat info`  
- 显示配置：`firmenbuchat config show`  
- 删除配置：`firmenbuchat config delete --force`  

公司注册簿摘录（Firmenbuchauszug）
- `firmenbuchat auszug <FNR> [--stichtag YYYY-MM-DD] [--umfang "Kurzinformation"|"aktueller Auszug"|"historischer Auszug"]`  

公司搜索（Firmensuche）
- `firmenbuchat suche firma <SUCHBEGRIFF> [--bereich 1-6] [--exakt] [--gericht 007] [--rechtsform GES]`  

文件搜索（Urkundensuche）
- `firmenbuchat suche urkunde <FNR> [--output table|json|raw] [--limit 50] [--offset 0]`  

文件（Urkunden）
- 信息：`firmenbuchat urkunde info <URKUNDEN_KEY>`  
- 下载：`firmenbuchat urkunde download <URKUNDEN_KEY> [--output PATH]`  

变更记录（Veränderungen）
- 公司：`firmenbuchat veraenderungen firmen [--von YYYY-MM-DD] [--bis YYYY-MM-DD] [--gericht 007] [--rechtsform GES]`  
- 文件：`firmenbuchat veraenderungen urkunden [--von YYYY-MM-DD] [--bis YYYY-MM-DD]`  

诊断（Diagnose）
- `firmenbuchat doctor [--env-file PATH]`  

全局选项（Globale Optionen）
- `-o, --output`：`table`（默认值）、`json`、`raw`  
- `-k, --api-key`：直接传入 API 密钥  
- `-e, --env-file`：指定 `.env` 配置文件路径  
- `--limit`：结果数量（表格行数）  
- `--offset`：起始偏移量（Start-Offset）  

注意事项（Notes）
- `veraenderungen urkunden` 在时间跨度较大时可能返回 5xx 错误；建议改用更小的时间窗口。  
- 下载操作需要一个来自 `suche urkunde` 的 `URKUNDEN_KEY`。  