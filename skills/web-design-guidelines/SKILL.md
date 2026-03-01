---
name: web-design-guidelines
name_zh: 网页设计指南
description: 审查 Web 界面的 UI 代码是否符合《Web 界面指南》。当用户要求“审查我的 UI”、“检查可访问性”、“设计审计”、“审查 UX”或“依据最佳实践检查我的网站”时使用。
description_zh: 审查 Web 界面的 UI 代码是否符合《Web 界面指南》。当用户要求“审查我的 UI”、“检查可访问性”、“设计审计”、“审查 UX”或“依据最佳实践检查我的网站”时使用。
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---
# Web 界面指南

审查文件是否符合《Web 界面指南》。

## 工作原理

1. 从下方源 URL 获取最新版指南  
2. 读取指定的文件（或提示用户提供文件/文件模式）  
3. 将文件内容与所获取指南中的全部规则进行比对  
4. 以简洁的 `file:line` 格式输出检查结果  

## 指南来源

每次审查前均需获取最新版指南：

```
https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
```

使用 WebFetch 获取最新规则。所获取的内容包含全部规则及输出格式说明。

## 使用方法

当用户提供文件或文件模式参数时：  
1. 从上方源 URL 获取指南  
2. 读取指定的文件  
3. 应用所获取指南中的全部规则  
4. 按照指南中规定的格式输出检查结果  

若未指定任何文件，则向用户询问需要审查哪些文件。