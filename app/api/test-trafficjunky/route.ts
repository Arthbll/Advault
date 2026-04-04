import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { Network } from "@prisma/client";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const https = require("https");
const agent = new https.Agent({ rejectUnauthorized: false });

const today    = new Date().toISOString().slice(0, 10);
const monthAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);

async function tryFetch(label: string, url: string, init: RequestInit) {
  try {
    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(10_000),
      // @ts-expect-error ssl
      agent,
    });
    const body = await res.text();
    return { label, status: res.status, ok: res.ok, body: body.slice(0, 3000) };
  } catch (e: unknown) {
    return { label, error: String(e) };
  }
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await prisma.account.findFirst({
    where: { userId: user.id, network: Network.TRAFFICJUNKY, isActive: true },
  });
  if (!account) return NextResponse.json({ error: "Aucun compte TrafficJunky en DB" });

  const apiKey  = decrypt(account.apiKeyEnc);
  const preview = apiKey.slice(0, 12) + "...";

  // ── Ce qu'on sait maintenant ───────────────────────────────────────────────
  // ✅ Base URL : https://api.trafficjunky.com/api
  // ✅ Auth     : Bearer token (JWT)
  // ✅ Format   : tous les endpoints ont le suffixe .json
  // ✅ Pause    : PUT /api/pauses/{id}/campaigns/1.json  (1=pause, 0=unpause)
  // ✅ Stats    : GET /api/campaigns/bids/stats.json?date_from=&date_to=
  // ✅ Campaigns: GET /api/campaigns.json

  const BASE = "https://api.trafficjunky.com/api";
  const bearer = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: "application/json" };

  const tests = await Promise.all([
    // ── 1. Lister les campagnes ──────────────────────────────────────────────
    tryFetch("GET /api/campaigns.json", `${BASE}/campaigns.json`, { headers: bearer }),

    // ── 2. Stats globales campagnes (date range) ─────────────────────────────
    tryFetch(
      "GET /api/campaigns/bids/stats.json",
      `${BASE}/campaigns/bids/stats.json?date_from=${monthAgo}&date_to=${today}`,
      { headers: bearer }
    ),

    // ── 3. Stats simples campagne ────────────────────────────────────────────
    tryFetch(
      "GET /api/campaigns/stats.json",
      `${BASE}/campaigns/stats.json?date_from=${monthAgo}&date_to=${today}`,
      { headers: bearer }
    ),

    // ── 4. Info membre (pour valider le token) ───────────────────────────────
    tryFetch("GET /api/member.json", `${BASE}/member.json`, { headers: bearer }),

    // ── 5. Ads list (sans campaign_id, pour voir la structure) ───────────────
    // Note : /api/ads/{campaignId}.json prend un campaignId — on teste sans d'abord
    tryFetch("PATCH /api/ads (sans id, pour voir 405/422)", `${BASE}/ads`, {
      method: "PATCH", headers: bearer, body: JSON.stringify({ ids: [] }),
    }),
  ]);

  // Résumé compact
  const summary = tests.map(r => ({
    label:  r.label,
    status: "status" in r ? r.status : "ERROR",
    ok:     "ok" in r ? r.ok : false,
    body:   "body" in r ? r.body : ("error" in r ? r.error : ""),
  }));

  return NextResponse.json({ apiKeyPreview: preview, summary });
}
