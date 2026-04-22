/**
 * PropellerAds SSP API v5 adapter
 * Docs: https://ssp-api.propellerads.com/v5/docs/
 * Auth: Bearer token (from Settings > API Tokens in PropellerAds dashboard)
 * Base: https://ssp-api.propellerads.com/v5
 *
 * Key API notes:
 * - Stats params: day_from / day_to (NOT date_from/date_to), group_by[] as array
 * - Bids are managed via /rates/ endpoint, NOT a bid field on the campaign
 * - Pause/resume use /campaigns/stop and /campaigns/play (bulk by campaign_ids[])
 * - Dates are in EST timezone by default (pass tz param to override)
 */

const BASE = "https://ssp-api.propellerads.com/v5";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PropellerAdsCampaign {
  id:                  number;
  name:                string;
  status:              number;   // 1=draft, 2=moderation, 3=rejected, 6=active, 7=paused, 8=stopped
  direction_id?:       number;
  rate_model?:         string;
  limit_total_amount?: number;
  limit_daily_amount?: number;
  started_at?:         string;
  is_archived?:        boolean;
}

export interface PropellerAdsCreateParams {
  name:          string;
  direction:     "onclick" | "nativeads";   // only these two are valid at creation (Swagger enum)
  rate_model:    string;   // "cpm" | "cpc" | "cpa" | "scpm" | "scpc"
  target_url?:   string;   // destination URL (required for onclick/nativeads)
  countries?:    string[]; // ISO-2 uppercase codes → lowercased for API
  bid?:          number;   // USD bid (CPM per 1000, CPC per click)
  daily_budget?: number;   // daily spend cap — min $10 for CPC/CPM, $5 for onclick CPA
  total_budget?: number;   // total campaign budget (must be > daily_budget)
  timeSlots?:    number[]; // active hours 0-23 (applied to every weekday); empty = 24/7
  // NOTE: status at creation is 1 (draft) or 2 (moderation).
  // Active/paused (6/7) is set by PA after review — not controllable at creation.
}

export interface PropellerAdsRate {
  id:          number;
  campaign_id: number;
  amount:      number;   // USD
  countries:   string[]; // ISO-2 lowercase, e.g. ["us", "fr"]
  started_at:  number;   // unix ts
  finished_at: number | null;
}

export interface PropellerAdsStats {
  campaign_id:  number;
  impressions:  number;
  clicks:       number;
  conversions:  number;
  spent:        number;  // USD
  revenue?:     number;
}

export interface PropellerAdsCountryStat {
  country_id: string;   // ISO-2 lowercase, e.g. "us"
  impressions: number;
  clicks:      number;
  conversions: number;
  spent:       number;
}

export interface PropellerAdsVerifyResult {
  ok:      boolean;
  error?:  string;
  userId?: number;
  email?:  string;
}

// ─── Status mapping ───────────────────────────────────────────────────────────

const PA_STATUS: Record<number, string> = {
  1: "DRAFT",
  2: "MODERATION",
  3: "REJECTED",
  6: "ACTIVE",
  7: "PAUSED",
  8: "STOPPED",
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

// ─── Verify ───────────────────────────────────────────────────────────────────

/**
 * Verify API token validity by fetching campaigns with limit=1
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

// ─── Campaigns ────────────────────────────────────────────────────────────────

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
    const items: PropellerAdsCampaign[] = Array.isArray(data) ? data : (data.items ?? []);
    allCampaigns.push(...items);

    if (items.length < perPage) break;
    page++;
    if (allCampaigns.length >= 500) break;
  }

  return allCampaigns;
}

// ─── Statistics ───────────────────────────────────────────────────────────────

/**
 * Fetch campaign stats for a date range.
 * Endpoint: GET /adv/statistics
 * group_by[]=campaign_id
 * Note: dates are in EST by default — pass tz="+0000" for UTC.
 */
export async function getCampaignStats(
  apiToken: string,
  dateFrom: string,  // YYYY-MM-DD
  dateTo:   string   // YYYY-MM-DD
): Promise<PropellerAdsStats[]> {
  try {
    const params = new URLSearchParams();
    params.append("group_by[]", "campaign_id");
    params.append("day_from",   dateFrom);
    params.append("day_to",     dateTo);
    params.append("tz",         "+0000");

    const res = await paFetch(`/adv/statistics?${params}`, apiToken);
    if (!res.ok) return [];

    const data = await res.json();
    // Response: array of objects, each with an "items" array
    const rows: Record<string, unknown>[] = [];
    if (Array.isArray(data)) {
      for (const group of data) {
        const items = (group as Record<string, unknown>).items;
        if (Array.isArray(items)) rows.push(...items);
        else rows.push(group as Record<string, unknown>);
      }
    } else {
      const items = (data as Record<string, unknown>).items ?? data.data ?? [];
      if (Array.isArray(items)) rows.push(...items);
    }

    return rows.map((r) => ({
      campaign_id:  Number(r.campaign_id ?? 0),
      impressions:  Number(r.impressions ?? 0),
      clicks:       Number(r.clicks ?? 0),
      conversions:  Number(r.conversions ?? 0),
      spent:        parseFloat(String(r.spent ?? 0)),
      revenue:      parseFloat(String(r.payout ?? r.revenue ?? 0)),
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch stats grouped by country (for geo map).
 * Endpoint: GET /adv/statistics
 * group_by[]=country_id
 * Returns ISO-2 country codes (lowercase) with impressions/clicks/spent.
 */
export async function getStatsByCountry(
  apiToken: string,
  dateFrom: string,  // YYYY-MM-DD
  dateTo:   string   // YYYY-MM-DD
): Promise<PropellerAdsCountryStat[]> {
  try {
    const params = new URLSearchParams();
    params.append("group_by[]", "country_id");
    params.append("day_from",   dateFrom);
    params.append("day_to",     dateTo);
    params.append("tz",         "+0000");

    const res = await paFetch(`/adv/statistics?${params}`, apiToken);
    if (!res.ok) return [];

    const data = await res.json();
    const rows: Record<string, unknown>[] = [];
    if (Array.isArray(data)) {
      for (const group of data) {
        const items = (group as Record<string, unknown>).items;
        if (Array.isArray(items)) rows.push(...items);
        else rows.push(group as Record<string, unknown>);
      }
    } else {
      const items = (data as Record<string, unknown>).items ?? data.data ?? [];
      if (Array.isArray(items)) rows.push(...items);
    }

    return rows
      .filter(r => r.country_id)
      .map((r) => ({
        country_id:  String(r.country_id).toUpperCase(),  // normalise to ISO-2 uppercase
        impressions: Number(r.impressions ?? 0),
        clicks:      Number(r.clicks ?? 0),
        conversions: Number(r.conversions ?? 0),
        spent:       parseFloat(String(r.spent ?? 0)),
      }));
  } catch {
    return [];
  }
}

// ─── Rates (Bid management) ───────────────────────────────────────────────────

/**
 * Get current rates for a campaign.
 * Each rate has { id, amount (USD), countries (ISO-2 lowercase[]) }
 */
export async function getRates(
  apiToken:   string,
  campaignId: string
): Promise<PropellerAdsRate[]> {
  try {
    const res = await paFetch(`/adv/campaigns/${campaignId}/rates/`, apiToken);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.result ?? data ?? []) as PropellerAdsRate[];
  } catch {
    return [];
  }
}

/**
 * Set rates for a campaign — replaces existing rates entirely.
 * PUT /adv/campaigns/{id}/rates/
 * Body: { rates: [{ amount: 0.05, countries: ["us", "fr"] }] }
 */
export async function setRates(
  apiToken:   string,
  campaignId: string,
  rates:      { amount: number; countries: string[] }[]
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await paFetch(`/adv/campaigns/${campaignId}/rates/`, apiToken, {
      method: "PUT",
      body:   JSON.stringify({ rates }),
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
 * Scale all rates for a campaign by a multiplier (e.g. 1.25 = +25%).
 * Reads existing rates, applies multiplier to each amount, writes back.
 */
export async function scaleBid(
  apiToken:   string,
  campaignId: string,
  multiplier: number
): Promise<{ ok: boolean; oldRates: PropellerAdsRate[]; newRates: { amount: number; countries: string[] }[]; error?: string }> {
  const currentRates = await getRates(apiToken, campaignId);
  if (currentRates.length === 0) {
    return { ok: false, oldRates: [], newRates: [], error: "No rates found for campaign" };
  }

  const newRates = currentRates.map(r => ({
    amount:    Math.round(r.amount * multiplier * 100000) / 100000,
    countries: r.countries,
  }));

  const result = await setRates(apiToken, campaignId, newRates);
  return { ...result, oldRates: currentRates, newRates };
}

/**
 * Set a fixed bid amount across all existing rates (preserving country groups).
 */
export async function setBid(
  apiToken:   string,
  campaignId: string,
  amount:     number
): Promise<{ ok: boolean; error?: string }> {
  const currentRates = await getRates(apiToken, campaignId);
  if (currentRates.length === 0) {
    // No existing rates — create one global rate with all countries wildcard
    return setRates(apiToken, campaignId, [{ amount, countries: [] }]);
  }

  const newRates = currentRates.map(r => ({ amount, countries: r.countries }));
  return setRates(apiToken, campaignId, newRates);
}

// ─── Pause / Resume ───────────────────────────────────────────────────────────

/**
 * Pause one or more campaigns.
 * PUT /adv/campaigns/stop  { campaign_ids: [id] }
 */
export async function pauseCampaign(
  apiToken:    string,
  campaignId:  string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await paFetch("/adv/campaigns/stop", apiToken, {
      method: "PUT",
      body:   JSON.stringify({ campaign_ids: [Number(campaignId)] }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `API error ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = await res.json();
    if (data.errors && Object.keys(data.errors).length > 0) {
      return { ok: false, error: JSON.stringify(data.errors) };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Resume (activate) a campaign.
 * PUT /adv/campaigns/play  { campaign_ids: [id] }
 */
export async function resumeCampaign(
  apiToken:   string,
  campaignId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await paFetch("/adv/campaigns/play", apiToken, {
      method: "PUT",
      body:   JSON.stringify({ campaign_ids: [Number(campaignId)] }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `API error ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = await res.json();
    if (data.errors && Object.keys(data.errors).length > 0) {
      return { ok: false, error: JSON.stringify(data.errors) };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Create a new campaign on PropellerAds.
 * POST /adv/campaigns
 *
 * PA requires a `targeting` object with at minimum:
 *   - `country`: array of ISO-2 lowercase codes (empty = worldwide)
 *   - `time_table`: weekday → hours map (0=Mon…6=Sun, hours 0-23)
 *     Passing all 24 hours for each day = 24/7 delivery.
 *
 * Bid is set AFTER campaign creation via PUT /campaigns/{id}/rates/
 * because PA stores rates separately from the campaign object.
 *
 * Returns { id: string, name: string }
 */
export async function createCampaign(
  apiToken: string,
  params:   PropellerAdsCreateParams
): Promise<{ id: string; name: string }> {
  const today = new Date().toISOString().slice(0, 10);

  // Build time_table: weekday 0-6 → active hours array.
  // PA uses time_table in targeting: { "0": [hours], …, "6": [hours] }.
  // If timeSlots is empty/undefined → 24/7 delivery (all 24 hours every day).
  const allHours   = Array.from({ length: 24 }, (_, i) => i);
  const activeHours = (params.timeSlots && params.timeSlots.length > 0)
    ? params.timeSlots
    : allHours;
  const timeTable: Record<string, number[]> = {};
  for (let d = 0; d <= 6; d++) timeTable[String(d)] = activeHours;

  // Countries: PA uses ISO-2 lowercase
  const countries = (params.countries ?? []).map(c => c.toLowerCase());

  // `rates` is a required field in POST /adv/campaigns (Swagger spec).
  // Build the rate object with the provided bid, or use a sensible default (0.01).
  const bidAmount = (params.bid ?? 0) > 0 ? params.bid! : 0.01;
  const rates = [{
    amount:    bidAmount,
    countries: countries.length > 0 ? countries : [],
  }];

  const body: Record<string, unknown> = {
    name:       params.name,
    direction:  params.direction,   // "onclick" | "nativeads"
    rate_model: params.rate_model,
    started_at: today,
    timezone:   "+0000",
    // Status at creation: 1=draft, 2=moderation (6=active/7=paused are post-review states).
    // We always submit to moderation (2) so PA reviews and activates it.
    status:     2,
    targeting: {
      country:    { list: countries, is_excluded: false },
      time_table: timeTable,
    },
    rates,
  };

  if (params.target_url?.trim()) body.target_url = params.target_url.trim();
  if ((params.daily_budget ?? 0) >= 5) body.daily_amount = params.daily_budget;
  if ((params.total_budget ?? 0) > 0)  body.total_amount = params.total_budget;

  const res = await paFetch("/adv/campaigns", apiToken, {
    method: "POST",
    body:   JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PropellerAds create campaign → ${res.status} ${text.slice(0, 400)}`);
  }

  const data = await res.json() as Record<string, unknown>;
  const id   = String(data.id ?? "");
  const name = String(data.name ?? params.name);

  if (!id) throw new Error(`PropellerAds: campaign created but no ID in response: ${JSON.stringify(data).slice(0, 200)}`);

  return { id, name };
}

/**
 * Kill (stop) a campaign — alias for pauseCampaign.
 */
export async function killCampaign(
  apiToken:   string,
  campaignId: string
): Promise<{ ok: boolean; error?: string }> {
  return pauseCampaign(apiToken, campaignId);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Map PA status int to our CampaignStatus enum string
 */
export function mapStatus(paStatus: number): string {
  return PA_STATUS[paStatus] ?? "PAUSED";
}
