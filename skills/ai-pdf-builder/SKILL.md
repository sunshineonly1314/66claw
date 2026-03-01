---
name: ai-pdf-builder
name_zh: AI PDF生成
description: 使用 Pandoc 和 LaTeX 从 Markdown 生成专业 PDF，并结合 AI 驱动的内容生成能力。可创建白皮书、条款清单、备忘录、协议、SAFE 协议、NDA 协议等。
description_zh: 使用 Pandoc 和 LaTeX 从 Markdown 生成专业 PDF，并结合 AI 驱动的内容生成能力。可创建白皮书、条款清单、备忘录、协议、SAFE 协议、NDA 协议等。
version: 1.1.0
---
# AI PDF Builder

借助 AI 驱动的内容生成能力，从 Markdown 生成专业 PDF。适用于以下场景：
- 白皮书与轻量级白皮书（Litepapers）
- 条款清单（Term Sheets）
- SAFE 协议与 NDA 协议
- 备忘录与报告
- 法律协议

## v1.1.0 新增功能

- **AI 内容生成** —— 使用 Claude 根据提示词生成文档
- **`--company` 标志** —— 通过命令行直接注入公司名称
- **`enhance` 命令** —— 利用 AI 改进现有内容
- **`summarize` 命令** —— 从文档中生成执行摘要（Executive Summaries）
- **内容净化（Content Sanitization）** —— 自动清理 AI 生成的内容

## 系统要求

**选项 A：本地生成（免费，无限制）**  
```bash
# macOS
brew install pandoc
brew install --cask basictex
sudo tlmgr install collection-fontsrecommended fancyhdr titlesec enumitem xcolor booktabs longtable geometry hyperref graphicx setspace array multirow

# Linux
sudo apt-get install pandoc texlive-full
```

**选项 B：云 API（即将上线）**  
无需安装。请访问 ai-pdf-builder.com 获取 API 密钥。

**AI 功能所需配置：**  
设置您的 Anthropic API 密钥：  
```bash
export ANTHROPIC_API_KEY="your-key-here"
```

## 使用方法

### 检查系统环境  
```bash
npx ai-pdf-builder check
```

### 通过命令行生成  
```bash
# From markdown file
npx ai-pdf-builder generate whitepaper ./content.md -o output.pdf

# With company name
npx ai-pdf-builder generate whitepaper ./content.md -o output.pdf --company "Acme Corp"

# Document types: whitepaper, memo, agreement, termsheet, safe, nda, report, proposal
```

### AI 内容生成（新增！）  
```bash
# Generate a whitepaper from a prompt
npx ai-pdf-builder ai whitepaper "Write a whitepaper about decentralized identity" -o identity.pdf

# Generate with company branding
npx ai-pdf-builder ai whitepaper "AI in healthcare" -o healthcare.pdf --company "HealthTech Inc"

# Generate other document types
npx ai-pdf-builder ai termsheet "Series A for a fintech startup" -o termsheet.pdf
npx ai-pdf-builder ai memo "Q4 strategy update" -o memo.pdf --company "TechCorp"
```

### 增强现有内容（新增！）  
```bash
# Improve and expand existing markdown
npx ai-pdf-builder enhance ./draft.md -o enhanced.md

# Enhance and convert to PDF in one step
npx ai-pdf-builder enhance ./draft.md -o enhanced.pdf --pdf
```

### 文档摘要生成（新增！）  
```bash
# Generate executive summary
npx ai-pdf-builder summarize ./long-document.md -o summary.md

# Summarize as PDF
npx ai-pdf-builder summarize ./report.pdf -o summary.pdf --pdf
```

### 通过代码调用生成  
```typescript
import { generateWhitepaper, generateTermsheet, generateSAFE, aiGenerate, enhance, summarize } from 'ai-pdf-builder';

// AI-Generated Whitepaper
const aiResult = await aiGenerate('whitepaper', 
  'Write about blockchain scalability solutions',
  { company: 'ScaleChain Labs' }
);

// Whitepaper from content
const result = await generateWhitepaper(
  '# My Whitepaper\n\nContent here...',
  { title: 'Project Name', author: 'Your Name', version: 'v1.0', company: 'Acme Corp' }
);

if (result.success) {
  fs.writeFileSync('whitepaper.pdf', result.buffer);
}

// Enhance existing content
const enhanced = await enhance(existingMarkdown);

// Summarize a document
const summary = await summarize(longDocument);

// Term Sheet with company
const termsheet = await generateTermsheet(
  '# Series Seed Term Sheet\n\n## Investment Amount\n\n$500,000...',
  { title: 'Series Seed', subtitle: 'Your Company Inc.', company: 'Investor LLC' }
);

// SAFE
const safe = await generateSAFE(
  '# Simple Agreement for Future Equity\n\n...',
  { title: 'SAFE Agreement', subtitle: 'Your Company Inc.' }
);
```

## 文档类型

| 类型 | 功能 | 最适用场景 |
|------|----------|----------|
| `whitepaper` | `generateWhitepaper()` | 技术文档、轻量级白皮书 |
| `memo` | `generateMemo()` | 执行摘要 |
| `agreement` | `generateAgreement()` | 法律合同 |
| `termsheet` | `generateTermsheet()` | 投资条款 |
| `safe` | `generateSAFE()` | SAFE 协议 |
| `nda` | `generateNDA()` | 保密协议（NDA） |
| `report` | `generateReport()` | 商业报告 |
| `proposal` | `generateProposal()` | 商业提案 |

## 自定义品牌标识

```typescript
const result = await generateWhitepaper(content, metadata, {
  customColors: {
    primary: '#E85D04',    // Signal Orange
    secondary: '#14B8A6',  // Coordinate Teal
    accent: '#0D0D0D'      // Frontier Dark
  },
  fontSize: 11,
  margin: '1in',
  paperSize: 'letter'
});
```

## Agent 指令

当用户请求生成 PDF 时：

1. 确认其所需文档类型（白皮书、条款清单、备忘录等）  
2. 判断其是否需要 AI 生成，或已有待处理内容  
3. 获取内容来源 —— 可来自用户消息、文件上传，或由 AI 生成  
4. 若未提供元数据（如标题、作者、公司名称），则主动询问  
5. 使用 `--company` 标志注入公司品牌信息  
6. 检查 Pandoc 是否已安装：`which pandoc`  
7. 若 Pandoc 缺失，提供安装说明，或建议使用云 API  
8. 调用对应函数生成 PDF  
9. 将生成的 PDF 文件发送给用户  

**AI 命令速查表：**  
- `ai <type> "<prompt>"` —— 根据提示词生成新文档  
- `enhance <file>` —— 改进现有内容  
- `summarize <file>` —— 生成执行摘要  
- `--company "Name"` —— 在任意命令中添加公司品牌标识  

## 相关链接

- npm：https://www.npmjs.com/package/ai-pdf-builder  
- GitHub：https://github.com/NextFrontierBuilds/ai-pdf-builder