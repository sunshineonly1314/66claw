# WSL 离线打包常见错误及解决方案

本文档记录了 OpenClawCN Windows WSL 离线安装包开发过程中遇到的所有问题及解决方案。

## 目录

1. [PowerShell 脚本解析错误](#1-powershell-脚本解析错误)
2. [Ubuntu rootfs 下载失败](#2-ubuntu-rootfs-下载失败)
3. [7-Zip 依赖问题](#3-7-zip-依赖问题)
4. [WSL Distro 未创建](#4-wsl-distro-未创建)
5. [Gateway 进程启动失败](#5-gateway-进程启动失败)
6. [端口连接超时](#6-端口连接超时)
7. [WSL Distro 检测失败](#7-wsl-distro-检测失败)
8. [Gateway 配置缺失](#8-gateway-配置缺失)
9. [Setup 页面跳转 Token 丢失](#9-setup-页面跳转-token-丢失)
10. [Gateway 重启失败](#10-gateway-重启失败)
11. [License 验证超时](#11-license-验证超时)
12. [模板文件缺失](#12-模板文件缺失)
13. [Skills 目录缺失](#13-skills-目录缺失)
14. [离线打包脚本文件复制不完整](#14-离线打包脚本文件复制不完整)
15. [WSL 下缺少 Linux 原生 clipboard 绑定](#15-wsl-下缺少-linux-原生-clipboard-绑定)

---

## 1. PowerShell 脚本解析错误

### 错误现象
```
ParserError: UnexpectedToken
At line:XX char:XX
```

### 原因
- PowerShell 脚本中包含中文字符
- Here-String 中嵌入了复杂的 bash 命令（包含 `&&`、`||` 等）

### 解决方案
1. 将所有中文注释改为英文
2. 将复杂的 bash 命令拆分成多个 `wsl -d ... -- bash -c` 调用
3. 避免在 Here-String 中使用特殊字符

### 修改文件
- `build/scripts/windows/build-wsl-offline.ps1`
- `build/installer/scripts/setup-offline.ps1`

---

## 2. Ubuntu rootfs 下载失败

### 错误现象
```
下载失败: https://mirrors.tuna.tsinghua.edu.cn/ubuntu-cdimage/ubuntu-base/...
HTTP 404 Not Found
```

### 原因
清华镜像源的 Ubuntu Minimal rootfs 链接已失效

### 解决方案
切换到 Ubuntu Cloud Images 官方源：
```
https://mirrors.ustc.edu.cn/ubuntu-cloud-images/wsl/jammy/current/ubuntu-jammy-wsl-amd64-ubuntu22.04lts.rootfs.tar.gz
```

### 注意
- 标准 WSL 镜像约 325MB，比 minimal 版本大
- 文件格式从 `.tar.xz` 变为 `.tar.gz`

---

## 3. 7-Zip 依赖问题

### 错误现象
```
7z.exe not found
Cannot extract .tar.xz file
```

### 原因
安装脚本依赖 7-Zip 解压 `.tar.xz` 文件，但用户系统可能未安装

### 解决方案
1. 改用 `.tar.gz` 格式（Windows 内置 `tar.exe` 支持）
2. 或使用 Windows 内置的 `tar.exe` (bsdtar) 解压

### 修改
```powershell
# 旧代码（依赖 7-Zip）
& "$env:ProgramFiles\7-Zip\7z.exe" x ubuntu.tar.xz

# 新代码（使用内置 tar）
wsl --import OpenClawCNUbuntu "$installDir\wsl" ubuntu.tar.gz
```

---

## 4. WSL Distro 未创建

### 错误现象
```
wsl -l -q 不显示 OpenClawCNUbuntu
The specified distribution does not exist
```

### 原因
- 安装脚本解析错误导致提前退出
- `wsl --import` 命令失败但未报错

### 解决方案
1. 确保安装脚本没有解析错误（参见问题 #1）
2. 添加错误检查：
```powershell
wsl --import OpenClawCNUbuntu "$installDir\wsl" "$rootfsPath"
if ($LASTEXITCODE -ne 0) {
    Write-Error "WSL import failed"
    exit 1
}
```

---

## 5. Gateway 进程启动失败

### 错误现象
```
node: command not found
Gateway process exits immediately
```

### 原因
1. WSL 中 PATH 不包含 Node.js 路径
2. `nohup setsid` 在 WSL 中不可靠

### 解决方案
1. 使用完整路径调用 Node.js：
```powershell
/opt/node/bin/node /opt/openclawcn/dist/entry.js gateway run
```

2. 使用 `Start-Process` 替代 `nohup`：
```powershell
$wslArgs = @("-d", "OpenClawCNUbuntu", "-e", "/opt/node/bin/node", 
             "/opt/openclawcn/dist/entry.js", "gateway", "run", 
             "--port", "18789", "--bind", "lan")
Start-Process -FilePath "wsl" -ArgumentList $wslArgs -WindowStyle Hidden
```

---

## 6. 端口连接超时

### 错误现象
```
Invoke-WebRequest: 连接超时
curl: (7) Failed to connect to localhost port 18789
```

### 原因
1. **IP Helper 服务未运行**：`netsh interface portproxy` 依赖此服务
2. 端口转发规则未正确配置
3. WSL IP 地址变化

### 解决方案
1. 确保 IP Helper 服务运行：
```powershell
$svc = Get-Service -Name "iphlpsvc" -ErrorAction SilentlyContinue
if ($svc.Status -ne "Running") {
    Set-Service -Name "iphlpsvc" -StartupType Automatic
    Start-Service -Name "iphlpsvc"
}
```

2. 正确配置端口转发：
```powershell
$wslIp = (wsl -d OpenClawCNUbuntu -- hostname -I).Trim().Split()[0]
netsh interface portproxy delete v4tov4 listenport=18789 listenaddress=0.0.0.0
netsh interface portproxy add v4tov4 listenport=18789 listenaddress=0.0.0.0 connectport=18789 connectaddress=$wslIp
```

---

## 7. WSL Distro 检测失败

### 错误现象
```
FixGateway.ps1: "WSL distro not found!"
但 wsl -l -q 确实显示 OpenClawCNUbuntu
```

### 原因
`wsl -l -q` 输出包含 Unicode null 字符 (`\x00`) 和不一致的空格

### 解决方案
清理 WSL 输出：
```powershell
$distros = (wsl -l -q) -replace '\x00', '' -replace '\s+', ' '
$found = $distros -match "OpenClawCNUbuntu"
```

---

## 8. Gateway 配置缺失

### 错误现象
```
Missing config. Run 'openclawcn setup' or set 'gateway.mode=local'
```

### 原因
安装脚本未创建 `~/.openclawcn/openclawcn.json` 配置文件

### 解决方案
在安装脚本中创建配置文件：
```powershell
wsl -d OpenClawCNUbuntu -- bash -c @"
mkdir -p ~/.openclawcn
cat > ~/.openclawcn/openclawcn.json << 'EOFCONFIG'
{
  "gateway": {
    "mode": "local",
    "port": 18789,
    "bind": "lan",
    "auth": {
      "token": "openclawcn2026"
    }
  }
}
EOFCONFIG
"@
```

---

## 9. Setup 页面跳转 Token 丢失

### 错误现象
```
页面跳转到 /chat?session=main
但 URL 中没有 token 参数
显示 "disconnected (1008): pairing required"
```

### 原因
1. 浏览器缓存了旧的 JavaScript
2. 重定向 URL 构建不正确
3. 前端路由处理时丢失了 token

### 解决方案
1. 修改 `buildRedirectUrl` 直接跳转到完整 URL：
```javascript
const buildRedirectUrl = () => {
  return window.location.origin + '/chat?session=main&token=' + 
         encodeURIComponent(gatewayToken);
};
```

2. 确保用户硬刷新浏览器（Ctrl+Shift+R）

### 修改文件
- `src/gateway/setup-page.ts`

---

## 10. Gateway 重启失败

### 错误现象
```
Setup 页面点击"开始使用"后
Gateway 停止响应，不会自动恢复
```

### 原因
WSL 环境下 `SIGUSR1` 信号处理不稳定，Gateway 收到信号后直接退出而不是重启

### 解决方案
**方案 1（已采用）**：不重启 Gateway
- 大部分配置是动态读取的，不需要重启
- 修改 `restartAndRedirect()` 函数，只保存配置，直接跳转

```javascript
// 不调用 /api/setup/restart
// 直接保存配置后跳转
await fetch('/api/setup/complete', { method: 'POST' });
window.location.href = buildRedirectUrl();
```

**方案 2（备选）**：使用 Watchdog 监控
- 部署 `OpenClawCNWatchdog.ps1` 自动监控和重启 Gateway

### 动态读取的配置（不需要重启）
| 配置 | 说明 |
|------|------|
| `auth` | API Key 配置 |
| `models` | 模型配置 |
| `agents.defaults` | 默认代理配置 |
| `channels` | 渠道配置 |

### 需要重启的配置
| 配置 | 说明 |
|------|------|
| `plugins` | 插件配置 |
| `gateway` | Gateway 核心配置 |

---

## 11. License 验证超时

### 错误现象
```json
{"ok":true,"data":{"valid":false,"error":"验证服务连接失败: fetch failed"}}
```

### 原因
1. WSL 的 **IPv6 网络不通**
2. Node.js 默认优先尝试 IPv6 连接
3. IPv6 连接超时后才尝试 IPv4，导致整体超时

### 诊断
```bash
# curl 使用 IPv4 成功
curl -4 https://www.tecbinai.com/api/api/v1/license/health  # OK

# curl 使用 IPv6 失败
curl -6 https://www.tecbinai.com/api/api/v1/license/health  # Failed
```

### 解决方案
在 `src/license/verify.ts` 中强制 DNS 优先使用 IPv4：
```typescript
import dns from "node:dns";

// 强制 DNS 解析优先使用 IPv4
dns.setDefaultResultOrder("ipv4first");
```

---

## 12. 模板文件缺失

### 错误现象
```
Error: Missing workspace template: AGENTS.md 
(/opt/openclawcn/docs/reference/templates/AGENTS.md)
```

### 原因
打包脚本未包含 `docs/reference/templates` 目录

### 解决方案
1. 手动复制（临时修复）：
```powershell
$srcDir = "d:\...\docs\reference\templates"
wsl -d OpenClawCNUbuntu -- mkdir -p /opt/openclawcn/docs/reference/templates
wsl -d OpenClawCNUbuntu -- cp -r /mnt/d/.../docs/reference/templates/* /opt/openclawcn/docs/reference/templates/
```

2. 更新打包脚本（永久修复）：
在 `build-wsl-offline.ps1` 中添加：
```powershell
# 复制模板文件
Copy-Item -Recurse "docs\reference\templates" "$packageDir\docs\reference\templates"
```

---

## 总结：打包检查清单

在打包 WSL 离线安装包前，确保：

- [ ] PowerShell 脚本无中文字符
- [ ] Ubuntu rootfs URL 有效
- [ ] 不依赖 7-Zip
- [ ] 使用完整路径调用 Node.js
- [ ] 使用 `Start-Process` 启动 Gateway
- [ ] 包含 IP Helper 服务检查
- [ ] 清理 WSL 输出的 Unicode 字符
- [ ] 创建默认配置文件
- [ ] Setup 页面不触发 Gateway 重启
- [ ] DNS 优先使用 IPv4
- [ ] 包含 `docs/reference/templates` 目录

---

## 13. Skills 目录缺失

### 错误现象
```
- 技能页面显示 "未找到匹配的技能"
- 玩法推荐页面显示 "该分类暂无技能"
- 控制台报错: "SKILL.md not found in downloaded skill"
```

### 原因
打包时未包含 `skills/` 目录（内置技能）

### 解决方案
1. 复制 `skills/` 目录到 WSL：
```powershell
wsl -d OpenClawCNUbuntu -- mkdir -p /opt/openclawcn/skills
wsl -d OpenClawCNUbuntu -- cp -r /mnt/d/.../skills/* /opt/openclawcn/skills/
```

2. 更新打包脚本包含 skills 目录：
```powershell
# 在 build-wsl-offline.ps1 中添加
Copy-Item -Recurse "skills" "$packageDir\skills"
```

### 验证
```bash
ls /opt/openclawcn/skills/  # 应显示 55+ 个技能目录
ls /opt/openclawcn/skills/github/SKILL.md  # 应存在
```

---

## 14. 离线打包脚本文件复制不完整

### 错误现象
```
- Gateway 启动后 UI 显示异常
- 技能、扩展功能不可用
- 前端资源 404
- 控制台报错: "Cannot find module 'dingtalk-stream'" 等
```

### 原因
`build-wsl-offline.ps1` 打包脚本只从 `build\wsl-standalone\openclawcn` 目录复制 `dist` 和 `node_modules`，缺少以下关键目录：
- `ui/` - 前端界面
- `extensions/` - 扩展插件（飞书、钉钉、企业微信等）
- `skills/` - 内置技能
- `patches/` - 依赖补丁
- `assets/` - 静态资源
- `scripts/` - 脚本工具

### 诊断
```powershell
# 检查 wsl-offline/openclawcn-src 目录内容
Get-ChildItem "build\wsl-offline\openclawcn-src" -Directory
# 只显示 dist, node_modules（缺少 ui, extensions, skills 等）

# 检查 WSL 中的 openclawcn 目录
wsl bash -c "ls ~/openclawcn/"
# 对比应有的完整目录列表
```

### 解决方案
修改 `build-wsl-offline.ps1` 的 Step 4，从项目根目录复制完整文件：

```powershell
# 优先从项目根目录复制
$src = $ProjectRoot

# 复制核心目录
Copy-Item "$src\dist" "$dst\dist" -Recurse -Force
Copy-Item "$src\node_modules" "$dst\node_modules" -Recurse -Force

# 复制 UI 目录
if (Test-Path "$src\ui") {
    Copy-Item "$src\ui" "$dst\ui" -Recurse -Force
}

# 复制 extensions 目录
if (Test-Path "$src\extensions") {
    Copy-Item "$src\extensions" "$dst\extensions" -Recurse -Force
}

# 复制 skills 目录
if (Test-Path "$src\skills") {
    Copy-Item "$src\skills" "$dst\skills" -Recurse -Force
}

# 复制 patches 目录
if (Test-Path "$src\patches") {
    Copy-Item "$src\patches" "$dst\patches" -Recurse -Force
}

# 复制 assets 目录
if (Test-Path "$src\assets") {
    Copy-Item "$src\assets" "$dst\assets" -Recurse -Force
}

# 复制 scripts 目录
if (Test-Path "$src\scripts") {
    Copy-Item "$src\scripts" "$dst\scripts" -Recurse -Force
}

# 复制 docs 目录（包含模板文件）
if (Test-Path "$src\docs") {
    Copy-Item "$src\docs" "$dst\docs" -Recurse -Force
}
```

### 修改文件
- `build/scripts/windows/build-wsl-offline.ps1`

### 验证
```powershell
# 重新运行打包脚本后检查
Get-ChildItem "build\wsl-offline\openclawcn-src" -Directory
# 应显示: dist, node_modules, ui, extensions, skills, patches, assets, scripts, docs
```

---

## 15. WSL 下缺少 Linux 原生 clipboard 绑定

### 错误现象
```
Cannot find module '@mariozechner/clipboard-linux-x64-gnu'
Gateway 启动失败
```

### 原因
- `node_modules` 在 Windows 上安装，只包含 `@mariozechner/clipboard-win32-x64-msvc`
- `@mariozechner/pi-coding-agent` 依赖 `@mariozechner/clipboard`，该包按平台 require 可选原生绑定
- 在 WSL（Linux）下运行时会加载 `@mariozechner/clipboard-linux-x64-gnu`，若未安装则报错

### 解决方案
在 `build-wsl-offline.ps1` 中，复制完 `node_modules` 后增加一步：注入 Linux 原生绑定。

1. 使用 `npm pack @mariozechner/clipboard-linux-x64-gnu@0.3.0` 下载 tgz 到 `build/cache/`
2. 用 `tar -xzf` 解压到临时目录，将 `package/` 内容复制到 `openclawcn-src/node_modules/@mariozechner/clipboard-linux-x64-gnu/`
3. 若解压失败（如无 tar），回退为在 `openclawcn-src` 下执行 `npm install @mariozechner/clipboard-linux-x64-gnu@0.3.0 --no-save --ignore-scripts`

### 修改文件
- `build/scripts/windows/build-wsl-offline.ps1`

### 验证
```bash
# WSL 内检查
ls /opt/openclawcn/node_modules/@mariozechner/clipboard-linux-x64-gnu/
# 应存在 package.json 与 .node 原生文件
```

---

## 总结：打包检查清单

在打包 WSL 离线安装包前，确保：

- [ ] PowerShell 脚本无中文字符
- [ ] Ubuntu rootfs URL 有效
- [ ] 不依赖 7-Zip
- [ ] 使用完整路径调用 Node.js
- [ ] 使用 `Start-Process` 启动 Gateway
- [ ] 包含 IP Helper 服务检查
- [ ] 清理 WSL 输出的 Unicode 字符
- [ ] 创建默认配置文件
- [ ] Setup 页面不触发 Gateway 重启
- [ ] DNS 优先使用 IPv4
- [ ] **包含 `docs/` 目录（文档和模板）**
- [ ] **包含 `skills/` 目录（内置技能）**
- [ ] **包含 `ui/` 目录（前端界面）**
- [ ] **包含 `extensions/` 目录（扩展插件）**
- [ ] **包含 `patches/` 目录（依赖补丁）**
- [ ] **包含 `assets/` 目录（静态资源）**
- [ ] **包含 `scripts/` 目录（脚本工具）**
- [ ] **注入 `@mariozechner/clipboard-linux-x64-gnu`（WSL 下 Gateway 依赖）**

---

*文档版本: 2026-02-01*
*适用于: OpenClawCN WSL 离线安装包*
