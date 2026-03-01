---
name: redis
name_zh: Redis
description: Redis 数据库管理。支持键值操作、缓存、发布/订阅（pub/sub）及各类数据结构命令。
description_zh: Redis 数据库管理。支持键值操作、缓存、发布/订阅（pub/sub）及各类数据结构命令。
metadata: {"clawdbot":{"emoji":"🔴","always":true,"requires":{"bins":["curl","jq"]}}}
---
# Redis 🔴

Redis 内存数据库管理。

## 初始化配置

```bash
export REDIS_URL="redis://localhost:6379"
```

## 功能特性

- 键值对操作  
- 数据结构支持（列表、集合、哈希表）  
- 发布/订阅（Pub/Sub）消息机制  
- 缓存管理  
- TTL（生存时间）管理  

## 使用示例

```
"Get key user:123"
"Set cache for 1 hour"
"Show all keys matching user:*"
"Flush cache"
```

## 命令

```bash
redis-cli GET key
redis-cli SET key value EX 3600
redis-cli KEYS "pattern*"
```