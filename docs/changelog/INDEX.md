# OpenClawCN 变更归档索引

> **使用说明**：AI 每次只需读取本文件的 **索引表** 即可了解所有历史变更。
> 需要详情时，按 `entry-id` 读取 `docs/changelog/entries/{entry-id}.md`。
> 新增条目请使用 `/archive` skill 或手动按模板添加。

---

## 快速统计

| 指标 | 值 |
|------|-----|
| 总条目 | 3 |
| 最后更新 | 2026-02-17 |
| 待验证 | 1 |

---

## 索引表

> **字段说明**：ID=唯一编号 / 日期 / 类型(bugfix/feature/optimize/refactor) / 优先级(P0-P3) / 状态(done/testing/pending) / 标题 / 影响范围

| ID | 日期 | 类型 | 优先级 | 状态 | 标题 | 影响范围 |
|----|------|------|--------|------|------|----------|
| [CL-2026-0208-001](entries/CL-2026-0208-001.md) | 2026-02-08 | bugfix+optimize | P0 | done | Chat 页面 API 错误无响应（不说话） | 后端错误链路 + 前端错误渲染 |
| [CL-2026-0208-002](entries/CL-2026-0208-002.md) | 2026-02-08 | bugfix+feature | P0 | done | Windows 升级安全性改造 — 防止用户记忆丢失 | 安装包 + Gateway 关闭链 + Windows 服务 |
| [CL-2026-0217-001](entries/CL-2026-0217-001.md) | 2026-02-17 | bugfix+feature | P0 | done | Memory 搜索管道 updatedAt 断裂修复 + 冷热分层集成 | Memory 搜索管道 + 冷热分层 + 85 防御测试 |

---

## 按模块分类速查

### 后端 - Agent/错误处理
- [CL-2026-0208-001](entries/CL-2026-0208-001.md) Chat 页面 403 错误无响应

### 前端 - Chat UI
- [CL-2026-0208-001](entries/CL-2026-0208-001.md) 错误消息渲染优化 + 双重格式化修复

### 网关 - Gateway
- [CL-2026-0208-001](entries/CL-2026-0208-001.md) transcript 写入兜底
- [CL-2026-0208-002](entries/CL-2026-0208-002.md) 新增 /api/shutdown 优雅关闭端点 + fullClose 绑定

### Windows 安装/服务
- [CL-2026-0208-002](entries/CL-2026-0208-002.md) 升级安全性改造：删除在线包 + 优雅关闭 + 数据备份 + Watchdog 竞态修复

### Memory 搜索/索引
- [CL-2026-0217-001](entries/CL-2026-0217-001.md) updatedAt 管道全链路修复 + applyTimeTiering 冷热分层集成 + 85 防御测试

---

## 归档规范

### ID 格式
```
CL-{YYYY}-{MMDD}-{序号}
```
示例：`CL-2026-0208-001`

### 条目文件模板
位置：`docs/changelog/entries/{ID}.md`

```markdown
# {ID}: {标题}

## 元信息
| 字段 | 值 |
|------|-----|
| 日期 | YYYY-MM-DD |
| 类型 | bugfix / feature / optimize / refactor |
| 优先级 | P0(线上事故) / P1(严重) / P2(一般) / P3(优化) |
| 状态 | done / testing / pending |
| 来源 | 客诉 / 内部发现 / 需求 |

## 一句话摘要
{50字以内的问题+结果描述}

## 问题描述
{用户视角的问题现象}

## 根因分析
{技术层面的原因}

## 修改内容
| 文件 | 改动类型 | 说明 |
|------|----------|------|
| path/to/file | 新增/修改/删除 | 简要说明 |

## 验证方式
- [ ] 编译通过
- [ ] 测试通过
- [ ] 手动验证

## 关联
- 关联 issue: #xxx
- 关联 PR: #xxx
- 前置依赖: CL-xxx
```
