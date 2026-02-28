import { describe, it, expect, afterEach } from "vitest";
import { MessageDedup } from "./dedup.js";

describe("MessageDedup", () => {
  let dedup: MessageDedup;

  afterEach(() => {
    dedup?.stop();
  });

  it("should accept a new message and reject duplicates", () => {
    dedup = new MessageDedup();
    expect(dedup.tryRecord("msg1")).toBe(true);
    expect(dedup.tryRecord("msg1")).toBe(false);
    expect(dedup.tryRecord("msg2")).toBe(true);
  });

  it("should support scoped dedup", () => {
    dedup = new MessageDedup();
    expect(dedup.tryRecord("msg1", "chatA")).toBe(true);
    expect(dedup.tryRecord("msg1", "chatB")).toBe(true); // different scope
    expect(dedup.tryRecord("msg1", "chatA")).toBe(false); // same scope
  });

  it("should evict oldest entries when max size is reached", () => {
    dedup = new MessageDedup({ maxSize: 4 });
    dedup.tryRecord("a");
    dedup.tryRecord("b");
    dedup.tryRecord("c");
    dedup.tryRecord("d");
    expect(dedup.size).toBe(4);

    // Adding 5th entry should trigger eviction (25% = 1 entry)
    dedup.tryRecord("e");
    expect(dedup.size).toBeLessThanOrEqual(4);

    // The oldest entry "a" should have been evicted, so it's new again
    expect(dedup.tryRecord("a")).toBe(true);
  });

  it("should clear all records", () => {
    dedup = new MessageDedup();
    dedup.tryRecord("msg1");
    dedup.tryRecord("msg2");
    expect(dedup.size).toBe(2);

    dedup.clear();
    expect(dedup.size).toBe(0);
    expect(dedup.tryRecord("msg1")).toBe(true); // no longer a duplicate
  });

  it("should start and stop cleanup timer without errors", () => {
    dedup = new MessageDedup({ cleanupIntervalMs: 100 });
    dedup.start();
    dedup.start(); // idempotent
    dedup.stop();
    dedup.stop(); // idempotent
  });
});
