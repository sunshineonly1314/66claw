# 桌面打包踩坑记录 & 检查清单

> 2026-03-01 v1.6.0 打包总结（已更新）。每次打包前必读此文件，避免重复踩坑。

---

## 一、打包前检查清单（Pre-flight Checklist）

每次打包前按顺序逐项确认：

### 1. 文件完整性
- [ ] `ui/src/ui/edition.ts` 已提交（CN/overseas 版本切换文件，UI 构建必需）
- [ ] `ui/src/vite-env.d.ts` 已提交（Vite 类型声明，UI 构建必需）
- [ ] 所有新增的 `.ts` / `.js` 文件已 `git add` 并 push 到 gitee
- [ ] 运行 `git status` 确认没有遗漏的 untracked 文件

### 2. Shell 脚本行尾
- [ ] **所有 `.sh` 文件必须是 LF 行尾**，不能是 CRLF
- [ ] Windows 上编辑过的 .sh 文件，push 前执行检查：
  ```bash
  # 检查是否有 CRLF
  file scripts/desktop/*.sh scripts/create-dmg.sh
  # 批量转换
  sed -i 's/\r$//' scripts/desktop/*.sh scripts/create-dmg.sh build/scripts/*.sh
  ```
- **症状**：macOS 报 `set: pipefail: invalid option name`
- **原因**：`#!/usr/bin/env bash\r` 找不到 bash，回退到 sh，sh 不支持 pipefail

### 3. Node.js 版本 — 必须 v22.16.0
- [ ] 两台构建机器的 Node.js 版本都是 **v22.16.0**
- [ ] V8 版本必须是 `12.4.254.21-node.26`
- **后果**：.jsc 字节码与 Node 的 V8 版本绑定，版本不匹配则运行时 crash
- macOS PATH 设置：
  ```bash
  export PATH="/usr/local/lib/nodejs/node-v22.16.0-darwin-arm64/bin:/usr/local/bin:/opt/homebrew/bin:$HOME/.cargo/bin:$PATH"
  ```

### 4. Skills 完整性
- [ ] `full-skills` 目录存在且包含 3000+ skill 定义
  - Windows: `E:\clawdbuild\full-skills`（3061 个）
  - macOS: `$PROJECT_ROOT/full-skills`（需要从 Windows SCP 过去）
- [ ] `prepare-resources.sh` 和 `prepare-resources.ps1` 都遍历三个 skills 来源：
  1. `$PROJECT_ROOT/skills-merged`（优先）
  2. `$PROJECT_ROOT/skills`（仓库默认，~1010 个）
  3. `$PROJECT_ROOT/full-skills`（补充，~2064 个）
- **教训**：v1.6.0 首次 macOS 打包只打进了 1010 个 skills，因为 .sh 少了 `full-skills` 来源且找到第一个就 break

### 5. 数据文件
- [ ] `data/mcp-index.json` 存在且 items 数量 > 7000
- [ ] `data/tool-index.sqlite` 存在
- [ ] `data/skills-availability-dictionary.json` 存在
- 这些文件需要手动上传到 Mac Mini（它们在 .gitignore 中）：
  ```bash
  scp data/mcp-index.json kevinsun@192.168.0.107:~/cicd-workspace/openclawcn/data/
  scp data/tool-index.sqlite kevinsun@192.168.0.107:~/cicd-workspace/openclawcn/data/
  ```

### 6. Git 依赖隔离
- [ ] `@whiskeysockets/baileys` 有 `git+ssh://github.com` 的传递依赖
- [ ] `@vector-im/matrix-bot-sdk` 有 `git+ssh://github.com` 的传递依赖（v1.6.0 新增）
- [ ] `@matrix-org/matrix-sdk-crypto-nodejs` 有 `git+ssh://github.com` 的传递依赖（v1.6.0 新增）
- [ ] Mac Mini 没有 GitHub SSH key，npm install 会失败
- [ ] `prepare-resources.sh` 已有过滤逻辑（过滤上述 3 个包），确认它在
- [ ] git insteadOf 规则覆盖所有 5 种 SSH URL 格式（含 `ssh://`、`git+https://`）
- [ ] Extension 依赖安装设为 non-fatal（`|| warn`），不会中断整个构建

### 7. Extension 源文件恢复（v1.6.0 新增）
- [ ] 构建前执行 `git checkout -- extensions/` 恢复 .js 文件
- [ ] 确认 extension .js 不是 CJS bytecode loader stub（检查是否有 `require("bytenode")`）

### 8. Resources 目录清理（v1.6.0 新增）
- [ ] 删除 resources/ 前先 `chmod -R u+w` 修改权限
- [ ] 清理命令加 `2>/dev/null || true`，避免 set -e 误退出

---

## 二、踩过的坑（详细记录）

### 坑 1：UI 构建失败 — "Could not resolve ./ui/edition.ts"
- **文件**：`ui/src/ui/edition.ts`、`ui/src/vite-env.d.ts`
- **原因**：新增文件未 `git add`，push 后 Mac Mini 上没有
- **修复**：commit + push 这两个文件
- **防范**：打包前 `git status` 确认无 untracked 文件

### 坑 2：CRLF 导致 macOS shell 脚本全部失败
- **症状**：`set: pipefail: invalid option name`，所有 .sh 脚本无法执行
- **原因**：Windows 编辑器保存为 CRLF，`#!/usr/bin/env bash\r` 中的 `\r` 导致找不到 bash
- **修复**：`sed -i 's/\r$//' *.sh`
- **防范**：
  - `.gitattributes` 中设置 `*.sh text eol=lf`
  - 编辑器设置 .sh 文件保存为 LF
  - CI 脚本开头加检查：`if [[ "$(head -c 20 "$0" | od -c | grep '\\r')" ]]; then echo "CRLF detected!"; exit 1; fi`

### 坑 3：npm install 失败 — git+ssh 依赖（已更新）
- **症状**：`npm ERR! git ls-remote ssh://git@github.com/whiskeysockets/libsignal-node.git` exit 128
- **原因**：Mac Mini 没有 GitHub SSH key，以下包有 git+ssh 传递依赖
- **修复**：构建脚本中 sanitize package.json，删除相关依赖
- **需过滤的依赖**：
  - `@whiskeysockets/baileys`（已知 — libsignal-node）
  - `@vector-im/matrix-bot-sdk`（v1.6.0 新发现 — matrix-sdk-crypto-nodejs）
  - `@matrix-org/matrix-sdk-crypto-nodejs`（v1.6.0 新发现）
- **额外修复**：git insteadOf 规则需要覆盖所有 SSH URL 格式，包括 `ssh://git@github.com/`：
  ```bash
  git config --global url."https://github.com/".insteadOf "git+ssh://git@github.com/"
  git config --global url."https://github.com/".insteadOf "ssh://git@github.com/"
  git config --global url."https://github.com/".insteadOf "git://github.com/"
  git config --global url."https://github.com/".insteadOf "git@github.com:"
  git config --global url."https://github.com/".insteadOf "git+https://github.com/"
  ```

### 坑 3a：plugin-sdk 因 baileys 缺失导致所有插件加载崩溃
- **症状**：`feishu failed to load: Error: Cannot find module '@whiskeysockets/baileys'`
  - 所有依赖 plugin-sdk 的插件（dingtalk、feishu、memory-core）全部崩溃
  - 即使用户只配置了飞书，与 WhatsApp 无关
- **原因**：`plugin-sdk/index.ts` 导出 `whatsappOnboardingAdapter`，引用链：
  - `plugin-sdk/index.ts` → `channels/plugins/onboarding/whatsapp.ts` → `channel-web.ts` → `web/login.ts` → `@whiskeysockets/baileys`
  - tsdown 会将 baileys 代码内联到 `dist/plugin-sdk/index.js`
  - 坑 3 中 baileys 从 node_modules 移除后，内联的 require 仍然指向一个不存在的包
- **修复（两层防御）**：
  1. `tsdown.config.ts`：plugin-sdk entry 使用 `pluginSdkExternal`（含 baileys），让 bundler 保留 `require()` 而不内联
  2. `prepare-resources.{sh,ps1}`：步骤 3a 注入 baileys stub 模块到 `node_modules/@whiskeysockets/baileys/`，使 require 不崩溃
  - stub 使用 `Proxy` 返回 no-op，WhatsApp 功能不可用但不影响其他插件

### 坑 4：build-meta.json 写入失败
- **症状**：`cat: /path/to/resources/dist/build-meta.json: No such file or directory`
- **原因**：`prepare-resources.sh` 在写 build-meta.json 之前没有 `mkdir -p dist/`
- **修复**：在 cat 命令前加 `mkdir -p "$RESOURCES_DIR/dist"`

### 坑 5：npm 缓存损坏
- **症状**：`ENOENT: no such file or directory` 指向 `~/.npm/_cacache`
- **修复**：`rm -rf ~/.npm/_cacache`
- **防范**：构建脚本开头可加 `npm cache verify` 检查

### 坑 6：macOS Skills 数量不对（1010 vs 3076）
- **原因**：`prepare-resources.sh` 只遍历 `skills-merged` 和 `skills` 两个来源，找到第一个就 `break`
- **而 Windows 的 `prepare-resources.ps1` 遍历三个来源且不 break，做合并去重**
- **修复**：
  1. `.sh` 增加 `$PROJECT_ROOT/full-skills` 作为第三个来源
  2. 去掉 `break`，改为合并模式（已存在的 skill 跳过）
  3. 把 `full-skills` 目录 SCP 到 Mac Mini

### 坑 7：macOS DMG 没有拖拽安装引导
- **原因**：Tauri 自带的 `bundle_dmg.sh` 只生成基础 DMG，没有背景图
- **修复**：构建完成后用 `scripts/create-dmg.sh` 重新生成 DMG
- **需要**：`assets/dmg-background-small.png` 背景图存在
- **build.sh 已包含**：Step 7 会调用 `create-dmg.sh`

### 坑 8：macOS "已损坏，无法打开"
- **原因**：没有 Apple Developer ID 证书，浏览器下载的文件带 quarantine 属性
- **当前方案**：用户执行 `xattr -cr /Applications/ClawdbotCN.app`
- **根本方案**：购买 Apple Developer ID ($99/年) 做 codesign + notarize
- **注意**：通过 `curl | bash` 安装脚本下载不带 quarantine，可绕过

### 坑 9：pnpm 找不到（macOS SSH）
- **原因**：SSH 登录 Mac Mini 时 PATH 不包含 pnpm、node 路径
- **修复**：脚本开头必须设置 PATH：
  ```bash
  export PATH="/usr/local/lib/nodejs/node-v22.16.0-darwin-arm64/bin:/usr/local/bin:/opt/homebrew/bin:$HOME/.cargo/bin:$PATH"
  source "$HOME/.cargo/env" 2>/dev/null || true
  ```

### 坑 10：UI 构建与 CN 字节码编译竞态（v1.6.0 新发现 — 关键！）
- **症状**：`"orchestratorReducer" is not exported by "../extensions/orchestrator/src/ui/orchestrator-state.js"`
- **原因**：`compile-bytecode.ts` 将 extension `.js` 替换为 CJS bytecode loader stub（`require("bytenode")`），Vite 无法将其解析为 ESM
- **触发条件**：UI build 和 CN 加密链并行运行时，CN 链的 bytecode 编译先于 UI build 完成
- **修复**：`scripts/desktop/build.sh` 中 UI 构建必须在 CN 加密链**之前**串行完成
- **正确顺序**：`[2a] tsdown → [2b] UI build → [2c] CN 加密链 → [3] UI 混淆`
- **错误顺序**：~~`[2a] tsdown → [2b+2c] 并行(UI + CN) → [3] UI 混淆`~~
- **防范**：build.sh 已修改为串行模式，注释中标明约束原因

### 坑 11：resources 目录只读文件导致 rm -rf 失败（v1.6.0 新发现）
- **症状**：`rm: apps/desktop/src-tauri/resources/node_modules/nostr-tools/lib: Directory not empty`
- **原因**：npm install 在 resources/ 目录创建只读文件，`rm -rf` 在 `set -euo pipefail` 下失败并终止脚本
- **修复**：删除前先修改权限
  ```bash
  chmod -R u+w apps/desktop/src-tauri/resources/ 2>/dev/null || true
  rm -rf apps/desktop/src-tauri/resources/ 2>/dev/null || true
  ```
- **防范**：所有清理命令加 `2>/dev/null || true`，避免 set -e 导致误退出

### 坑 12：Extension .js 文件在构建间残留（v1.6.0 新发现）
- **症状**：第二次构建（或 resume 构建）时 extension .js 仍是上次 bytecode 编译的 CJS stub
- **原因**：`compile-bytecode.ts` 原地替换 extension .js 文件，不可逆
- **修复**：构建前恢复 extensions/ 到 git 干净状态
  ```bash
  git checkout -- extensions/ 2>/dev/null || true
  ```
- **防范**：`ci/resume-build-macos.sh` 已包含此步骤

---

## 三、构建流程（正确顺序）

### macOS Tauri 构建 — 完整步骤（v1.6.0 修正版）
```
0. git checkout -- extensions/（恢复上次 bytecode 残留！）
1. git fetch + reset（拉最新代码）
2a. pnpm build（tsdown 基础构建）
2b. UI build（pnpm build in ui/）   ← 必须在 2c 之前！！！
2c. CN 加密链（串行，在 UI build 之后）：
    - pnpm build:cn-compile
    - pnpm build:cn-extensions
    - pnpm verify:extensions
    - obfuscate-dist.ts（RC4 混淆）
    - compile-bytecode.ts（V8 字节码 .jsc）← 这步会破坏 extension .js
    - integrity:gen（完整性哈希）
    - release:changelog
3. obfuscate-ui.ts（UI 混淆）
4+5. 并行：prepare-resources.sh + pnpm install（Tauri CLI）
6. pnpm tauri build --target universal-apple-darwin
7. Post-build：codesign + create-dmg.sh（拖拽引导 DMG）
```

**关键顺序约束**（v1.6.0 踩坑总结）：
- UI build (2b) **必须在** CN 加密链 (2c) **之前** — 串行执行！
  - 原因：`compile-bytecode.ts` 会把 extension .js 替换为 CJS bytecode loader stub，Vite/Rollup 无法解析
  - 症状：`"orchestratorReducer" is not exported by ...orchestrator-state.js"`
- ~~Windows 的 build.ps1 把 2b 和 2c 并行了~~，现在两个平台都必须串行
- 每次构建前必须 `git checkout -- extensions/`，否则上次残留的 CJS stub 会导致失败

### Windows Tauri 构建
- 对应脚本：`scripts/desktop/build.ps1`
- 用 `prepare-resources.ps1` 准备资源
- skills 来源包含 `E:\clawdbuild\full-skills`

---

## 四、构建产物验证清单

打包完成后必须验证：

```bash
# 基础信息
cat resources/dist/build-meta.json
# 预期: {"appVersion":"1.6.0","v8Version":"12.4.254.21-node.26","nodeVersion":"v22.16.0",...}

# 字节码
find resources/dist -name "*.jsc" | wc -l          # 预期: 158
find resources/extensions/agent-team -name "*.jsc" | wc -l    # 预期: 19
find resources/extensions/orchestrator -name "*.jsc" | wc -l  # 预期: 20

# Skills & MCP
find resources/skills -maxdepth 1 -type d | wc -l   # 预期: 3075 (3074 + 1)
node -e "console.log(JSON.parse(require('fs').readFileSync('resources/data/mcp-index.json','utf8')).items.length)"
# 预期: 7392

# Node 版本
resources/node/bin/node --version   # 预期: v22.16.0

# Gateway 启动测试
curl http://127.0.0.1:19002/api/health
# 预期: {"ok":true,"ready":true,...}
```

---

## 五、Mac Mini 环境维护

| 项目 | 当前值 |
|------|--------|
| IP | 192.168.0.107 |
| 用户 | kevinsun |
| Node.js | v22.16.0 (`/usr/local/lib/nodejs/node-v22.16.0-darwin-arm64/bin/node`) |
| pnpm | `/usr/local/bin/pnpm` |
| Cargo | 1.93.1 |
| 工作目录 | `~/cicd-workspace/openclawcn` |
| full-skills | `~/cicd-workspace/openclawcn/full-skills`（需从 Windows SCP） |

### 首次部署到新 Mac Mini 需要做的事
1. 安装 Node.js v22.16.0（必须精确版本）
2. 安装 pnpm、Rust/Cargo、Xcode Command Line Tools
3. SCP `full-skills` 目录（~13MB 压缩包）
4. SCP `data/mcp-index.json`、`data/tool-index.sqlite` 等数据文件
5. 配置 gitee SSH key 或使用 HTTPS + PAT

---

## 六、常见急救命令

```bash
# macOS "已损坏" 修复
xattr -cr /Applications/ClawdbotCN.app

# npm 缓存损坏
rm -rf ~/.npm/_cacache

# CRLF 转 LF
sed -i 's/\r$//' scripts/**/*.sh

# 检查 .sh 是否有 CRLF
file scripts/desktop/*.sh | grep CRLF

# 清理旧构建
rm -rf apps/desktop/src-tauri/target/*/release/bundle

# 清理 resources 目录（注意只读文件！）
chmod -R u+w apps/desktop/src-tauri/resources/ 2>/dev/null || true
rm -rf apps/desktop/src-tauri/resources/ 2>/dev/null || true

# 恢复 extension 源文件（bytecode 编译后必须执行）
git checkout -- extensions/

# 检查 extension .js 是否被 bytecode stub 替换
grep -l 'require("bytenode")' extensions/*/src/**/*.js 2>/dev/null
# 如果有输出，说明 extension .js 被替换了，需要 git checkout 恢复

# Mac Mini PATH
export PATH="/usr/local/lib/nodejs/node-v22.16.0-darwin-arm64/bin:/usr/local/bin:/opt/homebrew/bin:$HOME/.cargo/bin:$PATH"

# 全量清理重建（推荐用于版本发布）
ssh kevinsun@192.168.0.107 'bash ~/cicd-workspace/openclawcn/ci/clean-rebuild-macos.sh'

# 快速重试（保留 node_modules）
ssh kevinsun@192.168.0.107 'bash ~/cicd-workspace/openclawcn/ci/resume-build-macos.sh'
```
