/**
 * TrafficJunky API adapter — V1
 * Base: https://api.trafficjunky.com/api
 * Auth: Bearer token (JWT)
 * Docs: https://api.trafficjunky.com (Swagger UI)
 *
 * Key quirk: all endpoints require a .json suffix (e.g. /api/campaigns.json)
 * Pause/unpause: PUT /api/pauses/{campaignId}/campaigns/{isPaused}.json
 *   isPaused=1 → pause, isPaused=0 → unpause
 *
 * Budget update: PUT /api/campaigns/{id}.json  { campaign: { daily_budget: N } }
 *   NOTE: endpoint inferred from REST convention + V1 Swagger (GET /campaigns/{id}.json exists).
 *   Verify against https://api.trafficjunky.com before going live.
 */

export interface TrafficJunkyCampaign {
  campaign_id:   number;
  campaign_name: string;
  status:        string; // "active" | "paused" | etc.
}

export interface TrafficJunkyCreateParams {
  name:         string;
  dailyBudget:  number;    // daily budget cap (€)
  bid:          number;    // bid amount (€)
  bidType:      "cpm" | "cpc";
  countries?:   string[];  // ISO2 codes (e.g. ["US", "CA"])
  devices?:     string[];  // ["desktop", "mobile", "tablet"]
  url?:         string;    // destination / click URL
  active?:      boolean;   // start active or paused (default: paused)
}

export interface TrafficJunkyStats {
  campaignId:  string;
  impressions: number;
  clicks:      number;
  conversions: number;
  spent:       number;  // TrafficJunky returns "revenue" from advertiser POV = spend
  dateFrom:    string;
  dateTo:      string;
}

const BASE = "https://api.trafficjunky.com/api";

export class TrafficJunkyAdapter {
  private token: string;

  constructor(apiKey: string) {
    this.token = apiKey;
  }

  private async apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        Accept:         "application/json",
        ...(init?.headers ?? {}),
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`TrafficJunky ${path} → ${res.status} ${text}`);
    }

    return res.json() as Promise<T>;
  }

  async getCampaigns(): Promise<TrafficJunkyCampaign[]> {
    // GET /api/campaigns.json
    const data = await this.apiFetch<{ campaigns?: TrafficJunkyCampaign[] } | TrafficJunkyCampaign[]>(
      "/campaigns.json"
    );
    // Réponse peut être { campaigns: [...] } ou directement un tableau
    if (Array.isArray(data)) return data;
    return (data as { campaigns?: TrafficJunkyCampaign[] }).campaigns ?? [];
  }

  async pauseCampaign(campaignId: string): Promise<void> {
    // PUT /api/pauses/{campaignId}/campaigns/{isPaused}.json
    // isPaused: 0 => paused, 1 => active  (confirmed from Swagger spec)
    await this.apiFetch(`/pauses/${campaignId}/campaigns/0.json`, { method: "PUT" });
  }

  async resumeCampaign(campaignId: string): Promise<void> {
    // PUT /api/pauses/{campaignId}/campaigns/{isPaused}.json
    // isPaused: 0 => paused, 1 => active  (confirmed from Swagger spec)
    await this.apiFetch(`/pauses/${campaignId}/campaigns/1.json`, { method: "PUT" });
  }

  /**
   * Scale the daily budget of a campaign by a multiplier (e.g. 1.25 = +25%).
   *
   * Confirmed from Swagger V1 spec:
   *   GET  /api/campaigns/{campaignId}.json       → reads campaign (field: dailyBudget)
   *   PUT  /api/campaigns/{campaignId}.json?dailyBudget=N  → updates daily budget
   *   All params are query params, NOT request body.
   */
  async scaleDailyBudget(campaignId: string, multiplier: number): Promise<{ oldBudget: number; newBudget: number }> {
    // 1. Fetch current campaign to read dailyBudget
    const raw = await this.apiFetch<Record<string, unknown>>(
      `/campaigns/${campaignId}.json`
    );

    // Normalise: response may be { campaign: {...} } or the object directly
    const camp = (raw.campaign ?? raw) as Record<string, unknown>;

    // TJ V1 field confirmed live: "campaign_daily_budget" (string, e.g. "250.000000")
    const currentBudget =
      parseFloat(String(
        camp.campaign_daily_budget ?? camp.dailyBudget ?? camp.daily_budget ?? camp.budget ?? 0
      )) || 0;

    if (currentBudget <= 0) {
      throw new Error(
        `TrafficJunky scaleDailyBudget: could not read current budget for campaign ${campaignId}. ` +
        `Raw response: ${JSON.stringify(raw).slice(0, 200)}`
      );
    }

    const newBudget = parseFloat((currentBudget * multiplier).toFixed(2));

    // 2. PUT updated budget via query param (confirmed from Swagger spec)
    await this.apiFetch(`/campaigns/${campaignId}.json?dailyBudget=${newBudget}`, {
      method: "PUT",
    });

    return { oldBudget: currentBudget, newBudget };
  }

  /**
   * Set daily budget to a fixed € amount.
   * PUT /api/campaigns/{id}.json?dailyBudget=N
   */
  async setDailyBudget(campaignId: string, amount: number): Promise<void> {
    await this.apiFetch(`/campaigns/${campaignId}.json?dailyBudget=${amount}`, {
      method: "PUT",
    });
  }

  /**
   * Scale all active bids by a multiplier (e.g. 1.25 = +25%).
   *
   * TJ V1 Swagger confirmed endpoints:
   *   GET  /api/bids/{campaignId}/active.json  → [{ bid_id, bid, is_paused, is_active }, ...]
   *   PUT  /api/bids/{bidId}/set.json?bid={amount}  → update one bid
   *
   * Processed in small batches with delay to respect TJ rate limits.
   * Returns the max bid before/after for reference.
   */
  async scaleBid(campaignId: string, multiplier: number): Promise<{ oldBid: number; newBid: number }> {
    const bids = await this.apiFetch<Array<{ bid_id: string; bid: string; is_active: boolean }>>(
      `/bids/${campaignId}/active.json`
    );

    if (!Array.isArray(bids) || bids.length === 0) {
      return { oldBid: 0, newBid: 0 };
    }

    // Process in batches of 5 with 300ms between batches to avoid 429
    const BATCH = 5;
    for (let i = 0; i < bids.length; i += BATCH) {
      const chunk = bids.slice(i, i + BATCH);
      await Promise.all(
        chunk.map(async (b) => {
          const oldAmount = parseFloat(String(b.bid)) || 0;
          if (oldAmount <= 0) return;
          const newAmount = parseFloat((oldAmount * multiplier).toFixed(4));
          await this.apiFetch(`/bids/${b.bid_id}/set.json?bid=${newAmount}`, { method: "PUT" });
        })
      );
      if (i + BATCH < bids.length) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    // Return max bid before/after for summary
    const amounts = bids.map(b => parseFloat(String(b.bid)) || 0);
    const oldMax  = Math.max(...amounts);
    const newMax  = parseFloat((oldMax * multiplier).toFixed(4));
    return { oldBid: oldMax, newBid: newMax };
  }

  /**
   * Set all active bids proportionally so the max bid becomes `amount`.
   * Uses GET /api/bids/{campaignId}/active.json + PUT /api/bids/{bidId}/set.json?bid={amount}
   * Batched to respect TJ rate limits.
   */
  async setBid(campaignId: string, amount: number): Promise<void> {
    const bids = await this.apiFetch<Array<{ bid_id: string; bid: string; is_active: boolean }>>(
      `/bids/${campaignId}/active.json`
    );

    if (!Array.isArray(bids) || bids.length === 0) return;

    const amounts    = bids.map(b => parseFloat(String(b.bid)) || 0);
    const currentMax = Math.max(...amounts);
    if (currentMax <= 0) return;

    const multiplier = amount / currentMax;
    const BATCH = 5;
    for (let i = 0; i < bids.length; i += BATCH) {
      const chunk = bids.slice(i, i + BATCH);
      await Promise.all(
        chunk.map(async (b) => {
          const oldAmount = parseFloat(String(b.bid)) || 0;
          if (oldAmount <= 0) return;
          const newAmount = parseFloat((oldAmount * multiplier).toFixed(4));
          await this.apiFetch(`/bids/${b.bid_id}/set.json?bid=${newAmount}`, { method: "PUT" });
        })
      );
      if (i + BATCH < bids.length) {
        await new Promise(r => setTimeout(r, 300));
      }
    }
  }

  /**
   * Create a new campaign.
   * POST /api/campaigns.json
   *
   * TJ V1 Swagger fields:
   *   campaign_name (required), daily_budget (required), cpm or cpc (bid),
   *   country_codes[] (optional), status (optional: active/paused)
   *
   * NOTE: field names inferred from TJ V1 Swagger conventions + GET /campaigns.json structure.
   * Verify against https://api.trafficjunky.com before going live.
   */
  async createCampaign(params: TrafficJunkyCreateParams): Promise<{ id: string; name: string }> {
    const body: Record<string, unknown> = {
      campaign_name: params.name,
      daily_budget:  params.dailyBudget,
      status:        params.active ? "active" : "paused",
    };

    // Bid type — TJ uses cpm or cpc field name directly
    if (params.bidType === "cpc") {
      body.cpc = params.bid;
    } else {
      body.cpm = params.bid;
    }

    if (params.countries?.length) {
      body.country_codes = params.countries;
    }

    if (params.url?.trim()) {
      body.url = params.url.trim();
    }

    if (params.devices?.length) {
      // TJ device IDs: 1=desktop, 2=mobile, 3=tablet (V1 Swagger)
      const deviceMap: Record<string, number> = { desktop: 1, mobile: 2, tablet: 3 };
      body.device_type_ids = params.devices
        .map(d => deviceMap[d])
        .filter(Boolean);
    }

    const raw = await this.apiFetch<Record<string, unknown>>("/campaigns.json", {
      method: "POST",
      body:   JSON.stringify(body),
    });

    // TJ may return { campaign: {...} } or the object directly
    const camp = ((raw as Record<string, unknown>).campaign ?? raw) as Record<string, unknown>;
    const id   = String(camp.campaign_id ?? camp.id ?? "");
    const name = String(camp.campaign_name ?? camp.name ?? params.name);

    if (!id) {
      throw new Error(
        `TrafficJunky: campaign created but no ID in response: ${JSON.stringify(raw).slice(0, 200)}`
      );
    }

    return { id, name };
  }

  async getStats(dateFrom: string, dateTo: string): Promise<TrafficJunkyStats[]> {
    // GET /api/campaigns/bids/stats.json?date_from=...&date_to=...
    // "Displays the stats for Campaigns and their Bids in a given date range"
    const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });

    const data = await this.apiFetch<RawStatsResponse>(
      `/campaigns/bids/stats.json?${params.toString()}`
    );

    // Normaliser selon la structure réelle retournée
    const obj = data as Record<string, unknown>;
    const rows: RawStatRow[] = Array.isArray(data)
      ? (data as RawStatRow[])
      : ((obj.stats ?? obj.campaigns ?? obj.data ?? []) as RawStatRow[]);

    // L'endpoint bids/stats retourne une ligne PAR BID (enchère), pas par campagne.
    // On agrège par campaign_id pour éviter de compter les stats en double.
    const byCampaign = new Map<string, TrafficJunkyStats>();

    for (const row of rows) {
      const cid = String(row.campaign_id);
      const existing = byCampaign.get(cid);
      const impressions = Number(row.impressions) || 0;
      const clicks      = Number(row.clicks)      || 0;
      const conversions = Number(row.conversions) || 0;
      const spent       = parseFloat(String(row.revenue ?? row.spent ?? 0)) || 0;

      if (existing) {
        existing.impressions += impressions;
        existing.clicks      += clicks;
        existing.conversions += conversions;
        existing.spent       += spent;
      } else {
        byCampaign.set(cid, { campaignId: cid, impressions, clicks, conversions, spent, dateFrom, dateTo });
      }
    }

    return Array.from(byCampaign.values());
  }
}

// Types internes pour le parsing des réponses brutes
interface RawStatRow {
  campaign_id:  string | number;
  impressions:  string | number;
  clicks:       string | number;
  conversions:  string | number;
  revenue?:     string | number; // TrafficJunky nomme le spend "revenue" côté advertiser
  spent?:       string | number;
}

type RawStatsResponse =
  | RawStatRow[]
  | { stats?:     RawStatRow[] }
  | { campaigns?: RawStatRow[] }
  | { data?:      RawStatRow[] };
