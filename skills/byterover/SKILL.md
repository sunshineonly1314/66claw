---
name: byterover
name_zh: Byterover
description: "使用 ByteRover 上下文树管理项目知识。提供两种操作：query（检索知识）和 curate（存储知识）。当用户请求信息查询、模式发现或知识持久化时调用。由 ByteRover Inc. 开发（https://byterover.dev/）"
description_zh: 使用 ByteRover 上下文树管理项目知识。提供两种操作：query（检索知识）和 curate（存储知识）。当用户请求信息查询、模式发现或知识持久化时调用。由 ByteRover Inc. 开发（https://byterover.dev/）
metadata:
  author: ByteRover Inc. (https://byterover.dev/)
  version: "1.2.1"
---
# ByteRover 上下文树

一种跨会话持久化的项目级知识库。可用于避免重复发现模式、约定与决策。

## 为何使用 ByteRover

- **工作前先查询**：在实施前，获取关于模式、约定及过往决策的既有知识  
- **学习后即归档**：将洞察、决策与 Bug 修复结果存入知识库，使后续会话能基于已有认知启动  

## 快速参考

| 命令 | 使用时机 | 示例 |
|---------|------|---------|
| `brv query "question"` | 启动工作前 | `brv query "How is auth implemented?"` |
| `brv curate "context" -f file` | 工作完成后 | `brv curate "JWT 24h expiry" -f auth.ts` |
| `brv status` | 检查前置条件时 | `brv status` |

## 适用场景

**Query** 适用于需理解某项内容时：
- “X 在该代码库中如何运作？”
- “Y 存在哪些模式？”
- “Z 是否有既定规范？”

**Curate** 适用于已获得或创建了有价值内容时：
- 使用特定模式实现了一个功能  
- 修复一个 Bug 并定位到根本原因  
- 做出了一项架构决策  

## Curate 内容质量要求

上下文必须**具体**且**可操作**：

```bash
# Good - specific, explains where and why
brv curate "Auth uses JWT 24h expiry, tokens in httpOnly cookies" -f src/auth.ts

# Bad - too vague
brv curate "Fixed auth"
```

**注意：** 上下文参数必须置于 `-f` 标志之前。最多支持 5 个文件。

## 最佳实践

1. **拆分大型上下文** —— 针对复杂主题，运行多个 `brv curate` 命令，而非一次性提交庞大上下文。较小的片段更易于检索与更新。

2. **让 ByteRover 自行读取文件** —— 归档前请勿自行读取文件。使用 `-f` 标志，让 ByteRover 直接读取：
   ```bash
   # Good - ByteRover reads the files
   brv curate "Auth implementation details" -f src/auth.ts -f src/middleware/jwt.ts

   # Wasteful - reading files twice
   # [agent reads files] then brv curate "..." -f same-files
   ```

3. **查询时力求精准** —— 查询会阻塞您的工作流。请提出明确问题，以更快获得更相关的结果：
   ```bash
   # Good - specific
   brv query "What validation library is used for API request schemas?"

   # Bad - vague, slow
   brv query "How is validation done?"
   ```

4. **标记过时上下文** —— 当归档的内容将替代既有知识时，请明确指示 ByteRover 清理旧条目：
   ```bash
   brv curate "OUTDATED: Previous auth used sessions. NEW: Now uses JWT with refresh tokens. Clean up old session-based auth context." -f src/auth.ts
   ```

5. **指定结构预期** —— 引导 ByteRover 如何组织知识：
   ```bash
   # Specify topics/domains
   brv curate "Create separate topics for: 1) JWT validation, 2) refresh token flow, 3) logout handling" -f src/auth.ts

   # Specify detail level
   brv curate "Document the error handling patterns in detail (at least 30 lines covering all error types)" -f src/errors/
   ```

## 前置条件

请先运行 `brv status`。若出现错误，agent 无法自行修复——请指导用户在其 brv 终端中执行相应操作。详见 [TROUBLESHOOTING.md](TROUBLESHOOTING.md)。

---

**另请参阅：** [WORKFLOWS.md](WORKFLOWS.md) 查看详细模式与示例；[TROUBLESHOOTING.md](TROUBLESHOOTING.md) 查看错误处理说明