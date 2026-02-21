# macOS 构建修复需求文档

> 日期: 2026-02-19
> 优先级: P0 (阻塞发布)
> 目标: 修复 macOS CI/CD 构建流程中的所有已知问题，确保产出完整、正确的 DMG 安装包

---

## 一、背景

CI/CD 流程: Gitee Webhook → 阿里云 frps → 本地 frpc → webhook-server.js(:8888) → SSH 到 Mac Mini(192.168.0.107) 执行构建

当前 macOS 构建虽然报"成功"，但产出的 DMG 包存在严重问题：
1. 构建在错误的工作目录执行（路径中包含字面 `~` 目录）
2. DMG 只有 60MB（正常应约 100MB）
3. .app 中缺少 V8 bytecode (.jsc) 加密文件
4. node_modules 大小 245MB 过大（未清理开发依赖）

---

## 二、需要修复的问题清单

### 问题 1: 工作目录路径错误（字面 `~` 未展开）[P0]

**现象:**
CI 构建使用的实际路径是 `/Users/kevinsun/~/cicd-workspace/openclawcn/`（注意 `~` 变成了字面目录名），而不是预期的 `/Users/kevinsun/cicd-workspace/openclawcn/`。

**根因:**
`ci/config.json` 第 24 行配置了 `"workspace": "~/cicd-workspace/openclawcn"`。这个值通过 `ci/build-macos.sh` 传入 heredoc 生成的临时脚本时，`~` 在双引号内不会被 shell 展开，导致 `mkdir -p "$WORKSPACE"` 创建了字面名为 `~` 的目录。

**涉及文件:**
- `ci/config.json` 第 24 行
- `ci/build-macos.sh` 第 55 行: `WORKSPACE="$MAC_WORKSPACE"`

**修复方案:**
`ci/config.json` 中 macOS workspace 已改为绝对路径:
```json
"workspace": "/Users/kevinsun/cicd-workspace/openclawcn"
```
同时 output 也已改为:
```json
"output": "/Users/kevinsun/cicd-workspace/clawdbot/build/output"
```

**验证方式:**
```bash
# 在 Mac Mini 上确认构建使用正确路径
ssh kevinsun@192.168.0.107 'ls -la /Users/kevinsun/cicd-workspace/openclawcn/build/output/'
# 应该看到新的 DMG 文件，而不是 Feb 17 的旧文件
```

**清理:**
Mac Mini 上的错误目录 `/Users/kevinsun/~/` 可以删除:
```bash
ssh kevinsun@192.168.0.107 'rm -rf /Users/kevinsun/\~/'
```

---

### 问题 2: .app 中缺少 V8 bytecode (.jsc) 加密文件 [P0]

**现象:**
构建日志显示 `build:secure` 成功执行（包含 obfuscate + bytecode），源码 `dist/dispatch/` 和 `dist/security/` 中确实生成了 `.jsc` 文件。但最终 `.app` 包内 `dist/` 目录中没有任何 `.jsc` 文件。

**验证数据:**
```
# 源码 dist/ 中有 .jsc:
dist/dispatch/engine.jsc        ✅ 存在
dist/dispatch/index.jsc         ✅ 存在
dist/security/ai-tamper-protection.jsc  ✅ 存在
...

# .app 中的 dist/:
ClawdbotCN.app/Contents/Resources/app/dist/dispatch/  ❌ 目录不存在或为空
ClawdbotCN.app/Contents/Resources/app/dist/security/  ❌ 只有 integrity-hashes.json
```

**可能原因:**
1. `build-macos-cn.sh` 第 328 行 `cp -R "$ROOT_DIR/dist" "$APP_ROOT/dist"` — 此命令应该复制全部文件包括 .jsc，需要验证是否在 `cp` 之前 dist/ 中的 .jsc 已存在
2. Step 8 的 node_modules 清理逻辑（第 438-488 行）可能误删了 dist/ 中的内容
3. `build:secure` 的执行顺序可能有问题 — bytecode 编译可能在 dist 复制之后才执行

**排查步骤:**
```bash
# 1. 在 Mac Mini 上手动构建，在每个 Step 后检查 dist/ 内容:
cd /Users/kevinsun/cicd-workspace/openclawcn

# Step 2 后检查
pnpm build:secure
find dist/dispatch/ -name '*.jsc' | wc -l   # 应该 > 0

# Step 7 复制后检查
ls build/output/ClawdbotCN.app/Contents/Resources/app/dist/dispatch/
# 看是否有 .jsc

# Step 8 清理后检查
ls build/output/ClawdbotCN.app/Contents/Resources/app/dist/dispatch/
# 看 .jsc 是否被删除了
```

**修复方向:**
- 如果是复制顺序问题：确保 `cp -R dist` 在 `build:secure` 完成之后执行
- 如果是清理误删：修改 Step 8 清理逻辑，排除 .jsc 文件
- 在 Step 7 和 Step 8 之间添加 .jsc 文件计数日志，方便排查

---

### 问题 3: Code Signing 必须跳过 [P1]

**现象:**
我们没有 Apple Developer 证书（$99/年），codesign 步骤反复失败:
- Team ID mismatch: Node.js 官方二进制签名 (TeamIdentifier=HX7739G8FX) 与 ad-hoc 签名冲突
- `SKIP_TEAM_ID_CHECK=1` 环境变量传递无效
- `DISABLE_LIBRARY_VALIDATION=1` 也未生效

**当前临时方案:**
`ci/build-macos.sh` 中在 git reset 后用 sed 注释掉 codesign 调用:
```bash
sed -i.bak '/codesign-mac-app\.sh/s/^/# SKIPPED: /' build/scripts/build-macos-cn.sh
```

**建议永久方案:**
直接在 Gitee 仓库的 `build/scripts/build-macos-cn.sh` 中修改 Step 9，默认跳过签名:
```bash
# Step 9: Code signing
# NOTE: 我们没有 Apple Developer 证书，默认跳过签名。
# 未签名 app 用户首次运行需: 右键 → 打开，或系统设置 → 安全性 → 允许
# 如果将来购买证书，设置 SKIP_CODESIGN=0 SIGN_IDENTITY="Developer ID Application: xxx"
SKIP_CODESIGN="${SKIP_CODESIGN:-1}"

if [[ "$SKIP_CODESIGN" == "1" ]]; then
  log "Skipping code signing (no Apple Developer certificate)."
elif [[ -n "$SIGN_IDENTITY" ]]; then
  ALLOW_ADHOC_SIGNING=0 bash "$ROOT_DIR/scripts/codesign-mac-app.sh" "$APP_DIR"
else
  ALLOW_ADHOC_SIGNING=1 SKIP_TEAM_ID_CHECK=1 DISABLE_LIBRARY_VALIDATION=1 \
    bash "$ROOT_DIR/scripts/codesign-mac-app.sh" "$APP_DIR"
fi
```

这样改动提交到 Gitee 后，CI 脚本中的 sed patch 也可以去掉了。

---

### 问题 4: node_modules 过大 (245MB) [P2]

**现象:**
.app 中 `node_modules/` 占 245MB，是 dist/ (39MB) 的 6 倍多。

**排查方向:**
1. `npm install --omit=dev` 是否正确排除了 devDependencies
2. 是否包含了不必要的大包 (如 typescript, eslint 等开发工具)
3. Step 8 清理逻辑（删除 .md, .ts, LICENSE, tests 等）是否正常执行

**验证方式:**
```bash
# 查看 .app 中 node_modules 最大的包
du -sh ClawdbotCN.app/Contents/Resources/app/node_modules/* | sort -rh | head -20
# 检查是否有 dev 工具包
ls ClawdbotCN.app/Contents/Resources/app/node_modules/typescript 2>/dev/null
ls ClawdbotCN.app/Contents/Resources/app/node_modules/eslint 2>/dev/null
```

---

### 问题 5: skills 目录只有 488KB [P2]

**现象:**
.app 中 `skills/` 只有 61 个目录，每个只包含一个 `SKILL.md` 文件，总计 488KB。

**确认项:**
- 这是否是预期行为？（skills 是否设计为运行时动态下载？）
- 如果 skills 应包含更多内容，源码仓库中的 `skills/` 目录本身就只有 SKILL.md，说明不是构建脚本的问题
- Windows standard 模式下 skills 也是同样的 488KB

**如果需要更多 skills:**
需要先运行 skill wash pipeline 生成 `skills-merged/` 目录（包含 3000+ 完整 skills），然后使用 full 模式构建。

---

## 三、修复后的验证清单

构建成功后逐项验证:

```bash
# 1. 确认工作目录正确（不含字面 ~）
# 预期: /Users/kevinsun/cicd-workspace/openclawcn/
ps aux | grep build-macos | grep -v grep

# 2. 检查 .app 总大小
du -sh build/output/ClawdbotCN.app/
# 预期: >= 400MB

# 3. 检查 DMG 大小
ls -lh build/output/ClawdbotCN-macOS-*.dmg
# 预期: >= 80MB

# 4. 验证 .jsc bytecode 文件存在
find build/output/ClawdbotCN.app/Contents/Resources/app/dist/dispatch/ -name '*.jsc' | wc -l
# 预期: >= 15 个文件

find build/output/ClawdbotCN.app/Contents/Resources/app/dist/security/ -name '*.jsc' | wc -l
# 预期: >= 5 个文件

# 5. 验证加密目录存在
ls build/output/ClawdbotCN.app/Contents/Resources/app/dist/dispatch/
ls build/output/ClawdbotCN.app/Contents/Resources/app/dist/security/
ls build/output/ClawdbotCN.app/Contents/Resources/app/dist/license/
# 预期: 每个目录都有 .js + .jsc 文件对

# 6. 验证 Node.js 二进制
file build/output/ClawdbotCN.app/Contents/Resources/node/bin/node
# 预期: Mach-O universal binary with 2 architectures: [x86_64:...] [arm64:...]

# 7. 验证 node_modules 不含 dev 依赖
ls build/output/ClawdbotCN.app/Contents/Resources/app/node_modules/typescript 2>/dev/null && echo "FAIL: typescript found" || echo "OK"
ls build/output/ClawdbotCN.app/Contents/Resources/app/node_modules/eslint 2>/dev/null && echo "FAIL: eslint found" || echo "OK"

# 8. 验证 integrity hashes 存在
cat build/output/ClawdbotCN.app/Contents/Resources/app/dist/security/integrity-hashes.json | head -5
# 预期: JSON 格式的 hash 列表

# 9. 验证 UI 存在
ls build/output/ClawdbotCN.app/Contents/Resources/app/ui/dist/control-ui/index.html
# 预期: 文件存在

# 10. DMG 校验
shasum -a 256 build/output/ClawdbotCN-macOS-*.dmg
cat build/output/ClawdbotCN-macOS-*.dmg.sha256
# 预期: 两者匹配
```

---

## 四、涉及文件清单

| 文件 | 修改内容 | 状态 |
|------|----------|------|
| `ci/config.json` | macOS workspace/output 改为绝对路径 | 已修改(本地) |
| `ci/build-macos.sh` | 添加 sed patch 跳过 codesign | 已修改(本地) |
| `build/scripts/build-macos-cn.sh` | 添加 SKIP_CODESIGN 逻辑 + 中文备注 | 已修改(本地)，需提交到 Gitee |
| `build/scripts/windows/build-windows.ps1` | npm install 改为 cmd /c 包装 | 已修改(本地)，需提交到 Gitee |

---

## 五、Mac Mini 环境信息

| 项目 | 值 |
|------|------|
| IP | 192.168.0.107 |
| 用户 | kevinsun |
| Node | v22.14.0 (路径: /usr/local/lib/nodejs/node-v22.14.0-darwin-arm64/bin/) |
| pnpm | 10.23.0 |
| 正确工作目录 | /Users/kevinsun/cicd-workspace/openclawcn |
| 错误工作目录(待删除) | /Users/kevinsun/~/cicd-workspace/openclawcn |
| Gitee 仓库 | https://gitee.com/sunshine1314/openclawcn |
| 分支 | master |
| SSH 登录 | ssh kevinsun@192.168.0.107 |

---

## 六、构建命令参考

```bash
# 手动在 Mac Mini 上执行构建 (排查用)
ssh kevinsun@192.168.0.107
cd /Users/kevinsun/cicd-workspace/openclawcn
git fetch origin && git reset --hard origin/master
export PATH="/usr/local/lib/nodejs/node-v22.14.0-darwin-arm64/bin:$PATH"
pnpm install --no-frozen-lockfile
SKIP_CODESIGN=1 bash build/scripts/build-macos-cn.sh --arch universal

# 通过 CI 触发构建
curl -s -X POST http://localhost:8888/webhook \
  -H "Content-Type: application/json" \
  -H "X-Gitee-Token: clawdbot-ci-secret-2026" \
  -d '{"ref":"refs/heads/master","commits":[{"message":"[build macos] rebuild"}]}'
```

---

## 七、预期最终产出

| 项目 | 预期值 |
|------|--------|
| DMG 文件名 | ClawdbotCN-macOS-v2026.2.15-universal.dmg |
| DMG 大小 | >= 80 MB (压缩后) |
| .app 大小 | >= 400 MB (解压后) |
| Node.js | universal (arm64 + x64)，v22.14.0 |
| dist/ | ~40-50 MB，包含 .jsc bytecode 文件 |
| node_modules/ | ~150-200 MB (仅 production deps) |
| skills/ | 61 个 (每个含 SKILL.md) |
| extensions/ | ~4 MB (feishu, dingtalk, wecom, qqbot, openclawwechat) |
| 加密层 | RC4 obfuscation + V8 bytecode (dispatch/, license/, security/) |
| Code signing | 跳过 (无 Apple 证书) |
