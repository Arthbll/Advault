/**
 * BeMob Tracker API adapter
 * Docs: https://api.bemob.com/docs/
 * Auth: Access Key + Secret Key from Settings → Profile → API Access Keys
 * Base: https://api.bemob.com
 *
 * Auth scheme: HTTP Basic Authentication
 *   Authorization: Basic base64("<access_key>:<secret_key>")
 *
 * ⚠️ IMPORTANT — BeMob is a TRACKER, not an ad network.
 * Campaigns here are tracking campaigns, not ad-buying campaigns.
 * "Pausing" a BeMob campaign stops traffic redistribution/tracking,
 * it does NOT pause spending on the underlying ad network.
 *
 * Campaign statuses:
 *   1 = active
 *   0 = paused
 *
 * ── Campaign management ────────────────────────────────────────────────────
 * GET  /api/v1/campaign                → list all campaigns
 * GET  /api/v1/campaign/{id}           → single campaign
 * PUT  /api/v1/campaign/{id}           → update campaign (status, etc.)
 *
 * ── Statistics ────────────────────────────────────────────────────────────
 * GET  /api/v1/report
 *   Params: date_from, date_to, groupBy (campaign), timezone
 *   Response: { data: [...], meta: { total, page } }
 *
 * ── Pagination ────────────────────────────────────────────────────────────
 * Most list endpoints support: page (1-indexed), per_page (default 100)
 */

const API_BASE = "https://api.bemob.com";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BemobCampaign {
  id:     string;   // integer ID as string
  name:   string;
  status: number;   // 1=active, 0=paused
  cost_model?: string;   // "CPC" | "CPM" | "CPA" | "REVSHARE"
  cost_value?: number;   // bid/cost value
  tags?:  string[];
}

export interface BemobStats {
  campaign_id:  string;
  clicks:       number;
  conversions:  number;
  revenue:      number;   // USD — affiliate revenue tracked by BeMob
  cost:         number;   // USD — traffic cost (if entered in BeMob)
  roi?:         number;
  cr?:          number;   // conversion rate %
}

export interface BemobVerifyResult {
  ok:     boolean;
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildAuthHeader(accessKey: string, secretKey: string): string {
  const credentials = Buffer.from(`${accessKey}:${secretKey}`).toString("base64");
  return `Basic ${credentials}`;
}

async function bemobFetch(
  path: string,
  accessKey: string,
  secretKey: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${API_BASE}${path}`;
  return fetch(url, {
    ...options,
    headers: {
      Authorization:  buildAuthHeader(accessKey, secretKey),
      "Content-Type": "application/json",
      Accept:         "application/json",
      ...((options.headers as Record<string, string>) ?? {}),
    },
  });
}

// ─── Exported functions ───────────────────────────────────────────────────────

/**
 * Verify credentials by making a lightweight API call.
 * Attempts to list campaigns — if the keys are invalid, the API returns 401/403.
 */
export async function verifyCredentials(
  accessKey: string,
  secretKey: string
): Promise<BemobVerifyResult> {
  try {
    const res = await bemobFetch(
      "/api/v1/campaign?per_page=1&page=1",
      accessKey,
      secretKey
    );
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "Invalid Access Key or Secret Key" };
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
 * Fetch all tracking campaigns.
 * GET /api/v1/campaign?per_page=100&page=1
 * Response: { data: BemobCampaign[], meta: { total, per_page, current_page, last_page } }
 */
export async function getCampaigns(
  accessKey: string,
  secretKey: string
): Promise<BemobCampaign[]> {
  const all: BemobCampaign[] = [];
  let page = 1;
  const perPage = 100;

  try {
    while (true) {
      const params = new URLSearchParams({
        per_page: String(perPage),
        page:     String(page),
      });

      const res = await bemobFetch(
        `/api/v1/campaign?${params}`,
        accessKey,
        secretKey
      );
      if (!res.ok) break;

      const json = await res.json() as {
        data: BemobCampaign[];
        meta?: { last_page?: number; total?: number };
      };

      const items = json.data ?? [];
      all.push(...items);

      // Stop if we're on the last page
      const lastPage = json.meta?.last_page ?? 1;
      if (page >= lastPage || items.length < perPage) break;
      page++;
    }
  } catch {
    // Return what we collected so far
  }

  return all;
}

/**
 * Fetch campaign stats for a date range, grouped by campaign.
 * GET /api/v1/report?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&groupBy=campaign&timezone=UTC
 * Response: { data: [...], meta: { ... } }
 */
export async function getCampaignStats(
  accessKey: string,
  secretKey: string,
  dateFrom:  string,  // YYYY-MM-DD
  dateTo:    string   // YYYY-MM-DD
): Promise<BemobStats[]> {
  try {
    const params = new URLSearchParams({
      date_from: dateFrom,
      date_to:   dateTo,
      groupBy:   "campaign",
      timezone:  "UTC",
    });

    const res = await bemobFetch(
      `/api/v1/report?${params}`,
      accessKey,
      secretKey
    );
    if (!res.ok) return [];

    const json = await res.json() as {
      data: Array<{
        campaign_id?: string | number;
        clicks?:      number;
        conversions?: number;
        revenue?:     number;
        cost?:        number;
        roi?:         number;
        cr?:          number;
      }>;
    };

    return (json.data ?? []).map((r) => ({
      campaign_id: String(r.campaign_id ?? ""),
      clicks:      Number(r.clicks      ?? 0),
      conversions: Number(r.conversions ?? 0),
      revenue:     parseFloat(String(r.revenue ?? 0)),
      cost:        parseFloat(String(r.cost    ?? 0)),
      roi:         parseFloat(String(r.roi     ?? 0)),
      cr:          parseFloat(String(r.cr      ?? 0)),
    }));
  } catch {
    return [];
  }
}

/**
 * Pause a campaign.
 * PUT /api/v1/campaign/{id}   body: { status: 0 }
 */
export async function pauseCampaign(
  accessKey:  string,
  secretKey:  string,
  campaignId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await bemobFetch(
      `/api/v1/campaign/${campaignId}`,
      accessKey,
      secretKey,
      { method: "PUT", body: JSON.stringify({ status: 0 }) }
    );
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
 * Resume (unpause) a campaign.
 * PUT /api/v1/campaign/{id}   body: { status: 1 }
 */
export async function resumeCampaign(
  accessKey:  string,
  secretKey:  string,
  campaignId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await bemobFetch(
      `/api/v1/campaign/${campaignId}`,
      accessKey,
      secretKey,
      { method: "PUT", body: JSON.stringify({ status: 1 }) }
    );
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
 * Kill a campaign — pauses it (BeMob has no permanent delete via public API).
 */
export async function killCampaign(
  accessKey:  string,
  secretKey:  string,
  campaignId: string
): Promise<{ ok: boolean; error?: string }> {
  return pauseCampaign(accessKey, secretKey, campaignId);
}

/**
 * Scale bid — NOTE: BeMob is a tracker, not a DSP/ad buyer.
 * It does not control bids directly. This function throws to make the
 * limitation explicit. Kept for interface compatibility.
 *
 * To scale bids, use the adapter for the underlying ad network
 * (Adsterra, ExoClick, etc.) connected to this BeMob campaign.
 */
export async function scaleBid(
  _accessKey:  string,
  _secretKey:  string,
  _campaignId: string,
  _multiplier: number
): Promise<{ oldBid: number; newBid: number }> {
  throw new Error(
    "BeMob is a tracker — it does not manage bids. " +
    "To scale bids, use the adapter for the underlying ad network."
  );
}

/**
 * Set bid — same limitation as scaleBid. Throws for interface compatibility.
 */
export async function setBid(
  _accessKey:  string,
  _secretKey:  string,
  _campaignId: string,
  _amount:     number
): Promise<void> {
  throw new Error(
    "BeMob is a tracker — it does not manage bids. " +
    "To set bids, use the adapter for the underlying ad network."
  );
}

/**
 * Map BeMob status integer to our CampaignStatus enum.
 *   1 → ACTIVE
 *   0 → PAUSED
 *   (other) → PAUSED (safe default)
 */
export function mapStatus(status: number | string): string {
  const v = Number(status);
  if (v === 1) return "ACTIVE";
  return "PAUSED";
}
