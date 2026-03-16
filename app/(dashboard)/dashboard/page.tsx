"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, TrendingUp, TrendingDown, AlertCircle, Activity } from "lucide-react";
import KpiCard from "@/components/dashboard/KpiCard";
import ProfitChart from "@/components/dashboard/ProfitChart";
import NetworkBreakdown from "@/components/dashboard/NetworkBreakdown";
import PlatformCards from "@/components/dashboard/PlatformCards";
import WorldImpressionsCard from "@/components/dashboard/WorldImpressionsCard";
import DateRangePicker, { DateRange } from "@/components/ui/DateRangePicker";
import { sendNotification } from "@/components/settings/NotificationSettings";

function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

interface SyncData {
  kpis: { totalSpend: string; totalRevenue: string; profit: string; roi: string; totalImpressions: number; totalClicks: number };
  byNetwork: Record<string, { spend: number; revenue: number; impressions: number; clicks: number }>;
  syncErrors: { message: string; createdAt: string }[];
  campaigns: Array<{ id: string; name: string; network: string; status: string; spend: number; revenue: number; impressions: number; clicks: number; conversions: number }>;
}

function fmtMoney(n: number) {
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
}
function fmtImpr(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
function buildChartData(campaigns: SyncData["campaigns"], dateFrom: string, dateTo: string) {
  const from = new Date(dateFrom), to = new Date(dateTo);
  const totalDays  = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400_000));
  const totalSpend = campaigns.reduce((s, c) => s + c.spend,   0);
  const totalRev   = campaigns.reduce((s, c) => s + c.revenue, 0);
  return Array.from({ length: totalDays }, (_, i) => {
    const d = new Date(from); d.setDate(d.getDate() + i);
    const dd = `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
    const s = parseFloat((totalSpend / totalDays).toFixed(2));
    const r = parseFloat((totalRev   / totalDays).toFixed(2));
    return { date: dd, spend: s, revenue: r, profit: parseFloat((r - s).toFixed(2)) };
  });
}
function buildNetworkData(byNetwork: SyncData["byNetwork"]) {
  return Object.entries(byNetwork).map(([network, v]) => {
    const profit = v.revenue - v.spend;
    const roi    = v.spend > 0 ? (profit / v.spend) * 100 : 0;
    return { network, spend: v.spend, revenue: v.revenue, profit, roi, campaigns: 0 };
  });
}
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

export default function DashboardPage() {
  const [data,      setData]      = useState<SyncData | null>(null);
  const [syncing,   setSyncing]   = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [syncMsg,   setSyncMsg]   = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>({ from: daysAgo(90), to: new Date().toISOString().slice(0,10) });

  const fetchData = useCallback(async (range?: DateRange) => {
    const r = range ?? dateRange;
    try {
      const res = await fetch(`/api/stats?dateFrom=${r.from}&dateTo=${r.to}`);
      if (res.ok) setData(await res.json());
    } finally { setLoading(false); }
  }, [dateRange]);

  const handleSync = async () => {
    setSyncing(true); setSyncMsg(null);
    try {
      const res  = await fetch("/api/sync", { method: "POST" });
      const json = await res.json();
      if (json.errors?.length) {
        setSyncMsg(`⚠ ${json.errors[0]}`);
        sendNotification("AdVault — Erreur sync", json.errors[0], "onSync");
      } else {
        const msg = json.message ?? `${json.synced} campagne(s) synchronisées`;
        setSyncMsg(`✓ ${msg}`);
        sendNotification("AdVault — Sync terminée ✓", msg, "onSync");
      }
      localStorage.setItem("lastSyncAt", new Date().toISOString());
      // Streak : initialise si ROI positif et pas encore de streak
      if (roi >= 0 && !localStorage.getItem("streakStartDate")) {
        localStorage.setItem("streakStartDate", new Date().toISOString());
      } else if (roi < 0) {
        localStorage.removeItem("streakStartDate");
      }
      await fetchData();
    } finally { setSyncing(false); }
  };

  // Auto-sync : vérifie toutes les minutes si l'intervalle configuré est écoulé
  useEffect(() => {
    function checkAutoSync() {
      const intervalH = Number(localStorage.getItem("autoSyncInterval") ?? 0);
      if (intervalH === 0) return;
      const lastSyncAt = localStorage.getItem("lastSyncAt");
      if (!lastSyncAt) { handleSync(); return; }
      const elapsed = (Date.now() - new Date(lastSyncAt).getTime()) / 3600000;
      if (elapsed >= intervalH) handleSync();
    }
    checkAutoSync();
    const timer = setInterval(checkAutoSync, 60_000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  function handleRangeChange(r: DateRange) { setDateRange(r); setLoading(true); fetchData(r); }

  const DEMO = false;
  const profit      = DEMO ? 4218.50  : data ? parseFloat(data.kpis.profit)      : 0;
  const roi         = DEMO ? 34.7     : data ? parseFloat(data.kpis.roi)          : 0;
  const spend       = DEMO ? 12150.00 : data ? parseFloat(data.kpis.totalSpend)   : 0;
  const revenue     = DEMO ? 16368.50 : data ? parseFloat(data.kpis.totalRevenue) : 0;
  const impressions = DEMO ? 2840000  : data?.kpis.totalImpressions ?? 0;
  const clicks      = DEMO ? 91200    : data?.kpis.totalClicks      ?? 0;
  const activeCamps = DEMO ? 7        : data?.campaigns.filter(c => c.status === "ACTIVE").length ?? 0;
  const hasData     = !loading && data && data.campaigns.length > 0;
  const chartData   = hasData ? buildChartData(data!.campaigns, dateRange.from, dateRange.to) : [];
  const networkData = hasData ? buildNetworkData(data!.byNetwork) : [];
  const impressionsRoadmap = hasData
    ? Object.entries(data!.byNetwork).map(([network, v]) => ({
        network,
        impressions: v.impressions,
      }))
    : [];
  const topCampaigns = hasData
    ? data!.campaigns
        .slice()
        .sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0))
        .slice(0, 6)
    : [];

  // ── Message contextuel ──
  function getContextMsg() {
    if (roi >= 40)  return { text: "Tes campagnes performent au top ce mois-ci", color: "#A5B4FC" };
    if (roi >= 20)  return { text: "Bonne dynamique — continue sur cette lancée", color: "#A5B4FC" };
    if (roi >= 0)   return { text: "Marge positive, surveille tes coûts de près", color: "#52525B" };
    if (roi >= -20) return { text: "Quelques réseaux à ajuster ce mois-ci", color: "#FACC6B" };
    return           { text: "ROI négatif — revois tes seuils Kill-Switch", color: "#F97373" };
  }
  const ctxMsg = getContextMsg();

  // ── Objectif mensuel ──
  const [goal, setGoal] = useState(0);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const goalRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setGoal(Number(localStorage.getItem("monthlyGoal") ?? 0));
  }, []);

  useEffect(() => {
    if (editingGoal) goalRef.current?.focus();
  }, [editingGoal]);

  function saveGoal() {
    const val = parseFloat(goalInput.replace(/[^0-9.]/g, "")) || 0;
    setGoal(val);
    localStorage.setItem("monthlyGoal", String(val));
    setEditingGoal(false);
  }

  const goalPct = goal > 0 ? Math.min(100, (revenue / goal) * 100) : 0;

  return (
    <div style={{ background: "transparent", minHeight: "100vh" }}>

      {/* ── Header ── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "36px 32px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <p style={{ fontSize: 12, color: "#6B7280", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
            <Activity size={10} strokeWidth={1.5} style={{ color: "#A5B4FC" }} />
            {getGreeting()}, Arthur
          </p>
          <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.04em", color: "#F5F5F7", lineHeight: 1, margin: 0 }}>
            Dashboard
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <DateRangePicker value={dateRange} onChange={handleRangeChange} />

          <motion.button
            onClick={handleSync} disabled={syncing}
            whileHover={!syncing ? { y: -1, boxShadow: "0 10px 30px rgba(0,0,0,0.7)" } : {}}
            whileTap={!syncing ? { scale: 0.96 } : {}}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "9px 16px", borderRadius: 999,
              border: "1px solid rgba(74,222,128,0.18)",
              background: "rgba(15,23,42,0.9)", color: "#E5E7EB",
              fontSize: 13, fontWeight: 600,
              boxShadow: "0 0 0 1px rgba(148,163,184,0.08)",
              cursor: syncing ? "not-allowed" : "pointer",
              opacity: syncing ? 0.7 : 1,
              transition: "box-shadow 0.2s, border-color 0.2s",
            }}
          >
            <motion.div
              animate={syncing ? { rotate: 360 } : {}}
              transition={syncing ? { repeat: Infinity, duration: 0.7, ease: "linear" } : {}}
            >
              <RefreshCw size={12} strokeWidth={2} />
            </motion.div>
            {syncing ? "Sync…" : "Synchroniser"}
          </motion.button>

          {/* ROI pill */}
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "9px 14px", borderRadius: 999,
            background: "rgba(15,23,42,0.9)",
            color: roi >= 0 ? "#4ADE80" : "#F97373",
            border: `1px solid ${roi >= 0 ? "rgba(74,222,128,0.22)" : "rgba(249,115,115,0.22)"}`,
            fontSize: 13, fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
          }}>
            {roi >= 0
              ? <TrendingUp  size={12} strokeWidth={2} />
              : <TrendingDown size={12} strokeWidth={2} />}
            {roi >= 0 ? "+" : ""}{roi.toFixed(1)}%
          </div>
        </motion.div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 32px 48px" }}>

        {/* Sub-label + message contextuel */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <p style={{ fontSize: 12, color: "#3F3F46" }}>
            {hasData
              ? `${data!.campaigns.length} campagne${data!.campaigns.length > 1 ? "s" : ""} · données live`
              : "Synchronise tes réseaux pour afficher les données"}
          </p>
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            style={{ fontSize: 12, color: ctxMsg.color, fontWeight: 500 }}
          >
            {ctxMsg.text}
          </motion.p>
        </div>

        {/* ── Alerts ── */}
        <AnimatePresence>
          {syncMsg && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "11px 16px", borderRadius: 14, marginBottom: 20,
                background: syncMsg.startsWith("⚠") ? "rgba(127,29,29,0.5)" : "rgba(15,23,42,0.9)",
                color:      syncMsg.startsWith("⚠") ? "#F97373"            : "#E5E7EB",
                border:     syncMsg.startsWith("⚠") ? "1px solid rgba(248,113,113,0.35)" : "1px solid rgba(148,163,184,0.45)",
                fontSize: 13,
              }}
            >
              <AlertCircle size={13} strokeWidth={1.5} />{syncMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {data?.syncErrors?.length && !syncMsg?.startsWith("✓") ? (
          <div style={{ display: "flex", gap: 8, padding: "11px 16px", borderRadius: 12, background: "rgba(255,69,58,0.08)", color: "#FF453A", fontSize: 13, marginBottom: 20, border: "1px solid rgba(255,69,58,0.12)" }}>
            <AlertCircle size={13} strokeWidth={1.5} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{data.syncErrors[0].message}</span>
          </div>
        ) : null}

        {/* ── Top grid inspiré de la maquette ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,2.1fr) minmax(0,1.4fr) minmax(0,1.4fr)",
            gap: 16,
            marginBottom: 24,
            alignItems: "stretch",
          }}
        >
          {/* Bloc principal Revenus / Profit / ROI */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
            whileHover={{ y: -2 }}
            style={{
              borderRadius: 28,
              padding: "20px 22px",
              background: "radial-gradient(circle at top left, rgba(88,28,135,0.4), transparent 55%), rgba(5,8,22,0.98)",
              border: "1px solid rgba(148,163,184,0.35)",
              boxShadow: "0 22px 55px rgba(15,23,42,0.9)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6B7280", marginBottom: 4 }}>
                  Performance globale
                </p>
                <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em", color: "#F9FAFB", margin: 0 }}>
                  Revenus & profit publicitaires
                </h2>
              </div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  borderRadius: 999,
                  background: "rgba(15,23,42,0.9)",
                  border: "1px solid rgba(55,65,81,0.9)",
                  padding: 3,
                  fontSize: 11,
                  color: "#9CA3AF",
                  gap: 2,
                }}
              >
                {["Today", "Week", "Month", "Range"].map(label => {
                  const isActive = label === "Month";
                  return (
                    <span
                      key={label}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 999,
                        background: isActive ? "rgba(76,81,191,0.9)" : "transparent",
                        color: isActive ? "#F9FAFB" : "#9CA3AF",
                        fontWeight: isActive ? 600 : 500,
                      }}
                    >
                      {label}
                    </span>
                  );
                })}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1.1fr) minmax(0,1.1fr)",
                gap: 12,
                marginTop: 6,
              }}
            >
              <div>
                <p style={{ fontSize: 11, color: "#6B7280", marginBottom: 4 }}>Profit net ce {dateRange.from === dateRange.to ? "jour" : "mois"}</p>
                <motion.p
                  key={profit}
                  style={{
                    fontSize: 32,
                    fontWeight: 700,
                    letterSpacing: "-0.04em",
                    color: profit >= 0 ? "#4ADE80" : "#F97373",
                    margin: 0,
                  }}
                  initial={{ scale: 0.96, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                >
                  {fmtMoney(profit)}
                </motion.p>
                <p style={{ fontSize: 11, color: "#6B7280", marginTop: 6 }}>
                  {fmtMoney(revenue)} revenus · {fmtMoney(spend)} dépenses
                </p>
              </div>

              <div>
                <p style={{ fontSize: 11, color: "#6B7280", marginBottom: 4 }}>ROI global</p>
                <motion.p
                  key={roi}
                  style={{
                    fontSize: 26,
                    fontWeight: 700,
                    letterSpacing: "-0.03em",
                    color: roi >= 0 ? "#A5B4FC" : "#F97373",
                    margin: 0,
                  }}
                  initial={{ scale: 0.96, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                >
                  {roi >= 0 ? "+" : ""}
                  {roi.toFixed(1)}%
                </motion.p>
                <p style={{ fontSize: 11, color: "#6B7280", marginTop: 6 }}>(Profit / Dépenses) × 100</p>
              </div>

              <div>
                <p style={{ fontSize: 11, color: "#6B7280", marginBottom: 4 }}>Volume</p>
                <motion.p
                  key={`${impressions}-${clicks}`}
                  style={{
                    fontSize: 20,
                    fontWeight: 600,
                    letterSpacing: "-0.02em",
                    color: "#F9FAFB",
                    margin: 0,
                  }}
                  initial={{ scale: 0.96, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                >
                  {fmtImpr(impressions)} impr. · {fmtImpr(clicks)} clics
                </motion.p>
                <p style={{ fontSize: 11, color: "#6B7280", marginTop: 6 }}>
                  CTR {impressions > 0 ? `${((clicks / impressions) * 100).toFixed(2)}%` : "—"}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Bloc "Objectif du mois" façon carte centrale */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            onClick={() => {
              if (!editingGoal) {
                setGoalInput(goal > 0 ? String(goal) : "");
                setEditingGoal(true);
              }
            }}
            style={{
              borderRadius: 28,
              padding: "18px 20px",
              background: "radial-gradient(circle at top, rgba(30,64,175,0.45), transparent 60%), rgba(5,8,22,0.98)",
              border: "1px solid rgba(55,65,81,0.9)",
              boxShadow: "0 18px 45px rgba(15,23,42,0.9)",
              cursor: editingGoal ? "default" : "pointer",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
            whileHover={!editingGoal ? { y: -2 } : {}}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280" }}>
                Objectif du mois
              </span>
              {goal > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "3px 8px",
                    borderRadius: 999,
                    background: goalPct >= 100 ? "rgba(74,222,128,0.18)" : "rgba(31,41,55,1)",
                    color: goalPct >= 100 ? "#4ADE80" : "#9CA3AF",
                    border: `1px solid ${goalPct >= 100 ? "rgba(74,222,128,0.4)" : "rgba(55,65,81,0.9)"}`,
                  }}
                >
                  {goalPct >= 100 ? "✓ Atteint" : `${goalPct.toFixed(0)}%`}
                </span>
              )}
            </div>

            {editingGoal ? (
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                <input
                  ref={goalRef}
                  value={goalInput}
                  onChange={e => setGoalInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveGoal(); if (e.key === "Escape") setEditingGoal(false); }}
                  placeholder="Ex: 20000"
                  style={{
                    flex: 1,
                    background: "#020617",
                    border: "1px solid rgba(148,163,184,0.6)",
                    borderRadius: 10,
                    color: "#E5E7EB",
                    fontSize: 12,
                    padding: "6px 10px",
                    outline: "none",
                  }}
                />
                <button onClick={saveGoal} style={{ fontSize: 11, color: "#E5E7EB", background: "rgba(76,81,191,1)", borderRadius: 999, border: "none", padding: "6px 10px", cursor: "pointer", fontWeight: 600 }}>
                  OK
                </button>
                <button onClick={() => setEditingGoal(false)} style={{ fontSize: 11, color: "#6B7280", background: "transparent", border: "none", cursor: "pointer" }}>
                  ✕
                </button>
              </div>
            ) : (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.04em", color: "#F9FAFB", margin: 0 }}>
                  {goal > 0 ? fmtMoney(goal) : "Définir un objectif"}
                </p>
                <p style={{ fontSize: 11, color: "#6B7280", marginTop: 6 }}>
                  {goal > 0 ? `${fmtMoney(revenue)} réalisés sur la période` : "Cliquer pour fixer ton objectif mensuel"}
                </p>
              </div>
            )}

            <div style={{ height: 4, background: "rgba(31,41,55,1)", borderRadius: 999, overflow: "hidden" }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${goalPct}%` }}
                transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
                style={{
                  height: "100%",
                  borderRadius: 999,
                  background: goalPct >= 100
                    ? "linear-gradient(90deg, rgba(74,222,128,0.6), #4ADE80)"
                    : "linear-gradient(90deg, rgba(129,140,248,0.5), #4ADE80)",
                }}
              />
            </div>
          </motion.div>

          {/* Bloc "Engagement / conversions" façon installs */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            whileHover={{ y: -2 }}
            style={{
              borderRadius: 28,
              padding: "18px 20px",
              background: "radial-gradient(circle at top, rgba(250,204,21,0.28), transparent 60%), rgba(5,8,22,0.98)",
              border: "1px solid rgba(55,65,81,0.9)",
              boxShadow: "0 18px 45px rgba(15,23,42,0.9)",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280", marginBottom: 4 }}>
                  Engagement & conversions
                </p>
                <p style={{ fontSize: 20, fontWeight: 600, color: "#F9FAFB", margin: 0 }}>
                  {fmtImpr(clicks)} clics · {fmtImpr(impressions)} impr.
                </p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10, marginTop: 4 }}>
              {[
                { label: "Clics", value: clicks, color: "#A5B4FC" },
                { label: "Conversions", value: hasData ? data!.campaigns.reduce((s, c) => s + c.conversions, 0) : 0, color: "#4ADE80" },
                { label: "CPC moyen", value: clicks > 0 ? spend / clicks : 0, color: "#FACC6B", isMoney: true },
              ].map(({ label, value, color, isMoney }) => (
                <div key={label} style={{ borderRadius: 16, padding: "10px 12px", background: "rgba(15,23,42,0.96)", border: "1px solid rgba(55,65,81,0.9)" }}>
                  <p style={{ fontSize: 10, color: "#6B7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
                  <p style={{ fontSize: 16, fontWeight: 600, color, margin: 0, fontVariantNumeric: "tabular-nums" }}>
                    {isMoney ? fmtMoney(value) : fmtImpr(value)}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ── Ligne KPI compacte sous les blocs principaux ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
          <KpiCard index={2} label="Dépenses" value={fmtMoney(spend)} sub={`${Object.keys(data?.byNetwork ?? {}).length} réseaux`} />
          <KpiCard index={3} label="Revenus" value={fmtMoney(revenue)} sub="Brut sur la période" />
          <KpiCard index={4} label="Impressions" value={fmtImpr(impressions)} sub={impressions > 0 ? `CTR ${((clicks/impressions)*100).toFixed(2)}%` : "—"} />
          <KpiCard index={5} label="Campagnes actives" value={String(activeCamps)} sub={`${activeCamps} actives / ${data?.campaigns.length ?? 0}`} />
        </div>

        {/* ── Roadmap des impressions (origine par réseau) ── */}
        {impressionsRoadmap.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22, duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
            style={{
              borderRadius: 24,
              padding: "18px 20px 14px",
              marginBottom: 24,
              background: "rgba(5,8,22,0.96)",
              border: "1px solid rgba(55,65,81,0.9)",
              boxShadow: "0 18px 40px rgba(15,23,42,0.9)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280", marginBottom: 4 }}>
                  Roadmap des impressions
                </p>
                <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0 }}>
                  D’où viennent tes impressions sur cette période
                </p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {impressionsRoadmap
                .slice()
                .sort((a, b) => b.impressions - a.impressions)
                .map(row => {
                  const share = impressions > 0 ? (row.impressions / impressions) * 100 : 0;
                  return (
                    <div key={row.network} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 12, color: "#E5E7EB", fontWeight: 500 }}>{row.network}</span>
                        <span style={{ fontSize: 11, color: "#6B7280" }}>
                          {fmtImpr(row.impressions)} · {share.toFixed(1)}%
                        </span>
                      </div>
                      <div style={{ height: 3, background: "rgba(31,41,55,1)", borderRadius: 999, overflow: "hidden" }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${share}%` }}
                          transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
                          style={{
                            height: "100%",
                            borderRadius: 999,
                            background: "linear-gradient(90deg, rgba(129,140,248,0.6), #4ADE80)",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </motion.div>
        )}

        {/* ── Bloc "comme la maquette" : top list + map impressions ── */}
        {hasData && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(0,1.8fr)", gap: 16, marginBottom: 28 }}>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              whileHover={{ y: -2 }}
              style={{
                borderRadius: 28,
                padding: "18px 20px",
                background: "rgba(5,8,22,0.96)",
                border: "1px solid rgba(55,65,81,0.9)",
                boxShadow: "0 18px 45px rgba(15,23,42,0.9)",
              }}
            >
              <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280", marginBottom: 10 }}>
                Top campagnes (impressions)
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {topCampaigns.map(c => {
                  const ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
                  return (
                    <div
                      key={c.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: "10px 12px",
                        borderRadius: 16,
                        background: "rgba(15,23,42,0.92)",
                        border: "1px solid rgba(55,65,81,0.9)",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#E5E7EB", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {c.name}
                        </p>
                        <p style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>
                          {c.network} · {c.status}
                        </p>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: "#F9FAFB", margin: 0, fontVariantNumeric: "tabular-nums" }}>
                          {fmtImpr(c.impressions)}
                        </p>
                        <p style={{ fontSize: 11, color: "#6B7280", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
                          CTR {c.impressions > 0 ? `${ctr.toFixed(2)}%` : "—"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            <WorldImpressionsCard
              totalImpressions={impressions}
              sources={impressionsRoadmap.map(r => ({ label: r.network, value: r.impressions }))}
            />
          </div>
        )}

        {/* ── Empty state ── */}
        {!hasData && !loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              padding: "72px 32px", borderRadius: 20, marginBottom: 28,
              background: "#111113",
              border: "1px solid rgba(255,255,255,0.06)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.35)",
            }}
          >
            <div style={{ width: 48, height: 48, borderRadius: 16, background: "rgba(0,255,135,0.08)", border: "1px solid rgba(0,255,135,0.12)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Activity size={20} strokeWidth={1.5} style={{ color: "#00FF87" }} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 600, color: "#F5F5F7", marginBottom: 6 }}>Aucune donnée</p>
            <p style={{ fontSize: 13, color: "#3F3F46", marginBottom: 24 }}>
              Connecte tes réseaux dans le Vault puis synchronise
            </p>
            <motion.button
              onClick={handleSync}
              whileHover={{ y: -1, boxShadow: "0 0 0 1px rgba(0,255,135,0.25), 0 4px 20px rgba(0,255,135,0.2)" }}
              whileTap={{ scale: 0.97 }}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "10px 22px", borderRadius: 12,
                border: "1px solid rgba(0,255,135,0.2)",
                background: "rgba(0,255,135,0.08)", color: "#00FF87",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              <RefreshCw size={12} strokeWidth={2} /> Synchroniser
            </motion.button>
          </motion.div>
        )}

        {/* ── Platform breakdown ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} style={{ marginBottom: 28 }}>
          <PlatformCards data={networkData} campaigns={data?.campaigns ?? []} />
        </motion.div>

        {hasData && (
          <>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }} style={{ marginBottom: 20 }}>
              <ProfitChart data={chartData} />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36 }}>
              <NetworkBreakdown data={networkData} />
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}
