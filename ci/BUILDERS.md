# CI/CD 构建机器信息

## SSH 免密登录

本机 SSH 公钥（已部署到两台构建机器）：
```
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDC+OZaZicEQDQVKGGY6XVvagneMtBFM8ZKSKFr6t7KCL6ek9jQIH9LUFarpztLDfLUgSbJPxVq0Jd9Q7JXcYuO32CYTgMMJ1rCTume0eu9N7tDAq6tW6g6rXsNaLnX7O3UU+cclmk8PkaeogS0WP8ELqWWR4icFC1+gHWzIBZgMr91xlntfi+iZXg9sekdKnwrjLtG+CGr1od4WOVnDzayKBsmSvrGltdZ1aKDY6FB/QkL9TEWiApLONqbcrOpuHtALxjPySPoPBOEbsmM86xAIgKHH4QgjSGsfmRJiBI/EtrYsgXnrAUSxFblEP//ibvGyTa8XT5hi8/q8l91LLpoFKYm2YOq21XWQwfnO5hvnqySLJbijiTMkxV2H8gl2Xfjw4quB40WMmkGNtnjcbZRva2jlhIwZ8C1oReiRdn9G4gJ2qV0Mlc8ZxnR41VSNEEDM3y0FrnckUroShaYCo/3JS4F3snDlDFrVCc6bWqg5cP8LQt+41SDlzdD2ZU3pU1nAT6AesgT7/rkIW7PVscoJRky3ZG4NAYGCyMdFPHCAGMSLwdZD9Mz64AtNZqyvU3MTV3XNdfmYf4yhVCuQNQ1jqnJYnP1qlrbi9qc3fWDhsPbzvglQMm+4PTpxQ0sao/stf3Qi7yRnTKK3gYCyFYhARO5iHENUEhUULy0Hyxriw== 72793@kevinUp
```

SSH 连接方式：
- macOS: `ssh kevinsun@192.168.0.107`
- Windows: `ssh SunBin@KEVINSUN`（或 `ssh SunBin@192.168.0.102`，默认 shell 是 cmd.exe，不是 bash）

---

## macOS 构建机器

| 项目 | 信息 |
|------|------|
| **主机名/IP** | 192.168.0.107 |
| **SSH 用户** | kevinsun |
| **SSH 端口** | 22 |
| **操作系统** | macOS 26.2 (Build 25C56) |
| **内核** | Darwin 25.2.0 (xnu-12377.61.12~1/RELEASE_ARM64_T8132) |
| **CPU** | Apple M4 |
| **架构** | arm64 |
| **磁盘** | 228GB 总计, 154GB 可用 (9% 已用) |
| **Node.js** | v22.14.0 (路径: `/usr/local/lib/nodejs/node-v22.14.0-darwin-arm64/bin/node`) |
| **pnpm** | v10.30.0 (路径: `/opt/homebrew/bin/pnpm`) |
| **Git** | v2.50.1 (Apple Git-155) |
| **工作目录** | `~/cicd-workspace/openclawcn` |
| **构建脚本** | `build/scripts/build-macos-cn.sh` |
| **构建产物** | `build/output/ClawdbotCN-macOS-*.dmg` |

### macOS PATH 配置
Node.js 和 pnpm 不在默认 PATH 中，构建脚本需要手动设置：
```bash
export PATH="/usr/local/lib/nodejs/node-v22.14.0-darwin-arm64/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
```

---

## Windows 构建机器

| 项目 | 信息 |
|------|------|
| **主机名/IP** | 192.168.0.102 (KEVINSUN)，推荐用主机名 KEVINSUN 连接（DHCP IP 可能变化） |
| **SSH 用户** | SunBin |
| **SSH 端口** | 22 |
| **SSH Shell** | cmd.exe（不是 bash！） |
| **操作系统** | Microsoft Windows 11 家庭中文版 |
| **OS 版本** | 10.0.26100 Build 26100 |
| **型号** | ASUS Zenbook 14 UX3405CA |
| **CPU** | Intel Core Ultra (Family 6 Model 197) ~2900 MHz |
| **架构** | x64-based PC |
| **总内存** | 32,125 MB (~32GB) |
| **可用内存** | ~17GB |
| **Node.js** | v22.18.0 (路径: `D:\Program Files\node-v22.18.0-win-x64\node.exe`) |
| **npm** | v10.9.3 |
| **pnpm** | 未安装 |
| **Git** | v2.50.1.windows.1 (路径: `C:\Program Files\Git\cmd\git.exe`) |
| **Bash** | `C:\Users\SunBin\AppData\Local\Microsoft\WindowsApps\bash.exe` (WSL) |
| **PowerShell** | `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe` |
| **工作目录** | `D:\cicd-workspace\openclawcn` |
| **构建脚本** | `build\scripts\windows\build-windows.ps1` |
| **构建产物** | `E:\clawdbuild\ClawdbotCN-Setup-*.exe` |

### Windows 注意事项
1. SSH 默认 shell 是 **cmd.exe**，不能用 `bash -s` 发送命令
2. 需要用 PowerShell 或 cmd 语法执行远程构建
3. **pnpm 未安装**，需要先安装或使用 npm 代替
4. Node.js 安装在 D 盘非标准路径

---

## Gitee 仓库

| 项目 | 信息 |
|------|------|
| **仓库地址** | https://gitee.com/sunshine1314/openclawcn |
| **SSH 地址** | git@gitee.com:sunshine1314/openclawcn.git |
| **HTTPS (带认证)** | `https://sunshine1314:<token>@gitee.com/sunshine1314/openclawcn.git` |
| **分支** | master |

---

## 构建命令

### macOS 构建
```bash
bash ci/build-macos.sh [version] [arch]
# 例: bash ci/build-macos.sh "" universal
```

### Windows 构建
```bash
bash ci/build-windows.sh [version] [mode]
# 例: bash ci/build-windows.sh "" standard
```

### 注意: ci/config.json 中包含 Gitee access token，不要提交到公开仓库
