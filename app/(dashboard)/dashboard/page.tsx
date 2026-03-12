"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, TrendingUp, TrendingDown, AlertCircle, Activity } from "lucide-react";
import KpiCard from "@/components/dashboard/KpiCard";
import ProfitChart from "@/components/dashboard/ProfitChart";
import NetworkBreakdown from "@/components/dashboard/NetworkBreakdown";
import PlatformCards from "@/components/dashboard/PlatformCards";
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

  // ⚠️ DEMO — retirer quand les vraies données sont positives
  const DEMO = true;
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

  // ── Message contextuel ──
  function getContextMsg() {
    if (roi >= 40)  return { text: "Tes campagnes performent au top ce mois-ci", color: "#00FF87" };
    if (roi >= 20)  return { text: "Bonne dynamique — continue sur cette lancée", color: "#00FF87" };
    if (roi >= 0)   return { text: "Marge positive, surveille tes coûts de près", color: "#52525B" };
    if (roi >= -20) return { text: "Quelques réseaux à ajuster ce mois-ci", color: "#FF9F0A" };
    return           { text: "ROI négatif — revois tes seuils Kill-Switch", color: "#FF453A" };
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
    <div style={{ background: "#0A0A0B", minHeight: "100vh" }}>

      {/* ── Header ── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "36px 32px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <p style={{ fontSize: 12, color: "#3F3F46", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
            <Activity size={10} strokeWidth={1.5} style={{ color: "#00FF87" }} />
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
            whileHover={!syncing ? { y: -1, boxShadow: "0 0 0 1px rgba(0,255,135,0.25), 0 4px 16px rgba(0,255,135,0.2)" } : {}}
            whileTap={!syncing ? { scale: 0.96 } : {}}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "9px 16px", borderRadius: 12, border: "1px solid rgba(0,255,135,0.2)",
              background: "rgba(0,255,135,0.08)", color: "#00FF87",
              fontSize: 13, fontWeight: 600,
              boxShadow: "0 0 0 1px rgba(0,255,135,0.08)",
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
            padding: "9px 14px", borderRadius: 12,
            background: roi >= 0 ? "rgba(0,255,135,0.08)" : "rgba(255,69,58,0.08)",
            color: roi >= 0 ? "#00FF87" : "#FF453A",
            border: `1px solid ${roi >= 0 ? "rgba(0,255,135,0.15)" : "rgba(255,69,58,0.15)"}`,
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
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "11px 16px", borderRadius: 12, marginBottom: 20,
                background: syncMsg.startsWith("⚠") ? "rgba(255,69,58,0.08)" : "rgba(0,255,135,0.08)",
                color:      syncMsg.startsWith("⚠") ? "#FF453A"              : "#00FF87",
                border:     syncMsg.startsWith("⚠") ? "1px solid rgba(255,69,58,0.15)" : "1px solid rgba(0,255,135,0.15)",
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

        {/* ── KPIs Row 1 — 2 large ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <KpiCard large index={0} label="Profit Net"
            value={fmtMoney(profit)}
            sub={`${fmtMoney(revenue)} revenus · ${fmtMoney(spend)} dépenses`}
            accent={profit >= 0 ? "green" : "red"}
            trend={profit >= 0 ? "up" : "down"}
            badge={profit >= 0 ? "Positif" : "Négatif"}
          />
          <KpiCard large index={1} label="ROI Global"
            value={`${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%`}
            sub="(Profit / Dépenses) × 100"
            accent={roi >= 0 ? "green" : "red"}
            trend={roi >= 0 ? "up" : "down"}
          />
        </div>

        {/* ── Objectif mensuel ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
          onClick={() => { if (!editingGoal) { setGoalInput(goal > 0 ? String(goal) : ""); setEditingGoal(true); } }}
          style={{
            background: "#111113", borderRadius: 16, padding: "14px 20px",
            border: "1px solid rgba(255,255,255,0.06)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.35)",
            marginBottom: 10, cursor: editingGoal ? "default" : "pointer",
            transition: "border-color 0.2s",
          }}
          whileHover={!editingGoal ? { borderColor: "rgba(0,255,135,0.15)" } : {}}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#3F3F46", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                Objectif du mois
              </span>
              {goal > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 99,
                  background: goalPct >= 100 ? "rgba(0,255,135,0.12)" : "rgba(255,255,255,0.04)",
                  color: goalPct >= 100 ? "#00FF87" : "#52525B",
                  border: `1px solid ${goalPct >= 100 ? "rgba(0,255,135,0.2)" : "rgba(255,255,255,0.06)"}`,
                }}>
                  {goalPct >= 100 ? "✓ Atteint" : `${goalPct.toFixed(0)}%`}
                </span>
              )}
            </div>
            {editingGoal ? (
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  ref={goalRef}
                  value={goalInput}
                  onChange={e => setGoalInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveGoal(); if (e.key === "Escape") setEditingGoal(false); }}
                  placeholder="Ex: 20000"
                  style={{
                    background: "#1A1A1C", border: "1px solid rgba(0,255,135,0.3)", borderRadius: 8,
                    color: "#F5F5F7", fontSize: 12, padding: "4px 10px", outline: "none", width: 100,
                  }}
                />
                <button onClick={saveGoal} style={{ fontSize: 11, color: "#00FF87", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>OK</button>
                <button onClick={() => setEditingGoal(false)} style={{ fontSize: 11, color: "#3F3F46", background: "none", border: "none", cursor: "pointer" }}>✕</button>
              </div>
            ) : (
              <span style={{ fontSize: 12, color: "#3F3F46" }}>
                {goal > 0 ? `${fmtMoney(revenue)} / ${fmtMoney(goal)}` : "Cliquer pour définir un objectif →"}
              </span>
            )}
          </div>
          {/* Progress bar */}
          <div style={{ height: 3, background: "rgba(255,255,255,0.04)", borderRadius: 99, overflow: "hidden" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${goalPct}%` }}
              transition={{ duration: 1, ease: [0.23, 1, 0.32, 1], delay: 0.3 }}
              style={{
                height: "100%", borderRadius: 99,
                background: goalPct >= 100
                  ? "linear-gradient(90deg, rgba(0,255,135,0.5), #00FF87)"
                  : goalPct >= 60
                    ? "linear-gradient(90deg, rgba(0,255,135,0.3), rgba(0,255,135,0.7))"
                    : "linear-gradient(90deg, rgba(0,255,135,0.2), rgba(0,255,135,0.5))",
                boxShadow: goalPct > 0 ? "0 0 8px rgba(0,255,135,0.3)" : "none",
              }}
            />
          </div>
        </motion.div>

        {/* ── KPIs Row 2 — 4 small ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 28 }}>
          <KpiCard index={2} label="Dépenses"    value={fmtMoney(spend)}       sub={`${Object.keys(data?.byNetwork ?? {}).length} réseaux`} />
          <KpiCard index={3} label="Revenus"     value={fmtMoney(revenue)}     sub="Brut" />
          <KpiCard index={4} label="Impressions" value={fmtImpr(impressions)}  sub={impressions > 0 ? `CTR ${((clicks/impressions)*100).toFixed(2)}%` : "—"} />
          <KpiCard index={5} label="Campagnes"   value={String(activeCamps)}   sub={`${activeCamps} active${activeCamps !== 1 ? "s" : ""} / ${data?.campaigns.length ?? 0}`} />
        </div>

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
