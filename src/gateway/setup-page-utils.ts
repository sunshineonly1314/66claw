/**
 * Setup Page Utility Functions
 * 从 setup-page.ts 提取的顶级辅助函数（不依赖 HTML 模板）
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

/** detectPlatformInfo 的返回类型 */
export interface PlatformInfo {
  os: string;
  variant: "lite" | "pro";
  sandboxType: string;
  icon: string;
  displayName: string;
}

/**
 * 获取 logo 图片的 base64 数据 URL
 */
export function getLogoBase64(): string {
  try {
    // 打包后: dist/../../assets → <installRoot>/assets
    // dev 模式: dist/../assets → <repoRoot>/assets
    const candidates = [
      path.resolve(import.meta.dirname, "../../assets"),
      path.resolve(import.meta.dirname, "../assets"),
    ];
    for (const assetsDir of candidates) {
      const logoPath = path.join(assetsDir, "60ad649637d6797ad09120d309408d4c.png");
      if (fs.existsSync(logoPath)) {
        const imageBuffer = fs.readFileSync(logoPath);
        return `data:image/png;base64,${imageBuffer.toString("base64")}`;
      }
    }
    return "";
  } catch {
    // 如果读取失败，返回空字符串，后续会使用 fallback SVG
    return "";
  }
}

/**
 * 获取 Setup 引导页二维码的 base64 数据 URL（zlq.jpg）
 */
export function getSetupQrcodeBase64(): string {
  try {
    // 打包后: dist/../../data/qrcodes → <installRoot>/data/qrcodes
    // dev 模式: dist/../data/qrcodes → <repoRoot>/data/qrcodes
    const candidates = [
      path.resolve(import.meta.dirname, "../../data/qrcodes"),
      path.resolve(import.meta.dirname, "../data/qrcodes"),
    ];
    for (const qrDir of candidates) {
      const qrPath = path.join(qrDir, "zlq.jpg");
      if (fs.existsSync(qrPath)) {
        const buf = fs.readFileSync(qrPath);
        return `data:image/jpeg;base64,${buf.toString("base64")}`;
      }
    }
    return "";
  } catch {
    return "";
  }
}

/**
 * 检测当前运行平台和版本
 */
export function detectPlatformInfo(): PlatformInfo {
  const platform = os.platform();
  // 检测是否有 Docker（Pro 版本）
  const hasDocker = process.env.OPENCLAWCN_DOCKER === "1" || process.env.DOCKER_HOST;
  const variant = hasDocker ? "pro" : "lite";

  if (platform === "darwin") {
    return {
      os: "macOS",
      variant: "lite",
      sandboxType: "软沙盒（目录隔离）",
      icon: "🍎",
      displayName: "macOS Lite 版",
    };
  } else if (platform === "win32") {
    return {
      os: "Windows",
      variant,
      sandboxType: variant === "pro" ? "Docker 容器沙盒" : "轻量沙盒",
      icon: "🪟",
      displayName: `Windows ${variant === "pro" ? "Pro" : "Lite"} 版`,
    };
  } else {
    return {
      os: "Linux",
      variant,
      sandboxType: variant === "pro" ? "Docker 容器沙盒" : "轻量沙盒",
      icon: "🐧",
      displayName: `Linux ${variant === "pro" ? "Pro" : "Lite"} 版`,
    };
  }
}

/**
 * 获取平台默认工作目录
 */
export function getDefaultWorkspace(): string {
  const platform = os.platform();
  if (platform === "win32") {
    return "D:\\OpenClawCN\\workspace";
  } else if (platform === "darwin") {
    return "~/.clawbotcn/workspace";
  } else {
    return "/opt/openclawcn/workspace";
  }
}

/**
 * 获取提供商图标
 */
export function getProviderIcon(providerId: string): string {
  const icons: Record<string, string> = {
    "aliyun-bailian": "☁️",
    siliconflow: "🔮",
    deepseek: "🔍",
    glm: "🧠",
    "volcengine-ark": "🌋",
    "tencent-hunyuan": "💫",
    minimax: "⚡",
  };
  return icons[providerId] || "🤖";
}

/**
 * 获取平台特定提示
 */
export function getPlatformTips(platformInfo: PlatformInfo): string {
  if (platformInfo.os === "macOS") {
    return `
      <li>如遇到「无法验证开发者」提示，请在终端执行：<code>xattr -cr /Applications/ClawbotCN</code></li>
      <li>工作目录位于: <code>~/.clawbotcn/workspace</code></li>
    `;
  } else if (platformInfo.os === "Windows") {
    if (platformInfo.variant === "pro") {
      return `
        <li>请确保 Docker Desktop 正在运行</li>
        <li>首次启动可能需要拉取沙盒镜像（约 80MB）</li>
        <li>工作目录位于: <code>D:\\OpenClawCN\\workspace</code></li>
      `;
    } else {
      return `
        <li>工作目录位于: <code>D:\\OpenClawCN\\workspace</code></li>
        <li>可通过开始菜单或桌面快捷方式启动</li>
      `;
    }
  } else {
    return `
      <li>启动服务: <code>sudo systemctl start openclawcn</code></li>
      <li>开机自启: <code>sudo systemctl enable openclawcn</code></li>
      <li>查看日志: <code>journalctl -u openclawcn -f</code></li>
    `;
  }
}
