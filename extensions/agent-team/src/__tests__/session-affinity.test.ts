import { describe, expect, it, beforeEach } from "vitest";
import {
  getAffinity,
  setAffinity,
  clearAffinity,
  clearProjectAffinities,
  isAffinityExpired,
  resolveAffinityAgent,
  purgeExpiredAffinities,
  getAllAffinities,
  resetAllAffinities,
} from "../session-affinity.js";
import type { SessionAffinityRecord } from "../types.js";

beforeEach(() => {
  resetAllAffinities();
});

describe("session-affinity", () => {
  describe("setAffinity + getAffinity", () => {
    it("roundtrips affinity data", () => {
      setAffinity("proj-1", "peer-a", "weather");

      const record = getAffinity("proj-1", "peer-a");
      expect(record).not.toBeNull();
      expect(record!.peerId).toBe("peer-a");
      expect(record!.agentId).toBe("weather");
      expect(record!.messageCount).toBe(1);
    });

    it("increments messageCount for same agent", () => {
      setAffinity("proj-1", "peer-a", "weather");
      setAffinity("proj-1", "peer-a", "weather");
      setAffinity("proj-1", "peer-a", "weather");

      const record = getAffinity("proj-1", "peer-a");
      expect(record!.messageCount).toBe(3);
      expect(record!.agentId).toBe("weather");
    });

    it("resets messageCount when agent changes", () => {
      setAffinity("proj-1", "peer-a", "weather");
      setAffinity("proj-1", "peer-a", "weather");
      setAffinity("proj-1", "peer-a", "finance");

      const record = getAffinity("proj-1", "peer-a");
      expect(record!.messageCount).toBe(1);
      expect(record!.agentId).toBe("finance");
    });

    it("returns null for unknown peer", () => {
      expect(getAffinity("proj-1", "unknown")).toBeNull();
    });
  });

  describe("clearAffinity", () => {
    it("removes a specific affinity", () => {
      setAffinity("proj-1", "peer-a", "weather");
      setAffinity("proj-1", "peer-b", "finance");

      clearAffinity("proj-1", "peer-a");

      expect(getAffinity("proj-1", "peer-a")).toBeNull();
      expect(getAffinity("proj-1", "peer-b")).not.toBeNull();
    });
  });

  describe("clearProjectAffinities", () => {
    it("removes all affinities for a project", () => {
      setAffinity("proj-1", "peer-a", "weather");
      setAffinity("proj-1", "peer-b", "finance");
      setAffinity("proj-2", "peer-a", "sales");

      clearProjectAffinities("proj-1");

      expect(getAffinity("proj-1", "peer-a")).toBeNull();
      expect(getAffinity("proj-1", "peer-b")).toBeNull();
      // proj-2 unaffected
      expect(getAffinity("proj-2", "peer-a")).not.toBeNull();
    });
  });

  describe("isAffinityExpired", () => {
    it("returns false for fresh record", () => {
      const record: SessionAffinityRecord = {
        peerId: "peer-a",
        agentId: "weather",
        lastActiveAt: new Date().toISOString(),
        messageCount: 1,
      };

      expect(isAffinityExpired(record, 30)).toBe(false);
    });

    it("returns true for old record", () => {
      const record: SessionAffinityRecord = {
        peerId: "peer-a",
        agentId: "weather",
        lastActiveAt: new Date(Date.now() - 60 * 60_000).toISOString(), // 60 min ago
        messageCount: 1,
      };

      expect(isAffinityExpired(record, 30)).toBe(true);
    });

    it("returns true for zero timeout", () => {
      const record: SessionAffinityRecord = {
        peerId: "peer-a",
        agentId: "weather",
        lastActiveAt: new Date().toISOString(),
        messageCount: 1,
      };

      expect(isAffinityExpired(record, 0)).toBe(true);
    });

    it("returns true for invalid timestamp", () => {
      const record: SessionAffinityRecord = {
        peerId: "peer-a",
        agentId: "weather",
        lastActiveAt: "invalid-date",
        messageCount: 1,
      };

      expect(isAffinityExpired(record, 30)).toBe(true);
    });
  });

  describe("resolveAffinityAgent", () => {
    it("returns agent for valid, non-expired affinity", () => {
      setAffinity("proj-1", "peer-a", "weather");

      const agent = resolveAffinityAgent("proj-1", "peer-a", 30);
      expect(agent).toBe("weather");
    });

    it("returns null for expired affinity and clears it", () => {
      setAffinity("proj-1", "peer-a", "weather");

      // Immediately expire with 0 timeout
      const agent = resolveAffinityAgent("proj-1", "peer-a", 0);
      expect(agent).toBeNull();

      // Should be cleared
      expect(getAffinity("proj-1", "peer-a")).toBeNull();
    });

    it("returns null for non-existent affinity", () => {
      expect(resolveAffinityAgent("proj-1", "unknown", 30)).toBeNull();
    });
  });

  describe("purgeExpiredAffinities", () => {
    it("removes expired records", () => {
      setAffinity("proj-1", "peer-a", "weather");
      setAffinity("proj-1", "peer-b", "finance");

      // Purge with 0 timeout (all expired)
      const purged = purgeExpiredAffinities(0);
      expect(purged).toBe(2);
      expect(getAllAffinities().size).toBe(0);
    });

    it("keeps non-expired records", () => {
      setAffinity("proj-1", "peer-a", "weather");

      const purged = purgeExpiredAffinities(30);
      expect(purged).toBe(0);
      expect(getAllAffinities().size).toBe(1);
    });
  });

  describe("project isolation", () => {
    it("different projects have independent affinities", () => {
      setAffinity("proj-1", "peer-a", "weather");
      setAffinity("proj-2", "peer-a", "finance");

      expect(getAffinity("proj-1", "peer-a")!.agentId).toBe("weather");
      expect(getAffinity("proj-2", "peer-a")!.agentId).toBe("finance");
    });
  });
});
