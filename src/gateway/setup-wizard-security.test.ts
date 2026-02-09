/**
 * Setup Wizard 安全配置测试
 *
 * 测试覆盖：
 * 1. 安全模式配置验证
 * 2. safeBins 白名单完整性
 * 3. 配置合理性检查
 */

import { describe, it, expect } from "vitest";
import { CN_DEFAULT_SECURITY_CONFIG } from "../config/region-cn.js";

// ============================================================================
// 1. safeBins 白名单测试
// ============================================================================

describe("safeBins 白名单配置", () => {
  const safeBins = CN_DEFAULT_SECURITY_CONFIG.tools.exec.allowlist;

  describe("Windows 命令覆盖", () => {
    it("应该包含 Windows 系统命令", () => {
      const windowsCommands = ["notepad", "explorer", "calc", "mspaint"];
      for (const cmd of windowsCommands) {
        expect(safeBins).toContain(cmd);
      }
    });

    it("应该包含 VS Code", () => {
      expect(safeBins).toContain("code");
    });
  });

  describe("开发工具覆盖", () => {
    it("应该包含 Python", () => {
      expect(safeBins.some((cmd) => cmd.includes("python"))).toBe(true);
    });

    it("应该包含 Node.js 工具", () => {
      expect(safeBins).toContain("node");
      expect(safeBins).toContain("npm");
      expect(safeBins).toContain("pnpm");
    });

    it("应该包含 Git", () => {
      expect(safeBins).toContain("git");
    });
  });

  describe("潜在遗漏检查", () => {
    it("应该检查是否缺少常用命令", () => {
      // 这些命令可能需要添加
      const potentialMissing = [
        "pip", // Python 包管理器
        "pip3",
        "yarn", // 另一个 JS 包管理器
        "java", // Java
        "javac",
        "mvn", // Maven
        "gradle", // Gradle
        "cargo", // Rust
        "go", // Go
        "dotnet", // .NET
        "docker", // Docker
        "kubectl", // Kubernetes
        "ssh", // SSH
        "scp", // SCP
        "rsync", // rsync
        "tar", // 压缩
        "unzip", // 解压
        "zip",
      ];

      const missing = potentialMissing.filter((cmd) => !safeBins.includes(cmd));

      // 记录缺失的命令（不强制失败，只是提醒）
      if (missing.length > 0) {
        console.log("可能需要添加的常用命令:", missing);
      }

      // 至少应该有 10 个常用命令
      expect(safeBins.length).toBeGreaterThan(10);
    });
  });
});

// ============================================================================
// 2. 安全配置合理性测试
// ============================================================================

describe("安全配置合理性", () => {
  it("sandbox mode 应该是 off（不使用沙箱，最大能力释放）", () => {
    expect(CN_DEFAULT_SECURITY_CONFIG.sandbox.mode).toBe("off");
  });

  it("sandbox scope 应该是 agent（按 agent 隔离）", () => {
    expect(CN_DEFAULT_SECURITY_CONFIG.sandbox.scope).toBe("agent");
  });

  it("workspaceAccess 应该是 rw（读写）", () => {
    expect(CN_DEFAULT_SECURITY_CONFIG.sandbox.workspaceAccess).toBe("rw");
  });

  it("allowDelete 应该默认禁用", () => {
    expect(CN_DEFAULT_SECURITY_CONFIG.tools.write.allowDelete).toBe(false);
  });

  it("exec security 应该是 full 模式（最大能力释放）", () => {
    expect(CN_DEFAULT_SECURITY_CONFIG.tools.exec.security).toBe("full");
  });

  it("exec ask 应该是 off（不询问，直接执行）", () => {
    expect(CN_DEFAULT_SECURITY_CONFIG.tools.exec.ask).toBe("off");
  });

  it("browser allowHostBrowser 应该为 true（允许使用宿主浏览器）", () => {
    expect(CN_DEFAULT_SECURITY_CONFIG.tools.browser.allowHostBrowser).toBe(true);
  });
});

// ============================================================================
// 3. 安全风险检查
// ============================================================================

describe("安全风险检查", () => {
  const safeBins = CN_DEFAULT_SECURITY_CONFIG.tools.exec.allowlist;

  it("不应该包含危险的 shell 命令", () => {
    const dangerousCommands = [
      "rm", // 删除文件（危险）
      "rmdir", // 删除目录
      "del", // Windows 删除
      "format", // 格式化
      "fdisk", // 分区
      "sudo", // 提权
      "su", // 切换用户
      "chown", // 修改所有者
      "shutdown", // 关机
      "reboot", // 重启
      "kill", // 杀进程
      "pkill",
      "killall",
    ];

    for (const cmd of dangerousCommands) {
      expect(safeBins).not.toContain(cmd);
    }
  });

  it("不应该包含网络攻击工具", () => {
    const networkTools = [
      "nmap", // 端口扫描
      "netcat",
      "nc",
      "telnet",
      "ftp",
      "tftp",
    ];

    for (const cmd of networkTools) {
      expect(safeBins).not.toContain(cmd);
    }
  });

  it("allowlist 中的命令不应该有路径分隔符", () => {
    const hasPath = safeBins.filter((cmd) => cmd.includes("/") || cmd.includes("\\"));
    expect(hasPath).toEqual([]);
  });

  it("allowlist 中的命令不应该有空格", () => {
    const hasSpace = safeBins.filter((cmd) => cmd.includes(" "));
    expect(hasSpace).toEqual([]);
  });

  it("allowlist 中不应该有重复项", () => {
    const uniqueBins = [...new Set(safeBins)];
    expect(safeBins.length).toBe(uniqueBins.length);
  });
});

// ============================================================================
// 4. 配置完整性测试
// ============================================================================

describe("配置完整性", () => {
  it("CN_DEFAULT_SECURITY_CONFIG 应该有所有必需字段", () => {
    expect(CN_DEFAULT_SECURITY_CONFIG).toHaveProperty("sandbox");
    expect(CN_DEFAULT_SECURITY_CONFIG).toHaveProperty("sandbox.mode");
    expect(CN_DEFAULT_SECURITY_CONFIG).toHaveProperty("sandbox.scope");
    expect(CN_DEFAULT_SECURITY_CONFIG).toHaveProperty("sandbox.workspaceAccess");

    expect(CN_DEFAULT_SECURITY_CONFIG).toHaveProperty("tools");
    expect(CN_DEFAULT_SECURITY_CONFIG).toHaveProperty("tools.write");
    expect(CN_DEFAULT_SECURITY_CONFIG).toHaveProperty("tools.write.allowDelete");
    expect(CN_DEFAULT_SECURITY_CONFIG).toHaveProperty("tools.exec");
    expect(CN_DEFAULT_SECURITY_CONFIG).toHaveProperty("tools.exec.security");
    expect(CN_DEFAULT_SECURITY_CONFIG).toHaveProperty("tools.exec.allowlist");
    expect(CN_DEFAULT_SECURITY_CONFIG).toHaveProperty("tools.browser");
    expect(CN_DEFAULT_SECURITY_CONFIG).toHaveProperty("tools.browser.profile");
    expect(CN_DEFAULT_SECURITY_CONFIG).toHaveProperty("tools.browser.allowHostBrowser");
  });

  it("allowlist 应该是数组", () => {
    expect(Array.isArray(CN_DEFAULT_SECURITY_CONFIG.tools.exec.allowlist)).toBe(true);
  });

  it("所有 allowlist 项应该是字符串", () => {
    for (const cmd of CN_DEFAULT_SECURITY_CONFIG.tools.exec.allowlist) {
      expect(typeof cmd).toBe("string");
    }
  });
});
