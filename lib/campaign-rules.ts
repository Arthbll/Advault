// ─── Campaign Rules — Single Source of Truth ─────────────────────────────────
//
// All classification logic lives here.
// BentoDashboard, ActionCenter, Campaign table, Insights → all read from this.
// When rules change (via StrategyPanel) → everything re-renders instantly.

export interface Rules {
  /** ROI below this % → Kill immediately */
  killThreshold:   number;
  /** ROI above this % (+ minSpendToScale) → Scale */
  scaleThreshold:  number;
  /** Minimum spend (€) required to qualify for Scale */
  minSpendToScale: number;
}

export const DEFAULT_RULES: Rules = {
  killThreshold:   -30,
  scaleThreshold:   30,
  minSpendToScale: 100,
};

export type CampaignDecision = "kill" | "scale" | "monitor" | "neutral";

/**
 * Classify a campaign based on its ROI, spend, and the current rules.
 *
 * Decision hierarchy:
 *  1. kill    — ROI < killThreshold (critical loss)
 *  2. scale   — ROI >= scaleThreshold AND spend >= minSpendToScale (proven winner)
 *  3. monitor — any other negative ROI (losing but not catastrophic)
 *  4. neutral — profitable but below scale threshold
 */
export function getCampaignDecision(
  roi:   number,
  spend: number,
  rules: Rules,
): CampaignDecision {
  if (roi < rules.killThreshold) return "kill";
  if (roi >= rules.scaleThreshold && spend >= rules.minSpendToScale) return "scale";
  if (roi < 0) return "monitor";
  return "neutral";
}

/** Returns the accent color for a given decision */
export function decisionColor(decision: CampaignDecision): string {
  switch (decision) {
    case "kill":    return "#f87171";
    case "scale":   return "#4ade80";
    case "monitor": return "#fbbf24";
    default:        return "rgba(255,255,255,0.35)";
  }
}
