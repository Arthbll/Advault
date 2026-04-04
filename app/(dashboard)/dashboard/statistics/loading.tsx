"use client";

import { motion } from "framer-motion";

function Skeleton({ w = "100%", h = 16, r = 8, delay = 0 }: { w?: string | number; h?: number; r?: number; delay?: number }) {
  return (
    <motion.div
      animate={{ opacity: [0.4, 0.7, 0.4] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay }}
      style={{
        width: w, height: h, borderRadius: r,
        background: "rgba(255,255,255,0.06)",
        flexShrink: 0,
      }}
    />
  );
}

export default function StatisticsLoading() {
  return (
    <div style={{ padding: "20px 28px 60px", display: "flex", flexDirection: "column", gap: 18 }}>

      {/* Header + date range */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Skeleton w={60} h={10} r={4} />
          <Skeleton w={160} h={28} r={8} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[60,60,60,60,80].map((w,i) => <Skeleton key={i} w={w} h={30} r={99} delay={i*0.04} />)}
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        {[0,0.08,0.16,0.24].map((d,i) => <Skeleton key={i} w="100%" h={120} r={18} delay={d} />)}
      </div>

      {/* Metric tabs */}
      <div style={{ display: "flex", gap: 6 }}>
        {[90,90,90,90].map((w,i) => <Skeleton key={i} w={w} h={30} r={99} delay={i*0.04} />)}
      </div>

      {/* Area chart */}
      <Skeleton w="100%" h={240} r={18} delay={0.2} />

      {/* Campaign table */}
      <Skeleton w="100%" h={320} r={18} delay={0.25} />
    </div>
  );
}
