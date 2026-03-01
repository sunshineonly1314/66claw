---
name: portable-tools
name_zh: 便携工具
description: 构建跨设备工具，无需硬编码路径或账户名
description_zh: 构建跨设备工具，无需硬编码路径或账户名
---
# 可移植工具 —— 跨设备开发方法论

一种构建可在不同设备、命名方案与配置下运行的工具的方法论。该方法论源自 OAuth 刷新器调试会话（2026-01-23）的经验总结。

## 核心原则

**永远不要假设你的设备是唯一设备。**

你的本地环境只是众多可能配置中的一种。应面向通用场景构建，而非特定实例。

---

## 三个关键问题（编码前必答）

### 1. “哪些要素在不同设备间存在差异？”

在编写任何读取配置、数据或凭据的代码前：

**请思考：**
- 文件路径？（macOS vs Linux，不同家目录）
- 账户名？（user123 vs default vs oauth）
- 服务名？（拼写/大小写略有差异）
- 数据结构？（不同版本、不同格式）
- 运行环境？（不同 shell、不同可用工具）

**OAuth 刷新器案例：**
- ❌ 错误假设：账户名始终为 "claude"
- ✅ 实际情况：可能是 "claude"、"Claude Code"、"default" 等

**行动项：** 列出所有可变项，并使其可配置或自动发现

---

### 2. “我如何证明它确实有效？”

在宣称成功前：

**必须满足：**
- 具体的“改造前”状态（精确值）
- 具体的“改造后”状态（精确值）
- 二者不同的证据（并排对比）

**OAuth 刷新器案例：**
```
BEFORE:
- Access Token: POp5z1fi...eSN9VAAA
- Expires: 1769189639000

AFTER:
- Access Token: 01v0RrFG...eOE9QAA ✅ Different
- Expires: 1769190268000 ✅ Extended
```

**行动项：** 始终使用真实值展示数据转换过程

---

### 3. “当它出错时会发生什么？”

在推送到生产环境前：

**必须测试：**
- 错误配置（故意破坏配置）
- 缺失数据（移除预期字段）
- 多个条目（模糊情形）
- 边界情况（空值、特殊字符）

**OAuth 刷新器案例：**
- 测试 `keychain_account: "wrong-name"` → 回退机制应生效
- 测试不完整的密钥链数据 → 应优雅失败并给出有益错误提示

**行动项：** 测试故障模式，而不仅是理想路径

---

## 强制性模式

### 模式 1：显式优于隐式

**❌ 错误做法：**
```bash
# Ambiguous - returns first match
security find-generic-password -s "Service" -w
```

**✅ 正确做法：**
```bash
# Explicit - returns specific entry
security find-generic-password -s "Service" -a "account" -w
```

**规则：** 若命令存在歧义，必须显式声明。

---

### 模式 2：使用前先验证

**❌ 错误做法：**
```bash
DATA=$(read_config)
USE_VALUE="$DATA"  # Hope it's valid
```

**✅ 正确做法：**
```bash
DATA=$(read_config)
if ! validate_structure "$DATA"; then
    error "Invalid data structure"
fi
USE_VALUE="$DATA"
```

**规则：** 切勿假设数据具备预期结构。

---

### 模式 3：回退链机制

**❌ 错误做法：**
```bash
ACCOUNT="claude"  # Hardcoded
```

**✅ 正确做法：**
```bash
# Try configured → Try common → Error with help
ACCOUNT="${CONFIG_ACCOUNT}"
if ! has_data "$ACCOUNT"; then
    for fallback in "claude" "default" "oauth"; do
        if has_data "$fallback"; then
            ACCOUNT="$fallback"
            break
        fi
    done
fi
[[ -z "$ACCOUNT" ]] && error "No account found. Tried: ..."
```

**规则：** 为常见变体提供自动回退机制。

---

### 模式 4：提供有益的错误信息

**❌ 错误做法：**
```bash
[[ -z "$TOKEN" ]] && error "No token"
```

**✅ 正确做法：**
```bash
[[ -z "$TOKEN" ]] && error "No token found

Checked:
- Config: $CONFIG_FILE
- Field: $FIELD_NAME
- Expected: { \"tokens\": { \"refresh\": \"...\" } }

Verify with:
  cat $CONFIG_FILE | jq '.tokens'
"
```

**规则：** 错误信息应帮助用户诊断并修复问题。

---

## 调试方法论（Patrick 方法）

### 第一步：获取精确数据

**不要问：** “它坏了吗？”  
**要问：** “你看到的确切值是什么？有多少条目？哪一条包含所需数据？”

**示例：**
```bash
# Vague
"Check keychain"

# Specific
"Run: security find-generic-password -l 'Service' | grep 'acct'"
"Tell me: 1. How many entries 2. Which has tokens 3. Last modified"
```

---

### 第二步：用具体示例证明

**不要说：** “现在应该可以了。”  
**要展示：** “这是改造前的 token（POp5z...），这是改造后的（01v0R...），二者不同。”

**模板：**
```
BEFORE:
- Field1: <exact_value>
- Field2: <exact_value>

AFTER:
- Field1: <new_value> ✅ Changed
- Field2: <new_value> ✅ Changed

PROOF: Values are different
```

---

### 第三步：立即考虑跨设备兼容性

**不要想：** “在我的机器上能运行。”  
**要想：** “如果他们的设置在 [X] 方面不同，会怎样？”

**检查清单：**
- [ ] 账户名不同？
- [ ] 文件路径不同？
- [ ] 工具/版本不同？
- [ ] 权限不同？
- [ ] 数据格式不同？

---

## 发布前检查清单（发布前必做）

### 发现阶段
- [ ] 列出所有外部依赖（文件、命令、服务）
- [ ] 记录每个依赖所提供的功能
- [ ] 识别哪些部分可能因设备不同而变化

### 实现阶段
- [ ] 使可变项可配置（并提供合理默认值）
- [ ] 为每个输入添加验证逻辑
- [ ] 为常见变体构建回退链
- [ ] 添加 `--dry-run` 或 `--test` 模式

### 测试阶段
- [ ] 使用正确配置测试 → 应正常运行
- [ ] 使用错误配置测试 → 应回退或优雅失败
- [ ] 使用缺失数据测试 → 应给出有益错误提示
- [ ] 使用多个条目测试 → 应妥善处理歧义

### 文档阶段
- [ ] 记录默认假设
- [ ] 记录如何验证本地设置
- [ ] 记录常见变体及其处理方式
- [ ] 包含数据流图
- [ ] 添加故障排除章节

---

## 真实案例：OAuth 刷新器

### 原始版本（有缺陷）
```bash
# Assumes single entry, no validation, no fallback
KEYCHAIN_DATA=$(security find-generic-password -s "Service" -w)
REFRESH_TOKEN=$(echo "$KEYCHAIN_DATA" | jq -r '.refreshToken')
# Use token (hope it's valid)
```

**问题：**
- 返回字典序首个匹配项（错误条目）
- 无数据验证（可能为空或格式错误）
- 无回退机制（账户名不同时即失败）

---

### 修复版本（可移植）
```bash
# Explicit account with validation and fallback
validate_data() {
    echo "$1" | jq -e '.claudeAiOauth.refreshToken' > /dev/null 2>&1
}

# Try configured account
DATA=$(security find-generic-password -s "$SERVICE" -a "$ACCOUNT" -w 2>&1)
if validate_data "$DATA"; then
    log "✓ Using account: $ACCOUNT"
else
    log "⚠ Trying fallback accounts..."
    for fallback in "claude" "Claude Code" "default"; do
        DATA=$(security find-generic-password -s "$SERVICE" -a "$fallback" -w 2>&1)
        if validate_data "$DATA"; then
            ACCOUNT="$fallback"
            log "✓ Found data in: $fallback"
            break
        fi
    done
fi

[[ -z "$DATA" ]] || ! validate_data "$DATA" && error "No valid data found
Tried accounts: $ACCOUNT, claude, Claude Code, default
Verify with: security find-generic-password -l '$SERVICE'"

REFRESH_TOKEN=$(echo "$DATA" | jq -r '.claudeAiOauth.refreshToken')
```

**改进点：**
- ✅ 显式指定账户参数
- ✅ 验证数据结构
- ✅ 自动回退至常见账户名
- ✅ 提供含验证命令的有益错误提示

---

## 常见反模式

### 反模式 1：“在我机器上能运行”
```bash
FILE="/Users/patrick/.config/app.json"  # Hardcoded path
```

**修复：** 使用 `$HOME`、检测操作系统，或使其可配置

---

### 反模式 2：“希望它就在那儿”
```bash
TOKEN=$(cat config.json | jq -r '.token')
# What if .token doesn't exist? Script continues with empty value
```

**修复：** 使用前先验证
```bash
TOKEN=$(cat config.json | jq -r '.token // empty')
[[ -z "$TOKEN" ]] && error "No token in config"
```

---

### 反模式 3：“第一个匹配项就是正确的”
```bash
# If multiple entries exist, which one?
ENTRY=$(find_entry "service")
```

**修复：** 显式指定或枚举全部选项
```bash
ENTRY=$(find_entry "service" "account")  # Specific
# OR
ALL=$(find_all_entries "service")
for entry in $ALL; do
    validate_and_use "$entry"
done
```

---

### 反模式 4：“静默失败”
```bash
process_data || true  # Ignore errors
```

**修复：** 显式报错并附带上下文
```bash
process_data || error "Failed to process
Data: $DATA
Expected: { ... }
Check: command_to_verify"
```

---

## 与现有工作流集成

### 与 sprint-plan.md 集成
添加至测试部分：
```markdown
## Cross-Device Testing
- [ ] Test with different account names
- [ ] Test with wrong config values
- [ ] Test with missing data
- [ ] Document fallback behavior
```

### 与 PRIVACY-CHECKLIST.md 集成
发布前添加：
```markdown
## Portability Check
- [ ] No hardcoded paths (use $HOME, detect OS)
- [ ] No hardcoded names (use config or fallback)
- [ ] Validation on all inputs
- [ ] Helpful errors for common issues
```

### 与 skill-creator 集成
构建新 skills 时：
1. 列出设备间可能存在的差异
2. 使其可配置或自动发现
3. 使用错误配置进行测试
4. 记录故障排除方法

---

## 快速参考卡

**编码前：**
1. 哪些要素在不同设备间存在差异？
2. 我如何证明它确实有效？
3. 当它出错时会发生什么？

**强制性模式：**
- 显式优于隐式
- 使用前先验证
- 回退链机制
- 提供有益的错误信息

**测试：**
- 正确配置 → 正常运行
- 错误配置 → 回退或给出有益错误
- 缺失数据 → 清晰的诊断信息

**文档：**
- 数据流图
- 常见变体
- 故障排除指南

---

## 成功标准

当一个工具满足以下条件时，即视为**可移植**：

1. ✅ 无需修改即可在不同设备上运行
2. ✅ 可自动识别配置中的常见差异
3. ✅ 出错时能优雅失败并提供可操作的错误信息
4. ✅ 仅通过阅读错误输出即可完成调试
5. ✅ 文档涵盖“若我的配置不同，该怎么办？”

**测试方法：** 将其交给一位配置不同的用户。若对方仍需向你提问，则该工具尚未达到可移植标准。

---

## 起源故事

本方法论源自对 OAuth 刷新器（2026-01-23）的调试过程：
- 脚本读取了错误的密钥链条目（未指定账户名）
- 假设仅存在一个条目（实际存在多个）
- 无数据验证（使用了空数据）
- 无回退机制（账户名不同时即失败）

Patrick 的方法：
1. 要求提供精确数据（多少条目？哪条含 token？）
2. 要求提供证据（展示改造前/后 token）
3. 立即考虑跨设备兼容性（命名是否不同？）

成果：工具从仅限单设备/有缺陷，转变为通用型/生产就绪。

**关键洞见：** 问题不在逻辑本身，而在所作的假设。

---

## 何时使用本 skill

**适用场景：**
- 构建读取系统配置的工具
- 处理密钥链、凭据、环境变量
- 创建需在多台机器上运行的脚本
- 向 ClawdHub 发布 skills（他人将使用它们）

**应用步骤：**
1. 实现前：回答三个关键问题
2. 实现中：采用强制性模式
3. 测试前：运行发布前检查清单
4. 测试后：记录变体与故障排除方法

**谨记：** 你的设备只是其中一种情况。请面向通用场景构建。