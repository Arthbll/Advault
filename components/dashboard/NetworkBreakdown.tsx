"use client";

const NET_META: Record<string, { label: string; color: string }> = {
  EXOCLICK:     { label: "ExoClick",     color: "#f59e0b" },
  TRAFFICSTARS: { label: "TrafficStars", color: "#8b5cf6" },
  TRAFFICJUNKY: { label: "TrafficJunky", color: "#0ea5e9" },
  VOLUUM:       { label: "Voluum",       color: "#10b981" },
  BEMOB:        { label: "Bemob",        color: "#f43f5e" },
};

interface NetworkRow {
  network: string;
  spend: number;
  revenue: number;
  profit: number;
  roi: number;
  campaigns: number;
}

function fmtEuro(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);
}

export default function NetworkBreakdown({ data }: { data: NetworkRow[] }) {
  const sorted = [...data].sort((a, b) => b.profit - a.profit);

  return (
    <div style={{
      background: "#111115",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 24,
      overflow: "hidden",
    }}>
      <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#3f3f46", marginBottom: 6 }}>
          Réseaux publicitaires
        </p>
        <h2 style={{ fontSize: 20, fontWeight: 300, color: "#ffffff", margin: 0 }}>
          Performance par réseau
        </h2>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Réseau", "Dépenses", "Revenus", "Profit", "ROI", "Camps."].map(h => (
              <th key={h} style={{
                padding: "10px 20px", textAlign: "left",
                fontSize: 10, fontWeight: 600, textTransform: "uppercase",
                letterSpacing: "0.08em", color: "#3f3f46",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const meta  = NET_META[row.network] ?? { label: row.network, color: "#71717a" };
            const isPos = row.profit >= 0;
            const roiPos = row.roi >= 0;
            return (
              <tr
                key={row.network}
                style={{ borderBottom: i < sorted.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", cursor: "default" }}
                onMouseEnter={e  => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                onMouseLeave={e  => (e.currentTarget.style.background  = "transparent")}
              >
                <td style={{ padding: "14px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: meta.color, boxShadow: `0 0 6px ${meta.color}88`, flexShrink: 0 }} />
                    <span style={{ color: "#d4d4d8", fontWeight: 500, fontSize: 13 }}>{meta.label}</span>
                  </div>
                </td>
                <td style={{ padding: "14px 20px", color: "#52525b", fontSize: 13 }}>{fmtEuro(row.spend)}</td>
                <td style={{ padding: "14px 20px", color: "#a78bfa", fontSize: 13, fontWeight: 600 }}>{fmtEuro(row.revenue)}</td>
                <td style={{ padding: "14px 20px", color: isPos ? "#4ade80" : "#f87171", fontSize: 13, fontWeight: 700 }}>{fmtEuro(row.profit)}</td>
                <td style={{ padding: "14px 20px" }}>
                  <span style={{
                    display: "inline-block", padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700,
                    background: roiPos ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
                    color: roiPos ? "#4ade80" : "#f87171",
                    border: `1px solid ${roiPos ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)"}`,
                  }}>
                    {row.roi >= 0 ? "+" : ""}{row.roi.toFixed(1)}%
                  </span>
                </td>
                <td style={{ padding: "14px 20px", color: "#3f3f46", fontSize: 13 }}>{row.campaigns}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
