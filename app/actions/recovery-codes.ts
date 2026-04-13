"use server";

import { createClient }   from "@/lib/supabase/server";
import { prisma }          from "@/lib/prisma";
import { verifyMFA }       from "@/app/actions/mfa";
import { setTrustedDevice } from "@/app/actions/trusted-device";
import {
  generateCodes,
  hashCode,
  normaliseCode,
  RECOVERY_CODE_COUNT,
} from "@/lib/recovery-codes";

// Typed shim: RecoveryCode and SECURITY_EVENT are added via schema.prisma.
// These casts resolve once `prisma generate` is run after `prisma db push`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rc = (prisma as any).recoveryCode as {
  deleteMany: (a: { where: Record<string, unknown> }) => Promise<unknown>;
  createMany: (a: { data: unknown[] }) => Promise<unknown>;
  count:      (a: { where: Record<string, unknown> }) => Promise<number>;
  findFirst:  (a: { where: Record<string, unknown> }) => Promise<{ id: string } | null>;
  update:     (a: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<unknown>;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SECURITY_EVENT = "SECURITY_EVENT" as any;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

async function logSecurityEvent(userId: string, message: string) {
  try {
    await prisma.log.create({
      data: { userId, type: SECURITY_EVENT, message },
    });
  } catch {
    // non-critical — don't fail the operation if logging fails
  }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * Generate fresh recovery codes right after 2FA enrollment.
 * Deletes any pre-existing codes for the user first.
 * Returns the raw codes — this is the ONLY time they are visible.
 */
export async function createRecoveryCodes() {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Not authenticated." };

    if (!rc) return { error: "Recovery codes unavailable — run `prisma db push` then restart the server." };

    await rc.deleteMany({ where: { userId: user.id } });

    const raw = generateCodes(RECOVERY_CODE_COUNT);
    await rc.createMany({
      data: raw.map(code => ({
        id:       crypto.randomUUID(),
        userId:   user.id,
        codeHash: hashCode(code),
      })),
    });

    await logSecurityEvent(user.id, `2FA enabled — ${RECOVERY_CODE_COUNT} recovery codes generated`);
    return { codes: raw };
  } catch (e) {
    console.error("[createRecoveryCodes]", e);
    return { error: "Failed to generate recovery codes. Please try again." };
  }
}

/** Return total and remaining (unused) code counts. */
export async function getRecoveryCodeStats() {
  try {
    const user = await getAuthUser();
    if (!user) return { total: 0, remaining: 0 };

    if (!rc) return { total: 0, remaining: 0 };

    const [total, remaining] = await Promise.all([
      rc.count({ where: { userId: user.id } }),
      rc.count({ where: { userId: user.id, usedAt: null } }),
    ]);
    return { total, remaining };
  } catch {
    return { total: 0, remaining: 0 };
  }
}

/**
 * Regenerate codes after confirming with a fresh TOTP code.
 * Invalidates ALL old codes (used and unused) and generates 10 new ones.
 */
export async function regenerateRecoveryCodes(factorId: string, totpCode: string) {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Not authenticated." };

    if (!rc) return { error: "Recovery codes unavailable — run `prisma db push` then restart the server." };

    const verify = await verifyMFA(factorId, totpCode);
    if (verify.error) return { error: "Invalid authenticator code." };

    await rc.deleteMany({ where: { userId: user.id } });

    const raw = generateCodes(RECOVERY_CODE_COUNT);
    await rc.createMany({
      data: raw.map(code => ({
        id:       crypto.randomUUID(),
        userId:   user.id,
        codeHash: hashCode(code),
      })),
    });

    await logSecurityEvent(user.id, `Recovery codes regenerated — ${RECOVERY_CODE_COUNT} new codes issued`);
    return { codes: raw };
  } catch (e) {
    console.error("[regenerateRecoveryCodes]", e);
    return { error: "Failed to regenerate recovery codes. Please try again." };
  }
}

/**
 * Securely remove 2FA — requires a valid TOTP code as confirmation.
 * Deletes all recovery codes, unenrolls the Supabase TOTP factor, logs the event.
 */
export async function unenrollMFAWithConfirmation(factorId: string, totpCode: string) {
  const user = await getAuthUser();
  if (!user) return { error: "Not authenticated." };

  const verify = await verifyMFA(factorId, totpCode);
  if (verify.error) return { error: "Invalid authenticator code — 2FA not removed." };

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return { error: error.message };

  await rc.deleteMany({ where: { userId: user.id } });
  await logSecurityEvent(user.id, "2FA disabled — all recovery codes revoked");

  return { success: true };
}

/**
 * Use a recovery code to bypass the TOTP challenge.
 * Verifies the code, marks it as consumed, sets a 30-day trusted device cookie.
 * One-time use: if usedAt is already set, rejects.
 */
export async function useRecoveryCode(rawInput: string) {
  const user = await getAuthUser();
  if (!user) return { error: "Not authenticated." };

  const normalised = normaliseCode(rawInput);
  if (normalised.length < 8) return { error: "Invalid recovery code format." };

  const hash = hashCode(normalised);

  const record = await rc.findFirst({
    where: { userId: user.id, codeHash: hash, usedAt: null },
  });

  if (!record) return { error: "Recovery code not found or already used." };

  // Mark as consumed
  await rc.update({
    where: { id: record.id },
    data:  { usedAt: new Date() },
  });

  // Count remaining
  const remaining = await rc.count({
    where: { userId: user.id, usedAt: null },
  });

  await logSecurityEvent(
    user.id,
    `Recovery code used — ${remaining} code${remaining !== 1 ? "s" : ""} remaining`
  );

  // Grant trusted device (30 days) so next logins skip TOTP
  await setTrustedDevice();

  return { success: true, remaining };
}
