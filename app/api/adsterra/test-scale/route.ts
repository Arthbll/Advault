/**
 * Debug route: test Adsterra V3 API bid scaling.
 *
 * PATCH /campaign/{id}/update.json supports `bids: [{ country_id, price }]`
 * via X-API-Key — no session cookie needed.
 *
 * GET /api/adsterra/test-scale          → show campaign pricing_settings structure
 * GET /api/adsterra/test-scale?dry=true → same but also test PATCH with current prices (no-op)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@/lib/supabase/server";
import { prisma }                    from "@/lib/prisma";
import { decrypt }                   from "@/lib/crypto";
import { Network }                   from "@prisma/client";
import { resolveWorkspaceUserId }    from "@/lib/workspace";

const V3_BASE = "https://api3.adsterratools.com/advertiser";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId     = await resolveWorkspaceUserId(user.id);
  const campaignId = req.nextUrl.searchParams.get("campaignId") ?? "";
  const dry        = req.nextUrl.searchParams.get("dry") === "true";

  const campaign = campaignId
    ? await prisma.campaign.findFirst({ where: { externalId: campaignId, userId, network: Network.ADSTERRA }, include: { account: true } })
    : await prisma.campaign.findFirst({ where: { userId, network: Network.ADSTERRA }, include: { account: true } });

  if (!campaign) return NextResponse.json({ error: "No Adsterra campaign found" }, { status: 404 });

  const apiKey = decrypt(campaign.account.apiKeyEnc);
  const results: Record<string, unknown> = {
    campaign: { id: campaign.id, externalId: campaign.externalId, name: campaign.name },
  };

  const headers = {
    "X-API-Key":    apiKey,
    "Content-Type": "application/json",
    "Accept":       "application/json",
  };

  // ── Step 1: GET campaign to see pricing_settings structure ────────────────
  try {
    const getRes = await fetch(`${V3_BASE}/campaign/${campaign.externalId}.json`, { headers });
    const getText = await getRes.text();
    let getData: unknown;
    try { getData = JSON.parse(getText); } catch { getData = getText.slice(0, 200); }

    if (!getRes.ok) {
      results.step1_get = { ok: false, status: getRes.status, body: getData };
    } else {
      const camp = getData as { pricing_type?: string; pricing_settings?: Array<{ price: number; country_code?: string; country_id?: number }> };
      results.step1_get = {
        ok:              true,
        status:          getRes.status,
        pricing_type:    camp.pricing_type,
        pricing_settings: camp.pricing_settings,
        has_country_id:  camp.pricing_settings?.[0] != null && 'country_id' in camp.pricing_settings[0],
        has_country_code: camp.pricing_settings?.[0] != null && 'country_code' in camp.pricing_settings[0],
      };

      // ── Step 2: Test PATCH update with bids (dry run = keep same prices) ────
      if (dry && camp.pricing_settings && camp.pricing_settings.length > 0) {
        // First, fetch countries dictionary to map country_code → country_id
        let countryMap: Record<string, number> = {};
        try {
          const dictRes = await fetch(`${V3_BASE}/dictionary/countries.json`, { headers });
          if (dictRes.ok) {
            const dictData = await dictRes.json() as Array<{ id: number; code?: string; country_code?: string }>;
            const items = Array.isArray(dictData) ? dictData : (dictData as { items?: Array<{ id: number; code?: string; country_code?: string }> }).items ?? [];
            items.forEach(c => {
              const code = c.code ?? c.country_code ?? '';
              if (code) countryMap[code.toUpperCase()] = c.id;
            });
          }
        } catch (e) {
          results.step2_country_dict = { error: String(e) };
        }
        results.step2_country_map_size = Object.keys(countryMap).length;

        // Build bids array
        const bids = camp.pricing_settings
          .filter(p => p.country_code || p.country_id)
          .map(p => {
            const cid = p.country_id ?? countryMap[p.country_code?.toUpperCase() ?? ''] ?? null;
            return cid != null ? { country_id: cid, price: p.price } : null;
          })
          .filter((b): b is { country_id: number; price: number } => b != null);

        results.step2_bids_built = bids;

        if (bids.length > 0) {
          const patchRes = await fetch(`${V3_BASE}/campaign/${campaign.externalId}/update.json`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ bids }),
          });
          const patchText = await patchRes.text();
          let patchData: unknown;
          try { patchData = JSON.parse(patchText); } catch { patchData = patchText.slice(0, 200); }
          results.step2_patch = { ok: patchRes.ok, status: patchRes.status, body: patchData };
        } else {
          results.step2_patch = { skipped: "no bids could be mapped to country_id" };
        }
      }
    }
  } catch (e) {
    results.step1_get = { ok: false, error: String(e) };
  }

  return NextResponse.json(results, { status: 200 });
}
