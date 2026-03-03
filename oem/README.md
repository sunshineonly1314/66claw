# OEM Brand Assets

OEM 客户自定义品牌资源目录。外销构建（`VITE_EDITION=overseas`）时，构建脚本会用此目录下的资源覆盖默认品牌资源。

## 目录结构

```
oem/
├── README.md                  ← 本文件
├── ui/                        ← Web UI 品牌资源（Chat 页面）
│   ├── logo.png               ← 顶栏横向品牌标（24×24px 起，建议 48×48px @2x）
│   └── favicon.ico            ← 浏览器标签页图标（建议 32×32 / 64×64 多尺寸 ico）
│
├── desktop/                   ← 桌面应用品牌资源（Tauri）
│   ├── icons/
│   │   ├── icon.png           ← 通用应用图标（建议 512×512px）
│   │   ├── icon.ico           ← Windows 应用图标 + 安装器图标（多尺寸 ico）
│   │   ├── icon.icns          ← macOS 应用图标
│   │   ├── 32x32.png          ← 32×32 系统托盘/任务栏图标
│   │   ├── 128x128.png        ← 128×128 系统图标
│   │   └── 128x128@2x.png     ← 256×256 高分屏图标
│   └── assets/
│       ├── setup-logo.png     ← 安装向导页面 logo（建议 200×200px）
│       └── dmg-background.png ← macOS DMG 安装器背景（建议 660×400px）
│
└── android/                   ← Android 应用图标
    ├── ic_launcher.png        ← 标准启动图标（512×512px，脚本自动生成多尺寸）
    └── ic_launcher_foreground.png ← 自适应图标前景层（512×512px）
```

## 使用方式

### 1. 放置资源

将 OEM 客户的品牌图片放入对应目录。**至少提供以下文件**：

| 文件 | 用途 | 必需 |
|------|------|------|
| `oem/ui/logo.png` | Chat 页面顶栏品牌标 | 是 |
| `oem/ui/favicon.ico` | 浏览器标签页图标 | 是 |
| `oem/desktop/icons/icon.png` | 桌面应用图标 | 桌面版必需 |
| `oem/desktop/icons/icon.ico` | Windows 应用图标 | Windows 必需 |
| `oem/desktop/assets/setup-logo.png` | 安装向导 logo | 推荐 |

### 2. 修改品牌文案

编辑 `ui/src/ui/brand.ts` 中的 `overseasBrand` 对象：

```typescript
const overseasBrand: BrandConfig = {
  productName: "Your Product Name",
  windowTitle: "Your Product Console",
  // ... 其他字段
};
```

### 3. 构建

```bash
# Linux / macOS
VITE_EDITION=overseas pnpm build

# Windows PowerShell
$env:VITE_EDITION="overseas"; pnpm build
```

构建脚本会自动：
1. 将 `oem/ui/*` 覆盖到 `ui/public/`（Vite 静态资源）
2. 将 `oem/desktop/icons/*` 覆盖到 `apps/desktop/src-tauri/icons/`
3. 将 `oem/desktop/assets/*` 覆盖到 `apps/desktop/src-tauri/resources/assets/`
4. 运行 `strip-brand-html.ts` 清理残留品牌文本

## 各资源显示位置说明

### `oem/ui/logo.png` — Chat 页面顶栏横向品牌标

显示在 Chat 页面左上角的水平导航栏中，紧挨产品名称文字。

```
┌──────────────────────────────────────────────┐
│ [logo.png] ProductName  tagline    ...       │  ← 顶栏
├──────────────────────────────────────────────┤
│ │ Sidebar │          Chat Area          │    │
│ │         │                             │    │
```

- 渲染尺寸：24×24px（CSS 控制）
- 建议提供 48×48px @2x 版本以适配高分屏

### `oem/ui/favicon.ico` — 浏览器标签页图标

显示在浏览器标签页和地址栏左侧。建议使用多尺寸 ICO（16×16 + 32×32 + 64×64）。

### `oem/desktop/icons/` — 桌面应用图标

显示在操作系统的任务栏、Dock、桌面快捷方式、安装器对话框等位置。

### `oem/desktop/assets/setup-logo.png` — 安装向导 logo

显示在安装向导页面（Setup Wizard）的顶部导航栏中，首次启动时展示。
此文件会被重命名为内部哈希文件名（`60ad649637d6797ad09120d309408d4c.png`）。

### `oem/desktop/assets/dmg-background.png` — macOS DMG 背景

macOS 分发用的磁盘镜像（.dmg）打开后的背景图。
