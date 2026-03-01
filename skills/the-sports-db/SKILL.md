---
name: the-sports-db
name_zh: Sports DB
description: 通过 TheSportsDB 访问体育数据（球队、赛事、比分）。
description_zh: 通过 TheSportsDB 访问体育数据（球队、赛事、比分）。
metadata: {"clawdbot":{"emoji":"🏟️","requires":{"env":["THE_SPORTS_DB_KEY"]}}}
---
# TheSportsDB

免费体育数据库。

## 配置说明  
确保 `THE_SPORTS_DB_KEY` 已在 `~/.clawdbot/.env` 中设置。（默认测试密钥通常为 `123` 或 `3`。）

## 使用方法

### 搜索球队  
```bash
curl -s "https://www.thesportsdb.com/api/v1/json/$THE_SPORTS_DB_KEY/searchteams.php?t=Palmeiras"
```

### 最近赛事（比分）  
获取某支球队 ID 的最近 5 场赛事：  
```bash
curl -s "https://www.thesportsdb.com/api/v1/json/$THE_SPORTS_DB_KEY/eventslast.php?id=134465"
```

### 即将赛事（赛程）  
获取某支球队 ID 的接下来 5 场赛事：  
```bash
curl -s "https://www.thesportsdb.com/api/v1/json/$THE_SPORTS_DB_KEY/eventsnext.php?id=134465"
```

**注意：** 请求频率限制为每分钟 30 次。