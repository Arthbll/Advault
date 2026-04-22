import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { Network } from "@prisma/client";
import { resolveWorkspaceUserId } from "@/lib/workspace";
import { ExoClickAdapter }     from "@/lib/adapters/exoclick";
import { TrafficStarsAdapter } from "@/lib/adapters/trafficstars";
import * as PropellerAds        from "@/lib/adapters/propellerads";
import * as Adsterra            from "@/lib/adapters/adsterra";

// ─── In-memory cache (5 min TTL) ─────────────────────────────────────────────
const GEO_CACHE     = new Map<string, { data: unknown; expiresAt: number }>();
const GEO_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Short-lived userId cache to skip repeated Supabase+Prisma lookups on cached hits
const USER_CACHE     = new Map<string, { userId: string; expiresAt: number }>();
const USER_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// ─── Country coordinates (SVG viewBox 0 0 1000 500) ──────────────────────────
const COUNTRY_COORDS: Record<string, { x: number; y: number; label: string }> = {
  US: { x: 210, y: 165, label: "USA" },        CA: { x: 195, y: 130, label: "Canada" },
  MX: { x: 215, y: 235, label: "Mexico" },     BR: { x: 355, y: 300, label: "Brazil" },
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

// ─── Per-network stats fetchers (real country-level data) ─────────────────────

type CountryStat = { countryCode: string; impressions: number; clicks: number; spent: number };

async function getExoClickStatsByCountry(
  apiKey: string,
  dateFrom: string,
  dateTo: string
): Promise<CountryStat[]> {
  try {
    const adapter = new ExoClickAdapter(apiKey);
    return await adapter.getStatsByCountry(dateFrom, dateTo);
  } catch {
    return [];
  }
}

async function getPropellerAdsStatsByCountry(
  apiToken: string,
  dateFrom: string,
  dateTo:   string
): Promise<CountryStat[]> {
  try {
    const rows = await PropellerAds.getStatsByCountry(apiToken, dateFrom, dateTo);
    return rows.map(r => ({
      countryCode: r.country_id.toUpperCase(),
      impressions: r.impressions,
      clicks:      r.clicks,
      spent:       r.spent,
    }));
  } catch {
    return [];
  }
}

async function getAdsterraStatsByCountry(
  apiKey:   string,
  dateFrom: string,
  dateTo:   string
): Promise<CountryStat[]> {
  try {
    const rows = await Adsterra.getStatsByCountry(apiKey, dateFrom, dateTo);
    return rows.map(r => ({
      countryCode: r.country_id.toUpperCase(),
      impressions: r.impressions,
      clicks:      r.clicks,
      spent:       r.spent,
    }));
  } catch {
    return [];
  }
}

async function getTrafficStarsStatsByCountry(
  apiKey:   string,
  dateFrom: string,
  dateTo:   string
): Promise<CountryStat[]> {
  try {
    const adapter = new TrafficStarsAdapter(apiKey);
    return await adapter.getStatsByCountry(dateFrom, dateTo);
  } catch {
    return [];
  }
}

// TrafficJunky: no country-level stats API available.

export async function GET(req: NextRequest) {
  // getSession() reads the JWT from the cookie locally — no Supabase network call.
  // Safe for this read-only endpoint; write endpoints should use getUser() instead.
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── Resolve userId (cached to skip repeated Prisma lookups) ──────────────
  let userId: string;
  const userCached = USER_CACHE.get(session.user.id);
  if (userCached && userCached.expiresAt > Date.now()) {
    userId = userCached.userId;
  } else {
    userId = await resolveWorkspaceUserId(session.user.id);
    USER_CACHE.set(session.user.id, { userId, expiresAt: Date.now() + USER_CACHE_TTL });
  }

  const { searchParams } = new URL(req.url);
  const dateFrom     = searchParams.get("dateFrom") ?? new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const dateTo       = searchParams.get("dateTo")   ?? new Date().toISOString().slice(0, 10);
  const networkParam = searchParams.get("network")  ?? "ALL";

  // ── Cache check ───────────────────────────────────────────────────────────
  const cacheKey = `${userId}:${networkParam}:${dateFrom}:${dateTo}`;
  const cached = GEO_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data, {
      headers: { "X-Cache": "HIT" },
    });
  }

  // ── Fetch active accounts for requested network(s) ────────────────────────
  const accountsWhere = {
    userId,
    isActive: true,
    ...(networkParam !== "ALL" ? { network: networkParam as Network } : {}),
  };
  const accounts = await prisma.account.findMany({ where: accountsWhere });

  if (accounts.length === 0) return NextResponse.json({ dots: [] });

  // ── Aggregate country stats across all connected networks ─────────────────
  const countryMap = new Map<string, CountryStat>();

  const merge = (stats: CountryStat[]) => {
    for (const s of stats) {
      const existing = countryMap.get(s.countryCode);
      if (existing) {
        existing.impressions += s.impressions;
        existing.clicks      += s.clicks;
        existing.spent       += s.spent;
      } else {
        countryMap.set(s.countryCode, { ...s });
      }
    }
  };

  // 8s global timeout — return partial data if a network is too slow
  const withTimeout = <T>(p: Promise<T>, fallback: T, ms = 8000): Promise<T> =>
    Promise.race([p, new Promise<T>(res => setTimeout(() => res(fallback), ms))]);

  await withTimeout(
    Promise.all(
      accounts.map(async (account) => {
        const apiKey = decrypt(account.apiKeyEnc);

        if (account.network === Network.EXOCLICK) {
          merge(await getExoClickStatsByCountry(apiKey, dateFrom, dateTo));
        } else if (account.network === Network.TRAFFICSTARS) {
          merge(await getTrafficStarsStatsByCountry(apiKey, dateFrom, dateTo));
        } else if (account.network === Network.PROPELLERADS) {
          merge(await getPropellerAdsStatsByCountry(apiKey, dateFrom, dateTo));
        } else if (account.network === Network.ADSTERRA) {
          merge(await getAdsterraStatsByCountry(apiKey, dateFrom, dateTo));
        }
        // TrafficJunky: no country-level stats API available
      })
    ),
    []
  );

  // No real stats → cache + show nothing
  if (countryMap.size === 0) {
    GEO_CACHE.set(cacheKey, { data: { dots: [] }, expiresAt: Date.now() + GEO_CACHE_TTL });
    return NextResponse.json({ dots: [] });
  }

  const allStats = Array.from(countryMap.values())
    .filter(s => s.impressions > 0 && COUNTRY_COORDS[s.countryCode]);

  if (allStats.length === 0) {
    GEO_CACHE.set(cacheKey, { data: { dots: [] }, expiresAt: Date.now() + GEO_CACHE_TTL });
    return NextResponse.json({ dots: [] });
  }

  const maxImpressions = Math.max(...allStats.map(s => s.impressions), 1);

  const dots = allStats
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 8)
    .map(s => {
      const coords = COUNTRY_COORDS[s.countryCode];
      const ratio  = s.impressions / maxImpressions;
      return {
        label:       coords.label,
        countryCode: s.countryCode,
        x:           coords.x,
        y:           coords.y,
        impressions: s.impressions.toLocaleString("en-GB"),
        clicks:      s.clicks.toLocaleString("en-GB"),
        spent:       s.spent.toFixed(2),
        size:        3 + ratio * 3,
      };
    });

  const payload = { dots, dateFrom, dateTo };
  GEO_CACHE.set(cacheKey, { data: payload, expiresAt: Date.now() + GEO_CACHE_TTL });
  return NextResponse.json(payload);
}
