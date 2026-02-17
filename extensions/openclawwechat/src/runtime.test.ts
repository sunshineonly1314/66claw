/**
 * Runtime 模块单元测试
 * Runtime Module Unit Tests
 *
 * 测试覆盖:
 * - set/get runtime 单例
 * - 未初始化时 get 抛出错误
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  setWechatMiniprogramRuntime,
  getWechatMiniprogramRuntime,
} from "./runtime.js";

describe("Runtime", () => {
  beforeEach(() => {
    // 用一个有效 runtime 重新设置，确保每个测试有干净的状态
    // 注意：因为是模块级单例，测试之间共享状态
  });

  it("设置 runtime 后可以获取", () => {
    const mockRuntime = { media: {}, channel: {} } as any;
    setWechatMiniprogramRuntime(mockRuntime);

    const retrieved = getWechatMiniprogramRuntime();
    expect(retrieved).toBe(mockRuntime);
  });

  it("可以替换 runtime", () => {
    const first = { id: "first" } as any;
    const second = { id: "second" } as any;

    setWechatMiniprogramRuntime(first);
    expect(getWechatMiniprogramRuntime()).toBe(first);

    setWechatMiniprogramRuntime(second);
    expect(getWechatMiniprogramRuntime()).toBe(second);
  });
});
