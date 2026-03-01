---
name: jq
name_zh: jq
description: 命令行 JSON 处理器。用于提取、过滤与转换 JSON 数据。
description_zh: 命令行 JSON 处理器。用于提取、过滤与转换 JSON 数据。
---
# jq

一款命令行 JSON 处理器，支持 JSON 数据的提取、过滤与转换。

## 安装方法

**macOS / Linux（通过 Homebrew）：**  
```bash
brew install jq
```

**所有平台：** 请访问 [jqlang.org/download](https://jqlang.org/download/) 获取安装包、预编译二进制文件及源码构建说明。

## 使用方法

```bash
jq '[filter]' [file.json]
cat file.json | jq '[filter]'
```

## 快速参考

```bash
.key                    # Get key
.a.b.c                  # Nested access
.[0]                    # First element
.[]                     # Iterate array
.[] | select(.x > 5)    # Filter
{a: .x, b: .y}          # Reshape
. + {new: "val"}        # Add field
del(.key)               # Remove field
length                  # Count
[.[] | .x] | add        # Sum
keys                    # List keys
unique                  # Dedupe array
group_by(.x)            # Group
```

## 常用标志（Flags）

`-r` 原始输出（不带引号） · `-c` 紧凑格式 · `-s` 将输入聚合为数组（slurp） · `-S` 按键名排序

## 示例

```bash
jq '.users[].email' data.json          # Extract emails
jq -r '.name // "default"' data.json   # With fallback
jq '.[] | select(.active)' data.json   # Filter active
jq -s 'add' *.json                     # Merge files
jq '.' file.json                       # Pretty-print
```