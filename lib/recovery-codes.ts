import { createHash } from "crypto";

/**
 * Recovery codes — format: XXXXX-XXXXX (10 chars, uppercase, no ambiguous chars)
 * Charset excludes: 0, O, I, 1, L  to avoid confusion when reading aloud or typing.
 */
const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 32 chars, unambiguous

export const RECOVERY_CODE_COUNT = 10;

/** Generate n random recovery codes. Returns raw (unhashed) codes. */
export function generateCodes(n = RECOVERY_CODE_COUNT): string[] {
  const codes: string[] = [];
  for (let i = 0; i < n; i++) {
    const half = (len: number) =>
      Array.from({ length: len }, () =>
        CHARSET[Math.floor(Math.random() * CHARSET.length)]
      ).join("");
    codes.push(`${half(5)}-${half(5)}`);
  }
  return codes;
}

/**
 * Hash a recovery code for safe storage.
 * Uses SHA-256(normalised_code + ENCRYPTION_KEY) — fast SHA-256 is appropriate
 * here because the code itself is a high-entropy random token (not a password).
 */
export function hashCode(rawCode: string): string {
  const normalised = rawCode.toUpperCase().replace(/-/g, "");
  const pepper      = process.env.ENCRYPTION_KEY ?? "";
  return createHash("sha256").update(normalised + pepper).digest("hex");
}

/** Normalise a user-supplied code before lookup. */
export function normaliseCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
