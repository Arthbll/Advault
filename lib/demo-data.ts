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
  network: "EXOCLICK" | "TRAFFICSTARS" | "TRAFFICJUNKY";
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
  network: "EXOCLICK" | "TRAFFICSTARS" | "TRAFFICJUNKY";
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
