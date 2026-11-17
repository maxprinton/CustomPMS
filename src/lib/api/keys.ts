import { createHash, randomBytes } from "node:crypto";

// API keys: only a SHA-256 hash is stored. The key itself is shown once, when it is created.
export const KEY_PREFIX = "cpms_";

export function generateKey(): string {
  return KEY_PREFIX + randomBytes(32).toString("base64url");
}
export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
/** The start of a key, safe to show in a list so the owner can tell keys apart. */
export function displayPrefix(key: string): string {
  return key.slice(0, 12);
}
/** "Bearer cpms_..." -> "cpms_..."; anything else -> null. */
export function bearerToken(header: string | null | undefined): string | null {
  const m = (header ?? "").match(/^Bearer\s+(\S+)$/i);
  return m && m[1].startsWith(KEY_PREFIX) ? m[1] : null;
}
