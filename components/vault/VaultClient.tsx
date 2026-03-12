"use client";

import { motion } from "framer-motion";
import { KeyRound, Shield, Lock, Cpu, CheckCircle } from "lucide-react";
import NetworkCard from "@/components/settings/NetworkCard";
import { Network } from "@prisma/client";

const NETWORKS = [
  { network: Network.EXOCLICK,     label: "ExoClick",     description: "Adult ad network — CPC, CPM, CPA",   color: "#F59E0B", glow: "rgba(245,158,11,0.1)",   hasSecret: false, keyLabel: "API Key"      },
  { network: Network.TRAFFICSTARS, label: "TrafficStars", description: "Premium adult traffic platform",      color: "#8B5CF6", glow: "rgba(139,92,246,0.1)",   hasSecret: false, keyLabel: "Bearer Token" },
  { network: Network.TRAFFICJUNKY, label: "TrafficJunky", description: "High-volume adult advertising",       color: "#00FF87", glow: "rgba(0,255,135,0.08)",   hasSecret: true,  keyLabel: "Client ID", secretLabel: "Client Secret" },
] as const;

const SECURITY_BADGES = [
  { icon: Lock,   label: "AES-256-GCM", sub: "Chiffrement des clés",  rgb: "0,255,135" },
  { icon: Shield, label: "Zero clair",  sub: "Jamais en texte brut",  rgb: "0,255,135" },
  { icon: Cpu,    label: "Server-side", sub: "Isolation complète",    rgb: "0,255,135" },
];

export default function VaultClient({ connectedMap }: { connectedMap: Record<string, boolean> }) {
  const connectedCount = Object.values(connectedMap).filter(Boolean).length;

  return (
    <div style={{ background: "#0A0A0B", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 32px" }}>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          style={{ marginBottom: 28 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
            {connectedCount > 0
              ? <CheckCircle size={12} strokeWidth={1.5} style={{ color: "#00FF87", filter: "drop-shadow(0 0 4px rgba(0,255,135,0.5))" }} />
              : <KeyRound size={12} strokeWidth={1.5} style={{ color: "#3F3F46" }} />
            }
            <span style={{ fontSize: 12, color: connectedCount > 0 ? "#00FF87" : "#3F3F46", fontWeight: 500 }}>
              {connectedCount} réseau{connectedCount !== 1 ? "x" : ""} connecté{connectedCount !== 1 ? "s" : ""}
            </span>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.04em", color: "#F5F5F7", margin: 0, lineHeight: 1 }}>
            Vault
          </h1>
          <p style={{ fontSize: 13, color: "#3F3F46", marginTop: 8 }}>Clés API · Réseaux publicitaires</p>
        </motion.div>

        {/* Security strip */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.32 }}
          style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 24 }}
        >
          {SECURITY_BADGES.map(({ icon: Icon, label, sub, rgb }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              style={{
                padding: "16px 20px", borderRadius: 16,
                background: "#111113",
                border: "1px solid rgba(255,255,255,0.06)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.35)",
                display: "flex", alignItems: "center", gap: 14,
              }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: `rgba(${rgb},0.08)`,
                border: `1px solid rgba(${rgb},0.12)`,
              }}>
                <Icon size={14} strokeWidth={1.5} style={{ color: "#00FF87", filter: "drop-shadow(0 0 4px rgba(0,255,135,0.4))" }} />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#F5F5F7", margin: 0 }}>{label}</p>
                <p style={{ fontSize: 11, color: "#3F3F46", marginTop: 2 }}>{sub}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Network cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {NETWORKS.map((net, i) => (
            <NetworkCard key={net.network} {...net} isConnected={!!connectedMap[net.network]} index={i} />
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          style={{ fontSize: 11, textAlign: "center", marginTop: 28, color: "#27272A" }}
        >
          Tes clés sont chiffrées côté serveur · Elles ne transitent jamais en clair
        </motion.p>
      </div>
    </div>
  );
}
