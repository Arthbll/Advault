"use client";

const NET_META: Record<string, { label: string; color: string }> = {
  EXOCLICK:     { label: "ExoClick",     color: "#f59e0b" },
  TRAFFICSTARS: { label: "TrafficStars", color: "#8b5cf6" },
  TRAFFICJUNKY: { label: "TrafficJunky", color: "#0ea5e9" },
  VOLUUM:       { label: "Voluum",       color: "#10b981" },
  BEMOB:        { label: "Bemob",        color: "#f43f5e" },
};

interface NetworkRow {
  network:   string;
  spend:     number;
  revenue:   number;
  profit:    number;
  roi:       number;
  campaigns: number;
}

function fmtEuro(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 2,
  }).format(n);
}

export default function NetworkBreakdown({ data }: { data: NetworkRow[] }) {
  const sorted = [...data].sort((a, b) => b.profit - a.profit);

  return (
    <div
      className="rounded-3xl overflow-hidden"
      style={{ background: "#111113", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="px-6 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <h2 className="text-sm font-bold text-white">Performance par réseau</h2>
        <p className="text-xs mt-0.5" style={{ color: "#52525b" }}>Trié par profit décroissant</p>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            {["Réseau", "Dépenses", "Revenus", "Profit Net", "ROI", "Camps."].map(h => (
              <th key={h} style={{
                padding: "10px 20px", textAlign: "left",
                fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "0.05em", color: "#52525b",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const meta   = NET_META[row.network] ?? { label: row.network, color: "#71717a" };
            const isPos  = row.profit >= 0;
            const roiPos = row.roi >= 0;
            return (
              <tr
                key={row.network}
                style={{ borderBottom: i < sorted.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}
                onMouseEnter={e  => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                onMouseLeave={e => (e.currentTarget.style.background  = "transparent")}
              >
                <td style={{ padding: "14px 20px" }}>
                  <div className="flex items-center gap-3">
                    <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: meta.color, flexShrink: 0 }} />
                    <span style={{ color: "#e4e4e7", fontWeight: 600, fontSize: 13 }}>{meta.label}</span>
                  </div>
                </td>
                <td style={{ padding: "14px 20px", color: "#71717a",  fontSize: 13 }}>{fmtEuro(row.spend)}</td>
                <td style={{ padding: "14px 20px", color: "#fbbf24",  fontSize: 13, fontWeight: 600 }}>{fmtEuro(row.revenue)}</td>
                <td style={{ padding: "14px 20px", color: isPos ? "#4ade80" : "#f87171", fontSize: 13, fontWeight: 700 }}>
                  {fmtEuro(row.profit)}
                </td>
                <td style={{ padding: "14px 20px" }}>
                  <span style={{
                    display: "inline-block", padding: "3px 10px", borderRadius: 99,
                    fontSize: 12, fontWeight: 700,
                    background: roiPos ? "rgba(74,222,128,0.1)"   : "rgba(248,113,113,0.1)",
                    color:      roiPos ? "#4ade80"                 : "#f87171",
                  }}>
                    {row.roi >= 0 ? "+" : ""}{row.roi.toFixed(1)}%
                  </span>
                </td>
                <td style={{ padding: "14px 20px", color: "#52525b", fontSize: 13 }}>{row.campaigns}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
