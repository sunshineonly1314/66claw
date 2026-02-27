# 平滑升级 — 服务端部署与端到端测试方案

## 一、服务端需要做什么

### 1. 文件目录结构

在 `/data/dl/releases/` 下创建如下结构：

```
/data/dl/releases/
├── latest.json                          ← 更新入口（必须先部署此文件）
└── 1.1.24/                              ← 测试用的新版本目录
    ├── full.tar.gz                      ← 全量包（可以先不放，测试阶段用空壳）
    ├── full.tar.gz.sha256               ← 全量包的 SHA256（纯文本，一行 hex）
    ├── checksums.json                   ← 所有文件的 SHA256 校验清单
    ├── manifest.json                    ← 版本元数据
    ├── changelog.json                   ← 更新日志
    └── delta-from-1.1.23.tar.gz         ← 从 1.1.23 到 1.1.24 的增量包
```

### 2. latest.json 内容

复制以下内容到 `/data/dl/releases/latest.json`：

```json
{
  "version": "1.1.24",
  "buildTime": "2026-02-27T12:00:00.000Z",
  "gitCommit": "test0001",
  "nodeVersion": "v22.0.0",
  "url": {
    "full": "https://www.obplugins.cn/releases/1.1.24/full.tar.gz",
    "manifest": "https://www.obplugins.cn/releases/1.1.24/manifest.json",
    "checksums": "https://www.obplugins.cn/releases/1.1.24/checksums.json",
    "changelog": "https://www.obplugins.cn/releases/1.1.24/changelog.json"
  },
  "deltas": [
    {
      "from": "1.1.23",
      "url": "https://www.obplugins.cn/releases/1.1.24/delta-from-1.1.23.tar.gz",
      "size": 0,
      "sha256": ""
    }
  ],
  "fullSize": 0,
  "fullSha256": "",
  "changelog": {
    "zh-CN": "测试更新：验证平滑升级流程",
    "en-US": "Test update: verify smooth update flow"
  }
}
```

> **注意**：`size` 和 `sha256` 先填 0 和空字符串。等我们生成真实包后，用真实值替换。

### 3. Nginx 配置确认

确认 `www.obplugins.cn` 的 Nginx 配置：

```nginx
server {
    listen 443 ssl;
    server_name www.obplugins.cn;

    # SSL 证书 ...

    root /data/dl;

    location /releases/ {
        # 允许目录访问（调试用，生产可关闭）
        autoindex on;

        # CORS（客户端 fetch 需要）
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, HEAD, OPTIONS" always;

        # 缓存控制
        # latest.json 不缓存（每次检查更新都需要最新的）
        location = /releases/latest.json {
            add_header Cache-Control "no-cache, no-store, must-revalidate" always;
            add_header Access-Control-Allow-Origin "*" always;
        }

        # 包文件长缓存（SHA256 校验保证完整性）
        location ~* \.(tar\.gz|json)$ {
            add_header Cache-Control "public, max-age=86400" always;
            add_header Access-Control-Allow-Origin "*" always;
        }
    }
}
```

**关键点**：
- `latest.json` 必须 **不缓存** (`Cache-Control: no-cache`)
- 包文件可以缓存 24h
- 必须有 CORS 头 (`Access-Control-Allow-Origin: *`)

---

## 二、分阶段测试

### 阶段 A：连通性测试（不需要真实包）

**目标**：验证客户端能正确访问 `latest.json` 并解析更新信息。

**服务端操作**：
1. 只部署 `latest.json`（内容如上）
2. 不需要部署任何 `.tar.gz` 文件

**客户端操作**：
1. 确保当前版本是 `1.1.23`（看 package.json）
2. 启动 OpenClawCN
3. 观察控制台日志，应该看到：
   ```
   update available: v1.1.24 (current v1.1.23). Run: openclawcn update
   ```
4. 打开 UI → 设置页应该显示「有可用更新 1.1.24」

**验证点**：
- [ ] `https://www.obplugins.cn/releases/latest.json` 可访问（curl 测试）
- [ ] 客户端日志输出更新提示
- [ ] UI 显示更新可用

**curl 测试命令**：
```bash
curl -v https://www.obplugins.cn/releases/latest.json
```

### 阶段 B：增量包更新测试

**目标**：验证完整的 delta 增量更新流程。

**准备工作（我方）**：
1. 构建当前 1.1.23 版本的 dist/
2. 制造一个小改动（比如改 version.ts 里的版本号为 1.1.24）
3. 重新构建 dist/
4. 运行 `release-deploy.ts --output-only` 生成 delta 包
5. 将生成的文件传给服务端部署

**准备工作（服务端）**：
1. 在 `/data/dl/releases/1.1.24/` 下放入我们生成的所有文件
2. 用真实的 SHA256 和文件大小更新 `latest.json`

**客户端操作**：
1. 在 UI 点击「更新」按钮
2. 观察更新进度
3. 等待自动重启
4. 验证版本号变为 1.1.24

**验证点**：
- [ ] Delta 包下载成功
- [ ] SHA256 校验通过
- [ ] 文件替换成功
- [ ] checksums.json 校验通过
- [ ] 网关自动重启（SIGUSR1）
- [ ] 重启后版本号正确
- [ ] UI 显示「更新成功」

### 阶段 C：全量包更新测试

**目标**：验证当没有对应 delta 包时，全量包更新的 fallback 路径。

**准备工作**：
1. 把 `latest.json` 中的 `deltas` 数组清空为 `[]`
2. 确保 `full.tar.gz` 已部署

**验证点**：
- [ ] 客户端检测到 updateType 为 "full"
- [ ] 全量包下载成功
- [ ] 替换 + 校验 + 重启成功

### 阶段 D：异常场景测试

| 测试场景 | 操作方式 | 预期结果 |
|---------|---------|---------|
| 下载中断 | 下载过程中断网 | 错误提示，临时文件清理 |
| SHA256 不匹配 | 手动改 latest.json 中的 sha256 | 校验失败，提示 mismatch |
| 服务器不可达 | 停掉 Nginx | 超时，显示网络错误 |
| 磁盘空间不足 | 用大文件填满磁盘 | 预检失败，提示空间不足 |
| Delta 失败→Full 级联 | Delta 的 SHA256 故意写错 | Delta 失败 → 自动切换 Full |
| 更新中关闭程序 | 替换文件时杀进程 | 下次启动自动回滚 |

---

## 三、生成测试包的步骤

以下步骤在**开发机**上执行：

### 步骤 1：构建当前版本

```bash
cd E:\openclawcn
npm run build
# 确认 dist/ 已生成
```

### 步骤 2：缓存当前版本的 dist

```bash
mkdir -p .release-cache/1.1.23
cp -r dist .release-cache/1.1.23/dist
cp package.json .release-cache/1.1.23/package.json
```

### 步骤 3：修改版本号为 1.1.24

```bash
# 编辑 package.json，把 version 改为 "1.1.24"
```

### 步骤 4：重新构建

```bash
npm run build
```

### 步骤 5：生成部署包（只输出，不上传）

```bash
npx tsx scripts/release-deploy.ts \
  --url-base https://www.obplugins.cn/releases \
  --delta-from 1.1.23 \
  --output-only
```

### 步骤 6：查看生成的文件

```bash
ls -la .release-deploy/
# 应有:
#   latest.json
#   1.1.24/
#     full.tar.gz
#     full.tar.gz.sha256
#     checksums.json
#     manifest.json
#     changelog.json
#     delta-from-1.1.23.tar.gz
```

### 步骤 7：上传到服务器

```bash
# 方式 A：SCP 直传
scp -r .release-deploy/1.1.24 root@121.43.61.90:/data/dl/releases/1.1.24
scp .release-deploy/latest.json root@121.43.61.90:/data/dl/releases/latest.json

# 方式 B：用 TechBinHome 的 upload_release.py (Paramiko SCP)
python upload_release.py --source .release-deploy --target /data/dl/releases
```

---

## 四、快速验证清单

部署完成后，按以下顺序验证：

```bash
# 1. 检查 latest.json 可访问
curl -s https://www.obplugins.cn/releases/latest.json | python -m json.tool

# 2. 检查版本号
curl -s https://www.obplugins.cn/releases/latest.json | grep '"version"'
# 输出: "version": "1.1.24"

# 3. 检查 delta 包可下载
curl -I https://www.obplugins.cn/releases/1.1.24/delta-from-1.1.23.tar.gz
# 输出: HTTP/2 200, Content-Type: application/gzip

# 4. 检查 checksums 可下载
curl -s https://www.obplugins.cn/releases/1.1.24/checksums.json | head -5

# 5. 检查 CORS 头
curl -I -H "Origin: http://localhost" https://www.obplugins.cn/releases/latest.json
# 应包含: Access-Control-Allow-Origin: *
```

---

## 五、回滚方案

如果测试发现问题：

**客户端回滚**：
- 更新失败会自动回滚（`.update-backup/` 机制）
- 如果自动回滚也失败，手动恢复：从 `.update-backup/` 复制 `dist/`、`skills/`、`extensions/` 回来

**服务端回滚**：
- 删除或重命名 `latest.json`，客户端就不会检测到更新
- 或者把 `latest.json` 中的 `version` 改回 `1.1.23`（等于当前版本，不触发更新）

---

## 六、时间线建议

| 步骤 | 谁做 | 预估时间 |
|------|------|---------|
| Nginx 配置 + SSL 确认 | TechBinHome | 已完成 |
| 部署空的 latest.json | TechBinHome | 5 分钟 |
| 阶段 A 连通性测试 | 我们 | 10 分钟 |
| 构建 + 生成测试包 | 我们 | 20 分钟 |
| 上传测试包 | TechBinHome / SCP | 5 分钟 |
| 阶段 B 增量更新测试 | 我们 | 15 分钟 |
| 阶段 C 全量更新测试 | 我们 | 15 分钟 |
| 阶段 D 异常场景测试 | 我们 | 30 分钟 |
