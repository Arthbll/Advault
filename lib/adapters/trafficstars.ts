/**
 * TrafficStars API adapter
 * Docs: https://docs.trafficstars.com/#/
 *
 * Auth flow (OAuth2):
 *   The stored API key is an offline/refresh token.
 *   It must be exchanged for a short-lived access_token (JWT, 10h TTL) before use:
 *     POST /v1/auth/token
 *       Content-Type: application/x-www-form-urlencoded
 *       grant_type=refresh_token&refresh_token=<apiKey>
 *     → { access_token, expires_in }
 *
 * Verified endpoints:
 *   GET  /v1.1/campaigns                                    → list campaigns
 *   PUT  /v2/campaigns/pause   body: { campaign_ids: [] }  → pause
 *   PUT  /v2/campaigns/run     body: { campaign_ids: [] }  → resume
 *   GET  /v1.1/advertiser/custom/report/by-campaign        → stats per campaign
 *   POST /v1.1/banners                                      → create banner/creative
 *     body: { campaign_id, name, urls: [redirectUrl] }      → Popunder / Direct
 *     body: { campaign_id, name, content, width, height }   → Image banner (base64)
 */

export interface TrafficStarsCampaign {
  id:     string;
  name:   string;
  status: "active" | "paused"; // normalised: enabled→active, everything else→paused
}

export interface TrafficStarsCreateParams {
  name:          string;
  format_id:     number;   // 1=Banner 300x250, 7=Popunder, 23=Banner 728x90, 62=Native, 63=Video, 104=Push, 105=Interstitiel
  pricing_model: "cpm" | "cpc" | "cpa";
  price:         number;   // bid (CPM = per 1000 imps, CPC = per click)
  max_daily:     number;   // daily budget cap
  type?:         string;   // image | direct | video | html5 | vast | dynamic | rtb
  countries?:    string[]; // ["FR", "US", ...]
  devices?:      number[]; // intentionally unused — see createCampaign() note
  traffic_type?: string;   // ron | prime | members_area
  active?:       boolean;  // start paused by default if omitted
  timeSlots?:    number[]; // active hours 0-23; empty/undefined = 24/7 delivery
  // Creative / banner fields (optional — attached via POST /v1.1/banners after campaign creation)
  url?:          string;   // destination / redirect URL (required for Popunder & image banners)
}

export interface TrafficStarsCreateBannerParams {
  campaign_id: number;
  name:        string;
  // Redirect / Popunder: just a destination URL
  url?:        string;
  // Image banner: base64-encoded image content + dimensions
  content?:    string; // base64
  width?:      number;
  height?:     number;
}

export interface TrafficStarsStats {
  campaignId:  string;
  impressions: number;
  clicks:      number;
  conversions: number;
  spent:       number;
  dateFrom:    string;
  dateTo:      string;
}

const BASE    = "https://api.trafficstars.com/v1.1";
const BASE_V2 = "https://api.trafficstars.com/v2";
const AUTH    = "https://api.trafficstars.com/v1/auth/token";

// In-memory token cache (per refresh token)
const tokenCache = new Map<string, { accessToken: string; expiresAt: number }>();

export class TrafficStarsAdapter {
  private refreshToken: string;

  constructor(apiKey: string) {
    // apiKey here is the offline/refresh token from the profile page
    this.refreshToken = apiKey;
  }

  /** Exchange refresh token → access token (cached, refreshed before expiry) */
  private async getAccessToken(): Promise<string> {
    const cached = tokenCache.get(this.refreshToken);
    // Keep a 60s buffer before expiry
    if (cached && cached.expiresAt > Date.now() + 60_000) {
      return cached.accessToken;
    }

    const body = new URLSearchParams({
      grant_type:    "refresh_token",
      refresh_token: this.refreshToken,
    });

    const res = await fetch(AUTH, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    body.toString(),
      signal:  AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`TrafficStars auth failed → ${res.status} ${text}`);
    }

    const data = await res.json() as { access_token: string; expires_in: number };
    const accessToken = data.access_token;
    const expiresAt   = Date.now() + (data.expires_in ?? 36000) * 1000;

    tokenCache.set(this.refreshToken, { accessToken, expiresAt });
    return accessToken;
  }

  private async fetch<T>(url: string, init?: RequestInit): Promise<T> {
    const accessToken = await this.getAccessToken();

    // Only set Content-Type: application/json when there's a body (POST/PUT).
    // For GET requests, setting it causes Go/Gin to look for params in the JSON body
    // instead of the query string — leading to "required" validation errors.
    const hasBody = !!init?.body;

    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`TrafficStars ${url} → ${res.status} ${text}`);
    }

    return res.json() as Promise<T>;
  }

  /**
   * GET /v1.1/campaigns
   * Response: { "response": [ { id, name, status, active, ... } ] }
   *
   * Status normalisation:
   *   status === "enabled"  → "active"
   *   everything else       → "paused"
   */
  async getCampaigns(): Promise<TrafficStarsCampaign[]> {
    const data = await this.fetch<{ response: RawCampaign[] }>(
      `${BASE}/campaigns`,
    );

    return (data.response ?? []).map(c => ({
      id:     String(c.id),
      name:   c.name,
      status: c.status === "enabled" ? "active" : "paused",
    }));
  }

  /**
   * PUT /v2/campaigns/pause
   * Body: { campaign_ids: [id] }
   */
  async pauseCampaign(campaignId: string): Promise<void> {
    await this.fetch(`${BASE_V2}/campaigns/pause`, {
      method: "PUT",
      body:   JSON.stringify({ campaign_ids: [Number(campaignId)] }),
    });
  }

  /**
   * PUT /v2/campaigns/run
   * Body: { campaign_ids: [id] }
   */
  async resumeCampaign(campaignId: string): Promise<void> {
    await this.fetch(`${BASE_V2}/campaigns/run`, {
      method: "PUT",
      body:   JSON.stringify({ campaign_ids: [Number(campaignId)] }),
    });
  }

  /**
   * Augmente le budget journalier d'une campagne TrafficStars.
   * PATCH /v1.1/campaigns/{id}  body: { max_daily: newBudget }
   * multiplier=1.25 → +25%
   * Si le budget actuel est 0 ou inconnu, on initialise à 50€.
   */
  async scaleDailyBudget(campaignId: string, multiplier: number): Promise<{ oldBudget: number; newBudget: number }> {
    // GET current campaign to read max_daily
    const raw = await this.fetch<Record<string, unknown>>(`${BASE}/campaigns/${campaignId}`);
    const currentBudget = Number((raw as Record<string, unknown>)?.max_daily ?? 0);
    const baseBudget    = currentBudget > 0 ? currentBudget : 50; // 50€ si pas de budget défini
    const newBudget     = Math.round(baseBudget * multiplier * 100) / 100;

    await this.fetch(`${BASE}/campaigns/${campaignId}`, {
      method: "PATCH",
      body:   JSON.stringify({ max_daily: newBudget }),
    });

    return { oldBudget: baseBudget, newBudget };
  }

  /**
   * Set daily budget to a fixed € amount.
   * PATCH /v1.1/campaigns/{id}  body: { max_daily: amount }
   */
  async setDailyBudget(campaignId: string, amount: number): Promise<void> {
    await this.fetch(`${BASE}/campaigns/${campaignId}`, {
      method: "PATCH",
      body:   JSON.stringify({ max_daily: amount }),
    });
  }

  /**
   * Scale bid by a multiplier (e.g. 1.10 = +10%).
   * PATCH /v1.1/campaigns/{id}  body: { price: newPrice }
   */
  async scaleBid(campaignId: string, multiplier: number): Promise<{ oldBid: number; newBid: number }> {
    const raw = await this.fetch<Record<string, unknown>>(`${BASE}/campaigns/${campaignId}`);
    const currentPrice = Number((raw as Record<string, unknown>)?.price ?? 1);
    const newPrice = Math.round(currentPrice * multiplier * 10000) / 10000;
    await this.fetch(`${BASE}/campaigns/${campaignId}`, {
      method: "PATCH",
      body:   JSON.stringify({ price: newPrice }),
    });
    return { oldBid: currentPrice, newBid: newPrice };
  }

  /**
   * Set bid to a fixed € amount.
   * PATCH /v1.1/campaigns/{id}  body: { price: amount }
   */
  async setBid(campaignId: string, amount: number): Promise<void> {
    await this.fetch(`${BASE}/campaigns/${campaignId}`, {
      method: "PATCH",
      body:   JSON.stringify({ price: amount }),
    });
  }

  /**
   * POST /v1.1/campaigns
   * Creates a new campaign. Returns the created campaign with its id.
   *
   * Required by API: name, format_id, pricing_model, price, max_daily
   * hours_targeting: 24-char bitmask ("1" = active for that hour). All-day = 24×"1".
   */
  async createCampaign(params: TrafficStarsCreateParams): Promise<{ id: string; name: string }> {
    // Derive campaign type from real format IDs (GET /v1.1/ad_formats):
    //   1,18,23,27,28,61 = Banner   → "image"
    //   7                = Popunder → "image" (creative is just a redirect URL)
    //   62               = Native   → "image"
    //   63               = Video    → "video"
    //   104              = Push     → "html5"
    //   105              = Interstitial → "image"
    const typeForFormat = (fid: number): string => {
      if (fid === 7)   return "direct"; // Popunder → Direct (seul ad_type supporté)
      if (fid === 63)  return "video";  // Video
      if (fid === 104) return "image";  // Push → image (html5 nécessite permissions spéciales)
      return "image";                   // Banner, Native, Interstitial
    };

    // NOTE: devices field omitted intentionally.
    // The valid TS device IDs (GET /v1.1/devices → id:0 = PC, etc.) don't match
    // the 1/2/3 convention. Omitting targets all devices by default, which is
    // safer than sending invalid IDs that cause 400 errors.

    const body = {
      name:            params.name,
      format_id:       params.format_id,
      pricing_model:   params.pricing_model,
      price:           params.price,
      max_daily:       params.max_daily,
      // hours_targeting: 24-char bitmask where position = hour (0=midnight).
      // "1" = ad can serve that hour, "0" = blocked.
      // Empty timeSlots (undefined or []) = deliver 24/7 = all "1"s.
      hours_targeting: (() => {
        if (!params.timeSlots || params.timeSlots.length === 0) return "111111111111111111111111";
        return Array.from({ length: 24 }, (_, h) =>
          params.timeSlots!.includes(h) ? "1" : "0"
        ).join("");
      })(),
      type:            params.type ?? typeForFormat(params.format_id),
      traffic_type:    params.traffic_type ?? "ron",
      ...(params.countries ? { countries: params.countries } : {}),
      // devices intentionally omitted — see note above
      ...(typeof params.active === "boolean" ? { active: params.active } : {}),
    };

    const data = await this.fetch<RawCampaign>(`${BASE}/campaigns`, {
      method: "POST",
      body:   JSON.stringify(body),
    });

    return { id: String(data.id), name: data.name };
  }

  /**
   * POST /v1.1/banners
   * Attaches a creative (banner/redirect URL) to an existing campaign.
   *
   * For Popunder / Direct campaigns (format_id=7): pass url= only.
   *   body: { campaign_id, name, urls: [url] }
   *
   * For image banners (format_id=1/23/105 etc.): pass content= (base64) + width + height.
   *   body: { campaign_id, name, content, width, height }
   *
   * Returns { id } of the created banner.
   */
  async createBanner(params: TrafficStarsCreateBannerParams): Promise<{ id: string }> {
    const body: Record<string, unknown> = {
      campaign_id: params.campaign_id,
      name:        params.name,
    };

    if (params.url && !params.content) {
      // Redirect / Popunder — URL-only mode
      body.urls = [params.url];
    } else if (params.content) {
      // Image banner
      body.content = params.content;
      if (params.width)  body.width  = params.width;
      if (params.height) body.height = params.height;
    }

    const data = await this.fetch<{ id: number }>(`${BASE}/banners`, {
      method: "POST",
      body:   JSON.stringify(body),
    });

    return { id: String(data.id) };
  }

  /**
   * GET /v1.1/advertiser/custom/report/by-country
   * Query params: date_from=YYYY-MM-DD, date_to=YYYY-MM-DD
   * Response: array [ { country, amount, impressions, clicks, leads, ... } ]
   * Same field naming as by-campaign but grouped by country ISO-2 code.
   */
  async getStatsByCountry(dateFrom: string, dateTo: string): Promise<{ countryCode: string; impressions: number; clicks: number; spent: number }[]> {
    const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });

    const data = await this.fetch<RawCountryRow[] | { response: RawCountryRow[] }>(
      `${BASE}/advertiser/custom/report/by-country?${params}`,
    );

    const rows = Array.isArray(data)
      ? data
      : (data as { response: RawCountryRow[] }).response ?? [];

    return rows
      .map(row => ({
        countryCode: String(row.country ?? row.country_code ?? row.geo ?? "").toUpperCase(),
        impressions: Number(row.impressions) || 0,
        clicks:      Number(row.clicks)      || 0,
        spent:       parseFloat(String(row.amount ?? row.spent ?? 0)) || 0,
      }))
      .filter(r => r.countryCode.length === 2);
  }

  /**
   * GET /v1.1/advertiser/custom/report/by-campaign
   * Query params: date_from=YYYY-MM-DD, date_to=YYYY-MM-DD
   * Response: direct array [ { campaign_id, name, amount, impressions, clicks, leads, ... } ]
   *
   * Field mapping:
   *   amount → spent
   *   leads  → conversions
   */
  async getStats(dateFrom: string, dateTo: string): Promise<TrafficStarsStats[]> {
    const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });

    const data = await this.fetch<RawStatRow[] | { response: RawStatRow[] }>(
      `${BASE}/advertiser/custom/report/by-campaign?${params}`,
    );

    const rows = Array.isArray(data)
      ? data
      : (data as { response: RawStatRow[] }).response ?? [];

    return rows.map(row => ({
      campaignId:  String(row.campaign_id ?? row.id ?? ""),
      impressions: Number(row.impressions) || 0,
      clicks:      Number(row.clicks)      || 0,
      conversions: Number(row.leads)       || 0,
      spent:       parseFloat(String(row.amount ?? 0)) || 0,
      dateFrom,
      dateTo,
    }));
  }
}

// ── Raw API shapes ──────────────────────────────────────────────────────────

interface RawCampaign {
  id:     number;
  name:   string;
  status: string; // enabled | paused | unapproved | rejected | draft | no_funds_paused | ...
  active: boolean;
}

interface RawStatRow {
  campaign_id?: number | string;
  id?:          number | string;
  impressions:  number | string;
  clicks:       number | string;
  leads:        number | string; // conversions
  amount:       number | string; // spent
  [key: string]: unknown;
}

interface RawCountryRow {
  country?:      string;
  country_code?: string;
  geo?:          string;
  impressions:   number | string;
  clicks:        number | string;
  amount?:       number | string; // spent
  spent?:        number | string;
  [key: string]: unknown;
}
