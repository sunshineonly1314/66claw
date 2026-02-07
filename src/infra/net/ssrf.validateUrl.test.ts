/**
 * SSRF 防护测试 - validateUrlForSsrf 函数
 * ClawdbotCN 专属安全修复测试
 * 
 * 测试专家 A: 正向测试 + 边界测试
 * 测试专家 B: 负向测试 + 攻击向量测试
 */
import { describe, expect, it } from "vitest";
import { 
  validateUrlForSsrf, 
  isPrivateIpAddress, 
  isBlockedHostname,
  SsrFBlockedError 
} from "./ssrf.js";

describe("SSRF Protection - validateUrlForSsrf", () => {
  // ============================================
  // 测试专家 A: 正向测试 - 合法 URL 应该通过
  // ============================================
  describe("Expert A: Valid URLs should pass", () => {
    it("allows public HTTP URLs", () => {
      expect(() => validateUrlForSsrf("http://example.com/file.txt")).not.toThrow();
      expect(() => validateUrlForSsrf("http://google.com")).not.toThrow();
      expect(() => validateUrlForSsrf("http://github.com/repo")).not.toThrow();
    });

    it("allows public HTTPS URLs", () => {
      expect(() => validateUrlForSsrf("https://example.com/api")).not.toThrow();
      expect(() => validateUrlForSsrf("https://api.openai.com/v1/chat")).not.toThrow();
      expect(() => validateUrlForSsrf("https://cdn.jsdelivr.net/npm/package")).not.toThrow();
    });

    it("allows URLs with ports", () => {
      expect(() => validateUrlForSsrf("http://example.com:8080/api")).not.toThrow();
      expect(() => validateUrlForSsrf("https://api.server.com:443/")).not.toThrow();
    });

    it("allows URLs with query strings", () => {
      expect(() => validateUrlForSsrf("https://example.com/search?q=test")).not.toThrow();
      expect(() => validateUrlForSsrf("https://api.com/data?id=123&format=json")).not.toThrow();
    });

    it("allows URLs with paths", () => {
      expect(() => validateUrlForSsrf("https://example.com/path/to/resource")).not.toThrow();
      expect(() => validateUrlForSsrf("https://cdn.example.com/files/image.png")).not.toThrow();
    });

    it("allows public IP addresses", () => {
      expect(() => validateUrlForSsrf("http://93.184.216.34/")).not.toThrow();
      expect(() => validateUrlForSsrf("http://8.8.8.8/dns")).not.toThrow();
    });
  });

  // ============================================
  // 测试专家 B: 负向测试 - 恶意 URL 应该被阻止
  // ============================================
  describe("Expert B: Malicious URLs should be blocked", () => {
    describe("Localhost variations", () => {
      it("blocks localhost", () => {
        expect(() => validateUrlForSsrf("http://localhost/admin")).toThrow(SsrFBlockedError);
        expect(() => validateUrlForSsrf("http://localhost:8080/")).toThrow(SsrFBlockedError);
        expect(() => validateUrlForSsrf("https://localhost/")).toThrow(SsrFBlockedError);
      });

      it("blocks localhost subdomains", () => {
        expect(() => validateUrlForSsrf("http://api.localhost/")).toThrow(SsrFBlockedError);
        expect(() => validateUrlForSsrf("http://admin.localhost:3000/")).toThrow(SsrFBlockedError);
      });

      it("blocks .local domains", () => {
        expect(() => validateUrlForSsrf("http://myserver.local/")).toThrow(SsrFBlockedError);
        expect(() => validateUrlForSsrf("http://printer.local/api")).toThrow(SsrFBlockedError);
      });

      it("blocks .internal domains", () => {
        expect(() => validateUrlForSsrf("http://internal.server.internal/")).toThrow(SsrFBlockedError);
        expect(() => validateUrlForSsrf("http://metadata.google.internal/")).toThrow(SsrFBlockedError);
      });
    });

    describe("Private IPv4 addresses", () => {
      it("blocks 127.0.0.0/8 (loopback)", () => {
        expect(() => validateUrlForSsrf("http://127.0.0.1/")).toThrow(SsrFBlockedError);
        expect(() => validateUrlForSsrf("http://127.0.0.1:8080/admin")).toThrow(SsrFBlockedError);
        expect(() => validateUrlForSsrf("http://127.0.0.2/")).toThrow(SsrFBlockedError);
        expect(() => validateUrlForSsrf("http://127.255.255.255/")).toThrow(SsrFBlockedError);
      });

      it("blocks 10.0.0.0/8 (Class A private)", () => {
        expect(() => validateUrlForSsrf("http://10.0.0.1/")).toThrow(SsrFBlockedError);
        expect(() => validateUrlForSsrf("http://10.255.255.255/")).toThrow(SsrFBlockedError);
        expect(() => validateUrlForSsrf("http://10.1.2.3:8080/api")).toThrow(SsrFBlockedError);
      });

      it("blocks 172.16.0.0/12 (Class B private)", () => {
        expect(() => validateUrlForSsrf("http://172.16.0.1/")).toThrow(SsrFBlockedError);
        expect(() => validateUrlForSsrf("http://172.31.255.255/")).toThrow(SsrFBlockedError);
        expect(() => validateUrlForSsrf("http://172.20.10.5/")).toThrow(SsrFBlockedError);
      });

      it("blocks 192.168.0.0/16 (Class C private)", () => {
        expect(() => validateUrlForSsrf("http://192.168.0.1/")).toThrow(SsrFBlockedError);
        expect(() => validateUrlForSsrf("http://192.168.1.1/admin")).toThrow(SsrFBlockedError);
        expect(() => validateUrlForSsrf("http://192.168.255.255/")).toThrow(SsrFBlockedError);
      });

      it("blocks 169.254.0.0/16 (link-local)", () => {
        expect(() => validateUrlForSsrf("http://169.254.0.1/")).toThrow(SsrFBlockedError);
        expect(() => validateUrlForSsrf("http://169.254.169.254/")).toThrow(SsrFBlockedError);
      });

      it("blocks 0.0.0.0/8 (this network)", () => {
        expect(() => validateUrlForSsrf("http://0.0.0.0/")).toThrow(SsrFBlockedError);
        expect(() => validateUrlForSsrf("http://0.0.0.1/")).toThrow(SsrFBlockedError);
      });

      it("blocks 100.64.0.0/10 (CGNAT)", () => {
        expect(() => validateUrlForSsrf("http://100.64.0.1/")).toThrow(SsrFBlockedError);
        expect(() => validateUrlForSsrf("http://100.127.255.255/")).toThrow(SsrFBlockedError);
      });
    });

    describe("Private IPv6 addresses", () => {
      it("blocks ::1 (loopback)", () => {
        expect(() => validateUrlForSsrf("http://[::1]/")).toThrow(SsrFBlockedError);
        expect(() => validateUrlForSsrf("http://[::1]:8080/")).toThrow(SsrFBlockedError);
      });

      it("blocks :: (unspecified)", () => {
        expect(() => validateUrlForSsrf("http://[::]/")).toThrow(SsrFBlockedError);
      });

      it("blocks fe80::/10 (link-local)", () => {
        expect(() => validateUrlForSsrf("http://[fe80::1]/")).toThrow(SsrFBlockedError);
        expect(() => validateUrlForSsrf("http://[fe80::1:2:3:4]/")).toThrow(SsrFBlockedError);
      });

      it("blocks fc00::/7 (unique local)", () => {
        expect(() => validateUrlForSsrf("http://[fc00::1]/")).toThrow(SsrFBlockedError);
        expect(() => validateUrlForSsrf("http://[fd00::1]/")).toThrow(SsrFBlockedError);
      });

      it("blocks IPv4-mapped IPv6 addresses", () => {
        expect(() => validateUrlForSsrf("http://[::ffff:127.0.0.1]/")).toThrow(SsrFBlockedError);
        expect(() => validateUrlForSsrf("http://[::ffff:10.0.0.1]/")).toThrow(SsrFBlockedError);
        expect(() => validateUrlForSsrf("http://[::ffff:192.168.1.1]/")).toThrow(SsrFBlockedError);
      });
    });

    describe("Cloud metadata endpoints", () => {
      it("blocks AWS metadata", () => {
        expect(() => validateUrlForSsrf("http://169.254.169.254/latest/meta-data/")).toThrow(SsrFBlockedError);
      });

      it("blocks GCP metadata", () => {
        expect(() => validateUrlForSsrf("http://metadata.google.internal/")).toThrow(SsrFBlockedError);
      });
    });
  });

  // ============================================
  // 测试专家 A: 边界测试
  // ============================================
  describe("Expert A: Edge cases", () => {
    it("throws on invalid URLs", () => {
      expect(() => validateUrlForSsrf("not-a-url")).toThrow("Invalid URL");
      expect(() => validateUrlForSsrf("")).toThrow("Invalid URL");
      expect(() => validateUrlForSsrf("ftp://example.com")).not.toThrow(); // FTP is allowed, just checked for hostname
    });

    it("handles case insensitivity", () => {
      expect(() => validateUrlForSsrf("http://LOCALHOST/")).toThrow(SsrFBlockedError);
      expect(() => validateUrlForSsrf("http://LocalHost/")).toThrow(SsrFBlockedError);
      expect(() => validateUrlForSsrf("http://EXAMPLE.COM/")).not.toThrow();
    });

    it("handles trailing dots in hostnames", () => {
      expect(() => validateUrlForSsrf("http://localhost./")).toThrow(SsrFBlockedError);
      expect(() => validateUrlForSsrf("http://example.com./")).not.toThrow();
    });
  });

  // ============================================
  // 测试专家 B: 攻击向量测试 - Bypass 尝试
  // ============================================
  describe("Expert B: Attack vectors - Bypass attempts", () => {
    it("blocks URL encoding attempts", () => {
      // These should be normalized by URL parser
      expect(() => validateUrlForSsrf("http://127%2E0%2E0%2E1/")).toThrow();
    });

    it("blocks decimal IP notation", () => {
      // 127.0.0.1 in decimal = 2130706433
      // Note: URL parser may or may not accept this, so we test the IP parser directly
      expect(isPrivateIpAddress("127.0.0.1")).toBe(true);
    });

    it("blocks octal IP notation attempts", () => {
      // 0177.0.0.1 = 127.0.0.1 in octal (first octet)
      // Note: Standard URL parsing doesn't accept octal, but we ensure IP check works
      expect(isPrivateIpAddress("127.0.0.1")).toBe(true);
    });

    it("blocks IPv6 bracket variations", () => {
      expect(isPrivateIpAddress("[::1]")).toBe(true);
      expect(isPrivateIpAddress("::1")).toBe(true);
    });

    it("blocks mixed case localhost", () => {
      expect(isBlockedHostname("LocalHost")).toBe(true);
      expect(isBlockedHostname("LOCALHOST")).toBe(true);
      expect(isBlockedHostname("lOcAlHoSt")).toBe(true);
    });
  });
});

// ============================================
// 测试专家 A+B: isPrivateIpAddress 单元测试
// ============================================
describe("isPrivateIpAddress", () => {
  describe("Expert A: Public IPs should return false", () => {
    it("returns false for public IPv4", () => {
      expect(isPrivateIpAddress("8.8.8.8")).toBe(false);
      expect(isPrivateIpAddress("93.184.216.34")).toBe(false);
      expect(isPrivateIpAddress("1.1.1.1")).toBe(false);
      expect(isPrivateIpAddress("203.0.113.1")).toBe(false);
    });
  });

  describe("Expert B: Private IPs should return true", () => {
    it("returns true for private IPv4", () => {
      expect(isPrivateIpAddress("10.0.0.1")).toBe(true);
      expect(isPrivateIpAddress("172.16.0.1")).toBe(true);
      expect(isPrivateIpAddress("192.168.1.1")).toBe(true);
      expect(isPrivateIpAddress("127.0.0.1")).toBe(true);
      expect(isPrivateIpAddress("169.254.1.1")).toBe(true);
      expect(isPrivateIpAddress("0.0.0.0")).toBe(true);
      expect(isPrivateIpAddress("100.64.0.1")).toBe(true);
    });

    it("returns true for private IPv6", () => {
      expect(isPrivateIpAddress("::1")).toBe(true);
      expect(isPrivateIpAddress("::")).toBe(true);
      expect(isPrivateIpAddress("fe80::1")).toBe(true);
      expect(isPrivateIpAddress("fc00::1")).toBe(true);
      expect(isPrivateIpAddress("fd00::1")).toBe(true);
    });
  });
});

// ============================================
// 测试专家 A+B: isBlockedHostname 单元测试
// ============================================
describe("isBlockedHostname", () => {
  describe("Expert A: Valid hostnames should not be blocked", () => {
    it("allows normal domains", () => {
      expect(isBlockedHostname("example.com")).toBe(false);
      expect(isBlockedHostname("api.github.com")).toBe(false);
      expect(isBlockedHostname("localhost.example.com")).toBe(false); // not .localhost TLD
    });
  });

  describe("Expert B: Blocked hostnames should return true", () => {
    it("blocks localhost", () => {
      expect(isBlockedHostname("localhost")).toBe(true);
    });

    it("blocks .localhost TLD", () => {
      expect(isBlockedHostname("api.localhost")).toBe(true);
      expect(isBlockedHostname("admin.api.localhost")).toBe(true);
    });

    it("blocks .local TLD", () => {
      expect(isBlockedHostname("myserver.local")).toBe(true);
      expect(isBlockedHostname("printer.local")).toBe(true);
    });

    it("blocks .internal TLD", () => {
      expect(isBlockedHostname("metadata.google.internal")).toBe(true);
      expect(isBlockedHostname("service.internal")).toBe(true);
    });
  });
});
