/**
 * Adsterra Advertiser API v3 adapter
 * Spec: https://docs.adsterratools.com/docs/public/v3/partners-api.yml
 * Auth: X-API-Key header (token from Tracking page in Adsterra user panel)
 * Base: https://api3.adsterratools.com/advertiser
 *
 * Campaign active field (integer):
 *   1 = inactive
 *   2 = inactive by limits
 *   3 = active
 *   4 = not in use
 *
 * Stats "group_by[]=campaign" response row fields:
 *   campaign (integer) — campaign id  ← NOT "campaign_id"
 *   impressions, conversions, clicks, ctr, cpm, spent, i2c
 *   NOTE: no "revenue" field exists in Adsterra stats
 *
 * ── Bid update via official V3 API ────────────────────────────────────────────
 * Spec: https://docs.adsterratools.com/docs/public/v3/partners-api.yml
 *
 * Flow to update bids:
 *   1. GET /campaign/{id}.json
 *      → reads pricing_settings: [{ price, country_code }]
 *
 *   2. GET /dictionary/countries.json
 *      → maps country_code → country_id (required for the PATCH body)
 *
 *   3. PATCH /campaign/{id}/update.json
 *      Body: { bids: [{ country_id: N, price: X }] }
 *
 *   Auth: X-API-Key header only — no session cookie needed.
 */

const BASE = "https://api3.adsterratools.com/advertiser";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdsterraCampaign {
  id:             number;
  alias:          string;   // campaign name
  active:         number;   // 1=inactive, 2=inactive by limits, 3=active, 4=not in use
  is_ssp:         string;
  format:         string;   // ad format
  pricing_type?:  string;   // CPM, CPC, CPA
  pricing_settings?: Array<{ price: number; country_code: string }>;
  total_budget_limit?:  number | null;
  daily_budget_limit?:  number | null;
}

export interface AdsterraCreateParams {
  name:           string;   // maps to `alias`
  format:         string;   // "pop" | "direct" | "banner" | "native" | "push" | "interstitial" | "video"
  pricing_type:   string;   // "CPM" | "CPC" | "CPA"
  bid?:           number;   // USD CPM/CPC bid
  countries?:     string[]; // ISO-2 uppercase codes
  daily_budget?:  number;   // daily spend cap (USD)
  total_budget?:  number;   // total campaign budget (USD)
  target_url?:    string;   // destination URL
  active?:        boolean;  // true = active (3), false = inactive (1)
}

export interface AdsterraStats {
  campaign_id:  number;   // mapped from the "campaign" field in the API response
  impressions:  number;
  clicks:       number;
  conversions:  number;
  spent:        number;   // USD — advertiser spend
  ctr?:         number;
  cpm?:         number;
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
 * Verify API key — GET /campaigns.json
 * Returns all campaigns at once (no pagination support)
 */
export async function verifyCredentials(apiKey: string): Promise<AdsterraVerifyResult> {
  try {
    const res = await adsterraFetch("/campaigns.json", apiKey);
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
 * Fetch all campaigns
 * GET /campaigns.json
 * Response: { items: AdsterraCampaign[], itemCount: number }
 * NOTE: no pagination — API returns all campaigns in one call
 */
export async function getCampaigns(apiKey: string): Promise<AdsterraCampaign[]> {
  try {
    const res = await adsterraFetch("/campaigns.json", apiKey);
    if (!res.ok) return [];

    const data = await res.json();
    // API returns { items: [...], itemCount: N }
    const items: AdsterraCampaign[] = Array.isArray(data)
      ? data
      : (data.items ?? []);

    return items;
  } catch {
    return [];
  }
}

/**
 * Fetch campaign stats for a date range, grouped by campaign
 * GET /stats.json?start_date=&finish_date=&group_by[]=campaign
 *
 * Response row when group_by[]=campaign:
 *   { campaign: <id>, impressions, conversions, clicks, ctr, cpm, spent, i2c }
 *   ⚠ The field is "campaign" (integer), NOT "campaign_id"
 *   ⚠ No "revenue" field — Adsterra stats only expose spend
 */
export async function getCampaignStats(
  apiKey: string,
  dateFrom: string,  // YYYY-MM-DD
  dateTo:   string   // YYYY-MM-DD
): Promise<AdsterraStats[]> {
  try {
    const params = new URLSearchParams({
      start_date:  dateFrom,
      finish_date: dateTo,
    });
    // group_by[] must be appended as array param
    params.append("group_by[]", "campaign");

    const res = await adsterraFetch(`/stats.json?${params}`, apiKey);
    if (!res.ok) return [];

    const data = await res.json();
    const rows: Record<string, unknown>[] = Array.isArray(data)
      ? data
      : (data.items ?? []);

    return rows.map((r) => ({
      // The API returns "campaign" (not "campaign_id") when grouped by campaign
      campaign_id: Number(r.campaign ?? 0),
      impressions:  Number(r.impressions ?? 0),
      clicks:       Number(r.clicks ?? 0),
      conversions:  Number(r.conversions ?? 0),
      spent:        parseFloat(String(r.spent ?? 0)),
      ctr:          parseFloat(String(r.ctr ?? 0)),
      cpm:          parseFloat(String(r.cpm ?? 0)),
    }));
  } catch {
    return [];
  }
}

// ─── Internal helper: resolve country_code → country_id ──────────────────────
//
// The V3 GET /campaign response uses country_code (e.g. "US"),
// but PATCH /campaign/{id}/update requires country_id (integer).
// We fetch the dictionary once per call (lightweight, ~250 entries).

async function buildCountryMap(apiKey: string): Promise<Map<string, number>> {
  const res = await fetch(`${BASE}/dictionary/countries.json`, {
    headers: { "X-API-Key": apiKey, "Accept": "application/json" },
  });
  if (!res.ok) throw new Error(`Adsterra countries dictionary failed: ${res.status}`);
  const data = await res.json() as Array<{ id: number; code?: string; country_code?: string }> | { items?: Array<{ id: number; code?: string; country_code?: string }> };
  const items = Array.isArray(data) ? data : (data.items ?? []);
  const map = new Map<string, number>();
  items.forEach(c => {
    const code = (c.code ?? c.country_code ?? "").toUpperCase();
    if (code) map.set(code, c.id);
  });
  return map;
}

// ─── Public bid functions ─────────────────────────────────────────────────────
//
// Uses the official V3 API:
//   GET  /campaign/{id}.json               → reads pricing_settings (country_code + price)
//   GET  /dictionary/countries.json        → maps country_code → country_id
//   PATCH /campaign/{id}/update.json       → writes { bids: [{ country_id, price }] }
//
// Auth: X-API-Key header only — no session cookie needed.

/**
 * Scale CPM bid by a multiplier via the V3 API.
 *
 * @param apiKey     - Adsterra V3 API key (X-API-Key)
 * @param campaignId - Public campaign ID (externalId in our DB)
 * @param multiplier - Scale factor, e.g. 1.25 for +25%
 */
export async function scaleBid(
  apiKey: string,
  campaignId: string,
  multiplier: number,
  _sessionCookie?: string  // kept for API compatibility, no longer used
): Promise<{ oldBid: number; newBid: number }> {
  const headers = { "X-API-Key": apiKey, "Content-Type": "application/json", "Accept": "application/json" };

  // 1. GET current campaign pricing
  const getRes = await adsterraFetch(`/campaign/${campaignId}.json`, apiKey);
  if (!getRes.ok) {
    const txt = await getRes.text().catch(() => "");
    throw new Error(`Adsterra GET campaign failed: ${getRes.status} ${txt.slice(0, 200)}`);
  }
  const camp = await getRes.json() as { pricing_settings?: Array<{ price: number; country_code?: string; country_id?: number }> };
  const ps = camp.pricing_settings ?? [];
  if (ps.length === 0) return { oldBid: 0, newBid: 0 };

  // 2. Map country_code → country_id
  const countryMap = await buildCountryMap(apiKey);

  const oldMax = Math.max(...ps.map(p => p.price));
  const bids = ps
    .map(p => {
      const cid = p.country_id ?? countryMap.get((p.country_code ?? "").toUpperCase()) ?? null;
      if (cid == null) return null;
      return { country_id: cid, price: parseFloat((p.price * multiplier).toFixed(4)) };
    })
    .filter((b): b is { country_id: number; price: number } => b != null);

  if (bids.length === 0) throw new Error(`Adsterra scaleBid: could not resolve country_ids for campaign ${campaignId}`);

  // 3. PATCH update
  const patchRes = await fetch(`${BASE}/campaign/${campaignId}/update.json`, {
    method: "PATCH", headers, body: JSON.stringify({ bids }),
  });
  if (!patchRes.ok) {
    const txt = await patchRes.text().catch(() => "");
    throw new Error(`Adsterra PATCH bids failed: ${patchRes.status} ${txt.slice(0, 200)}`);
  }

  return { oldBid: oldMax, newBid: parseFloat((oldMax * multiplier).toFixed(4)) };
}

/**
 * Set CPM to a fixed amount. Scales all country bids proportionally so the max = amount.
 *
 * @param apiKey     - Adsterra V3 API key
 * @param campaignId - Public campaign ID
 * @param amount     - Target max bid in USD
 */
export async function setBid(
  apiKey: string,
  campaignId: string,
  amount: number,
  _sessionCookie?: string  // kept for API compatibility, no longer used
): Promise<void> {
  const headers = { "X-API-Key": apiKey, "Content-Type": "application/json", "Accept": "application/json" };

  const getRes = await adsterraFetch(`/campaign/${campaignId}.json`, apiKey);
  if (!getRes.ok) {
    const txt = await getRes.text().catch(() => "");
    throw new Error(`Adsterra GET campaign failed: ${getRes.status} ${txt.slice(0, 200)}`);
  }
  const camp = await getRes.json() as { pricing_settings?: Array<{ price: number; country_code?: string; country_id?: number }> };
  const ps = camp.pricing_settings ?? [];
  if (ps.length === 0) return;

  const countryMap = await buildCountryMap(apiKey);
  const currentMax = Math.max(...ps.map(p => p.price));
  if (currentMax <= 0) return;

  const ratio = amount / currentMax;
  const bids = ps
    .map(p => {
      const cid = p.country_id ?? countryMap.get((p.country_code ?? "").toUpperCase()) ?? null;
      if (cid == null) return null;
      return { country_id: cid, price: parseFloat((p.price * ratio).toFixed(4)) };
    })
    .filter((b): b is { country_id: number; price: number } => b != null);

  if (bids.length === 0) throw new Error(`Adsterra setBid: could not resolve country_ids for campaign ${campaignId}`);

  const patchRes = await fetch(`${BASE}/campaign/${campaignId}/update.json`, {
    method: "PATCH", headers, body: JSON.stringify({ bids }),
  });
  if (!patchRes.ok) {
    const txt = await patchRes.text().catch(() => "");
    throw new Error(`Adsterra PATCH bids failed: ${patchRes.status} ${txt.slice(0, 200)}`);
  }
}

/**
 * Pause a campaign
 * PATCH /campaign/{id}.json  { "active": false }
 */
export async function pauseCampaign(
  apiKey: string,
  campaignId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await adsterraFetch(`/campaign/${campaignId}.json`, apiKey, {
      method: "PATCH",
      body:   JSON.stringify({ active: false }),
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
 * PATCH /campaign/{id}.json  { "active": true }
 */
export async function resumeCampaign(
  apiKey: string,
  campaignId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await adsterraFetch(`/campaign/${campaignId}.json`, apiKey, {
      method: "PATCH",
      body:   JSON.stringify({ active: true }),
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
 * Fetch stats grouped by country (for geo map).
 * GET /stats.json?group_by[]=country&start_date=&finish_date=
 * Response rows: { country: "US", impressions, clicks, conversions, spent, ... }
 */
export async function getStatsByCountry(
  apiKey:   string,
  dateFrom: string,   // YYYY-MM-DD
  dateTo:   string    // YYYY-MM-DD
): Promise<{ country_id: string; impressions: number; clicks: number; conversions: number; spent: number }[]> {
  try {
    const params = new URLSearchParams({
      start_date:  dateFrom,
      finish_date: dateTo,
    });
    params.append("group_by[]", "country");

    const res = await adsterraFetch(`/stats.json?${params}`, apiKey);
    if (!res.ok) return [];

    const data = await res.json();
    const rows: Record<string, unknown>[] = Array.isArray(data)
      ? data
      : (data.items ?? []);

    return rows
      .filter(r => r.country)
      .map(r => ({
        country_id:  String(r.country).toUpperCase(),
        impressions: Number(r.impressions ?? 0),
        clicks:      Number(r.clicks ?? 0),
        conversions: Number(r.conversions ?? 0),
        spent:       parseFloat(String(r.spent ?? 0)),
      }));
  } catch {
    return [];
  }
}

/**
 * Create a new campaign on Adsterra.
 * POST /campaigns.json
 *
 * Key Adsterra v3 campaign fields:
 *   alias           → campaign name
 *   format          → ad format ("pop", "direct", "banner", "native", "push", "interstitial")
 *   pricing_type    → "CPM" | "CPC" | "CPA"
 *   active          → 3 (active) or 1 (inactive/paused)
 *   daily_budget_limit   → daily USD cap
 *   total_budget_limit   → total USD cap
 *   pricing_settings     → [{ price, country_code }] for per-country bids
 *
 * After creation, GET /campaign/{id}.json to confirm the campaign exists.
 * Returns { id: string, name: string }
 */
export async function createCampaign(
  apiKey: string,
  params: AdsterraCreateParams
): Promise<{ id: string; name: string }> {
  const body: Record<string, unknown> = {
    alias:        params.name,
    format:       params.format,
    pricing_type: params.pricing_type,
    active:       params.active ? 3 : 1,  // 3=active, 1=inactive
  };

  if ((params.daily_budget ?? 0) > 0) body.daily_budget_limit = params.daily_budget;
  if ((params.total_budget ?? 0) > 0) body.total_budget_limit  = params.total_budget;
  if (params.target_url?.trim())       body.target_url          = params.target_url.trim();

  // Build pricing_settings: one bid per country (or a global bid if no countries)
  if ((params.bid ?? 0) > 0) {
    if (params.countries && params.countries.length > 0) {
      body.pricing_settings = params.countries.map(code => ({
        price:        params.bid,
        country_code: code.toUpperCase(),
      }));
    } else {
      // Worldwide bid — use a placeholder with empty country_code (Adsterra global)
      body.pricing_settings = [{ price: params.bid, country_code: "" }];
    }
  }

  const res = await adsterraFetch("/campaigns.json", apiKey, {
    method: "POST",
    body:   JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Adsterra create campaign → ${res.status} ${text.slice(0, 400)}`);
  }

  const data = await res.json() as Record<string, unknown>;
  const id   = String(data.id   ?? "");
  const name = String(data.alias ?? data.name ?? params.name);

  if (!id) throw new Error(`Adsterra: campaign created but no ID in response: ${JSON.stringify(data).slice(0, 200)}`);

  return { id, name };
}

/**
 * Kill a campaign — pause it (Adsterra has no delete via API)
 */
export async function killCampaign(
  apiKey: string,
  campaignId: string
): Promise<{ ok: boolean; error?: string }> {
  return pauseCampaign(apiKey, campaignId);
}

/**
 * Map Adsterra active integer to our CampaignStatus enum
 *   1 = inactive  → PAUSED
 *   2 = inactive by limits → PAUSED
 *   3 = active    → ACTIVE
 *   4 = not in use → ARCHIVED
 */
export function mapStatus(activeValue: number | string): string {
  const v = Number(activeValue);
  if (v === 3) return "ACTIVE";
  if (v === 4) return "ARCHIVED";
  return "PAUSED";
}
