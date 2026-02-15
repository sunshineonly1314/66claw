import { describe, expect, it } from "vitest";
import { OpenClawCNSchema } from "./zod-schema.js";

describe("$schema key in config (#14998)", () => {
  it("accepts config with $schema string", () => {
    const result = OpenClawCNSchema.safeParse({
      $schema: "https://openclawcn.ai/config.json",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.$schema).toBe("https://openclawcn.ai/config.json");
    }
  });

  it("accepts config without $schema", () => {
    const result = OpenClawCNSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects non-string $schema", () => {
    const result = OpenClawCNSchema.safeParse({ $schema: 123 });
    expect(result.success).toBe(false);
  });
});
