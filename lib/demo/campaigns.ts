/**
 * Catalogue des 15 campagnes Dating du workspace démo.
 *
 * Choisi pour couvrir la diversité réelle d'un buyer Dating en 2026 :
 *   - 5 pays principaux (FR, DE, IT, US, UK) + 2 tier-2 (CA, ES)
 *   - 4 formats ExoClick/TrafficJunky (push, popunder, native, banner)
 *   - Statuts variés pour que le Decision Engine ait quelque chose à faire
 */

import type { Network, CampaignStatus } from "@prisma/client";

export type DemoCampaignSeed = {
  externalId: string;
  name:       string;
  network:    Network;
  status:     CampaignStatus;
  // Snapshot initial — le simulator fera évoluer ces chiffres
  spend:       number;
  revenue:     number;
  impressions: number;
  clicks:      number;
  conversions: number;
};

// Helper — ROI = (revenue - spend) / spend * 100
const pct = (roiPct: number, spend: number) => spend * (1 + roiPct / 100);

export const DEMO_CAMPAIGNS: DemoCampaignSeed[] = [
  // ─── TOP PERFORMERS ─────────────────────────────────────────────────────────
  {
    externalId:  "demo-fr-push-01",
    name:        "FR-Dating-push-01",
    network:     "EXOCLICK",
    status:      "ACTIVE",
    spend:       312.40,
    revenue:     pct(62, 312.40),
    impressions: 180_000,
    clicks:      4_200,
    conversions: 38,
  },
  {
    externalId:  "demo-de-native-v3",
    name:        "DE-Dating-native-v3",
    network:     "EXOCLICK",
    status:      "ACTIVE",
    spend:       245.10,
    revenue:     pct(48, 245.10),
    impressions: 92_000,
    clicks:      2_800,
    conversions: 27,
  },
  {
    externalId:  "demo-us-banner-premium",
    name:        "US-Dating-banner-premium",
    network:     "TRAFFICJUNKY",
    status:      "ACTIVE",
    spend:       420.00,
    revenue:     pct(38, 420.00),
    impressions: 210_000,
    clicks:      5_100,
    conversions: 42,
  },
  {
    externalId:  "demo-it-popunder-02",
    name:        "IT-Dating-popunder-02",
    network:     "EXOCLICK",
    status:      "ACTIVE",
    spend:       178.60,
    revenue:     pct(55, 178.60),
    impressions: 145_000,
    clicks:      3_100,
    conversions: 22,
  },

  // ─── STABLE ACTIVES ────────────────────────────────────────────────────────
  {
    externalId:  "demo-uk-native-v2",
    name:        "UK-Dating-native-v2",
    network:     "TRAFFICSTARS",
    status:      "ACTIVE",
    spend:       188.00,
    revenue:     pct(22, 188.00),
    impressions: 78_000,
    clicks:      1_950,
    conversions: 14,
  },
  {
    externalId:  "demo-ca-push-night",
    name:        "CA-Dating-push-night",
    network:     "EXOCLICK",
    status:      "ACTIVE",
    spend:       132.50,
    revenue:     pct(28, 132.50),
    impressions: 65_000,
    clicks:      1_400,
    conversions: 11,
  },
  {
    externalId:  "demo-es-native-tier2",
    name:        "ES-Dating-native-tier2",
    network:     "TRAFFICJUNKY",
    status:      "ACTIVE",
    spend:       96.80,
    revenue:     pct(18, 96.80),
    impressions: 52_000,
    clicks:      1_100,
    conversions: 8,
  },
  {
    externalId:  "demo-fr-banner-mobile",
    name:        "FR-Dating-banner-mobile",
    network:     "EXOCLICK",
    status:      "ACTIVE",
    spend:       205.30,
    revenue:     pct(12, 205.30),
    impressions: 88_000,
    clicks:      2_100,
    conversions: 16,
  },
  {
    externalId:  "demo-de-popunder-desktop",
    name:        "DE-Dating-popunder-desktop",
    network:     "TRAFFICSTARS",
    status:      "ACTIVE",
    spend:       164.20,
    revenue:     pct(8, 164.20),
    impressions: 71_000,
    clicks:      1_600,
    conversions: 12,
  },

  // ─── WATCHING ZONE ─────────────────────────────────────────────────────────
  // ROI entre -15% et 0% — le Decision Engine les surveille mais ne tue pas encore
  {
    externalId:  "demo-us-push-exit",
    name:        "US-Dating-push-exit",
    network:     "EXOCLICK",
    status:      "WATCH",
    spend:       142.00,
    revenue:     pct(-8, 142.00),
    impressions: 62_000,
    clicks:      1_350,
    conversions: 7,
  },
  {
    externalId:  "demo-it-banner-tablet",
    name:        "IT-Dating-banner-tablet",
    network:     "TRAFFICJUNKY",
    status:      "WATCH",
    spend:       98.40,
    revenue:     pct(-12, 98.40),
    impressions: 44_000,
    clicks:      900,
    conversions: 5,
  },
  {
    externalId:  "demo-ca-native-late",
    name:        "CA-Dating-native-late",
    network:     "EXOCLICK",
    status:      "WATCH",
    spend:       76.20,
    revenue:     pct(-14, 76.20),
    impressions: 31_000,
    clicks:      620,
    conversions: 4,
  },

  // ─── PAUSED ────────────────────────────────────────────────────────────────
  {
    externalId:  "demo-fr-popunder-test",
    name:        "FR-Dating-popunder-test",
    network:     "TRAFFICSTARS",
    status:      "PAUSED",
    spend:       54.80,
    revenue:     pct(-25, 54.80),
    impressions: 22_000,
    clicks:      400,
    conversions: 2,
  },
  {
    externalId:  "demo-de-push-backup",
    name:        "DE-Dating-push-backup",
    network:     "EXOCLICK",
    status:      "PAUSED",
    spend:       41.20,
    revenue:     pct(-18, 41.20),
    impressions: 18_000,
    clicks:      350,
    conversions: 3,
  },

  // ─── KILLED ────────────────────────────────────────────────────────────────
  // Déjà tuée par le Decision Engine — ROI catastrophique
  {
    externalId:  "demo-us-native-disaster",
    name:        "US-Dating-native-disaster",
    network:     "TRAFFICJUNKY",
    status:      "KILLED",
    spend:       187.50,
    revenue:     pct(-48, 187.50),
    impressions: 84_000,
    clicks:      1_800,
    conversions: 6,
  },
];
