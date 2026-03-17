import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { Network } from "@prisma/client";

// ─── Country coordinates (SVG viewBox 0 0 1000 500) ──────────────────────────
const COUNTRY_COORDS: Record<string, { x: number; y: number; label: string }> = {
  US: { x: 210, y: 165, label: "USA" },        CA: { x: 195, y: 130, label: "Canada" },
  MX: { x: 215, y: 235, label: "Mexico" },     BR: { x: 293, y: 318, label: "Brazil" },
  AR: { x: 273, y: 388, label: "Argentina" },  CO: { x: 255, y: 280, label: "Colombia" },
  GB: { x: 468, y: 132, label: "UK" },         FR: { x: 487, y: 148, label: "France" },
  DE: { x: 503, y: 138, label: "Germany" },    ES: { x: 475, y: 165, label: "Spain" },
  IT: { x: 510, y: 165, label: "Italy" },      NL: { x: 495, y: 130, label: "Netherlands" },
  BE: { x: 492, y: 135, label: "Belgium" },    PL: { x: 525, y: 132, label: "Poland" },
  RU: { x: 638, y: 115, label: "Russia" },     UA: { x: 543, y: 140, label: "Ukraine" },
  TR: { x: 558, y: 168, label: "Turkey" },     SE: { x: 508, y: 112, label: "Sweden" },
  NO: { x: 498, y: 105, label: "Norway" },     ZA: { x: 520, y: 390, label: "S. Africa" },
  NG: { x: 492, y: 285, label: "Nigeria" },    EG: { x: 543, y: 215, label: "Egypt" },
  IN: { x: 722, y: 240, label: "India" },      CN: { x: 778, y: 185, label: "China" },
  JP: { x: 895, y: 170, label: "Japan" },      KR: { x: 873, y: 185, label: "S. Korea" },
  ID: { x: 820, y: 298, label: "Indonesia" },  TH: { x: 800, y: 255, label: "Thailand" },
  VN: { x: 815, y: 258, label: "Vietnam" },    PH: { x: 858, y: 262, label: "Philippines" },
  MY: { x: 810, y: 283, label: "Malaysia" },   AU: { x: 882, y: 355, label: "Australia" },
  SA: { x: 590, y: 235, label: "Saudi Arabia" }, AE: { x: 610, y: 242, label: "UAE" },
  IL: { x: 558, y: 210, label: "Israel" },     PK: { x: 685, y: 215, label: "Pakistan" },
  CZ: { x: 515, y: 132, label: "Czech Rep." }, RO: { x: 535, y: 148, label: "Romania" },
  HU: { x: 522, y: 143, label: "Hungary" },    PT: { x: 465, y: 168, label: "Portugal" },
  GR: { x: 527, y: 175, label: "Greece" },     AT: { x: 513, y: 145, label: "Austria" },
  CH: { x: 502, y: 150, label: "Switzerland" },
};

// ExoClick numeric country ID → ISO 2-letter code
// (from their API: US=840, FR=250, etc. — ISO 3166-1 numeric)
const NUMERIC_TO_ISO: Record<number, string> = {
  840: "US", 826: "GB", 276: "DE", 250: "FR", 724: "ES", 380: "IT",
  124: "CA",  36: "AU",  76: "BR", 484: "MX", 356: "IN", 392: "JP",
  410: "KR", 643: "RU", 804: "UA", 616: "PL", 528: "NL",  56: "BE",
  752: "SE", 578: "NO", 208: "DK", 246: "FI", 756: "CH",  40: "AT",
  620: "PT", 203: "CZ", 348: "HU", 642: "RO", 792: "TR", 764: "TH",
  360: "ID", 608: "PH", 704: "VN", 458: "MY", 702: "SG", 710: "ZA",
   32: "AR", 170: "CO", 566: "NG", 818: "EG", 682: "SA", 784: "AE",
  376: "IL", 586: "PK", 156: "CN", 300: "GR",
};

const BASE = "https://api.exoclick.com/v2";

async function getSessionToken(apiToken: string): Promise<string> {
  const res = await fetch(`${BASE}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
    body: JSON.stringify({ api_token: apiToken }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`ExoClick login ${res.status}`);
  const data = await res.json();
  const token = data.token ?? data.access_token;
  if (!token) throw new Error("No token in ExoClick login response");
  return token;
}

async function getCampaignCountries(
  campaignId: string,
  bearer: string
): Promise<string[]> {
  try {
    const res = await fetch(`${BASE}/campaigns/${campaignId}`, {
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return [];
    const data = await res.json();

    // Structure: { result: { countries: { targeted: [{id: 840, regions:[...]}, ...] } } }
    const targeted: { id?: number }[] =
      data?.result?.countries?.targeted ?? [];

    return targeted
      .map(c => (c.id ? NUMERIC_TO_ISO[c.id] : undefined))
      .filter((code): code is string => !!code);
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const dateFrom = searchParams.get("dateFrom") ?? new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const dateTo   = searchParams.get("dateTo")   ?? new Date().toISOString().slice(0, 10);

  // Get synced ExoClick campaigns from DB for the date range
  const allRows = await prisma.campaign.findMany({
    where: {
      userId:   user.id,
      network:  Network.EXOCLICK,
      dateFrom: { gte: new Date(dateFrom) },
      dateTo:   { lte: new Date(dateTo + "T23:59:59Z") },
    },
  });

  // Sum impressions + spend per externalId across all days in the range
  const campaignTotals = new Map<string, { impressions: number; spend: number; name: string }>();
  for (const row of allRows) {
    const existing = campaignTotals.get(row.externalId);
    if (existing) {
      existing.impressions += row.impressions;
      existing.spend       += Number(row.spend);
    } else {
      campaignTotals.set(row.externalId, {
        impressions: row.impressions,
        spend:       Number(row.spend),
        name:        row.name,
      });
    }
  }

  const campaigns = Array.from(campaignTotals.entries()).map(([externalId, data]) => ({
    externalId,
    impressions: data.impressions,
    spend:       data.spend,
  }));

  if (campaigns.length === 0) return NextResponse.json({ dots: [] });

  // Find ExoClick account to get bearer token
  const account = await prisma.account.findFirst({
    where: { userId: user.id, network: Network.EXOCLICK, isActive: true },
  });
  if (!account) return NextResponse.json({ dots: [] });

  let bearer = "";
  try {
    bearer = await getSessionToken(decrypt(account.apiKeyEnc));
  } catch {
    return NextResponse.json({ dots: [] });
  }

  // Fetch targeting for top 10 campaigns by impressions (limit API calls)
  const topCampaigns = [...campaigns]
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10);

  // Aggregate impressions per country
  const countryImpressions = new Map<string, number>();
  const countrySpend       = new Map<string, number>();

  await Promise.all(
    topCampaigns.map(async (c: { externalId: string; impressions: number; spend: number }) => {
      const codes = await getCampaignCountries(c.externalId, bearer);
      if (codes.length === 0) return;

      // Distribute impressions equally across targeted countries
      const share = c.impressions / codes.length;
      const spendShare = Number(c.spend) / codes.length;

      for (const code of codes) {
        countryImpressions.set(code, (countryImpressions.get(code) ?? 0) + share);
        countrySpend.set(code, (countrySpend.get(code) ?? 0) + spendShare);
      }
    })
  );

  if (countryImpressions.size === 0) return NextResponse.json({ dots: [] });

  const maxImpressions = Math.max(...Array.from(countryImpressions.values()), 1);

  const dots = Array.from(countryImpressions.entries())
    .filter(([code]) => COUNTRY_COORDS[code])
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([code, imps]) => {
      const coords = COUNTRY_COORDS[code];
      const ratio  = imps / maxImpressions;
      const size   = 3 + ratio * 3;
      return {
        label:       coords.label,
        countryCode: code,
        x:           coords.x,
        y:           coords.y,
        impressions: Math.round(imps).toLocaleString("fr-FR"),
        clicks:      "—",
        spent:       (countrySpend.get(code) ?? 0).toFixed(2),
        size,
      };
    });

  return NextResponse.json({ dots, dateFrom, dateTo });
}
