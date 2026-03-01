---
name: figma
name_zh: Figma
description: 专业的 Figma 设计分析与资产导出。适用于提取设计数据、多格式导出资产、可访问性合规性审计、设计系统分析以及生成全面的设计文档。仅读取方式分析 Figma 文件，具备强大的导出与报告能力。
description_zh: 专业的 Figma 设计分析与资产导出。适用于提取设计数据、多格式导出资产、可访问性合规性审计、设计系统分析以及生成全面的设计文档。仅读取方式分析 Figma 文件，具备强大的导出与报告能力。
---
# Figma 设计分析与导出

面向专业级应用的 Figma 集成方案，支持设计系统分析、资产导出及全面的设计审计。

## 核心能力

### 1. 文件操作与分析  
- **文件检查**：获取任意 Figma 文件的完整 JSON 表示  
- **组件提取**：列出全部组件、样式与设计标记（design tokens）  
- **资产导出**：批量导出框架（frames）、组件或指定节点为 PNG/SVG/PDF  
- **版本管理**：访问特定文件版本及分支信息  

**使用示例：**  
- “从此设计系统文件中导出全部组件”  
- “获取这些特定框架的 JSON 数据”  
- “展示此文件中使用的所有颜色与排版设置”  

### 2. 设计系统管理  
- **样式审计**：分析颜色使用、排版一致性、间距模式  
- **组件分析**：识别未使用的组件、统计使用频率  
- **品牌合规性检查**：跨文件核查是否符合品牌规范  
- **设计标记提取**：从 Figma 样式生成 CSS/JSON 格式的设计标记  

**使用示例：**  
- “对此设计系统执行可访问性问题审计”  
- “基于这些 Figma 样式生成 CSS 自定义属性”  
- “查找我们组件库中的所有不一致项”  

### 3. 批量资产导出  
- **多格式导出**：支持 PNG、SVG、PDF 和 WEBP 格式  
- **平台适配尺寸**：为 iOS/Android 生成 @1x、@2x、@3x 资产  
- **结构化输出**：按格式或平台自动组织文件夹  
- **客户交付包**：含完整文档的交付包  

**使用示例：**  
- “以 PNG 和 SVG 格式导出全部组件”  
- “为移动应用开发生成完整的资产包”  
- “为客户交付创建含全部营销素材的交付包”  

### 4. 可访问性与质量分析  
- **对比度检查**：验证是否符合 WCAG 颜色对比度要求  
- **字号分析**：确保排版具有可读性  
- **交互元素尺寸检查**：验证触控目标（touch target）是否达标  
- **焦点状态验证**：核查键盘导航模式  

**使用示例：**  
- “检查此设计是否符合 WCAG AA 合规性要求”  
- “分析移动端可用性的触控目标”  
- “为此应用设计生成可访问性报告”  

## 快速入门

### 认证配置  
```bash
# Set your Figma access token
export FIGMA_ACCESS_TOKEN="your-token-here"

# Or store in .env file
echo "FIGMA_ACCESS_TOKEN=your-token" >> .env
```  

### 基础操作  
```bash
# Get file information and structure
python scripts/figma_client.py get-file "your-file-key"

# Export frames as images
python scripts/export_manager.py export-frames "file-key" --formats png,svg

# Analyze design system consistency
python scripts/style_auditor.py audit-file "file-key" --generate-html

# Check accessibility compliance
python scripts/accessibility_checker.py "file-key" --level AA --format html
```  

## 工作流模式

### 设计系统审计工作流  
1. **提取文件数据** → 获取组件、样式与文档结构  
2. **分析一致性** → 检查样式差异与未使用元素  
3. **生成报告** → 创建详细发现与改进建议  
4. **人工实施** → 依据发现结果指导设计改进  

### 资产导出工作流  
1. **确定导出目标** → 指定框架、组件或节点  
2. **配置导出设置** → 设置格式、尺寸与命名规范  
3. **批量处理** → 同时导出多个资产  
4. **整理输出** → 按交付或实施需求组织文件  

### 分析与文档工作流  
1. **提取设计数据** → 抽取组件、样式与设计标记  
2. **审计合规性** → 检查可访问性与品牌一致性  
3. **生成文档** → 创建风格指南与组件规格说明  
4. **导出交付物** → 打包资产供开发或客户交付  

## 资源

### scripts/  
- `figma_client.py` — 完整的 Figma API 封装，覆盖全部 REST 端点  
- `export_manager.py` — 专业的多格式、多尺寸资产导出脚本  
- `style_auditor.py` — 设计系统分析与品牌一致性检查脚本  
- `accessibility_checker.py` — 全面的 WCAG 合规性验证与报告脚本  

### references/  
- `figma-api-reference.md` — 完整的 API 文档与示例  
- `design-patterns.md` — UI 模式与组件最佳实践  
- `accessibility-guidelines.md` — WCAG 合规性要求  
- `export-formats.md` — 资产导出选项与规格说明  

### assets/  
- `templates/design-system/` — 预构建的组件库模板  
- `templates/brand-kits/` — 标准品牌规范结构  
- `templates/wireframes/` — 常见布局模式与用户流程  

## 集成示例

### 与开发工作流集成  
```bash
# Generate design tokens for CSS
python scripts/export_manager.py export-tokens "file-key" --format css

# Create component documentation
python scripts/figma_client.py document-components "file-key" --output docs/
```  

### 与品牌管理集成  
```bash
# Audit brand compliance in designs
python scripts/style_auditor.py audit-file "file-key" --brand-colors "#FF0000,#00FF00,#0000FF"

# Extract current brand colors for analysis
python scripts/figma_client.py extract-colors "file-key" --output brand-colors.json
```  

### 与客户交付集成  
```bash
# Generate client presentation assets
python scripts/export_manager.py client-package "file-key" --template presentation

# Create development handoff assets
python scripts/export_manager.py dev-handoff "file-key" --include-specs
```  

## 局限性与适用范围

### 只读操作  
本 skills 提供通过 REST API 对 Figma 文件的**只读访问**。它能够：  
- ✅ 提取数据、组件与样式  
- ✅ 以多种格式导出资产  
- ✅ 分析与审计设计文件  
- ✅ 生成全面的报告  

### 不支持的操作  
- ❌ **修改现有文件**（如颜色、文本、组件）  
- ❌ **创建新设计** 或组件  
- ❌ **批量更新** 多个文件  
- ❌ **实时协作** 功能  

如需修改文件，您需基于 Plugin API 开发一个 **Figma 插件**。

## 技术特性

### API 速率限制  
内置速率限制与重试逻辑，以优雅应对 Figma API 的约束。

### 错误处理  
提供全面的错误处理机制，含详细日志记录与恢复建议。

### 多格式支持  
支持以 PNG、SVG、PDF 和 WEBP 格式导出资产，并支持平台适配尺寸。