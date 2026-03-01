---
name: noir-developer
name_zh: Noir开发者
description: 开发 Noir（.nr）代码库。当创建项目或使用 Noir 编写代码时启用。
description_zh: 开发 Noir（.nr）代码库。当创建项目或使用 Noir 编写代码时启用。
---
# Noir 开发者（Noir Developer）

## 工作流（Workflow）

1. 将 Noir 程序编译（`nargo compile`）为 ACIR（Arithmetic Circuit Intermediate Representation）。  
2. 基于 ACIR 与用户输入，生成见证（witness）（`nargo execute` 或使用 NoirJS execute）。  
3. 使用选定的证明后端（proving backend），结合 ACIR 与 witness 生成证明（prove）。  
4. 使用选定的证明后端验证该证明（verify proof）。

## 任务模式（Task Patterns）

### 环境（Environment）

若当前环境不被 `nargo` 支持（例如原生 Windows），请引导用户使用 GitHub Codespaces（https://noir-lang.org/docs/tooling/devcontainer#using-github-codespaces）或其它受支持的环境（WSL、Docker 或虚拟机）。

### 规划（Plan）

为每个 Noir 程序明确定义私有输入（private inputs）、公有输入（public inputs，如有）及公有输出（public outputs，如有）。

### 项目创建（Project Creation）

创建 Noir 项目时，请使用 `nargo new` 或 `nargo init` 进行脚手架搭建（scaffold）。

### 编译（Compilation）

请使用 `nargo`（而非 `noir_wasm`）进行编译；这是官方维护的路径。

### 验证（Validation）

运行 `nargo test` 以验证 Noir 实现的正确性。

### 证明后端（Proving Backend）

在进入实现细节前，请先确认所选证明后端。若用户选择 Barretenberg，请查阅 `references/barretenberg.md`。

## 参考资料（References）

- 运行 `nargo --help` 可获取完整命令列表。  
- 访问 https://noir-lang.org/docs/ 查阅语言语法、依赖管理与工具链文档。  
- 证明后端（Proving backends）：  
  - 如需了解 Barretenberg 的具体细节，请参阅 `references/barretenberg.md`。  