---
name: apple-photos
name_zh: 苹果照片
description: macOS 上 Apple Photos.app 的集成。列出相簿、浏览照片、按日期/人物/内容搜索、导出照片。
description_zh: macOS 上 Apple Photos.app 的集成。列出相簿、浏览照片、按日期/人物/内容搜索、导出照片。
metadata: {"clawdbot":{"emoji":"📷","os":["darwin"]}}
---
# Apple Photos

通过 SQLite 查询访问 Photos.app。脚本运行位置：`cd {baseDir}`

## 要求
- 终端需具备“完全磁盘访问”权限（系统设置 → 隐私与安全性 → 完全磁盘访问）

## 命令

| 命令 | 用法 |
|------|------|
| 图库统计信息 | `scripts/photos-count.sh` |
| 列出相簿 | `scripts/photos-list-albums.sh` |
| 最近照片 | `scripts/photos-recent.sh [count]` |
| 列出人物 | `scripts/photos-list-people.sh` |
| 按人物搜索 | `scripts/photos-search-person.sh <name> [limit]` |
| 按内容搜索 | `scripts/photos-search-content.sh <query> [limit]` |
| 按日期搜索 | `scripts/photos-search-date.sh <start> [end] [limit]` |
| 照片信息 | `scripts/photos-info.sh <uuid>` |
| 导出照片 | `scripts/photos-export.sh <uuid> [output_path]` |

## 输出格式

- 最近照片/搜索结果：`Filename | Date | Type | UUID`
- 人物列表：`ID | Name | Photo Count`
- 默认导出路径：`/tmp/photo_export.jpg`

## 工作流：查看一张照片

1. 获取 UUID：`scripts/photos-recent.sh 1`  
2. 导出照片：`scripts/photos-export.sh "UUID"`  
3. 在 `/tmp/photo_export.jpg` 查看

## 注意事项

- 日期格式：`YYYY-MM-DD` 或 `YYYY-MM-DD HH:MM`  
- 内容搜索依赖机器学习（ML），速度较慢（约 5–10 秒），而按日期或人物搜索较快（约 100 毫秒）  
- HEIC 格式照片在导出时会自动转换为 JPEG  
- 名称搜索不区分大小写，支持模糊匹配