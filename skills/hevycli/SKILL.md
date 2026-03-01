---
name: hevycli
description: 通过命令行访问并分析 Hevy 健身追踪数据，包括训练计划、常规训练及练习动作模板。
description_zh: 通过命令行访问并分析 Hevy 健身追踪数据，包括训练计划、常规训练及练习动作模板。
---
# Hevy CLI Skill

## 描述

通过命令行访问并分析 Hevy 健身追踪数据，包括训练计划、常规训练及练习动作模板。

## 使用场景

当用户提出以下请求时，请使用本 skill：
- 查看其训练历史或近期训练
- 获取某次特定训练的详细信息
- 查询其总训练次数
- 列出或查看其训练常规
- 浏览练习动作模板
- 将训练数据导出为 JSON 格式
- 分析其长期健身进展

## 前置条件

- 用户必须已安装 `hevycli`（`go install github.com/nsampre/hevycli@latest`）
- 用户必须已配置 Hevy API 密钥（`hevycli config set-api-key <key>`）
- 用户必须拥有 Hevy Pro 订阅

## 可用命令

### 配置
```bash
# Set API key
hevycli config set-api-key <api-key-uuid>

# View current config
hevycli config show
```

### 训练计划
```bash
# List recent workouts
hevycli workouts list [--page N] [--page-size N] [--format json|table]

# Get detailed workout information (accepts full UUID or 8-char short ID)
hevycli workouts get <workout-id>

# Get total workout count
hevycli workouts count
```

### 常规训练
```bash
# List routines
hevycli routines list [--page N] [--page-size N] [--format json|table]

# Get routine details (accepts full UUID or 8-char short ID)
hevycli routines get <routine-id>
```

### 练习动作
```bash
# List exercise templates
hevycli exercises list [--page N] [--page-size N] [--format json|table]

# Get exercise template details
hevycli exercises get <template-id>
```

## 全局标志

- `--format` - 输出格式：`table`（默认）或 `json`
- `--debug` - 启用调试输出以显示 API 请求详情

## 使用示例

### 示例 1：查看近期训练历史
```bash
hevycli workouts list --page-size 5
```

### 示例 2：获取含组数与次数的详细训练信息
```bash
# Using short ID (first 8 characters)
hevycli workouts get f75e9c13

# Or using full UUID
hevycli workouts get f75e9c13-32d7-407d-9715-011f5d5698fa
```

### 示例 3：导出数据用于分析
```bash
# Export all workouts as JSON
hevycli workouts list --format json > workouts.json

# Export routines
hevycli routines list --format json > routines.json
```

### 示例 4：检查进展
```bash
# View total workouts completed
hevycli workouts count

# List exercise templates to find specific exercise IDs
hevycli exercises list
```

## Claude 使用提示

1. **使用 JSON 格式进行分析**：帮助用户分析其数据时，请使用 `--format json` 获取结构化数据，以便解析与分析。

2. **支持短 ID**：用户可直接从 `workouts list` 输出中复制短 ID，并在 `workouts get` 命令中直接使用。

3. **分页**：API 单页最大容量为 10 条。使用分页参数（`--page N`）可访问更早的训练记录。

4. **错误处理**：若命令执行失败：
   - 检查 API 密钥是否已配置（`hevycli config show`）
   - 确认用户是否拥有 Hevy Pro 订阅
   - 检查所用 ID 是否存在或有效

5. **数据洞察**：在获取训练数据后，您可以：
   - 计算训练量（重量 × 次数 × 组数）
   - 追踪长期进展
   - 识别训练频率模式
   - 建议休息日间隔

## 示例交互

**用户**：“给我看看我最近三次训练。”

**Claude**：
```bash
hevycli workouts list --page-size 3
```

**用户**：“获取第一次训练的详细信息。”

**Claude**：
```bash
# Using the short ID from the list output
hevycli workouts get f75e9c13
```

**用户**：“我总共完成了多少次训练？”

**Claude**：
```bash
hevycli workouts count
```

## 注意事项

- 本工具仅读取数据，不创建或修改训练计划
- 所有时间戳均采用 ISO 8601 格式
- 重量单位始终以千克（kg）显示
- 距离单位为米（m），持续时间单位为秒（s）
- 表格输出支持训练标题中的 Emoji（终端不同可能导致轻微对齐问题）