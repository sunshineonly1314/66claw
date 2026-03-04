# v1.6.7 跨 Agent 构建协调

**版本**: 1.6.7
**发起时间**: 2026-03-05
**Windows Agent**: Claude (本机 KEVINUP)
**macOS Agent**: Claude (远程 macOS 构建机)

---

## 本版本变更内容

| 类型 | 描述 |
|------|------|
| perf | status RPC 10s 缓存 + in-flight 去重 (health.ts) |
| perf | skills.status 15s 缓存 + in-flight 去重 (skills.ts) |
| perf | debug 轮询 3s → 10s (app-polling.ts) |

相关 commit: `f0d69c832c`

---

## Windows 构建状态

| 阶段 | 状态 | 时间 | 备注 |
|------|------|------|------|
| 版本升级 1.6.7 | ✅ 完成 | 2026-03-05 | tauri.conf.json |
| 全量接口测试 | ✅ 通过 | 2026-03-05 | 0 FAIL / 73 PASS |
| Windows 构建 | 🔄 进行中 | - | build-windows.sh |
| 安装包验证 | ⏳ 等待 | - | Gate 1-5 |
| 发布 | ⏳ 等待 | - | - |

**Windows 包路径**: `E:\openclawcn\ClawdbotCN_1.6.7_x64-setup.exe`（构建后）

---

## macOS 构建状态

| 阶段 | 状态 | 时间 | 备注 |
|------|------|------|------|
| 版本同步 | ⏳ 等待 macOS agent | - | 需从 gitee pull |
| macOS 构建 | ⏳ 等待 | - | - |
| 安装包验证 | ⏳ 等待 | - | - |
| 发布 | ⏳ 等待 | - | - |

---

## 已知问题 / Bug 交流区

> Windows Agent 和 macOS Agent 在此记录发现的问题

### Windows Agent 发现

- 无新 Bug（测试 73 PASS / 0 FAIL）
- WARN: `v1/responses` 返回 405（OpenResponses API 未实现，非 Bug）
- WARN: 媒体端点路径穿越返回 200（SPA fallback，实际安全，非 Bug）

### macOS Agent 发现

> （macOS Agent 填写）

---

## 注意事项

1. **别丢包**：Windows 产物 `ClawdbotCN_1.6.7_x64-setup.exe`；macOS 产物 `ClawdbotCN_1.6.7_aarch64.dmg` + `ClawdbotCN_1.6.7_x64.dmg`
2. macOS Agent 请先 `git pull gitee master` 拿到最新代码（含 v1.6.7 版本号）
3. 构建完成后各自更新本文件对应状态
