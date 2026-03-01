---
name: clawdbot-workspace-template-review
name_zh: 工作区模板评审
description: 将用户的 Clawdbot 工作区与官方模板（通过 npm 或源码安装的 Clawdbot）进行比对，列出缺失的待引入章节，尤其适用于升级后检查。
description_zh: 将用户的 Clawdbot 工作区与官方模板（通过 npm 或源码安装的 Clawdbot）进行比对，列出缺失的待引入章节，尤其适用于升级后检查。
---
# 工作区模板差异比对（Workspace Template Diff）

当用户希望将其工作区 `.md` 文件（如 AGENTS、SOUL、USER、IDENTITY、TOOLS、HEARTBEAT 等）与官方 Clawdbot 模板进行比对，并审查缺失章节以决定是否引入时，请使用本 skill。

## 定位官方模板位置

查找已安装的 Clawdbot 源码根目录：

- 若 `clawdbot` 通过 npm/pnpm 全局安装：  
  - `command -v clawdbot`  
  - 若其指向 `.../node_modules/.bin/`，请解析至同级目录 `node_modules/clawdbot`  
  - 或使用 `npm root -g` / `pnpm root -g` 并查找 `clawdbot/`  
- 若 Clawdbot 以源码方式运行，请使用该代码仓库根目录（必须包含 `package.json`）。

模板文件位于：

```
<clawdbot-root>/docs/reference/templates/
```

若无法定位源码根目录，请向用户询问其 Clawdbot 的安装路径。

## 比对工作流程

1. 确定工作区根目录（即用户的“我们当前版本”所在目录）。  
2. 对 `docs/reference/templates` 中每个模板文件（跳过 `*.dev.md`）：  
   - 同时打开对应名称的官方模板文件与工作区文件；  
   - 忽略模板前端元数据（frontmatter，即 `---` 区块）及任何“首次运行”（First Run）或“引导”（Bootstrap）章节；  
   - 比较其余部分，逐项列出工作区中缺失的区块。

实用命令（可借助 `diff` 等临时 CLI 工具）：

```
ls <clawdbot-root>/docs/reference/templates
sed -n '1,200p' <clawdbot-root>/docs/reference/templates/AGENTS.md
sed -n '1,200p' <workspace>/AGENTS.md
diff -u <clawdbot-root>/docs/reference/templates/AGENTS.md <workspace>/AGENTS.md
```

生成比对报告时：  
- 须逐字呈现官方模板中缺失的区块内容；  
- 简要说明该区块的重要性，再征询用户是否引入；  
- 按文件逐一推进；对于仅因前端元数据或引导内容存在差异的文件，可直接跳过。

## 输出格式

采用此前使用的“缺失区块”格式：  
- 文件路径  
- 缺失的区块内容  
- 建议操作 + 征询用户是否继续