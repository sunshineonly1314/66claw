# 🐛 关键 Bug 分析报告

生成时间: 2026-02-11
分析师: 顶级测试专家

---

## 🔴 Bug #1: Banner Cooldown 逻辑错误 (P0 高危)

### 问题定位

**文件**: `src/agents/skills/install-state.ts`
**函数**: `isBannerDismissed()` (Line 178-184)
**常量**:
- `BANNER_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000` (Line 175) ✅ 正确
- `BANNER_MAX_DISMISS_COUNT = 1` (Line 176) ⚠️ **这是根本问题!**

### 根因分析

#### 当前实现:
```typescript
const BANNER_MAX_DISMISS_COUNT = 1; // 点击"稍后"一次即永久关闭

export function isBannerDismissed(): boolean {
  const state = readStateFromDisk();
  if (!state.banner_dismissed_at) return false;
  if ((state.banner_dismiss_count ?? 0) >= BANNER_MAX_DISMISS_COUNT) return true; // ⚠️ 问题在这里
  const dismissedAt = new Date(state.banner_dismissed_at).getTime();
  return (Date.now() - dismissedAt) < BANNER_COOLDOWN_MS;
}
```

#### 测试预期:
```typescript
// 测试用例 1: "isBannerDismissed returns false after cooldown expires"
await saveInstallState({
  banner_dismissed_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  banner_dismiss_count: 1, // ⚠️ count = 1
});
expect(isBannerDismissed()).toBe(false); // ❌ 失败: 返回 true
```

#### Bug 原因:

**逻辑冲突**:
1. `BANNER_MAX_DISMISS_COUNT = 1` 表示"点击一次就永久关闭"
2. 但测试期望的行为是:
   - 点击一次 → 3天冷却期
   - 点击多次 (≥3次) → 永久关闭

**当前代码执行流程**:
```
isBannerDismissed() 调用时:
  ├─ banner_dismiss_count = 1
  ├─ 1 >= BANNER_MAX_DISMISS_COUNT (1) ✅ 条件成立
  └─ 直接 return true (永久关闭)

  ❌ 永远不会执行到时间比较逻辑!
```

**应该的执行流程**:
```
isBannerDismissed() 调用时:
  ├─ banner_dismiss_count = 1
  ├─ 1 >= BANNER_MAX_DISMISS_COUNT (应该是 3) ❌ 条件不成立
  ├─ 执行时间比较: (Date.now() - dismissedAt) < BANNER_COOLDOWN_MS
  ├─ 4天 > 3天冷却期
  └─ return false (冷却期已过,横幅应该再次显示)
```

### 修复方案

#### Option 1: 修改常量 (推荐)
```typescript
const BANNER_MAX_DISMISS_COUNT = 3; // 改为 3 次
```

**理由**:
- 测试用例明确期望 `count >= 3` 才永久关闭
- 注释说"点击一次即永久关闭"与测试不符,应该是产品需求变更

#### Option 2: 修改测试 (不推荐)
如果产品需求确实是"点击一次永久关闭",那么需要修改所有测试用例。

**但这会导致**:
- 3天冷却期逻辑变得无意义
- 用户体验变差 (无法再次看到重要横幅)

### 影响评估

**功能影响**:
- ✅ 当前: 用户点击"稍后"一次就永久看不到横幅
- ❌ 预期: 用户需要点击 3 次才永久关闭,每次点击有 3 天冷却期

**用户体验影响**:
- 严重: 重要功能的横幅提示无法按预期重新展示
- 用户可能错过重要更新通知

**业务影响**:
- 中等: Skills 批量安装功能的横幅提示机制失效
- 新用户引导可能受到影响

---

## 🔴 Bug #2: Media Sandbox Staging 失败

### 问题定位

**测试文件**: `src/auto-reply/reply.triggers.trigger-handling.stages-inbound-media-into-sandbox-workspace.test.ts`
**失败用例**: `stages inbound media into the sandbox workspace`
**相关文件**: `src/auto-reply/envelope.ts` (有未提交修改 ✏️)

### 可能原因

1. **Envelope 格式改动**:
   - `envelope.ts` 文件有改动
   - 可能影响媒体文件元数据的传递
   - 时间戳格式变更可能导致路径解析错误

2. **路径问题**:
   - Windows 路径分隔符 `\` vs `/`
   - 沙盒目录权限不足
   - 临时文件路径解析错误

3. **媒体文件处理**:
   - 文件复制/移动操作失败
   - MIME 类型检测错误
   - 文件大小限制检查失败

### 调查建议

需要查看:
1. ✅ `src/auto-reply/envelope.ts` 的 git diff
2. ✅ 测试用例的完整代码
3. ✅ 沙盒路径配置和权限
4. ✅ 媒体文件处理的日志

---

## 📊 总结

### 已确认的问题

| Bug | 严重性 | 根因 | 修复难度 | 预计时间 |
|-----|--------|------|---------|---------|
| Banner Cooldown 逻辑错误 | **P0-高危** | 常量配置错误 | 简单 | 5 分钟 |
| Media Sandbox Staging | **P1-中等** | 待调查 | 中等 | 30 分钟 |

### 下一步行动

1. ✅ **立即修复**: 修改 `BANNER_MAX_DISMISS_COUNT` 从 1 改为 3
2. ✅ **验证修复**: 重新运行 `install-state.test.ts`
3. ⏳ **深度调查**: Media sandbox 失败的根本原因
4. ⏳ **回归测试**: 确保修复没有引入新问题

---

**分析完成时间**: 2026-02-11 23:00
**待顶级技术专家审核与确认修复方案**
