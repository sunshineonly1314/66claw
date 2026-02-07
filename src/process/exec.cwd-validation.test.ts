/**
 * cwd 路径验证测试 - validateCwdPath 函数
 * ClawdbotCN 专属安全修复测试
 * 
 * 测试专家 A: 正向测试 + 边界测试
 * 测试专家 B: 负向测试 + 路径遍历攻击测试
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { validateCwdPath, runCommandWithTimeout } from "./exec.js";

describe("cwd Path Validation - validateCwdPath", () => {
  const isWindows = process.platform === "win32";
  
  // ============================================
  // 测试专家 A: 正向测试 - 合法路径应该通过
  // ============================================
  describe("Expert A: Valid paths should pass", () => {
    it("allows undefined cwd", () => {
      expect(() => validateCwdPath(undefined)).not.toThrow();
    });

    it("allows user home directory", () => {
      const homeDir = os.homedir();
      expect(() => validateCwdPath(homeDir)).not.toThrow();
    });

    it("allows temp directory", () => {
      const tmpDir = os.tmpdir();
      expect(() => validateCwdPath(tmpDir)).not.toThrow();
    });

    it("allows current working directory", () => {
      const cwd = process.cwd();
      expect(() => validateCwdPath(cwd)).not.toThrow();
    });

    it("allows project directories", () => {
      // Create a test directory that should exist
      const testDir = path.join(os.tmpdir(), `cwd-test-${Date.now()}`);
      fs.mkdirSync(testDir, { recursive: true });
      try {
        expect(() => validateCwdPath(testDir)).not.toThrow();
      } finally {
        fs.rmdirSync(testDir);
      }
    });
  });

  // ============================================
  // 测试专家 B: 负向测试 - 敏感目录应该被阻止
  // ============================================
  describe("Expert B: Sensitive directories should be blocked", () => {
    if (isWindows) {
      describe("Windows system directories", () => {
        it("blocks C:\\Windows", () => {
          expect(() => validateCwdPath("C:\\Windows")).toThrow(/Blocked cwd/);
          expect(() => validateCwdPath("c:\\windows")).toThrow(/Blocked cwd/);
          expect(() => validateCwdPath("C:\\WINDOWS")).toThrow(/Blocked cwd/);
        });

        it("blocks C:\\Windows\\System32", () => {
          expect(() => validateCwdPath("C:\\Windows\\System32")).toThrow(/Blocked cwd/);
          expect(() => validateCwdPath("c:\\windows\\system32")).toThrow(/Blocked cwd/);
        });

        it("blocks C:\\Windows\\System32 subdirectories", () => {
          expect(() => validateCwdPath("C:\\Windows\\System32\\drivers")).toThrow(/Blocked cwd/);
          expect(() => validateCwdPath("C:\\Windows\\System32\\config")).toThrow(/Blocked cwd/);
        });

        it("blocks C:\\Windows\\SysWOW64", () => {
          expect(() => validateCwdPath("C:\\Windows\\SysWOW64")).toThrow(/Blocked cwd/);
          expect(() => validateCwdPath("c:\\windows\\syswow64")).toThrow(/Blocked cwd/);
        });

        it("blocks other drives Windows directories", () => {
          expect(() => validateCwdPath("D:\\Windows")).toThrow(/Blocked cwd/);
          expect(() => validateCwdPath("E:\\Windows\\System32")).toThrow(/Blocked cwd/);
        });
      });
    } else {
      describe("Unix system directories", () => {
        it("blocks /etc", () => {
          expect(() => validateCwdPath("/etc")).toThrow(/Blocked cwd/);
        });

        it("blocks /etc subdirectories", () => {
          expect(() => validateCwdPath("/etc/passwd")).toThrow(/Blocked cwd/);
          expect(() => validateCwdPath("/etc/ssh")).toThrow(/Blocked cwd/);
          expect(() => validateCwdPath("/etc/shadow")).toThrow(/Blocked cwd/);
        });

        it("blocks /root", () => {
          expect(() => validateCwdPath("/root")).toThrow(/Blocked cwd/);
          expect(() => validateCwdPath("/root/.ssh")).toThrow(/Blocked cwd/);
        });

        it("blocks /var/log", () => {
          expect(() => validateCwdPath("/var/log")).toThrow(/Blocked cwd/);
          expect(() => validateCwdPath("/var/log/syslog")).toThrow(/Blocked cwd/);
        });

        it("blocks /proc", () => {
          expect(() => validateCwdPath("/proc")).toThrow(/Blocked cwd/);
          expect(() => validateCwdPath("/proc/1")).toThrow(/Blocked cwd/);
          expect(() => validateCwdPath("/proc/self")).toThrow(/Blocked cwd/);
        });

        it("blocks /sys", () => {
          expect(() => validateCwdPath("/sys")).toThrow(/Blocked cwd/);
          expect(() => validateCwdPath("/sys/class")).toThrow(/Blocked cwd/);
        });

        it("blocks /dev", () => {
          expect(() => validateCwdPath("/dev")).toThrow(/Blocked cwd/);
          expect(() => validateCwdPath("/dev/null")).toThrow(/Blocked cwd/);
        });
      });
    }
  });

  // ============================================
  // 测试专家 B: 路径遍历攻击测试
  // ============================================
  describe("Expert B: Path traversal attacks should be blocked", () => {
    it("blocks .. traversal to system directories", () => {
      if (isWindows) {
        // Try to escape to Windows directory
        const escapePath = "C:\\Users\\..\\Windows";
        expect(() => validateCwdPath(escapePath)).toThrow(/Blocked cwd/);
      } else {
        // Try to escape to /etc
        const escapePath = "/home/../etc";
        expect(() => validateCwdPath(escapePath)).toThrow(/Blocked cwd/);
      }
    });

    it("blocks multiple .. traversal", () => {
      if (isWindows) {
        const escapePath = "C:\\Users\\test\\..\\..\\Windows\\System32";
        expect(() => validateCwdPath(escapePath)).toThrow(/Blocked cwd/);
      } else {
        const escapePath = "/home/user/../../etc";
        expect(() => validateCwdPath(escapePath)).toThrow(/Blocked cwd/);
      }
    });

    it("normalizes paths before checking", () => {
      // The function uses path.resolve which normalizes the path
      if (isWindows) {
        // Normalized: C:\Windows
        expect(() => validateCwdPath("C:\\Users\\..\\Windows")).toThrow(/Blocked cwd/);
      } else {
        // Normalized: /etc
        expect(() => validateCwdPath("/home/../etc")).toThrow(/Blocked cwd/);
      }
    });
  });

  // ============================================
  // 测试专家 A: baseDir 限制测试
  // ============================================
  describe("Expert A: baseDir restriction", () => {
    it("allows paths within baseDir", () => {
      const baseDir = os.tmpdir();
      const testDir = path.join(baseDir, `test-${Date.now()}`);
      fs.mkdirSync(testDir, { recursive: true });
      try {
        expect(() => validateCwdPath(testDir, baseDir)).not.toThrow();
      } finally {
        fs.rmdirSync(testDir);
      }
    });

    it("blocks paths outside baseDir", () => {
      const baseDir = path.join(os.tmpdir(), "restricted");
      fs.mkdirSync(baseDir, { recursive: true });
      try {
        const outsidePath = os.homedir();
        expect(() => validateCwdPath(outsidePath, baseDir)).toThrow(/path traversal/);
      } finally {
        fs.rmdirSync(baseDir);
      }
    });

    it("blocks traversal attempts from baseDir", () => {
      const baseDir = path.join(os.tmpdir(), "restricted2");
      fs.mkdirSync(baseDir, { recursive: true });
      try {
        const traversalPath = path.join(baseDir, "..", "escape");
        expect(() => validateCwdPath(traversalPath, baseDir)).toThrow(/path traversal/);
      } finally {
        fs.rmdirSync(baseDir);
      }
    });
  });

  // ============================================
  // 测试专家 A: 目录存在性检查
  // ============================================
  describe("Expert A: Directory existence check", () => {
    it("throws for non-existent directories", () => {
      const nonExistentDir = path.join(os.tmpdir(), `non-existent-${Date.now()}-${Math.random()}`);
      expect(() => validateCwdPath(nonExistentDir)).toThrow(/does not exist/);
    });

    it("throws for files (not directories)", () => {
      const testFile = path.join(os.tmpdir(), `test-file-${Date.now()}.txt`);
      fs.writeFileSync(testFile, "test");
      try {
        expect(() => validateCwdPath(testFile)).toThrow(/not a directory/);
      } finally {
        fs.unlinkSync(testFile);
      }
    });
  });
});

// ============================================
// 测试专家 A+B: runCommandWithTimeout 集成测试
// ============================================
describe("runCommandWithTimeout with cwd validation", () => {
  const isWindows = process.platform === "win32";

  it("validates cwd by default", async () => {
    const cmd = isWindows ? ["cmd", "/c", "echo", "test"] : ["echo", "test"];
    
    // Should throw for system directory
    await expect(
      runCommandWithTimeout(cmd, {
        timeoutMs: 5000,
        cwd: isWindows ? "C:\\Windows" : "/etc",
      })
    ).rejects.toThrow(/Blocked cwd/);
  });

  it("allows skipCwdValidation for trusted calls", async () => {
    // This test verifies the option exists and is respected
    // We use a valid directory to avoid file system errors
    const cmd = isWindows 
      ? ["cmd", "/c", "echo", "test"]
      : ["echo", "test"];
    
    const result = await runCommandWithTimeout(cmd, {
      timeoutMs: 5000,
      cwd: process.cwd(),
      skipCwdValidation: true, // Should skip validation
    });
    
    expect(result.code).toBe(0);
  });

  it("respects cwdBaseDir restriction", async () => {
    const baseDir = os.tmpdir();
    const cmd = isWindows ? ["cmd", "/c", "cd"] : ["pwd"];
    
    // Path outside baseDir should fail
    await expect(
      runCommandWithTimeout(cmd, {
        timeoutMs: 5000,
        cwd: os.homedir(),
        cwdBaseDir: path.join(os.tmpdir(), "nonexistent-base"),
      })
    ).rejects.toThrow(/path traversal/);
  });
});
