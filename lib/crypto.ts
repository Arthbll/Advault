import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be exactly 64 hex chars (32 bytes).");
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Output format: `iv(24 hex):tag(32 hex):ciphertext(base64)`
 */
export function encrypt(plaintext: string): string {
  const iv     = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const enc    = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("base64")}`;
}

/**
 * Decrypts an AES-256-GCM encoded string.
 * Throws if tampered (auth tag mismatch).
 */
export function decrypt(encoded: string): string {
  const parts = encoded.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted payload format.");
  const [ivHex, tagHex, encB64] = parts;
  const iv       = Buffer.from(ivHex,  "hex");
  const tag      = Buffer.from(tagHex, "hex");
  const enc      = Buffer.from(encB64, "base64");
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}