"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconRefresh, IconPause, IconPlay, IconMinus, IconArrowRight, IconX,
} from "@/components/ui/Icons";
import ResumeCampaignModal, { type DraftInfo } from "@/components/campaigns/ResumeCampaignModal";

const DRAFT_KEY          = "profitdash_campaign_draft";
const ARCHIVED_DRAFTS_KEY = "profitdash_archived_drafts";
const STEP_LABELS        = ["Identity","Geo","Targeting","Schedule","Budget","Publishers","Decision Rules","Creative"];

interface ArchivedDraft {
  id:         string;
  name:       string;
  step:       number;
  maxStep:    number;
  stepLabel:  string;
  savedAt:    string;
  archivedAt: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form:       any;   // full wizard form snapshot for restore
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Campaign {
  id: string; name: string; network: string; status: string;
  spend: number; revenue: number; impressions: number; clicks: number; conversions: number;
}

type EngineState = "SCALING" | "WATCHING" | "MONITORED" | "NEEDS_ACTION" | "PAUSED" | "KILLED";
type OpFilter    = "ALL" | "ACTIVE" | "SCALING" | "NEEDS_ACTION" | "PAUSED" | "KILLED" | "ARCHIVED";

interface EngineRules { killRoi: number; watchLow: number; scaleRoi: number; }
const DEFAULT_ENGINE_RULES: EngineRules = { killRoi: -30, watchLow: -15, scaleRoi: 30 };

// ─── Engine ───────────────────────────────────────────────────────────────────

const ENGINE_CFG: Record<EngineState, { label: string; color: string; rgb: string }> = {
  SCALING:      { label: "Scaling",      color: "#4ade80", rgb: "74,222,128"   },
  WATCHING:     { label: "Watching",     color: "#fbbf24", rgb: "251,191,36"   },
  MONITORED:    { label: "Monitored",    color: "#fbbf24", rgb: "251,191,36"   },
  NEEDS_ACTION: { label: "Needs Action", color: "#f87171", rgb: "248,113,113"  },
  PAUSED:       { label: "Paused",       color: "rgba(255,255,255,0.45)", rgb: "255,255,255" },
  KILLED:       { label: "Killed",       color: "#f87171", rgb: "248,113,113"  },
};

function getEngineState(c: Campaign, rules: EngineRules = DEFAULT_ENGINE_RULES): EngineState {
  if (c.status === "KILLED") return "KILLED";
  if (c.status === "PAUSED") return "PAUSED";
  const roi = c.spend > 0 ? ((c.revenue - c.spend) / c.spend) * 100 : 0;
  if (roi >= rules.scaleRoi)  return "SCALING";
  if (roi >= 0)               return "WATCHING";
  if (roi >= rules.watchLow)  return "MONITORED";
  return "NEEDS_ACTION";
}

// ─── Palette ──────────────────────────────────────────────────────────────────

const C_GREEN = "#4ade80";
const C_RED   = "#f87171";
const C_WHITE = (op: number) => `rgba(255,255,255,${op})`;

const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1];

const COL_LABEL: React.CSSProperties = {
  fontSize: 10, fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.16em",
  color: "rgba(255,255,255,0.26)",
  margin: 0,
};

// ─── Networks ─────────────────────────────────────────────────────────────────

const NET_CFG: Record<string, { label: string; domain: string; color: string; rgb: string }> = {
  EXOCLICK:     { label: "ExoClick",     domain: "exoclick.com",     color: "#f59e0b", rgb: "245,158,11"  },
  TRAFFICSTARS: { label: "TrafficStars", domain: "trafficstars.com", color: "#8b5cf6", rgb: "139,92,246"  },
  TRAFFICJUNKY: { label: "TrafficJunky", domain: "trafficjunky.com", color: "#0ea5e9", rgb: "14,165,233"  },
};

const NET_KEYS = Object.keys(NET_CFG);
function faviconUrl(d: string) { return `https://www.google.com/s2/favicons?domain=${d}&sz=32`; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function si(i: number) {
  return {
    initial:    { opacity: 0, y: 10, filter: "blur(3px)" },
    animate:    { opacity: 1, y: 0,  filter: "blur(0px)" },
    transition: { duration: 0.45, delay: i * 0.07, ease: EASE },
  };
}

// ─── Filter config ────────────────────────────────────────────────────────────

const OP_FILTERS: { id: OpFilter; label: string }[] = [
  { id: "ALL",          label: "All"          },
  { id: "ACTIVE",       label: "Active"       },
  { id: "SCALING",      label: "Scaling"      },
  { id: "NEEDS_ACTION", label: "Needs Action" },
  { id: "PAUSED",       label: "Paused"       },
  { id: "KILLED",       label: "Killed"       },
  { id: "ARCHIVED",     label: "Archived"     },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [campaigns,     setCampaigns]     = useState<Campaign[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [syncing,       setSyncing]       = useState(false);
  const [backfilling,   setBackfilling]   = useState(false);
  const [acting,        setActing]        = useState<string | null>(null);
  const [opFilter,      setOpFilter]      = useState<OpFilter>("ALL");
  const [networkFilter, setNetworkFilter] = useState<string | null>(null);
  const [toast,         setToast]         = useState<{ msg: string; ok: boolean } | null>(null);
  const [draftInfo,      setDraftInfo]      = useState<DraftInfo | null>(null);
  const [archivedDrafts, setArchivedDrafts] = useState<ArchivedDraft[]>([]);
  const [engineRules,    setEngineRules]    = useState<EngineRules>(DEFAULT_ENGINE_RULES);
  // ── Recovery flow states (optimistic UI) ────────────────────────────────────
  const [excludedIds,    setExcludedIds]    = useState<Set<string>>(new Set());
  const [pausedAutoIds,  setPausedAutoIds]  = useState<Set<string>>(new Set());

  // ── Read ?filter= URL param (from dashboard Action Center links) ─────────────
  useEffect(() => {
    const f = searchParams.get("filter");
    if (!f) return;
    const valid: OpFilter[] = ["ALL","ACTIVE","SCALING","NEEDS_ACTION","PAUSED","KILLED","ARCHIVED"];
    if (valid.includes(f as OpFilter)) setOpFilter(f as OpFilter);
  }, [searchParams]);

  function loadArchivedDrafts() {
    try {
      const raw = localStorage.getItem(ARCHIVED_DRAFTS_KEY);
      setArchivedDrafts(raw ? JSON.parse(raw) : []);
    } catch { setArchivedDrafts([]); }
  }

  function archiveDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      const entry: ArchivedDraft = {
        id:         `draft-${Date.now()}`,
        name:       data.form?.name?.trim() || "Untitled",
        step:       data.step ?? 0,
        maxStep:    data.maxStep ?? data.step ?? 0,
        stepLabel:  STEP_LABELS[data.step ?? 0] ?? `Step ${(data.step ?? 0) + 1}`,
        savedAt:    data.savedAt ?? new Date().toISOString(),
        archivedAt: new Date().toISOString(),
        form:       data.form ?? {},   // full form snapshot for restore
      };
      const existing = JSON.parse(localStorage.getItem(ARCHIVED_DRAFTS_KEY) ?? "[]");
      localStorage.setItem(ARCHIVED_DRAFTS_KEY, JSON.stringify([entry, ...existing]));
      localStorage.removeItem(DRAFT_KEY);
      setArchivedDrafts(prev => [entry, ...prev]);
    } catch { /* */ }
  }

  function restoreArchivedDraft(d: ArchivedDraft) {
    try {
      // Write back to active draft slot
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        form:    d.form,
        step:    d.step,
        maxStep: d.maxStep,
        savedAt: d.savedAt,
      }));
      // Remove from archived list
      const next = archivedDrafts.filter(x => x.id !== d.id);
      localStorage.setItem(ARCHIVED_DRAFTS_KEY, JSON.stringify(next));
      setArchivedDrafts(next);
    } catch { /* */ }
    router.push("/dashboard/campaigns/new");
  }

  async function fetchCampaigns() {
    const res = await fetch("/api/sync");
    if (res.ok) { const j = await res.json(); setCampaigns(j.campaigns ?? []); }
    setLoading(false);
  }
  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "daily" }) });
      if (!res.ok) { const j = await res.json().catch(() => ({})); setToast({ msg: j.error ?? "Sync failed", ok: false }); setTimeout(() => setToast(null), 3000); }
    } catch { setToast({ msg: "Network error", ok: false }); setTimeout(() => setToast(null), 3000); }
    await fetchCampaigns();
    setSyncing(false);
  }
  async function handleBackfill() {
    setBackfilling(true);
    try {
      const res = await fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "backfill" }) });
      if (!res.ok) { const j = await res.json().catch(() => ({})); setToast({ msg: j.error ?? "Backfill failed", ok: false }); setTimeout(() => setToast(null), 3000); }
    } catch { setToast({ msg: "Network error", ok: false }); setTimeout(() => setToast(null), 3000); }
    await fetchCampaigns();
    setBackfilling(false);
  }
  async function doAction(id: string, action: "pause" | "resume" | "kill" | "archive" | "scale", multiplier?: number) {
    setActing(id + action);
    try {
      const res  = await fetch(`/api/campaigns/${id}/action`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(multiplier !== undefined ? { multiplier } : {}) }),
      });
      const json = await res.json();
      if (json.ok) {
        setCampaigns(p => p.map(c => c.id === id ? { ...c, status: json.status } : c));
        setToast({
          msg: action === "kill"    ? "Campaign stopped (permanent pause)" :
               action === "pause"   ? "Paused"                          :
               action === "archive" ? "Archived"                        :
               action === "scale"   ? "Budget +25% applied"             :
               "Resumed",
          ok: true,
        });
      } else {
        setToast({ msg: json.error ?? "Erreur", ok: false });
      }
    } catch { setToast({ msg: "Network error", ok: false }); }
    setActing(null);
    setTimeout(() => setToast(null), 3000);
  }

  // ── Engine control: exclude / pause automation ───────────────────────────────
  async function toggleExclude(id: string) {
    const isNowExcluded = !excludedIds.has(id);
    setExcludedIds(prev => {
      const next = new Set(prev);
      isNowExcluded ? next.add(id) : next.delete(id);
      return next;
    });
    try {
      await fetch(`/api/campaigns/${id}/engine-control`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: isNowExcluded ? "exclude" : "include" }),
      });
    } catch { /* optimistic — revert on error */ }
  }

  async function restoreWithAutoPause(id: string) {
    // Resume + pause automation on this campaign
    await doAction(id, "resume");
    setPausedAutoIds(prev => new Set([...prev, id]));
    try {
      await fetch(`/api/campaigns/${id}/engine-control`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "pause-automation" }),
      });
    } catch { /* silent */ }
    setToast({ msg: "Restored · automation paused on this campaign", ok: true });
    setTimeout(() => setToast(null), 4000);
  }

  /** Intercept "New campaign" — show choice modal if a creation draft exists in localStorage */
  function handleNewCampaign() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.form && (data.form.name?.trim().length > 0 || (data.step ?? 0) > 0)) {
          setDraftInfo({
            name:      data.form.name?.trim() || "Untitled",
            step:      data.step ?? 0,
            stepLabel: STEP_LABELS[data.step ?? 0] ?? `Step ${(data.step ?? 0) + 1}`,
            savedAt:   data.savedAt ?? new Date().toISOString(),
          });
          return;
        }
      }
    } catch { /* localStorage inaccessible */ }
    router.push("/dashboard/campaigns/new");
  }

  useEffect(() => {
    fetchCampaigns();
    loadArchivedDrafts();
    // Load real engine thresholds from the user's saved DecisionRule
    fetch("/api/rules")
      .then(r => r.json())
      .then((d: { killRoi?: number; watchLow?: number; scaleRoi?: number }) => {
        if (typeof d.killRoi === "number" && typeof d.watchLow === "number" && typeof d.scaleRoi === "number") {
          setEngineRules({ killRoi: d.killRoi, watchLow: d.watchLow, scaleRoi: d.scaleRoi });
        }
      })
      .catch(() => { /* keep defaults */ });
  }, []);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const withEngine = campaigns.map(c => ({ ...c, engineState: getEngineState(c, engineRules) }));

  const opCounts = {
    total:        campaigns.filter(c => c.status !== "ARCHIVED").length,
    SCALING:      withEngine.filter(c => c.engineState === "SCALING").length,
    WATCHING:     withEngine.filter(c => c.engineState === "WATCHING" || c.engineState === "MONITORED").length,
    NEEDS_ACTION: withEngine.filter(c => c.engineState === "NEEDS_ACTION").length,
    PAUSED:       withEngine.filter(c => c.engineState === "PAUSED").length,
    KILLED:       withEngine.filter(c => c.engineState === "KILLED").length,
    ARCHIVED:     campaigns.filter(c => c.status === "ARCHIVED").length,
  };

  const byNetwork = networkFilter ? withEngine.filter(c => c.network === networkFilter) : withEngine;

  const filtered = byNetwork.filter(c => {
    if (opFilter === "ALL")          return c.status !== "ARCHIVED";
    if (opFilter === "ACTIVE")       return c.status === "ACTIVE";
    if (opFilter === "SCALING")      return c.engineState === "SCALING";
    if (opFilter === "NEEDS_ACTION") return c.engineState === "NEEDS_ACTION";
    if (opFilter === "PAUSED")       return c.status === "PAUSED";
    if (opFilter === "KILLED")       return c.status === "KILLED";
    if (opFilter === "ARCHIVED")     return c.status === "ARCHIVED";
    return true;
  });

  const filterCounts: Record<OpFilter, number> = {
    ALL:          byNetwork.filter(c => c.status !== "ARCHIVED").length,
    ACTIVE:       byNetwork.filter(c => c.status === "ACTIVE").length,
    SCALING:      byNetwork.filter(c => c.engineState === "SCALING").length,
    NEEDS_ACTION: byNetwork.filter(c => c.engineState === "NEEDS_ACTION").length,
    PAUSED:       byNetwork.filter(c => c.status === "PAUSED").length,
    KILLED:       byNetwork.filter(c => c.status === "KILLED").length,
    ARCHIVED:     byNetwork.filter(c => c.status === "ARCHIVED").length + archivedDrafts.length,
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: "20px 28px 60px" }}>

      {/* ── Outer card ──────────────────────────────────────────────────────── */}
      <motion.div
        {...si(0)}
        style={{
          borderRadius: 28,
          border: "1px solid rgba(255,255,255,0.06)",
          background: "linear-gradient(180deg, rgba(10,11,17,0.96), rgba(8,9,14,0.99))",
          overflow: "hidden",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.02), 0 40px 120px rgba(0,0,0,0.45)",
        }}
      >

        {/* ── Top status bar ──────────────────────────────────────────────── */}
        <div style={{
          height: 68,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 28px",
          background: "radial-gradient(circle at 30% 0%, rgba(99,102,241,0.08), transparent 35%)",
          flexShrink: 0,
        }}>
          {/* Left: live counters */}
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <motion.span
                animate={{ opacity: [1, 0.25, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{
                  width: 6, height: 6, borderRadius: "50%", background: C_GREEN,
                  display: "inline-block", flexShrink: 0, boxShadow: "0 0 8px rgba(74,222,128,0.7)",
                }}
              />
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: C_GREEN }}>
                Live
              </span>
            </div>
            <span style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.18em", color: C_WHITE(0.28) }}>
              {opCounts.total} campaign{opCounts.total !== 1 ? "s" : ""}
            </span>
            {opCounts.NEEDS_ACTION > 0 && (
              <span style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.18em", color: C_RED }}>
                {opCounts.NEEDS_ACTION} needs action
              </span>
            )}
            {opCounts.SCALING > 0 && (
              <span style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.18em", color: C_GREEN }}>
                {opCounts.SCALING} scaling
              </span>
            )}
          </div>

          {/* Right: action buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <motion.button
              onClick={handleSync} disabled={syncing || backfilling}
              whileTap={!syncing ? { scale: 0.96 } : {}}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: 14, fontSize: 12, fontWeight: 400,
                border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)",
                color: C_WHITE(0.65), cursor: (syncing || backfilling) ? "not-allowed" : "pointer",
                opacity: (syncing || backfilling) ? 0.6 : 1, transition: "opacity 0.15s",
              }}
            >
              <motion.div
                animate={syncing ? { rotate: 360 } : {}}
                transition={syncing ? { repeat: Infinity, duration: 0.8, ease: "linear" } : {}}
              >
                <IconRefresh size={10} strokeWidth={1.3} />
              </motion.div>
              {syncing ? "Sync…" : "Sync now"}
            </motion.button>

            <motion.button
              onClick={handleBackfill} disabled={syncing || backfilling}
              whileTap={!backfilling ? { scale: 0.96 } : {}}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: 14, fontSize: 12, fontWeight: 400,
                border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.025)",
                color: C_WHITE(0.45), cursor: (syncing || backfilling) ? "not-allowed" : "pointer",
                opacity: (syncing || backfilling) ? 0.6 : 1, transition: "opacity 0.15s",
              }}
            >
              <motion.div
                animate={backfilling ? { rotate: 360 } : {}}
                transition={backfilling ? { repeat: Infinity, duration: 0.8, ease: "linear" } : {}}
              >
                <IconRefresh size={10} strokeWidth={1.3} />
              </motion.div>
              {backfilling ? "Import…" : "Last 90 days"}
            </motion.button>

            <motion.button
              onClick={handleNewCampaign}
              whileTap={{ scale: 0.97 }}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "9px 18px", borderRadius: 14, fontSize: 12, fontWeight: 600,
                background: "linear-gradient(90deg, #ec4899, #8b5cf6, #6366f1)",
                boxShadow: "0 6px 24px rgba(139,92,246,0.35)",
                color: "#fff", border: "none", cursor: "pointer",
              }}
            >
              Launch new campaign
              <IconArrowRight size={11} strokeWidth={2} />
            </motion.button>
          </div>
        </div>

        {/* ── Page content ────────────────────────────────────────────────── */}
        <div style={{ padding: "32px 28px 44px", display: "flex", flexDirection: "column", gap: 24 }}>

          {/* ── Header ──────────────────────────────────────────────────────── */}
          <motion.div {...si(1)}>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.24em", color: C_WHITE(0.25), margin: "0 0 10px" }}>
              Execution
            </p>
            <h1 style={{ fontSize: 44, fontWeight: 300, letterSpacing: "-0.05em", lineHeight: 0.96, color: "#fff", margin: "0 0 14px" }}>
              Campaign Operations
            </h1>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: C_WHITE(0.44), maxWidth: 640, margin: 0 }}>
              The engine monitors and acts. Here, you inspect campaign states, filter by what matters, launch new ones, and override when needed.
            </p>
          </motion.div>

          {/* ── Two-column: Launch + Engine state ───────────────────────────── */}
          <motion.div {...si(2)} style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 16 }}>

            {/* Launch block */}
            <motion.div
              onClick={handleNewCampaign}
              whileHover="hover"
              style={{ cursor: "pointer", borderRadius: 28 }}
            >
              <motion.div
                variants={{ hover: { borderColor: "rgba(244,114,182,0.3)" } }}
                style={{
                  borderRadius: 28, overflow: "hidden", position: "relative",
                  border: "1px solid rgba(244,114,182,0.16)",
                  background: "linear-gradient(180deg, rgba(18,19,28,0.98), rgba(13,14,21,0.98))",
                  padding: "28px 28px 26px",
                  transition: "border-color 0.22s",
                }}
              >
                {/* Blobs */}
                <div style={{
                  position: "absolute", inset: 0, pointerEvents: "none",
                  background: [
                    "radial-gradient(circle at 16% 38%, rgba(236,72,153,0.14), transparent 26%)",
                    "radial-gradient(circle at 72% 45%, rgba(99,102,241,0.12), transparent 24%)",
                  ].join(", "),
                }} />
                {/* Top hairline */}
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, height: 1, pointerEvents: "none",
                  background: "linear-gradient(90deg, transparent, rgba(244,114,182,0.5), rgba(167,139,250,0.35), transparent)",
                }} />

                <div style={{ position: "relative" }}>
                  {/* Eyebrow */}
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 20,
                    padding: "5px 12px 5px 10px", borderRadius: 99,
                    background: "rgba(236,72,153,0.08)", border: "1px solid rgba(244,114,182,0.18)",
                  }}>
                    <motion.span
                      animate={{ opacity: [1, 0.25, 1] }}
                      transition={{ duration: 2.2, repeat: Infinity }}
                      style={{
                        width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                        background: "#f472b6", boxShadow: "0 0 10px rgba(244,114,182,0.85)",
                        display: "inline-block",
                      }}
                    />
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(240,171,252,0.9)" }}>
                      Launch flow · engine active from day one
                    </span>
                  </div>

                  {/* Headline + CTA */}
                  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
                    <div>
                      <h2 style={{ fontSize: 30, fontWeight: 300, letterSpacing: "-0.04em", lineHeight: 1.05, margin: "0 0 12px", maxWidth: 400 }}>
                        Launch in minutes.{" "}
                        <span style={{
                          background: "linear-gradient(90deg, #f0abfc, #c4b5fd, #a5b4fc)",
                          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                        } as React.CSSProperties}>
                          ProfitDash watches the rest.
                        </span>
                      </h2>
                      <p style={{ fontSize: 13, lineHeight: 1.7, color: C_WHITE(0.40), margin: 0, maxWidth: 400 }}>
                        Set the network, format, and budget here. Once live, the Decision Engine starts monitoring performance immediately and keeps your next move obvious.
                      </p>
                    </div>
                    <motion.div
                      variants={{ hover: { x: 2, boxShadow: "0 14px 40px rgba(139,92,246,0.52), 0 0 28px rgba(236,72,153,0.22)" } }}
                      transition={{ duration: 0.2 }}
                      style={{
                        flexShrink: 0,
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "13px 22px", borderRadius: 18,
                        background: "linear-gradient(90deg, #ec4899, #8b5cf6, #6366f1)",
                        boxShadow: "0 8px 28px rgba(139,92,246,0.36), 0 0 20px rgba(236,72,153,0.14)",
                        color: "#fff", fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Start new campaign
                      <IconArrowRight size={13} strokeWidth={2} />
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            </motion.div>

            {/* Decision Engine state card */}
            <div style={{
              borderRadius: 28,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "linear-gradient(180deg, rgba(17,18,25,0.98), rgba(12,13,19,0.98))",
              padding: "22px 22px",
            }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: 18,
                fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.22em", color: C_WHITE(0.28),
              }}>
                <span>Decision Engine</span>
                <span>{opCounts.total} campaign{opCounts.total !== 1 ? "s" : ""}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {([
                  ["SCALING",      opCounts.SCALING,      "74,222,128",  ENGINE_CFG.SCALING.color,      "Scaling"      ],
                  ["WATCHING",     opCounts.WATCHING,     "251,191,36",  ENGINE_CFG.WATCHING.color,     "Watching"     ],
                  ["NEEDS_ACTION", opCounts.NEEDS_ACTION, "248,113,113", ENGINE_CFG.NEEDS_ACTION.color, "Needs Action" ],
                  ["PAUSED",       opCounts.PAUSED,       "255,255,255", ENGINE_CFG.PAUSED.color,       "Paused"       ],
                ] as [string, number, string, string, string][]).map(([id, count, rgb, color, label]) => {
                  const dim          = count === 0;
                  const filterTarget = id === "WATCHING" ? "ACTIVE" : id as OpFilter;
                  return (
                    <div
                      key={id}
                      onClick={() => setOpFilter(filterTarget)}
                      style={{
                        borderRadius: 16, cursor: "pointer", padding: "14px 16px",
                        border: `1px solid rgba(${dim ? "255,255,255" : rgb},${dim ? "0.06" : "0.14"})`,
                        background: `rgba(${dim ? "255,255,255" : rgb},${dim ? "0.02" : "0.07"})`,
                        transition: "all 0.15s",
                      }}
                    >
                      <div style={{
                        fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em",
                        color: dim ? C_WHITE(0.2) : color, marginBottom: 10, opacity: dim ? 0.5 : 0.85,
                      }}>
                        {label}
                      </div>
                      <div style={{
                        fontSize: 34, fontWeight: 300, letterSpacing: "-0.04em", lineHeight: 1,
                        color: dim ? C_WHITE(0.15) : color, fontVariantNumeric: "tabular-nums",
                      }}>
                        {dim ? "—" : count}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>

          {/* ── Campaign list ────────────────────────────────────────────────── */}
          <motion.div
            {...si(3)}
            style={{
              borderRadius: 24,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "linear-gradient(180deg, rgba(16,17,24,0.98), rgba(11,12,18,0.98))",
              overflow: "hidden",
            }}
          >
            {/* Filter bar */}
            <div style={{
              padding: "14px 22px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                {OP_FILTERS.map(({ id, label }) => {
                  const active = opFilter === id;
                  const count  = filterCounts[id];
                  return (
                    <button key={id} onClick={() => setOpFilter(id)} style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "6px 13px", borderRadius: 99, fontSize: 12,
                      fontWeight: active ? 600 : 400,
                      background: active ? "#fff" : "rgba(255,255,255,0.03)",
                      color:      active ? "#0b0d12" : C_WHITE(0.48),
                      border:     active ? "none"    : "1px solid rgba(255,255,255,0.08)",
                      cursor: "pointer", transition: "all 0.14s",
                    }}>
                      {label} <span style={{ opacity: 0.55, fontSize: 11 }}>{count}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                {networkFilter && (
                  <button onClick={() => setNetworkFilter(null)} style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "5px 9px", borderRadius: 9, fontSize: 10,
                    background: C_WHITE(0.04), border: `1px solid ${C_WHITE(0.08)}`,
                    color: C_WHITE(0.35), cursor: "pointer",
                  }}>
                    <IconX size={9} strokeWidth={1.4} /> Clear
                  </button>
                )}
                {NET_KEYS.map(key => {
                  const cfg    = NET_CFG[key];
                  const active = networkFilter === key;
                  return (
                    <button key={key} onClick={() => setNetworkFilter(active ? null : key)} style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "6px 12px", borderRadius: 99, fontSize: 12,
                      background: active ? `rgba(${cfg.rgb},0.1)` : "rgba(255,255,255,0.03)",
                      border:     active ? `1px solid rgba(${cfg.rgb},0.25)` : "1px solid rgba(255,255,255,0.08)",
                      color:  active ? cfg.color : C_WHITE(0.48),
                      cursor: "pointer", transition: "all 0.14s",
                    }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={faviconUrl(cfg.domain)} alt="" width={11} height={11}
                        style={{ borderRadius: 2, opacity: active ? 0.9 : 0.5, display: "block" }} />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Column headers */}
            {!loading && filtered.length > 0 && (
              <div style={{
                display: "grid",
                gridTemplateColumns: "1.7fr 0.7fr 0.65fr 1fr 0.5fr 0.65fr",
                gap: 14, padding: "10px 22px",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
              }}>
                {["Campaign", "Network", "State", "Spend / Revenue", "ROI", "Actions"].map((h, i) => (
                  <span key={h} style={{ ...COL_LABEL, textAlign: i >= 4 ? "right" : "left" }}>{h}</span>
                ))}
              </div>
            )}

            {/* Rows */}
            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "64px 0" }}>
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}>
                  <IconRefresh size={15} strokeWidth={1.3} style={{ color: C_WHITE(0.18) }} />
                </motion.div>
              </div>

            ) : filtered.length === 0 ? (
              <div style={{ padding: "52px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 14,
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <IconMinus size={16} strokeWidth={1.3} style={{ color: C_WHITE(0.22) }} />
                </div>
                {opFilter === "ALL" ? (
                  <>
                    <div>
                      <p style={{ fontSize: 14, color: C_WHITE(0.60), margin: "0 0 6px", fontWeight: 300, letterSpacing: "-0.02em" }}>
                        No campaigns yet
                      </p>
                      <p style={{ fontSize: 12, color: C_WHITE(0.28), margin: 0, lineHeight: 1.6, maxWidth: "28ch" }}>
                        Connect a network first, then create your first campaign to get started.
                      </p>
                    </div>
                    <a href="/dashboard/campaigns/new" style={{ textDecoration: "none" }}>
                      <button style={{
                        marginTop: 4, padding: "8px 20px", borderRadius: 12, border: "none",
                        background: "linear-gradient(90deg,#8b5cf6,#6366f1)", color: "#fff",
                        fontSize: 12, fontWeight: 600, cursor: "pointer",
                        boxShadow: "0 8px 24px rgba(99,102,241,0.25)",
                      }}>
                        Create campaign →
                      </button>
                    </a>
                  </>
                ) : (
                  <p style={{ fontSize: 13, color: C_WHITE(0.30), margin: 0 }}>
                    No campaigns in this state.
                  </p>
                )}
              </div>

            ) : (
              <AnimatePresence mode="popLayout">
                {filtered.map((c, i) => {
                  const roi       = c.spend > 0 ? ((c.revenue - c.spend) / c.spend) * 100 : 0;
                  const engine    = c.engineState;
                  const engCfg    = ENGINE_CFG[engine];
                  const netCfg    = NET_CFG[c.network] ?? { label: c.network, domain: "", color: C_WHITE(0.5), rgb: "255,255,255" };
                  const isPend    = acting?.startsWith(c.id);
                  const roiColor  = roi === 0 ? C_WHITE(0.18) : roi > 0 ? C_GREEN : (engine === "WATCHING" || engine === "MONITORED") ? "#fbbf24" : C_RED;
                  const barMax    = Math.max(c.spend, c.revenue, 1);
                  const isLast    = i === filtered.length - 1;
                  const needsAttn = engine === "NEEDS_ACTION";

                  const isExcluded   = excludedIds.has(c.id);
                  const isAutoPaused = pausedAutoIds.has(c.id);

                  return (
                    <motion.div
                      key={c.id}
                      layout
                      initial={{ opacity: 0, x: -8, filter: "blur(2px)" }}
                      animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ duration: 0.35, delay: i * 0.04, ease: EASE }}
                      onClick={() => router.push(`/dashboard/campaigns/${c.id}`)}
                      whileHover={{ background: needsAttn ? "rgba(248,113,113,0.045)" : "rgba(255,255,255,0.024)" }}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.7fr 0.7fr 0.65fr 1fr 0.5fr 0.65fr",
                        gap: 14, alignItems: "center",
                        padding: "18px 22px",
                        borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.05)",
                        cursor: "pointer",
                        background: isExcluded
                          ? "rgba(139,92,246,0.02)"
                          : needsAttn ? "rgba(248,113,113,0.025)" : "transparent",
                        transition: "background 0.15s",
                      }}
                    >
                      {/* Name */}
                      <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                        {needsAttn ? (
                          <motion.span
                            animate={{ opacity: [1, 0.15, 1] }}
                            transition={{ duration: 1.6, repeat: Infinity }}
                            style={{
                              width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                              background: engCfg.color, boxShadow: `0 0 8px rgba(${engCfg.rgb},0.8)`,
                            }}
                          />
                        ) : (
                          <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: engCfg.color }} />
                        )}
                        <span style={{
                          fontSize: 19, fontWeight: 300, letterSpacing: "-0.03em",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          color: C_WHITE(0.88),
                        }}>
                          {c.name}
                        </span>
                      </div>

                      {/* Network */}
                      <div>
                        <span style={{
                          borderRadius: 99, fontSize: 12,
                          border: "1px solid rgba(255,255,255,0.1)",
                          background: "rgba(255,255,255,0.03)",
                          padding: "4px 12px", color: C_WHITE(0.68),
                        }}>
                          {netCfg.label}
                        </span>
                      </div>

                      {/* State + engine badges */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{
                          borderRadius: 99, fontSize: 11, fontWeight: 500,
                          border: `1px solid rgba(${engCfg.rgb},0.18)`,
                          background: `rgba(${engCfg.rgb},0.08)`,
                          padding: "4px 12px", color: engCfg.color,
                          display: "inline-flex", alignItems: "center",
                        }}>
                          {engCfg.label}
                        </span>
                        {isExcluded && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, letterSpacing: "0.16em",
                            textTransform: "uppercase", color: "rgba(196,181,253,0.60)",
                            paddingLeft: 2,
                          }}>
                            Manual only
                          </span>
                        )}
                        {isAutoPaused && !isExcluded && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, letterSpacing: "0.16em",
                            textTransform: "uppercase", color: "rgba(253,230,138,0.60)",
                            paddingLeft: 2,
                          }}>
                            Auto paused
                          </span>
                        )}
                      </div>

                      {/* Spend / Revenue */}
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7, fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                          <span style={{ color: C_WHITE(0.45) }}>{c.spend > 0 ? `$${c.spend.toFixed(0)}` : "—"}</span>
                          <span style={{ color: C_WHITE(0.72) }}>{c.revenue > 0 ? `$${c.revenue.toFixed(0)}` : "—"}</span>
                        </div>
                        <div style={{ position: "relative", height: 3, borderRadius: 99, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                          <div style={{ height: "100%", borderRadius: 99, width: `${(c.spend / barMax) * 100}%`, background: "rgba(255,255,255,0.22)" }} />
                          <div style={{ position: "absolute", top: 0, left: 0, height: "100%", borderRadius: 99, width: `${(c.revenue / barMax) * 100}%`, background: "rgba(255,255,255,0.6)" }} />
                        </div>
                      </div>

                      {/* ROI */}
                      <div style={{ textAlign: "right" }}>
                        <span style={{
                          fontSize: 26, fontWeight: 300, letterSpacing: "-0.04em",
                          color: roiColor, fontVariantNumeric: "tabular-nums",
                        }}>
                          {roi === 0 ? "—" : `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%`}
                        </span>
                      </div>

                      {/* Actions — including recovery flows */}
                      <div
                        onClick={e => e.stopPropagation()}
                        style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4, flexWrap: "wrap" }}
                      >
                        {/* ACTIVE: Inspect (Watch zone) */}
                        {c.status === "ACTIVE" && (engine === "WATCHING" || engine === "MONITORED") && (
                          <ActionBtn
                            onClick={() => router.push(`/dashboard/campaigns/${c.id}`)}
                            disabled={false} label="Inspect"
                            color={C_WHITE(0.58)} bg="rgba(255,255,255,0.04)" border="rgba(255,255,255,0.1)"
                          />
                        )}
                        {/* ACTIVE: Scale */}
                        {c.status === "ACTIVE" && (
                          <ActionBtn
                            onClick={() => doAction(c.id, "scale", 1.25)}
                            disabled={!!isPend} label="Scale"
                            color="#a78bfa" bg="rgba(167,139,250,0.07)" border="rgba(167,139,250,0.18)"
                          />
                        )}
                        {/* ACTIVE: Pause */}
                        {c.status === "ACTIVE" && (
                          <ActionBtn
                            onClick={() => doAction(c.id, "pause")}
                            disabled={!!isPend} label="Pause"
                            color={C_WHITE(0.58)} bg="rgba(255,255,255,0.04)" border="rgba(255,255,255,0.1)"
                          />
                        )}
                        {/* ACTIVE: Exclude from engine toggle (Bloc 4) */}
                        {c.status === "ACTIVE" && (
                          <ActionBtn
                            onClick={() => toggleExclude(c.id)}
                            disabled={!!isPend}
                            label={isExcluded ? "Include" : "Exclude"}
                            color={isExcluded ? "rgba(196,181,253,0.80)" : C_WHITE(0.38)}
                            bg={isExcluded ? "rgba(139,92,246,0.09)" : "rgba(255,255,255,0.03)"}
                            border={isExcluded ? "rgba(139,92,246,0.28)" : "rgba(255,255,255,0.08)"}
                          />
                        )}
                        {/* PAUSED: Resume */}
                        {c.status === "PAUSED" && (
                          <ActionBtn
                            onClick={() => doAction(c.id, "resume")}
                            disabled={!!isPend} label="Resume"
                            color={C_GREEN} bg="rgba(74,222,128,0.07)" border="rgba(74,222,128,0.18)"
                          />
                        )}
                        {/* KILLED: Restore (Bloc 4) */}
                        {c.status === "KILLED" && (
                          <>
                            <ActionBtn
                              onClick={() => doAction(c.id, "resume")}
                              disabled={!!isPend} label="Restore"
                              color={C_GREEN} bg="rgba(74,222,128,0.07)" border="rgba(74,222,128,0.18)"
                            />
                            <ActionBtn
                              onClick={() => restoreWithAutoPause(c.id)}
                              disabled={!!isPend} label="Restore+Lock"
                              color="rgba(253,230,138,0.80)" bg="rgba(245,158,11,0.05)" border="rgba(251,191,36,0.20)"
                            />
                          </>
                        )}
                        {/* Kill (not for KILLED) */}
                        {c.status !== "KILLED" && (
                          <ActionBtn
                            onClick={() => doAction(c.id, "kill")}
                            disabled={!!isPend} label="Kill"
                            color={C_RED} bg="rgba(248,113,113,0.07)" border="rgba(248,113,113,0.18)"
                          />
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          {/* ── Archived drafts (shown only in ARCHIVED filter) ──────────────── */}
          {opFilter === "ARCHIVED" && archivedDrafts.length > 0 && (
            <div style={{ borderTop: filtered.length > 0 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
              {/* Section label */}
              <div style={{ padding: "14px 22px 8px", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.22em", color: C_WHITE(0.22) }}>
                  Archived drafts
                </span>
                <span style={{ fontSize: 9, fontWeight: 600, color: C_WHITE(0.18) }}>
                  {archivedDrafts.length}
                </span>
              </div>
              {archivedDrafts.map((d, i) => {
                const archivedDate = new Date(d.archivedAt);
                const diffMs       = Date.now() - archivedDate.getTime();
                const diffDays     = Math.floor(diffMs / 86400000);
                const diffHours    = Math.floor(diffMs / 3600000);
                const timeLabel    = diffDays > 0 ? `${diffDays}j ago` : diffHours > 0 ? `${diffHours}h ago` : "just now";
                return (
                  <motion.div
                    key={d.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.7fr 0.7fr 0.65fr 1fr 0.5fr 0.65fr",
                      gap: 14, padding: "14px 22px",
                      borderBottom: i < archivedDrafts.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                      alignItems: "center",
                    }}
                  >
                    {/* Name */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 400, color: C_WHITE(0.55), letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {d.name}
                        </span>
                        <span style={{ fontSize: 10, color: C_WHITE(0.24) }}>
                          {d.stepLabel} — step {d.step + 1}/8 · archived {timeLabel}
                        </span>
                      </div>
                    </div>
                    {/* Draft badge */}
                    <div>
                      <span style={{
                        display: "inline-flex", padding: "3px 8px", borderRadius: 6, fontSize: 9, fontWeight: 600,
                        textTransform: "uppercase", letterSpacing: "0.14em",
                        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                        color: C_WHITE(0.35),
                      }}>
                        Draft
                      </span>
                    </div>
                    {/* State */}
                    <span style={{ fontSize: 11, color: C_WHITE(0.28) }}>Archived</span>
                    {/* Spend / Revenue — empty */}
                    <span style={{ fontSize: 12, color: C_WHITE(0.2) }}>—</span>
                    {/* ROI — empty */}
                    <span style={{ fontSize: 12, color: C_WHITE(0.2), textAlign: "right" }}>—</span>
                    {/* Actions: Resume + Delete */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                      <button
                        onClick={() => restoreArchivedDraft(d)}
                        style={{
                          fontSize: 10, padding: "4px 10px", borderRadius: 8,
                          border: "1px solid rgba(52,211,153,0.18)", background: "rgba(16,185,129,0.06)",
                          color: "rgba(52,211,153,0.8)", cursor: "pointer", fontFamily: "inherit",
                        }}
                      >
                        Resume
                      </button>
                      <button
                        onClick={() => {
                          const next = archivedDrafts.filter(x => x.id !== d.id);
                          localStorage.setItem(ARCHIVED_DRAFTS_KEY, JSON.stringify(next));
                          setArchivedDrafts(next);
                        }}
                        style={{
                          fontSize: 10, padding: "4px 10px", borderRadius: 8,
                          border: "1px solid rgba(248,113,113,0.15)", background: "rgba(248,113,113,0.05)",
                          color: "rgba(248,113,113,0.6)", cursor: "pointer", fontFamily: "inherit",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          </motion.div>
        </div>
      </motion.div>

      {/* ── Toast ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            style={{
              position: "fixed", bottom: 24, right: 24, zIndex: 200,
              padding: "10px 18px", borderRadius: 12, fontSize: 12, fontWeight: 500,
              background: toast.ok ? "rgba(74,222,128,0.07)" : "rgba(248,113,113,0.07)",
              color:  toast.ok ? C_GREEN : C_RED,
              border: toast.ok ? "1px solid rgba(74,222,128,0.15)" : "1px solid rgba(248,113,113,0.15)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
            }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Resume Campaign Modal ────────────────────────────────────────── */}
      {draftInfo && (
        <ResumeCampaignModal
          draft={draftInfo}
          onClose={() => setDraftInfo(null)}
          onResume={() => {
            // Draft stays in localStorage — wizard will auto-restore it
            setDraftInfo(null);
            router.push("/dashboard/campaigns/new");
          }}
          onNew={() => {
            // Clear the draft, start fresh
            try { localStorage.removeItem(DRAFT_KEY); } catch { /* */ }
            setDraftInfo(null);
            router.push("/dashboard/campaigns/new");
          }}
          onArchive={() => {
            archiveDraft();
            setDraftInfo(null);
            setOpFilter("ARCHIVED"); // switch to archived tab so user sees it
          }}
        />
      )}

    </div>
  );
}

// ─── ActionBtn ────────────────────────────────────────────────────────────────

function ActionBtn({ onClick, disabled, label, color, bg, border }: {
  onClick: () => void; disabled: boolean; label: string;
  color: string; bg: string; border: string;
}) {
  // suppress unused import warnings
  void IconPause; void IconPlay;
  return (
    <motion.button
      onClick={onClick} disabled={disabled}
      whileHover={{ y: -1 }} whileTap={{ scale: 0.88 }}
      style={{
        padding: "6px 12px", borderRadius: 9, flexShrink: 0,
        background: bg, border: `1px solid ${border}`,
        color, fontSize: 11, fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.3 : 1, transition: "opacity 0.12s",
      }}
    >
      {label}
    </motion.button>
  );
}
