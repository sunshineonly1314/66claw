---
name: context7-api
name_zh: Context7 API
description: |
description_zh: |
  通过 Context7 API 获取最新版的库文档。在以下情况下应主动（PROACTIVELY）使用：
  (1) 使用任意外部库时（如 React、Next.js、Supabase 等）
  (2) 用户询问有关库的 API、模式或最佳实践时
  (3) 实现依赖第三方包的功能时
  (4) 调试与特定库相关的问题时
  (5) 需要获取训练数据截止时间之后的当前文档时
  始终优先选用此 skill，而非猜测库 API 或依赖过时知识。
---
# Context7 文档获取器

通过 Context7 API 检索当前库文档。

## 工作流程

### 1. 搜索目标库

```bash
python3 ~/.claude/skills/context7/scripts/context7.py search "<library-name>"
```

示例：
```bash
python3 ~/.claude/skills/context7/scripts/context7.py search "next.js"
```

返回库元数据，其中包含步骤 2 所需的 `id` 字段。

### 2. 获取文档上下文

```bash
python3 ~/.claude/skills/context7/scripts/context7.py context "<library-id>" "<query>"
```

示例：
```bash
python3 ~/.claude/skills/context7/scripts/context7.py context "/vercel/next.js" "app router middleware"
```

选项：
- `--type txt|md` — 输出格式（默认：txt）
- `--tokens N` — 限制响应 token 数量

## 快速参考

| 任务 | 命令 |
|------|---------|
| 查找 React 文档 | `search "react"` |
| 获取 React Hooks 信息 | `context "/facebook/react" "useEffect cleanup"` |
| 查找 Supabase | `search "supabase"` |
| 获取 Supabase 认证相关内容 | `context "/supabase/supabase" "authentication row level security"` |

## 使用时机

- 在实现任何依赖库的功能之前
- 对当前 API 签名不确定时
- 针对特定库版本的行为进行确认时
- 验证最佳实践和模式时