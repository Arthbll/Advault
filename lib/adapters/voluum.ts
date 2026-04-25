/**
 * Voluum Tracker API adapter
 * Docs: https://developers.voluum.com/
 * Auth: POST /auth/access/session → { token } → cwauth-token header
 * Base: https://api.voluum.com
 *
 * ⚠️ IMPORTANT — Voluum is a TRACKER, not an ad network.
 * Campaigns here are tracking campaigns, not ad-buying campaigns.
 * "Pausing" a Voluum campaign stops tracking/redirecting traffic,
 * it does NOT pause spending on the underlying ad network.
 *
 * Campaign statuses:
 *   ACTIVE   → tracking traffic
 *   PAUSED   → tracking stopped
 *   ARCHIVED → hidden from main view, tracking stopped
 *
 * ── Stats ──────────────────────────────────────────────────────────────────
 * GET /report?from=<ISO>&to=<ISO>&tz=Etc/GMT&groupBy=campaign
 * Response: { rows: [...], totals: {...}, count: N }
 * Row fields: campaign (object with id/name), visits, clicks, conversions,
 *             revenue, cost, ROI, CPV, CR, ...
 *
 * ── Campaign management ────────────────────────────────────────────────────
 * GET  /campaign?resultMode=BASIC&sort=name&direction=asc&page=0&rowsPerPage=100
 * POST /command/campaign/pause    body: { idList: [id1, id2, ...] }
 * POST /command/campaign/resume   body: { idList: [id1, id2, ...] }
 * POST /command/campaign/archive  body: { idList: [id1, id2, ...] }
 */

const AUTH_BASE = "https://api.voluum.com";
const API_BASE  = "https://api.voluum.com";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VoluumCampaign {
  id:                string;   // UUID
  name:              string;
  status:            string;   // "ACTIVE" | "PAUSED" | "ARCHIVED"
  trafficSourceName: string;
  countryCode?:      string;
  tags?:             string[];
  createdAt?:        string;
}

export interface VoluumStats {
  campaign_id:  string;   // UUID
  visits:       number;
  clicks:       number;
  conversions:  number;
  revenue:      number;   // USD — affiliate revenue (what Voluum tracks)
  cost:         number;   // USD — traffic cost (if entered in Voluum)
  roi?:         number;
  cr?:          number;   // conversion rate
}

export interface VoluumVerifyResult {
  ok:     boolean;
  error?: string;
}

// ─── Token cache (in-memory, per process) ─────────────────────────────────────
// Voluum tokens are short-lived (15 min). We cache to avoid re-auth every call.

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

function cacheKey(accessId: string, accessKey: string): string {
  return `${accessId}::${accessKey}`;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

/**
 * Authenticate with Voluum and return a session token.
 * POST /auth/access/session
 * Body: { accessId: string, accessKey: string }
 * Response: { token: string, tokenExpiryDate: string }
 */
async function getToken(accessId: string, accessKey: string): Promise<string> {
  const key   = cacheKey(accessId, accessKey);
  const cache = tokenCache.get(key);

  // Use cached token if it still has >60 seconds of life
  if (cache && cache.expiresAt > Date.now() + 60_000) {
    return cache.token;
  }

  const res = await fetch(`${AUTH_BASE}/auth/access/session`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body:    JSON.stringify({ accessId, accessKey }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Voluum auth failed: ${res.status} ${text.slice(0, 200)}`);
  }

  const data = await res.json() as { token: string; tokenExpiryDate?: string };
  const token = data.token;

  // Parse expiry — default to 14 minutes from now if absent
  const expiresAt = data.tokenExpiryDate
    ? new Date(data.tokenExpiryDate).getTime()
    : Date.now() + 14 * 60_000;

  tokenCache.set(key, { token, expiresAt });
  return token;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function voluumFetch(
  path: string,
  accessId: string,
  accessKey: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getToken(accessId, accessKey);
  const url   = `${API_BASE}${path}`;
  return fetch(url, {
    ...options,
    headers: {
      "cwauth-token": token,
      "Content-Type": "application/json",
      Accept:         "application/json",
      ...((options.headers as Record<string, string>) ?? {}),
    },
  });
}

// ─── Exported functions ───────────────────────────────────────────────────────

/**
 * Verify credentials by attempting to authenticate and list one campaign.
 */
export async function verifyCredentials(
  accessId: string,
  accessKey: string
): Promise<VoluumVerifyResult> {
  try {
    await getToken(accessId, accessKey);
    // If auth succeeded, do a lightweight call to confirm API access
    const res = await voluumFetch(
      "/campaign?resultMode=BASIC&page=0&rowsPerPage=1",
      accessId,
      accessKey
    );
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "Invalid credentials or insufficient permissions" };
    }
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
 * Fetch all tracking campaigns.
 * GET /campaign?resultMode=BASIC&sort=name&direction=asc&page=0&rowsPerPage=100
 * Response: { payload: VoluumCampaign[], count: N, page: N, rowsPerPage: N }
 */
export async function getCampaigns(
  accessId: string,
  accessKey: string
): Promise<VoluumCampaign[]> {
  const all: VoluumCampaign[] = [];
  let page = 0;
  const rowsPerPage = 100;

  try {
    while (true) {
      const params = new URLSearchParams({
        resultMode: "BASIC",
        sort:       "name",
        direction:  "asc",
        page:       String(page),
        rowsPerPage: String(rowsPerPage),
      });

      const res = await voluumFetch(`/campaign?${params}`, accessId, accessKey);
      if (!res.ok) break;

      const data = await res.json() as {
        payload: VoluumCampaign[];
        count: number;
        page: number;
        rowsPerPage: number;
      };

      const items = data.payload ?? [];
      all.push(...items);

      // Stop if we got fewer than a full page
      if (items.length < rowsPerPage) break;
      page++;
    }
  } catch {
    // Return whatever we collected
  }

  return all;
}

/**
 * Fetch campaign stats for a date range.
 * GET /report?from=<ISO>&to=<ISO>&tz=Etc%2FGMT&groupBy=campaign
 * Returns cost (traffic spend) and revenue (affiliate conversions tracked).
 */
export async function getCampaignStats(
  accessId:  string,
  accessKey: string,
  dateFrom:  string,   // YYYY-MM-DD
  dateTo:    string    // YYYY-MM-DD
): Promise<VoluumStats[]> {
  try {
    // Convert YYYY-MM-DD to ISO 8601 UTC format required by Voluum
    const fromISO = `${dateFrom}T00:00:00Z`;
    const toISO   = `${dateTo}T23:59:59Z`;

    const params = new URLSearchParams({
      from:    fromISO,
      to:      toISO,
      tz:      "Etc/GMT",
      groupBy: "campaign",
    });

    const res = await voluumFetch(`/report?${params}`, accessId, accessKey);
    if (!res.ok) return [];

    const data = await res.json() as {
      rows: Array<{
        campaign?:    { id?: string; name?: string };
        visits?:      number;
        clicks?:      number;
        conversions?: number;
        revenue?:     number;
        cost?:        number;
        ROI?:         number;
        CR?:          number;
      }>;
    };

    return (data.rows ?? []).map((r) => ({
      campaign_id: r.campaign?.id ?? "",
      visits:      Number(r.visits      ?? 0),
      clicks:      Number(r.clicks      ?? 0),
      conversions: Number(r.conversions ?? 0),
      revenue:     parseFloat(String(r.revenue ?? 0)),
      cost:        parseFloat(String(r.cost    ?? 0)),
      roi:         parseFloat(String(r.ROI     ?? 0)),
      cr:          parseFloat(String(r.CR      ?? 0)),
    }));
  } catch {
    return [];
  }
}

/**
 * Pause a campaign.
 * POST /command/campaign/pause   body: { idList: [id] }
 */
export async function pauseCampaign(
  accessId:   string,
  accessKey:  string,
  campaignId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await voluumFetch("/command/campaign/pause", accessId, accessKey, {
      method: "POST",
      body:   JSON.stringify({ idList: [campaignId] }),
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
 * Resume (unpause) a campaign.
 * POST /command/campaign/resume   body: { idList: [id] }
 */
export async function resumeCampaign(
  accessId:   string,
  accessKey:  string,
  campaignId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await voluumFetch("/command/campaign/resume", accessId, accessKey, {
      method: "POST",
      body:   JSON.stringify({ idList: [campaignId] }),
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
 * Kill a campaign — archives it (Voluum has no permanent delete via API).
 * POST /command/campaign/archive   body: { idList: [id] }
 */
export async function killCampaign(
  accessId:   string,
  accessKey:  string,
  campaignId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await voluumFetch("/command/campaign/archive", accessId, accessKey, {
      method: "POST",
      body:   JSON.stringify({ idList: [campaignId] }),
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
 * Scale bid — NOTE: Voluum is a tracker, not a DSP/ad buyer.
 * It does not control bids directly. This function is a no-op stub
 * kept for interface compatibility with other adapters.
 *
 * To scale bids, use the adapter for the underlying ad network
 * (Adsterra, ExoClick, etc.) that is connected to this Voluum campaign.
 */
export async function scaleBid(
  _accessId:   string,
  _accessKey:  string,
  _campaignId: string,
  _multiplier: number
): Promise<{ oldBid: number; newBid: number }> {
  throw new Error(
    "Voluum is a tracker — it does not manage bids. " +
    "To scale bids, use the adapter for the underlying ad network."
  );
}

/**
 * Set bid — same limitation as scaleBid. No-op stub for interface compatibility.
 */
export async function setBid(
  _accessId:   string,
  _accessKey:  string,
  _campaignId: string,
  _amount:     number
): Promise<void> {
  throw new Error(
    "Voluum is a tracker — it does not manage bids. " +
    "To set bids, use the adapter for the underlying ad network."
  );
}

/**
 * Map Voluum campaign status string to our CampaignStatus enum.
 *   ACTIVE   → ACTIVE
 *   PAUSED   → PAUSED
 *   ARCHIVED → ARCHIVED
 *   (other)  → PAUSED (safe default)
 */
export function mapStatus(status: string): string {
  const s = String(status).toUpperCase();
  if (s === "ACTIVE")   return "ACTIVE";
  if (s === "ARCHIVED") return "ARCHIVED";
  return "PAUSED";
}
