/**
 * GET /api/exoclick/sites
 *
 * Returns publisher sites available for targeting on ExoClick,
 * enriched with per-site zone CPM data.
 *
 * Cache strategy: sites list is stable (changes rarely), so we cache
 * the enriched result for 1 hour in memory to avoid hammering the API.
 */
import { NextResponse }           from "next/server";
import { createClient }           from "@/lib/supabase/server";
import { prisma }                 from "@/lib/prisma";
import { decrypt }                from "@/lib/crypto";
import { resolveWorkspaceUserId } from "@/lib/workspace";
import { ExoClickAdapter, ExoClickPublisherSite } from "@/lib/adapters/exoclick";
import { Network }                from "@prisma/client";

// ─── In-process cache (per-user, keyed by userId) ─────────────────────────────
const _cache: Record<string, { data: ExoClickPublisherSite[]; expiresAt: number }> = {};
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ─── COLOUR palette for the publisher selection UI ───────────────────────────
// Assign a deterministic colour from a small set based on site id.
const SITE_COLORS = [
  { color: "#c08835", rgb: "192,136,53"  },
  { color: "#a07070", rgb: "160,112,112" },
  { color: "#8575b8", rgb: "133,117,184" },
  { color: "#6b9e82", rgb: "107,158,130" },
  { color: "#4a8fb4", rgb: "74,143,180"  },
  { color: "#b09040", rgb: "176,144,64"  },
];

// ─── Similarweb rank → approximate daily traffic string ───────────────────────
function rankToTraffic(rank: number): string {
  if (rank <= 0)           return "";
  if (rank <= 50)          return "100M+/j";
  if (rank <= 200)         return "50M+/j";
  if (rank <= 500)         return "20M+/j";
  if (rank <= 1_000)       return "10M+/j";
  if (rank <= 5_000)       return "5M+/j";
  if (rank <= 10_000)      return "2M+/j";
  if (rank <= 50_000)      return "500K+/j";
  return "100K+/j";
}

// ─── Map ExoClick categories to our UI category buckets ──────────────────────
function mapCategory(cats: string[]): string {
  const joined = cats.join(" ").toLowerCase();
  if (joined.includes("cam") || joined.includes("live"))         return "Cams";
  if (joined.includes("dating") || joined.includes("adult fr"))  return "Dating";
  if (joined.includes("gay") || joined.includes("tranny") || joined.includes("trans")) return "Niche";
  if (joined.includes("hentai") || joined.includes("anime"))     return "Niche";
  if (joined.includes("mature") || joined.includes("bbw") || joined.includes("ebony")) return "Niche";
  if (joined.includes("premium") || joined.includes("studio"))   return "Premium";
  return "Tube";
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Serve from cache if fresh
    const cached = _cache[user.id];
    if (cached && Date.now() < cached.expiresAt) {
      return NextResponse.json({ sites: cached.data, fromCache: true });
    }

    const userId = await resolveWorkspaceUserId(user.id);

    const account = await prisma.account.findFirst({
      where: { userId: userId, network: Network.EXOCLICK, isActive: true },
    });
    if (!account) {
      return NextResponse.json({ error: "Aucun compte ExoClick actif" }, { status: 404 });
    }

    const apiToken = decrypt(account.apiKeyEnc);
    const adapter  = new ExoClickAdapter(apiToken);

    // Fetch raw sites list from ExoClick
    let rawSites: ExoClickPublisherSite[];
    try {
      rawSites = await adapter.getSites();
    } catch (err) {
      console.error("[/api/exoclick/sites] getSites error:", err);
      console.error("[/api/exoclick/sites] getSites error:", err);
      return NextResponse.json(
        { error: "Failed to fetch ExoClick sites" },
        { status: 502 }
      );
    }

    // Enrich: if minCpm is 0 (not in /sites response), fetch zone data for top 30 sites
    const toEnrich = rawSites.filter(s => s.minCpm === 0).slice(0, 30);
    if (toEnrich.length > 0) {
      await Promise.allSettled(
        toEnrich.map(async site => {
          const cpm = await adapter.getSiteMinCpm(site.id);
          if (cpm) {
            site.minCpm = cpm.minCpm;
            site.topCpm = cpm.topCpm;
          }
        })
      );
    }

    // Build final list with UI fields
    const enriched = rawSites
      .slice(0, 100) // cap at 100 sites
      .map((site, i) => {
        const palette = SITE_COLORS[i % SITE_COLORS.length];
        return {
          ...site,
          color:   palette.color,
          rgb:     palette.rgb,
          cat:     mapCategory(site.categories),
          traffic: site.traffic || rankToTraffic(site.similarweb),
        };
      });

    // Save to cache
    _cache[user.id] = { data: enriched, expiresAt: Date.now() + CACHE_TTL_MS };

    return NextResponse.json({ sites: enriched, fromCache: false });

  } catch (err) {
    console.error("[/api/exoclick/sites] unhandled error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
