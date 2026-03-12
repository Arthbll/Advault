"use client";

import Link from "next/link";
import { Key, ExternalLink } from "lucide-react";

export default function VaultCard({ connectedCount }: { connectedCount: number }) {
  return (
    <Link href="/dashboard/vault" style={{ textDecoration: "none" }}>
      <div
        style={{
          background: "#111113",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 20, padding: "20px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.4)",
          cursor: "pointer", transition: "border-color 0.2s, box-shadow 0.2s, transform 0.18s",
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.borderColor = "rgba(255,214,10,0.2)";
          el.style.boxShadow   = "0 0 0 1px rgba(255,214,10,0.06), 0 8px 32px rgba(0,0,0,0.5), 0 0 40px rgba(255,214,10,0.06)";
          el.style.transform   = "translateY(-1px)";
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.borderColor = "rgba(255,255,255,0.06)";
          el.style.boxShadow   = "0 1px 3px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.4)";
          el.style.transform   = "translateY(0)";
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(255,214,10,0.08)", border: "1px solid rgba(255,214,10,0.12)",
          }}>
            <Key size={17} strokeWidth={1.5} style={{ color: "#FFD60A" }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#F5F5F7", margin: 0 }}>Vault</p>
            <p style={{ fontSize: 12, color: "#3F3F46", marginTop: 2 }}>Clés API des réseaux</p>
          </div>
          <ExternalLink size={13} strokeWidth={1.5} style={{ color: "#27272A" }} />
        </div>
        <div style={{ background: "#1A1A1C", borderRadius: 12, padding: "12px 14px", border: "1px solid rgba(255,255,255,0.04)" }}>
          <p style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", color: "#F5F5F7", margin: 0, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {connectedCount}
          </p>
          <p style={{ fontSize: 11, color: "#3F3F46", marginTop: 4 }}>
            réseau{connectedCount !== 1 ? "x" : ""} connecté{connectedCount !== 1 ? "s" : ""} · AES-256-GCM
          </p>
        </div>
      </div>
    </Link>
  );
}
