"use client";

import { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconRefresh, IconPause, IconPlay, IconZap, IconArrowUpRight,
  IconWallet, IconTrendingUp, IconActivity, IconTarget, IconGauge,
  IconVault, IconWarning, IconChevronRight,
} from "@/components/ui/Icons";
import EmptyStateCard from "@/components/ui/EmptyStateCard";
import {
  AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

// ─── Design tokens ────────────────────────────────────────────────────────────

const BG       = "#0a0a0e";
const SURFACE  = "rgba(255,255,255,0.030)";
const BORDER   = "rgba(255,255,255,0.07)";
const TEXT_HI  = "rgba(255,255,255,0.92)";
const TEXT_MID = "rgba(255,255,255,0.60)";
const TEXT_DIM = "rgba(255,255,255,0.28)";

const CARD: React.CSSProperties = {
  background: SURFACE,
  backdropFilter: "blur(20px)",
  border: `1px solid ${BORDER}`,
  borderRadius: 18,
  overflow: "hidden",
};

const NET_META: Record<string, { color: string; label: string }> = {
  EXOCLICK:     { color: "#f59e0b", label: "ExoClick"     },
  TRAFFICSTARS: { color: "#8b5cf6", label: "TrafficStars" },
  TRAFFICJUNKY: { color: "#0ea5e9", label: "TrafficJunky" },
  PROPELLERADS: { color: "#f97316", label: "PropellerAds" },
  ADSTERRA:     { color: "#06b6d4", label: "Adsterra"     },
};

const STATUS_CFG: Record<string, { color: string; label: string; bg: string }> = {
  ACTIVE: { color: "#10b981", label: "Active",  bg: "rgba(16,185,129,0.1)"  },
  PAUSED: { color: "#f59e0b", label: "Paused",  bg: "rgba(245,158,11,0.1)"  },
  KILLED: { color: "#f87171", label: "Killed",  bg: "rgba(248,113,113,0.1)" },
  DRAFT:  { color: "#6366f1", label: "Draft",   bg: "rgba(99,102,241,0.1)"  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface CampaignInfo {
  id: string; externalId: string; name: string;
  network: string; status: string; syncedAt: string;
}
interface CampaignTotals {
  totalSpend: number; totalRevenue: number; totalProfit: number;
  roi: number; totalImps: number; totalClicks: number;
  totalConvs: number; ctr: number;
  postbackRevenue?: number; postbackConvs?: number;
}
interface ChartPt {
  date: string; spend: number; revenue: number; profit: number;
  impressions: number; clicks: number;
}
interface ConvRow {
  id: string; revenue: number; currency: string;
  source: string | null; clickId: string | null; createdAt: string;
}

interface DetailData {
  campaign: CampaignInfo;
  totals: CampaignTotals;
  chartData: ChartPt[];
  dailyCount: number;
  recentConversions?: ConvRow[];
}

interface Variation {
  id: string; title?: string; description?: string;
  imageUrl?: string; url?: string; status?: string;
  clicks?: number; impressions?: number; ctr?: number;
}

type MetricKey = "spend" | "revenue" | "profit";

// ─── Format helpers ───────────────────────────────────────────────────────────

function fmtMoney(n: number) {
  const abs  = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(2)}`;
}
function fmtBig(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return Math.round(n).toLocaleString("en-GB");
}
function fmtPct(n: number) { return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`; }
function fmtCTR(n: number) { return `${n.toFixed(2)}%`; }
function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `il y a ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs}h`;
  return `il y a ${Math.floor(hrs / 24)}j`;
}

// ─── Animated counter (tic tac tac) ──────────────────────────────────────────

function AnimatedCounter({
  target,
  formatter,
  duration = 1400,
}: {
  target: number;
  formatter: (n: number) => string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(formatter(0));
  const fmtRef = useRef(formatter);
  fmtRef.current = formatter;

  useEffect(() => {
    if (target === 0) { setDisplay(fmtRef.current(0)); return; }
    const start = performance.now();
    let raf: number;
    function tick(now: number) {
      const p      = Math.min((now - start) / duration, 1);
      const eased  = 1 - Math.pow(1 - p, 4); // quartic ease-out — rapide puis ralentit
      setDisplay(fmtRef.current(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return <>{display}</>;
}

// Formateurs pour l'animation (jamais "—", toujours une valeur affichable)
const a$ = (n: number) =>
  "$" + new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.max(0, n));
const aBig = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return Math.round(n).toLocaleString("en-GB");
};
const aPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
const aCTR = (n: number) => `${n.toFixed(2)}%`;

// ─── KPI Mini Card ────────────────────────────────────────────────────────────

function KPICard({ label, rawValue, formatter, sub, subRaw, subFormatter, color, icon, idx }: {
  label: string;
  rawValue: number;
  formatter: (n: number) => string;
  sub?: string;
  subRaw?: number;
  subFormatter?: (n: number) => string;
  color: string;
  icon: React.ReactNode;
  idx: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: 0.08 + idx * 0.07, ease: "easeOut" }}
      style={{
        ...CARD,
        padding: "18px 20px",
        position: "relative",
        boxShadow: "0 1px 0 rgba(255,255,255,0.05) inset, 0 4px 20px rgba(0,0,0,0.3)",
        flex: 1, minWidth: 0,
      }}>
      {/* Top accent line */}
      <div style={{
        position: "absolute", top: 0, left: "25%", right: "25%", height: 1,
        background: `linear-gradient(90deg, transparent, ${color}80, transparent)`,
      }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: TEXT_DIM }}>
          {label}
        </span>
        <div style={{
          width: 30, height: 30, borderRadius: 9, display: "flex",
          alignItems: "center", justifyContent: "center",
          background: `${color}12`, border: `1px solid ${color}20`, color,
        }}>
          {icon}
        </div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", color: TEXT_HI, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
        <AnimatedCounter target={rawValue} formatter={formatter} />
      </div>
      {(sub ?? (subRaw !== undefined && subFormatter)) && (
        <div style={{ fontSize: 10, color: TEXT_DIM, marginTop: 5 }}>
          {subRaw !== undefined && subFormatter
            ? <AnimatedCounter target={subRaw} formatter={subFormatter} duration={1600} />
            : sub}
        </div>
      )}
    </motion.div>
  );
}

// ─── Chart Tooltip ────────────────────────────────────────────────────────────

const ChartTip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string; name: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#18181f", border: "1px solid rgba(255,255,255,0.09)",
      borderRadius: 12, padding: "9px 13px", fontSize: 11,
      boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
    }}>
      <p style={{ color: TEXT_DIM, marginBottom: 5, fontSize: 10 }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{
          color: p.color, marginBottom: 2,
          fontVariantNumeric: "tabular-nums", fontWeight: 600,
        }}>
          {p.name}: {fmtMoney(Number(p.value))}
        </p>
      ))}
    </div>
  );
};

// ─── Variation Card ───────────────────────────────────────────────────────────

function VariationCard({ v, idx }: { v: Variation; idx: number }) {
  const statusColor =
    v.status === "active"  ? "#10b981" :
    v.status === "paused"  ? "#f59e0b" :
    "rgba(255,255,255,0.3)";

  return (
    <div
      style={{
        ...CARD,
        borderRadius: 14, overflow: "hidden",
        boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
      }}>
      {/* Image / placeholder */}
      <div style={{
        height: 130, background: "rgba(255,255,255,0.025)",
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative", overflow: "hidden",
      }}>
        {v.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={v.imageUrl} alt={v.title ?? "variation"}
            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <IconVault size={28} color="rgba(255,255,255,0.12)" />
        )}
        {/* Status dot */}
        <div style={{
          position: "absolute", top: 8, right: 8,
          width: 7, height: 7, borderRadius: "50%",
          background: statusColor,
          boxShadow: `0 0 6px ${statusColor}`,
        }} />
      </div>

      {/* Info */}
      <div style={{ padding: "12px 14px" }}>
        {v.title && (
          <p style={{
            fontSize: 12, fontWeight: 500, color: TEXT_MID,
            marginBottom: 4, overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{v.title}</p>
        )}
        {v.description && (
          <p style={{
            fontSize: 10, color: TEXT_DIM,
            marginBottom: 8, overflow: "hidden",
            display: "-webkit-box", WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}>{v.description}</p>
        )}

        {/* Stats row */}
        {(v.impressions !== undefined || v.clicks !== undefined) && (
          <div style={{ display: "flex", gap: 12, fontSize: 10, color: TEXT_DIM }}>
            {v.impressions !== undefined && (
              <span><span style={{ color: TEXT_HI, fontWeight: 600 }}>{fmtBig(v.impressions)}</span> impr.</span>
            )}
            {v.clicks !== undefined && (
              <span><span style={{ color: TEXT_HI, fontWeight: 600 }}>{fmtBig(v.clicks)}</span> clics</span>
            )}
            {v.ctr !== undefined && (
              <span><span style={{ color: "#38bdf8", fontWeight: 600 }}>{fmtCTR(v.ctr)}</span> CTR</span>
            )}
          </div>
        )}

        {/* Link */}
        {v.url && (
          <a href={v.url} target="_blank" rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              marginTop: 8, fontSize: 10, color: TEXT_DIM,
              textDecoration: "none",
            }}
            onClick={e => e.stopPropagation()}>
            <IconArrowUpRight size={9} />
            {v.url.slice(0, 28)}…
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router   = useRouter();
  const { id }   = use(params);

  const [data,       setData]       = useState<DetailData | null>(null);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState(false);
  const [varLoading, setVarLoading] = useState(false);
  const [acting,     setActing]     = useState<string | null>(null);
  const [metric,     setMetric]     = useState<MetricKey>("revenue");
  const [toast,      setToast]      = useState<{ msg: string; ok: boolean } | null>(null);

  // ── Fetch campaign detail ──────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError(false);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        const res = await fetch(`/api/campaigns/${id}`, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) { router.replace("/dashboard/campaigns"); return; }
        const json = await res.json() as DetailData;
        setData(json);

        // Also fetch variations for ExoClick campaigns
        if (json.campaign.network === "EXOCLICK") {
          setVarLoading(true);
          try {
            const vRes = await fetch(`/api/vault?campaignId=${json.campaign.externalId}`);
            if (vRes.ok) {
              const vJson = await vRes.json() as { variations?: Variation[] };
              setVariations(vJson.variations ?? []);
            }
          } finally {
            setVarLoading(false);
          }
        }
      } catch (e) {
        clearTimeout(timeout);
        if ((e as Error)?.name !== "AbortError") console.error(e);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, router]);

  // ── Actions ───────────────────────────────────────────────────────────────

  async function doAction(action: "pause" | "resume" | "kill") {
    if (!data) return;
    setActing(action);
    try {
      const res  = await fetch(`/api/campaigns/${id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json() as { ok?: boolean; status?: string; error?: string };
      if (json.ok && json.status) {
        setData(prev => prev ? {
          ...prev,
          campaign: { ...prev.campaign, status: json.status! },
        } : null);
        setToast({ msg: `${action} applied successfully`, ok: true });
      } else {
        setToast({ msg: json.error ?? "Error", ok: false });
      }
    } catch {
      setToast({ msg: "Network error", ok: false });
    }
    setActing(null);
    setTimeout(() => setToast(null), 3000);
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const campaign   = data?.campaign;
  const totals     = data?.totals;
  const chartData  = data?.chartData ?? [];
  const net        = NET_META[campaign?.network ?? ""] ?? { color: "#6366f1", label: campaign?.network ?? "?" };
  const statusCfg  = STATUS_CFG[campaign?.status ?? ""] ?? STATUS_CFG.DRAFT;

  const metricTabs: { key: MetricKey; label: string; color: string }[] = [
    { key: "revenue", label: "Revenue", color: "#10b981" },
    { key: "spend",   label: "Spend",   color: "#f59e0b" },
    { key: "profit",  label: "Profit",   color: "#8b5cf6" },
  ];

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", background: BG }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
          <IconRefresh size={20} color={TEXT_DIM} />
        </motion.div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", background: BG, gap: 16 }}>
        <span style={{ fontSize: 13, color: TEXT_MID }}>Could not load campaign data.</span>
        <button
          onClick={() => router.push("/dashboard/campaigns")}
          style={{ fontSize: 12, color: TEXT_DIM, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
        >
          ← Back to campaigns
        </button>
      </div>
    );
  }

  if (!data || !campaign) return null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
      style={{
        minHeight: "100vh", background: BG,
        padding: "20px 32px 80px",
        fontFamily: "'Satoshi', system-ui, sans-serif",
        color: TEXT_HI,
      }}>

      {/* ── Back + Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: "easeOut" }}
        style={{ marginBottom: 28 }}>

        {/* Back link */}
        <button
          onClick={() => router.push("/dashboard/campaigns")}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            marginBottom: 16, fontSize: 12, color: TEXT_DIM, cursor: "pointer",
            background: "none", border: "none", padding: 0,
          }}>
          <IconChevronRight size={13} style={{ transform: "rotate(180deg)" }} /> Back to campaigns
        </button>

        {/* Campaign header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
          <div>
            {/* Network + status row */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "3px 9px", borderRadius: 6,
                background: `${net.color}12`, color: net.color,
                border: `1px solid ${net.color}22`, fontSize: 11, fontWeight: 600,
              }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: net.color,
                  boxShadow: `0 0 6px ${net.color}` }} />
                {net.label}
              </div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "3px 9px", borderRadius: 6,
                background: statusCfg.bg, color: statusCfg.color,
                border: `1px solid ${statusCfg.color}22`, fontSize: 11, fontWeight: 600,
              }}>
                <motion.div
                  animate={campaign.status === "ACTIVE" ? { opacity: [1, 0.2, 1] } : {}}
                  transition={{ duration: 1.8, repeat: Infinity }}
                  style={{ width: 5, height: 5, borderRadius: "50%", background: statusCfg.color }}
                />
                {statusCfg.label}
              </div>
              <span style={{ fontSize: 10, color: TEXT_DIM }}>
                ID: {campaign.externalId} · Sync {relativeTime(campaign.syncedAt)}
              </span>
            </div>
            <h1 style={{
              fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em", margin: 0, color: TEXT_HI,
              maxWidth: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {campaign.name}
            </h1>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {campaign.status === "ACTIVE" && (
              <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }}
                onClick={() => doAction("pause")} disabled={!!acting}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 16px", borderRadius: 10, fontSize: 12, cursor: "pointer",
                  background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.20)",
                  color: "#f59e0b", opacity: acting ? 0.5 : 1,
                }}>
                <IconPause size={12} /> Pause
              </motion.button>
            )}
            {campaign.status === "PAUSED" && (
              <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }}
                onClick={() => doAction("resume")} disabled={!!acting}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 16px", borderRadius: 10, fontSize: 12, cursor: "pointer",
                  background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.20)",
                  color: "#10b981", opacity: acting ? 0.5 : 1,
                }}>
                <IconPlay size={12} /> Reprendre
              </motion.button>
            )}
            {campaign.status !== "KILLED" && (
              <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }}
                onClick={() => doAction("kill")} disabled={!!acting}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 16px", borderRadius: 10, fontSize: 12, cursor: "pointer",
                  background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.18)",
                  color: "#f87171", opacity: acting ? 0.5 : 1,
                }}>
                <IconZap size={12} /> Kill
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── KPI Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 24 }}>
        <KPICard idx={0} label="Spend"       color="#f59e0b" icon={<IconWallet size={14} />}
          rawValue={totals?.totalSpend ?? 0}    formatter={a$} />
        <KPICard idx={1} label="Revenue"     color="#10b981" icon={<IconTrendingUp size={14} />}
          rawValue={totals?.totalRevenue ?? 0}  formatter={a$} />
        <KPICard idx={2} label="ROI"         color="#8b5cf6" icon={<IconGauge size={14} />}
          rawValue={totals?.roi ?? 0}           formatter={aPct}
          subRaw={totals?.totalProfit ?? 0}     subFormatter={(n) => `Profit: ${a$(n)}`} />
        <KPICard idx={3} label="Impressions" color="#38bdf8" icon={<IconActivity size={14} />}
          rawValue={totals?.totalImps ?? 0}     formatter={aBig}
          subRaw={totals?.ctr ?? 0}             subFormatter={(n) => `CTR: ${aCTR(n)}`} />
        <KPICard idx={4} label="Clics"       color="#f472b6" icon={<IconTarget size={14} />}
          rawValue={totals?.totalClicks ?? 0}   formatter={aBig}
          sub={`Conversions: ${totals?.totalConvs ?? 0}`} />
      </div>

      {/* ── Quick navigation strip ── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, delay: 0.38, ease: "easeOut" }}
        style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" as const }}
      >
        {[
          {
            href: `/dashboard/conversions?campaignId=${id}`,
            label: "Transactions",
            sub: "Revenue events for this campaign",
            color: "#10b981", rgb: "16,185,129",
            icon: <IconTrendingUp size={13} />,
          },
          {
            href: `/dashboard/statistics?campaignId=${id}`,
            label: "Analytics",
            sub: "Performance trends over time",
            color: "#6366f1", rgb: "99,102,241",
            icon: <IconActivity size={13} />,
          },
          {
            href: "/dashboard/vault",
            label: "Vault",
            sub: "Assets & routes library",
            color: "#f59e0b", rgb: "245,158,11",
            icon: <IconVault size={13} />,
          },
          {
            href: "/dashboard/rules",
            label: "Decision Rules",
            sub: "Engine logic for this campaign",
            color: "#f472b6", rgb: "244,114,182",
            icon: <IconGauge size={13} />,
          },
        ].map(nav => (
          <Link
            key={nav.label}
            href={nav.href}
            style={{ textDecoration: "none", flex: "1 1 180px", minWidth: 160 }}
          >
            <motion.div
              whileHover={{ y: -2, borderColor: `rgba(${nav.rgb},0.25)` }}
              transition={{ duration: 0.15 }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "12px 16px", borderRadius: 14,
                background: `rgba(${nav.rgb},0.06)`,
                border: `1px solid rgba(${nav.rgb},0.14)`,
                cursor: "pointer",
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: `rgba(${nav.rgb},0.10)`,
                color: nav.color,
              }}>
                {nav.icon}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: nav.color }}>{nav.label}</div>
                <div style={{ fontSize: 10, color: TEXT_DIM, marginTop: 1, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{nav.sub}</div>
              </div>
              <IconArrowUpRight size={11} color={`rgba(${nav.rgb},0.45)`} style={{ marginLeft: "auto", flexShrink: 0 }} />
            </motion.div>
          </Link>
        ))}
      </motion.div>

      {/* ── Area Chart ── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, delay: 0.44, ease: "easeOut" }}
        style={{ ...CARD, padding: "22px 24px 8px", marginBottom: 24 }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: TEXT_MID, margin: 0 }}>Daily performance</h2>
            <p style={{ fontSize: 10, color: TEXT_DIM, marginTop: 3 }}>
              {data.dailyCount} record{data.dailyCount !== 1 ? "s" : ""} synced
            </p>
          </div>
          <div style={{ display: "flex", gap: 3, background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 4 }}>
            {metricTabs.map(m => (
              <button key={m.key} onClick={() => setMetric(m.key)}
                style={{
                  padding: "5px 11px", borderRadius: 7, fontSize: 11, cursor: "pointer",
                  fontWeight: metric === m.key ? 600 : 400,
                  background: metric === m.key ? `${m.color}18` : "transparent",
                  color: metric === m.key ? m.color : TEXT_DIM,
                  border: metric === m.key ? `1px solid ${m.color}28` : "1px solid transparent",
                  transition: "all 0.14s",
                }}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={metric} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                  <defs>
                    {metricTabs.map(m => (
                      <linearGradient key={m.key} id={`cg-${m.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={m.color} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={m.color} stopOpacity={0}    />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.035)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "#3f3f46", fontSize: 10 }}
                    tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <Tooltip content={<ChartTip />} cursor={{ stroke: "rgba(255,255,255,0.05)", strokeWidth: 1 }} />
                  <Area
                    dataKey={metric}
                    stroke={metricTabs.find(m => m.key === metric)?.color ?? "#10b981"}
                    strokeWidth={2}
                    fill={`url(#cg-${metric})`}
                    type="monotone"
                    name={metricTabs.find(m => m.key === metric)?.label ?? metric}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <IconWarning size={14} color={TEXT_DIM} />
                <p style={{ color: TEXT_DIM, fontSize: 12 }}>No daily data available</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* ── Variations grid — ExoClick uniquement ── */}
      {campaign.network === "EXOCLICK" && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: 0.52, ease: "easeOut" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: TEXT_MID, margin: 0 }}>Ad variations</h2>
              <p style={{ fontSize: 10, color: TEXT_DIM, marginTop: 3 }}>
                {varLoading ? "Loading…" : `${variations.length} variation${variations.length !== 1 ? "s" : ""}`}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: TEXT_DIM }}>
              <IconVault size={11} /> Vault
            </div>
          </div>

          {varLoading ? (
            <div style={{
              ...CARD, padding: "48px",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            }}>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                <IconRefresh size={14} color={TEXT_DIM} />
              </motion.div>
              <span style={{ fontSize: 12, color: TEXT_DIM }}>Loading variations…</span>
            </div>
          ) : variations.length === 0 ? (
            <EmptyStateCard
              tone="amber"
              badge="Campaign assets empty"
              title="This campaign has no linked creatives or routes yet."
              text="Attach a creative, connect a route, or open the Vault to complete the setup and make this campaign operational."
              cta1="Open vault"
              cta1Href="/dashboard/vault"
              cta2="Attach assets"
              delay={0.1}
              preview={
                <div style={{
                  width: "100%", maxWidth: 420,
                  borderRadius: 24,
                  border: "1px solid rgba(251,191,36,0.18)",
                  background: "rgba(245,158,11,0.07)",
                  padding: 20,
                }}>
                  <div style={{
                    borderRadius: 18,
                    border: "1px solid rgba(255,255,255,0.07)",
                    background: "rgba(0,0,0,0.12)",
                    padding: 24,
                    display: "flex", flexDirection: "column", alignItems: "center",
                    justifyContent: "center", minHeight: 180, textAlign: "center",
                  }}>
                    <div style={{
                      width: 68, height: 68, borderRadius: 20,
                      border: "1.5px dashed rgba(251,191,36,0.28)",
                      background: "rgba(245,158,11,0.05)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      marginBottom: 16,
                    }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(251,191,36,0.45)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                      </svg>
                    </div>
                    <div style={{ fontSize: 18, letterSpacing: "-0.03em", fontWeight: 300, color: "rgba(255,255,255,0.88)" }}>
                      No linked variations yet
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12, color: "rgba(255,255,255,0.34)", lineHeight: 1.55, maxWidth: "28ch" }}>
                      Banner, GIF, video or route — link one to activate this campaign.
                    </div>
                  </div>
                </div>
              }
            />
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 12,
            }}>
              {variations.map((v, i) => <VariationCard key={v.id ?? i} v={v} idx={i} />)}
            </div>
          )}
        </motion.div>
      )}

      {/* ── Conversions CPA postback ── */}
      {(data.recentConversions ?? []).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: 0.58, ease: "easeOut" }}
          style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: TEXT_MID, margin: 0 }}>
                Conversions CPA
              </h2>
              <p style={{ fontSize: 10, color: TEXT_DIM, marginTop: 3 }}>
                {totals?.postbackConvs ?? 0} conversion{(totals?.postbackConvs ?? 0) !== 1 ? "s" : ""} · {
                  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 })
                    .format(totals?.postbackRevenue ?? 0)
                } revenu postback total
              </p>
            </div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "3px 9px", borderRadius: 7,
              background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)",
              fontSize: 10, fontWeight: 700, color: "#4ade80", letterSpacing: "0.06em",
            }}>
              ✦ CPA
            </div>
          </div>
          <div style={{ ...CARD }}>
            {/* Header row */}
            <div style={{
              display: "grid", gridTemplateColumns: "1.8fr 1fr 1fr 0.9fr",
              padding: "10px 18px",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
            }}>
              {["Date", "Source", "Click ID", "Revenu"].map(h => (
                <span key={h} style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.1em", color: TEXT_DIM }}>
                  {h}
                </span>
              ))}
            </div>
            {(data.recentConversions ?? []).map((conv, i, arr) => (
              <div
                key={conv.id}
                style={{
                  display: "grid", gridTemplateColumns: "1.8fr 1fr 1fr 0.9fr",
                  padding: "11px 18px", alignItems: "center",
                  borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
                }}>
                <span style={{ fontSize: 11, color: TEXT_MID, fontVariantNumeric: "tabular-nums" }}>
                  {new Date(conv.createdAt).toLocaleString("en-GB", {
                    day: "2-digit", month: "2-digit", year: "2-digit",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </span>
                <span style={{
                  display: "inline-flex", alignItems: "center",
                  padding: "2px 7px", borderRadius: 6,
                  background: "rgba(139,92,246,0.1)",
                  color: "#a78bfa", fontSize: 10, fontWeight: 600,
                  width: "fit-content",
                }}>
                  {conv.source ?? "unknown"}
                </span>
                <span style={{ fontSize: 10, color: TEXT_DIM, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {conv.clickId ?? "—"}
                </span>
                <span style={{ fontSize: 13, fontWeight: 500, color: "#4ade80", fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
                  +{new Intl.NumberFormat("en-US", { style: "currency", currency: conv.currency ?? "USD", maximumFractionDigits: 2 }).format(conv.revenue)}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Decision Engine compact panel ── */}
      {(() => {
        const roi = totals?.roi ?? 0;
        const spend = totals?.totalSpend ?? 0;
        const decision = roi < -30 && spend > 200 ? "kill"
                       : roi > 25 && spend > 200  ? "scale"
                       : roi >= -30 && roi < 0    ? "monitor"
                       : roi >= 0 && roi <= 25     ? "watch"
                       : null;
        const decisionCfg = {
          kill:    { color: "#f87171", bg: "rgba(248,113,113,0.07)", border: "rgba(248,113,113,0.16)", label: "Kill recommended",   sub: `ROI ${roi.toFixed(1)}% — below kill threshold (−30%)` },
          scale:   { color: "#4ade80", bg: "rgba(74,222,128,0.07)",  border: "rgba(74,222,128,0.16)",  label: "Scale recommended",   sub: `ROI ${roi.toFixed(1)}% — above scale threshold (+25%)` },
          monitor: { color: "#f59e0b", bg: "rgba(245,158,11,0.07)",  border: "rgba(245,158,11,0.16)",  label: "Under watch",         sub: `ROI ${roi.toFixed(1)}% — inside watch band` },
          watch:   { color: "#fbbf24", bg: "rgba(251,191,36,0.06)",  border: "rgba(251,191,36,0.14)",  label: "Watching",            sub: `ROI ${roi.toFixed(1)}% — stable, no action yet` },
        } as const;
        const cfg = decision ? decisionCfg[decision] : null;
        return (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: 0.64, ease: "easeOut" }}
            style={{ marginBottom: 24 }}
          >
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 20px",
              borderRadius: 16,
              background: cfg ? cfg.bg : "rgba(255,255,255,0.02)",
              border: `1px solid ${cfg ? cfg.border : "rgba(255,255,255,0.07)"}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {/* Pulsing indicator */}
                <div style={{ position: "relative", width: 8, height: 8, flexShrink: 0 }}>
                  {cfg && (
                    <motion.div
                      animate={{ scale: [1, 2.2], opacity: [0.55, 0] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                      style={{ position: "absolute", inset: 0, borderRadius: "50%", background: cfg.color }}
                    />
                  )}
                  <div style={{ position: "absolute", inset: 1, borderRadius: "50%", background: cfg ? cfg.color : "rgba(255,255,255,0.2)" }} />
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.14em", color: cfg ? cfg.color : TEXT_DIM }}>
                    Decision Engine
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: cfg ? cfg.color : TEXT_MID, marginTop: 2 }}>
                    {cfg ? cfg.label : spend < 200 ? "Awaiting minimum spend (€200)" : "Monitoring"}
                  </div>
                  {cfg && (
                    <div style={{ fontSize: 11, color: TEXT_DIM, marginTop: 2 }}>{cfg.sub}</div>
                  )}
                </div>
              </div>
              <Link
                href="/dashboard/rules"
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", borderRadius: 10, textDecoration: "none",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  fontSize: 11, fontWeight: 500, color: TEXT_MID,
                  whiteSpace: "nowrap" as const,
                  transition: "color 0.15s, border-color 0.15s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = TEXT_HI; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = TEXT_MID; }}
              >
                <IconGauge size={11} />
                Edit decision rules
                <IconChevronRight size={10} />
              </Link>
            </div>
          </motion.div>
        );
      })()}

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed", bottom: 24, right: 24,
              padding: "10px 18px", borderRadius: 12, fontSize: 12, fontWeight: 500,
              background: toast.ok ? "rgba(16,185,129,0.08)" : "rgba(248,113,113,0.08)",
              color: toast.ok ? "#10b981" : "#f87171",
              border: toast.ok ? "1px solid rgba(16,185,129,0.15)" : "1px solid rgba(248,113,113,0.15)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              zIndex: 100,
            }}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
