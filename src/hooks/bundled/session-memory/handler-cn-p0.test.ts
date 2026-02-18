/**
 * [CN-PATCH:memory-p0] handler.ts — /reset 触发条件专项测试
 *
 * 原测试 handler.test.ts 只覆盖 /new，此文件补充 /reset 触发的测试
 */

import fs from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { OpenClawCNConfig } from "../../../config/config.js";
import type { HookHandler } from "../../hooks.js";
import { makeTempWorkspace, writeWorkspaceFile } from "../../../test-helpers/workspace.js";
import { createHookEvent } from "../../hooks.js";

vi.mock("../../llm-slug-generator.js", () => ({
  generateSlugViaLLM: vi.fn().mockResolvedValue("reset-session"),
}));

let handler: HookHandler;

beforeAll(async () => {
  ({ default: handler } = await import("./handler.js"));
});

function createMockSessionContent(entries: Array<{ role: string; content: string }>): string {
  return entries
    .map((entry) =>
      JSON.stringify({
        type: "message",
        message: { role: entry.role, content: entry.content },
      }),
    )
    .join("\n");
}

// ============================================================================
// /reset 触发测试
// ============================================================================

describe("session-memory hook — /reset 触发 [CN-PATCH:memory-p0]", () => {
  it("/reset 命令触发内存文件创建", async () => {
    const tempDir = await makeTempWorkspace("openclawcn-session-memory-");
    const sessionsDir = path.join(tempDir, "sessions");
    await fs.mkdir(sessionsDir, { recursive: true });

    const sessionContent = createMockSessionContent([
      { role: "user", content: "请重置会话" },
      { role: "assistant", content: "好的，正在重置" },
    ]);
    const sessionFile = await writeWorkspaceFile({
      dir: sessionsDir,
      name: "test-session.jsonl",
      content: sessionContent,
    });

    const cfg: OpenClawCNConfig = {
      agents: { defaults: { workspace: tempDir } },
    };

    const event = createHookEvent("command", "reset", "agent:main:main", {
      cfg,
      previousSessionEntry: {
        sessionId: "test-reset-123",
        sessionFile,
      },
    });

    await handler(event);

    const memoryDir = path.join(tempDir, "memory");
    const files = await fs.readdir(memoryDir);
    expect(files.length).toBe(1);

    const memoryContent = await fs.readFile(path.join(memoryDir, files[0]), "utf-8");
    expect(memoryContent).toContain("user: 请重置会话");
    expect(memoryContent).toContain("assistant: 好的，正在重置");
  });

  it("/reset 和 /new 生成的内存文件格式一致", async () => {
    // /new
    const tempDir1 = await makeTempWorkspace("openclawcn-session-memory-new-");
    const sessionsDir1 = path.join(tempDir1, "sessions");
    await fs.mkdir(sessionsDir1, { recursive: true });
    const sessionContent = createMockSessionContent([{ role: "user", content: "测试消息" }]);
    const sessionFile1 = await writeWorkspaceFile({
      dir: sessionsDir1,
      name: "test-session.jsonl",
      content: sessionContent,
    });
    const cfg1: OpenClawCNConfig = {
      agents: { defaults: { workspace: tempDir1 } },
    };
    const event1 = createHookEvent("command", "new", "agent:main:main", {
      cfg: cfg1,
      previousSessionEntry: { sessionId: "new-123", sessionFile: sessionFile1 },
    });
    await handler(event1);

    // /reset
    const tempDir2 = await makeTempWorkspace("openclawcn-session-memory-reset-");
    const sessionsDir2 = path.join(tempDir2, "sessions");
    await fs.mkdir(sessionsDir2, { recursive: true });
    const sessionFile2 = await writeWorkspaceFile({
      dir: sessionsDir2,
      name: "test-session.jsonl",
      content: sessionContent,
    });
    const cfg2: OpenClawCNConfig = {
      agents: { defaults: { workspace: tempDir2 } },
    };
    const event2 = createHookEvent("command", "reset", "agent:main:main", {
      cfg: cfg2,
      previousSessionEntry: { sessionId: "reset-123", sessionFile: sessionFile2 },
    });
    await handler(event2);

    // 比较格式
    const memFiles1 = await fs.readdir(path.join(tempDir1, "memory"));
    const memFiles2 = await fs.readdir(path.join(tempDir2, "memory"));
    const content1 = await fs.readFile(path.join(tempDir1, "memory", memFiles1[0]), "utf-8");
    const content2 = await fs.readFile(path.join(tempDir2, "memory", memFiles2[0]), "utf-8");

    // 两者都应该包含相同的会话内容
    expect(content1).toContain("user: 测试消息");
    expect(content2).toContain("user: 测试消息");
    // 两者都有相同的 Markdown 结构
    expect(content1).toContain("# Session:");
    expect(content2).toContain("# Session:");
    expect(content1).toContain("## Conversation Summary");
    expect(content2).toContain("## Conversation Summary");
  });

  it("其他命令不触发（/help, /status 等）", async () => {
    const tempDir = await makeTempWorkspace("openclawcn-session-memory-");

    for (const cmd of ["help", "status", "config", "memory", "exit"]) {
      const event = createHookEvent("command", cmd, "agent:main:main", {
        workspaceDir: tempDir,
      });
      await handler(event);
    }

    const memoryDir = path.join(tempDir, "memory");
    await expect(fs.access(memoryDir)).rejects.toThrow();
  });

  it("非 command 事件类型不触发", async () => {
    const tempDir = await makeTempWorkspace("openclawcn-session-memory-");

    for (const type of ["agent", "session", "tool", "system"]) {
      const event = createHookEvent(type as any, "reset", "agent:main:main", {
        workspaceDir: tempDir,
      });
      await handler(event);
    }

    const memoryDir = path.join(tempDir, "memory");
    await expect(fs.access(memoryDir)).rejects.toThrow();
  });
});

// ============================================================================
// 中文内容处理测试
// ============================================================================

describe("session-memory hook — 中文内容 [CN-PATCH:memory-p0]", () => {
  it("中文会话内容正确保存到内存文件", async () => {
    const tempDir = await makeTempWorkspace("openclawcn-session-memory-");
    const sessionsDir = path.join(tempDir, "sessions");
    await fs.mkdir(sessionsDir, { recursive: true });

    const sessionContent = createMockSessionContent([
      { role: "user", content: "请帮我优化这段代码的性能" },
      { role: "assistant", content: "好的，我来分析一下性能瓶颈" },
      { role: "user", content: "能否使用缓存策略？" },
      { role: "assistant", content: "可以使用 LRU 缓存来优化热点数据访问" },
    ]);
    const sessionFile = await writeWorkspaceFile({
      dir: sessionsDir,
      name: "test-session.jsonl",
      content: sessionContent,
    });

    const cfg: OpenClawCNConfig = {
      agents: { defaults: { workspace: tempDir } },
    };

    const event = createHookEvent("command", "new", "agent:main:main", {
      cfg,
      previousSessionEntry: { sessionId: "cn-123", sessionFile },
    });

    await handler(event);

    const memoryDir = path.join(tempDir, "memory");
    const files = await fs.readdir(memoryDir);
    const memoryContent = await fs.readFile(path.join(memoryDir, files[0]), "utf-8");

    expect(memoryContent).toContain("请帮我优化这段代码的性能");
    expect(memoryContent).toContain("LRU 缓存");
    expect(memoryContent).toContain("性能瓶颈");
  });

  it("包含 emoji 和特殊 Unicode 字符的内容正确保存", async () => {
    const tempDir = await makeTempWorkspace("openclawcn-session-memory-");
    const sessionsDir = path.join(tempDir, "sessions");
    await fs.mkdir(sessionsDir, { recursive: true });

    const sessionContent = createMockSessionContent([
      { role: "user", content: "这个方案怎么样？🤔" },
      { role: "assistant", content: "看起来不错！👍 我来详细分析一下" },
    ]);
    const sessionFile = await writeWorkspaceFile({
      dir: sessionsDir,
      name: "test-session.jsonl",
      content: sessionContent,
    });

    const cfg: OpenClawCNConfig = {
      agents: { defaults: { workspace: tempDir } },
    };

    const event = createHookEvent("command", "new", "agent:main:main", {
      cfg,
      previousSessionEntry: { sessionId: "emoji-123", sessionFile },
    });

    await handler(event);

    const memoryDir = path.join(tempDir, "memory");
    const files = await fs.readdir(memoryDir);
    const memoryContent = await fs.readFile(path.join(memoryDir, files[0]), "utf-8");

    expect(memoryContent).toContain("🤔");
    expect(memoryContent).toContain("👍");
  });
});
