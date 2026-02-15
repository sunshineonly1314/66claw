import { describe, expect, it, beforeEach } from "vitest";
import {
  detectModalityIntent,
  looksLikeCodeTask,
  getCapabilityMatrix,
  routeByModality,
  getBuiltinProfilesForTests,
} from "./modality-router.js";
import { resetProviderHealthForTests, recordProviderFailure } from "./provider-health.js";
import type { MediaAttachment } from "../media-understanding/types.js";

beforeEach(() => {
  resetProviderHealthForTests();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function att(opts: Partial<MediaAttachment> & { index?: number }): MediaAttachment {
  return { index: 0, ...opts };
}

const emptyCfg = {} as Parameters<typeof routeByModality>[0]["cfg"];

// ---------------------------------------------------------------------------
// detectModalityIntent — attachment priority
// ---------------------------------------------------------------------------

describe("detectModalityIntent — attachments", () => {
  it("detects video from attachment", () => {
    expect(detectModalityIntent("", [att({ path: "clip.mp4" })])).toBe("video_understand");
  });

  it("detects audio from attachment", () => {
    expect(detectModalityIntent("", [att({ path: "voice.mp3" })])).toBe("audio_understand");
  });

  it("detects image from attachment", () => {
    expect(detectModalityIntent("", [att({ path: "photo.jpg" })])).toBe("image_understand");
  });

  it("detects document from attachment", () => {
    expect(detectModalityIntent("", [att({ path: "report.pdf" })])).toBe("document_understand");
  });

  it("detects document from MIME", () => {
    expect(detectModalityIntent("", [att({ mime: "application/pdf" })])).toBe("document_understand");
  });

  it("prioritizes video over image when both present", () => {
    expect(detectModalityIntent("", [
      att({ path: "photo.jpg", index: 0 }),
      att({ path: "clip.mp4", index: 1 }),
    ])).toBe("video_understand");
  });

  it("returns text for empty attachments and text", () => {
    expect(detectModalityIntent("hello", [])).toBe("text");
  });

  it("returns text for empty everything", () => {
    expect(detectModalityIntent("", [])).toBe("text");
  });
});

// ---------------------------------------------------------------------------
// detectModalityIntent — text patterns
// ---------------------------------------------------------------------------

describe("detectModalityIntent — text patterns", () => {
  // Image generation - Chinese
  it("detects CN image gen: 画一个", () => {
    expect(detectModalityIntent("画一个可爱的猫咪", [])).toBe("image_generate");
  });

  it("detects CN image gen: 生成图片", () => {
    expect(detectModalityIntent("帮我生成一张图片", [])).toBe("image_generate");
  });

  it("detects CN image gen: 帮我画", () => {
    expect(detectModalityIntent("帮我画个头像", [])).toBe("image_generate");
  });

  // Image generation - English
  it("detects EN image gen: generate an image", () => {
    expect(detectModalityIntent("generate an image of a sunset", [])).toBe("image_generate");
  });

  it("detects EN image gen: create a picture", () => {
    expect(detectModalityIntent("create a picture of mountains", [])).toBe("image_generate");
  });

  // Video generation
  it("detects CN video gen: 生成视频", () => {
    expect(detectModalityIntent("生成一个短视频", [])).toBe("video_generate");
  });

  // Code detection - strong indicators
  it("detects code from code blocks", () => {
    expect(detectModalityIntent("请看这段代码 ```python\nprint('hello')\n```", [])).toBe("code");
  });

  it("detects code from CN explicit request", () => {
    expect(detectModalityIntent("帮我写一个函数来排序", [])).toBe("code");
  });

  it("detects code from refactor request", () => {
    expect(detectModalityIntent("implement a function to sort arrays", [])).toBe("code");
  });

  // Code detection - weak indicators (need 2+)
  it("does NOT trigger code from single weak indicator", () => {
    // "function" alone is too weak
    expect(detectModalityIntent("what is a function?", [])).toBe("text");
  });

  it("does NOT trigger code from 'bug' alone", () => {
    expect(detectModalityIntent("I found a bug in my garden", [])).toBe("text");
  });

  it("detects code from two weak indicators together", () => {
    // "function" + "error" = 2 weak indicators
    expect(detectModalityIntent("this function throws an error", [])).toBe("code");
  });

  // Plain text
  it("returns text for normal chat", () => {
    expect(detectModalityIntent("今天天气怎么样？", [])).toBe("text");
  });

  it("returns text for English chat", () => {
    expect(detectModalityIntent("How are you doing today?", [])).toBe("text");
  });
});

// ---------------------------------------------------------------------------
// looksLikeCodeTask
// ---------------------------------------------------------------------------

describe("looksLikeCodeTask", () => {
  it("returns true for code blocks", () => {
    expect(looksLikeCodeTask("```js\nconsole.log('hi')\n```")).toBe(true);
  });

  it("returns true for explicit CN code request", () => {
    expect(looksLikeCodeTask("帮我写一段代码")).toBe(true);
  });

  it("returns false for generic text", () => {
    expect(looksLikeCodeTask("告诉我今天的新闻")).toBe(false);
  });

  it("returns false for single common word", () => {
    expect(looksLikeCodeTask("I need to import goods from China")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getCapabilityMatrix
// ---------------------------------------------------------------------------

describe("getCapabilityMatrix", () => {
  it("returns builtin profiles with empty config", () => {
    const matrix = getCapabilityMatrix(emptyCfg);
    expect(matrix.length).toBeGreaterThan(10);
  });

  it("overrides builtin profile when user config matches", () => {
    const cfg = {
      dispatch: {
        modelProfiles: [
          {
            provider: "deepseek",
            model: "deepseek-chat",
            capabilities: { text: 5, code: 5, vision: 3 },
            costPer1M: 0.5,
            region: "domestic" as const,
          },
        ],
      },
    } as unknown as Parameters<typeof getCapabilityMatrix>[0];

    const matrix = getCapabilityMatrix(cfg);
    const ds = matrix.find((p) => p.provider === "deepseek" && p.model === "deepseek-chat");
    expect(ds).toBeDefined();
    expect(ds!.capabilities.vision).toBe(3); // Overridden
    expect(ds!.costPer1M).toBe(0.5);        // Overridden
  });

  it("appends new user profiles not in builtin", () => {
    const cfg = {
      dispatch: {
        modelProfiles: [
          {
            provider: "custom",
            model: "my-model",
            capabilities: { text: 3 },
            costPer1M: 1.0,
            region: "domestic" as const,
          },
        ],
      },
    } as unknown as Parameters<typeof getCapabilityMatrix>[0];

    const matrix = getCapabilityMatrix(cfg);
    const custom = matrix.find((p) => p.provider === "custom" && p.model === "my-model");
    expect(custom).toBeDefined();
    expect(custom!.capabilities.text).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// routeByModality — integration
// ---------------------------------------------------------------------------

describe("routeByModality", () => {
  it("returns null for plain text (no switch needed)", async () => {
    const result = await routeByModality({
      body: "你好",
      attachments: [],
      cfg: emptyCfg,
      currentModel: { provider: "deepseek", model: "deepseek-chat" },
    });
    expect(result).toBeNull();
  });

  it("returns null if current model already supports the modality well", async () => {
    // gpt-4o has vision:5 — already excellent
    const result = await routeByModality({
      body: "",
      attachments: [att({ path: "photo.png" })],
      cfg: emptyCfg,
      currentModel: { provider: "openai", model: "gpt-4o" },
    });
    expect(result).toBeNull();
  });

  it("switches when current model lacks the required capability", async () => {
    // deepseek-chat has no vision capability — should switch
    const result = await routeByModality({
      body: "描述这张图片",
      attachments: [att({ path: "photo.jpg" })],
      cfg: emptyCfg,
      currentModel: { provider: "deepseek", model: "deepseek-chat" },
    });
    expect(result).not.toBeNull();
    expect(result!.switched).toBe(true);
    expect(result!.modalityIntent).toBe("image_understand");
    // Should select a model with vision capability
    const profiles = getBuiltinProfilesForTests();
    const selected = profiles.find(
      (p) => p.provider === result!.provider && p.model === result!.model,
    );
    expect(selected).toBeDefined();
    expect(selected!.capabilities.vision).toBeGreaterThan(0);
  });

  it("skips down providers", async () => {
    // Mark openai as down
    recordProviderFailure("openai");
    recordProviderFailure("openai");
    recordProviderFailure("openai");

    const result = await routeByModality({
      body: "",
      attachments: [att({ path: "voice.mp3" })],
      cfg: emptyCfg,
      currentModel: { provider: "deepseek", model: "deepseek-chat" },
    });

    // Should NOT select openai since it's down
    if (result) {
      expect(result.provider).not.toBe("openai");
    }
  });

  it("returns null for document attachment (text model is fine)", async () => {
    const result = await routeByModality({
      body: "分析这份报告",
      attachments: [att({ path: "report.pdf", mime: "application/pdf" })],
      cfg: emptyCfg,
      currentModel: { provider: "deepseek", model: "deepseek-chat" },
    });
    expect(result).toBeNull();
  });

  it("returns fallback models", async () => {
    const result = await routeByModality({
      body: "",
      attachments: [att({ path: "clip.mp4" })],
      cfg: emptyCfg,
      currentModel: { provider: "deepseek", model: "deepseek-chat" },
    });
    expect(result).not.toBeNull();
    expect(result!.fallbacks).toBeDefined();
    expect(Array.isArray(result!.fallbacks)).toBe(true);
  });
});
