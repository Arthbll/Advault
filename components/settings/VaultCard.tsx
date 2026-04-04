"use client";

import Link from "next/link";
import { Key, ExternalLink } from "lucide-react";

const LABEL: React.CSSProperties = {
  fontSize: 10, fontWeight: 600,
  textTransform: "uppercase", letterSpacing: "0.12em",
  color: "#3f3f46",
};

export default function VaultCard({ connectedCount }: { connectedCount: number }) {
  return (
    <Link href="/dashboard/vault" style={{ textDecoration: "none" }}>
      <div
        style={{
          background: "#17171e",
          border: "1px solid rgba(255,255,255,0.03)",
          borderRadius: 18, padding: "16px 18px",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07), 0 1px 2px rgba(0,0,0,0.4)",
          cursor: "pointer", transition: "border-color 0.2s, box-shadow 0.2s, transform 0.15s",
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.borderColor = "rgba(251,191,36,0.15)";
          el.style.transform   = "translateY(-1px)";
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.borderColor = "rgba(255,255,255,0.03)";
          el.style.transform   = "translateY(0)";
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(251,191,36,0.08)",
          }}>
            <Key size={14} strokeWidth={1.5} style={{ color: "#b09040" }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.85)", margin: 0 }}>Vault</p>
            <p style={{ ...LABEL, marginTop: 2 }}>Network API keys</p>
          </div>
          <ExternalLink size={12} strokeWidth={1.5} style={{ color: "#3f3f46" }} />
        </div>
        <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 13px", border: "1px solid rgba(255,255,255,0.04)" }}>
          <span style={{ fontSize: 28, fontWeight: 200, letterSpacing: "-0.04em", color: connectedCount === 0 ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.92)", display: "block", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {connectedCount === 0 ? "—" : connectedCount}
          </span>
          <p style={{ ...LABEL, marginTop: 4 }}>
            network{connectedCount !== 1 ? "s" : ""} connected · AES-256-GCM
          </p>
        </div>
      </div>
    </Link>
  );
}
