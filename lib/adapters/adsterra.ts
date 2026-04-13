/**
 * Adsterra Advertiser API v3 adapter
 * Docs: https://adsterratools.com/advertiser-api/
 * Auth: X-API-Key header
 * Base: https://api3.adsterratools.com/advertiser/
 */

const BASE = "https://api3.adsterratools.com/advertiser";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdsterraCampaign {
  id:         number;
  title:      string;
  status:     string;  // "active" | "paused" | "pending" | "rejected" | "deleted"
  type:       string;  // ad format
  cpm?:       number;
  cpc?:       number;
  cpa?:       number;
  daily_budget?:  number;
  total_budget?:  number;
  created_at: string;
  updated_at?: string;
}

export interface AdsterraStats {
  campaign_id:  number;
  impressions:  number;
  clicks:       number;
  conversions:  number;
  spent:        number;  // USD
  revenue?:     number;
  ctr?:         number;
  cr?:          number;
}

export interface AdsterraVerifyResult {
  ok:     boolean;
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function adsterraFetch(
  path: string,
  apiKey: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "X-API-Key":    apiKey,
      "Content-Type": "application/json",
      Accept:         "application/json",
      ...((options.headers as Record<string, string>) ?? {}),
    },
  });
  return res;
}

// ─── Exported functions ───────────────────────────────────────────────────────

/**
 * Verify API key by calling /campaigns endpoint
 */
export async function verifyCredentials(apiKey: string): Promise<AdsterraVerifyResult> {
  try {
    const res = await adsterraFetch("/campaigns.json?page=1&per_page=1", apiKey);
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "Invalid or unauthorized API key" };
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `API error ${res.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `Network error: ${String(err)}` };
  }
}

/**
 * Fetch all campaigns (paginated)
 */
export async function getCampaigns(apiKey: string): Promise<AdsterraCampaign[]> {
  const allCampaigns: AdsterraCampaign[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const res = await adsterraFetch(
      `/campaigns.json?page=${page}&per_page=${perPage}`,
      apiKey
    );
    if (!res.ok) break;

    const data = await res.json();
    // Adsterra returns { items: [...] } or direct array
    const items: AdsterraCampaign[] = Array.isArray(data)
      ? data
      : (data.items ?? data.campaigns ?? data.data ?? []);

    allCampaigns.push(...items);
    if (items.length < perPage) break;
    page++;
    if (allCampaigns.length >= 500) break;
  }

  return allCampaigns;
}

/**
 * Fetch campaign stats for a date range
 * Endpoint: GET /statistics.json
 */
export async function getCampaignStats(
  apiKey: string,
  dateFrom: string,  // YYYY-MM-DD
  dateTo:   string   // YYYY-MM-DD
): Promise<AdsterraStats[]> {
  try {
    const params = new URLSearchParams({
      start_date: dateFrom,
      end_date:   dateTo,
      group:      "campaign",
      per_page:   "500",
    });

    const res = await adsterraFetch(`/statistics.json?${params}`, apiKey);
    if (!res.ok) return [];

    const data = await res.json();
    const rows = Array.isArray(data) ? data : (data.items ?? data.data ?? []);

    return rows.map((r: Record<string, unknown>) => ({
      campaign_id:  Number(r.campaign_id ?? r.id ?? 0),
      impressions:  Number(r.impressions ?? r.views ?? 0),
      clicks:       Number(r.clicks ?? 0),
      conversions:  Number(r.conversions ?? r.actions ?? 0),
      spent:        parseFloat(String(r.spent ?? r.cost ?? r.spend ?? 0)),
      revenue:      parseFloat(String(r.revenue ?? 0)),
      ctr:          parseFloat(String(r.ctr ?? 0)),
      cr:           parseFloat(String(r.cr ?? 0)),
    }));
  } catch {
    return [];
  }
}

/**
 * Pause a campaign
 * PATCH /campaigns/{id}.json  { status: "paused" }
 */
export async function pauseCampaign(apiKey: string, campaignId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await adsterraFetch(`/campaigns/${campaignId}.json`, apiKey, {
      method: "PATCH",
      body:   JSON.stringify({ status: "paused" }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `API error ${res.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Resume (activate) a campaign
 * PATCH /campaigns/{id}.json  { status: "active" }
 */
export async function resumeCampaign(apiKey: string, campaignId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await adsterraFetch(`/campaigns/${campaignId}.json`, apiKey, {
      method: "PATCH",
      body:   JSON.stringify({ status: "active" }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `API error ${res.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Kill a campaign — Adsterra has no "delete" via API, so we pause it
 */
export async function killCampaign(apiKey: string, campaignId: string): Promise<{ ok: boolean; error?: string }> {
  return pauseCampaign(apiKey, campaignId);
}

/**
 * Map Adsterra status string to our CampaignStatus enum
 */
export function mapStatus(adsterraStatus: string): string {
  const s = adsterraStatus.toLowerCase();
  if (s === "active")                        return "ACTIVE";
  if (s === "paused" || s === "stopped")     return "PAUSED";
  if (s === "pending" || s === "moderation") return "PAUSED";
  if (s === "rejected" || s === "deleted")   return "ARCHIVED";
  return "PAUSED";
}
