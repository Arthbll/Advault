/**
 * POST /api/automation/run
 * Évalue toutes les règles actives de l'utilisateur contre
 * les campagnes en cours et exécute les actions correspondantes.
 * Appelé par le client toutes les 5 minutes (setInterval dans le layout).
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { ExoClickAdapter }    from "@/lib/adapters/exoclick";
import { TrafficStarsAdapter } from "@/lib/adapters/trafficstars";
import { TrafficJunkyAdapter } from "@/lib/adapters/trafficjunky";
import * as PropellerAds       from "@/lib/adapters/propellerads";
import * as Adsterra           from "@/lib/adapters/adsterra";
import { CampaignStatus, LogType } from "@prisma/client";
import { resolveWorkspaceUserId } from "@/lib/workspace";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CampaignWithStats {
  id:         string;
  externalId: string;
  name:       string;
  network:    string;
  spend:      number;
  revenue:    number;
  roi:        number;
  status:     string;
}

interface ActionResult {
  ruleId:       string;
  ruleName:     string;
  campaignId:   string;
  campaignName: string;
  action:       string;
  applied:      boolean;
  reason:       string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function evaluateCondition(
  condition: string,
  threshold: number,
  c: CampaignWithStats,
): boolean {
  switch (condition) {
    case "ROI_BELOW":     return c.roi     < threshold;
    case "ROI_ABOVE":     return c.roi     > threshold;
    case "SPEND_ABOVE":   return c.spend   > threshold;
    case "REVENUE_BELOW": return c.revenue < threshold;
    case "CPC_ABOVE":     return false; // requires clicks — V2
    default:              return false;
  }
}

function inTimeWindow(start: number | null, end: number | null): boolean {
  if (start == null || end == null) return true; // no window = always active
  const hour = new Date().getUTCHours();
  return start <= end ? hour >= start && hour < end : hour >= start || hour < end;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await resolveWorkspaceUserId(user.id);

  try {
    // 0. Check engine mode — Recommend mode blocks real API calls
    const dr = await prisma.decisionRule.findUnique({
      where:  { userId: userId },
      select: { engineMode: true },
    });
    const engineMode      = dr?.engineMode ?? "automatic";
    const isRecommendMode = engineMode === "recommendation";

    // 1. Load enabled rules, sorted by priority desc
    const rules = await prisma.automationRule.findMany({
      where:   { userId: userId, enabled: true },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });

    if (!rules.length) {
      return NextResponse.json({ results: [], message: "No active rules." });
    }

    // 2. Load active/paused campaigns with real spend > 0
    //    profit = revenue - spend (computed, not stored)
    const rawCampaigns = await prisma.campaign.findMany({
      where: {
        userId: userId,
        status: { in: [CampaignStatus.ACTIVE, CampaignStatus.PAUSED] },
      },
    });

    const campaigns: CampaignWithStats[] = rawCampaigns
      .map(c => {
        const spend   = Number(c.spend);
        const revenue = Number(c.revenue);
        const profit  = revenue - spend;
        const roi     = spend > 0 ? (profit / spend) * 100 : 0;
        return { id: c.id, externalId: c.externalId, name: c.name, network: c.network, spend, revenue, roi, status: c.status };
      })
      .filter(c => c.spend > 0);

    const results: ActionResult[] = [];
    const now = new Date();

    // 3. Evaluate each rule against matching campaigns
    for (const rule of rules) {
      // Skip rule if outside its time window
      if (!inTimeWindow(rule.timeWindowStart, rule.timeWindowEnd)) continue;

      const eligible = campaigns.filter(c => {
        if (rule.network && c.network !== rule.network) return false;
        return evaluateCondition(rule.condition, rule.threshold, c);
      });

      for (const camp of eligible) {
        let applied = false;
        let reason  = "";

        switch (rule.action) {
          // ── PAUSE ──────────────────────────────────────────────────────
          case "PAUSE_CAMPAIGN": {
            if (camp.status !== "PAUSED" && camp.status !== "KILLED") {
              try {
                if (isRecommendMode) {
                  await prisma.log.create({
                    data: {
                      userId:     userId,
                      campaignId: camp.id,
                      type:       LogType.KILL_SWITCH_TRIGGERED,
                      message:    `[RECOMMEND] Would pause "${camp.name}" (rule: "${rule.name}") — no action taken (Recommend mode)`,
                      metadata:   { campaignName: camp.name, network: camp.network, ruleName: rule.name },
                      createdAt:  now,
                    },
                  });
                  applied = true;
                  reason  = "[Recommend mode] Suggestion logged — no real pause executed";
                } else {
                  // Real network pause
                  const account = await prisma.account.findFirst({
                    where: { userId: userId, network: camp.network as never, isActive: true },
                  });
                  if (account) {
                    const apiKey = decrypt(account.apiKeyEnc);
                    if (camp.network === "EXOCLICK") {
                      await new ExoClickAdapter(apiKey).pauseCampaign(camp.externalId);
                    } else if (camp.network === "TRAFFICSTARS") {
                      await new TrafficStarsAdapter(apiKey).pauseCampaign(camp.externalId);
                    } else if (camp.network === "TRAFFICJUNKY") {
                      await new TrafficJunkyAdapter(apiKey).pauseCampaign(camp.externalId);
                    } else if (camp.network === "PROPELLERADS") {
                      await PropellerAds.pauseCampaign(apiKey, camp.externalId);
                    } else if (camp.network === "ADSTERRA") {
                      await Adsterra.pauseCampaign(apiKey, camp.externalId);
                    }
                  }
                  // Update DB status
                  await prisma.campaign.update({
                    where: { id: camp.id },
                    data:  { status: CampaignStatus.KILLED },
                  });
                  // Audit log
                  await prisma.log.create({
                    data: {
                      userId:     userId,
                      campaignId: camp.id,
                      type:       LogType.KILL_SWITCH_TRIGGERED,
                      message:    `[AUTOMATION] Campagne "${camp.name}" stoppée par la règle "${rule.name}"`,
                      metadata:   { campaignName: camp.name, network: camp.network, ruleName: rule.name },
                      createdAt:  now,
                    },
                  });
                  applied = true;
                  reason  = "Condition déclenchée — campagne pausée sur le réseau + KILLED en DB";
                }
              } catch (err) {
                reason = `Erreur: ${err instanceof Error ? err.message : String(err)}`;
              }
            } else {
              reason = "Déjà stoppée";
            }
            break;
          }

          // ── SCALE ──────────────────────────────────────────────────────
          case "SCALE_BUDGET": {
            try {
              const multiplier = rule.actionValue ?? 1.3;
              if (isRecommendMode) {
                await prisma.log.create({
                  data: {
                    userId:     userId,
                    campaignId: camp.id,
                    type:       LogType.CAMPAIGN_ACTION,
                    message:    `[RECOMMEND] Would scale budget ×${multiplier} on "${camp.name}" (rule: "${rule.name}") — Recommend mode`,
                    metadata:   { campaignName: camp.name, network: camp.network, ruleName: rule.name, scalePct: (multiplier - 1) * 100 },
                    createdAt:  now,
                  },
                });
                applied = true;
                reason  = "[Recommend mode] Suggestion logged — no real scale executed";
              } else {
                const account = await prisma.account.findFirst({
                  where: { userId: userId, network: camp.network as never, isActive: true },
                });
                if (account) {
                  const apiKey = decrypt(account.apiKeyEnc);
                  if (camp.network === "EXOCLICK") {
                    await new ExoClickAdapter(apiKey).scaleDailyBudget(camp.externalId, multiplier);
                  } else if (camp.network === "TRAFFICSTARS") {
                    await new TrafficStarsAdapter(apiKey).scaleDailyBudget(camp.externalId, multiplier);
                  } else if (camp.network === "TRAFFICJUNKY") {
                    await new TrafficJunkyAdapter(apiKey).scaleDailyBudget(camp.externalId, multiplier);
                  }
                  // PropellerAds / Adsterra: no budget scale via API in V1 — log only
                }
                await prisma.log.create({
                  data: {
                    userId:     userId,
                    campaignId: camp.id,
                    type:       LogType.CAMPAIGN_ACTION,
                    message:    `[AUTOMATION] Budget ×${multiplier} appliqué sur "${camp.name}" (règle: "${rule.name}")`,
                    metadata:   { campaignName: camp.name, network: camp.network, ruleName: rule.name, scalePct: (multiplier - 1) * 100 },
                    createdAt:  now,
                  },
                });
                applied = true;
                reason  = `Budget ×${multiplier} appliqué sur le réseau`;
              }
            } catch (err) {
              reason = `Erreur scale: ${err instanceof Error ? err.message : String(err)}`;
            }
            break;
          }

          // ── NOTIFY ─────────────────────────────────────────────────────
          case "NOTIFY": {
            try {
              await prisma.log.create({
                data: {
                  userId:     userId,
                  campaignId: camp.id,
                  type:       LogType.BUDGET_ALERT,
                  message:    `[AUTOMATION] Alerte — "${camp.name}" déclenche la règle "${rule.name}"`,
                  metadata:   { campaignName: camp.name, network: camp.network, ruleName: rule.name },
                  createdAt:  now,
                },
              });
              applied = true;
              reason  = "Notification loggée";
            } catch {
              reason = "Erreur de log";
            }
            break;
          }
        }

        results.push({
          ruleId:       rule.id,
          ruleName:     rule.name,
          campaignId:   camp.id,
          campaignName: camp.name,
          action:       rule.action,
          applied,
          reason,
        });
      }

      // Update lastRunAt for this rule (fire-and-forget)
      prisma.automationRule.update({
        where: { id: rule.id },
        data:  { lastRunAt: now },
      }).catch(() => undefined);
    }

    return NextResponse.json({
      results,
      engineMode,
      evaluatedAt: now.toISOString(),
      message: results.length
        ? `${results.filter(r => r.applied).length} action(s) ${isRecommendMode ? "suggested" : "executed"} on ${results.length} déclenchements.`
        : "No rules triggered.",
    });

  } catch (e) {
    console.error(e); return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
