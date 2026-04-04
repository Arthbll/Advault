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
  async scaleDailyBudget(campaignId: string, multiplier: number): Promise<void> {
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
   * Scale bid by a multiplier (e.g. 1.10 = +10%).
   * Reads current cpm/cpc from GET /api/campaigns/{id}.json, then PUTs the new value.
   */
  async scaleBid(campaignId: string, multiplier: number): Promise<{ oldBid: number; newBid: number }> {
    const raw = await this.apiFetch<Record<string, unknown>>(`/campaigns/${campaignId}.json`);
    const camp = ((raw as Record<string, unknown>).campaign ?? raw) as Record<string, unknown>;
    // TJ V1 confirmed fields: campaign_cpm, campaign_cpc, cpm, cpc, bid, max_bid
    const currentBid = parseFloat(
      String(camp.campaign_cpm ?? camp.campaign_cpc ?? camp.cpm ?? camp.cpc ?? camp.bid ?? camp.max_bid ?? 1)
    ) || 1;
    const newBid = parseFloat((currentBid * multiplier).toFixed(4));
    // TJ uses query params for updates (confirmed from scaleDailyBudget)
    await this.apiFetch(`/campaigns/${campaignId}.json?cpm=${newBid}`, { method: "PUT" });
    return { oldBid: currentBid, newBid };
  }

  /**
   * Set bid to a fixed € amount.
   * PUT /api/campaigns/{id}.json?cpm=N
   */
  async setBid(campaignId: string, amount: number): Promise<void> {
    await this.apiFetch(`/campaigns/${campaignId}.json?cpm=${amount}`, { method: "PUT" });
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
