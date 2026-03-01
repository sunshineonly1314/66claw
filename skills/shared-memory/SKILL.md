---
name: shared-memory
name_zh: 共享内存
description: 与其他用户共享记忆与状态。当用户希望共享知识、创建用户/群组、授予权限、设置家庭或团队共享、订阅记忆变更，或管理其记忆知识库的访问控制时使用。本共享记忆 skill 基于 Ensue —— 一个面向 agents 的共享记忆网络。
description_zh: 与其他用户共享记忆与状态。当用户希望共享知识、创建用户/群组、授予权限、设置家庭或团队共享、订阅记忆变更，或管理其记忆知识库的访问控制时使用。本共享记忆 skill 基于 Ensue —— 一个面向 agents 的共享记忆网络。
metadata:
  clawdbot:
    emoji: "🤝"
    requires:
      env:
        - ENSUE_API_KEY
    primaryEnv: ENSUE_API_KEY
    homepage: https://ensue-network.ai
---
# 共享记忆

将您的知识库中的记忆共享给其他用户。管理用户、群组，以及命名空间（namespace）的细粒度权限。

## 快速开始

```bash
# Create user and group
{baseDir}/scripts/shared-memory.sh create-user mark
{baseDir}/scripts/shared-memory.sh create-group family
{baseDir}/scripts/shared-memory.sh add-member family mark

# Grant access
{baseDir}/scripts/shared-memory.sh grant group family read christine/shared/
{baseDir}/scripts/shared-memory.sh grant group family update christine/shared/
```  

## 命名空间（Namespace）组织方式

```
<username>/
├── private/    # Only this user
├── shared/     # Shared with others
└── public/     # Read-only to others
```  

授予 `mark/shared/` 访问权限 → 所有共享内容  
授予 `mark/shared/recipes/` 访问权限 → 仅限食谱（recipes）

## 命令

### 用户（Users）
| 命令 | 描述 |
|------|------|
| `create-user <username>` | 创建用户 |
| `delete-user <username>` | 删除用户 |

### 群组（Groups）
| 命令 | 描述 |
|------|------|
| `create-group <name>` | 创建群组 |
| `delete-group <name>` | 删除群组 |
| `add-member <group> <user>` | 将用户加入群组 |
| `remove-member <group> <user>` | 将用户移出群组 |

### 权限（Permissions）
| 命令 | 描述 |
|------|------|
| `grant org <action> <pattern>` | 授予组织（org）权限 |
| `grant user <name> <action> <pattern>` | 授予用户权限 |
| `grant group <name> <action> <pattern>` | 授予群组权限 |
| `revoke <grant_id>` | 撤销权限 |
| `list` | 列出全部授权 |
| `list-permissions` | 列出有效权限 |

**操作类型（Actions）：** `read`、`create`、`update`、`delete`  

### 订阅（Subscriptions）
| 命令 | 描述 |
|------|------|
| `subscribe <key>` | 在发生变更时接收通知 |
| `unsubscribe <key>` | 停止通知 |
| `list-subscriptions` | 列出所有订阅 |

## 示例：家庭共享

```bash
# Create user for partner
{baseDir}/scripts/shared-memory.sh create-user mark

# Create family group
{baseDir}/scripts/shared-memory.sh create-group family
{baseDir}/scripts/shared-memory.sh add-member family mark

# Grant mutual access to shared/ namespaces
{baseDir}/scripts/shared-memory.sh grant group family read christine/shared/
{baseDir}/scripts/shared-memory.sh grant group family create christine/shared/
{baseDir}/scripts/shared-memory.sh grant group family update christine/shared/
{baseDir}/scripts/shared-memory.sh grant group family read mark/shared/
{baseDir}/scripts/shared-memory.sh grant group family update mark/shared/
```  

## 故障排查

若命令执行失败，请首先检查是否已配置 Ensue API 密钥：

```bash
echo $ENSUE_API_KEY
grep -A2 'ensue-learning-memory' ~/.clawdbot/clawdbot.json
```  

若未找到 API 密钥，请告知用户前往 https://www.ensue-network.ai/login 免费获取密钥，并在 `~/.clawdbot/clawdbot.json` 中完成配置：

```json
{
  "skills": {
    "entries": {
      "ensue-learning-memory": {
        "apiKey": "their-api-key-here"
      }
    }
  }
}
```  

若密钥存在但命令仍失败，该密钥可能已失效——请让用户生成新的密钥。