# 迭代式技能清洗流程

## 概述

对 awesome-openclaw-skills 的 3000+ 技能进行批量清洗，300个/批次，每批后 review 并优化提示词。

## 流程

### 第一轮（Batch 1: 1-300）

```bash
# 1. 清洗第一批
npx tsx cn/skills-qc/batch-wash.ts --batch 1

# 2. Review 结果
npx tsx cn/skills-qc/batch-wash.ts --review 1

# 3. 标记误判案例（手动检查前 50 个 rejected）
# 如果发现误判：
npx tsx cn/skills-qc/batch-wash.ts --restore <skill-name>

# 4. 分析误判模式
npx tsx cn/skills-qc/optimize-prompts.ts --analyze

# 5. 生成优化建议
npx tsx cn/skills-qc/optimize-prompts.ts --suggest

# 6. 手动优化提示词
# - 编辑 cn/skills-qc/layer1-rules.ts
# - 编辑 cn/skills-qc/layer2-security.ts
# - 编辑 cn/skills-qc/layer3-quality.ts
```

### 第二轮（Batch 2: 301-600）

```bash
# 1. 清洗第二批（使用优化后的提示词）
npx tsx cn/skills-qc/batch-wash.ts --batch 2

# 2. Review 结果
npx tsx cn/skills-qc/batch-wash.ts --review 2

# 3. 对比第一批和第二批的误判率
# 如果误判率下降 → 提示词优化有效
# 如果误判率未下降 → 继续调整提示词

# 4. 继续标记误判并优化
npx tsx cn/skills-qc/batch-wash.ts --restore <skill-name>
npx tsx cn/skills-qc/optimize-prompts.ts --analyze
npx tsx cn/skills-qc/optimize-prompts.ts --suggest
```

### 第三轮及后续（Batch 3-10: 601-3000）

```bash
# 当误判率稳定在可接受范围（如 <5%）后，加速处理

# 方式 1: 逐批处理
npx tsx cn/skills-qc/batch-wash.ts --batch 3
npx tsx cn/skills-qc/batch-wash.ts --batch 4
# ...

# 方式 2: 自动续传（从上次中断处继续）
npx tsx cn/skills-qc/batch-wash.ts --resume
# 等待完成后再次运行
npx tsx cn/skills-qc/batch-wash.ts --resume
```

## 监控指标

每批次后检查：

1. **收录率**: finalAccepted / totalScanned
2. **Layer1 拒绝率**: Layer1 拒绝数 / totalScanned
3. **Layer2 拒绝率**: Layer2 拒绝数 / totalScanned
4. **Layer3 拒绝率**: Layer3 拒绝数 / totalScanned
5. **人工标记误判率**: review annotations / rejected

### 目标

- Layer1 误判率 < 3%（严格规则，应该很少误判）
- Layer2 误判率 < 5%（安全判定，容易误判，需重点优化）
- Layer3 误判率 < 5%（质量评分，可能过于严格）

## 提示词优化方向

### Layer1 (规则引擎)

常见误判模式：
- **过度匹配关键词**: 如 `eval(`, `exec(`，但在安全上下文中使用
- **正则规则过严**: 如禁止所有 `rm -rf`，但有些是在文档中说明风险

优化方向：
- 添加上下文检查（如代码块、注释、文档说明）
- 放宽某些规则的严格度
- 添加白名单例外

### Layer2 (安全审计)

常见误判模式：
- **合法的密钥管理工具** 被误判为"硬编码密钥"
- **容器化部署** 被误判为"远程命令执行"
- **第三方 API 调用** 被误判为"数据泄露"

优化方向：
- 在 SYSTEM_PROMPT 中添加"精准判定"指导
- 明确说明合法场景（如 1Password CLI、HashiCorp Vault）
- 要求模型区分"工具本身"vs"滥用工具"

### Layer3 (质量评分)

常见误判模式：
- **特定领域技能** 因"受众小"被低评分
- **简洁技能** 因"代码少"被低评分
- **中国特有服务** 因"国际化差"被低评分

优化方向：
- 调整 `usefulnessScore` 权重（不要过分惩罚小众技能）
- 调整 `codeQualityScore` 计算（简洁不等于低质量）
- 降低 `overallScore` 阈值（从 6.5 降到 6.0）

## 最终合并

全部批次完成后：

```bash
# 1. 合并所有批次的 accepted skills
node scripts/merge-batch-results.mjs

# 2. 与现有 55 个技能去重合并
node scripts/merge-with-existing.mjs

# 3. 运行 SkillsUpdate 生成 v3 索引
npx tsx cn/skills-publish/run.ts

# 4. 查看最终统计
npx tsx cn/skills-publish/run.ts --stats
```

## 预估成本和时间

- **总技能数**: ~3000
- **批次数**: 10 批（每批 300）
- **每批耗时**: 约 15 分钟（300 技能 × 3秒）
- **总耗时**: 2.5 小时
- **API 成本**: 约 $10-20（Qwen API，取决于具体调用量）

## 文件结构

```
cn/skills-qc/
├── output-batch/
│   ├── batch-1/
│   │   ├── skills-index.json
│   │   ├── skills-en/
│   │   ├── skills-zh/
│   │   └── report/
│   ├── batch-2/
│   │   └── ...
│   ├── ...
│   ├── checkpoint.json
│   └── review/
│       ├── skill-1.json  (误判标注)
│       ├── skill-2.json
│       └── ...
```
