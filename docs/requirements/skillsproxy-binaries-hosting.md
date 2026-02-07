# Clawdbot Skills 二进制托管方案（香港服务器）

> 📅 日期：2026-02-06  
> 👤 负责人：架构组  
> 🎯 目标：为国内用户提供 Skills 依赖工具的快速下载

---

## 一、背景

### 问题描述

Clawdbot 的 900+ Skills 依赖多个命令行工具，其中约 **13 个工具** 来自 GitHub 个人仓库（如 `steipete/tap`），国内用户无法直接访问 GitHub Release 下载。

### 现状

| 用户类型 | 现状 | 问题 |
|---------|------|------|
| 国内用户 | 无法访问 GitHub Release | Skills 依赖安装失败 |
| 国外用户 | 可直接访问 GitHub | 无问题 |

### 解决方案

**香港服务器作为静态文件服务器**，直连 GitHub 同步二进制文件，供国内用户下载。

---

## 架构设计

### 单节点架构（香港服务器 + Nginx 静态托管）

```
┌─────────────────┐     直连（快）     ┌─────────────────────────┐
│     GitHub      │ ◄────────────────► │      香港服务器          │
│  Release 文件   │                    │                         │
└─────────────────┘                    │  同步脚本: sync.py      │
                                       │  文件存储: /data/binaries│
                                       │  Web服务: Nginx 静态托管 │
                                       └────────────┬────────────┘
                                                    │
                                         ┌──────────┴──────────┐
                                         │                     │
                                         ▼                     ▼
                                ┌──────────────┐      ┌──────────────┐
                                │   国内用户    │      │   国外用户    │
                                │  (主要来源)   │      │  (备用来源)   │
                                └──────────────┘      └──────────────┘
```

### 为什么选择香港？

| 优势 | 说明 |
|------|------|
| **GitHub 直连** | 无需代理，同步速度快 |
| **国内可访问** | 香港到国内延迟低（~30ms），带宽好 |
| **架构简单** | 纯静态文件托管，Nginx 即可，无需 API 服务 |
| **一举两得** | 国内外用户都能用 |

---

## 二、托管工具清单与状态

### 同步状态：10/13 已上线 ✅

| # | 工具名 | 版本 | 状态 | 说明 |
|---|--------|------|------|------|
| 1 | **ordercli** | v0.1.0 | ✅ 已上线 | 10 files |
| 2 | **peekaboo** | v3.0.0-beta3 | ✅ 已上线 | 2 files |
| 3 | **remindctl** | v0.1.1 | ✅ 已上线 | 2 files |
| 4 | **memo** | - | ⚠️ 待处理 | 需调整配置 |
| 5 | **imsg** | v0.4.0 | ✅ 已上线 | 2 files |
| 6 | **camsnap** | v0.2.0 | ✅ 已上线 | 2 files |
| 7 | **gifgrep** | - | ⚠️ 待处理 | 无 Release |
| 8 | **wacli** | v0.2.0 | ✅ 已上线 | 2 files |
| 9 | **sag** | v0.2.2 | ✅ 已上线 | 6 files |
| 10 | **songsee** | - | ⚠️ 待处理 | 无 Release |
| 11 | **gog** | v0.9.0 | ✅ 已上线 | 8 files |
| 12 | **spogo** | v0.2.0 | ✅ 已上线 | 8 files |
| 13 | **summarize** | v0.10.0 | ✅ 已上线 | 2 files |

### 服务地址

```
http://43.129.194.117:8888/{tool}/version.txt      # 查看版本
http://43.129.194.117:8888/{tool}/{version}/{platform}  # 下载文件
```

### 使用示例

```bash
# 查看版本
curl http://43.129.194.117:8888/ordercli/version.txt   # 0.1.0
curl http://43.129.194.117:8888/sag/version.txt        # 0.2.2

# 下载文件
curl -LO http://43.129.194.117:8888/ordercli/0.1.0/darwin-arm64
curl -LO http://43.129.194.117:8888/sag/0.2.2/darwin-universal
```

---

## 三、前置测试（请先执行）

### 🔴 请在香港服务器上测试 GitHub 连通性

> 📍 香港服务器地址：`[待填写]`

```bash
# 测试 1：GitHub API 访问
curl -I https://api.github.com/repos/steipete/ordercli/releases/latest

# 测试 2：GitHub Release 下载
curl -I -L https://github.com/steipete/ordercli/releases/latest

# 测试 3：下载速度测试
time curl -L -o /tmp/test.tar.gz \
  "https://github.com/BurntSushi/ripgrep/releases/download/14.1.0/ripgrep-14.1.0-x86_64-unknown-linux-musl.tar.gz"
# 期望：>1 MB/s

# 测试 4：查看服务器出口 IP 和位置
curl ipinfo.io
```

**预期结果**：
- [x] GitHub API 可访问
- [x] GitHub Release 可直连下载
- [x] 下载速度 > 1 MB/s
- [x] IP 位于香港

---

## 四、URL 格式（纯静态托管）

香港服务器使用 **Nginx 静态文件托管**，无需复杂的 API 服务。

### 4.1 URL 结构

| URL | 说明 |
|-----|------|
| `http://服务器/{tool}/version.txt` | 获取最新版本号 |
| `http://服务器/{tool}/metadata.json` | 获取工具元信息 |
| `http://服务器/{tool}/{version}/{platform}` | 下载二进制文件 |
| `http://服务器/{tool}/{version}/{platform}.sha256` | SHA256 校验和 |

### 4.2 示例

```bash
# 获取 ordercli 最新版本
curl http://hk-server/ordercli/version.txt
# 输出: 0.1.0

# 获取元信息
curl http://hk-server/ordercli/metadata.json

# 下载 macOS ARM64 版本
curl -L -o ordercli http://hk-server/ordercli/0.1.0/darwin-arm64

# 获取 SHA256 校验和
curl http://hk-server/ordercli/0.1.0/darwin-arm64.sha256
```

### 4.3 metadata.json 格式

```json
{
  "name": "ordercli",
  "description": "订单管理 CLI",
  "repo": "steipete/ordercli",
  "latestVersion": "0.1.0",
  "platforms": ["darwin-arm64", "darwin-amd64", "linux-amd64", "windows-amd64"],
  "lastSynced": "2026-02-06T10:00:00Z",
  "releaseUrl": "https://github.com/steipete/ordercli/releases/tag/v0.1.0"
}
```

---

## 五、服务端存储结构

```
/data/binaries/
├── ordercli/
│   ├── version.txt          # 当前最新版本号
│   ├── metadata.json         # 工具元信息
│   └── 1.2.3/
│       ├── darwin-arm64      # 二进制文件
│       ├── darwin-arm64.sha256
│       ├── darwin-amd64
│       ├── darwin-amd64.sha256
│       ├── linux-amd64
│       ├── linux-amd64.sha256
│       ├── windows-amd64
│       └── windows-amd64.sha256
├── peekaboo/
│   ├── version.txt
│   ├── metadata.json
│   └── 2.0.1/
│       ├── darwin-arm64
│       └── ...
└── ...
```

**metadata.json 示例**：
```json
{
  "name": "ordercli",
  "description": "Order food from CLI",
  "repo": "steipete/ordercli",
  "homepage": "https://ordercli.sh",
  "assetPattern": "ordercli-{platform}.tar.gz",
  "platforms": ["darwin-arm64", "darwin-amd64", "linux-amd64", "windows-amd64"]
}
```

---

## 六、同步脚本

### 配置文件 `/opt/binaries-sync/tools_config.json`

> ⚠️ **注意**：`assetPattern` 中的变量说明：
> - `{name}` - 工具名
> - `{version}` - 版本号（不含 v 前缀）
> - `{platform}` - 平台标识，会根据 `platformMapping` 转换
>
> 不同工具的文件命名风格不同，需要根据实际 Release 调整。

```json
{
  "syncConfig": {
    "syncIntervalHours": 1,
    "maxRetries": 3,
    "dataDir": "/data/binaries"
  },
  "tools": [
    {
      "name": "ordercli",
      "repo": "steipete/ordercli",
      "assetPattern": "{name}_{version}_{platform}.tar.gz",
      "platformMapping": {
        "darwin-arm64": "darwin_arm64",
        "darwin-amd64": "darwin_amd64",
        "linux-amd64": "linux_amd64",
        "windows-amd64": "windows_amd64"
      },
      "platforms": ["darwin-arm64", "darwin-amd64", "linux-amd64", "windows-amd64"],
      "description": "Order food from CLI"
    },
    {
      "name": "peekaboo",
      "repo": "steipete/peekaboo",
      "assetPattern": "{name}_{version}_{platform}.tar.gz",
      "platformMapping": {
        "darwin-arm64": "darwin_arm64",
        "darwin-amd64": "darwin_amd64"
      },
      "platforms": ["darwin-arm64", "darwin-amd64"],
      "description": "Screenshot tool for macOS"
    },
    {
      "name": "remindctl",
      "repo": "steipete/remindctl",
      "assetPattern": "{name}_{version}_{platform}.tar.gz",
      "platformMapping": {
        "darwin-arm64": "darwin_arm64",
        "darwin-amd64": "darwin_amd64"
      },
      "platforms": ["darwin-arm64", "darwin-amd64"],
      "description": "Apple Reminders CLI"
    },
    {
      "name": "memo",
      "repo": "antoniorodr/memo",
      "assetPattern": "{name}_{version}_{platform}.tar.gz",
      "platformMapping": {
        "darwin-arm64": "darwin_arm64",
        "darwin-amd64": "darwin_amd64"
      },
      "platforms": ["darwin-arm64", "darwin-amd64"],
      "description": "Apple Notes CLI"
    },
    {
      "name": "imsg",
      "repo": "steipete/imsg",
      "assetPattern": "{name}_{version}_{platform}.tar.gz",
      "platformMapping": {
        "darwin-arm64": "darwin_arm64",
        "darwin-amd64": "darwin_amd64"
      },
      "platforms": ["darwin-arm64", "darwin-amd64"],
      "description": "iMessage CLI"
    },
    {
      "name": "camsnap",
      "repo": "steipete/camsnap",
      "assetPattern": "{name}_{version}_{platform}.tar.gz",
      "platformMapping": {
        "darwin-arm64": "darwin_arm64",
        "darwin-amd64": "darwin_amd64"
      },
      "platforms": ["darwin-arm64", "darwin-amd64"],
      "description": "Camera snapshot tool"
    },
    {
      "name": "gifgrep",
      "repo": "steipete/gifgrep",
      "assetPattern": "{name}_{version}_{platform}.tar.gz",
      "platformMapping": {
        "darwin-arm64": "darwin_arm64",
        "darwin-amd64": "darwin_amd64",
        "linux-amd64": "linux_amd64",
        "windows-amd64": "windows_amd64"
      },
      "platforms": ["darwin-arm64", "darwin-amd64", "linux-amd64", "windows-amd64"],
      "description": "Search GIFs"
    },
    {
      "name": "wacli",
      "repo": "steipete/wacli",
      "assetPattern": "{name}_{version}_{platform}.tar.gz",
      "platformMapping": {
        "darwin-arm64": "darwin_arm64",
        "darwin-amd64": "darwin_amd64",
        "linux-amd64": "linux_amd64",
        "windows-amd64": "windows_amd64"
      },
      "platforms": ["darwin-arm64", "darwin-amd64", "linux-amd64", "windows-amd64"],
      "description": "WhatsApp CLI"
    },
    {
      "name": "sag",
      "repo": "steipete/sag",
      "assetPattern": "{name}_{version}_{platform}.tar.gz",
      "platformMapping": {
        "darwin-arm64": "darwin_arm64",
        "darwin-amd64": "darwin_amd64"
      },
      "platforms": ["darwin-arm64", "darwin-amd64"],
      "description": "Audio tool"
    },
    {
      "name": "songsee",
      "repo": "steipete/songsee",
      "assetPattern": "{name}_{version}_{platform}.tar.gz",
      "platformMapping": {
        "darwin-arm64": "darwin_arm64",
        "darwin-amd64": "darwin_amd64"
      },
      "platforms": ["darwin-arm64", "darwin-amd64"],
      "description": "Apple Music CLI"
    },
    {
      "name": "gog",
      "repo": "steipete/gogcli",
      "assetPattern": "{name}_{version}_{platform}.tar.gz",
      "platformMapping": {
        "darwin-arm64": "darwin_arm64",
        "darwin-amd64": "darwin_amd64",
        "linux-amd64": "linux_amd64",
        "windows-amd64": "windows_amd64"
      },
      "platforms": ["darwin-arm64", "darwin-amd64", "linux-amd64", "windows-amd64"],
      "description": "GOG games CLI"
    },
    {
      "name": "spogo",
      "repo": "steipete/spogo",
      "assetPattern": "{name}_{version}_{platform}.tar.gz",
      "platformMapping": {
        "darwin-arm64": "darwin_arm64",
        "darwin-amd64": "darwin_amd64",
        "linux-amd64": "linux_amd64"
      },
      "platforms": ["darwin-arm64", "darwin-amd64", "linux-amd64"],
      "description": "Spotify CLI"
    },
    {
      "name": "summarize",
      "repo": "steipete/summarize",
      "assetPattern": "{name}_{version}_{platform}.tar.gz",
      "platformMapping": {
        "darwin-arm64": "darwin_arm64",
        "darwin-amd64": "darwin_amd64",
        "linux-amd64": "linux_amd64"
      },
      "platforms": ["darwin-arm64", "darwin-amd64", "linux-amd64"],
      "description": "Text summarization tool"
    }
  ]
}
```

> 📝 **待确认**：上述 `assetPattern` 和 `platformMapping` 是基于 ordercli 的格式推测的。
> 请检查每个工具的实际 Release 文件名后，逐个更新配置。

### 同步脚本 `/opt/binaries-sync/sync_binaries.py`

```python
#!/usr/bin/env python3
"""
Clawdbot Skills 二进制同步脚本（香港服务器版）
直连 GitHub Release 同步工具二进制到本地

使用方法:
    python3 sync_binaries.py              # 同步所有工具
    python3 sync_binaries.py ordercli     # 只同步指定工具
    python3 sync_binaries.py --force      # 强制重新下载

依赖安装:
    pip3 install requests
"""

import os
import sys
import json
import hashlib
import tarfile
import zipfile
import tempfile
import shutil
import requests
from datetime import datetime
from pathlib import Path
from typing import Optional

# ============================================================================
# 配置
# ============================================================================

CONFIG_FILE = "/opt/binaries-sync/tools_config.json"
DATA_DIR = "/data/binaries"
LOG_FILE = "/var/log/binaries-sync/sync.log"

# GitHub Token (可选，提高 API 限额从 60 到 5000 次/小时)
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")

# ============================================================================
# 工具函数
# ============================================================================

def log(message: str):
    """记录日志"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {message}"
    print(line)
    
    log_dir = os.path.dirname(LOG_FILE)
    if log_dir:
        os.makedirs(log_dir, exist_ok=True)
    with open(LOG_FILE, "a") as f:
        f.write(line + "\n")


def get_github_headers():
    """获取 GitHub API 请求头"""
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Clawdbot-BinarySync/1.0",
    }
    if GITHUB_TOKEN:
        headers["Authorization"] = f"token {GITHUB_TOKEN}"
    return headers


def calculate_sha256(filepath: str) -> str:
    """计算文件 SHA256"""
    sha256 = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def get_latest_release(repo: str) -> dict:
    """获取 GitHub 仓库的最新 Release"""
    url = f"https://api.github.com/repos/{repo}/releases/latest"
    resp = requests.get(url, headers=get_github_headers(), timeout=30)
    resp.raise_for_status()
    return resp.json()


def download_file(url: str, dest: str, max_retries: int = 3) -> bool:
    """
    直连 GitHub 下载文件（香港服务器无需代理）
    
    Args:
        url: GitHub Release 下载 URL
        dest: 本地保存路径
        max_retries: 最大重试次数
    """
    for attempt in range(max_retries):
        try:
            log(f"    下载尝试 {attempt + 1}/{max_retries}...")
            resp = requests.get(
                url, 
                headers=get_github_headers(), 
                stream=True, 
                timeout=600,  # 10分钟超时
                allow_redirects=True
            )
            resp.raise_for_status()
            
            # 获取文件大小
            total_size = int(resp.headers.get('content-length', 0))
            
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            downloaded = 0
            with open(dest, "wb") as f:
                for chunk in resp.iter_content(chunk_size=65536):  # 64KB chunks
                    f.write(chunk)
                    downloaded += len(chunk)
                    # 每 5MB 打印一次进度
                    if total_size > 0 and downloaded % (5 * 1024 * 1024) < 65536:
                        pct = downloaded * 100 // total_size
                        log(f"    进度: {pct}% ({downloaded // 1024 // 1024} MB)")
            
            log(f"    ✓ 下载完成: {downloaded // 1024} KB")
            return True
            
        except requests.exceptions.Timeout:
            log(f"    ⚠️ 下载超时")
        except requests.exceptions.RequestException as e:
            log(f"    ⚠️ 下载失败: {e}")
        
        if attempt < max_retries - 1:
            import time
            wait = 5 * (attempt + 1)
            log(f"    等待 {wait}s 后重试...")
            time.sleep(wait)
    
    log(f"  ❌ 下载失败，已重试 {max_retries} 次")
    return False


def extract_binary(archive_path: str, output_dir: str, tool_name: str) -> Optional[str]:
    """
    从压缩包中提取二进制文件
    
    Args:
        archive_path: 压缩包路径
        output_dir: 输出目录
        tool_name: 工具名（用于查找二进制）
    
    Returns:
        提取的二进制文件路径，失败返回 None
    """
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            # 解压
            if archive_path.endswith('.tar.gz') or archive_path.endswith('.tgz'):
                with tarfile.open(archive_path, 'r:gz') as tar:
                    tar.extractall(tmpdir)
            elif archive_path.endswith('.zip'):
                with zipfile.ZipFile(archive_path, 'r') as zip_ref:
                    zip_ref.extractall(tmpdir)
            else:
                log(f"    ⚠️ 不支持的压缩格式: {archive_path}")
                return None
            
            # 查找二进制文件
            for root, dirs, files in os.walk(tmpdir):
                for f in files:
                    # 匹配工具名（可能有 .exe 后缀）
                    if f == tool_name or f == f"{tool_name}.exe":
                        src = os.path.join(root, f)
                        dst = os.path.join(output_dir, tool_name)
                        if f.endswith('.exe'):
                            dst += '.exe'
                        
                        os.makedirs(output_dir, exist_ok=True)
                        shutil.copy2(src, dst)
                        os.chmod(dst, 0o755)  # 设置可执行权限
                        log(f"    提取二进制: {f}")
                        return dst
            
            log(f"    ⚠️ 未找到二进制文件 {tool_name}")
            return None
            
    except Exception as e:
        log(f"    ❌ 解压失败: {e}")
        return None


# ============================================================================
# 主要逻辑
# ============================================================================

def sync_tool(tool_config: dict, sync_config: dict, force: bool = False) -> bool:
    """同步单个工具"""
    name = tool_config["name"]
    repo = tool_config["repo"]
    asset_pattern = tool_config["assetPattern"]
    platforms = tool_config["platforms"]
    platform_mapping = tool_config.get("platformMapping", {})
    
    max_retries = sync_config.get("maxRetries", 3)
    data_dir = sync_config.get("dataDir", DATA_DIR)
    
    log(f"🔄 正在同步 {name} (from {repo})...")
    
    # 获取最新 Release
    try:
        release = get_latest_release(repo)
    except Exception as e:
        log(f"  ❌ 获取 Release 失败: {e}")
        return False
    
    version = release["tag_name"].lstrip("v")
    log(f"  📦 最新版本: v{version}")
    
    # 检查是否需要更新
    version_file = Path(data_dir) / name / "version.txt"
    if version_file.exists() and not force:
        current_version = version_file.read_text().strip()
        if current_version == version:
            log(f"  ✅ 已是最新版本")
            return True
        else:
            log(f"  📥 发现新版本: {current_version} -> {version}")
    
    # 下载各平台二进制
    success_count = 0
    for platform in platforms:
        # 获取平台在文件名中的表示
        platform_in_filename = platform_mapping.get(platform, platform)
        
        # 构建 asset 名称
        asset_name = asset_pattern.format(
            name=name,
            version=version,
            platform=platform_in_filename
        )
        
        # 查找对应的 asset
        asset = next((a for a in release["assets"] if a["name"] == asset_name), None)
        
        if not asset:
            log(f"  ⚠️ 未找到 Asset: {asset_name}")
            # 列出所有可用的 assets 帮助调试
            available = [a["name"] for a in release["assets"]]
            log(f"     可用 Assets: {available}")
            continue
        
        download_url = asset["browser_download_url"]
        size_mb = asset["size"] / 1024 / 1024
        
        log(f"  ⬇️ 下载 {platform} ({size_mb:.1f} MB)...")
        log(f"     Asset: {asset_name}")
        
        # 下载到临时文件
        with tempfile.NamedTemporaryFile(suffix=asset_name, delete=False) as tmp:
            tmp_path = tmp.name
        
        try:
            if download_file(download_url, tmp_path, max_retries=max_retries):
                # 解压并提取二进制
                output_dir = str(Path(data_dir) / name / version)
                binary_path = extract_binary(tmp_path, output_dir, name)
                
                if binary_path:
                    # 重命名为平台名
                    final_path = Path(output_dir) / platform
                    if binary_path != str(final_path):
                        shutil.move(binary_path, final_path)
                    
                    # 计算并保存 SHA256
                    sha256 = calculate_sha256(str(final_path))
                    sha256_path = str(final_path) + ".sha256"
                    Path(sha256_path).write_text(sha256)
                    
                    log(f"  ✅ {platform} 完成 (SHA256: {sha256[:16]}...)")
                    success_count += 1
        finally:
            # 清理临时文件
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
    
    if success_count == 0:
        log(f"  ❌ 没有成功下载任何文件")
        return False
    
    # 更新版本文件
    version_file.parent.mkdir(parents=True, exist_ok=True)
    version_file.write_text(version)
    
    # 更新元信息
    metadata = {
        "name": name,
        "description": tool_config.get("description", ""),
        "repo": repo,
        "latestVersion": version,
        "platforms": platforms,
        "lastSynced": datetime.now().isoformat(),
        "releaseUrl": release["html_url"],
        "changelog": release.get("body", "")[:1000],  # 限制 changelog 长度
    }
    metadata_file = Path(data_dir) / name / "metadata.json"
    metadata_file.write_text(json.dumps(metadata, indent=2, ensure_ascii=False))
    
    log(f"  🎉 同步完成: {name} v{version} ({success_count}/{len(platforms)} 平台)")
    return True


def main():
    """主函数"""
    log("=" * 60)
    log("Clawdbot Skills 二进制同步服务 (香港节点)")
    log("GitHub 直连模式")
    log("=" * 60)
    
    # 解析参数
    force = "--force" in sys.argv
    target_tool = None
    for arg in sys.argv[1:]:
        if not arg.startswith("--"):
            target_tool = arg
            break
    
    # 加载配置
    with open(CONFIG_FILE) as f:
        config = json.load(f)
    
    sync_config = config.get("syncConfig", {})
    tools = config["tools"]
    if target_tool:
        tools = [t for t in tools if t["name"] == target_tool]
        if not tools:
            log(f"❌ Tool not found: {target_tool}")
            sys.exit(1)
    
    # 同步
    success = 0
    failed = 0
    for tool in tools:
        if sync_tool(tool, sync_config, force):
            success += 1
        else:
            failed += 1
    
    # 汇总
    log("=" * 60)
    log(f"Sync completed: {success} success, {failed} failed")
    log("=" * 60)
    
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
```

### Cron 配置

```bash
# 创建日志目录
sudo mkdir -p /var/log/binaries-sync

# 添加 cron 任务（每小时同步一次）
echo "0 * * * * cd /opt/binaries-sync && python3 sync_binaries.py >> /var/log/binaries-sync/sync.log 2>&1" | crontab -
```

### 初始化脚本

```bash
#!/bin/bash
# /opt/binaries-sync/init.sh
# 首次部署时执行

set -e

# 创建目录
sudo mkdir -p /opt/binaries-sync
sudo mkdir -p /data/binaries
sudo mkdir -p /var/log/binaries-sync

# 安装依赖
pip3 install requests

# 复制配置和脚本
# cp tools_config.json /opt/binaries-sync/
# cp sync_binaries.py /opt/binaries-sync/

# 执行首次同步
cd /opt/binaries-sync
python3 sync_binaries.py

echo "✅ 初始化完成"
```

---

## 七、客户端对接

客户端（Clawdbot）会自动调用香港服务器的 API：

1. 用户安装 Skill 时，检测缺少的工具
2. 调用 `/api/binaries/{tool}/mirrors` 获取镜像源列表
3. 国内用户优先使用香港服务器，国外用户优先 GitHub
4. 下载失败自动切换到备用源

**客户端代码已就绪**，只需服务端 API 上线即可。

---

## 八、测试检查清单

### 香港服务器测试

```bash
# 1. 测试 GitHub API
curl -s https://api.github.com/rate_limit | jq .rate

# 2. 测试 GitHub Release 下载速度
time curl -L -o /tmp/test.tar.gz \
  "https://github.com/BurntSushi/ripgrep/releases/download/14.1.0/ripgrep-14.1.0-x86_64-unknown-linux-musl.tar.gz"

# 3. 同步单个工具
python3 /opt/binaries-sync/sync_binaries.py ripgrep --force

# 4. 检查同步结果
ls -la /data/binaries/ripgrep/
cat /data/binaries/ripgrep/version.txt
```

### API 测试

- [ ] `GET /api/binaries` - 返回工具列表
- [ ] `GET /api/binaries/ordercli/latest` - 返回最新版本
- [ ] `GET /api/binaries/ordercli/mirrors?platform=darwin-arm64` - 返回镜像列表
- [ ] `GET /api/binaries/ordercli/{version}/darwin-arm64` - 下载二进制

### 客户端测试

- [ ] 国内用户能正常从香港服务器下载
- [ ] 国外用户优先使用 GitHub，香港服务器作为备用
- [ ] Fallback 机制正常工作

---

## 九、部署步骤

### 1. 准备香港服务器

```bash
# SSH 到香港服务器
ssh user@hk-server

# 安装 Python 依赖
pip3 install requests

# 创建目录
sudo mkdir -p /opt/binaries-sync /data/binaries /var/log/binaries-sync
```

### 2. 部署同步脚本

```bash
# 上传脚本和配置
scp sync_binaries.py tools_config.json user@hk-server:/opt/binaries-sync/
```

### 3. 首次同步

```bash
cd /opt/binaries-sync
python3 sync_binaries.py
```

### 4. 配置定时任务

```bash
crontab -e
# 添加: 0 * * * * cd /opt/binaries-sync && python3 sync_binaries.py >> /var/log/binaries-sync/sync.log 2>&1
```

### 5. 配置 Nginx 静态文件托管

```nginx
# /etc/nginx/sites-available/binaries
server {
    listen 80;
    server_name binaries.example.com;  # 或直接用 IP

    root /data/binaries;
    autoindex on;

    location / {
        add_header Access-Control-Allow-Origin *;
        expires 1h;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/binaries /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## 附录：下载 URL 格式

纯静态文件托管，URL 直接对应文件路径：

| URL | 说明 |
|-----|------|
| `http://服务器/ordercli/version.txt` | 获取最新版本号 |
| `http://服务器/ordercli/metadata.json` | 获取工具元信息 |
| `http://服务器/ordercli/0.1.0/darwin-arm64` | 下载 macOS ARM64 二进制 |
| `http://服务器/ordercli/0.1.0/darwin-arm64.sha256` | SHA256 校验和 |

---

## 附录：香港服务器信息

| 项目 | 值 |
|------|-----|
| 地址 | `http://43.129.194.117:8888` |
| 同步状态 | 10/13 工具已上线 (77%) |
| 数据目录 | `/data/binaries` |
| 同步脚本 | `/opt/binaries-sync/sync_binaries.py` |
| 日志 | `/var/log/binaries-sync/sync.log` |

---

## 附录：客户端集成

### 已完成 ✅

客户端代码已实现，包括：

1. **配置文件** (`src/config/cn-mirrors.ts`)
   - 添加 `hkBinaries` 配置，包含服务器地址和 13 个工具列表
   - 导出 `isToolHostedOnHK()`, `getHKBinaryVersionUrl()`, `getHKBinaryDownloadUrl()` 等辅助函数
   - 更新 `CLI_TOOL_MIRRORS` 类型，支持 `hkBinary` 字段

2. **安装逻辑** (`src/agents/skills-install.ts`)
   - 添加 `getHKBinaryLatestVersion()`: 从香港服务器获取最新版本
   - 添加 `installFromHKBinaryServer()`: 下载并安装二进制文件
   - 添加 `canInstallFromHKServer()`: 检查工具是否支持香港下载
   - 在 brew 安装失败时自动尝试香港服务器下载

### 边界情况处理

| 场景 | 处理方式 |
|------|---------|
| 工具不在香港托管 | 返回错误，不尝试下载 |
| 平台不支持 | 检查 `hkBinary.platforms`，不支持时返回错误 |
| 版本获取失败 | 10s 超时，返回友好错误信息 |
| 文件过大 (>100MB) | 拒绝下载，防止滥用 |
| 文件过小 (<1KB) | 视为无效文件，删除并报错 |
| 网络超时 | 友好提示"请检查网络或稍后重试" |
| 连接失败 | 提示"无法连接香港服务器" |
| URL 安全校验 | 使用 SSRF 验证函数，拒绝内网地址 |

### 触发时机

当用户安装 Skills 依赖，且：
1. 检测到国内用户 (`shouldUseCNMirror() === true`)
2. brew 安装失败（或 brew 未安装）
3. 工具在香港服务器托管列表中
4. 当前平台在工具的支持列表中

则自动尝试从香港服务器下载二进制文件。

### 安装目录

二进制文件安装到 `~/.clawdbot/tools/{toolName}/` 目录下。
