# Linux 打包脚本

本目录包含 Clawdbot Linux 版本的打包脚本。

## 脚本说明

| 脚本 | 说明 | 输出 |
|------|------|------|
| `build-standalone.sh` | 独立版（包含 Node.js） | `clawdbot-linux-{arch}-standalone.tar.gz` |
| `build-portable.sh` | 便携版（需用户安装 Node） | `clawdbot-linux-portable.tar.gz` |

## 使用方法

### 构建独立版（推荐给小白用户）

```bash
# 当前架构
./build-standalone.sh

# 指定架构
./build-standalone.sh --arch x64
./build-standalone.sh --arch arm64

# 指定 Node.js 版本
./build-standalone.sh --node-version 22.13.1
```

### 构建便携版

```bash
./build-portable.sh
```

## 前置条件

1. 已安装 Node.js 22+
2. 已运行 `pnpm build` 生成 `dist/` 目录

## 输出目录

```
build/
├── linux/
│   ├── clawdbot-portable/
│   └── clawdbot-linux-portable.tar.gz
└── linux-standalone/
    ├── clawdbot/
    └── clawdbot-linux-x64-standalone.tar.gz
```

## 包大小参考

| 版本 | 大小 (解压后) | 大小 (压缩后) |
|------|---------------|---------------|
| 独立版 (x64) | ~200MB | ~80MB |
| 便携版 | ~50MB | ~20MB |
