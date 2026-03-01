---
name: Cat Fact
name_zh: CatFact
description: 从 catfact.ninja（免费，无需 API 密钥）获取随机猫咪趣闻与品种信息。
description_zh: 从 catfact.ninja（免费，无需 API 密钥）获取随机猫咪趣闻与品种信息。
read_when:
  - 想了解随机猫咪趣闻时
  - 查询猫咪品种时
  - 构建趣味性机器人回复时
metadata: {"clawdbot":{"emoji":"🐱","requires":{"bins":["curl"]}}}
---
# 猫咪趣闻（Cat Fact）

来自 catfact.ninja 的随机猫咪趣闻（无需 API 密钥）。

## 使用方法

```bash
# Get a random cat fact
curl -s "https://catfact.ninja/fact"

# Get a random fact (short)
curl -s "https://catfact.ninja/fact?max_length=100"

# Get cat breeds
curl -s "https://catfact.ninja/breeds?limit=5"
```

## 编程调用（JSON 格式）

```bash
curl -s "https://catfact.ninja/fact" | jq '.fact'
```

## 一行命令示例

```bash
# Random fact
curl -s "https://catfact.ninja/fact" --header "Accept: application/json" | jq -r '.fact'

# Multiple facts
for i in {1..3}; do curl -s "https://catfact.ninja/fact" --header "Accept: application/json" | jq -r '.fact'; done
```

## API 端点

| 端点 | 描述 |
|----------|-------------|
| `GET /fact` | 随机猫咪趣闻 |
| `GET /breeds` | 猫咪品种列表 |

文档地址：https://catfact.ninja