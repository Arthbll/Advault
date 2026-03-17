"use client";

import {
  AreaChart, Area, XAxis, Tooltip, ResponsiveContainer,
} from "recharts";

export interface ChartPoint {
  date: string;
  profit: number;
  spend: number;
  revenue: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const get = (key: string) => payload.find((p: any) => p.dataKey === key)?.value ?? 0;
  const profit  = get("profit");
  const revenue = get("revenue");
  const spend   = get("spend");

  return (
    <div style={{
      background: "#18181b",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 12,
      padding: "10px 14px",
      fontSize: 12,
    }}>
      <p style={{ color: "#52525b", marginBottom: 8, fontWeight: 600 }}>{label}</p>
      {[
        { label: "Profit",  v: profit,  color: profit >= 0 ? "#4ade80" : "#f87171" },
        { label: "Revenue", v: revenue, color: "#a78bfa" },
        { label: "Spend",   v: spend,   color: "#52525b"  },
      ].map(({ label: l, v, color }) => (
        <div key={l} style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 4 }}>
          <span style={{ color: "#52525b" }}>{l}</span>
          <span style={{ color, fontWeight: 700 }}>€{v.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
};

export default function ProfitChart({ data }: { data: ChartPoint[] }) {
  const profitColor = data.every(d => d.profit >= 0) ? "#4ade80" : "#f87171";

  return (
    <div style={{
      background: "#111115",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 24,
      padding: "22px 24px",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#3f3f46", marginBottom: 6 }}>
            Performance
          </p>
          <h2 style={{ fontSize: 20, fontWeight: 300, color: "#ffffff", margin: 0, letterSpacing: "-0.01em" }}>
            Profit Net
          </h2>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {[
            { color: "#a78bfa", label: "Revenue" },
            { color: profitColor, label: "Profit" },
            { color: "#3f3f46", label: "Spend" },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
              <span style={{ fontSize: 11, color: "#52525b" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="gRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#8b5cf6" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={profitColor} stopOpacity={0.25} />
              <stop offset="100%" stopColor={profitColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#3f3f46" }}
            tickLine={false}
            axisLine={false}
            interval={data.length > 20 ? Math.floor(data.length / 6) : 0}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(255,255,255,0.06)", strokeWidth: 1 }} />
          <Area type="monotone" dataKey="spend"   stroke="rgba(63,63,70,0.6)"  fill="none"          strokeWidth={1} strokeDasharray="3 3" dot={false} />
          <Area type="monotone" dataKey="revenue" stroke="#8b5cf6"              fill="url(#gRevenue)" strokeWidth={1.5} dot={false} />
          <Area type="monotone" dataKey="profit"  stroke={profitColor}          fill="url(#gProfit)"  strokeWidth={2}   dot={false} activeDot={{ r: 4, fill: profitColor, strokeWidth: 0 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
