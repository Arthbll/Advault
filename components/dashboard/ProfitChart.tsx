"use client";

import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";

export interface ChartPoint {
  date: string;
  profit: number;
  spend: number;
  revenue: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const profit  = payload.find((p: any) => p.dataKey === "profit");
  const spend   = payload.find((p: any) => p.dataKey === "spend");
  const revenue = payload.find((p: any) => p.dataKey === "revenue");
  const isPos   = (profit?.value ?? 0) >= 0;
  return (
    <div style={{
      background: "#18181b", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 16, padding: "12px 16px", fontSize: 12,
    }}>
      <p style={{ color: "#71717a", marginBottom: 8, fontWeight: 600 }}>{label}</p>
      <div className="flex flex-col gap-1.5">
        <p style={{ color: isPos ? "#4ade80" : "#f87171" }}>
          Profit <span className="font-black">€{profit?.value?.toFixed(2)}</span>
        </p>
        <p style={{ color: "#fbbf24" }}>
          Revenue <span className="font-black">€{revenue?.value?.toFixed(2)}</span>
        </p>
        <p style={{ color: "#71717a" }}>
          Spend <span className="font-black">€{spend?.value?.toFixed(2)}</span>
        </p>
      </div>
    </div>
  );
};

export default function ProfitChart({ data }: { data: ChartPoint[] }) {
  const allPositive = data.every(d => d.profit >= 0);
  const gradColor   = allPositive ? "#4ade80" : "#f87171";

  return (
    <div
      className="rounded-3xl p-6"
      style={{ background: "#111113", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-sm font-bold text-white">Profit Net</h2>
          <p className="text-xs mt-0.5" style={{ color: "#52525b" }}>Revenus − Dépenses</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={gradColor} stopOpacity={0.18} />
              <stop offset="95%" stopColor={gradColor} stopOpacity={0}    />
            </linearGradient>
            <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#fbbf24" stopOpacity={0.12} />
              <stop offset="95%" stopColor="#fbbf24" stopOpacity={0}    />
            </linearGradient>
          </defs>

          {/* No CartesianGrid — Apple Vanguard */}
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#52525b" }}
            tickLine={false} axisLine={false}
            interval={data.length > 20 ? Math.floor(data.length / 7) : 0}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#52525b" }}
            tickLine={false} axisLine={false}
            tickFormatter={v => `€${v}`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(255,255,255,0.06)", strokeWidth: 1 }} />

          <Area type="monotone" dataKey="spend"
            stroke="rgba(113,113,122,0.4)" fill="none"
            strokeWidth={1.5} dot={false} />
          <Area type="monotone" dataKey="revenue"
            stroke="#fbbf24" fill="url(#gradRevenue)"
            strokeWidth={1.5} dot={false} />
          <Area type="monotone" dataKey="profit"
            stroke={gradColor} fill="url(#gradProfit)"
            strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: gradColor }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
