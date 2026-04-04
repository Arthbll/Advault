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

interface AutomationRule {
  id:          string;
  name:        string;
  enabled:     boolean;
  condition:   string;
  threshold:   number;
  action:      string;
  actionValue: number | null;
  network:     string | null;
}

interface CampaignData {
  id:         string;
  externalId: string;
  name:       string;
  network:    string;
  spend:      number;
  revenue:    number;
  profit:     number;
  roi:        number;
  status:     string;
}

interface ActionResult {
  ruleId:      string;
  ruleName:    string;
  campaignId:  string;
  campaignName:string;
  action:      string;
  applied:     boolean;
  reason:      string;
}

function evaluateCondition(
  condition: string,
  threshold: number,
  campaign: CampaignData,
): boolean {
  switch (condition) {
    case "ROI_BELOW":      return campaign.roi    < threshold;
    case "ROI_ABOVE":      return campaign.roi    > threshold;
    case "SPEND_ABOVE":    return campaign.spend  > threshold;
    case "REVENUE_BELOW":  return campaign.revenue < threshold;
    case "CPC_ABOVE":      return false; // would need clicks data
    default:               return false;
  }
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // 1. Load enabled rules
    let rules: AutomationRule[] = [];
    try {
      rules = await prisma.$queryRaw<AutomationRule[]>`
        SELECT id, name, enabled, condition, threshold, action, "actionValue", network
        FROM "AutomationRule"
        WHERE "userId" = ${user.id} AND enabled = true
      `;
    } catch {
      // Table not yet created
      return NextResponse.json({ results: [], message: "Migration requise: /api/debug/migrate-automation" });
    }

    if (!rules.length) {
      return NextResponse.json({ results: [], message: "No active rules." });
    }

    // 2. Load active campaigns with stats
    const campaigns = await prisma.$queryRaw<CampaignData[]>`
      SELECT
        id, "externalId", name, network, spend, revenue, profit,
        CASE WHEN spend > 0 THEN (profit / spend) * 100 ELSE 0 END AS roi,
        status
      FROM "Campaign"
      WHERE "userId" = ${user.id}
        AND status IN ('ACTIVE', 'PAUSED')
        AND spend > 0
    `;

    const results: ActionResult[] = [];
    const now = new Date();

    // 3. Evaluate each rule against each matching campaign
    for (const rule of rules) {
      const eligible = campaigns.filter(c => {
        if (rule.network && c.network !== rule.network) return false;
        return evaluateCondition(rule.condition, Number(rule.threshold), {
          ...c,
          roi:     Number(c.roi),
          spend:   Number(c.spend),
          revenue: Number(c.revenue),
          profit:  Number(c.profit),
        });
      });

      for (const camp of eligible) {
        let applied = false;
        let reason  = "";

        switch (rule.action) {
          case "PAUSE_CAMPAIGN": {
            if (camp.status !== "PAUSED" && camp.status !== "KILLED") {
              try {
                // 1. Appel réseau réel — pause sur ExoClick / TrafficStars / TrafficJunky
                const account = await prisma.account.findFirst({
                  where: { userId: user.id, network: camp.network as never, isActive: true },
                });
                if (account) {
                  const apiKey = decrypt(account.apiKeyEnc);
                  if (camp.network === "EXOCLICK") {
                    await new ExoClickAdapter(apiKey).pauseCampaign(camp.externalId);
                  } else if (camp.network === "TRAFFICSTARS") {
                    await new TrafficStarsAdapter(apiKey).pauseCampaign(camp.externalId);
                  } else if (camp.network === "TRAFFICJUNKY") {
                    await new TrafficJunkyAdapter(apiKey).pauseCampaign(camp.externalId);
                  }
                }
                // 2. Mise à jour DB → KILLED (action automatique = définitif)
                await prisma.$executeRaw`
                  UPDATE "Campaign"
                  SET status = 'KILLED', "updatedAt" = ${now}
                  WHERE id = ${camp.id}
                `;
                // 3. Log
                await prisma.$executeRaw`
                  INSERT INTO "Log" ("id", "userId", "type", "message", "createdAt")
                  VALUES (
                    ${crypto.randomUUID()}, ${user.id}, 'KILL_SWITCH_TRIGGERED',
                    ${'[AUTOMATION] Campagne "' + camp.name + '" stoppée par la règle "' + rule.name + '" (réseau pausé)'},
                    ${now}
                  )
                `;
                applied = true;
                reason  = `Condition déclenchée — campagne pausée sur le réseau + KILLED en DB`;
              } catch (err) {
                reason = `Erreur: ${err instanceof Error ? err.message : String(err)}`;
              }
            } else {
              reason = "Déjà stoppée";
            }
            break;
          }

          case "SCALE_BUDGET": {
            try {
              const multiplier = rule.actionValue ?? 1.3;
              const account = await prisma.account.findFirst({
                where: { userId: user.id, network: camp.network as never, isActive: true },
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
              }
              await prisma.$executeRaw`
                INSERT INTO "Log" ("id", "userId", "type", "message", "createdAt")
                VALUES (
                  ${crypto.randomUUID()}, ${user.id}, 'CAMPAIGN_ACTION',
                  ${'[AUTOMATION] Budget x' + multiplier + ' appliqué sur "' + camp.name + '" (règle: "' + rule.name + '")'},
                  ${now}
                )
              `;
              applied = true;
              reason  = `Budget x${multiplier} appliqué sur le réseau`;
            } catch (err) {
              reason = `Erreur scale: ${err instanceof Error ? err.message : String(err)}`;
            }
            break;
          }

          case "NOTIFY": {
            try {
              await prisma.$executeRaw`
                INSERT INTO "Log" ("id", "userId", "type", "message", "createdAt")
                VALUES (
                  ${crypto.randomUUID()}, ${user.id}, 'BUDGET_ALERT',
                  ${'[AUTOMATION] Alerte — "' + camp.name + '" déclenche la règle "' + rule.name + '"'},
                  ${now}
                )
              `;
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

      // Update lastRunAt for this rule
      try {
        await prisma.$executeRaw`
          UPDATE "AutomationRule" SET "lastRunAt" = ${now}, "updatedAt" = ${now}
          WHERE id = ${rule.id}
        `;
      } catch { /* silent */ }
    }

    return NextResponse.json({
      results,
      evaluatedAt: now.toISOString(),
      message: results.length
        ? `${results.filter(r => r.applied).length} action(s) executed on ${results.length} déclenchements.`
        : "No rules triggered.",
    });

  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
