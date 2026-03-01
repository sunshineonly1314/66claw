---
name: idealista
name_zh: Idealista
description: 通过 idealista-cli（OAuth2 客户端凭证模式）查询 Idealista API。
description_zh: 通过 idealista-cli（OAuth2 客户端凭证模式）查询 Idealista API。
license: MIT
homepage: https://github.com/quifago/idealista-cli
metadata: {"clawdbot":{"emoji":"🏠","requires":{"bins":["python3"],"env":["IDEALISTA_API_KEY","IDEALISTA_API_SECRET"],"primaryEnv":"IDEALISTA_API_KEY"},"install":[{"id":"git","kind":"download","label":"Install idealista-cli (git clone)","url":"https://github.com/quifago/idealista-cli","bins":["python3"]}]}}
---
# idealista

本 skill 文档说明如何使用本地 `idealista-cli` 查询 Idealista API。

## 本地项目路径

- CLI 源码（示例）：`~/idealista-cli`

## 凭据（client_id / client_secret）

Idealista 使用 OAuth2 **客户端凭证（Client Credentials）** 认证方式。

推荐使用环境变量配置：

- `IDEALISTA_API_KEY` = `client_id`  
- `IDEALISTA_API_SECRET` = `client_secret`  

示例：

```bash
export IDEALISTA_API_KEY="<CLIENT_ID>"
export IDEALISTA_API_SECRET="<CLIENT_SECRET>"
```

或通过 CLI 持久化配置：

```bash
python3 -m idealista_cli config set \
  --api-key "<CLIENT_ID>" \
  --api-secret "<CLIENT_SECRET>"
```

配置文件路径：  
- `~/.config/idealista-cli/config.json`  

Token 缓存路径：  
- `~/.cache/idealista-cli/token.json`  

## 常用命令

获取访问令牌：

```bash
python3 -m idealista_cli token
python3 -m idealista_cli token --refresh
```

搜索房源列表：

```bash
python3 -m idealista_cli search \
  --center "39.594,-0.458" \
  --distance 5000 \
  --operation sale \
  --property-type homes \
  --all-pages \
  --format summary
```

计算统计信息：

```bash
python3 -m idealista_cli avg \
  --center "39.594,-0.458" \
  --distance 5000 \
  --operation sale \
  --property-type homes \
  --group-by propertyType
```

## 示例查询（自然语言）

以下可作为调用 CLI 的 agent 的“prompt”示例：

- “查找拉科鲁尼亚（A Coruña）售价低于 200,000 欧元的公寓”  
- “告诉我附近房屋的平均价格：39°34'33.5\"N 0°30'10.0\"W”  
- “Búscame un apartamento de 3 habs en Tapia de Casariego para comprar”（西班牙语：“帮我找塔皮亚德卡萨里耶戈（Tapia de Casariego）一处三居室待购公寓”）