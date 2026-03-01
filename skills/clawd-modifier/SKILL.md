---
name: clawd-modifier
name_zh: Clawd修改器
description: 修改 Clawd（Claude Code 的吉祥物）。当用户希望自定义其 Claude Code CLI 中 Clawd 的外观时使用该 skill，包括更改颜色（蓝色 Clawd、绿色 Clawd、节日主题）、添加特征（手臂、帽子、配饰）或创建自定义 ASCII 艺术变体。触发词包括：“更改 Clawd 颜色”、“给 Clawd 加手臂”、“定制吉祥物”、“修改 Clawd”、“让 Clawd 变成 [颜色]”，或任何要求个性化 Claude Code 终端吉祥物的请求。
description_zh: 修改 Clawd（Claude Code 的吉祥物）。当用户希望自定义其 Claude Code CLI 中 Clawd 的外观时使用该 skill，包括更改颜色（蓝色 Clawd、绿色 Clawd、节日主题）、添加特征（手臂、帽子、配饰）或创建自定义 ASCII 艺术变体。触发词包括：“更改 Clawd 颜色”、“给 Clawd 加手臂”、“定制吉祥物”、“修改 Clawd”、“让 Clawd 变成 [颜色]”，或任何要求个性化 Claude Code 终端吉祥物的请求。
---
# Clawd 修改器

通过修改颜色与 ASCII 艺术，自定义 Claude Code mascot 的外观。

## 快速参考

**CLI 位置**：`/opt/node22/lib/node_modules/@anthropic-ai/claude-code/cli.js`

**Clawd 颜色**：
- 身体：`rgb(215,119,87)` / `ansi:redBright`
- 背景：`rgb(0,0,0)` / `ansi:black`

**小型 Clawd**（提示符）：
```
 ▐▛███▜▌
▝▜█████▛▘
  ▘▘ ▝▝
```

## 工作流

### 更改 Clawd 颜色

使用 `scripts/patch_color.py`：

```bash
# List available colors
python scripts/patch_color.py --list

# Apply preset
python scripts/patch_color.py blue

# Custom RGB
python scripts/patch_color.py --rgb 100,200,150

# Restore original
python scripts/patch_color.py --restore
```

### 添加手臂或修改图形

使用 `scripts/patch_art.py`：

```bash
# List variants
python scripts/patch_art.py --list

# Add arms
python scripts/patch_art.py --variant with-arms

# Individual modifications
python scripts/patch_art.py --add-left-arm
python scripts/patch_art.py --add-right-arm

# Restore original
python scripts/patch_art.py --restore
```

### 提取当前 Clawd

使用 `scripts/extract_clawd.py` 查看当前状态：

```bash
python scripts/extract_clawd.py
```

### 手动修改

对于脚本未覆盖的自定义修改，请直接编辑 cli.js：

1. 备份：`cp cli.js cli.js.bak`
2. 使用 grep 查找匹配模式
3. 使用 sed 或文本编辑器进行替换
4. 运行 `claude` 测试修改效果

模式示例：
```bash
# Find color definitions
grep -o 'clawd_body:"[^"]*"' cli.js | head -5

# Replace color
sed -i 's/rgb(215,119,87)/rgb(100,149,237)/g' cli.js
```

## 资源

- **Unicode 参考**：参见 `references/unicode-blocks.md` 获取区块字符
- **技术细节**：参见 `references/clawd-anatomy.md` 了解渲染内部机制
- **设计图库**：参见 `assets/clawd-variants.txt` 获取灵感

## 注意事项

- 修改将被 `npm update` 覆盖
- 修改前务必创建备份
- 修改后请使用 `claude --version` 进行测试
- 部分终端对 Unicode 支持有限