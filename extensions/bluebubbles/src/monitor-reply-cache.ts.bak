/**
 * In-memory reply cache for BlueBubbles short ID resolution.
 *
 * Each inbound/outbound message is assigned a short numeric ID (1, 2, 3...)
 * that the LLM can use in [[reply_to:N]] tags instead of full UUIDs, saving
 * tokens and improving readability.
 */

type CacheEntry = {
  shortId: string;
  accountId: string;
  messageId: string;
  chatGuid?: string;
  chatIdentifier?: string;
  chatId?: string;
  senderLabel?: string;
  body?: string;
  timestamp: number;
};

/** Map from message UUID to cache entry. */
let uuidToEntry = new Map<string, CacheEntry>();
/** Map from short ID to message UUID. */
let shortIdToUuid = new Map<string, string>();
/** Next short ID counter. */
let nextShortId = 1;

/** Reset all cached state (for tests). */
export function _resetBlueBubblesShortIdState(): void {
  uuidToEntry.clear();
  shortIdToUuid.clear();
  nextShortId = 1;
}

/**
 * Cache a message and assign it a short numeric ID.
 * Returns the cache entry including the assigned `shortId`.
 */
export function rememberBlueBubblesReplyCache(params: {
  accountId: string;
  messageId: string;
  chatGuid?: string;
  chatIdentifier?: string;
  chatId?: string;
  senderLabel?: string;
  body?: string;
  timestamp: number;
}): CacheEntry {
  // If already cached, return existing entry
  const existing = uuidToEntry.get(params.messageId);
  if (existing) {
    return existing;
  }

  const shortId = String(nextShortId++);
  const entry: CacheEntry = {
    shortId,
    accountId: params.accountId,
    messageId: params.messageId,
    chatGuid: params.chatGuid,
    chatIdentifier: params.chatIdentifier,
    chatId: params.chatId,
    senderLabel: params.senderLabel,
    body: params.body,
    timestamp: params.timestamp,
  };

  uuidToEntry.set(params.messageId, entry);
  shortIdToUuid.set(shortId, params.messageId);

  return entry;
}

/**
 * Get the short ID for a UUID, if cached.
 * Returns undefined if the UUID is not known.
 */
export function getShortIdForUuid(uuid: string): string | undefined {
  return uuidToEntry.get(uuid)?.shortId;
}

/**
 * Resolve a message ID:
 * - If numeric (short ID), look up the full UUID from cache
 * - If not numeric, return as-is (already a UUID)
 * - If `requireKnownShortId` is set and the numeric ID is not cached, throw
 */
export function resolveBlueBubblesMessageId(
  id: string,
  opts?: { requireKnownShortId?: boolean },
): string {
  const isNumeric = /^\d+$/.test(id);
  if (!isNumeric) {
    return id;
  }

  const uuid = shortIdToUuid.get(id);
  if (uuid) {
    return uuid;
  }

  if (opts?.requireKnownShortId) {
    throw new Error(
      `Unknown short message ID "${id}". The short message ID must refer to a recently seen message.`,
    );
  }

  return id;
}

/**
 * Look up cached reply context by replyToId (UUID).
 * Returns the cached entry if found, or undefined.
 */
export function resolveReplyContextFromCache(params: {
  accountId: string;
  replyToId: string;
  chatGuid?: string;
  chatIdentifier?: string;
  chatId?: string;
}): CacheEntry | undefined {
  const entry = uuidToEntry.get(params.replyToId);
  if (!entry) {
    return undefined;
  }
  // Optionally scope to same account
  if (entry.accountId !== params.accountId) {
    return undefined;
  }
  return entry;
}
