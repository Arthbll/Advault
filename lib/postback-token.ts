import { createHmac } from "crypto";

/**
 * Génère un token postback déterministe pour un userId.
 * HMAC-SHA256(userId, ENCRYPTION_KEY) → hex tronqué à 32 chars.
 * Aucun stockage en DB nécessaire — recalculable à la volée.
 */
export function generatePostbackToken(userId: string): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY manquant dans .env");
  return createHmac("sha256", key).update(userId).digest("hex").slice(0, 32);
}

/**
 * Vérifie qu'un token correspond à un userId.
 * Comparison en temps constant pour éviter les timing attacks.
 */
export function verifyPostbackToken(userId: string, token: string): boolean {
  const expected = generatePostbackToken(userId);
  if (expected.length !== token.length) return false;
  // Comparaison en temps constant
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  }
  return diff === 0;
}
