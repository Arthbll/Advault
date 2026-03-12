"use client";

import { Shield } from "lucide-react";
import VaultCard from "./VaultCard";
import AutoSyncSettings from "./AutoSyncSettings";
import KillSwitchSettings from "./KillSwitchSettings";
import NotificationSettings from "./NotificationSettings";

interface KSConfig {
  killSwitchEnabled: boolean;
  roiThreshold: number;
  maxSpendPerCampaign: number | null;
  checkIntervalMinutes: number;
}

interface Props {
  connectedCount: number;
  ksSettings: KSConfig;
}

export default function SettingsPageClient({ connectedCount, ksSettings }: Props) {
  return (
    <div style={{ background: "#0A0A0B", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 32px" }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 12, color: "#3F3F46", marginBottom: 4 }}>Configuration</p>
          <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.04em", color: "#F5F5F7", margin: 0, lineHeight: 1 }}>
            Paramètres
          </h1>
          <p style={{ fontSize: 13, color: "#3F3F46", marginTop: 8 }}>
            Kill-Switch automatique et protection des campagnes
          </p>
        </div>

        {/* Two-column layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 16, alignItems: "start" }}>

          {/* Left */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <VaultCard connectedCount={connectedCount} />

            <div style={{
              background: "#111113",
              border: "1px solid rgba(0,255,135,0.08)",
              borderRadius: 20, padding: "18px 20px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.4)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 11, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(0,255,135,0.08)", border: "1px solid rgba(0,255,135,0.12)",
                }}>
                  <Shield size={14} strokeWidth={1.5} style={{ color: "#00FF87", filter: "drop-shadow(0 0 4px rgba(0,255,135,0.4))" }} />
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#00FF87", margin: 0 }}>Protection automatique</p>
              </div>
              <p style={{ fontSize: 12, color: "#3F3F46", lineHeight: 1.6, margin: 0 }}>
                Le Kill-Switch surveille tes campagnes en continu et stoppe automatiquement celles qui passent sous le seuil de ROI défini.
              </p>
            </div>
          </div>

          {/* Right */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <AutoSyncSettings />
            <NotificationSettings />
            <KillSwitchSettings initialSettings={ksSettings} />
          </div>
        </div>
      </div>
    </div>
  );
}
