/**
 * ExoClick API v2 adapter
 * Auth: POST /login { api_token } → Bearer session token (expires 12h)
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const https = require("https");
const agent = new https.Agent({ rejectUnauthorized: false });

const BASE = "https://api.exoclick.com/v2";

// Headers communs pour passer le WAF Cloudflare d'ExoClick
const CF_HEADERS: Record<string, string> = {
  "User-Agent":      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept":          "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Origin":          "https://www.exoclick.com",
  "Referer":         "https://www.exoclick.com/",
  "Sec-Fetch-Dest":  "empty",
  "Sec-Fetch-Mode":  "cors",
  "Sec-Fetch-Site":  "same-site",
};

// Cache module-level — partagé entre toutes les requêtes du process Next.js
const _sessionCache: Record<string, { token: string; expiry: number }> = {};

export interface ExoClickCreateParams {
  name:         string;
  bid:          number;
  bidType:      "cpm" | "cpc";
  adFormat:     number;  // zone type ID
  active:       boolean;
  dailyBudget?: number;
  totalBudget?: number;
  countries?:   string[];
  devices?:     string[];
  startAt?:     string;  // YYYY-MM-DD
  endAt?:       string;
}

export interface ExoClickCampaign {
  id:     string;
  name:   string;
  status: "active" | "paused" | "stopped";
}

export interface ExoClickStats {
  campaignId:  string;
  impressions: number;
  clicks:      number;
  conversions: number;
  revenue:     number;
  spent:       number;
  dateFrom:    string;
  dateTo:      string;
}

// ─── Status mapping ────────────────────────────────────────────────────────────
// ExoClick uses numeric statuses:  1 = active, 2 = paused, others = stopped
function mapStatus(raw: unknown): "active" | "paused" | "stopped" {
  const v = String(raw ?? "").toLowerCase();
  // ExoClick: 1 = active, 0 = paused, autres = stopped
  if (v === "1" || v === "active")  return "active";
  if (v === "0" || v === "2" || v === "paused") return "paused";
  return "stopped";
}

function toNum(v: unknown): number {
  const n = parseFloat(String(v ?? 0));
  return isNaN(n) ? 0 : n;
}

// ─── Adapter ──────────────────────────────────────────────────────────────────
export class ExoClickAdapter {
  private sessionToken: string | null = null;
  private sessionExpiry: number = 0;

  constructor(private readonly apiToken: string) {}

  private async login(): Promise<string> {
    const res = await fetch(`${BASE}/login`, {
      method: "POST",
      headers: {
        ...CF_HEADERS,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ api_token: this.apiToken }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
      // @ts-expect-error undici ssl bypass
      agent,
    });

    const rawText = await res.text();
    if (!res.ok) {
      throw new Error(`ExoClick login HTTP ${res.status}: ${rawText.slice(0, 300)}`);
    }
    let data: Record<string, unknown>;
    try { data = JSON.parse(rawText); }
    catch { throw new Error(`ExoClick login: réponse non-JSON (${res.status}) — ${rawText.slice(0, 300)}`); }

    const token = (data?.token ?? data?.access_token) as string;
    if (!token) throw new Error(`ExoClick login: pas de token — ${JSON.stringify(data).slice(0, 200)}`);

    const expiresIn = (data?.expires_in as number) ?? 43200;
    _sessionCache[this.apiToken] = { token, expiry: Date.now() + (expiresIn - 600) * 1000 };
    return token;
  }

  private loginPromise: Promise<string> | null = null;

  private async getSession(): Promise<string> {
    // 1. Instance-level cache
    if (this.sessionToken && Date.now() < this.sessionExpiry) return this.sessionToken;
    // 2. Module-level cache — partagé entre toutes les instances (sync, create…)
    const cached = _sessionCache[this.apiToken];
    if (cached && Date.now() < cached.expiry) {
      this.sessionToken  = cached.token;
      this.sessionExpiry = cached.expiry;
      return cached.token;
    }
    // 3. Login frais — dédoublonné si appels simultanés
    if (!this.loginPromise) {
      this.loginPromise = this.login()
        .then(token => {
          this.sessionToken  = token;
          this.sessionExpiry = _sessionCache[this.apiToken]?.expiry ?? Date.now() + 43200_000;
          return token;
        })
        .finally(() => { this.loginPromise = null; });
    }
    return this.loginPromise;
  }

  private async apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const session = await this.getSession();
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        ...CF_HEADERS,
        Authorization: `Bearer ${session}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
      // @ts-expect-error undici ssl bypass
      agent,
    });

    const text = await res.text();
    if (!res.ok) {
      if (res.status === 401) { delete _sessionCache[this.apiToken]; }
      throw new Error(`ExoClick ${path} → HTTP ${res.status}: ${text.slice(0, 300)}`);
    }

    try { return JSON.parse(text) as T; }
    catch { throw new Error(`ExoClick ${path}: réponse non-JSON — ${text.slice(0, 200)}`); }
  }

  async getCampaigns(): Promise<ExoClickCampaign[]> {
    // result est un objet { "id": {campaign}, ... } ou un tableau
    const data = await this.apiFetch<{ result: unknown }>("/campaigns");
    const raw = data?.result ?? {};

    const list: Record<string, unknown>[] = Array.isArray(raw)
      ? raw as Record<string, unknown>[]
      : Object.values(raw as Record<string, unknown>) as Record<string, unknown>[];

    return list.map(c => ({
      id:     String(c.id   ?? c.campaign_id ?? ""),
      name:   String(c.name ?? c.title       ?? "Sans nom"),
      status: mapStatus(c.status ?? c.is_active),
    }));
  }

  async pauseCampaign(campaignId: string): Promise<void> {
    await this.apiFetch(`/campaigns/${campaignId}`, {
      method: "PUT",
      body: JSON.stringify({ status: 2 }),
    });
  }

  async resumeCampaign(campaignId: string): Promise<void> {
    await this.apiFetch(`/campaigns/${campaignId}`, {
      method: "PUT",
      body: JSON.stringify({ status: 1 }),
    });
  }

  async createCampaign(params: ExoClickCreateParams): Promise<{ id: string; name: string }> {
    const body: Record<string, unknown> = {
      name:         params.name,
      bid:          params.bid,
      bid_type:     params.bidType,
      status:       params.active ? 1 : 2,
      ad_zone_type: params.adFormat,
    };
    if (params.dailyBudget)     body.daily_budget = params.dailyBudget;
    if (params.totalBudget)     body.budget       = params.totalBudget;
    if (params.countries?.length) body.countries  = params.countries;
    if (params.devices?.length)   body.devices    = params.devices;
    if (params.startAt) body.start_at = params.startAt;
    if (params.endAt)   body.end_at   = params.endAt;

    const data = await this.apiFetch<{ result: Record<string, unknown> }>("/campaigns", {
      method: "POST",
      body:   JSON.stringify(body),
    });
    const result = (data?.result ?? data) as Record<string, unknown>;
    return { id: String(result.id ?? ""), name: String(result.name ?? params.name) };
  }

  async getStats(dateFrom: string, dateTo: string): Promise<ExoClickStats[]> {
    const data = await this.apiFetch<{ result: unknown }>(
      `/statistics/a/global`,
      {
        method: "POST",
        body: JSON.stringify({
          group_by: ["campaign_id"],
          filter:   { date_from: dateFrom, date_to: dateTo },
        }),
      }
    );

    const raw = data?.result ?? [];
    const list: Record<string, unknown>[] = Array.isArray(raw)
      ? raw as Record<string, unknown>[]
      : Object.values(raw as Record<string, unknown>) as Record<string, unknown>[];

    return list.map(row => {
      const goals   = (row.goals    ?? {}) as Record<string, unknown>;
      const groupBy = (row.group_by ?? {}) as Record<string, unknown>;
      // campaign_id est dans group_by.campaign_id.id
      const campaignId =
        ((groupBy.campaign_id as Record<string, unknown>)?.id as string) ??
        String(row.campaign_id ?? row.id ?? "");

      return {
        campaignId,
        impressions: toNum(row.impressions),
        clicks:      toNum(row.clicks),
        conversions: toNum(goals.total ?? goals.total_goals ?? row.conversions ?? 0),
        revenue:     toNum(goals.revenue ?? goals.revenue_goals ?? row.revenue ?? 0),
        spent:       toNum(row.cost ?? row.spent ?? 0),
        dateFrom,
        dateTo,
      };
    });
  }
}
