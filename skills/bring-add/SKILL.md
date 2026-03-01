---
name: bring-add
name_zh: Bring添加
description: 当用户希望向 Bring! 购物清单添加商品时使用。支持添加单个商品、批量添加商品，或从标准输入/文件中添加商品。支持预览（dry-run）及 JSON 输出。
description_zh: 当用户希望向 Bring! 购物清单添加商品时使用。支持添加单个商品、批量添加商品，或从标准输入/文件中添加商品。支持预览（dry-run）及 JSON 输出。
---
# Bring! 添加商品 CLI

## 概述

用于向 Bring! 购物清单添加商品的命令行工具。支持快捷单商品模式、批量模式、标准输入/管道输入，以及交互模式。

## 使用场景

**适用此技能的情形：**
- 用户希望向 Bring! 购物清单添加商品
- 添加单个商品并附带规格说明（例如，“牛奶 1L”）
- 一次性批量添加多个商品（批量模式）
- 从文件或其他命令管道中导入商品
- 需要通过预览（dry-run）确认添加内容
- 需要 JSON 输出以便脚本调用

**不适用此技能的情形：**
- 用户希望浏览食谱（请改用 bring-recipes）
- 用户希望从清单中移除商品
- 用户希望查看当前清单内容

## 快速参考

| 命令 | 用途 |
|---------|---------|
| `bring-add "Item" "spec"` | 添加单个商品并附带规格说明 |
| `bring-add --batch "A, B 1L, C"` | 添加多个逗号分隔的商品 |
| `bring-add -` | 从标准输入读取商品 |
| `bring-add` | 交互模式（仅限 TTY） |
| `bring-add lists` | 显示可用的购物清单 |
| `bring-add --dry-run ...` | 预览操作，不实际修改 |

**环境变量：**  
```bash
export BRING_EMAIL="your@email.com"
export BRING_PASSWORD="yourpassword"
export BRING_DEFAULT_LIST="Shopping"  # optional
```

## 安装

```bash
cd skills/bring-add
npm install
```

## 常见工作流

**添加单个商品：**  
```bash
node index.js "Tomatoes" "500g"
node index.js "Milk"
```

**向指定清单添加：**  
```bash
node index.js --list "Party" "Chips" "3 bags"
```

**批量添加多个商品：**  
```bash
node index.js --batch "Tomatoes 500g, Onions, Cheese 200g"
```

**从文件管道输入：**  
```bash
cat shopping-list.txt | node index.js -
echo -e "Milk 1L\nBread\nButter" | node index.js -
```

**添加前预览：**  
```bash
node index.js --dry-run --batch "Apples 1kg, Pears"
```

**获取 JSON 输出：**  
```bash
node index.js --json --batch "Milk, Bread" 2>/dev/null
```

**列出可用清单：**  
```bash
node index.js lists
node index.js --json lists
```

## 标志（Flags）参考

| 标志 | 描述 |
|------|-------------|
| `-l, --list <name>` | 目标清单（名称或 UUID） |
| `-b, --batch <items>` | 逗号分隔的商品列表 |
| `-n, --dry-run` | 预览操作，不实际修改 |
| `-q, --quiet` | 抑制非错误类输出 |
| `-v, --verbose` | 显示详细进度信息 |
| `--json` | 向 stdout 输出 JSON |
| `--no-color` | 禁用彩色输出 |
| `--no-input` | 从不提示用户；若需输入则直接失败 |

## 输入格式

商品遵循如下模式：`ItemName [Specification]`

| 输入 | 商品 | 规格说明 |
|-------|------|------|
| `Tomatoes 500g` | 番茄 | 500g |
| `Oat milk 1L` | 燕麦奶 | 1L |
| `Red onions 3` | 红洋葱 | 3 |
| `Cheese` | 奶酪 | （空） |

规则：若末尾单词含数字或单位（如 g、kg、L、ml、Stück、pck），则该词被解析为规格说明。“红洋葱”整体视为一个商品；而“红洋葱 3”则被拆分为商品“红洋葱”，规格说明为“3”。

## 退出码

| 代码 | 含义 |
|------|---------|
| `0` | 成功 |
| `1` | 通用失败（API 错误、网络异常） |
| `2` | 用法错误（参数错误、输入缺失） |
| `3` | 认证失败 |
| `4` | 清单未找到 |
| `130` | 被中断（Ctrl-C） |

## 常见错误

**遗漏环境变量：**  
运行前请确保已设置 `BRING_EMAIL` 和 `BRING_PASSWORD`。

**清单名称错误：**  
使用 `bring-add lists` 查看可用清单及其确切名称。

**规格说明解析错误：**  
仅当末尾单词形似数量时才被识别为规格说明。“红洋葱”保持为单一商品，但“红洋葱 3”将被拆分为商品“红洋葱”与规格说明“3”。

**脚本中误用交互模式：**  
在脚本中应使用 `--no-input` 标志，以显式失败代替挂起等待输入。

## 实现说明

- 使用 `node-bring-api` 调用 `batchUpdateList()` API
- 要求 Node.js 18.0.0+
- 数据输出至 stdout，进度与错误输出至 stderr
- 提供 JSON 模式以支持自动化
- 交互模式仅在 stdin 为 TTY 时启用