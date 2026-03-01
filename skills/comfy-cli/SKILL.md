---
name: comfy-cli
name_zh: Comfy CLI
description: 安装、管理和运行 ComfyUI 实例。适用于搭建 ComfyUI、启动服务器、安装/更新/调试自定义节点、从 CivitAI/HuggingFace 下载模型、管理工作区、运行 API 工作流，或通过二分法排查节点冲突。
description_zh: 安装、管理和运行 ComfyUI 实例。适用于搭建 ComfyUI、启动服务器、安装/更新/调试自定义节点、从 CivitAI/HuggingFace 下载模型、管理工作区、运行 API 工作流，或通过二分法排查节点冲突。
metadata: {"clawdbot":{"emoji":"🎨","requires":{"bins":["comfy"]},"install":[{"id":"uv","kind":"uv","package":"comfy-cli","bins":["comfy"],"label":"Install comfy-cli (uv)"}]}}
---
# comfy-cli  

用于管理 ComfyUI 安装、自定义节点和模型的命令行工具。

## 快速开始  

```bash
comfy install                          # Install ComfyUI + ComfyUI-Manager
comfy launch                           # Start ComfyUI server
comfy node install ComfyUI-Impact-Pack # Install a custom node
comfy model download --url "https://civitai.com/api/download/models/12345"
```  

## 安装  

```bash
comfy install                          # Interactive GPU selection
comfy install --nvidia                 # NVIDIA GPU
comfy install --amd                    # AMD GPU (Linux ROCm)
comfy install --m-series               # Apple Silicon
comfy install --cpu                    # CPU only
comfy install --restore                # Restore deps for existing install
comfy install --pr 1234                # Install specific PR
comfy install --version latest         # Latest stable release
comfy install --version 0.2.0          # Specific version
```  

GPU 选项：`--nvidia`、`--amd`、`--intel-arc`、`--m-series`、`--cpu`  

CUDA 版本（NVIDIA）：`--cuda 12.9`、`--cuda 12.6`、`--cuda 12.4`、`--cuda 12.1`、`--cuda 11.8`  

其他标志：`--skip-manager`、`--skip-torch-or-directml`、`--skip-requirement`、`--fast-deps`  

## 启动  

```bash
comfy launch                           # Foreground mode
comfy launch --background              # Background mode
comfy launch -- --listen 0.0.0.0       # Pass args to ComfyUI
comfy stop                             # Stop background instance
comfy launch --frontend-pr 1234        # Test frontend PR
```  

## 工作区选择  

全局标志（互斥）：  

```bash
comfy --workspace /path/to/ComfyUI ... # Explicit path
comfy --recent ...                     # Last used instance
comfy --here ...                       # Current directory
comfy which                            # Show selected instance
comfy set-default /path/to/ComfyUI     # Set default
```  

## 自定义节点  

```bash
comfy node show                        # List installed nodes
comfy node simple-show                 # Compact list
comfy node install <name>              # Install from registry
comfy node install <name> --fast-deps  # Fast dependency install
comfy node reinstall <name>            # Reinstall node
comfy node uninstall <name>            # Remove node
comfy node update all                  # Update all nodes
comfy node disable <name>              # Disable node
comfy node enable <name>               # Enable node
comfy node fix <name>                  # Fix node dependencies
```  

快照（Snapshots）：  
```bash
comfy node save-snapshot               # Save current state
comfy node save-snapshot --output snapshot.json
comfy node restore-snapshot snapshot.json
comfy node restore-dependencies        # Restore deps from nodes
```  

调试：  
```bash
comfy node bisect                      # Binary search for broken node
comfy node deps-in-workflow workflow.json  # Extract deps from workflow
comfy node install-deps --workflow workflow.json  # Install workflow deps
```  

发布：  
```bash
comfy node init                        # Init scaffolding
comfy node scaffold                    # Create project via cookiecutter
comfy node validate                    # Validate before publishing
comfy node pack                        # Package node
comfy node publish                     # Publish to registry
```  

## 模型  

```bash
comfy model list                       # List available models
comfy model download --url <url>       # Download from URL
comfy model remove <name>              # Remove model
```  

来源：CivitAI、Hugging Face、直接 URL  

受保护模型所需令牌：  
- `--civitai-token` 或配置 `civitai_api_token`  
- `--hf-token` 或配置 `hf_api_token`  

## 运行工作流  

```bash
comfy run --workflow workflow_api.json
comfy run --workflow workflow.json --wait --verbose
comfy run --workflow workflow.json --host 192.168.1.10 --port 8188
```  

需已运行 ComfyUI 实例。

## ComfyUI-Manager  

```bash
comfy manager disable-gui              # Hide manager in UI
comfy manager enable-gui               # Show manager in UI
comfy manager clear                    # Clear startup actions
```  

## 更新  

```bash
comfy update all                       # Update ComfyUI + nodes
comfy update comfy                     # Update ComfyUI only
```  

## 其他命令  

```bash
comfy env                              # Show config and paths
comfy --version                        # Print CLI version
comfy pr-cache list                    # List cached PR builds
comfy pr-cache clean                   # Clear expired caches
comfy standalone                       # Create standalone Python bundle
comfy tracking enable|disable          # Manage analytics
comfy feedback                         # Submit feedback
```  

## 配置  

位置：  
- Linux：`~/.config/comfy-cli/config.ini`  
- macOS：`~/Library/Application Support/comfy-cli/config.ini`  
- Windows：`%APPDATA%\Local\comfy-cli\config.ini`  

配置项：`default_workspace`、`default_launch_extras`、`civitai_api_token`、`hf_api_token`  

## 提示  

- `--skip-prompt` 用于非交互模式（CI/脚本）  
- 后台模式通过 PID 追踪实现干净的 `comfy stop`  
- 快照（Snapshots）可精确保留节点版本，确保可复现性  
- `comfy node bisect` 通过二分法定位导致故障的具体节点  
- PR 缓存可避免重复构建您此前已测试过的前端 PR  