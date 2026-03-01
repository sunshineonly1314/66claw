---
name: graphiti
name_zh: Graphiti
description: 通过 Graphiti API 执行知识图谱操作：查询事实、添加事件（episodes）、抽取实体与关系。
description_zh: 通过 Graphiti API 执行知识图谱操作：查询事实、添加事件（episodes）、抽取实体与关系。
homepage: https://github.com/getzep/graphiti
metadata: {"clawdbot":{"emoji":"🕸️","requires":{"services":["neo4j","qdrant","graphiti"]},"install":[{"id":"docker","kind":"download","label":"安装 Graphiti 技术栈（Docker）"}]}}
---
# Graphiti 知识图谱

利用 Graphiti 的 REST API（支持动态服务发现）查询与管理您的知识图谱。

## 前置条件

- Neo4j 数据库（用于图数据存储）；
- Qdrant（用于向量检索）；
- Graphiti 服务正在运行（默认地址：http://localhost:8001）。

## 工具

### graphiti_search  
在知识图谱中搜索相关事实。

**用法：**  
```bash
bash command:"
GRAPHITI_URL=\$({baseDir}/references/env-check.sh)
curl -s -X POST \"\$GRAPHITI_URL/facts/search\" \
  -H 'Content-Type: application/json' \
  -d '{\"query\": \"YOUR_QUERY\", \"max_facts\": 10}' | jq .
"
```

### graphiti_add  
向知识图谱中添加新事件（memory）。

**用法：**  
```bash
bash command:"
GRAPHITI_URL=\$({baseDir}/references/env-check.sh)
curl -s -X POST \"\$GRAPHITI_URL/messages\" \
  -H 'Content-Type: application/json' \
  -d '{\"name\": \"EPISODE_NAME\", \"content\": \"EPISODE_CONTENT\"}' | jq .
"
```

## 动态配置

该 skill 通过环境发现机制自动定位 Graphiti 服务：

1. **Clawdbot 配置项**：`clawdbot config get skills.graphiti.baseUrl`  
2. **环境变量**：`$GRAPHITI_URL`  
3. **默认回退地址**：`http://localhost:8001`  

如需修改 Graphiti URL，请执行：  
```bash
export GRAPHITI_URL="http://10.0.0.10:8001"
# OR
clawdbot config set skills.graphiti.baseUrl "http://10.0.0.10:8001"
```

## 示例

搜索信息：  
```bash
bash command:"
GRAPHITI_URL=\$({baseDir}/references/env-check.sh)
curl -s -X POST \"\$GRAPHITI_URL/facts/search\" \
  -H 'Content-Type: application/json' \
  -d '{\"query\": \"Tell me about Essam Masoudy\", \"max_facts\": 5}'
"
```

添加一条记忆：  
```bash
bash command:"
GRAPHITI_URL=\$({baseDir}/references/env-check.sh)
curl -s -X POST \"\$GRAPHITI_URL/messages\" \
  -H 'Content-Type: application/json' \
  -d '{\"name\": \"Project Update\", \"content\": \"Completed Phase 1 of Clawdbot integration\"}'
"
```