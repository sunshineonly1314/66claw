---
name: smalltalk
name_zh: 闲聊助手
description: 与实时 Smalltalk 镜像（Cuis 或 Squeak）交互。可用于执行 Smalltalk 代码、浏览类、查看方法源码、定义类/方法、查询继承关系与分类。
description_zh: 与实时 Smalltalk 镜像（Cuis 或 Squeak）交互。可用于执行 Smalltalk 代码、浏览类、查看方法源码、定义类/方法、查询继承关系与分类。
metadata: {"clawdbot":{"emoji":"💎","requires":{"bins":["python3","xvfb-run"]}}}
---
# Smalltalk 技能

通过 MCP 与实时 Squeak/Cuis 镜像交互并执行 Smalltalk 代码。

## 前置条件

**请先获取 ClaudeSmalltalk 仓库：**

```bash
git clone https://github.com/CorporateSmalltalkConsultingLtd/ClaudeSmalltalk.git
```

该仓库包含：
- Squeak 的 MCP 服务器代码（`MCP-Server-Squeak.st`）
- 安装说明文档（`SQUEAK-SETUP.md`、`CLAWDBOT-SETUP.md`）
- 本 Clawdbot 技能（`clawdbot/`）

## 安装步骤

1. **配置带 MCP 服务器的 Squeak** —— 参见 [SQUEAK-SETUP.md](https://github.com/CorporateSmalltalkConsultingLtd/ClaudeSmalltalk/blob/main/SQUEAK-SETUP.md)
2. **配置 Clawdbot** —— 参见 [CLAWDBOT-SETUP.md](https://github.com/CorporateSmalltalkConsultingLtd/ClaudeSmalltalk/blob/main/CLAWDBOT-SETUP.md)

## 使用方式

```bash
# Check setup
python3 smalltalk.py --check

# Evaluate code
python3 smalltalk.py evaluate "3 factorial"
python3 smalltalk.py evaluate "Date today"

# Browse a class
python3 smalltalk.py browse OrderedCollection

# View method source
python3 smalltalk.py method-source String asUppercase

# List classes (with optional prefix filter)
python3 smalltalk.py list-classes Collection

# Get class hierarchy
python3 smalltalk.py hierarchy OrderedCollection

# Get subclasses  
python3 smalltalk.py subclasses Collection

# List all categories
python3 smalltalk.py list-categories

# List classes in a category
python3 smalltalk.py classes-in-category "Collections-Sequenceable"

# Define a new class
python3 smalltalk.py define-class "Object subclass: #Counter instanceVariableNames: 'count' classVariableNames: '' poolDictionaries: '' category: 'MyApp'"

# Define a method
python3 smalltalk.py define-method Counter "increment
    count := (count ifNil: [0]) + 1.
    ^ count"

# Delete a method
python3 smalltalk.py delete-method Counter increment

# Delete a class
python3 smalltalk.py delete-class Counter
```

## 命令列表

| 命令 | 描述 |
|---------|-------------|
| `--check` | 验证虚拟机/镜像路径及依赖项 |
| `--debug` | 调试挂起系统（发送 SIGUSR1，捕获堆栈跟踪） |
| `evaluate <code>` | 执行 Smalltalk 代码并返回结果 |
| `browse <class>` | 获取类元数据（父类、实例变量、方法） |
| `method-source <class> <selector>` | 查看方法源代码 |
| `define-class <definition>` | 创建或修改类 |
| `define-method <class> <source>` | 添加或更新方法 |
| `delete-method <class> <selector>` | 删除方法 |
| `delete-class <class>` | 删除类 |
| `list-classes [prefix]` | 列出所有类（可选过滤） |
| `hierarchy <class>` | 获取父类链 |
| `subclasses <class>` | 获取直接子类 |
| `list-categories` | 列出全部系统分类 |
| `classes-in-category <cat>` | 列出某分类下的所有类 |

## 环境变量

| 变量 | 描述 |
|----------|-------------|
| `SQUEAK_VM_PATH` | Squeak/Cuis 虚拟机可执行文件路径 |
| `SQUEAK_IMAGE_PATH` | 含 MCP 服务器的 Smalltalk 镜像路径 |

## 注意事项

- Linux 服务器上无头运行需依赖 xvfb
- 使用 Squeak 6.0 MCP 服务器（若显示可用，则 GUI 保持响应）
- `saveImage` 因安全原因被有意排除