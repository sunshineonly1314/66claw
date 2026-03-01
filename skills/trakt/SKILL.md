---
name: trakt
name_zh: Trakt
description: 通过 trakt.tv 追踪并查看你已观看的电影与电视剧。当用户询问其观看历史、近期观看内容，或希望搜索电影/剧集时使用。
description_zh: 通过 trakt.tv 追踪并查看你已观看的电影与电视剧。当用户询问其观看历史、近期观看内容，或希望搜索电影/剧集时使用。
homepage: https://trakt.tv
metadata:
  clawdbot:
    emoji: "🎬"
    requires:
      bins: ["trakt-cli"]
---
# Trakt CLI

查询你的 trakt.tv 观看历史，并搜索电影/电视剧。

## 安装

```bash
npm install -g trakt-cli
```

## 设置

1. 在 https://trakt.tv/oauth/applications/new 创建一个应用  
2. 运行：`trakt-cli auth --client-id <id> --client-secret <secret>`  
3. 访问显示的 URL 并输入设备码  
4. 凭据将保存至 `~/.trakt.yaml`

## 命令

### 观看历史

```bash
trakt-cli history                  # Recent history (default: 10 items)
trakt-cli history --limit 25       # Show more
trakt-cli history --page 2         # Paginate
```

### 搜索

```bash
trakt-cli search "Breaking Bad"
trakt-cli search "The Matrix"
```

## 使用示例

**用户：“我最近都在看些什么？”**  
```bash
trakt-cli history
```

**用户：“显示我最近观看的 20 项内容”**  
```bash
trakt-cli history --limit 20
```

**用户：“查找《人生切割术》（Severance）的相关信息”**  
```bash
trakt-cli search "Severance"
```

## 注意事项

- 搜索功能无需身份认证  
- 查看历史需身份认证  
- 仅提供观看历史的只读访问权限  