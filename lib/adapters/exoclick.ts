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
  name:          string;
  url?:          string;              // URL de destination (variations[0].url)
  bid:           number;              // prix en euros
  bidType:       "cpm" | "cpc";       // pricing.model : cpm=2, cpc=1, smart_bid=3, smart_cpm=4
  adFormat:      number;              // advertiser_ad_type : popunder=7, banner=1…
  active:        boolean;             // non utilisé dans le payload POST (status séparé)
  categories?:   number[];            // IDs catégories ExoClick (défaut: [97] = adult)
  dailyBudget?:  number;              // max_daily_budget (-1 = illimité)
  totalBudget?:  number;              // total_budget_limit
  countries?:    string[];            // codes ISO 2 lettres (défaut: ["US"])
  startAt?:      string;              // YYYY-MM-DD
  endAt?:        string;
}

export interface ExoClickCampaign {
  id:     string;
  name:   string;
  status: "active" | "paused" | "stopped";
}

export interface ExoClickVariation {
  id:          string | number;
  url:         string;
  status:      "active" | "paused" | "pending" | "rejected";
  statusLabel: string;
}

export interface ExoClickPublisherSite {
  id:         number;
  domain:     string;
  name:       string;
  categories: string[];
  similarweb: number;  // Similarweb global rank (lower = more traffic)
  minCpm:     number;  // minimum CPM in €
  topCpm:     number;  // top CPM in €
  traffic:    string;  // formatted traffic string (e.g. "130M+/j")
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

  // Retourne la structure brute complète d'une campagne — pour comprendre le format exact
  async getRawCampaign(campaignId: string): Promise<unknown> {
    const data = await this.apiFetch<unknown>(`/campaigns/${campaignId}`);
    return data;
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
    // ExoClick status : 1 = actif, 0 = pause, -1 = arrêté (status 2 invalide)
    await this.apiFetch(`/campaigns/${campaignId}`, {
      method: "PUT",
      body: JSON.stringify({ status: 0 }),
    });
  }

  async resumeCampaign(campaignId: string): Promise<void> {
    await this.apiFetch(`/campaigns/${campaignId}`, {
      method: "PUT",
      body: JSON.stringify({ status: 1 }),
    });
  }

  /**
   * Augmente le budget journalier d'une campagne par un facteur multiplicateur.
   * multiplier=1.25 → +25%
   * ExoClick stocke les budgets en centimes (€ * 100).
   * Si la campagne est en budget illimité (-1), on initialise à 50€ puis on scale.
   */
  async scaleDailyBudget(campaignId: string, multiplier: number): Promise<{ oldBudget: number; newBudget: number }> {
    const raw    = await this.getRawCampaign(campaignId) as Record<string, unknown>;
    // ExoClick returns { result: { campaign: { ... } } } — unwrap both levels
    const result = ((raw?.result ?? raw) as Record<string, unknown>);
    const camp   = ((result?.campaign ?? result) as Record<string, unknown>);
    const currentCents = Number(camp?.max_daily_budget ?? -1);
    const baseCents    = currentCents === -1 ? 5000 : currentCents; // 50€ si illimité
    // ExoClick requires budget in whole euros (no fractional cents — must be multiple of 100)
    const newCents     = Math.round(Math.round(baseCents * multiplier) / 100) * 100;

    await this.apiFetch(`/campaigns/${campaignId}`, {
      method: "PUT",
      body: JSON.stringify({
        max_daily_budget:           newCents,
        daily_limit_type:           1,      // 0=illimité, 1=budget actif
        daily_limit_delivery_mode:  1,
      }),
    });

    return { oldBudget: baseCents / 100, newBudget: newCents / 100 };
  }

  /**
   * Set daily budget to a fixed € amount.
   * ExoClick stores budgets in centimes (€ * 100).
   */
  async setDailyBudget(campaignId: string, amount: number): Promise<void> {
    // ExoClick requires whole euros (multiple of 100 centimes)
    const newCents = Math.round(amount) * 100;
    await this.apiFetch(`/campaigns/${campaignId}`, {
      method: "PUT",
      body: JSON.stringify({
        max_daily_budget:          newCents,
        daily_limit_type:          1,
        daily_limit_delivery_mode: 1,
      }),
    });
  }

  /**
   * Scale bid by a multiplier (e.g. 1.10 = +10%).
   * ExoClick bid = pricing.price in centimes.
   */
  async scaleBid(campaignId: string, multiplier: number): Promise<{ oldBid: number; newBid: number }> {
    const raw = await this.getRawCampaign(campaignId) as Record<string, unknown>;
    const pricing = (raw as Record<string, unknown>)?.pricing as Record<string, unknown> | undefined;
    const currentCents = Number(pricing?.price ?? 100); // default 1€ if unreadable
    const newCents = Math.max(51, Math.round(currentCents * multiplier)); // ExoClick min 51 centimes
    await this.apiFetch(`/campaigns/${campaignId}`, {
      method: "PUT",
      body: JSON.stringify({ pricing: { price: newCents } }),
    });
    return { oldBid: currentCents / 100, newBid: newCents / 100 };
  }

  /**
   * Set bid to a fixed € amount.
   * ExoClick min = 0.51€.
   */
  async setBid(campaignId: string, amount: number): Promise<void> {
    const newCents = Math.max(51, Math.round(amount * 100));
    await this.apiFetch(`/campaigns/${campaignId}`, {
      method: "PUT",
      body: JSON.stringify({ pricing: { price: newCents } }),
    });
  }

  async createCampaign(params: ExoClickCreateParams): Promise<{ id: string; name: string }> {
    // ── ISO 2 lettres → ISO 3 lettres (format attendu par ExoClick) ───────────
    const ISO2_TO_3: Record<string, string> = {
      US: "USA", GB: "GBR", DE: "DEU", FR: "FRA", ES: "ESP", IT: "ITA",
      CA: "CAN", AU: "AUS", BR: "BRA", MX: "MEX", IN: "IND", JP: "JPN",
      KR: "KOR", RU: "RUS", UA: "UKR", PL: "POL", NL: "NLD", BE: "BEL",
      SE: "SWE", NO: "NOR", DK: "DNK", FI: "FIN", CH: "CHE", AT: "AUT",
      PT: "PRT", CZ: "CZE", HU: "HUN", RO: "ROU", TR: "TUR", TH: "THA",
      ID: "IDN", PH: "PHL", VN: "VNM", MY: "MYS", SG: "SGP", ZA: "ZAF",
      AR: "ARG", CO: "COL",
    };

    // ── ad format → advertiser_ad_type (confirmé : popunder = 7) ─────────────
    const FORMAT_TO_AD_TYPE: Record<number, number> = {
      2: 1, 4: 7, 5: 5, 8: 8, 13: 13, 14: 14,
    };

    // ── advertiser_ad_type → publisher_ad_types (capturé depuis l'UI ExoClick) ─
    const AD_TYPE_TO_PUBLISHER_TYPES: Record<number, number[]> = {
      7: [12, 3, 22],  // popunder
      1: [1, 2],       // banner
      5: [5],          // video
    };

    // ── Pricing models ExoClick v2 (ordre standard ad-network)
    // 1 = CPC, 2 = CPM, 3 = Smart Bid, 4 = Smart CPM
    const PRICING_MODEL: Record<string, number> = { cpm: 2, cpc: 1, smart_bid: 3, smart_cpm: 4 };

    // ── Pays ciblés — format { type: "targeted", elements: [{country: "USA", regions: []}] }
    const countryCodes = params.countries?.length
      ? params.countries.map(c => ISO2_TO_3[c]).filter(Boolean)
      : ["USA"]; // US par défaut

    const countryElements = countryCodes.map(code => ({ country: code, regions: [] as number[] }));

    // ── Catégories — format { type: "targeted", elements: [97, ...] } ─────────
    const categoryIds = params.categories?.length ? params.categories : [97];

    // ── Payload exact capturé depuis l'UI ExoClick (structure plate) ──────────
    const adType = FORMAT_TO_AD_TYPE[params.adFormat] ?? 7;
    const publisherAdTypes = AD_TYPE_TO_PUBLISHER_TYPES[adType] ?? [];
    // ⚠️ ExoClick price = centimes entiers (ex: 0.55€ → 55, 2€ → 200)
    // Source: https://docs.exoclick.com/docs/create-campaign-step4/
    const priceCents = Math.round(params.bid * 100);

    // ── Formats qui n'acceptent PAS CPC (Popunder adType=7, etc.)
    const NO_CPC_AD_TYPES = new Set([7]);

    // Validation pré-envoi : bloque CPC sur Popunder (l'UI le filtre déjà, double-sécurité)
    if (NO_CPC_AD_TYPES.has(adType) && params.bidType === "cpc") {
      throw new Error(
        "Le format Popunder n'accepte pas le CPC. Utilise CPM, Smart CPM ou Smart Bid."
      );
    }

    // Validation bid minimum (ExoClick minimum = 50 centimes pour CPM USA)
    if (priceCents < 51) {
      throw new Error(
        `Enchère trop basse : ${params.bid}€ (minimum recommandé : 0.51€).`
      );
    }

    // Force CPM si bidType incompatible avec le format (ne devrait pas arriver grâce à l'UI)
    const effectiveBidType: string =
      NO_CPC_AD_TYPES.has(adType) && params.bidType === "cpc" ? "cpm" : params.bidType;

    const pricingModelId = PRICING_MODEL[effectiveBidType] ?? 2;

    const body: Record<string, unknown> = {
      name:                   params.name,
      advertiser_ad_type:     adType,
      publisher_ad_types:     publisherAdTypes,
      is_internal:            0,
      categories:             { type: "targeted", elements: categoryIds },
      size:                   "",
      run_on_responsive_zones: true,
      media_storage_template: "link",
      variations:             [],   // ExoClick ignore ce champ au POST — variation créée via PUT après
      optimization_algorithm: 1,
      optimization_idgoal:    null,
      day_parting:            { timezone: "Europe/Paris", parting: [] },
      retargeting:            { enabled: false, goals: [] },
      countries:              { type: "targeted", elements: countryElements },
      sites:                  { targeted: [], blocked: [] },
      keywords:               { targeted: [], blocked: [] },
      ip_ranges:              { targeted: [], blocked: [] },
      vr:                     0,
      email_passing:          0,
      pricing:                { model: pricingModelId, price: priceCents },
      frequency_capping:      { enabled: false, impressions: 0, minutes: 0, level: null },
      // Budgets : ExoClick attend des centimes. daily_limit_type:0 impose max_daily_budget:-1 (illimité)
      max_daily_budget:       params.dailyBudget ? Math.round(params.dailyBudget * 100) : -1,
      daily_limit_delivery_mode: 1,
      daily_limit_type:       params.dailyBudget ? 1 : 0,  // 0=pas de limite, 1=budget journalier actif
      max_daily_impressions:  null,
      start_date:             params.startAt ?? null,
      end_date:               params.endAt   ?? null,
      // total_budget_limit en centimes (min 2000 = 20€), null si non défini
      total_budget_limit:     params.totalBudget ? Math.round(params.totalBudget * 100) : null,
      total_impressions:      null,
      allowed_throttling_down: 0,
      zones:                  [],
      site_targeting:         "",
      zone_targeting:         { type: 2, network_selection: 0, partner_networks: true },
      idgroup:                0,
      idgoal_target:          null,
    };

    console.log(`[ExoClick] createCampaign → format=${params.adFormat}(adType=${adType}) bidType=${effectiveBidType} pricingModel=${pricingModelId} bid=${params.bid}€ → ${priceCents} centimes`);

    // ── Étape 1 : créer la campagne ───────────────────────────────────────────
    let data: Record<string, unknown>;
    try {
      data = await this.apiFetch<Record<string, unknown>>("/campaigns", {
        method: "POST",
        body:   JSON.stringify(body),
      });
    } catch (err) {
      console.error("EXOCLICK API ERROR (POST /campaigns):", err instanceof Error ? err.message : err);
      throw err;
    }

    const result = (data?.result ?? data) as Record<string, unknown>;
    const campaignId = String(result.id ?? "");
    const campaignName = String(result.name ?? params.name);
    console.log(`[ExoClick] Campagne créée ID=${campaignId}`);

    // ── Étape 2 : enregistrer l'URL dans la librairie, puis attacher la variation ─
    if (params.url && campaignId) {
      console.log(`[ExoClick] Création de la variation pour campagne ${campaignId}...`);
      try {
        // 2a. Enregistre l'URL dans la librairie ExoClick → retourne [{id, url}]
        const urlRes = await this.apiFetch<Record<string, unknown>[]>("/library/url", {
          method: "POST",
          body:   JSON.stringify({ url: params.url }),
        });
        const urlEntry = Array.isArray(urlRes) ? urlRes[0] : urlRes;
        const urlId = urlEntry?.id as number | undefined;
        console.log(`[ExoClick] URL enregistrée → urlId=${urlId}`);

        if (!urlId) throw new Error("POST /library/url n'a pas retourné d'id");

        // 2b. Attache la variation via PUT /campaigns/{id}/variations
        // Structure exacte extraite du bundle Angular d'ExoClick (main.4d3637cd...)
        // Champ clé : id_library_url (pas idvariations_url !)
        // variation_id absent = nouvelle variation
        const varPayload = [{
          name:                  null,
          description:           null,
          brand:                 null,
          idoffer:               0,
          id_library_file:       null,
          id_library_url:        urlId,   // ← champ correct découvert dans le bundle
          id_library_iframe_url: null,
          id_library_html:       null,
          crop_anchor_point:     0,
          active:                1,
          share:                 null,
          // campaign_variation_cta non autorisé pour le type "link"
        }];

        const putRes = await this.apiFetch<unknown>(`/campaigns/${campaignId}/variations`, {
          method: "PUT",
          body:   JSON.stringify(varPayload),
        });
        console.log(`[ExoClick] ✅ Variation créée:`, JSON.stringify(putRes));
      } catch (err) {
        console.error(`[ExoClick] ❌ Création variation erreur:`, err instanceof Error ? err.message : err);
      }
    }

    return { id: campaignId, name: campaignName };
  }

  // ─── Variations ───────────────────────────────────────────────────────────

  async getVariations(campaignId: string): Promise<ExoClickVariation[]> {
    try {
      const data = await this.apiFetch<unknown>(`/campaigns/${campaignId}/variations`);
      const raw = (data as Record<string, unknown>)?.result ?? data;
      const list = (Array.isArray(raw)
        ? raw
        : Object.values(raw as Record<string, unknown>)) as Record<string, unknown>[];

      return list.map(v => {
        const active = v.active;
        const color  = String(v.status_color ?? "");
        let status: ExoClickVariation["status"] = "pending";
        if (active === 1 || active === true)  status = "active";
        else if (color === "red")              status = "rejected";
        else if (active === 0 || active === false) status = "paused";

        return {
          id:          (v.id ?? v.idvariation ?? "") as string | number,
          url:         String(v.url ?? v.display_destination ?? v.click_url ?? ""),
          status,
          statusLabel: String(v.status_label ?? v.original_status_label ?? status),
        };
      });
    } catch {
      return [];
    }
  }

  // Injecte plusieurs URLs d'un coup dans une campagne ExoClick
  async addVariations(
    campaignId: string,
    urls: string[]
  ): Promise<{ success: number; errors: string[] }> {
    const errors: string[] = [];
    let success = 0;

    for (const rawUrl of urls) {
      const url = rawUrl.trim();
      if (!url) continue;
      try {
        // Enregistre l'URL dans la librairie ExoClick
        const urlRes = await this.apiFetch<Record<string, unknown>[]>("/library/url", {
          method: "POST",
          body:   JSON.stringify({ url }),
        });
        const urlEntry = Array.isArray(urlRes) ? urlRes[0] : urlRes;
        const urlId = (urlEntry as Record<string, unknown>)?.id as number | undefined;
        if (!urlId) throw new Error("POST /library/url : id manquant");

        // Attache la variation — structure exacte du bundle Angular ExoClick
        await this.apiFetch(`/campaigns/${campaignId}/variations`, {
          method: "PUT",
          body: JSON.stringify([{
            name:                  null,
            description:           null,
            brand:                 null,
            idoffer:               0,
            id_library_url:        urlId,
            id_library_file:       null,
            id_library_iframe_url: null,
            id_library_html:       null,
            crop_anchor_point:     0,
            active:                1,
            share:                 null,
          }]),
        });
        success++;
      } catch (err) {
        errors.push(`${url} → ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return { success, errors };
  }

  // ─── Publisher Sites ─────────────────────────────────────────────────────────
  // Fetches available publisher sites for advertiser targeting.
  // ExoClick API v2: GET /v2/sites returns site list with basic info.
  // Zone-level CPM data comes from GET /v2/sites/{id}/zones (one call per site).
  // We fetch the site list + sample zone CPMs to build the publisher selection UI.

  async getSites(): Promise<ExoClickPublisherSite[]> {
    const data = await this.apiFetch<{ result: unknown }>("/sites");
    const raw = data?.result ?? data ?? [];
    const list: Record<string, unknown>[] = Array.isArray(raw)
      ? raw as Record<string, unknown>[]
      : Object.values(raw as Record<string, unknown>) as Record<string, unknown>[];

    return list
      .filter(s => s.id && (s.name || s.domain || s.url))
      .map(s => {
        const domain = String(s.url ?? s.domain ?? s.name ?? "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase();
        const similarweb = toNum(s.similarweb_rank ?? s.global_rank ?? 0);
        return {
          id:         toNum(s.id),
          domain,
          name:       String(s.name ?? domain).toUpperCase(),
          categories: (Array.isArray(s.categories)
            ? (s.categories as Record<string, unknown>[]).map(c => String(c.name ?? c.id ?? c))
            : []),
          similarweb,
          minCpm:     toNum(s.min_cpm ?? s.min_bid ?? s.floor_price ?? 0),
          topCpm:     toNum(s.top_cpm ?? s.max_bid ?? 0),
          // traffic shown as impressions/day approx from Similarweb rank if available
          traffic:    "",
        };
      })
      .sort((a, b) => a.similarweb > 0 && b.similarweb > 0 ? a.similarweb - b.similarweb : b.minCpm - a.minCpm);
  }

  // Fetch zone-level CPM data for a single site (one API call per site).
  // Returns the lowest minCpm across all zones of that site.
  async getSiteMinCpm(siteId: number): Promise<{ minCpm: number; topCpm: number } | null> {
    try {
      const data = await this.apiFetch<{ result: unknown }>(`/sites/${siteId}/zones`);
      const raw = data?.result ?? data ?? [];
      const zones: Record<string, unknown>[] = Array.isArray(raw)
        ? raw as Record<string, unknown>[]
        : Object.values(raw as Record<string, unknown>) as Record<string, unknown>[];

      if (zones.length === 0) return null;

      const cpms = zones
        .map(z => ({ min: toNum(z.min_cpm ?? z.min_bid ?? z.floor_price ?? 0), top: toNum(z.top_cpm ?? z.max_bid ?? 0) }))
        .filter(z => z.min > 0);

      if (cpms.length === 0) return null;
      return {
        minCpm: Math.min(...cpms.map(z => z.min)),
        topCpm: Math.max(...cpms.map(z => z.top)),
      };
    } catch {
      return null;
    }
  }

  async getStatsByCountry(dateFrom: string, dateTo: string): Promise<{ countryCode: string; impressions: number; clicks: number; spent: number }[]> {
    const data = await this.apiFetch<{ result: unknown }>(
      `/statistics/a/global`,
      {
        method: "POST",
        body: JSON.stringify({
          group_by: ["country"],
          filter:   { date_from: dateFrom, date_to: dateTo },
        }),
      }
    );

    const raw = data?.result ?? [];
    const list: Record<string, unknown>[] = Array.isArray(raw)
      ? raw as Record<string, unknown>[]
      : Object.values(raw as Record<string, unknown>) as Record<string, unknown>[];

    return list
      .map(row => {
        const groupBy = (row.group_by ?? {}) as Record<string, unknown>;
        const countryObj = (groupBy.country ?? {}) as Record<string, unknown>;
        // ExoClick returns ISO 2-letter code in group_by.country.name or .code
        const countryCode = String(
          countryObj.name ?? countryObj.code ?? countryObj.id ?? row.country ?? ""
        ).toUpperCase();

        return {
          countryCode,
          impressions: toNum(row.impressions),
          clicks:      toNum(row.clicks),
          spent:       toNum(row.cost ?? row.spent ?? 0),
        };
      })
      .filter(r => r.countryCode.length === 2)
      .sort((a, b) => b.impressions - a.impressions);
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

  /**
   * Bulk stats with daily breakdown — 1 API call for the whole range.
   * Returns one entry per (campaignId × date).
   */
  async getStatsBulk(dateFrom: string, dateTo: string): Promise<ExoClickStats[]> {
    const data = await this.apiFetch<{ result: unknown }>(
      `/statistics/a/global`,
      {
        method: "POST",
        body: JSON.stringify({
          group_by: ["campaign_id", "date"],
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
      const campaignId =
        ((groupBy.campaign_id as Record<string, unknown>)?.id as string) ??
        String(row.campaign_id ?? row.id ?? "");

      // Date from group_by.date.date or fallback
      const dateObj  = groupBy.date as Record<string, unknown> | undefined;
      const dateStr  = (dateObj?.date ?? dateObj?.value ?? row.date ?? dateFrom) as string;
      // Normalize to YYYY-MM-DD
      const dayStr   = dateStr.slice(0, 10);

      return {
        campaignId,
        impressions: toNum(row.impressions),
        clicks:      toNum(row.clicks),
        conversions: toNum(goals.total ?? goals.total_goals ?? row.conversions ?? 0),
        revenue:     toNum(goals.revenue ?? goals.revenue_goals ?? row.revenue ?? 0),
        spent:       toNum(row.cost ?? row.spent ?? 0),
        dateFrom: dayStr,
        dateTo:   dayStr,
      };
    });
  }
}
