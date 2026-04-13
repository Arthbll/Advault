"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  signTrustedDevice,
  verifyTrustedDevice,
  TRUSTED_DEVICE_COOKIE,
  TRUSTED_DEVICE_MAX_AGE,
} from "@/lib/trusted-device";

/** Mark the current device as trusted for 30 days. */
export async function setTrustedDevice() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const token = await signTrustedDevice(user.id);
  const jar = await cookies();
  jar.set(TRUSTED_DEVICE_COOKIE, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   TRUSTED_DEVICE_MAX_AGE,
    path:     "/",
  });
  return { success: true };
}

/** Remove the trusted-device cookie (e.g. on manual logout or security reset). */
export async function clearTrustedDevice() {
  const jar = await cookies();
  jar.delete(TRUSTED_DEVICE_COOKIE);
}

/** Server-side check: is the current device trusted for a given userId? */
export async function isTrustedDevice(userId: string): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(TRUSTED_DEVICE_COOKIE)?.value;
  if (!token) return false;
  return verifyTrustedDevice(token, userId);
}
