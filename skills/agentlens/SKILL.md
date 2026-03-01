---
name: agentlens
name_zh: AgentLens
description: 使用 agentlens 分层式文档来导航与理解代码库。适用于探索新项目、查找模块、在大型文件中定位符号、查找待办事项/警告，或理解代码结构等场景。
description_zh: 使用 agentlens 分层式文档来导航与理解代码库。适用于探索新项目、查找模块、在大型文件中定位符号、查找待办事项/警告，或理解代码结构等场景。
metadata:
  short-description: 使用 agentlens 进行代码库导航
  author: agentlens
  version: "1.0"
---
# AgentLens —— 代码库导航

## 开始任何代码库工作前  
务必首先阅读 `.agentlens/INDEX.md`，以掌握项目整体地图。

## 导航层级

| 层级 | 文件 | 用途 |
|------|------|------|
| L0 | `INDEX.md` | 项目概览，列出全部模块 |
| L1 | `modules/{slug}/MODULE.md` | 模块详情与文件列表 |
| L1 | `modules/{slug}/outline.md` | 大型文件中的符号 |
| L1 | `modules/{slug}/memory.md` | 待办事项、警告、业务规则 |
| L1 | `modules/{slug}/imports.md` | 文件依赖关系 |
| L2 | `files/{slug}.md` | 复杂文件的深度文档 |

## 导航流程

```
INDEX.md → Find module → MODULE.md → outline.md/memory.md → Source file
```

## 应何时阅读何内容

| 您需要 | 请阅读此文件 |
|--------|--------------|
| 项目概览 | `.agentlens/INDEX.md` |
| 查找模块 | INDEX.md，搜索模块名称 |
| 理解模块 | `modules/{slug}/MODULE.md` |
| 在大型文件中查找函数/类 | `modules/{slug}/outline.md` |
| 查找待办事项、警告、规则 | `modules/{slug}/memory.md` |
| 理解文件依赖关系 | `modules/{slug}/imports.md` |

## 最佳实践

1. **切勿直接阅读源文件**（大型代码库）—— 请先使用 outline.md  
2. **修改代码前务必查阅 memory.md**，了解警告与待办事项  
3. **利用 outline.md 定位符号**，再仅阅读所需源代码片段  
4. 若文档陈旧，请使用 `agentlens` 命令重新生成  

详细导航模式参见 [references/navigation.md](references/navigation.md)  
结构说明参见 [references/structure.md](references/structure.md)