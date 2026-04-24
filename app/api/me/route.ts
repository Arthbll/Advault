/**
 * GET /api/me
 * Returns the authenticated user's display info for the header chip:
 * name, initials, and plan label.
 *
 * Plan resolution order:
 *   1. user_metadata.plan  (set during onboarding or billing webhook)
 *   2. "Starter"           (default fallback)
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const meta = user.user_metadata as Record<string, unknown> | null ?? {};

  // Display name: prefer display_name metadata, fall back to email prefix
  const displayName: string =
    (meta.display_name as string | undefined) ??
    (user.email?.split("@")[0] ?? "User");

  // Full name for the chip (capitalise words)
  const name = displayName
    .split(/[\s._-]+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  // Initials: up to 2 characters
  const words = name.split(" ");
  const initials = words.length >= 2
    ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();

  // Plan: observer → operator → dominion
  const rawPlan = (meta.plan as string | undefined) ?? "observer";
  const planId  = rawPlan.toLowerCase();                    // "observer" | "operator" | "dominion"
  const planLabels: Record<string, string> = {
    observer: "Free",
    operator: "Operator",
    dominion: "Dominion",
  };
  const plan = planLabels[planId] ?? "Free";               // label affiché dans le chip

  // Roles: admin > operator > member
  const rawRole = (meta.role as string | undefined) ?? "operator";
  const role: string =
    rawRole === "admin"  ? "Admin"    :
    rawRole === "member" ? "Member"   :
                           "Operator";

  return NextResponse.json({ name, initials, plan, planId, role });
}
