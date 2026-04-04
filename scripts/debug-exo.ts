/**
 * Script de debug : récupère une vraie campagne ExoClick pour voir sa structure exacte.
 * Lance avec : npx tsx scripts/debug-exo.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";

// Charge les variables d'environnement depuis .env
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const BASE = "https://api.exoclick.com/v2";
const EXOCLICK_KEY = process.env.EXOCLICK_API_KEY_DEBUG;

// ── Si pas de clé dans .env, on la demande en argument ───────────────────────
const apiKey = EXOCLICK_KEY ?? process.argv[2];
if (!apiKey) {
  console.error("\n❌ Clé API manquante.");
  console.error("   Lance : npx tsx scripts/debug-exo.ts TA_CLE_API_EXOCLICK\n");
  process.exit(1);
}

const CF_HEADERS: Record<string, string> = {
  "User-Agent":      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
  "Accept":          "application/json",
  "Content-Type":    "application/json",
  "Origin":          "https://www.exoclick.com",
  "Referer":         "https://www.exoclick.com/",
};

async function login(): Promise<string> {
  console.log("\n🔐 Connexion à ExoClick...");
  const res = await fetch(`${BASE}/login`, {
    method: "POST",
    headers: CF_HEADERS,
    body: JSON.stringify({ api_token: apiKey }),
  });
  const json = await res.json() as Record<string, unknown>;
  const token = (json.token ?? json.access_token) as string;
  if (!token) throw new Error("Login échoué : " + JSON.stringify(json));
  console.log("✅ Connecté !");
  return token;
}

async function apiFetch(token: string, path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { ...CF_HEADERS, Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
  return JSON.parse(text);
}

async function main() {
  const token = await login();

  // 1. Liste des campagnes
  console.log("\n📋 Récupération de la liste des campagnes...");
  const listData = await apiFetch(token, "/campaigns") as Record<string, unknown>;
  const rawList = listData?.result ?? listData;
  const campaigns = Array.isArray(rawList)
    ? rawList as Record<string, unknown>[]
    : Object.values(rawList as Record<string, unknown>) as Record<string, unknown>[];

  if (campaigns.length === 0) {
    console.log("❌ Aucune campagne trouvée.");
    return;
  }

  console.log(`\n✅ ${campaigns.length} campagne(s) trouvée(s) :`);
  campaigns.slice(0, 5).forEach((c, i) => {
    console.log(`  ${i + 1}. [${c.id}] ${c.name} — status: ${c.status}`);
  });

  // 2. Détail complet de la première campagne
  const firstId = String(campaigns[0].id);
  console.log(`\n🔍 Structure complète de la campagne [${firstId}] :`);
  const detail = await apiFetch(token, `/campaigns/${firstId}`);
  console.log(JSON.stringify(detail, null, 2));

  // 3. Résumé des champs importants
  console.log("\n\n═══════════════════════════════════════════════");
  console.log("📌 CHAMPS CLÉS À COPIER POUR LA CRÉATION :");
  console.log("═══════════════════════════════════════════════");
  const d = (detail as Record<string, unknown>)?.result ?? detail;
  const r = d as Record<string, unknown>;
  [
    "countries", "devices", "device_types", "categories",
    "prices", "price", "pricing_model", "bid",
    "media_storage_template", "advertiser_ad_type",
    "status", "landing_url", "name",
  ].forEach(key => {
    if (r[key] !== undefined) {
      console.log(`  "${key}": ${JSON.stringify(r[key])}`);
    }
  });
  console.log("═══════════════════════════════════════════════\n");
}

main().catch(err => {
  console.error("\n❌ Erreur :", err.message);
  process.exit(1);
});
