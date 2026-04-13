"use server";

import { createClient } from "@/lib/supabase/server";

/** Initiate TOTP enrollment — returns QR code URI + secret + factor ID */
export async function enrollMFA() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    issuer: "ProfitDash",
  });
  if (error) return { error: error.message };
  return {
    factorId: data.id,
    qrCode:   data.totp.qr_code,   // data URI — use as <img src={qrCode}>
    secret:   data.totp.secret,    // manual entry fallback
    uri:      data.totp.uri,
  };
}

/** Challenge + verify a TOTP code during enrollment (or on any aal2 challenge) */
export async function verifyMFA(factorId: string, code: string) {
  const supabase = await createClient();

  const { data: challengeData, error: challengeErr } =
    await supabase.auth.mfa.challenge({ factorId });
  if (challengeErr) return { error: challengeErr.message };

  const { error: verifyErr } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challengeData.id,
    code: code.replace(/\s/g, ""),
  });
  if (verifyErr) return { error: verifyErr.message };

  return { success: true };
}

/** Remove a TOTP factor (disable 2FA) */
export async function unenrollMFA(factorId: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return { error: error.message };
  return { success: true };
}

/** List all enrolled MFA factors for the current user */
export async function listMFAFactors() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) return { factors: [] };
  // Only return verified TOTP factors
  return {
    factors: (data?.totp ?? []).map(f => ({
      id:           f.id,
      friendlyName: f.friendly_name ?? "Authenticator app",
      createdAt:    f.created_at,
    })),
  };
}

/** Get current + required assurance level */
export async function getMFALevel() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) return { currentLevel: "aal1", nextLevel: "aal1" };
  return {
    currentLevel: data.currentLevel,
    nextLevel:    data.nextLevel,
  };
}
