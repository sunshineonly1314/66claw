---
name: byterover-test
name_zh: Byterover测试
description: 在 ByteRover 上下文树中查询与整理知识。当用户要求记住信息、添加上下文、搜索模式、查询实现细节或管理项目知识时使用。触发短语包括：“remember this”、“add to context”、“how does X work”、“what are the patterns”、“store this”、“save this knowledge”、“curate”、“brv query”、“check context tree”。
description_zh: 在 ByteRover 上下文树中查询与整理知识。当用户要求记住信息、添加上下文、搜索模式、查询实现细节或管理项目知识时使用。触发短语包括：“remember this”、“add to context”、“how does X work”、“what are the patterns”、“store this”、“save this knowledge”、“curate”、“brv query”、“check context tree”。
---
# ByteRover 上下文树

一个跨会话持久化的项目级知识仓库。使用它可避免重复发现已有模式、约定和决策。

## 为何使用 ByteRover

- **工作前先查询**：在实施前，获取关于模式、约定及过往决策的现有知识  
- **学习后及时整理**：将获得的洞见、决策和缺陷修复记录下来，使后续会话能基于已有认知启动

## 快速参考

| 命令 | 使用时机 | 示例 |
|------|----------|------|
| `brv query "question"` | 开始工作前 | `brv query "How is auth implemented?"` |
| `brv curate "context" -f file` | 完成工作后 | `brv curate "JWT 24h expiry" -f auth.ts` |
| `brv status` | 检查前提条件时 | `brv status` |

## 使用场景

**查询（Query）**：当你需要理解某项内容时：
- “X 在本代码库中是如何工作的？”
- “Y 相关有哪些可用模式？”
- “Z 是否存在既定约定？”

**整理（Curate）**：当你学习或创建了有价值的内容时：
- 使用特定模式实现了某项功能  
- 修复了一个缺陷并定位到根本原因  
- 做出了某项架构决策  

## 整理质量要求

上下文必须具备**具体性**和**可操作性**：

```bash
# Good - specific, explains where and why
brv curate "Auth uses JWT 24h expiry, tokens in httpOnly cookies" -f src/auth.ts

# Bad - too vague
brv curate "Fixed auth"
```

**注意**：上下文参数必须置于 `-f` 标志之前。最多支持 5 个文件。

## 最佳实践

1. **拆分大型上下文**——针对复杂主题，运行多个 `brv curate` 命令，而非一次性提交庞大上下文。更小的片段更易于检索与更新。

2. **让 ByteRover 自行读取文件**——整理前无需手动读取文件。使用 `-f` 标志，让 ByteRover 直接读取：
   ```bash
   # Good - ByteRover reads the files
   brv curate "Auth implementation details" -f src/auth.ts -f src/middleware/jwt.ts

   # Wasteful - reading files twice
   # [agent reads files] then brv curate "..." -f same-files
   ```

3. **查询时力求精准**——查询会阻塞你的工作流。提出明确的问题，以获得更快、更相关的结果：
   ```bash
   # Good - specific
   brv query "What validation library is used for API request schemas?"

   # Bad - vague, slow
   brv query "How is validation done?"
   ```

4. **标记过时的上下文**——当整理的更新内容将替代既有知识时，请明确指示 ByteRover 清理旧条目：
   ```bash
   brv curate "OUTDATED: Previous auth used sessions. NEW: Now uses JWT with refresh tokens. Clean up old session-based auth context." -f src/auth.ts
   ```

5. **明确结构预期**——指导 ByteRover 如何组织该知识：
   ```bash
   # Specify topics/domains
   brv curate "Create separate topics for: 1) JWT validation, 2) refresh token flow, 3) logout handling" -f src/auth.ts

   # Specify detail level
   brv curate "Document the error handling patterns in detail (at least 30 lines covering all error types)" -f src/errors/
   ```

## 前提条件

请先运行 `brv status`。若出现错误，agent 无法自行修复——需指导用户在其 brv 终端中执行相应操作。详情参见 [TROUBLESHOOTING.md](TROUBLESHOOTING.md)。

---

**另请参阅**：[WORKFLOWS.md](WORKFLOWS.md) 中包含详细模式与示例；[TROUBLESHOOTING.md](TROUBLESHOOTING.md) 中提供错误处理指南