"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, ChevronLeft, ChevronRight, AlertCircle, X, ChevronDown } from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ConvRow {
  id:           string;
  campaignId:   string | null;
  campaignName: string | null;
  clickId:      string | null;
  revenue:      number;
  currency:     string;
  source:       string | null;
  createdAt:    string;
}
interface SourceRow { source: string; revenue: number; count: number; }
interface ConvData {
  totalRevenue: number; totalCount: number;
  page: number; limit: number;
  rows: ConvRow[]; bySource: SourceRow[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtMoney(n: number, cur = "EUR") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: cur, maximumFractionDigits: 2 }).format(n);
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function iso30dAgo() { return new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10); }
function isoToday()  { return new Date().toISOString().slice(0, 10); }

function sourceTone(src: string | null): { border: string; bg: string; text: string; bar: string } {
  const s = (src ?? "").toLowerCase();
  if (s.includes("crak"))    return { border: "rgba(252,211,77,0.16)",  bg: "rgba(245,158,11,0.08)",  text: "rgba(253,230,138,1)", bar: "rgba(252,211,77,0.8)"  };
  if (s.includes("max"))     return { border: "rgba(196,181,253,0.16)", bg: "rgba(139,92,246,0.08)",  text: "rgba(221,214,254,1)", bar: "rgba(196,181,253,0.8)" };
  if (s.includes("click"))   return { border: "rgba(110,231,183,0.16)", bg: "rgba(16,185,129,0.08)",  text: "rgba(167,243,208,1)", bar: "rgba(110,231,183,0.8)" };
  if (s.includes("adcombo")) return { border: "rgba(253,164,175,0.16)", bg: "rgba(244,63,94,0.08)",   text: "rgba(254,205,211,1)", bar: "rgba(253,164,175,0.8)" };
  return                             { border: "rgba(196,181,253,0.16)", bg: "rgba(99,102,241,0.08)",  text: "rgba(199,210,254,1)", bar: "rgba(165,180,252,0.8)" };
}


function inferNetwork(row: ConvRow): string {
  const name = (row.campaignName ?? "").toLowerCase();
  if (name.includes("native")) return "TrafficJunky";
  if (name.includes("push"))   return "TrafficStars";
  return "ExoClick";
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const GHOST: React.CSSProperties = {
  borderRadius: 16, border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.03)", padding: "10px 16px",
  fontSize: 14, color: "rgba(255,255,255,0.70)", cursor: "pointer", whiteSpace: "nowrap",
};
const PRIMARY: React.CSSProperties = {
  borderRadius: 16, border: "none",
  background: "linear-gradient(90deg,#ec4899,#8b5cf6,#6366f1)",
  padding: "10px 20px", fontSize: 14, fontWeight: 600, color: "#fff",
  cursor: "pointer", boxShadow: "0 14px 35px rgba(139,92,246,0.35)", whiteSpace: "nowrap",
};
const BADGE_BASE: React.CSSProperties = {
  display: "inline-flex", borderRadius: 999, padding: "5px 12px",
  fontSize: 10, textTransform: "uppercase", letterSpacing: "0.22em", border: "1px solid",
};

const DROP_MENU: React.CSSProperties = {
  position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 100,
  borderRadius: 16, border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(18,19,28,0.98)", backdropFilter: "blur(20px)",
  boxShadow: "0 20px 60px rgba(0,0,0,0.5)", minWidth: 160, padding: "6px",
  overflow: "hidden",
};
const DROP_ITEM_BASE: React.CSSProperties = {
  display: "block", width: "100%", padding: "9px 14px",
  fontSize: 13, cursor: "pointer", borderRadius: 10, border: "none",
  textAlign: "left", background: "transparent", transition: "background 0.12s",
  fontFamily: "inherit",
};


function SourceBadge({ source }: { source: string | null }) {
  const t = sourceTone(source);
  return (
    <span style={{ ...BADGE_BASE, borderColor: t.border, background: t.bg, color: t.text }}>
      {source ?? "unknown"}
    </span>
  );
}


// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ConversionsPage() {
  const [dateFrom, setDateFrom] = useState(iso30dAgo());
  const [dateTo,   setDateTo]   = useState(isoToday());
  const [page,     setPage]     = useState(0);
  const [data,     setData]     = useState<ConvData | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [isDemo,   setIsDemo]   = useState(false); // true only when profitdash_demo cookie is set

  // ── Filter state ────────────────────────────────────────────────────────────
  const [filterCampaign, setFilterCampaign] = useState("");
  const [filterSource,   setFilterSource]   = useState("All");
  const [searchClickId,  setSearchClickId]  = useState("");
  const [openDrop,       setOpenDrop]       = useState<"source" | null>(null);
  const [campaignSearch, setCampaignSearch] = useState(false);
  const [clickIdSearch,  setClickIdSearch]  = useState(false);

  const sourceDropRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (openDrop === "source" && sourceDropRef.current && !sourceDropRef.current.contains(e.target as Node)) setOpenDrop(null);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [openDrop]);

  // Read demo cookie once on mount
  useEffect(() => {
    setIsDemo(document.cookie.split(";").some(c => c.trim().startsWith("profitdash_demo=1")));
  }, []);

  const load = useCallback(async (df: string, dt: string, p: number) => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/conversions?dateFrom=${df}&dateTo=${dt}&page=${p}&limit=50`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as ConvData;
      setData(json);
    } catch {
      // fetch failed — leave data null, show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(dateFrom, dateTo, page); }, [load, dateFrom, dateTo, page]);

  const totalPages = data ? Math.ceil(data.totalCount / 50) : 0;

  // Derived KPIs — only real data, no fake fallbacks
  const totalCount  = data?.totalCount  ?? 0;
  const totalRev    = data?.totalRevenue ?? 0;
  const srcCount    = data?.bySource?.length ?? 0;
  const avgRevenue  = totalCount > 0 ? totalRev / totalCount : 0;

  const maxRevenue = useMemo(() =>
    (data?.bySource ?? []).reduce((m, s) => Math.max(m, s.revenue), 1),
    [data],
  );

  // Available sources for dropdown
  const availableSources = useMemo(() => {
    const srcs = (data?.bySource ?? []).map(s => s.source);
    return ["All", ...srcs];
  }, [data]);

  // Filtered rows for table display
  const displayRows = useMemo(() => {
    const rows = data?.rows ?? [];
    return rows.filter(row => {
      if (filterCampaign.trim() && !(row.campaignName ?? "").toLowerCase().includes(filterCampaign.toLowerCase())) return false;
      if (filterSource !== "All" && row.source !== filterSource) return false;
      if (searchClickId.trim() && !(row.clickId ?? "").toLowerCase().includes(searchClickId.toLowerCase())) return false;
      return true;
    });
  }, [data, filterCampaign, filterSource, searchClickId]);

  const activeFilters = (filterCampaign ? 1 : 0) + (filterSource !== "All" ? 1 : 0) + (searchClickId ? 1 : 0);

  const clearAllFilters = () => {
    setFilterCampaign("");
    setFilterSource("All");
    setSearchClickId("");
    setCampaignSearch(false);
    setClickIdSearch(false);
  };

  return (
    <div style={{ padding: "24px 24px 80px", minHeight: "calc(100vh - 56px)", background: "#0d0d10" }}>
      <div style={{
        maxWidth: 1540, margin: "0 auto",
        borderRadius: 30, border: "1px solid rgba(255,255,255,0.06)",
        background: "linear-gradient(180deg, rgba(11,12,18,0.98), rgba(8,9,14,0.98))",
        boxShadow: "0 0 0 1px rgba(255,255,255,0.02), 0 35px 120px rgba(0,0,0,0.45)",
        overflow: "hidden",
      }}>

        {/* ── Header ── */}
        <div style={{
          padding: "32px 32px 28px", borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "radial-gradient(circle at 22% 0%, rgba(99,102,241,0.08), transparent 34%)",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 32,
        }}>
          <div>
            <Link href="/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none", color: "rgba(255,255,255,0.38)", fontSize: 12, letterSpacing: "0.04em", marginBottom: 14 }}>
              <ChevronLeft size={14} style={{ marginTop: 1 }} />
              Dashboard
            </Link>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.24em", color: "rgba(134,239,172,0.8)", marginBottom: 12 }}>
              Revenue signal
              {isDemo && <span style={{ marginLeft: 12, color: "rgba(167,139,250,0.8)", letterSpacing: "0.18em" }}>— DEMO</span>}
            </div>
            <h1 style={{ fontSize: 44, lineHeight: 0.96, letterSpacing: "-0.05em", fontWeight: 300, maxWidth: 900, margin: 0 }}>
              Transactions
            </h1>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0, paddingTop: 4 }}>
            {/* Date range */}
            <div style={{ ...GHOST, display: "flex", alignItems: "center", gap: 8, padding: "9px 14px" }}>
              <input
                type="date" value={dateFrom}
                onChange={e => { setPage(0); setDateFrom(e.target.value); }}
                style={{ background: "transparent", border: "none", outline: "none", color: "rgba(255,255,255,0.70)", fontSize: 13, cursor: "pointer", colorScheme: "dark" }}
              />
              <span style={{ color: "rgba(255,255,255,0.28)", fontSize: 13 }}>→</span>
              <input
                type="date" value={dateTo}
                onChange={e => { setPage(0); setDateTo(e.target.value); }}
                style={{ background: "transparent", border: "none", outline: "none", color: "rgba(255,255,255,0.70)", fontSize: 13, cursor: "pointer", colorScheme: "dark" }}
              />
            </div>

            <button style={PRIMARY} onClick={() => load(dateFrom, dateTo, page)}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <RefreshCw size={13} strokeWidth={2} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
                Refresh postbacks
              </span>
            </button>
          </div>
        </div>

        <div style={{ padding: "32px", display: "flex", flexDirection: "column", gap: 28 }}>

          {/* ── KPI Cards ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
            {[
              { label: "Revenue received",      value: fmtMoney(totalRev),         sub: `Tracked across ${srcCount} active source${srcCount !== 1 ? "s" : ""}`,  tone: { border: "rgba(110,231,183,0.16)", bg: "rgba(16,185,129,0.08)", text: "rgba(167,243,208,1)" } },
              { label: "Total conversions",     value: String(totalCount),          sub: "Postback events received this period",                                   tone: { border: "rgba(125,211,252,0.16)", bg: "rgba(14,165,233,0.08)", text: "rgba(186,230,253,1)" } },
              { label: "Avg revenue / conv.",   value: totalCount > 0 ? fmtMoney(avgRevenue) : "—", sub: "Mean payout per postback event",                         tone: { border: "rgba(252,211,77,0.16)",  bg: "rgba(245,158,11,0.08)", text: "rgba(253,230,138,1)" } },
              { label: "Active sources",        value: String(srcCount),            sub: "Affiliate networks sending postbacks",                                   tone: { border: "rgba(196,181,253,0.16)", bg: "rgba(139,92,246,0.08)", text: "rgba(221,214,254,1)" } },
            ].map(({ label, value, sub, tone }, i) => (
              <motion.div key={label}
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: i * 0.07 }}
                style={{ borderRadius: 24, border: "1px solid rgba(255,255,255,0.08)", background: "linear-gradient(180deg, rgba(17,18,25,0.98), rgba(12,13,19,0.98))", padding: 20, boxShadow: "0 12px 30px rgba(0,0,0,0.16)" }}
              >
                <span style={{ ...BADGE_BASE, borderColor: tone.border, background: tone.bg, color: tone.text }}>{label}</span>
                <div style={{ marginTop: 20, fontSize: 38, letterSpacing: "-0.05em", fontWeight: 300, fontVariantNumeric: "tabular-nums" }}>{value}</div>
                <div style={{ marginTop: 8, fontSize: 14, color: "rgba(255,255,255,0.38)", lineHeight: 1.5 }}>{sub}</div>
              </motion.div>
            ))}
          </div>

          {/* ── Mid split ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 24 }}>

            {/* Sources breakdown */}
            <motion.div
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.3 }}
              style={{ borderRadius: 28, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", padding: 24 }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24 }}>
                <div>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(255,255,255,0.24)", marginBottom: 8 }}>Breakdown by affiliate source</div>
                  <div style={{ fontSize: 24, letterSpacing: "-0.04em", fontWeight: 300 }}>Where validated revenue is coming from</div>
                </div>
                <span style={{ ...BADGE_BASE, borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.55)", flexShrink: 0 }}>
                  {(data?.bySource ?? []).length} active sources
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {(data?.bySource ?? []).length === 0 && (
                  <div style={{ padding: "32px 0", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                    <AlertCircle size={20} style={{ color: "rgba(255,255,255,0.15)" }} />
                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.22)", margin: 0, lineHeight: 1.6 }}>
                      {loading ? "Loading…" : "No postback data for this period.\nConfigure your postback URL in Settings to start tracking revenue."}
                    </p>
                  </div>
                )}
                {(data?.bySource ?? []).map((s) => {
                  const t   = sourceTone(s.source);
                  const pct = Math.round((s.revenue / Math.max(maxRevenue, 1)) * 100);
                  const share = totalRev > 0 ? Math.round((s.revenue / totalRev) * 100) : 0;
                  return (
                    <div key={s.source} style={{ borderRadius: 18, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", padding: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ ...BADGE_BASE, borderColor: t.border, background: t.bg, color: t.text }}>{s.source}</span>
                          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.30)" }}>{s.count} conv.</span>
                        </div>
                        <span style={{ fontSize: 14, color: "rgba(255,255,255,0.82)", fontVariantNumeric: "tabular-nums" }}>{fmtMoney(s.revenue)}</span>
                      </div>
                      <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.05)", overflow: "hidden", marginBottom: 8 }}>
                        <motion.div
                          initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                          transition={{ duration: 1.1, ease: "easeOut", delay: 0.3 }}
                          style={{ height: "100%", borderRadius: 999, background: t.bar }}
                        />
                      </div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.28)" }}>{share}% of tracked revenue</div>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* Right column: Revenue summary */}
            <motion.div
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.35 }}
              style={{ borderRadius: 28, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", padding: 24, display: "flex", flexDirection: "column", gap: 20 }}
            >
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(255,255,255,0.24)" }}>Revenue summary</div>

              {totalCount === 0 ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, textAlign: "center", padding: "24px 0" }}>
                  <AlertCircle size={22} style={{ color: "rgba(255,255,255,0.15)" }} />
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.22)", margin: 0, lineHeight: 1.6 }}>
                    No postback data for<br />this period
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {[
                    { label: "Total revenue",      value: fmtMoney(totalRev),       color: "rgba(110,231,183,0.88)" },
                    { label: "Conversions",         value: String(totalCount),       color: "rgba(186,230,253,0.88)" },
                    { label: "Avg per conversion",  value: fmtMoney(avgRevenue),     color: "rgba(253,230,138,0.88)" },
                    { label: "Active sources",      value: String(srcCount),         color: "rgba(221,214,254,0.88)" },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 16px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.38)" }}>{label}</span>
                      <span style={{ fontSize: 16, fontWeight: 300, letterSpacing: "-0.03em", color, fontVariantNumeric: "tabular-nums" }}>{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>

          {/* ── Transaction table ── */}
          <motion.div
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.45 }}
            style={{ borderRadius: 28, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", padding: 24 }}
          >
            {/* Table header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(255,255,255,0.24)", marginBottom: 8 }}>Transaction log</div>
                <div style={{ fontSize: 28, letterSpacing: "-0.04em", fontWeight: 300 }}>
                  {displayRows.length} event{displayRows.length !== 1 ? "s" : ""}
                  {activeFilters > 0 && <span style={{ fontSize: 14, color: "rgba(196,181,253,0.7)", marginLeft: 12 }}>{activeFilters} filter{activeFilters > 1 ? "s" : ""} active</span>}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, paddingTop: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>

                {/* Campaign search */}
                {campaignSearch ? (
                  <div style={{ ...GHOST, display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", minWidth: 180 }}>
                    <input
                      autoFocus
                      value={filterCampaign}
                      onChange={e => setFilterCampaign(e.target.value)}
                      placeholder="Search campaign…"
                      style={{ background: "transparent", border: "none", outline: "none", color: "rgba(255,255,255,0.80)", fontSize: 13, flex: 1, minWidth: 0, fontFamily: "inherit" }}
                      onKeyDown={e => { if (e.key === "Escape") { setFilterCampaign(""); setCampaignSearch(false); } }}
                    />
                    <button
                      onClick={() => { setFilterCampaign(""); setCampaignSearch(false); }}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: "rgba(255,255,255,0.35)" }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <button
                    style={{ ...GHOST, ...(filterCampaign ? { borderColor: "rgba(139,92,246,0.5)", color: "rgba(196,181,253,1)", background: "rgba(139,92,246,0.12)" } : {}) }}
                    onClick={() => setCampaignSearch(true)}
                  >
                    {filterCampaign ? `"${filterCampaign}"` : "Campaign"}
                  </button>
                )}

                {/* Source filter dropdown */}
                <div ref={sourceDropRef} style={{ position: "relative" }}>
                  <button
                    style={{
                      ...GHOST,
                      display: "flex", alignItems: "center", gap: 6,
                      ...(filterSource !== "All" ? { borderColor: "rgba(139,92,246,0.5)", color: "rgba(196,181,253,1)", background: "rgba(139,92,246,0.12)" } : {}),
                    }}
                    onClick={() => setOpenDrop(openDrop === "source" ? null : "source")}
                  >
                    {filterSource === "All" ? "Source" : filterSource}
                    <ChevronDown size={12} style={{ opacity: 0.5, transform: openDrop === "source" ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
                  </button>
                  {openDrop === "source" && (
                    <div style={DROP_MENU}>
                      {availableSources.map(src => (
                        <button
                          key={src}
                          style={{
                            ...DROP_ITEM_BASE,
                            color: filterSource === src ? "rgba(196,181,253,1)" : "rgba(255,255,255,0.62)",
                            background: filterSource === src ? "rgba(139,92,246,0.15)" : "transparent",
                          }}
                          onClick={() => { setFilterSource(src); setOpenDrop(null); setPage(0); }}
                          onMouseEnter={e => { if (filterSource !== src) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
                          onMouseLeave={e => { if (filterSource !== src) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                        >
                          {src}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Click ID search */}
                {clickIdSearch ? (
                  <div style={{ ...GHOST, display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", minWidth: 170 }}>
                    <input
                      autoFocus
                      value={searchClickId}
                      onChange={e => setSearchClickId(e.target.value)}
                      placeholder="Click ID…"
                      style={{ background: "transparent", border: "none", outline: "none", color: "rgba(255,255,255,0.80)", fontSize: 13, flex: 1, minWidth: 0, fontFamily: "monospace" }}
                      onKeyDown={e => { if (e.key === "Escape") { setSearchClickId(""); setClickIdSearch(false); } }}
                    />
                    <button
                      onClick={() => { setSearchClickId(""); setClickIdSearch(false); }}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: "rgba(255,255,255,0.35)" }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <button
                    style={{ ...GHOST, ...(searchClickId ? { borderColor: "rgba(139,92,246,0.5)", color: "rgba(196,181,253,1)", background: "rgba(139,92,246,0.12)" } : {}) }}
                    onClick={() => setClickIdSearch(true)}
                  >
                    {searchClickId ? `ID: ${searchClickId}` : "Search click ID"}
                  </button>
                )}

                {/* Clear all filters */}
                {activeFilters > 0 && (
                  <button
                    style={{ ...GHOST, color: "rgba(251,113,133,0.8)", borderColor: "rgba(251,113,133,0.2)" }}
                    onClick={clearAllFilters}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Table */}
            <div style={{ borderRadius: 22, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>

              {/* Head */}
              <div style={{ display: "grid", gridTemplateColumns: "160px 1.5fr 170px 190px 140px 140px", gap: 16, padding: "14px 20px", background: "rgba(255,255,255,0.03)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(255,255,255,0.28)" }}>
                <div>Date</div><div>Campaign</div><div>Source</div><div>Click ID</div><div>Revenue</div><div>Network</div>
              </div>

              {/* Body */}
              {loading ? (
                <div style={{ padding: "48px", display: "flex", justifyContent: "center", alignItems: "center", gap: 10 }}>
                  <RefreshCw size={14} style={{ color: "rgba(255,255,255,0.25)", animation: "spin 1s linear infinite" }} />
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.25)" }}>Loading…</span>
                </div>
              ) : displayRows.length === 0 ? (
                <div style={{ padding: "64px 32px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                  <AlertCircle size={24} style={{ color: "#3f3f46" }} />
                  <p style={{ fontSize: 14, color: "rgba(255,255,255,0.2)", margin: 0 }}>
                    {activeFilters > 0 ? "No results match your filters" : "No conversions in this date range"}
                  </p>
                  {activeFilters > 0 && (
                    <button style={{ ...GHOST, fontSize: 13 }} onClick={clearAllFilters}>Clear filters</button>
                  )}
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div key={`${page}-${dateFrom}-${dateTo}-${filterCampaign}-${filterSource}-${searchClickId}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                    {displayRows.map((row, i) => {
                      const network = inferNetwork(row);
                      return (
                        <motion.div key={row.id}
                          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.22, delay: i * 0.03 }}
                          style={{ display: "grid", gridTemplateColumns: "160px 1.5fr 170px 190px 140px 140px", gap: 16, padding: "14px 20px", borderTop: "1px solid rgba(255,255,255,0.06)", background: "linear-gradient(180deg, rgba(255,255,255,0.01), rgba(255,255,255,0))", alignItems: "center", fontSize: 14, transition: "background 0.15s" }}
                          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.025)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(180deg, rgba(255,255,255,0.01), rgba(255,255,255,0))"; }}
                        >
                          <div style={{ color: "rgba(255,255,255,0.34)", fontSize: 13 }}>{fmtDate(row.createdAt)}</div>
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {row.campaignId ? (
                              <Link
                                href={`/dashboard/campaigns/${row.campaignId}`}
                                style={{ color: "rgba(255,255,255,0.78)", textDecoration: "none", transition: "color 0.15s" }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "rgba(196,181,253,0.9)"; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.78)"; }}
                              >
                                {row.campaignName ?? row.campaignId}
                              </Link>
                            ) : (
                              <span style={{ color: "rgba(255,255,255,0.78)" }}>{row.campaignName ?? "—"}</span>
                            )}
                          </div>
                          <div><SourceBadge source={row.source} /></div>
                          <div style={{ color: "rgba(255,255,255,0.34)", fontSize: 12, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.clickId ?? "—"}</div>
                          <div style={{ color: "rgba(110,231,183,0.88)", fontVariantNumeric: "tabular-nums" }}>
                            {row.revenue > 0 ? `+${fmtMoney(row.revenue, row.currency)}` : "—"}
                          </div>
                          <div style={{ color: "rgba(255,255,255,0.42)" }}>{network}</div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                </AnimatePresence>
              )}

              {/* Pagination */}
              {totalPages > 1 && activeFilters === 0 && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, padding: "14px 20px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                    style={{ ...GHOST, padding: "8px 12px", opacity: page === 0 ? 0.3 : 1, display: "flex", alignItems: "center" }}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", fontVariantNumeric: "tabular-nums" }}>
                    {page + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                    style={{ ...GHOST, padding: "8px 12px", opacity: page >= totalPages - 1 ? 0.3 : 1, display: "flex", alignItems: "center" }}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          </motion.div>

        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.6); cursor: pointer; }
        button { font-family: inherit; }
      `}</style>
    </div>
  );
}
