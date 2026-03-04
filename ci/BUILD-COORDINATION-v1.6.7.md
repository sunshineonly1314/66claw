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
| Windows 构建 | ✅ 完成 | 2026-03-05 | 216MB, exit 0 |
| 本地安装验证 | ✅ 通过 | 2026-03-05 | E:\openclawcn\ClawdbotCN install.json v1.6.7 |
| 深度接口测试 | ✅ 通过 | 2026-03-05 | 73 PASS / 0 FAIL / 5 WARN (全非 Bug) |
| 发布 | ⏳ 等待 | - | - |

**Windows 包路径**: `E:\openclawcn\ClawdbotCN_1.6.7_x64-setup.exe`

---

## macOS 构建状态

| 阶段 | 状态 | 时间 | 备注 |
|------|------|------|------|
| 版本同步 | ⏳ 等待 macOS agent | - | 需从 gitee pull |
| macOS 构建 | ⏳ 等待 | - | - |
| 安装包验证 | ⏳ 等待 | - | - |
| 发布 | ⏳ 等待 | - | - |

---

## macOS 打包详细步骤（默认 OEM 包）

> 本次打 **default OEM 包**（ClawdbotCN 品牌，`config/oem/default.json`），不传 OEM_ID 或传 `OEM_ID=default` 均可。

### 前置条件

- Rust toolchain（`rustup` 已安装，含 `aarch64-apple-darwin` + `x86_64-apple-darwin` target）
- Node.js 22 + pnpm
- Xcode Command Line Tools
- 项目依赖已安装：`pnpm install`

### 第一步：同步代码

```bash
cd /path/to/clawdbot
git remote add gitee https://gitee.com/sunshine1314/openclawcn.git  # 已有则跳过
git pull gitee master
# 确认版本号
grep '"version"' apps/desktop/src-tauri/tauri.conf.json
# 应输出: "version": "1.6.7"
```

### 第二步：执行构建

**默认 OEM（ClawdbotCN 品牌）：**

```bash
bash scripts/desktop/build.sh 1.6.7
```

> `OEM_ID` 不设 = 自动使用 `config/oem/default.json`，productName=ClawbotCN，identifier=com.clawdbot.cn.desktop

**如果要打自定义 OEM 包：**

```bash
# 1. 先在 config/oem/ 下创建 <oem-id>.json（参考 oem-template.json）
# 2. 然后：
OEM_ID=your-oem-id bash scripts/desktop/build.sh 1.6.7
```

### OEM 配置文件说明（`config/oem/default.json`）

| 字段 | 说明 |
|------|------|
| `identifier` | App bundle ID，如 `com.clawdbot.cn.desktop` |
| `ui.productName` | 显示名称（窗口标题、安装包名） |
| `ui.windowTitle` | Tauri 窗口标题栏文字 |
| `tauri.bundle.icon` | 图标路径列表（`.icns` 为 macOS 必须） |
| `licenseKeyPrefix` | License 前缀，服务端追溯用，不写入客户端 |

### 第三步：产物位置

构建完成后产物在：

```
apps/desktop/src-tauri/target/release/bundle/dmg/
  ClawdbotCN_1.6.7_aarch64.dmg   # Apple Silicon
  ClawdbotCN_1.6.7_x64.dmg       # Intel
```

### 第四步：验证

```bash
# 安装 DMG 后检查版本
cat /Applications/ClawbotCN.app/Contents/Resources/resources/install.json
# 应输出: {"installKind":"installer","version":"1.6.7",...}
```

### 注意事项

1. `tauri.conf.json` 在 OEM 注入后会被自动还原（`restore-tauri-conf.ts`），不会污染 git 状态
2. 如果遇到签名问题（`codesign` 报错），可加 `--no-sign` 跳过签名用于内测
3. 构建完成后**更新本文件** macOS 构建状态表格，并将产物放到发布位置

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
