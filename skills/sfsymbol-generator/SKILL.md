---
name: sfsymbol-generator
name_zh: SF Symbols 生成器
description: 从 SVG 生成 Xcode SF Symbol 资源目录（.symbolset）。当您需要通过构建时（build-time）添加自定义 SF Symbol（即创建 symbolset 文件夹、Contents.json 及 SVG 文件）时使用。
description_zh: 从 SVG 生成 Xcode SF Symbol 资源目录（.symbolset）。当您需要通过构建时（build-time）添加自定义 SF Symbol（即创建 symbolset 文件夹、Contents.json 及 SVG 文件）时使用。
---
# SF Symbol 生成器

## 使用方法

您可通过 `SFSYMBOL_ASSETS_DIR` 覆盖默认资源目录位置。

### 原始 symbolset（不注入模板）

```bash
./scripts/generate.sh <symbol-name> <svg-path> [assets-dir]
```  

- `symbol-name`：完整符号名称（例如 `custom.logo`、`brand.icon.fill`）。  
- `svg-path`：源 SVG 文件路径。  
- `assets-dir`（可选）：`Assets.xcassets/Symbols` 路径（默认为 `Assets.xcassets/Symbols` 或 `SFSYMBOL_ASSETS_DIR`）。

### 基于模板的 symbolset（推荐）

```bash
./scripts/generate-from-template.js <symbol-name> <svg-path> [template-svg] [assets-dir]
```  

- `template-svg`（可选）：用于注入的 SF Symbols 模板 SVG（默认为 `Assets.xcassets/Symbols` 中找到的第一个 `.symbolset` SVG；若未找到，则使用内建 skill 模板）。

## 示例

```bash
./scripts/generate-from-template.js pi.logo /Users/admin/Desktop/pi-logo.svg
```  

## 要求

- SVG 必须包含 `viewBox`。  
- 请使用**基于路径（path-based）** 的图形（必须使用 path；rect 支持且会自动转换，但其他图形应先转为 path）。  
- 推荐使用**填充（filled）** 图形（无描边），以避免细小视觉瑕疵。

## 工作流程

1. 验证 SVG 路径与 viewBox。  
2. 计算路径边界，并将其居中置于 SF Symbols 模板的边距范围内。  
3. 将路径注入 SF Symbols 模板（Ultralight/Regular/Black）。  
4. 在资源目录 Symbols 文件夹内创建 `<symbol-name>.symbolset`。  
5. 写入匹配的 `Contents.json`。  