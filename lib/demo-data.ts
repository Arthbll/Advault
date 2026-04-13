/**
 * DEMO MODE — données cohérentes et date-range aware.
 *
 * Principe : chaque (campagne × jour calendaire) produit des métriques
 * déterministes via un LCG seedé sur (campaignIndex × 100_000 + dateIndex).
 * Résultat : le même jour retourne toujours les mêmes chiffres, et
 * les agrégats 30j / 90j sont cohérents entre toutes les pages.
 */

export const IS_DEMO_HEADER = "x-profitdash-demo";

// ─── Types publics ────────────────────────────────────────────────────────────

export interface DemoCampaign {
  id: string;
  externalId: string;
  name: string;
  network: "EXOCLICK" | "TRAFFICSTARS" | "TRAFFICJUNKY" | "PROPELLERADS" | "ADSTERRA";
  status: "ACTIVE" | "PAUSED" | "KILLED";
  spend: number;
  revenue: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

export interface DemoConversion {
  id: string;
  campaignId: string;
  campaignName: string;
  clickId: string;
  revenue: number;
  currency: string;
  source: string;
  createdAt: string; // ISO string
}

// ─── Définitions campagnes (taux journaliers de base) ─────────────────────────
//
// Les dailySpend / dailyRevenue correspondent à environ 1 jour "normal" ACTIF.
// Un 30j standard ≈ 30 × dailySpend (±variations weekends / tendance).

interface CampaignDef {
  id: string;
  externalId: string;
  name: string;
  network: "EXOCLICK" | "TRAFFICSTARS" | "TRAFFICJUNKY" | "PROPELLERADS" | "ADSTERRA";
  status: "ACTIVE" | "PAUSED" | "KILLED";
  dailySpend: number;
  dailyRevenue: number;
  dailyImpressions: number;
  dailyClicks: number;
  dailyConversions: number; // peut être < 1 (probabilité)
}

const CAMPAIGN_DEFS: CampaignDef[] = [

  // ── ExoClick ────────────────────────────────────────────────────────────────

  {
    id: "demo:EXOCLICK:1001", externalId: "1001",
    name: "Adult Dating — Push — US — Tier1",
    network: "EXOCLICK", status: "ACTIVE",
    dailySpend: 140.61, dailyRevenue: 236.83,
    dailyImpressions: 428_000, dailyClicks: 632, dailyConversions: 7.1,
  },
  {
    id: "demo:EXOCLICK:1002", externalId: "1002",
    name: "Casino — Native — UK — Desktop",
    network: "EXOCLICK", status: "ACTIVE",
    dailySpend: 126.07, dailyRevenue: 208.29,
    dailyImpressions: 280_667, dailyClicks: 509, dailyConversions: 5.6,
  },
  {
    id: "demo:EXOCLICK:1003", externalId: "1003",
    name: "VOD Streaming — Interstitial — CA — All Devices",
    network: "EXOCLICK", status: "ACTIVE",
    dailySpend: 87.06, dailyRevenue: 137.94,
    dailyImpressions: 208_667, dailyClicks: 328, dailyConversions: 3.5,
  },
  {
    id: "demo:EXOCLICK:1004", externalId: "1004",
    name: "Crypto — Push — AU — Desktop",
    network: "EXOCLICK", status: "ACTIVE",
    dailySpend: 63.47, dailyRevenue: 112.88,
    dailyImpressions: 139_333, dailyClicks: 237, dailyConversions: 2.6,
  },
  {
    id: "demo:EXOCLICK:1005", externalId: "1005",
    name: "iGaming — Pop Under — US — Mobile",
    network: "EXOCLICK", status: "ACTIVE",
    dailySpend: 43.75, dailyRevenue: 23.29,
    dailyImpressions: 606_667, dailyClicks: 607, dailyConversions: 0.27,
  },
  {
    id: "demo:EXOCLICK:1006", externalId: "1006",
    name: "Nutra — Display — DE — Mobile",
    network: "EXOCLICK", status: "PAUSED",
    dailySpend: 31.37, dailyRevenue: 22.63,
    dailyImpressions: 72_667, dailyClicks: 102, dailyConversions: 0.47,
  },

  // ── TrafficStars ─────────────────────────────────────────────────────────────

  {
    id: "demo:TRAFFICSTARS:2001", externalId: "2001",
    name: "Dating — Push — FR — Mobile Broad",
    network: "TRAFFICSTARS", status: "ACTIVE",
    dailySpend: 103.74, dailyRevenue: 174.15,
    dailyImpressions: 240_333, dailyClicks: 423, dailyConversions: 4.93,
  },
  {
    id: "demo:TRAFFICSTARS:2002", externalId: "2002",
    name: "Crypto — Native — AU — Desktop",
    network: "TRAFFICSTARS", status: "ACTIVE",
    dailySpend: 89.46, dailyRevenue: 160.08,
    dailyImpressions: 195_333, dailyClicks: 308, dailyConversions: 3.73,
  },
  {
    id: "demo:TRAFFICSTARS:2003", externalId: "2003",
    name: "Finance — Banner — UK — Desktop",
    network: "TRAFFICSTARS", status: "ACTIVE",
    dailySpend: 63.05, dailyRevenue: 97.95,
    dailyImpressions: 142_667, dailyClicks: 240, dailyConversions: 2.47,
  },
  {
    id: "demo:TRAFFICSTARS:2004", externalId: "2004",
    name: "Sweepstakes — Push — IT — All Devices",
    network: "TRAFFICSTARS", status: "ACTIVE",
    dailySpend: 46.49, dailyRevenue: 70.28,
    dailyImpressions: 115_333, dailyClicks: 187, dailyConversions: 1.60,
  },
  {
    id: "demo:TRAFFICSTARS:2005", externalId: "2005",
    name: "Sweepstakes — Push — PT — Mobile",
    network: "TRAFFICSTARS", status: "ACTIVE",
    dailySpend: 58.40, dailyRevenue: 51.39,
    dailyImpressions: 138_000, dailyClicks: 215, dailyConversions: 1.8,
  },
  {
    id: "demo:TRAFFICSTARS:2006", externalId: "2006",
    name: "iGaming — Native — NL — Desktop",
    network: "TRAFFICSTARS", status: "PAUSED",
    dailySpend: 19.41, dailyRevenue: 13.04,
    dailyImpressions: 42_667, dailyClicks: 68, dailyConversions: 0.30,
  },

  // ── TrafficJunky ─────────────────────────────────────────────────────────────

  {
    id: "demo:TRAFFICJUNKY:3001", externalId: "3001",
    name: "Nutra — Push — ES — Mobile",
    network: "TRAFFICJUNKY", status: "ACTIVE",
    dailySpend: 52.06, dailyRevenue: 90.48,
    dailyImpressions: 113_000, dailyClicks: 215, dailyConversions: 2.27,
  },
  {
    id: "demo:TRAFFICJUNKY:3002", externalId: "3002",
    name: "Adult Dating — Banner — BR — Mobile",
    network: "TRAFFICJUNKY", status: "ACTIVE",
    dailySpend: 39.81, dailyRevenue: 69.59,
    dailyImpressions: 87_000, dailyClicks: 165, dailyConversions: 1.73,
  },
  {
    id: "demo:TRAFFICJUNKY:3003", externalId: "3003",
    name: "VOD — Display — MX — All Devices",
    network: "TRAFFICJUNKY", status: "ACTIVE",
    dailySpend: 26.15, dailyRevenue: 43.28,
    dailyImpressions: 58_000, dailyClicks: 104, dailyConversions: 1.03,
  },
  {
    id: "demo:TRAFFICJUNKY:3004", externalId: "3004",
    name: "Finance — Native — BE — Desktop",
    network: "TRAFFICJUNKY", status: "KILLED",
    dailySpend: 12.95, dailyRevenue: 4.74,
    dailyImpressions: 27_333, dailyClicks: 36, dailyConversions: 0.10,
  },
  // ── PropellerAds ──────────────────────────────────────────────────────────
  {
    id: "demo:PROPELLERADS:4001", externalId: "4001",
    name: "Dating — Push Notification — US — Tier1",
    network: "PROPELLERADS", status: "ACTIVE",
    dailySpend: 72.40, dailyRevenue: 128.10,
    dailyImpressions: 315_000, dailyClicks: 470, dailyConversions: 5.20,
  },
  {
    id: "demo:PROPELLERADS:4002", externalId: "4002",
    name: "iGaming — Popunder — DE — Mobile",
    network: "PROPELLERADS", status: "ACTIVE",
    dailySpend: 54.80, dailyRevenue: 95.40,
    dailyImpressions: 228_000, dailyClicks: 310, dailyConversions: 3.85,
  },
  {
    id: "demo:PROPELLERADS:4003", externalId: "4003",
    name: "Crypto — OnClick — UK — Desktop",
    network: "PROPELLERADS", status: "PAUSED",
    dailySpend: 31.20, dailyRevenue: 52.60,
    dailyImpressions: 142_000, dailyClicks: 195, dailyConversions: 2.10,
  },
  // ── Adsterra ──────────────────────────────────────────────────────────────
  {
    id: "demo:ADSTERRA:5001", externalId: "5001",
    name: "Finance — Direct Click — BR — Mobile",
    network: "ADSTERRA", status: "ACTIVE",
    dailySpend: 44.60, dailyRevenue: 79.80,
    dailyImpressions: 192_000, dailyClicks: 285, dailyConversions: 2.92,
  },
  {
    id: "demo:ADSTERRA:5002", externalId: "5002",
    name: "Crypto — Native — IN — Desktop",
    network: "ADSTERRA", status: "ACTIVE",
    dailySpend: 33.40, dailyRevenue: 60.20,
    dailyImpressions: 145_000, dailyClicks: 218, dailyConversions: 2.24,
  },
  {
    id: "demo:ADSTERRA:5003", externalId: "5003",
    name: "Nutra — Popunder — MX — All Devices",
    network: "ADSTERRA", status: "PAUSED",
    dailySpend: 18.50, dailyRevenue: 31.40,
    dailyImpressions: 84_000, dailyClicks: 128, dailyConversions: 1.35,
  },
];

// ─── Moteur RNG déterministe ──────────────────────────────────────────────────

/** Linear Congruential Generator — rapide et déterministe */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = ((s * 1_664_525 + 1_013_904_223) >>> 0);
    return s / 0xffffffff;
  };
}

/** Index de jour depuis une epoch fixe (2024-01-01) */
const EPOCH_MS = new Date("2024-01-01T00:00:00Z").getTime();
function dateIndex(date: Date): number {
  return Math.floor((date.getTime() - EPOCH_MS) / 86_400_000);
}

/**
 * Facteur journalier pour une campagne donnée à une date donnée.
 * Retourne un multiplicateur entre ≈0.55 et ≈1.45.
 * Inclut : jitter aléatoire, dip weekend (×0.82), légère tendance croissante.
 */
function dayFactor(campaignIndex: number, date: Date): number {
  const di  = dateIndex(date);
  const rng = lcg(campaignIndex * 100_000 + di);

  const r1 = rng(); rng(); // consommer pour éviter corrélations inter-campagnes
  const r2 = rng();

  const jitter  = 0.72 + r1 * 0.56;         // 0.72 – 1.28
  const noise   = 0.94 + r2 * 0.12;         // 0.94 – 1.06
  const dow     = date.getUTCDay();
  const weekend = (dow === 0 || dow === 6) ? 0.82 : 1.0;

  return jitter * noise * weekend;
}

// ─── Parsing de la plage de dates ─────────────────────────────────────────────

export function parseDateRange(dateFrom: string, dateTo: string): Date[] {
  const from = new Date(dateFrom + "T00:00:00Z");
  const to   = new Date(dateTo   + "T00:00:00Z");
  const days: Date[] = [];
  const cur = new Date(from);
  while (cur <= to) {
    days.push(new Date(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

/** Plage par défaut : les N derniers jours */
function defaultRange(n = 30): [string, string] {
  const to   = new Date();
  const from = new Date(Date.now() - (n - 1) * 86_400_000);
  return [
    from.toISOString().slice(0, 10),
    to.toISOString().slice(0, 10),
  ];
}

// ─── Calcul des métriques par campagne sur une plage ─────────────────────────

interface ChartDay {
  date:        string;
  spend:       number;
  revenue:     number;
  profit:      number;
  impressions: number;
  clicks:      number;
}

interface CampaignComputed {
  id:          string;
  externalId:  string;
  name:        string;
  network:     string;
  status:      string;
  spend:       number;
  revenue:     number;
  impressions: number;
  clicks:      number;
  conversions: number;
  dailyChart:  ChartDay[];
}

function computeCampaignStats(
  def: CampaignDef,
  campIdx: number,
  days: Date[],
): CampaignComputed {
  let spend = 0, revenue = 0, impressions = 0, clicks = 0, conversions = 0;
  const dailyChart: ChartDay[] = [];

  for (const date of days) {
    const f = dayFactor(campIdx, date);

    const sp = def.dailySpend        * f;
    const rv = def.dailyRevenue      * f;
    const im = Math.round(def.dailyImpressions * f);
    const cl = Math.round(def.dailyClicks      * f);
    const co = def.dailyConversions  * f;

    spend       += sp;
    revenue     += rv;
    impressions += im;
    clicks      += cl;
    conversions += co;

    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");
    dailyChart.push({
      date:    `${dd}/${mm}`,
      spend:   Math.round(sp * 100) / 100,
      revenue: Math.round(rv * 100) / 100,
      profit:  Math.round((rv - sp) * 100) / 100,
      impressions: im,
      clicks:  cl,
    });
  }

  return {
    id:          def.id,
    externalId:  def.externalId,
    name:        def.name,
    network:     def.network,
    status:      def.status,
    spend:       Math.round(spend   * 100) / 100,
    revenue:     Math.round(revenue * 100) / 100,
    impressions,
    clicks,
    conversions: Math.round(conversions),
    dailyChart,
  };
}

// ─── Génération des conversions postback ─────────────────────────────────────

const CONV_SOURCES = [
  { name: "crakrevenue",  weight: 0.55, payouts: [22, 35, 48, 18, 28, 42, 55, 30] },
  { name: "maxbounty",    weight: 0.25, payouts: [15, 20, 25, 18, 32, 12]         },
  { name: "clickdealer",  weight: 0.12, payouts: [8,  12, 16, 10]                 },
  { name: "adcombo",      weight: 0.08, payouts: [6,  9,  14]                     },
] as const;

function pickSource(rng: () => number) {
  const r = rng();
  let acc = 0;
  for (const s of CONV_SOURCES) {
    acc += s.weight;
    if (r < acc) return s;
  }
  return CONV_SOURCES[0];
}

/**
 * Génère les conversions postback pour une plage de dates.
 * Seul les campagnes ACTIVE avec dailyConversions ≥ 1 émettent des postbacks.
 * Le résultat est déterministe : la même plage retourne toujours les mêmes conversions.
 */
export function generateDemoConversions(dateFrom: string, dateTo: string): DemoConversion[] {
  const days     = parseDateRange(dateFrom, dateTo);
  const eligible = CAMPAIGN_DEFS.filter(c => c.status === "ACTIVE" && c.dailyConversions >= 1.0);
  const result: DemoConversion[] = [];

  for (const date of days) {
    const di = dateIndex(date);

    for (let ei = 0; ei < eligible.length; ei++) {
      const def     = eligible[ei];
      const campIdx = CAMPAIGN_DEFS.indexOf(def);
      const f       = dayFactor(campIdx, date);
      const expected = def.dailyConversions * f;

      // Nombre de conversions pour ce jour-là (déterministe)
      const rng      = lcg(di * 1_000 + ei * 37 + 7);
      const base     = Math.floor(expected);
      const extra    = rng() < (expected - base) ? 1 : 0;
      const count    = base + extra;

      for (let k = 0; k < count; k++) {
        const src      = pickSource(rng);
        const payout   = src.payouts[Math.floor(rng() * src.payouts.length)];
        const hourFrac = rng();
        const minFrac  = rng();
        const ts       = new Date(date.getTime() + Math.floor(hourFrac * 86_400_000));
        ts.setUTCMinutes(Math.floor(minFrac * 60));

        const hexA = Math.floor(rng() * 0xffffff).toString(16).padStart(6, "0");
        const hexB = Math.floor(rng() * 0xffffff).toString(16).padStart(6, "0");

        result.push({
          id:           `demo-${String(di).padStart(5,"0")}-${String(ei).padStart(2,"0")}-${String(k).padStart(2,"0")}`,
          campaignId:   def.externalId,
          campaignName: def.name,
          clickId:      `ck_${hexA}${hexB}`,
          revenue:      payout,
          currency:     "USD",
          source:       src.name,
          createdAt:    ts.toISOString(),
        });
      }
    }
  }

  return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// ─── Export statique DEMO_CAMPAIGNS (30j, pour compatibilité) ────────────────
//
// Calculé dynamiquement sur les 30 derniers jours.

const [_d30From, _d30To] = defaultRange(30);
const _days30 = parseDateRange(_d30From, _d30To);

export const DEMO_CAMPAIGNS: DemoCampaign[] = CAMPAIGN_DEFS.map((def, idx) => {
  const s = computeCampaignStats(def, idx, _days30);
  return {
    id: def.id, externalId: def.externalId, name: def.name,
    network: def.network, status: def.status,
    spend: s.spend, revenue: s.revenue,
    impressions: s.impressions, clicks: s.clicks, conversions: s.conversions,
  };
});

// ─── Helpers réponses API ────────────────────────────────────────────────────

/** /api/sync GET et /api/stats GET — liste de campagnes + KPIs */
export function getDemoSyncResponse(dateFrom: string, dateTo: string) {
  const days      = parseDateRange(dateFrom, dateTo);
  const campStats = CAMPAIGN_DEFS.map((def, idx) => computeCampaignStats(def, idx, days));

  const totalSpend   = campStats.reduce((s, c) => s + c.spend,       0);
  const totalRevenue = campStats.reduce((s, c) => s + c.revenue,     0);
  const totalImpr    = campStats.reduce((s, c) => s + c.impressions, 0);
  const totalClicks  = campStats.reduce((s, c) => s + c.clicks,      0);
  const profit       = totalRevenue - totalSpend;
  const roi          = totalSpend > 0 ? ((profit / totalSpend) * 100).toFixed(1) : "0";

  const byNetwork: Record<string, { spend: number; revenue: number; impressions: number; clicks: number }> = {};
  for (const c of campStats) {
    if (!byNetwork[c.network]) byNetwork[c.network] = { spend: 0, revenue: 0, impressions: 0, clicks: 0 };
    byNetwork[c.network].spend       += c.spend;
    byNetwork[c.network].revenue     += c.revenue;
    byNetwork[c.network].impressions += c.impressions;
    byNetwork[c.network].clicks      += c.clicks;
  }

  return {
    _demo: true,
    kpis: {
      totalSpend:   totalSpend.toFixed(2),
      totalRevenue: totalRevenue.toFixed(2),
      profit:       profit.toFixed(2),
      roi,
      totalImpressions: totalImpr,
      totalClicks,
    },
    byNetwork,
    syncErrors: [],
    dateFrom,
    dateTo,
    campaigns: campStats.map(c => ({
      id:          c.id,
      externalId:  c.externalId,
      name:        c.name,
      network:     c.network,
      status:      c.status,
      spend:       c.spend,
      revenue:     c.revenue,
      impressions: c.impressions,
      clicks:      c.clicks,
      conversions: c.conversions,
      syncedAt:    new Date().toISOString(),
    })),
  };
}

export function getDemoStatsResponse(dateFrom: string, dateTo: string) {
  return getDemoSyncResponse(dateFrom, dateTo);
}

/** /api/dashboard/stats GET — dashboard BentoDashboard */
export function getDemoDashboardStatsResponse(dateFrom?: string, dateTo?: string) {
  const [from, to] = (dateFrom && dateTo) ? [dateFrom, dateTo] : defaultRange(30);

  const days      = parseDateRange(from, to);
  const nDays     = days.length;
  const campStats = CAMPAIGN_DEFS.map((def, idx) => computeCampaignStats(def, idx, days));

  // Conversions postback pour la plage
  const convs     = generateDemoConversions(from, to);
  const pbRevenue = convs.reduce((s, c) => s + c.revenue, 0);
  const pbConvs   = convs.length;

  const tSpend   = campStats.reduce((s, c) => s + c.spend,       0);
  const tRevenue = campStats.reduce((s, c) => s + c.revenue,     0) + pbRevenue;
  const tProfit  = tRevenue - tSpend;
  const tRoi     = tSpend > 0 ? (tProfit / tSpend) * 100 : 0;
  const tImps    = campStats.reduce((s, c) => s + c.impressions, 0);
  const tClicks  = campStats.reduce((s, c) => s + c.clicks,      0);
  const tConvs   = campStats.reduce((s, c) => s + c.conversions, 0) + pbConvs;
  const ctr      = tImps > 0 ? (tClicks / tImps) * 100 : 0;

  const nonPop      = campStats.filter(c => !/pop/i.test(c.name));
  const npImps      = nonPop.reduce((s, c) => s + c.impressions, 0);
  const ctrNoPop    = npImps > 0 ? (nonPop.reduce((s, c) => s + c.clicks, 0) / npImps) * 100 : 0;

  // ── Format-split ─────────────────────────────────────────────────────────
  const popCmps     = campStats.filter(c =>  /pop/i.test(c.name));
  const clickImps   = npImps;
  const clickClicks = nonPop.reduce((s, c) => s + c.clicks, 0);
  const clickCtr    = ctrNoPop;
  const popImps     = popCmps.reduce((s, c) => s + c.impressions, 0);
  const popConvs    = popCmps.reduce((s, c) => s + c.conversions, 0);
  const popConvRate = popImps > 0 ? (popConvs / popImps) * 100 : 0;

  // Chart : somme quotidienne de toutes les campagnes + postback lissé
  const pbDailyRev = pbRevenue / nDays;
  const chartData  = days.map((date, i) => {
    let sp = 0, rv = 0;
    for (const c of campStats) {
      sp += c.dailyChart[i].spend;
      rv += c.dailyChart[i].revenue;
    }
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");
    const rvTotal = rv + pbDailyRev;
    return {
      date:    `${dd}/${mm}`,
      spend:   Math.round(sp      * 100) / 100,
      revenue: Math.round(rvTotal * 100) / 100,
      profit:  Math.round((rvTotal - sp) * 100) / 100,
    };
  });

  // Per-network
  const netMap: Record<string, { spend: number; revenue: number; campaigns: number; impressions: number }> = {};
  for (const c of campStats) {
    if (!netMap[c.network]) netMap[c.network] = { spend: 0, revenue: 0, campaigns: 0, impressions: 0 };
    netMap[c.network].spend       += c.spend;
    netMap[c.network].revenue     += c.revenue;
    netMap[c.network].campaigns   += 1;
    netMap[c.network].impressions += c.impressions;
  }
  const networkBreakdown = Object.entries(netMap).map(([network, s]) => ({
    network, ...s,
    profit: s.revenue - s.spend,
    roi:    s.spend > 0 ? ((s.revenue - s.spend) / s.spend) * 100 : 0,
  }));

  // Liste campagnes pour le tableau du dashboard
  const campList = campStats
    .map(c => ({
      id: c.id, name: c.name, network: c.network, status: c.status,
      spend: c.spend, revenue: c.revenue,
      profit: c.revenue - c.spend,
      roi:    c.spend > 0 ? ((c.revenue - c.spend) / c.spend) * 100 : 0,
    }))
    .sort((a, b) => a.profit - b.profit);

  const alerts       = campList.filter(c => c.status === "ACTIVE" && c.roi < -5).slice(0, 5);
  const topCampaigns = campList.slice(0, 10);

  // Tendance vs période précédente de même durée
  const prevTo      = new Date(new Date(from + "T00:00:00Z").getTime() - 86_400_000);
  const prevFrom    = new Date(prevTo.getTime() - (nDays - 1) * 86_400_000);
  const prevDays    = parseDateRange(prevFrom.toISOString().slice(0, 10), prevTo.toISOString().slice(0, 10));
  const prevStats   = CAMPAIGN_DEFS.map((def, idx) => computeCampaignStats(def, idx, prevDays));
  const prevConvs   = generateDemoConversions(prevFrom.toISOString().slice(0, 10), prevTo.toISOString().slice(0, 10));
  const prevRevenue = prevStats.reduce((s, c) => s + c.revenue, 0) + prevConvs.reduce((s, c) => s + c.revenue, 0);
  const prevProfit  = prevRevenue - prevStats.reduce((s, c) => s + c.spend, 0);
  const trend       = prevProfit > 0 ? Math.round(((tProfit - prevProfit) / prevProfit) * 100) : null;

  return {
    _demo: true,
    totals: {
      totalSpend: tSpend, totalRevenue: tRevenue, totalProfit: tProfit, roi: tRoi,
      totalImps: tImps, totalClicks: tClicks, totalConvs: tConvs, ctr, ctrNoPop,
      postbackRevenue: pbRevenue,
      postbackConvs:   pbConvs,
      clickImps, clickClicks, clickCtr,
      popImps, popConvs, popConvRate,
    },
    chartData,
    networkBreakdown,
    activeCampaigns: CAMPAIGN_DEFS.filter(c => c.status === "ACTIVE").length,
    alerts, topCampaigns,
    trend,
  };
}

/** /api/campaigns/[id] GET — détail d'une campagne */
export function getDemoCampaignDetail(id: string, dateFrom?: string, dateTo?: string) {
  const defIdx = CAMPAIGN_DEFS.findIndex(c => c.id === id);
  if (defIdx === -1) return null;
  const def = CAMPAIGN_DEFS[defIdx];

  const [from, to] = (dateFrom && dateTo) ? [dateFrom, dateTo] : defaultRange(90);
  const days  = parseDateRange(from, to);
  const stats = computeCampaignStats(def, defIdx, days);

  // Conversions postback pour cette campagne sur la plage
  const allConvs  = generateDemoConversions(from, to);
  const campConvs = allConvs.filter(c => c.campaignId === def.externalId);
  const pbRevenue = campConvs.reduce((s, c) => s + c.revenue, 0);

  const totalRevenue = stats.revenue + pbRevenue;
  const totalProfit  = totalRevenue - stats.spend;
  const roi          = stats.spend > 0 ? (totalProfit / stats.spend) * 100 : 0;
  const ctr          = stats.impressions > 0 ? (stats.clicks / stats.impressions) * 100 : 0;

  return {
    _demo: true,
    campaign: {
      id: def.id, externalId: def.externalId, name: def.name,
      network: def.network, status: def.status,
      syncedAt: new Date().toISOString(),
    },
    totals: {
      totalSpend:      stats.spend,
      totalRevenue,
      totalProfit,     roi,
      totalImps:       stats.impressions,
      totalClicks:     stats.clicks,
      totalConvs:      stats.conversions + campConvs.length,
      ctr,
      postbackRevenue: pbRevenue,
      postbackConvs:   campConvs.length,
    },
    chartData:         stats.dailyChart,
    dailyCount:        days.length,
    recentConversions: campConvs.slice(0, 20),
  };
}

// ─── /api/engine/actions — flux d'événements démo ─────────────────────────────

function timeAgoDemo(minutesAgo: number): string {
  if (minutesAgo < 60)   return `${minutesAgo}m ago`;
  if (minutesAgo < 1440) return `${Math.round(minutesAgo / 60)}h ago`;
  return                        `${Math.round(minutesAgo / 1440)}d ago`;
}

export function getDemoEngineActions() {
  const now = new Date();

  const rawEvents: Array<{
    id: string; state: string; tone: "rose"|"amber"|"emerald";
    isRecommend: boolean; campaign: string; network: string;
    detail: string; minutesAgo: number;
  }> = [
    { id: "demo-ev-1", state: "KILL",  tone: "rose",    isRecommend: false, campaign: "iGaming — Pop Under — US — Mobile",       network: "EXOCLICK",     detail: "ROI -46.8% · spend threshold exceeded",     minutesAgo: 4   },
    { id: "demo-ev-2", state: "SCALE", tone: "emerald", isRecommend: false, campaign: "Adult Dating — Push — US — Tier1",         network: "EXOCLICK",     detail: "+25% · €12,264 → €15,330 (+€3,066 injected)", minutesAgo: 18  },
    { id: "demo-ev-3", state: "WATCH", tone: "amber",   isRecommend: false, campaign: "Nutra — Display — DE — Mobile",            network: "EXOCLICK",     detail: "ROI -27.9% · monitoring for 24h",           minutesAgo: 35  },
    { id: "demo-ev-4", state: "SCALE", tone: "emerald", isRecommend: true,  campaign: "Crypto — Push — AU — Desktop",             network: "EXOCLICK",     detail: "ROI +77.8% · recommend +25% scale",         minutesAgo: 52  },
    { id: "demo-ev-5", state: "KILL",  tone: "rose",    isRecommend: true,  campaign: "Finance — Native — BE — Desktop",          network: "TRAFFICJUNKY", detail: "ROI -38.6% · recommend pause",              minutesAgo: 78  },
    { id: "demo-ev-6", state: "SCALE", tone: "emerald", isRecommend: false, campaign: "Casino — Native — UK — Desktop",           network: "EXOCLICK",     detail: "+25% · €9,527 → €11,909 (+€2,382 injected)", minutesAgo: 112 },
    { id: "demo-ev-7", state: "WATCH", tone: "amber",   isRecommend: false, campaign: "VOD — Display — MX — All Devices",         network: "TRAFFICJUNKY", detail: "ROI +5.4% · below scale threshold",         minutesAgo: 187 },
    { id: "demo-ev-8", state: "SCALE", tone: "emerald", isRecommend: false, campaign: "Dating — Push — FR — Mobile Broad",        network: "TRAFFICSTARS", detail: "+25% · €6,732 → €8,415 (+€1,683 injected)", minutesAgo: 240 },
    { id: "demo-ev-9", state: "KILL",  tone: "rose",    isRecommend: false, campaign: "iGaming — Pop Under — US — Mobile",        network: "EXOCLICK",     detail: "ROI -52.1% · auto-killed by engine",        minutesAgo: 1320 },
    { id: "demo-ev-10",state: "SCALE", tone: "emerald", isRecommend: false, campaign: "Crypto — Native — AU — Desktop",           network: "TRAFFICSTARS", detail: "+25% · €9,029 → €11,286 (+€2,257 injected)", minutesAgo: 1440 },
  ];

  const events = rawEvents.map(e => ({
    id:          e.id,
    state:       e.state,
    tone:        e.tone,
    isRecommend: e.isRecommend,
    campaign:    e.campaign,
    network:     e.network,
    detail:      e.detail,
    time:        timeAgoDemo(e.minutesAgo),
    createdAt:   new Date(now.getTime() - e.minutesAgo * 60_000).toISOString(),
  }));

  const todayMidnight = new Date(now);
  todayMidnight.setHours(0, 0, 0, 0);

  const todayEvents   = events.filter(e => new Date(e.createdAt) >= todayMidnight);
  const killedToday   = todayEvents.filter(e => e.state === "KILL"  && !e.isRecommend).length;
  const watchToday    = todayEvents.filter(e => e.state === "WATCH" && !e.isRecommend).length;
  const scaledToday   = todayEvents.filter(e => e.state === "SCALE" && !e.isRecommend).length;
  const suggestPause  = todayEvents.filter(e => e.isRecommend && e.state === "KILL").length;
  const suggestScale  = todayEvents.filter(e => e.isRecommend && e.state === "SCALE").length;

  return {
    events,
    todayCount:     todayEvents.length,
    killedToday,
    watchToday,
    scaledToday,
    suggestTotal:   suggestPause + suggestScale,
    suggestPause,
    suggestScale,
    rulesCount:     3,
    protectedAmount: 4850,
    lastEventAt:    events[0]?.createdAt ?? null,
  };
}

/** /api/conversions GET — liste des conversions paginée */
export function getDemoConversionsResponse(dateFrom: string, dateTo: string, page = 0, limit = 50) {
  const all   = generateDemoConversions(dateFrom, dateTo);
  const start = page * limit;
  const rows  = all.slice(start, start + limit);

  const totalRevenue = all.reduce((s, c) => s + c.revenue, 0);

  const srcMap: Record<string, { revenue: number; count: number }> = {};
  for (const c of all) {
    if (!srcMap[c.source]) srcMap[c.source] = { revenue: 0, count: 0 };
    srcMap[c.source].revenue += c.revenue;
    srcMap[c.source].count   += 1;
  }
  const bySource = Object.entries(srcMap)
    .map(([source, s]) => ({ source, ...s }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    _demo:        true,
    totalRevenue,
    totalCount:   all.length,
    page, limit,
    rows,
    bySource,
  };
}

/** Comptes demo affichés dans Settings */
export const DEMO_ACCOUNTS: { network: string; isActive: boolean }[] = [
  { network: "EXOCLICK",     isActive: true },
  { network: "TRAFFICSTARS", isActive: true },
  { network: "TRAFFICJUNKY", isActive: true },
];

// ─── /api/security/logs — Sync logs + Audit trail démo ────────────────────────

function timeAgoDemoSec(minAgo: number): string {
  if (minAgo < 60)   return `${minAgo}m ago`;
  if (minAgo < 1440) return `${Math.round(minAgo / 60)}h ago`;
  return                    `${Math.round(minAgo / 1440)}d ago`;
}
function fmtDateDemo(minAgo: number): string {
  const d = new Date(Date.now() - minAgo * 60_000);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function getDemoSecurityLogs() {
  // ── Sync logs ──────────────────────────────────────────────────────────────
  const rawSync: Array<{
    id: string; type: string; isError: boolean; network: string;
    detail: string; minAgo: number;
  }> = [
    { id:"sl-1",  type:"SYNC",      isError:false, network:"EXOCLICK",     detail:"16 campaigns × 1 day · daily",        minAgo: 12   },
    { id:"sl-2",  type:"SYNC",      isError:false, network:"TRAFFICSTARS", detail:"8 campaigns × 1 day · daily",          minAgo: 14   },
    { id:"sl-3",  type:"SYNC",      isError:false, network:"TRAFFICJUNKY", detail:"4 campaigns × 1 day · daily",          minAgo: 16   },
    { id:"sl-4",  type:"SYNC",      isError:false, network:"EXOCLICK",     detail:"16 campaigns × 1 day · daily",        minAgo: 1452 },
    { id:"sl-5",  type:"SYNC",      isError:false, network:"TRAFFICSTARS", detail:"8 campaigns × 1 day · daily",          minAgo: 1454 },
    { id:"sl-6",  type:"SYNC",      isError:false, network:"TRAFFICJUNKY", detail:"4 campaigns × 1 day · daily",          minAgo: 1456 },
    { id:"sl-7",  type:"API_ERROR", isError:true,  network:"EXOCLICK",     detail:"Rate limit exceeded (429) — retried",  minAgo: 2910 },
    { id:"sl-8",  type:"SYNC",      isError:false, network:"EXOCLICK",     detail:"16 campaigns × 1 day · daily",        minAgo: 2920 },
    { id:"sl-9",  type:"SYNC",      isError:false, network:"TRAFFICSTARS", detail:"8 campaigns × 1 day · daily",          minAgo: 2922 },
    { id:"sl-10", type:"SYNC",      isError:false, network:"TRAFFICJUNKY", detail:"4 campaigns × 1 day · daily",          minAgo: 2924 },
    { id:"sl-11", type:"SYNC",      isError:false, network:"EXOCLICK",     detail:"16 campaigns × 90 days · backfill",   minAgo: 4380 },
    { id:"sl-12", type:"SYNC",      isError:false, network:"TRAFFICSTARS", detail:"8 campaigns × 90 days · backfill",     minAgo: 4382 },
    { id:"sl-13", type:"SYNC",      isError:false, network:"TRAFFICJUNKY", detail:"4 campaigns × 90 days · backfill",     minAgo: 4384 },
  ];

  // ── Audit trail ────────────────────────────────────────────────────────────
  type Tone = "rose"|"amber"|"emerald"|"blue"|"white";
  const rawAudit: Array<{
    id: string; type: string; action: string; tone: Tone;
    campaign: string; network: string; detail: string; minAgo: number;
  }> = [
    { id:"at-1",  type:"KILL_SWITCH_TRIGGERED", action:"Killed",       tone:"rose",    campaign:"iGaming — Pop Under — US — Mobile",       network:"EXOCLICK",     detail:"ROI -46.8%",           minAgo:4    },
    { id:"at-2",  type:"CAMPAIGN_ACTION",        action:"Scaled +25%",  tone:"emerald", campaign:"Adult Dating — Push — US — Tier1",         network:"EXOCLICK",     detail:"ROI +68.4%",           minAgo:18   },
    { id:"at-3",  type:"DECISION_WATCH",         action:"Watching",     tone:"amber",   campaign:"Nutra — Display — DE — Mobile",            network:"EXOCLICK",     detail:"ROI -27.9%",           minAgo:35   },
    { id:"at-4",  type:"CAMPAIGN_ACTION",        action:"Scaled +25%",  tone:"emerald", campaign:"Crypto — Push — AU — Desktop",             network:"EXOCLICK",     detail:"ROI +77.8%",           minAgo:52   },
    { id:"at-5",  type:"KILL_SWITCH_TRIGGERED",  action:"Paused",       tone:"rose",    campaign:"Finance — Native — BE — Desktop",          network:"TRAFFICJUNKY", detail:"ROI -38.6%",           minAgo:78   },
    { id:"at-6",  type:"CAMPAIGN_ACTION",        action:"Scaled +25%",  tone:"emerald", campaign:"Casino — Native — UK — Desktop",           network:"EXOCLICK",     detail:"ROI +65.2%",           minAgo:112  },
    { id:"at-7",  type:"DECISION_WATCH",         action:"Watching",     tone:"amber",   campaign:"VOD — Display — MX — All Devices",         network:"TRAFFICJUNKY", detail:"ROI +5.4%",            minAgo:187  },
    { id:"at-8",  type:"CAMPAIGN_ACTION",        action:"Scaled +25%",  tone:"emerald", campaign:"Dating — Push — FR — Mobile Broad",        network:"TRAFFICSTARS", detail:"ROI +67.9%",           minAgo:240  },
    { id:"at-9",  type:"KILL_SWITCH_TRIGGERED",  action:"Killed",       tone:"rose",    campaign:"iGaming — Pop Under — US — Mobile",        network:"EXOCLICK",     detail:"ROI -52.1%",           minAgo:1320 },
    { id:"at-10", type:"CAMPAIGN_ACTION",        action:"Scaled +25%",  tone:"emerald", campaign:"Crypto — Native — AU — Desktop",           network:"TRAFFICSTARS", detail:"ROI +78.9%",           minAgo:1440 },
    { id:"at-11", type:"KILL_SWITCH_TRIGGERED",  action:"Killed",       tone:"rose",    campaign:"Nutra — Display — DE — Mobile",            network:"EXOCLICK",     detail:"ROI -34.2%",           minAgo:2880 },
    { id:"at-12", type:"CAMPAIGN_ACTION",        action:"Paused",       tone:"rose",    campaign:"Finance — Banner — UK — Desktop",          network:"TRAFFICSTARS", detail:"Manual · budget limit", minAgo:4320 },
    { id:"at-13", type:"BUDGET_ALERT",           action:"Budget cap",   tone:"amber",   campaign:"Adult Dating — Banner — BR — Mobile",      network:"TRAFFICJUNKY", detail:"Daily cap reached",    minAgo:5760 },
    { id:"at-14", type:"KILL_SWITCH_RESTORED",   action:"Resumed",      tone:"emerald", campaign:"iGaming — Pop Under — US — Mobile",        network:"EXOCLICK",     detail:"Manually re-enabled",  minAgo:7200 },
  ];

  const syncLogs = rawSync.map(e => ({
    id:        e.id,
    type:      e.type,
    isError:   e.isError,
    network:   e.network,
    detail:    e.detail,
    time:      timeAgoDemoSec(e.minAgo),
    datetime:  fmtDateDemo(e.minAgo),
    createdAt: new Date(Date.now() - e.minAgo * 60_000).toISOString(),
  }));

  const auditTrail = rawAudit.map(e => ({
    id:        e.id,
    type:      e.type,
    action:    e.action,
    tone:      e.tone,
    campaign:  e.campaign,
    network:   e.network,
    detail:    e.detail,
    time:      timeAgoDemoSec(e.minAgo),
    datetime:  fmtDateDemo(e.minAgo),
    createdAt: new Date(Date.now() - e.minAgo * 60_000).toISOString(),
  }));

  return {
    syncLogs,
    auditTrail,
    syncTotal:  syncLogs.length,
    auditTotal: auditTrail.length,
  };
}
