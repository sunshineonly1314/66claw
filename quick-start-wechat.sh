#!/bin/bash
###############################################################################
# 微信自动化客服快速启动脚本
#
# 使用方法:
#   chmod +x quick-start-wechat.sh
#   ./quick-start-wechat.sh
###############################################################################

set -e

echo "================================================================================"
echo "🚀 微信自动化客服快速启动"
echo "================================================================================"
echo

# 检查 Node.js 环境
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未安装 Node.js"
    echo "   请访问 https://nodejs.org/ 下载安装"
    exit 1
fi

NODE_VERSION=$(node --version)
echo "✅ Node.js: $NODE_VERSION"
echo

# 检查配置目录
CONFIG_DIR="$HOME/.openclawcn"
CONFIG_FILE="$CONFIG_DIR/config.json5"

if [ ! -d "$CONFIG_DIR" ]; then
    echo "📁 创建配置目录: $CONFIG_DIR"
    mkdir -p "$CONFIG_DIR"
fi

# 检查配置文件
if [ ! -f "$CONFIG_FILE" ]; then
    echo "📝 配置文件不存在，使用模板创建..."

    if [ -f "test-wechat-safe.json5" ]; then
        cp test-wechat-safe.json5 "$CONFIG_FILE"
        echo "✅ 配置文件已创建: $CONFIG_FILE"
        echo
        echo "⚠️  请编辑配置文件，填入以下信息:"
        echo "   1. ClawChat API Key (从 ClawChat 小程序获取)"
        echo "   2. 通义千问 API Key (从 DashScope 获取)"
        echo
        echo "   编辑命令: nano $CONFIG_FILE"
        echo
        read -p "按回车键继续编辑配置文件..."

        if command -v nano &> /dev/null; then
            nano "$CONFIG_FILE"
        elif command -v vim &> /dev/null; then
            vim "$CONFIG_FILE"
        elif command -v vi &> /dev/null; then
            vi "$CONFIG_FILE"
        else
            echo "❌ 未找到编辑器，请手动编辑: $CONFIG_FILE"
            exit 1
        fi
    else
        echo "❌ 错误: 找不到模板文件 test-wechat-safe.json5"
        exit 1
    fi
else
    echo "✅ 配置文件已存在: $CONFIG_FILE"
fi

echo
echo "================================================================================"
echo "🔍 检查配置"
echo "================================================================================"
echo

# 检查 API Key 是否配置
if grep -q "placeholder" "$CONFIG_FILE" 2>/dev/null; then
    echo "⚠️  警告: 配置文件包含占位符，请确认已填入真实 API Key"
    echo
    read -p "是否继续？(y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ 已取消启动"
        exit 1
    fi
fi

# 检查依赖
echo "📦 检查依赖..."
if [ ! -d "node_modules" ]; then
    echo "   安装依赖中..."
    npm install
fi
echo "✅ 依赖检查完成"
echo

# 运行测试
echo "================================================================================"
echo "🧪 运行防检测测试"
echo "================================================================================"
echo

if [ -f "test-wechat-anti-detection.mjs" ]; then
    node test-wechat-anti-detection.mjs
    echo
    read -p "测试通过，按回车继续启动服务..."
else
    echo "⚠️  测试文件不存在，跳过测试"
fi

echo
echo "================================================================================"
echo "🎬 启动服务"
echo "================================================================================"
echo

# 启动网关
echo "🌐 启动 OpenClawCN Gateway..."
echo "   访问地址: http://localhost:18789"
echo "   日志位置: $CONFIG_DIR/logs/gateway.log"
echo
echo "⚠️  启动后保持此终端窗口运行"
echo "   按 Ctrl+C 可以停止服务"
echo
echo "📱 现在可以用另一个微信号给你的客服号发消息测试"
echo

# 启动网关 (根据项目结构调整路径)
if [ -f "dist/gateway/server.js" ]; then
    node dist/gateway/server.js
elif [ -f "src/gateway/server.ts" ]; then
    npx tsx src/gateway/server.ts
else
    echo "❌ 错误: 找不到网关启动文件"
    echo "   请先构建项目: npm run build"
    exit 1
fi
