---
name: apple-contacts
name_zh: 苹果通讯录
description: 从 macOS Contacts.app 中查询联系人。适用于将电话号码解析为姓名、查找联系人信息或搜索通讯录等场景。
description_zh: 从 macOS Contacts.app 中查询联系人。适用于将电话号码解析为姓名、查找联系人信息或搜索通讯录等场景。
metadata: {"clawdbot":{"emoji":"👤","os":["darwin"]}}
---
# Apple 联系人

通过 AppleScript 查询 Contacts.app。

## 快速查询

```bash
# By phone (name only)
osascript -e 'tell application "Contacts" to get name of every person whose value of phones contains "+1XXXXXXXXXX"'

# By name
osascript -e 'tell application "Contacts" to get name of every person whose name contains "John"'

# List all
osascript -e 'tell application "Contacts" to get name of every person'
```

## 完整联系人信息

⚠️ 请勿使用 `first person whose` — 存在缺陷。请改用以下模式：

```bash
# By phone
osascript -e 'tell application "Contacts"
  set matches to every person whose value of phones contains "+1XXXXXXXXXX"
  if length of matches > 0 then
    set p to item 1 of matches
    return {name of p, value of phones of p, value of emails of p}
  end if
end tell'

# By name
osascript -e 'tell application "Contacts"
  set matches to every person whose name contains "John"
  if length of matches > 0 then
    set p to item 1 of matches
    return {name of p, value of phones of p, value of emails of p}
  end if
end tell'
```

## 电话号码查询

⚠️ **需精确字符串匹配** — 必须与存储格式完全一致。

| 存储格式 | 搜索内容 | 是否成功？ |
|----------|----------|------------|
| `+1XXXXXXXXXX` | `+1XXXXXXXXXX` | ✅ |
| `+1XXXXXXXXXX` | `XXXXXXXXXX` | ❌ |

请优先尝试添加 `+1` 前缀进行搜索；若失败，则改用姓名搜索。

## 姓名搜索

- 不区分大小写  
- 支持使用 `contains` 进行部分匹配  
- 如需精确匹配，请使用 `is`，而非 `contains`

## 输出

返回逗号分隔的字段：`name, phone1, [phone2...], email1, [email2...]`

未找到匹配项时输出为空（不视为错误）。