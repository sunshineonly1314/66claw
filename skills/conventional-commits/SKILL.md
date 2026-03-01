---
name: conventional-commits
name_zh: 约定式提交
description: 使用 Conventional Commits 规范格式化提交信息。在创建提交、撰写提交信息，或用户提及提交、Git 提交或提交信息时使用。确保提交符合标准格式，以支持自动化工具、变更日志生成及语义化版本控制。
description_zh: 使用 Conventional Commits 规范格式化提交信息。在创建提交、撰写提交信息，或用户提及提交、Git 提交或提交信息时使用。确保提交符合标准格式，以支持自动化工具、变更日志生成及语义化版本控制。
license: MIT
---
# Conventional Commits

所有提交信息均须遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/v1.0.0/) 规范。此举可支持自动生成变更日志、语义化版本控制，并提升提交历史的可读性与一致性。

## 格式结构

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

## 提交类型

### 必选类型

- **`feat:`** — 新增功能（对应语义化版本中的 MINOR 版本号）
- **`fix:`** — 修复缺陷（对应语义化版本中的 PATCH 版本号）

### 常见附加类型

- **`docs:`** — 仅文档变更
- **`style:`** — 代码风格变更（如格式调整、缺失分号等）
- **`refactor:`** — 不含缺陷修复或新功能的代码重构
- **`perf:`** — 性能优化
- **`test:`** — 添加或更新测试
- **`build:`** — 构建系统或外部依赖项变更
- **`ci:`** — CI/CD 配置变更
- **`chore:`** — 其他不修改 `src` 或 `test` 文件的变更
- **`revert:`** — 回退先前的提交

## 作用域（Scope）

可选的作用域用于提供有关代码库特定部分的额外上下文信息：

```
feat(parser): add ability to parse arrays
fix(auth): resolve token expiration issue
docs(readme): update installation instructions
```

## 描述（Description）

- 必须紧随类型/作用域后的冒号与空格之后
- 使用祈使语气（例如 “add feature”，而非 “added feature” 或 “adds feature”）
- 首字母不得大写
- 结尾不得加句号
- 力求简洁（通常为 50–72 个字符）

## 正文（Body）

- 可选的较长说明，用于提供额外上下文
- 必须与描述之间空一行
- 可包含多个段落
- 应说明变更的“内容”（what）与“原因”（why），而非“方式”（how）

## 破坏性变更（Breaking Changes）

破坏性变更可通过以下两种方式之一标明：

### 1. 在类型/作用域中使用 `!`

```
feat!: send an email to the customer when a product is shipped
feat(api)!: send an email to the customer when a product is shipped
```

### 2. 使用 BREAKING CHANGE 页脚（footer）

```
feat: allow provided config object to extend other configs

BREAKING CHANGE: `extends` key in config file is now used for extending other config files
```

### 3. 同时使用两种方式

```
chore!: drop support for Node 6

BREAKING CHANGE: use JavaScript features not available in Node 6.
```

## 示例

### 简单功能提交

```
feat: add user authentication
```

### 带作用域的功能提交

```
feat(auth): add OAuth2 support
```

### 带正文的缺陷修复

```
fix: prevent racing of requests

Introduce a request id and a reference to latest request. Dismiss
incoming responses other than from latest request.

Remove timeouts which were used to mitigate the racing issue but are
obsolete now.
```

### 破坏性变更

```
feat!: migrate to new API client

BREAKING CHANGE: The API client interface has changed. All methods now
return Promises instead of using callbacks.
```

### 文档更新

```
docs: correct spelling of CHANGELOG
```

### 含页脚的多段正文

```
fix: prevent racing of requests

Introduce a request id and a reference to latest request. Dismiss
incoming responses other than from latest request.

Remove timeouts which were used to mitigate the racing issue but are
obsolete now.

Reviewed-by: Z
Refs: #123
```

## 指导原则

1. **始终指定类型** — 每次提交必须以类型开头，后接冒号与空格  
2. **使用祈使语气** — 表述应如同补全句子：“若应用此提交，将……”  
3. **力求具体** — 描述需清晰传达变更内容  
4. **保持专注** — 每次提交仅包含一项逻辑变更  
5. **在必要时使用作用域** — 作用域有助于在代码库内对变更进行归类  
6. **明确标注破坏性变更** — 所有破坏性变更均须清晰标识  

## 与语义化版本控制的对应关系

- **`fix:`** → PATCH 版本号递增（1.0.0 → 1.0.1）  
- **`feat:`** → MINOR 版本号递增（1.0.0 → 1.1.0）  
- **BREAKING CHANGE** → MAJOR 版本号递增（1.0.0 → 2.0.0）  

## 使用场景

请在以下情形中采用该格式：
- 所有 Git 提交  
- 生成提交信息  
- Pull Request 的合并提交  
- 用户询问提交信息或 Git 提交相关内容时  

## 常见错误（应避免）

❌ `Added new feature`（过去式、首字母大写）  
✅ `feat: add new feature`（祈使式、小写）

❌ `fix: bug`（过于笼统）  
✅ `fix: resolve null pointer exception in user service`

❌ `feat: add feature`（冗余）  
✅ `feat: add user profile page`

❌ `feat: Added OAuth support.`（过去式、带句号）  
✅ `feat: add OAuth support`