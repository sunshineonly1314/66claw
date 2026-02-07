#!/usr/bin/env python3
"""
Clawdbot Skills 二进制同步脚本（香港服务器版）
直连 GitHub Release 同步工具二进制到本地，供客户端下载

使用方法:
    python3 sync_binaries.py              # 同步所有工具
    python3 sync_binaries.py ordercli     # 只同步指定工具
    python3 sync_binaries.py --force      # 强制重新下载
    python3 sync_binaries.py --check      # 只检查版本，不下载

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
from typing import Optional, Tuple

# ============================================================================
# 配置
# ============================================================================

SCRIPT_DIR = Path(__file__).parent
CONFIG_FILE = SCRIPT_DIR / "tools_config.json"
DATA_DIR = Path("/data/binaries")
LOG_FILE = Path("/var/log/binaries-sync/sync.log")

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
    
    try:
        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(LOG_FILE, "a") as f:
            f.write(line + "\n")
    except Exception:
        pass  # 日志写入失败不影响主流程


def get_github_headers() -> dict:
    """获取 GitHub API 请求头"""
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Clawdbot-BinarySync/1.0",
    }
    if GITHUB_TOKEN:
        headers["Authorization"] = f"token {GITHUB_TOKEN}"
    return headers


def calculate_sha256(filepath: Path) -> str:
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


def download_file(url: str, dest: Path, max_retries: int = 3) -> bool:
    """
    直连 GitHub 下载文件（香港服务器无需代理）
    
    Args:
        url: GitHub Release 下载 URL
        dest: 本地保存路径
        max_retries: 最大重试次数
    """
    import time
    
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
            
            dest.parent.mkdir(parents=True, exist_ok=True)
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
            wait = 5 * (attempt + 1)
            log(f"    等待 {wait}s 后重试...")
            time.sleep(wait)
    
    log(f"  ❌ 下载失败，已重试 {max_retries} 次")
    return False


def extract_binary(archive_path: Path, output_dir: Path, tool_name: str) -> Optional[Path]:
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
            tmpdir = Path(tmpdir)
            
            # 解压
            archive_name = archive_path.name.lower()
            if archive_name.endswith('.tar.gz') or archive_name.endswith('.tgz'):
                with tarfile.open(archive_path, 'r:gz') as tar:
                    tar.extractall(tmpdir)
            elif archive_name.endswith('.zip'):
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
                        src = Path(root) / f
                        dst = output_dir / tool_name
                        if f.endswith('.exe'):
                            dst = output_dir / f"{tool_name}.exe"
                        
                        output_dir.mkdir(parents=True, exist_ok=True)
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

def get_current_version(tool_name: str, data_dir: Path) -> Optional[str]:
    """获取工具当前版本"""
    version_file = data_dir / tool_name / "version.txt"
    if version_file.exists():
        return version_file.read_text().strip()
    return None


def sync_tool(tool_config: dict, sync_config: dict, force: bool = False, check_only: bool = False) -> Tuple[bool, str]:
    """
    同步单个工具
    
    Returns:
        (success, message)
    """
    name = tool_config["name"]
    repo = tool_config["repo"]
    asset_pattern = tool_config["assetPattern"]
    platforms = tool_config["platforms"]
    platform_mapping = tool_config.get("platformMapping", {})
    
    max_retries = sync_config.get("maxRetries", 3)
    data_dir = Path(sync_config.get("dataDir", DATA_DIR))
    
    log(f"🔄 正在同步 {name} (from {repo})...")
    
    # 获取最新 Release
    try:
        release = get_latest_release(repo)
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            log(f"  ⚠️ 仓库无 Release: {repo}")
            return False, "no_release"
        log(f"  ❌ 获取 Release 失败: {e}")
        return False, "api_error"
    except Exception as e:
        log(f"  ❌ 获取 Release 失败: {e}")
        return False, "api_error"
    
    version = release["tag_name"].lstrip("v")
    log(f"  📦 最新版本: v{version}")
    
    # 检查是否需要更新
    current_version = get_current_version(name, data_dir)
    if current_version and not force:
        if current_version == version:
            log(f"  ✅ 已是最新版本")
            return True, "up_to_date"
        else:
            log(f"  📥 发现新版本: {current_version} -> {version}")
    
    if check_only:
        log(f"  📋 [检查模式] 需要更新: {current_version or 'none'} -> {version}")
        return True, "needs_update"
    
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
            log(f"     可用 Assets: {available[:5]}{'...' if len(available) > 5 else ''}")
            continue
        
        download_url = asset["browser_download_url"]
        size_mb = asset["size"] / 1024 / 1024
        
        log(f"  ⬇️ 下载 {platform} ({size_mb:.1f} MB)...")
        log(f"     Asset: {asset_name}")
        
        # 下载到临时文件
        tmp_path = Path(tempfile.mktemp(suffix=f"_{asset_name}"))
        
        try:
            if download_file(download_url, tmp_path, max_retries=max_retries):
                # 解压并提取二进制
                output_dir = data_dir / name / version
                binary_path = extract_binary(tmp_path, output_dir, name)
                
                if binary_path:
                    # 重命名为平台名
                    final_path = output_dir / platform
                    if platform.startswith("windows"):
                        final_path = output_dir / f"{platform}.exe"
                    
                    if binary_path != final_path:
                        shutil.move(str(binary_path), str(final_path))
                    
                    # 计算并保存 SHA256
                    sha256 = calculate_sha256(final_path)
                    sha256_path = Path(str(final_path) + ".sha256")
                    sha256_path.write_text(sha256)
                    
                    log(f"  ✅ {platform} 完成 (SHA256: {sha256[:16]}...)")
                    success_count += 1
        finally:
            # 清理临时文件
            if tmp_path.exists():
                tmp_path.unlink()
    
    if success_count == 0:
        log(f"  ❌ 没有成功下载任何文件")
        return False, "download_failed"
    
    # 更新版本文件
    version_file = data_dir / name / "version.txt"
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
    metadata_file = data_dir / name / "metadata.json"
    metadata_file.write_text(json.dumps(metadata, indent=2, ensure_ascii=False))
    
    log(f"  🎉 同步完成: {name} v{version} ({success_count}/{len(platforms)} 平台)")
    return True, "synced"


def main():
    """主函数"""
    log("=" * 60)
    log("Clawdbot Skills 二进制同步服务 (香港节点)")
    log("GitHub 直连模式 - 静态文件托管")
    log("=" * 60)
    
    # 解析参数
    force = "--force" in sys.argv
    check_only = "--check" in sys.argv
    target_tool = None
    for arg in sys.argv[1:]:
        if not arg.startswith("--"):
            target_tool = arg
            break
    
    # 加载配置
    if not CONFIG_FILE.exists():
        log(f"❌ 配置文件不存在: {CONFIG_FILE}")
        sys.exit(1)
    
    with open(CONFIG_FILE) as f:
        config = json.load(f)
    
    sync_config = config.get("syncConfig", {})
    tools = config["tools"]
    
    if target_tool:
        tools = [t for t in tools if t["name"] == target_tool]
        if not tools:
            log(f"❌ 工具不存在: {target_tool}")
            log(f"   可用工具: {[t['name'] for t in config['tools']]}")
            sys.exit(1)
    
    log(f"📋 待同步工具: {len(tools)} 个")
    if force:
        log("⚠️ 强制模式：将重新下载所有文件")
    if check_only:
        log("📋 检查模式：只检查版本，不下载")
    log("")
    
    # 同步
    results = {"synced": 0, "up_to_date": 0, "failed": 0, "no_release": 0}
    for tool in tools:
        success, status = sync_tool(tool, sync_config, force, check_only)
        if status == "synced" or status == "needs_update":
            results["synced"] += 1
        elif status == "up_to_date":
            results["up_to_date"] += 1
        elif status == "no_release":
            results["no_release"] += 1
        else:
            results["failed"] += 1
        log("")  # 空行分隔
    
    # 汇总
    log("=" * 60)
    log("同步完成统计:")
    log(f"  ✅ 已同步/需更新: {results['synced']}")
    log(f"  ✅ 已是最新: {results['up_to_date']}")
    log(f"  ⚠️ 无 Release: {results['no_release']}")
    log(f"  ❌ 失败: {results['failed']}")
    log("=" * 60)
    
    sys.exit(0 if results["failed"] == 0 else 1)


if __name__ == "__main__":
    main()
