import { NextResponse } from "next/server";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { Network } from "@prisma/client";

const BASE = "https://api.exoclick.com/v2";

export async function GET() {
  const supabase = await createSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await prisma.account.findFirst({
    where: { userId: user.id, network: Network.EXOCLICK, isActive: true },
  });
  if (!account) return NextResponse.json({ error: "Aucun compte ExoClick" });

  const apiToken = decrypt(account.apiKeyEnc);

  const loginRes = await fetch(`${BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
    body: JSON.stringify({ api_token: apiToken }),
    cache: "no-store", signal: AbortSignal.timeout(10_000),
  });
  if (!loginRes.ok) return NextResponse.json({ loginStatus: loginRes.status, body: await loginRes.text() });
  const bearer = (await loginRes.json()).token;

  const headers = {
    Authorization: `Bearer ${bearer}`,
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  };

  const dateFrom = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const dateTo   = new Date().toISOString().slice(0, 10);

  // Test group_by date + campaign_id in one call
  const tests: Record<string, unknown> = {};
  for (const groupBy of [["date"], ["campaign_id", "date"], ["date", "campaign_id"]]) {
    const key = groupBy.join("+");
    try {
      const res = await fetch(`${BASE}/statistics/a/global`, {
        method: "POST", headers,
        body: JSON.stringify({ group_by: groupBy, filter: { date_from: dateFrom, date_to: dateTo } }),
        cache: "no-store", signal: AbortSignal.timeout(10_000),
      });
      const text = await res.text();
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { parsed = text.slice(0, 200); }
      tests[key] = { status: res.status, preview: res.ok ? (parsed as {result?: unknown[]})?.result?.slice?.(0, 2) ?? parsed : (parsed as {message?: string})?.message };
    } catch (e) { tests[key] = String(e); }
  }

  return NextResponse.json({ tests });
}
