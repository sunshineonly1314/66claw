---
name: npkill
name_zh: npkill
description: 使用 npkill 清理 node_modules 和 .next 文件夹以释放磁盘空间。专为 JavaScript 和 Next.js 开发者设计，用于清除占用大量存储空间的累积构建产物。提供交互式与自动化清理选项，并内置安全检查以保护重要系统目录。
description_zh: 使用 npkill 清理 node_modules 和 .next 文件夹以释放磁盘空间。专为 JavaScript 和 Next.js 开发者设计，用于清除占用大量存储空间的累积构建产物。提供交互式与自动化清理选项，并内置安全检查以保护重要系统目录。
---
# NPkill — Node.js 与 Next.js 构建产物清理工具

本 skill 借助 npkill 工具，清理 JavaScript 和 Next.js 开发过程中长期累积的 node_modules 和 .next 文件夹，从而显著释放磁盘空间。

## 目的

本 skill 旨在解决 JavaScript 和 Next.js 开发者普遍面临的难题：node_modules 和 .next 等大型构建产物文件夹随时间推移不断累积，大量占用磁盘空间。它提供了一种安全、高效的方式，帮助识别并移除这些不必要的文件夹。

## 适用场景

当出现以下情况时，请使用本 skill：
- 因累积大量 node_modules 文件夹导致磁盘空间不足；
- 想要清理旧的 Next.js 构建产物（.next 文件夹）；
- 需要维护整洁的开发环境；
- 想了解哪些项目占用了最多的磁盘空间；
- 希望定期对开发工作区执行维护操作。

## 核心命令

### 交互式清理（推荐）
```bash
npkill
```  
启动交互式界面，用于浏览并选择性删除 node_modules 文件夹。这是最安全的方法，因为它允许您在删除前逐一审查每个文件夹。

### 专门定位 .next 文件夹
```bash
npkill --target .next
```  
专门搜索 .next 文件夹（Next.js 项目所用），而非 node_modules。

### 模拟运行（首次强烈推荐）
```bash
npkill --dry-run
```  
模拟执行过程但不实际删除任何内容，显示将被删除的文件夹列表。

### 自动化清理（谨慎使用）
```bash
npkill --delete-all --yes
```  
自动删除所有查找到的 node_modules 文件夹。仅建议在通过模拟运行验证后使用。

### 以 GB 显示大小
```bash
npkill --gb
```  
以 GB（吉字节）而非 MB（兆字节）显示文件夹大小，便于阅读。

### 从指定目录开始扫描
```bash
npkill --directory /path/to/search/from
```  
从指定目录而非当前目录开始搜索。

## 安全特性

- **受保护目录警告**：npkill 会以 ⚠️ 符号高亮标出不应删除的系统/应用程序目录；
- **交互式确认**：交互模式下需手动选择待删除项；
- **模拟运行选项**：可在实际执行删除前预览变更内容；
- **排除选项**：支持通过 --exclude 排除特定目录不参与扫描。

## Next.js 开发者的常见用例

### 安全清理 .next 文件夹
```bash
# First, preview what would be deleted
npkill --target .next --dry-run

# Then, if satisfied with the preview, run interactively
npkill --target .next
```

### 定期维护
```bash
# Run interactive cleanup to review and selectively delete
npkill
```

### 检查磁盘使用情况
```bash
# View all node_modules folders sorted by size
npkill --sort=size
```

## 最佳实践

1. **始终先运行 --dry-run**，查看将被删除的内容；
2. **仔细审阅带 ⚠️ 标记的受保护目录警告**；
3. **使用交互模式** 实现更安全的选择性删除；
4. **必要时可使用 --exclude 排除重要项目目录**；
5. **定期执行清理**，防止积累过多。

## 安装要求

本 skill 需要全局安装 npkill CLI 工具：
```bash
npm install -g npkill
```

## 局限性

- 需单独安装 npkill；
- 在某些环境中可能无法检测到全部受保护的系统目录；
- 交互模式需终端支持方向键。