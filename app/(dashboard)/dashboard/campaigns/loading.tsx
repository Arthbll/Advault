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

export default function CampaignsLoading() {
  return (
    <div style={{ padding: "20px 32px 60px", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Skeleton w={60} h={10} r={4} />
          <Skeleton w={140} h={28} r={8} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Skeleton w={110} h={32} r={99} />
          <Skeleton w={130} h={32} r={99} delay={0.1} />
          <Skeleton w={150} h={32} r={99} delay={0.2} />
        </div>
      </div>

      {/* Hero card */}
      <Skeleton w="100%" h={100} r={18} delay={0.1} />

      {/* Network cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
        {[0,0.1,0.2].map((d,i) => <Skeleton key={i} w="100%" h={110} r={16} delay={d} />)}
      </div>

      {/* Stats strip */}
      <Skeleton w="100%" h={52} r={14} delay={0.15} />

      {/* Filter pills */}
      <div style={{ display: "flex", gap: 6 }}>
        {[80,70,70,70].map((w,i) => <Skeleton key={i} w={w} h={30} r={99} delay={i*0.05} />)}
      </div>

      {/* Campaign rows */}
      {Array.from({ length: 5 }).map((_,i) => (
        <Skeleton key={i} w="100%" h={62} r={14} delay={i * 0.06} />
      ))}
    </div>
  );
}
