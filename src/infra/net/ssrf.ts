import { lookup as dnsLookupCb, type LookupAddress } from "node:dns";
import { lookup as dnsLookup } from "node:dns/promises";
import { Agent, type Dispatcher } from "undici";

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

export class SsrFBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrFBlockedError";
  }
}

export type LookupFn = typeof dnsLookup;

export type SsrFPolicy = {
  allowPrivateNetwork?: boolean;
  allowedHostnames?: string[];
  hostnameAllowlist?: string[];
};

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain", // Common localhost variant
  "metadata.google.internal",
  "169.254.169.254", // AWS/GCP/Azure metadata service
  "metadata", // Azure metadata shorthand
  "0.0.0.0", // Unspecified address
]);

function normalizeHostname(hostname: string): string {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    return normalized.slice(1, -1);
  }
  return normalized;
}

function normalizeHostnameSet(values?: string[]): Set<string> {
  if (!values || values.length === 0) {
    return new Set<string>();
  }
  return new Set(values.map((value) => normalizeHostname(value)).filter(Boolean));
}

function normalizeHostnameAllowlist(values?: string[]): string[] {
  if (!values || values.length === 0) {
    return [];
  }
  return Array.from(
    new Set(
      values
        .map((value) => normalizeHostname(value))
        .filter((value) => value !== "*" && value !== "*." && value.length > 0),
    ),
  );
}

function isHostnameAllowedByPattern(hostname: string, pattern: string): boolean {
  if (pattern.startsWith("*.")) {
    const suffix = pattern.slice(2);
    if (!suffix || hostname === suffix) {
      return false;
    }
    return hostname.endsWith(`.${suffix}`);
  }
  return hostname === pattern;
}

function matchesHostnameAllowlist(hostname: string, allowlist: string[]): boolean {
  if (allowlist.length === 0) {
    return true;
  }
  return allowlist.some((pattern) => isHostnameAllowedByPattern(hostname, pattern));
}

function parseIpv4(address: string): number[] | null {
  const parts = address.split(".");
  if (parts.length !== 4) {
    return null;
  }
  const numbers = parts.map((part) => Number.parseInt(part, 10));
  if (numbers.some((value) => Number.isNaN(value) || value < 0 || value > 255)) {
    return null;
  }
  return numbers;
}

function stripIpv6ZoneId(address: string): string {
  const index = address.indexOf("%");
  return index >= 0 ? address.slice(0, index) : address;
}

function parseIpv6Hextets(address: string): number[] | null {
  let input = stripIpv6ZoneId(address.trim().toLowerCase());
  if (!input) {
    return null;
  }

  // Handle IPv4-embedded IPv6 like ::ffff:127.0.0.1 by converting the tail to 2 hextets.
  if (input.includes(".")) {
    const lastColon = input.lastIndexOf(":");
    if (lastColon < 0) {
      return null;
    }
    const ipv4 = parseIpv4(input.slice(lastColon + 1));
    if (!ipv4) {
      return null;
    }
    const high = (ipv4[0] << 8) + ipv4[1];
    const low = (ipv4[2] << 8) + ipv4[3];
    input = `${input.slice(0, lastColon)}:${high.toString(16)}:${low.toString(16)}`;
  }

  const doubleColonParts = input.split("::");
  if (doubleColonParts.length > 2) {
    return null;
  }

  const headParts =
    doubleColonParts[0]?.length > 0 ? doubleColonParts[0].split(":").filter(Boolean) : [];
  const tailParts =
    doubleColonParts.length === 2 && doubleColonParts[1]?.length > 0
      ? doubleColonParts[1].split(":").filter(Boolean)
      : [];

  const missingParts = 8 - headParts.length - tailParts.length;
  if (missingParts < 0) {
    return null;
  }

  const fullParts =
    doubleColonParts.length === 1
      ? input.split(":")
      : [...headParts, ...Array.from({ length: missingParts }, () => "0"), ...tailParts];

  if (fullParts.length !== 8) {
    return null;
  }

  const hextets: number[] = [];
  for (const part of fullParts) {
    if (!part) {
      return null;
    }
    const value = Number.parseInt(part, 16);
    if (Number.isNaN(value) || value < 0 || value > 0xffff) {
      return null;
    }
    hextets.push(value);
  }
  return hextets;
}

function extractIpv4FromEmbeddedIpv6(hextets: number[]): number[] | null {
  // IPv4-mapped: ::ffff:a.b.c.d (and full-form variants)
  // IPv4-compatible: ::a.b.c.d (deprecated, but still needs private-network blocking)
  const zeroPrefix = hextets[0] === 0 && hextets[1] === 0 && hextets[2] === 0 && hextets[3] === 0;
  if (!zeroPrefix || hextets[4] !== 0) {
    return null;
  }
  if (hextets[5] !== 0xffff && hextets[5] !== 0) {
    return null;
  }
  const high = hextets[6];
  const low = hextets[7];
  return [(high >>> 8) & 0xff, high & 0xff, (low >>> 8) & 0xff, low & 0xff];
}

function isPrivateIpv4(parts: number[]): boolean {
  const [octet1, octet2, octet3, octet4] = parts;

  // 0.0.0.0/8 - "This" network (current network, unspecified)
  if (octet1 === 0) {
    return true;
  }

  // 10.0.0.0/8 - Private network (Class A)
  if (octet1 === 10) {
    return true;
  }

  // 127.0.0.0/8 - Loopback
  if (octet1 === 127) {
    return true;
  }

  // 169.254.0.0/16 - Link-local (APIPA)
  if (octet1 === 169 && octet2 === 254) {
    return true;
  }

  // 172.16.0.0/12 - Private network (Class B)
  if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) {
    return true;
  }

  // 192.168.0.0/16 - Private network (Class C)
  if (octet1 === 192 && octet2 === 168) {
    return true;
  }

  // 100.64.0.0/10 - Shared address space (CGN)
  if (octet1 === 100 && octet2 >= 64 && octet2 <= 127) {
    return true;
  }

  // 192.0.0.0/24 - IETF Protocol Assignments
  if (octet1 === 192 && octet2 === 0 && octet3 === 0) {
    return true;
  }

  // 192.0.2.0/24 - TEST-NET-1 (Documentation)
  if (octet1 === 192 && octet2 === 0 && octet3 === 2) {
    return true;
  }

  // 198.18.0.0/15 - Benchmarking
  if (octet1 === 198 && (octet2 === 18 || octet2 === 19)) {
    return true;
  }

  // 198.51.100.0/24 - TEST-NET-2 (Documentation)
  if (octet1 === 198 && octet2 === 51 && octet3 === 100) {
    return true;
  }

  // 203.0.113.0/24 - TEST-NET-3 (Documentation)
  if (octet1 === 203 && octet2 === 0 && octet3 === 113) {
    return true;
  }

  // 224.0.0.0/4 - Multicast (Class D)
  if (octet1 >= 224 && octet1 <= 239) {
    return true;
  }

  // 240.0.0.0/4 - Reserved for future use (Class E)
  if (octet1 >= 240 && octet1 <= 255) {
    return true;
  }

  // 255.255.255.255/32 - Broadcast address
  if (octet1 === 255 && octet2 === 255 && octet3 === 255 && octet4 === 255) {
    return true;
  }

  return false;
}

export function isPrivateIpAddress(address: string): boolean {
  let normalized = address.trim().toLowerCase();
  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    normalized = normalized.slice(1, -1);
  }
  if (!normalized) {
    return false;
  }

  if (normalized.includes(":")) {
    const hextets = parseIpv6Hextets(normalized);
    if (!hextets) {
      return false;
    }

    const isUnspecified =
      hextets[0] === 0 &&
      hextets[1] === 0 &&
      hextets[2] === 0 &&
      hextets[3] === 0 &&
      hextets[4] === 0 &&
      hextets[5] === 0 &&
      hextets[6] === 0 &&
      hextets[7] === 0;
    const isLoopback =
      hextets[0] === 0 &&
      hextets[1] === 0 &&
      hextets[2] === 0 &&
      hextets[3] === 0 &&
      hextets[4] === 0 &&
      hextets[5] === 0 &&
      hextets[6] === 0 &&
      hextets[7] === 1;
    if (isUnspecified || isLoopback) {
      return true;
    }

    const embeddedIpv4 = extractIpv4FromEmbeddedIpv6(hextets);
    if (embeddedIpv4) {
      return isPrivateIpv4(embeddedIpv4);
    }

    // IPv6 private/internal ranges
    // - link-local: fe80::/10
    // - site-local (deprecated, but internal): fec0::/10
    // - unique local: fc00::/7
    const first = hextets[0];
    if ((first & 0xffc0) === 0xfe80) {
      return true;
    }
    if ((first & 0xffc0) === 0xfec0) {
      return true;
    }
    if ((first & 0xfe00) === 0xfc00) {
      return true;
    }
    return false;
  }

  const ipv4 = parseIpv4(normalized);
  if (!ipv4) {
    return false;
  }
  return isPrivateIpv4(ipv4);
}

export function isBlockedHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  if (!normalized) {
    return false;
  }
  if (BLOCKED_HOSTNAMES.has(normalized)) {
    return true;
  }
  // Block common localhost/internal variants
  if (
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal") ||
    normalized.endsWith(".localdomain") // Additional variant
  ) {
    return true;
  }

  // Block DNS rebinding patterns like "127-0-0-1.com"
  // These resolve to 127.0.0.1 but bypass simple blocklists
  const dnsRebindingPattern = /^(\d+)-(\d+)-(\d+)-(\d+)\./;
  if (dnsRebindingPattern.test(normalized)) {
    const match = normalized.match(dnsRebindingPattern);
    if (match) {
      const testIp = `${match[1]}.${match[2]}.${match[3]}.${match[4]}`;
      if (isPrivateIpAddress(testIp)) {
        return true;
      }
    }
  }

  return false;
}

export function createPinnedLookup(params: {
  hostname: string;
  addresses: string[];
  fallback?: typeof dnsLookupCb;
}): typeof dnsLookupCb {
  const normalizedHost = normalizeHostname(params.hostname);
  const fallback = params.fallback ?? dnsLookupCb;
  const fallbackLookup = fallback as unknown as (
    hostname: string,
    callback: LookupCallback,
  ) => void;
  const fallbackWithOptions = fallback as unknown as (
    hostname: string,
    options: unknown,
    callback: LookupCallback,
  ) => void;
  const records = params.addresses.map((address) => ({
    address,
    family: address.includes(":") ? 6 : 4,
  }));
  let index = 0;

  return ((host: string, options?: unknown, callback?: unknown) => {
    const cb: LookupCallback =
      typeof options === "function" ? (options as LookupCallback) : (callback as LookupCallback);
    if (!cb) {
      return;
    }
    const normalized = normalizeHostname(host);
    if (!normalized || normalized !== normalizedHost) {
      if (typeof options === "function" || options === undefined) {
        return fallbackLookup(host, cb);
      }
      return fallbackWithOptions(host, options, cb);
    }

    const opts =
      typeof options === "object" && options !== null
        ? (options as { all?: boolean; family?: number })
        : {};
    const requestedFamily =
      typeof options === "number" ? options : typeof opts.family === "number" ? opts.family : 0;
    const candidates =
      requestedFamily === 4 || requestedFamily === 6
        ? records.filter((entry) => entry.family === requestedFamily)
        : records;
    const usable = candidates.length > 0 ? candidates : records;
    if (opts.all) {
      cb(null, usable as LookupAddress[]);
      return;
    }
    const chosen = usable[index % usable.length];
    index += 1;
    cb(null, chosen.address, chosen.family);
  }) as typeof dnsLookupCb;
}

export type PinnedHostname = {
  hostname: string;
  addresses: string[];
  lookup: typeof dnsLookupCb;
};

export async function resolvePinnedHostnameWithPolicy(
  hostname: string,
  params: { lookupFn?: LookupFn; policy?: SsrFPolicy } = {},
): Promise<PinnedHostname> {
  const normalized = normalizeHostname(hostname);
  if (!normalized) {
    throw new Error("Invalid hostname");
  }

  const allowPrivateNetwork = Boolean(params.policy?.allowPrivateNetwork);
  const allowedHostnames = normalizeHostnameSet(params.policy?.allowedHostnames);
  const hostnameAllowlist = normalizeHostnameAllowlist(params.policy?.hostnameAllowlist);
  const isExplicitAllowed = allowedHostnames.has(normalized);

  if (!matchesHostnameAllowlist(normalized, hostnameAllowlist)) {
    throw new SsrFBlockedError(`Blocked hostname (not in allowlist): ${hostname}`);
  }

  if (!allowPrivateNetwork && !isExplicitAllowed) {
    if (isBlockedHostname(normalized)) {
      throw new SsrFBlockedError(`Blocked hostname: ${hostname}`);
    }

    if (isPrivateIpAddress(normalized)) {
      throw new SsrFBlockedError("Blocked: private/internal IP address");
    }
  }

  const lookupFn = params.lookupFn ?? dnsLookup;
  const results = await lookupFn(normalized, { all: true });
  if (results.length === 0) {
    throw new Error(`Unable to resolve hostname: ${hostname}`);
  }

  if (!allowPrivateNetwork && !isExplicitAllowed) {
    for (const entry of results) {
      if (isPrivateIpAddress(entry.address)) {
        throw new SsrFBlockedError("Blocked: resolves to private/internal IP address");
      }
    }
  }

  const addresses = Array.from(new Set(results.map((entry) => entry.address)));
  if (addresses.length === 0) {
    throw new Error(`Unable to resolve hostname: ${hostname}`);
  }

  return {
    hostname: normalized,
    addresses,
    lookup: createPinnedLookup({ hostname: normalized, addresses }),
  };
}

export async function resolvePinnedHostname(
  hostname: string,
  lookupFn: LookupFn = dnsLookup,
): Promise<PinnedHostname> {
  return await resolvePinnedHostnameWithPolicy(hostname, { lookupFn });
}

export function createPinnedDispatcher(pinned: PinnedHostname): Dispatcher {
  return new Agent({
    connect: {
      lookup: pinned.lookup,
    },
  });
}

export async function closeDispatcher(dispatcher?: Dispatcher | null): Promise<void> {
  if (!dispatcher) {
    return;
  }
  const candidate = dispatcher as { close?: () => Promise<void> | void; destroy?: () => void };
  try {
    if (typeof candidate.close === "function") {
      await candidate.close();
      return;
    }
    if (typeof candidate.destroy === "function") {
      candidate.destroy();
    }
  } catch {
    // ignore dispatcher cleanup errors
  }
}

/**
 * Synchronously validate a URL string for SSRF risks.
 * Throws SsrFBlockedError if the URL hostname is a blocked hostname or a private IP address.
 * Throws Error("Invalid URL") if the URL cannot be parsed.
 */
export function validateUrlForSsrf(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (!hostname) {
    throw new SsrFBlockedError("Blocked: empty hostname");
  }

  if (isBlockedHostname(hostname)) {
    throw new SsrFBlockedError(`Blocked hostname: ${hostname}`);
  }

  if (isPrivateIpAddress(hostname)) {
    throw new SsrFBlockedError("Blocked: private/internal IP address");
  }
}

export async function assertPublicHostname(
  hostname: string,
  lookupFn: LookupFn = dnsLookup,
): Promise<void> {
  await resolvePinnedHostname(hostname, lookupFn);
}
