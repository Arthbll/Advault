"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";

const NET_META: Record<string, { label: string; color: string; rgb: string; abbr: string }> = {
  EXOCLICK:     { label: "ExoClick",     color: "#F59E0B", rgb: "245,158,11",  abbr: "EX" },
  TRAFFICSTARS: { label: "TrafficStars", color: "#8B5CF6", rgb: "139,92,246",  abbr: "TS" },
  TRAFFICJUNKY: { label: "TrafficJunky", color: "#4ADE80", rgb: "74,222,128",   abbr: "TJ" },
  VOLUUM:       { label: "Voluum",       color: "#38BDF8", rgb: "56,189,248",  abbr: "VL" },
  BEMOB:        { label: "Bemob",        color: "#F87171", rgb: "248,113,113", abbr: "BM" },
};

const ALL_NETWORKS = ["EXOCLICK", "TRAFFICSTARS", "TRAFFICJUNKY"];

interface NetworkRow { network: string; spend: number; revenue: number; profit: number; roi: number; campaigns: number; }

function fmt$(n: number) {
  if (Math.abs(n) >= 1000) return `$${(n/1000).toFixed(1)}K`;
  return `$${Math.abs(n).toFixed(2)}`;
}
function fmtN(n: number) {
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n/1_000).toFixed(1)}K`;
  return String(n);
}

interface Props {
  data: NetworkRow[];
  campaigns: Array<{ network: string; status: string; impressions: number; clicks: number }>;
}

export default function PlatformCards({ data, campaigns }: Props) {
  const dataMap: Record<string, NetworkRow> = {};
  for (const row of data) dataMap[row.network] = row;

  const campMap: Record<string, { total: number; active: number; impressions: number; clicks: number }> = {};
  for (const c of campaigns) {
    if (!campMap[c.network]) campMap[c.network] = { total: 0, active: 0, impressions: 0, clicks: 0 };
    campMap[c.network].total++;
    if (c.status === "ACTIVE") campMap[c.network].active++;
    campMap[c.network].impressions += c.impressions;
    campMap[c.network].clicks      += c.clicks;
  }

  const networksToShow = [...new Set([...ALL_NETWORKS, ...data.map(d => d.network)])];

  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#3F3F46", marginBottom: 12 }}>
        Répartition par plateforme
      </p>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(networksToShow.length, 3)}, 1fr)`, gap: 10 }}>
        {networksToShow.map((network, i) => {
          const meta    = NET_META[network] ?? { label: network, color: "#52525B", rgb: "82,82,91", abbr: network.slice(0,2) };
          const row     = dataMap[network]  ?? { network, spend: 0, revenue: 0, profit: 0, roi: 0, campaigns: 0 };
          const camp    = campMap[network]  ?? { total: 0, active: 0, impressions: 0, clicks: 0 };
          const hasData = row.spend > 0 || camp.total > 0;
          const ctr     = camp.impressions > 0 ? (camp.clicks / camp.impressions) * 100 : 0;
          const isPos   = row.profit >= 0;

          return (
            <NetworkCard
              key={network}
              meta={meta} row={row} camp={camp}
              hasData={hasData} ctr={ctr} isPos={isPos}
              index={i}
            />
          );
        })}
      </div>
    </div>
  );
}

function NetworkCard({ meta, row, camp, hasData, ctr, isPos, index }: {
  meta:    { label: string; color: string; rgb: string; abbr: string };
  row:     NetworkRow;
  camp:    { total: number; active: number; impressions: number; clicks: number };
  hasData: boolean;
  ctr:     number;
  isPos:   boolean;
  index:   number;
}) {
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null);
  const [hov,  setHov]  = useState(false);

  const BASE  = "0 1px 3px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.4)";
  const HOVER = `0 0 0 1px rgba(${meta.rgb},0.18), 0 8px 32px rgba(0,0,0,0.5), 0 0 40px rgba(${meta.rgb},0.08)`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07 }}
      onMouseMove={e => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setSpot({ x: e.clientX - r.left, y: e.clientY - r.top });
      }}
      onMouseEnter={e => {
        setHov(true);
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = `rgba(${meta.rgb},0.2)`;
        el.style.boxShadow   = HOVER;
        el.style.transform   = "translateY(-2px)";
      }}
      onMouseLeave={e => {
        setHov(false); setSpot(null);
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "rgba(255,255,255,0.06)";
        el.style.boxShadow   = BASE;
        el.style.transform   = "translateY(0)";
      }}
      style={{
        position: "relative", overflow: "hidden",
        background: "#111113",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 20,
        display: "flex", flexDirection: "column",
        boxShadow: BASE,
        transition: "border-color 0.2s, box-shadow 0.25s, transform 0.18s",
      }}
    >
      {/* Spotlight */}
      {spot && (
        <div style={{
          position: "absolute", pointerEvents: "none",
          width: 280, height: 280, borderRadius: "50%",
          left: spot.x - 140, top: spot.y - 140,
          background: `radial-gradient(circle, rgba(${meta.rgb},0.07) 0%, transparent 65%)`,
        }} />
      )}

      {/* Top accent */}
      <div style={{
        height: 2,
        background: hasData
          ? `linear-gradient(90deg, transparent, rgba(${meta.rgb},0.7), transparent)`
          : "transparent",
      }} />

      {/* Header */}
      <div style={{ padding: "16px 18px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 12, flexShrink: 0,
              background: `rgba(${meta.rgb},0.1)`,
              border: `1px solid rgba(${meta.rgb},0.15)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 800, color: meta.color,
              letterSpacing: "0.02em",
              boxShadow: hov ? `0 0 10px rgba(${meta.rgb},0.2)` : "none",
              transition: "box-shadow 0.2s",
            }}>
              {meta.abbr}
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#F5F5F7", lineHeight: 1.2 }}>{meta.label}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
                <motion.div
                  animate={camp.active > 0 ? { opacity: [1, 0.2, 1], scale: [1, 0.7, 1] } : {}}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{ width: 5, height: 5, borderRadius: "50%", background: camp.active > 0 ? "#00FF87" : "#27272A", flexShrink: 0, boxShadow: camp.active > 0 ? "0 0 4px rgba(0,255,135,0.6)" : "none" }}
                />
                <span style={{ fontSize: 11, color: "#3F3F46" }}>
                  {camp.active}/{camp.total} actives
                </span>
              </div>
            </div>
          </div>

          {hasData ? (
            <div style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "4px 9px", borderRadius: 99,
              background: isPos ? "rgba(0,255,135,0.1)" : "rgba(255,69,58,0.1)",
              color: isPos ? "#00FF87" : "#FF453A",
              border: `1px solid ${isPos ? "rgba(0,255,135,0.15)" : "rgba(255,69,58,0.15)"}`,
              fontSize: 11, fontWeight: 700, fontVariantNumeric: "tabular-nums",
            }}>
              {isPos ? <TrendingUp size={9} strokeWidth={2} /> : <TrendingDown size={9} strokeWidth={2} />}
              {row.roi >= 0 ? "+" : ""}{row.roi.toFixed(1)}%
            </div>
          ) : (
            <span style={{ fontSize: 10, color: "#3F3F46", padding: "3px 9px", borderRadius: 99, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
              Non connecté
            </span>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>

        {/* Spend / Revenue */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
          {[
            { label: "Dépenses", value: fmt$(row.spend) },
            { label: "Revenus",  value: fmt$(row.revenue) },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: "#1A1A1C", borderRadius: 12, padding: "10px 12px", border: "1px solid rgba(255,255,255,0.04)" }}>
              <p style={{ fontSize: 10, color: "#3F3F46", marginBottom: 4, letterSpacing: "0.04em" }}>{label}</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: hasData ? "#E4E4E7" : "#27272A", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Profit */}
        <div style={{
          background: hasData
            ? (isPos ? "rgba(0,255,135,0.06)" : "rgba(255,69,58,0.06)")
            : "rgba(255,255,255,0.02)",
          border: hasData
            ? (isPos ? "1px solid rgba(0,255,135,0.1)" : "1px solid rgba(255,69,58,0.1)")
            : "1px solid rgba(255,255,255,0.04)",
          borderRadius: 12, padding: "10px 14px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 11, color: "#3F3F46" }}>Profit net</span>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {hasData && (isPos
              ? <TrendingUp  size={10} strokeWidth={1.5} style={{ color: "#00FF87", filter: "drop-shadow(0 0 3px rgba(0,255,135,0.5))" }} />
              : <TrendingDown size={10} strokeWidth={1.5} style={{ color: "#FF453A" }} />
            )}
            <span style={{
              fontSize: 14, fontWeight: 700,
              color: hasData ? (isPos ? "#00FF87" : "#FF453A") : "#27272A",
              letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums",
            }}>
              {row.profit >= 0 ? "+" : "-"}{fmt$(Math.abs(row.profit))}
            </span>
          </div>
        </div>

        {/* Impressions + CTR */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
          {[
            { label: "Impressions", value: fmtN(camp.impressions) },
            { label: "CTR",         value: camp.impressions > 0 ? `${ctr.toFixed(2)}%` : "—" },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: "#1A1A1C", borderRadius: 12, padding: "8px 12px", border: "1px solid rgba(255,255,255,0.04)" }}>
              <p style={{ fontSize: 10, color: "#3F3F46", marginBottom: 3, letterSpacing: "0.04em" }}>{label}</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#52525B", fontVariantNumeric: "tabular-nums" }}>{value}</p>
            </div>
          ))}
        </div>

        {/* ROI progress bar */}
        {hasData && (
          <div style={{ height: 2, background: "rgba(255,255,255,0.05)", borderRadius: 99, overflow: "hidden" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.max(0, (row.roi + 100) / 2))}%` }}
              transition={{ duration: 1.4, delay: index * 0.1 + 0.3, ease: [0.23, 1, 0.32, 1] }}
              style={{
                height: "100%", borderRadius: 99,
                background: isPos
                  ? `linear-gradient(90deg, rgba(0,255,135,0.3), #00FF87)`
                  : `linear-gradient(90deg, rgba(255,69,58,0.3), #FF453A)`,
                boxShadow: isPos ? "0 0 6px rgba(0,255,135,0.4)" : "0 0 6px rgba(255,69,58,0.4)",
              }}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}
