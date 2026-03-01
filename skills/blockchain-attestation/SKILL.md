---
name: blockchain_attestation
name_zh: 区块链存证
description: 使用以太坊认证服务（EAS）为 agent 工作创建可验证的链上/链下认证，Base 为默认链。
description_zh: 使用以太坊认证服务（EAS）为 agent 工作创建可验证的链上/链下认证，Base 为默认链。
metadata: {"clawdbot":{"emoji":"⛓️","homepage":"https://attest.org","requires":{"bins":["node"]},"primaryEnv":"EAS_PRIVATE_KEY"}}
---
# 区块链认证（EAS）

本 skill 使用以太坊认证服务（EAS）创建已完成工作的**链上**或**链下**认证。

约定俗成的默认设置：
- 默认链：**Base 主网**  
- 默认模式：**链下**（零 Gas 费，仍可验证）  
- 默认数据模型：存储任务与交付成果的**哈希值**（外加一个小型 agent ID 及元数据字符串）  

## 安全与隐私规则

1. **切勿**将密钥、私钥、代币或用户私有数据放入链上认证中。  
2. 大多数场景下应**优先选择链下认证**。  
3. 若需为链下认证添加公开时间戳锚点，可使用 **timestamp** 命令——该命令仅将 UID 上链锚定，不发布完整有效载荷。  
4. 仅当用户明确请求或已批准相关费用后，才可执行链上交易。

## 环境变量

签名所需（链上或链下）：
- `EAS_PRIVATE_KEY`

链上交易及链上读取所需：
- `EAS_RPC_URL`（所选链的 RPC 端点）

可选：
- `EAS_CHAIN`（`base` 或 `base_sepolia`，默认为 `base`）  
- `CLAWDBOT_AGENT_ID`（覆盖 `agentId` 字段）  

## 一次性设置

安装 Node 依赖项（仅需一次）：

```bash
cd {baseDir} && npm install
```

## 每条链仅需一次：注册 schema

本 skill 使用单一 schema：

```
bytes32 taskHash, bytes32 outputHash, string agentId, string metadata
```

执行链上交易完成注册，并将生成的 schema UID 持久化至 `schemas.json`：

```bash
cd {baseDir} && node attest.mjs schema register --chain base
```

针对 Base Sepolia：

```bash
cd {baseDir} && node attest.mjs schema register --chain base_sepolia
```

## 创建认证（推荐：链下）

最佳默认工作流：
1. 提供任务描述文本  
2. 提供交付成果文件路径（或交付成果文本）  
3. 创建链下认证  
4. 将已签名的有效载荷保存至文件  
5. 向用户返回 UID 及对应浏览器探索器链接  

示例：

```bash
cd {baseDir} && node attest.mjs attest \
  --mode offchain \
  --chain base \
  --task-text "Summarize Q4 board deck into 1 page memo" \
  --output-file ./deliverables/memo.pdf \
  --recipient 0x0000000000000000000000000000000000000000 \
  --metadata '{"hashAlg":"sha256","artifact":"memo.pdf"}' \
  --save ./attestations/latest.offchain.json
```

## 将链下 UID 时间戳锚定至链上（可选锚点）

```bash
cd {baseDir} && node attest.mjs timestamp --chain base --uid <uid>
```

## 创建链上认证（消耗 Gas）

```bash
cd {baseDir} && node attest.mjs attest \
  --mode onchain \
  --chain base \
  --task-text "..." \
  --output-file ./path/to/output \
  --metadata '{"hashAlg":"sha256"}'
```

## 验证

验证链上 UID：

```bash
cd {baseDir} && node attest.mjs verify --chain base --uid <uid>
```

验证由本 skill 生成的链下认证 JSON 文件：

```bash
cd {baseDir} && node attest.mjs verify --offchain-file ./attestations/latest.offchain.json
```

## 哈希辅助工具

如仅需哈希值而无需创建认证：

```bash
cd {baseDir} && node attest.mjs hash --file ./deliverables/memo.pdf
```

## 输出契约

所有命令均向 stdout 输出单个 JSON 对象。  
- 成功时：`{ "success": true, ... }`  
- 出错时：`{ "success": false, "error": { "code": "...", "message": "...", "details": ... } }`  

此设计旨在确保 agent 能可靠解析结果。