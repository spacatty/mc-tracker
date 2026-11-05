import "server-only";

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * AES-256-GCM sealing for stored account credentials.
 *
 * The key is derived (HKDF-SHA256) from CREDENTIALS_SECRET, or AUTH_SECRET when that is not set.
 * Changing the secret makes previously stored credentials unreadable, so keep it stable.
 * Format: "v1:" + base64url(iv[12] | tag[16] | ciphertext).
 */

const PREFIX = "v1:";
let cachedKey: { source: string; key: Buffer } | null = null;

function keySource() {
  const explicit = process.env.CREDENTIALS_SECRET?.trim();
  if (explicit) return explicit;
  const auth = process.env.AUTH_SECRET?.trim();
  if (auth) return auth;
  if (process.env.NODE_ENV === "production") {
    throw new Error("CREDENTIALS_SECRET or AUTH_SECRET must be configured to store credentials.");
  }
  return "dev-secret-change-me-for-production-mc-tracker";
}

function key() {
  const source = keySource();
  if (cachedKey?.source === source) return cachedKey.key;
  const derived = Buffer.from(hkdfSync("sha256", source, "mc-tracker-vault", "account-credentials-v1", 32));
  cachedKey = { source, key: derived };
  return derived;
}

export function sealSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

export function openSecret(sealed: string) {
  if (!sealed.startsWith(PREFIX)) throw new Error("Unsupported credential format.");
  const raw = Buffer.from(sealed.slice(PREFIX.length), "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  try {
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Stored credentials could not be decrypted. Was CREDENTIALS_SECRET or AUTH_SECRET changed?");
  }
}
