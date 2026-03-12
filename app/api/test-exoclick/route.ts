import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { Network } from "@prisma/client";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const https = require("https");
const agent = new https.Agent({ rejectUnauthorized: false });

const BASE = "https://api.exoclick.com/v2";

async function tryFetch(label: string, url: string, init: RequestInit) {
  try {
    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(8_000),
      // @ts-expect-error ssl
      agent,
    });
    const body = await res.text();
    return { label, status: res.status, body: body.slice(0, 1200) };
  } catch (e: unknown) {
    return { label, error: String(e) };
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const account = await prisma.account.findFirst({
    where: { userId: user.id, network: Network.EXOCLICK, isActive: true },
  });
  if (!account) return NextResponse.json({ error: "Aucun compte ExoClick en DB" });

  const apiToken = decrypt(account.apiKeyEnc);

  // ── Étape 1 : Login avec le token API pour obtenir un session token ──
  const loginResults = await Promise.all([
    // ✅ Méthode A : api_token (underscore) — format officiel selon la doc
    tryFetch("LOGIN {api_token} underscore", `${BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ api_token: apiToken }),
    }),
    // Méthode B : api-token (tiret)
    tryFetch("LOGIN {api-token} tiret", `${BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ "api-token": apiToken }),
    }),
    // Méthode C : token brut
    tryFetch("LOGIN {token}", `${BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ token: apiToken }),
    }),
    // Méthode D : en query param
    tryFetch("LOGIN ?api_token=", `${BASE}/login?api_token=${apiToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
    }),
    // Méthode E : Bearer direct sur /campaigns (sans passer par /login)
    tryFetch("Bearer direct /campaigns", `${BASE}/campaigns`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${apiToken}`,
        "User-Agent": "Mozilla/5.0 (compatible; AdVault/1.0)",
      },
    }),
    // Méthode F : query param directement sur /campaigns
    tryFetch("?api_token= direct /campaigns", `${BASE}/campaigns?api_token=${apiToken}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    }),
  ]);

  // ── Étape 2 : si un login a réussi (200), utiliser le session token ──
  // On re-fait le login séparément pour avoir le body complet (pas tronqué)
  const successLogin = loginResults.find(r => "status" in r && r.status === 200);
  let sessionResult = null;

  if (successLogin) {
    try {
      // Re-fetch avec body complet non tronqué
      const loginRes = await fetch(`${BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ api_token: apiToken }),
        signal: AbortSignal.timeout(8_000),
        // @ts-expect-error ssl
        agent,
      });
      const parsed = await loginRes.json() as Record<string, unknown>;
      // Le session token est dans data.token
      const sessionToken =
        (parsed?.token as string) ??
        (parsed?.result as Record<string, unknown>)?.token as string ??
        (parsed?.["api-token"] as string) ??
        (parsed?.api_token as string) ??
        (parsed?.access_token as string);

      if (sessionToken) {
        const today     = new Date().toISOString().slice(0, 10);
        const monthAgo  = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);

        // Test stats avec POST body
        const statsPost = await tryFetch("POST /statistics/a/global", `${BASE}/statistics/a/global`, {
          method: "POST",
          headers: { Authorization: `Bearer ${sessionToken}`, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ group_by: ["campaign_id"], filter: { date_from: monthAgo, date_to: today } }),
        });

        // Test stats sans group_by (toutes les stats agrégées)
        const statsGlobal = await tryFetch("POST /statistics/a/global (no group)", `${BASE}/statistics/a/global`, {
          method: "POST",
          headers: { Authorization: `Bearer ${sessionToken}`, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ filter: { date_from: monthAgo, date_to: today } }),
        });

        // Test campaigns pour voir les IDs réels
        const campaignsResult = await tryFetch("GET /campaigns", `${BASE}/campaigns`, {
          headers: { Authorization: `Bearer ${sessionToken}`, Accept: "application/json" },
        });

        sessionResult = { statsPost, statsGlobal, campaignsResult };
      }
    } catch (e) {
      sessionResult = { label: "parse error", error: String(e) };
    }
  }

  return NextResponse.json({
    apiTokenPreview: apiToken.slice(0, 10) + "...",
    loginOk: !!successLogin,
    sessionResult,
  });
}
