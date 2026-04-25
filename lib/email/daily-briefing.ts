import { getResendClient, getDefaultFromAddress } from "./resend-client";
import { buildRealBriefingData } from "./briefing-data";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type BriefingEvent = {
  kind: "kill" | "scale" | "flag";
  title: string; // ex: "2 campagnes tuées (kill)"
  detail: string; // ex: "ROI < -40% sur 3h — FR-Dating-push-01"
};

export type BriefingCampaignAttention = {
  name: string; // ex: "US-Dating-banner-premium"
  reason: string; // ex: "Postback silencieux 8h — ROI inconnu"
  roiPct: number | null; // null = inconnu
  spend: number; // en dollars
};

export type BriefingTopCreative = {
  fileName: string;
  campaignName: string;
  impressions: number;
  conversions: number;
  roiPct: number;
};

export type BriefingPerf = {
  spend: number;
  spendDelta: number; // absolu (dollars)
  spendDeltaPct: number; // pourcentage
  revenue: number;
  revenueDelta: number;
  revenueDeltaPct: number;
  roiPct: number;
  roiDeltaPts: number; // en points
};

export type BriefingData = {
  userFirstName: string;
  dateStr: string; // ex: "23 avril 2026"
  timezone: string; // ex: "Europe/Paris"
  events: BriefingEvent[];
  portfolio: { scaling: number; watching: number; needsAction: number };
  attention: BriefingCampaignAttention[];
  topCreative: BriefingTopCreative | null;
  perf: BriefingPerf;
  dashboardUrl: string;
};

// ─── HTML BUILDER ─────────────────────────────────────────────────────────────

/**
 * Génère le HTML du briefing quotidien (version Solo, FR, fond clair).
 *
 * Table-based + inline styles : c'est moche à écrire, mais c'est le seul format
 * qui rend proprement dans Gmail / Outlook / Apple Mail sans surprise.
 */
export function buildDailyBriefingHtml(data: BriefingData): string {
  const eventsHtml = data.events
    .map((e, idx) => renderEventRow(e, idx === data.events.length - 1))
    .join("");

  const attentionHtml = data.attention
    .map((c, idx) => renderAttentionRow(c, idx === data.attention.length - 1))
    .join("");

  const topCreativeHtml = data.topCreative
    ? renderTopCreativeCard(data.topCreative)
    : "";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>ProfitDash — Briefing du matin</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Inter,sans-serif;color:#0a0a0c;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f5f5f7;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border:1px solid rgba(0,0,0,0.08);border-radius:16px;padding:36px 28px;">

<!-- Logo -->
<tr><td style="padding-bottom:28px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="width:28px;height:28px;border-radius:8px;background:#0d0d10;color:#ffffff;font-weight:800;font-size:14px;text-align:center;vertical-align:middle;line-height:28px;">P</td>
<td style="padding-left:10px;font-weight:600;color:#0a0a0c;font-size:15px;">ProfitDash</td>
</tr>
</table>
</td></tr>

<!-- Greeting -->
<tr><td style="padding-bottom:28px;">
<div style="font-size:22px;font-weight:600;color:#0a0a0c;letter-spacing:-0.015em;margin-bottom:6px;">Bonjour ${escape(data.userFirstName)},</div>
<div style="color:rgba(0,0,0,0.60);font-size:13px;line-height:1.55;">Voici ce que le robot a fait pendant la nuit. Rien n'attend ton action — tout a été géré automatiquement.</div>
</td></tr>

<!-- Night summary -->
<tr><td style="font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(0,0,0,0.42);font-weight:600;padding-bottom:12px;">Ce qui s'est passé cette nuit</td></tr>
<tr><td style="padding-bottom:28px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fafafa;border:1px solid rgba(0,0,0,0.08);border-radius:14px;">
<tr><td style="padding:18px 22px;">
${eventsHtml}
</td></tr></table>
</td></tr>

<!-- Portfolio tiles -->
<tr><td style="font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(0,0,0,0.42);font-weight:600;padding-bottom:12px;">État du portefeuille ce matin</td></tr>
<tr><td style="padding-bottom:28px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
<tr>
<td width="33%" style="padding-right:5px;">${renderTile("En scaling", data.portfolio.scaling, "#16a34a")}</td>
<td width="33%" style="padding:0 5px;">${renderTile("À surveiller", data.portfolio.watching, "#d97706")}</td>
<td width="33%" style="padding-left:5px;">${renderTile("Action requise", data.portfolio.needsAction, "#dc2626")}</td>
</tr>
</table>
</td></tr>

<!-- Attention list -->
<tr><td style="font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(0,0,0,0.42);font-weight:600;padding-bottom:12px;">Campagnes à regarder aujourd'hui</td></tr>
<tr><td style="padding-bottom:28px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fafafa;border:1px solid rgba(0,0,0,0.08);border-radius:14px;">
<tr><td style="padding:18px 22px;">
${attentionHtml}
</td></tr></table>
</td></tr>

${
  topCreativeHtml
    ? `<tr><td style="font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(0,0,0,0.42);font-weight:600;padding-bottom:12px;">Top créatif de la nuit</td></tr>
<tr><td style="padding-bottom:28px;">${topCreativeHtml}</td></tr>`
    : ""
}

<!-- Perf grid -->
<tr><td style="font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(0,0,0,0.42);font-weight:600;padding-bottom:12px;">Hier vs avant-hier</td></tr>
<tr><td style="padding-bottom:28px;">
${renderPerfGrid(data.perf)}
</td></tr>

<!-- CTA -->
<tr><td align="center" style="padding:16px 0 24px;">
<a href="${escape(data.dashboardUrl)}" style="display:inline-block;background:#0d0d10;color:#ffffff;font-weight:600;font-size:14px;padding:13px 24px;border-radius:10px;text-decoration:none;">Ouvrir le dashboard</a>
</td></tr>

<!-- Footer -->
<tr><td style="border-top:1px solid rgba(0,0,0,0.08);padding-top:20px;font-size:11px;color:rgba(0,0,0,0.42);text-align:center;line-height:1.7;">
ProfitDash · Briefing envoyé automatiquement chaque matin.<br>
<a href="${escape(data.dashboardUrl)}/settings" style="color:rgba(0,0,0,0.60);text-decoration:none;">Gérer les préférences email</a> · <a href="${escape(data.dashboardUrl)}/settings" style="color:rgba(0,0,0,0.60);text-decoration:none;">Se désabonner</a><br>
Envoyé à 9:00 · ${escape(data.timezone)} · ${escape(data.dateStr)}
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ─── HTML HELPERS ─────────────────────────────────────────────────────────────

function renderEventRow(e: BriefingEvent, isLast: boolean): string {
  const colors = {
    kill: { bg: "rgba(220,38,38,0.12)", fg: "#dc2626", icon: "✕" },
    scale: { bg: "rgba(22,163,74,0.12)", fg: "#16a34a", icon: "▲" },
    flag: { bg: "rgba(217,119,6,0.12)", fg: "#d97706", icon: "!" },
  }[e.kind];

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
<tr>
<td width="34" valign="top" style="padding-top:4px;">
<div style="width:26px;height:26px;border-radius:8px;background:${colors.bg};color:${colors.fg};font-weight:700;font-size:13px;text-align:center;line-height:26px;">${colors.icon}</div>
</td>
<td style="padding-left:14px;font-size:13px;line-height:1.55;">
<div style="font-weight:600;color:#0a0a0c;">${escape(e.title)}</div>
<div style="color:rgba(0,0,0,0.60);font-size:12px;margin-top:3px;">${escape(e.detail)}</div>
</td>
</tr>
</table>${isLast ? "" : '<div style="border-top:1px solid rgba(0,0,0,0.08);margin:12px 0;"></div>'}`;
}

function renderTile(label: string, value: number, color: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fafafa;border:1px solid rgba(0,0,0,0.08);border-radius:12px;">
<tr><td style="padding:14px;">
<div style="font-size:11px;color:rgba(0,0,0,0.60);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">${escape(label)}</div>
<div style="font-size:24px;font-weight:600;color:${color};letter-spacing:-0.02em;">${value}</div>
</td></tr>
</table>`;
}

function renderAttentionRow(
  c: BriefingCampaignAttention,
  isLast: boolean,
): string {
  const roiStr =
    c.roiPct === null
      ? '<div style="font-size:14px;font-weight:600;color:rgba(0,0,0,0.42);font-style:italic;">—</div>'
      : `<div style="font-size:14px;font-weight:600;color:${c.roiPct >= 0 ? "#0a0a0c" : "#dc2626"};">${c.roiPct >= 0 ? "+" : ""}${c.roiPct}%</div>`;

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
<tr>
<td>
<div style="font-weight:500;font-size:13px;color:#0a0a0c;margin-bottom:3px;">${escape(c.name)}</div>
<div style="color:rgba(0,0,0,0.60);font-size:12px;">${escape(c.reason)}</div>
</td>
<td align="right" valign="top" style="white-space:nowrap;">
${roiStr}
<div style="color:rgba(0,0,0,0.60);font-size:12px;">dépense $${c.spend}</div>
</td>
</tr>
</table>${isLast ? "" : '<div style="border-top:1px solid rgba(0,0,0,0.08);margin:14px 0;"></div>'}`;
}

function renderTopCreativeCard(c: BriefingTopCreative): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fafafa;border:1px solid rgba(0,0,0,0.08);border-radius:14px;">
<tr><td style="padding:16px 18px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
<tr>
<td width="64" valign="middle">
<div style="width:52px;height:52px;border-radius:10px;background:linear-gradient(135deg,#16a34a,#2563eb);color:#ffffff;font-weight:700;font-size:22px;text-align:center;line-height:52px;">🎯</div>
</td>
<td valign="middle" style="padding-left:14px;">
<div style="font-weight:600;font-size:14px;color:#0a0a0c;margin-bottom:3px;">${escape(c.fileName)}</div>
<div style="color:rgba(0,0,0,0.60);font-size:12px;">${escape(c.campaignName)} · ${c.impressions.toLocaleString("fr-FR")} impressions · ${c.conversions} conversions</div>
</td>
<td valign="middle" align="right" style="white-space:nowrap;">
<div style="font-size:16px;font-weight:600;color:#16a34a;">+${c.roiPct}%</div>
<div style="font-size:11px;color:rgba(0,0,0,0.60);">ROI</div>
</td>
</tr>
</table>
</td></tr></table>`;
}

function renderPerfGrid(p: BriefingPerf): string {
  const spendDeltaColor = p.spendDelta >= 0 ? "#16a34a" : "#dc2626";
  const revDeltaColor = p.revenueDelta >= 0 ? "#16a34a" : "#dc2626";
  const roiColor = p.roiPct >= 0 ? "#16a34a" : "#dc2626";
  const roiDeltaColor = p.roiDeltaPts >= 0 ? "#16a34a" : "#dc2626";

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fafafa;border:1px solid rgba(0,0,0,0.08);border-radius:14px;">
<tr><td style="padding:20px 22px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
<tr>
<td width="33%">
<div style="font-size:11px;color:rgba(0,0,0,0.60);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Dépense</div>
<div style="font-size:18px;font-weight:600;color:#0a0a0c;letter-spacing:-0.01em;">$${p.spend.toLocaleString("en-US")}</div>
<div style="font-size:11px;color:${spendDeltaColor};margin-top:2px;">${p.spendDelta >= 0 ? "+" : ""}$${p.spendDelta} <span style="color:rgba(0,0,0,0.60);">(${p.spendDeltaPct >= 0 ? "+" : ""}${p.spendDeltaPct}%)</span></div>
</td>
<td width="33%">
<div style="font-size:11px;color:rgba(0,0,0,0.60);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Revenu</div>
<div style="font-size:18px;font-weight:600;color:#0a0a0c;letter-spacing:-0.01em;">$${p.revenue.toLocaleString("en-US")}</div>
<div style="font-size:11px;color:${revDeltaColor};margin-top:2px;">${p.revenueDelta >= 0 ? "+" : ""}$${p.revenueDelta} <span style="color:rgba(0,0,0,0.60);">(${p.revenueDeltaPct >= 0 ? "+" : ""}${p.revenueDeltaPct}%)</span></div>
</td>
<td width="33%">
<div style="font-size:11px;color:rgba(0,0,0,0.60);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">ROI</div>
<div style="font-size:18px;font-weight:600;color:${roiColor};letter-spacing:-0.01em;">${p.roiPct >= 0 ? "+" : ""}${p.roiPct}%</div>
<div style="font-size:11px;color:${roiDeltaColor};margin-top:2px;">${p.roiDeltaPts >= 0 ? "+" : ""}${p.roiDeltaPts}pts</div>
</td>
</tr>
</table>
</td></tr></table>`;
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── SAMPLE DATA (verticale Dating) ───────────────────────────────────────────

/**
 * Données bidon pour tester l'envoi.
 * Toutes les campagnes sont en verticale Dating — cohérent avec le
 * positionnement ProfitDash.
 */
export function getSampleBriefingData(firstName = "Arthur"): BriefingData {
  return {
    userFirstName: firstName,
    dateStr: new Date().toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    timezone: "Europe/Paris",
    events: [
      {
        kind: "kill",
        title: "2 campagnes tuées (kill)",
        detail:
          "ROI < -40% sur 3h consécutives — FR-Dating-push-01, IT-Dating-popunder-02",
      },
      {
        kind: "scale",
        title: "1 campagne scalée (+30% budget)",
        detail:
          "ROI stable > 60% pendant 6h sur DE-Dating-native-v3 — budget poussé de $50 à $65/jour",
      },
      {
        kind: "flag",
        title: "1 anomalie détectée",
        detail:
          "US-Dating-banner-premium : postback silencieux depuis 8h. Pas de kill — grace period active.",
      },
    ],
    portfolio: { scaling: 4, watching: 7, needsAction: 2 },
    attention: [
      {
        name: "US-Dating-banner-premium",
        reason: "Postback silencieux 8h — ROI inconnu",
        roiPct: null,
        spend: 67,
      },
      {
        name: "CA-Dating-push-night",
        reason: "ROI en chute (-12% cette nuit)",
        roiPct: -18,
        spend: 94,
      },
      {
        name: "UK-Dating-native-v2",
        reason: "Nouveau créatif en test — résultats mitigés",
        roiPct: 4,
        spend: 128,
      },
    ],
    topCreative: {
      fileName: "dating_de_native_04.jpg",
      campaignName: "DE-Dating-native-v3",
      impressions: 2847,
      conversions: 89,
      roiPct: 62,
    },
    perf: {
      spend: 1248,
      spendDelta: 82,
      spendDeltaPct: 7,
      revenue: 1824,
      revenueDelta: 194,
      revenueDeltaPct: 12,
      roiPct: 46,
      roiDeltaPts: 6,
    },
    dashboardUrl: "https://profitdash.app/dashboard",
  };
}

// ─── SEND ─────────────────────────────────────────────────────────────────────

export type SendResult = { id: string } | { error: string };

/**
 * Envoie un briefing de test (données bidon) à l'adresse donnée.
 * Utilisé pour valider la tuyauterie avant de brancher les vraies données.
 */
export async function sendTestDailyBriefing(
  toEmail: string,
  firstName = "Arthur",
): Promise<SendResult> {
  const data = getSampleBriefingData(firstName);
  const html = buildDailyBriefingHtml(data);

  try {
    const resend = getResendClient();
    const result = await resend.emails.send({
      from: getDefaultFromAddress(),
      to: toEmail,
      subject: `[TEST] ProfitDash — Briefing du matin · ${data.dateStr}`,
      html,
    });

    if (result.error) {
      return { error: String(result.error.message ?? result.error) };
    }

    return { id: result.data?.id ?? "unknown" };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Envoie le briefing quotidien à un user réel.
 *
 * Charge les données réelles depuis Prisma (campagnes, logs moteur, perf)
 * filtrées STRICTEMENT par userId — aucun mélange entre clients.
 */
export async function sendDailyBriefingSolo(
  userId: string,
  toEmail: string,
  firstName: string,
  timezone = "UTC",
): Promise<SendResult> {
  const data = await buildRealBriefingData({
    userId,
    firstName,
    timezone,
    dashboardUrl:
      process.env.NEXT_PUBLIC_SITE_URL ?? "https://profitdash.app",
  });
  const html = buildDailyBriefingHtml(data);

  try {
    const resend = getResendClient();
    const result = await resend.emails.send({
      from: getDefaultFromAddress(),
      to: toEmail,
      subject: `ProfitDash — Briefing du matin · ${data.dateStr}`,
      html,
    });

    if (result.error) {
      return { error: String(result.error.message ?? result.error) };
    }

    return { id: result.data?.id ?? "unknown" };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
