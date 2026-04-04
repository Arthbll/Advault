/**
 * GET /api/debug/sync-now
 * Triggers a full 90-day backfill sync for the current user.
 * Visit once in browser to import all campaigns from ExoClick.
 */
import { NextResponse }  from "next/server";
import { createClient }  from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const base = new URL(req.url).origin;
  const res  = await fetch(`${base}/api/sync`, {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      // Forward cookies so the sync route can authenticate the user
      Cookie: req.headers.get("cookie") ?? "",
    },
    body: JSON.stringify({ mode: "backfill" }),
  });

  const data = await res.json().catch(() => ({ error: "Réponse non-JSON" }));
  return NextResponse.json({ triggered: true, syncResult: data });
}
