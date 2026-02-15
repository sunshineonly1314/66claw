#!/bin/bash
# ============================================================================
# OpenClawCN macOS 离线包构建脚本
# ============================================================================
# 构建包含所有依赖的离线安装包，实现真正的一键部署
#
# 用法: ./package-mac-offline.sh [选项]
#
# 选项:
#   --arch arm64|x64|universal  指定架构 (默认: 当前架构)
#   --version VERSION           指定版本号 (默认: 从 package.json 读取)
#   --skip-node                 跳过 Node.js 打包
#   --skip-deps                 跳过 node_modules 打包
#
# 输出:
#   dist/OpenClawCN-offline-{arch}.tar.gz
#
# 参考 Windows build-offline-cn.ps1 和 setup.iss
# ============================================================================

set -e

# ============================================================================
# 配置
# ============================================================================
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$PROJECT_ROOT/build/mac-offline"
DIST_DIR="$PROJECT_ROOT/dist"

# Node.js 版本
NODE_VERSION="22.11.0"
NODE_BASE_URL="https://nodejs.org/dist/v${NODE_VERSION}"

# 默认架构为当前系统架构
DEFAULT_ARCH=$(uname -m)
if [ "$DEFAULT_ARCH" = "x86_64" ]; then
    DEFAULT_ARCH="x64"
fi

ARCH="${ARCH:-$DEFAULT_ARCH}"
SKIP_NODE=false
SKIP_DEPS=false

# ============================================================================
# 颜色
# ============================================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# ============================================================================
# 输出函数
# ============================================================================
log_info() { echo -e "${CYAN}[INFO]${NC} $1"; }
log_ok() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ============================================================================
# 参数解析
# ============================================================================
parse_args() {
    while [ $# -gt 0 ]; do
        case "$1" in
            --arch)
                ARCH="$2"
                shift 2
                ;;
            --version)
                VERSION="$2"
                shift 2
                ;;
            --skip-node)
                SKIP_NODE=true
                shift
                ;;
            --skip-deps)
                SKIP_DEPS=true
                shift
                ;;
            --help|-h)
                echo "OpenClawCN macOS 离线包构建脚本"
                echo ""
                echo "用法: $0 [选项]"
                echo ""
                echo "选项:"
                echo "  --arch arm64|x64|universal  指定架构"
                echo "  --version VERSION           指定版本号"
                echo "  --skip-node                 跳过 Node.js 打包"
                echo "  --skip-deps                 跳过 node_modules 打包"
                echo "  --help                      显示此帮助"
                exit 0
                ;;
            *)
                log_error "未知参数: $1"
                exit 1
                ;;
        esac
    done
}

# ============================================================================
# 获取版本号
# ============================================================================
get_version() {
    if [ -z "$VERSION" ]; then
        VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "0.0.0")
    fi
    log_info "版本号: $VERSION"
}

# ============================================================================
# 准备构建目录
# ============================================================================
prepare_build_dir() {
    log_info "准备构建目录..."
    
    rm -rf "$BUILD_DIR"
    mkdir -p "$BUILD_DIR"
    mkdir -p "$DIST_DIR"
    
    log_ok "构建目录已准备: $BUILD_DIR"
}

# ============================================================================
# 下载 Node.js
# ============================================================================
download_node() {
    if [ "$SKIP_NODE" = true ]; then
        log_warn "跳过 Node.js 下载"
        return
    fi
    
    log_info "下载 Node.js $NODE_VERSION..."
    
    local node_dir="$BUILD_DIR/node"
    mkdir -p "$node_dir"
    
    case "$ARCH" in
        arm64)
            local node_url="${NODE_BASE_URL}/node-v${NODE_VERSION}-darwin-arm64.tar.gz"
            local node_file="/tmp/node-arm64.tar.gz"
            
            log_info "下载 arm64 版本: $node_url"
            curl -fSL "$node_url" -o "$node_file"
            
            tar -xzf "$node_file" -C "$node_dir" --strip-components=1
            rm "$node_file"
            ;;
        x64)
            local node_url="${NODE_BASE_URL}/node-v${NODE_VERSION}-darwin-x64.tar.gz"
            local node_file="/tmp/node-x64.tar.gz"
            
            log_info "下载 x64 版本: $node_url"
            curl -fSL "$node_url" -o "$node_file"
            
            tar -xzf "$node_file" -C "$node_dir" --strip-components=1
            rm "$node_file"
            ;;
        universal)
            log_info "构建 Universal Binary..."
            
            # 下载两个架构
            local node_arm64="/tmp/node-arm64.tar.gz"
            local node_x64="/tmp/node-x64.tar.gz"
            local node_arm64_dir="/tmp/node-arm64"
            local node_x64_dir="/tmp/node-x64"
            
            curl -fSL "${NODE_BASE_URL}/node-v${NODE_VERSION}-darwin-arm64.tar.gz" -o "$node_arm64"
            curl -fSL "${NODE_BASE_URL}/node-v${NODE_VERSION}-darwin-x64.tar.gz" -o "$node_x64"
            
            mkdir -p "$node_arm64_dir" "$node_x64_dir"
            tar -xzf "$node_arm64" -C "$node_arm64_dir" --strip-components=1
            tar -xzf "$node_x64" -C "$node_x64_dir" --strip-components=1
            
            # 复制 arm64 作为基础
            cp -R "$node_arm64_dir/"* "$node_dir/"
            
            # 合并 node 二进制为 Universal
            lipo -create \
                "$node_arm64_dir/bin/node" \
                "$node_x64_dir/bin/node" \
                -output "$node_dir/bin/node"
            
            # 清理
            rm -rf "$node_arm64" "$node_x64" "$node_arm64_dir" "$node_x64_dir"
            ;;
        *)
            log_error "不支持的架构: $ARCH"
            exit 1
            ;;
    esac
    
    # 验证
    local node_version=$("$node_dir/bin/node" --version 2>/dev/null || echo "")
    if [ -n "$node_version" ]; then
        log_ok "Node.js $node_version 已下载"
    else
        log_error "Node.js 下载失败"
        exit 1
    fi
    
    # 只保留必要文件
    rm -rf "$node_dir/share" "$node_dir/include" "$node_dir/lib/node_modules/npm/docs"
}

# ============================================================================
# 构建 TypeScript（5 层保护）
# ============================================================================
build_typescript() {
    log_info "构建 TypeScript（5 层代码保护）..."

    cd "$PROJECT_ROOT"

    # 检查构建产物是否完整（entry.js + 至少 1 个 .jsc 字节码文件）
    local needs_build=false
    if [ ! -d "dist" ] || [ ! -f "dist/entry.js" ]; then
        needs_build=true
    elif [ -z "$(find dist -name '*.jsc' 2>/dev/null | head -1)" ]; then
        log_warn "dist/ 存在但缺少 .jsc 字节码文件，需要重新构建"
        needs_build=true
    fi

    if [ "$needs_build" = true ]; then
        # build:release = build:prod + obfuscate(双级) + bytecode:compile + integrity:gen
        log_info "执行 build:release（混淆 + 字节码 + 完整性哈希）..."
        pnpm build:release
    else
        local jsc_count=$(find dist -name '*.jsc' 2>/dev/null | wc -l | tr -d ' ')
        log_info "使用现有构建产物（$jsc_count 个字节码文件）"
    fi

    log_ok "TypeScript 构建完成（含代码保护）"
}

# ============================================================================
# 构建 UI
# ============================================================================
build_ui() {
    log_info "构建 UI..."
    
    cd "$PROJECT_ROOT"
    
    if [ -f "scripts/ui.js" ]; then
        node scripts/ui.js build
    fi
    
    log_ok "UI 构建完成"
}

# ============================================================================
# 编译 Native Addon（Layer 3 — C++ 安全模块）
# ============================================================================
build_native_addon() {
    log_info "检查 Native Addon（Layer 3）..."

    cd "$PROJECT_ROOT"

    local native_dir="$PROJECT_ROOT/native"
    local native_output="$native_dir/build/Release/openclawcn_native.node"

    if [ ! -f "$native_dir/binding.gyp" ]; then
        log_warn "native/binding.gyp 不存在，跳过 Native Addon 构建"
        return
    fi

    # 检查是否有 node-gyp
    if ! command -v node-gyp &>/dev/null && ! npx node-gyp --version &>/dev/null 2>&1; then
        log_warn "node-gyp 不可用，跳过 Native Addon 构建"
        log_info "安装方法: xcode-select --install (macOS) 或 pnpm add -D node-gyp"
        return
    fi

    if [ -f "$native_output" ] && [ "$native_output" -nt "$native_dir/src/addon.cc" ]; then
        local addon_size=$(du -h "$native_output" | cut -f1)
        log_ok "Native Addon 已是最新: openclawcn_native.node ($addon_size)"
        return
    fi

    log_info "编译 C++ Native Addon..."
    if (cd "$native_dir" && npx node-gyp rebuild 2>&1); then
        if [ -f "$native_output" ]; then
            local addon_size=$(du -h "$native_output" | cut -f1)
            log_ok "Native Addon 编译成功: openclawcn_native.node ($addon_size)"

            # Strip native addon symbols
            if command -v strip &>/dev/null; then
                strip -x "$native_output" 2>/dev/null || true
                log_ok "Native Addon 已 strip"
            fi
        else
            log_warn "Native Addon 编译产物未找到（非致命，将使用 JS 回退）"
        fi
    else
        log_warn "Native Addon 编译失败（非致命，安全函数将使用 JS 回退）"
    fi
}

# ============================================================================
# 打包 CLI 和依赖
# ============================================================================
package_cli() {
    log_info "打包 CLI..."
    
    local cli_dir="$BUILD_DIR/openclawcn-cli"
    mkdir -p "$cli_dir"
    
    # 复制编译产物（包含 .jsc 字节码文件）
    cp -R "$PROJECT_ROOT/dist" "$cli_dir/"

    # 统计字节码文件
    local jsc_count=$(find "$cli_dir/dist" -name "*.jsc" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$jsc_count" -gt 0 ]; then
        log_ok "包含 $jsc_count 个 V8 字节码文件（Layer 1）"
    fi

    # 复制 package.json
    cp "$PROJECT_ROOT/package.json" "$cli_dir/"

    # 复制 Native Addon（Layer 3）
    local native_addon="$PROJECT_ROOT/native/build/Release/openclawcn_native.node"
    if [ -f "$native_addon" ]; then
        mkdir -p "$cli_dir/native/build/Release"
        cp "$native_addon" "$cli_dir/native/build/Release/"
        local addon_size=$(du -h "$native_addon" | cut -f1)
        log_ok "Native Addon 已打包: openclawcn_native.node ($addon_size)"
    fi

    # 复制扩展插件
    if [ -d "$PROJECT_ROOT/extensions" ]; then
        mkdir -p "$cli_dir/extensions"
        for ext in feishu dingtalk wecom; do
            if [ -d "$PROJECT_ROOT/extensions/$ext" ]; then
                cp -R "$PROJECT_ROOT/extensions/$ext" "$cli_dir/extensions/"
            fi
        done
    fi
    
    # 复制 skills
    if [ -d "$PROJECT_ROOT/skills" ]; then
        cp -R "$PROJECT_ROOT/skills" "$cli_dir/"
    fi
    
    log_ok "CLI 文件已复制"
}

# ============================================================================
# 安装生产依赖
# ============================================================================
install_dependencies() {
    if [ "$SKIP_DEPS" = true ]; then
        log_warn "跳过依赖安装"
        return
    fi
    
    log_info "安装生产依赖（这可能需要几分钟）..."
    
    local cli_dir="$BUILD_DIR/openclawcn-cli"
    cd "$cli_dir"
    
    # 使用国内镜像
    npm config set registry https://registry.npmmirror.com
    
    # 安装生产依赖
    npm install --omit=dev --legacy-peer-deps --no-audit --no-fund
    
    # 安装扩展插件依赖
    for ext in feishu dingtalk wecom; do
        if [ -d "$cli_dir/extensions/$ext" ]; then
            log_info "安装 $ext 扩展依赖..."
            cd "$cli_dir/extensions/$ext"
            npm install --omit=dev --legacy-peer-deps --no-audit --no-fund 2>/dev/null || true
        fi
    done
    
    cd "$cli_dir"

    # 安装 bytenode 运行时依赖（.jsc 字节码加载需要）
    if [ -n "$(find "$cli_dir/dist" -name '*.jsc' 2>/dev/null | head -1)" ]; then
        log_info "安装 bytenode 运行时依赖（字节码加载需要）..."
        npm install bytenode --no-save --legacy-peer-deps --no-audit --no-fund 2>/dev/null || true
        if [ -d "$cli_dir/node_modules/bytenode" ]; then
            log_ok "bytenode 运行时已安装"
        else
            log_warn "bytenode 安装失败，字节码加载可能无法工作"
        fi
    fi

    # 清理不必要的文件
    find node_modules -name "*.md" -delete 2>/dev/null || true
    find node_modules -name "*.ts" -delete 2>/dev/null || true
    find node_modules -name "test" -type d -exec rm -rf {} + 2>/dev/null || true
    find node_modules -name "tests" -type d -exec rm -rf {} + 2>/dev/null || true
    find node_modules -name "__tests__" -type d -exec rm -rf {} + 2>/dev/null || true
    find node_modules -name "example" -type d -exec rm -rf {} + 2>/dev/null || true
    find node_modules -name "examples" -type d -exec rm -rf {} + 2>/dev/null || true
    
    local modules_size=$(du -sh node_modules 2>/dev/null | cut -f1)
    log_ok "依赖安装完成 (大小: $modules_size)"
}

# ============================================================================
# 构建 macOS App（如果存在）
# ============================================================================
build_macos_app() {
    log_info "检查 macOS App..."
    
    local app_dir="$PROJECT_ROOT/apps/macos"
    
    if [ ! -d "$app_dir" ]; then
        log_warn "macOS App 源码不存在，跳过"
        return
    fi
    
    # 检查是否已有构建好的 App
    if [ -d "$DIST_DIR/OpenClawCN.app" ]; then
        log_info "使用现有构建的 App"
        cp -R "$DIST_DIR/OpenClawCN.app" "$BUILD_DIR/"
        return
    fi
    
    # 调用现有的打包脚本
    if [ -f "$SCRIPT_DIR/package-mac-app.sh" ]; then
        log_info "构建 macOS App..."
        
        BUILD_ARCHS="$ARCH" \
        BUILD_CONFIG=release \
        SKIP_TSC=1 \
        SKIP_UI_BUILD=1 \
        "$SCRIPT_DIR/package-mac-app.sh"
        
        if [ -d "$DIST_DIR/OpenClawCN.app" ]; then
            cp -R "$DIST_DIR/OpenClawCN.app" "$BUILD_DIR/"
        fi
    else
        log_warn "package-mac-app.sh 不存在，跳过 App 构建"
    fi
}

# ============================================================================
# 将 CLI 嵌入 App
# ============================================================================
embed_cli_in_app() {
    log_info "将 CLI 嵌入 App..."
    
    local app_path="$BUILD_DIR/OpenClawCN.app"
    
    if [ ! -d "$app_path" ]; then
        log_warn "OpenClawCN.app 不存在，创建独立 CLI 包"
        return
    fi
    
    local resources_dir="$app_path/Contents/Resources"
    mkdir -p "$resources_dir"
    
    # 嵌入 Node.js
    if [ -d "$BUILD_DIR/node" ]; then
        cp -R "$BUILD_DIR/node" "$resources_dir/"
        log_ok "Node.js 已嵌入"
    fi
    
    # 嵌入 CLI
    if [ -d "$BUILD_DIR/openclawcn-cli" ]; then
        cp -R "$BUILD_DIR/openclawcn-cli" "$resources_dir/"
        log_ok "CLI 已嵌入"
    fi
}

# ============================================================================
# 创建离线包
# ============================================================================
create_offline_package() {
    log_info "创建离线安装包..."
    
    local package_name="OpenClawCN-offline-${ARCH}"
    local package_dir="$BUILD_DIR/$package_name"
    local output_file="$DIST_DIR/${package_name}.tar.gz"
    
    mkdir -p "$package_dir"
    
    # 复制 App 或 CLI
    if [ -d "$BUILD_DIR/OpenClawCN.app" ]; then
        cp -R "$BUILD_DIR/OpenClawCN.app" "$package_dir/"
    else
        # 没有 App，创建独立 CLI 包
        cp -R "$BUILD_DIR/openclawcn-cli" "$package_dir/"
        if [ -d "$BUILD_DIR/node" ]; then
            cp -R "$BUILD_DIR/node" "$package_dir/"
        fi
    fi
    
    # 复制安装脚本
    cp "$SCRIPT_DIR/install-mac.sh" "$package_dir/" 2>/dev/null || true
    cp "$SCRIPT_DIR/quickfix-mac.sh" "$package_dir/" 2>/dev/null || true
    cp "$SCRIPT_DIR/diagnose-mac.sh" "$package_dir/" 2>/dev/null || true
    
    # 创建 README
    cat > "$package_dir/README.txt" << EOF
OpenClawCN macOS 离线安装包
版本: $VERSION
架构: $ARCH

安装方法:
1. 将 OpenClawCN.app 拖拽到 Applications 文件夹
2. 双击打开 OpenClawCN.app
3. 如遇"无法验证开发者"提示，右键点击 → 打开

如遇问题，运行 quickfix-mac.sh 进行快速修复
或运行 diagnose-mac.sh 收集诊断信息
EOF
    
    # 打包
    cd "$BUILD_DIR"
    tar -czf "$output_file" "$package_name"
    
    # 计算大小
    local package_size=$(ls -lh "$output_file" | awk '{print $5}')
    
    log_ok "离线包已创建: $output_file ($package_size)"
}

# ============================================================================
# 清理
# ============================================================================
cleanup() {
    log_info "清理构建目录..."
    # 保留构建产物，只清理临时文件
    rm -rf "$BUILD_DIR/node" "$BUILD_DIR/openclawcn-cli"
    log_ok "清理完成"
}

# ============================================================================
# 主流程
# ============================================================================
main() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║     OpenClawCN macOS 离线包构建脚本（5 层代码保护）               ║${NC}"
    echo -e "${CYAN}║     L1:字节码 L2:混淆 L3:NativeAddon L4:Strip L5:运行时       ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    parse_args "$@"
    
    cd "$PROJECT_ROOT"
    
    get_version
    log_info "目标架构: $ARCH"
    
    prepare_build_dir
    download_node
    build_typescript
    build_ui
    build_native_addon
    package_cli
    install_dependencies
    build_macos_app
    embed_cli_in_app
    create_offline_package
    cleanup
    
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                     构建完成！                                 ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  输出文件: ${CYAN}$DIST_DIR/OpenClawCN-offline-${ARCH}.tar.gz${NC}"
    echo ""
}

main "$@"
