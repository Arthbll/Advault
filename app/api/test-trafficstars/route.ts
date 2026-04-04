import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { Network } from "@prisma/client";

const today    = new Date().toISOString().slice(0, 10);
const monthAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);

async function tryFetch(label: string, url: string, init: RequestInit, maxBody = 3000) {
  try {
    const res  = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
    const body = await res.text();
    return { label, status: res.status, ok: res.ok, body: body.slice(0, maxBody) };
  } catch (e: unknown) {
    return { label, error: String(e) };
  }
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await prisma.account.findFirst({
    where: { userId: user.id, network: Network.TRAFFICSTARS, isActive: true },
  });
  if (!account) return NextResponse.json({ error: "Aucun compte TrafficStars en DB" });

  const apiKey = decrypt(account.apiKeyEnc);
  const preview = apiKey.slice(0, 12) + "...";

  // ─── Étape 1 : échanger le refresh token contre un access token ──────────
  const authResult = await tryFetch(
    "POST /v1/auth/token (OAuth2 exchange)",
    "https://api.trafficstars.com/v1/auth/token",
    {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams({
        grant_type:    "refresh_token",
        refresh_token: apiKey,
      }).toString(),
    },
    10_000, // don't truncate auth response — it's a big JWT
  );

  // Si l'auth échoue, on s'arrête là
  if (!authResult.ok) {
    return NextResponse.json({
      apiKeyPreview: preview,
      authResult,
      error: "Auth échouée — impossible de continuer",
    });
  }

  // Extraire l'access token — le JSON est souvent tronqué à cause du id_token géant,
  // donc on utilise une regex pour extraire access_token et expires_in directement.
  const body = (authResult as { body: string }).body ?? "";
  const atMatch  = body.match(/"access_token"\s*:\s*"([^"]+)"/);
  const expMatch = body.match(/"expires_in"\s*:\s*(\d+)/);

  const accessToken = atMatch?.[1] ?? "";
  const expiresIn   = expMatch ? Number(expMatch[1]) : 0;

  if (!accessToken) {
    return NextResponse.json({ apiKeyPreview: preview, authResult, error: "access_token introuvable dans la réponse" });
  }

  const authHeaders = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  // ─── Étape 2 : tester les campagnes ─────────────────────────────────────
  const campaignTests = await Promise.all([
    tryFetch(
      "v1.1 GET /campaigns",
      "https://api.trafficstars.com/v1.1/campaigns",
      { headers: authHeaders },
    ),
    tryFetch(
      "v1.1 GET /campaigns?status[]=enabled",
      "https://api.trafficstars.com/v1.1/campaigns?status[]=enabled",
      { headers: authHeaders },
    ),
  ]);

  const campaignOk = campaignTests.find(r => "status" in r && r.ok);
  let campaigns: unknown[] = [];
  if (campaignOk) {
    try {
      const parsed = JSON.parse((campaignOk as { body: string }).body);
      campaigns = parsed.response ?? parsed ?? [];
    } catch {}
  }

  // ─── Étape 3 : stats ─────────────────────────────────────────────────────
  let statsTests: Awaited<ReturnType<typeof tryFetch>>[] = [];
  if (campaignOk) {
    // Headers sans Content-Type pour les GET (Go bind peut ignorer query si Content-Type: application/json)
    const getHeaders = { Authorization: `Bearer ${accessToken}`, Accept: "application/json" };

    statsTests = await Promise.all([
      // v1.1 GET sans Content-Type (laisse Go binder depuis query string)
      tryFetch(
        "by-campaign GET no Content-Type",
        `https://api.trafficstars.com/v1.1/advertiser/custom/report/by-campaign?date_from=${monthAgo}&date_to=${today}`,
        { headers: getHeaders },
      ),
      tryFetch(
        "by-day GET no Content-Type",
        `https://api.trafficstars.com/v1.1/advertiser/custom/report/by-day?date_from=${monthAgo}&date_to=${today}`,
        { headers: getHeaders },
      ),
      // v1 par jour avec campaign_id pour avoir les stats d'une campagne spécifique
      tryFetch(
        "v1 stats/advertiser/day?campaign_id=1337914",
        `https://api.trafficstars.com/v1/stats/advertiser/day?date_from=${monthAgo}&date_until=${today}&campaign_id=1337914`,
        { headers: getHeaders },
      ),
      // v1 par "creative" (qui existe d'après la doc)
      tryFetch(
        "v1 stats/advertiser/creative",
        `https://api.trafficstars.com/v1/stats/advertiser/creative?date_from=${monthAgo}&date_until=${today}`,
        { headers: getHeaders },
      ),
    ]);
  }

  return NextResponse.json({
    apiKeyPreview:  preview,
    auth:           { ok: true, expiresIn, tokenPreview: accessToken.slice(0, 30) + "..." },
    campaignTests,
    campaignWorked: campaignOk?.label ?? null,
    campaignCount:  Array.isArray(campaigns) ? campaigns.length : 0,
    statsTests:     statsTests.length > 0 ? statsTests : "skipped",
  });
}
