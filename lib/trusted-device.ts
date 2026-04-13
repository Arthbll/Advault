/**
 * Trusted-device token  —  HMAC-SHA256 via Web Crypto API
 *
 * Works in both Node.js 18+ (server actions, API routes) and the
 * Next.js Edge runtime (middleware), because it only uses globalThis.crypto.
 *
 * Token format (base64-encoded JSON):
 *   { payload: "<JSON string>", sig: "<base64 HMAC>" }
 *
 * The payload is:
 *   { userId: string, exp: number }  // unix ms timestamp
 *
 * Key source: ENCRYPTION_KEY env var (64 hex chars → 32 bytes).
 * Using the same raw bytes as for AES is safe here because the key
 * is used with a completely different algorithm (HMAC vs AES-GCM).
 */

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

async function getHMACKey(): Promise<CryptoKey> {
  const hex = process.env.ENCRYPTION_KEY ?? "";
  if (hex.length !== 64) throw new Error("ENCRYPTION_KEY missing or invalid.");
  const bytes = new Uint8Array(
    hex.match(/.{2}/g)!.map(h => parseInt(h, 16))
  );
  return globalThis.crypto.subtle.importKey(
    "raw", bytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/** Generate a signed trusted-device token for the given userId. */
export async function signTrustedDevice(userId: string): Promise<string> {
  const payload = JSON.stringify({ userId, exp: Date.now() + TTL_MS });
  const key = await getHMACKey();
  const sigBuf = await globalThis.crypto.subtle.sign(
    "HMAC", key, new TextEncoder().encode(payload)
  );
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
  return btoa(JSON.stringify({ payload, sig }));
}

/**
 * Verify a trusted-device token.
 * Returns true only if: signature valid + not expired + userId matches.
 */
export async function verifyTrustedDevice(
  token: string,
  userId: string
): Promise<boolean> {
  try {
    const { payload, sig } = JSON.parse(atob(token)) as {
      payload: string;
      sig: string;
    };
    const { userId: storedId, exp } = JSON.parse(payload) as {
      userId: string;
      exp: number;
    };
    if (storedId !== userId || exp < Date.now()) return false;
    const key = await getHMACKey();
    const sigBytes = Uint8Array.from(atob(sig), c => c.charCodeAt(0));
    return await globalThis.crypto.subtle.verify(
      "HMAC", key, sigBytes, new TextEncoder().encode(payload)
    );
  } catch {
    return false;
  }
}

export const TRUSTED_DEVICE_COOKIE = "td_v1";
export const TRUSTED_DEVICE_MAX_AGE = Math.floor(TTL_MS / 1000); // 30 days in seconds
