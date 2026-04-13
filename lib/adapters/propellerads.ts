/**
 * PropellerAds SSP API v5 adapter
 * Docs: https://developers.propellerads.com/
 * Auth: Bearer token (from Settings > API Tokens in PropellerAds dashboard)
 * Base: https://ssp-api.propellerads.com/v5/
 */

const BASE = "https://ssp-api.propellerads.com/v5";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PropellerAdsCampaign {
  id:         number;
  title:      string;
  status:     number;  // 1=active, 2=paused, 3=moderation, 4=deleted
  ad_format:  number;
  bid:        number;
  daily_budget?: number;
  total_budget?: number;
  created_at: string;
  updated_at: string;
}

export interface PropellerAdsStats {
  campaign_id:  number;
  impressions:  number;
  clicks:       number;
  conversions:  number;
  spent:        number;  // USD
  revenue?:     number;
}

export interface PropellerAdsVerifyResult {
  ok:      boolean;
  error?:  string;
  userId?: number;
  email?:  string;
}

// ─── Status mapping ───────────────────────────────────────────────────────────

const PA_STATUS: Record<number, string> = {
  1: "ACTIVE",
  2: "PAUSED",
  3: "MODERATION",
  4: "DELETED",
  5: "REJECTED",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function paFetch(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept:         "application/json",
      ...((options.headers as Record<string, string>) ?? {}),
    },
  });
  return res;
}

// ─── Exported functions ───────────────────────────────────────────────────────

/**
 * Verify API token validity by calling /adv/campaigns with limit=1
 */
export async function verifyCredentials(apiToken: string): Promise<PropellerAdsVerifyResult> {
  try {
    const res = await paFetch("/adv/campaigns?page=1&per-page=1", apiToken);
    if (res.status === 401) return { ok: false, error: "Invalid API token" };
    if (res.status === 403) return { ok: false, error: "API access forbidden — ensure your account has API access enabled" };
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
 * Fetch all campaigns (paginated, up to 500)
 */
export async function getCampaigns(apiToken: string): Promise<PropellerAdsCampaign[]> {
  const allCampaigns: PropellerAdsCampaign[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const res = await paFetch(`/adv/campaigns?page=${page}&per-page=${perPage}`, apiToken);
    if (!res.ok) break;

    const data = await res.json();
    // API returns { items: [...], total_count: N } or directly an array
    const items: PropellerAdsCampaign[] = Array.isArray(data) ? data : (data.items ?? []);
    allCampaigns.push(...items);

    if (items.length < perPage) break;
    page++;
    if (allCampaigns.length >= 500) break;
  }

  return allCampaigns;
}

/**
 * Fetch campaign stats for a date range
 * Endpoint: GET /adv/statistics/campaigns
 */
export async function getCampaignStats(
  apiToken: string,
  dateFrom: string,  // YYYY-MM-DD
  dateTo:   string   // YYYY-MM-DD
): Promise<PropellerAdsStats[]> {
  try {
    const params = new URLSearchParams({
      date_from:  dateFrom,
      date_to:    dateTo,
      group_by:   "campaign_id",
      per_page:   "500",
    });

    const res = await paFetch(`/adv/statistics/campaigns?${params}`, apiToken);
    if (!res.ok) return [];

    const data = await res.json();
    const rows = Array.isArray(data) ? data : (data.items ?? data.data ?? []);

    return rows.map((r: Record<string, unknown>) => ({
      campaign_id:  Number(r.campaign_id ?? r.id ?? 0),
      impressions:  Number(r.impressions ?? r.views ?? 0),
      clicks:       Number(r.clicks ?? 0),
      conversions:  Number(r.conversions ?? 0),
      spent:        parseFloat(String(r.spent ?? r.cost ?? 0)),
      revenue:      parseFloat(String(r.revenue ?? 0)),
    }));
  } catch {
    return [];
  }
}

/**
 * Pause a campaign
 */
export async function pauseCampaign(apiToken: string, campaignId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await paFetch(`/adv/campaigns/${campaignId}`, apiToken, {
      method: "PUT",
      body:   JSON.stringify({ status: 2 }),
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
 */
export async function resumeCampaign(apiToken: string, campaignId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await paFetch(`/adv/campaigns/${campaignId}`, apiToken, {
      method: "PUT",
      body:   JSON.stringify({ status: 1 }),
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
 * Kill (permanently pause) a campaign — PropellerAds uses status 2 for paused
 * There's no "kill" concept, so we pause it
 */
export async function killCampaign(apiToken: string, campaignId: string): Promise<{ ok: boolean; error?: string }> {
  return pauseCampaign(apiToken, campaignId);
}

/**
 * Map PA status int to our CampaignStatus enum string
 */
export function mapStatus(paStatus: number): string {
  return PA_STATUS[paStatus] ?? "PAUSED";
}
