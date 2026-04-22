# PROJECT_CONTEXT_FOR_REVIEW.md
> Document de passation — ProfitDash / Advault  
> Basé sur le code réel + décisions produit actées  
> Dernière mise à jour : avril 2026

---

## 1. Vue d'ensemble produit

**Nom commercial :** ProfitDash  
**Nom du repo :** advault-project

**Ce que c'est :**  
SaaS B2B pour media buyers qui gèrent des campagnes publicitaires sur des réseaux CPA/CPM (ExoClick, TrafficStars, PropellerAds, Adsterra, TrafficJunky).

**Promesse principale :**  
Opérateur autonome 24/7. Le robot surveille les campagnes, applique les règles (kill / watch / scale) sans intervention humaine. Le dashboard est une fenêtre de lecture sur ce que le robot a fait — pas le moteur lui-même.

**Features et pages clés :**
- Performance (dashboard principal, KPIs, Decision Engine status)
- Execution / Campaigns (liste campagnes, actions manuelles, création)
- Campaign detail (stats individuelles, contrôle engine)
- Analytics / Statistics (trends 7D/30D/90D, breakdown réseau, P&L)
- Conversions / Transactions (postbacks reçus, revenu CPA)
- Rules / Decision Engine (configuration kill/watch/scale, presets, mode auto vs recommandation)
- Vault (assets, landing pages, routes)
- Settings (connexions réseau, kill-switch, workspace, équipe)
- Security (logs audit, MFA, sessions)
- Profile

**Ce qui est le plus important aujourd'hui :**  
Decision Engine opérationnel + postback tracking fiable. Sans ça, le produit n'a pas de valeur réelle.

---

## 2. Stack technique

| Composant | Choix |
|---|---|
| Framework | Next.js 15 (App Router, server + client components) |
| Auth | Supabase Auth (JWT, sessions, MFA TOTP natif) |
| Base de données | PostgreSQL (via Supabase) |
| ORM | Prisma (génération désactivée en sandbox — utilise `$queryRaw` / `$executeRaw` pour les nouvelles colonnes) |
| Hébergement | Vercel (App + Crons) |
| Services externes | Supabase (auth + DB), Vercel (hosting + cron jobs) |
| Intégrations | ExoClick, TrafficStars, TrafficJunky, PropellerAds, Adsterra |
| Styling | Inline styles uniquement — aucun Tailwind, aucune CSS class custom (sauf globals.css) |
| Animations | Framer Motion |
| Chiffrement | AES-256-GCM (clés API réseau) + HMAC-SHA256 (token postback) |
| Email | Non identifié dans le code (CLAUDE.md mentionne un daily briefing email — non trouvé) |
| Paiement | Endpoint `/api/plan/update` protégé par `PLAN_UPDATE_SECRET` → probablement webhook Stripe (non confirmé) |

---

## 3. État réel du produit

### ✅ Fonctionnel

- Authentification complète (login, register, forgot, reset, MFA TOTP, trusted device 30j, recovery codes)
- Decision Engine : kill / watch / scale avec cooldowns, hold times, max par jour
- Mode Automatic vs Recommendation
- Kill-Switch d'urgence (manuel + cron Vercel)
- Postback tracking universel (`/api/track`) avec déduplication atomique
- Sync campagnes depuis 5 réseaux publicitaires
- Actions manuelles sur campagnes (pause / resume / kill / scale / archive)
- Logs d'audit complets (DECISION_KILL, DECISION_WATCH, DECISION_SCALE, SECURITY_EVENT, etc.)
- Team management : invitations, rôles editor/viewer, isolation workspace
- Plan-gating sur routes team (Command plan requis)
- Anti-partage de credentials (session nonces, max 3 appareils simultanés)
- Détection nouvelle IP à la connexion
- Chiffrement AES-256-GCM des clés API réseau
- "Sign out all devices" (révocation globale sessions)
- Settings : timezone, currency, kill-switch thresholds
- Vault (assets)
- Conversions paginées avec breakdown par source

### ⚠️ Partiellement fonctionnel

- **Revenue dans le Decision Engine** : combine Campaign.revenue (sync réseau) + Conversion.revenue (postbacks). Si le réseau ne remonte pas le revenu (modèle CPA pur), le ROI sera faux tant que le postback n'est pas configuré. Pas de warning explicite à l'utilisateur.
- **Geo breakdown** (`/api/dashboard/geo`) : route existe, contenu non exploré en détail.
- **Voluum / BeMob** : dans l'enum `Network` du schema Prisma mais aucun adapter implémenté. Probablement trackers-only (conversions via postback uniquement, pas de sync campagne).
- **Emergency stop** (`/api/engine/emergency-stop`) : route existe, probablement met à jour `UserSettings.enginePausedUntil`, non confirmé.
- **Daily briefing email** : mentionné dans CLAUDE.md comme fonctionnalité souhaitée, non trouvé dans le codebase.

### 🔴 Fragile / incomplet

- **Rate limit postback** : in-process (`Map` en mémoire Node.js). Sur Vercel avec plusieurs instances simultanées, la limite effective est `500 × nombre d'instances`, pas 500 global. Pas de Redis ou store partagé.
- **Session ExoClick** : cache module-level partagé entre instances. Sur longue durée avec beaucoup d'utilisateurs, peut fuiter mémoire.
- **Hold time Decision Engine** : la condition doit persister N minutes avant action. La vérification s'appuie sur timestamps des logs — si les logs sont absents ou corrompus, le hold time peut ne pas fonctionner correctement.
- **engineMode global** : un seul mode (auto / recommendation) par utilisateur. Impossible de mettre une campagne en auto et une autre en recommendation. Plusieurs utilisateurs ont demandé un contrôle par campagne.
- **Prisma types** : les nouvelles colonnes ajoutées après la dernière génération (`timezone`, `currency`, `lastLoginIp`) nécessitent `$queryRaw` / `$executeRaw` car `prisma generate` ne peut pas tourner en sandbox sans téléchargement binaire.

### 🚫 Hors scope V1 (décision actée)

- Mobile responsive complet (structure de base posée, redesign mobile-first reporté)
- Application native (non prévu)
- Intégration Voluum / BeMob comme source de sync campagnes
- Per-campaign engine mode override
- Rate limiting postback distribué (Redis)

---

## 4. Pages principales et rôle

### Performance (`/dashboard`)
**Rôle :** Vue centrale. KPIs (spend, revenue, profit, ROI, impressions), Decision Engine live feed, alertes campagnes, top campagnes P&L, chart revenue/profit 30j, breakdown réseau, world map geo.  
**État :** Fonctionnel. Données combinées Campaign table + Conversion table.  
**Faiblesses :** Bento grid non adapté mobile. Si aucun postback configuré, revenue = 0 et ROI négatif systématique.

### Execution / Campaigns (`/dashboard/campaigns`)
**Rôle :** Liste de toutes les campagnes avec statut, spend, ROI, actions manuelles (kill, scale, pause). Création de campagne (wizard 8 étapes).  
**État :** Fonctionnel.  
**Faiblesses :** Tableau scrollable horizontal sur mobile (workaround en place, pas idéal).

### Campaign detail (`/dashboard/campaigns/[id]`)
**Rôle :** Détail d'une campagne individuelle : stats, historique des actions engine, contrôle engine-control.  
**État :** Route existe. Contenu complet non exploré.  
**Faiblesses :** Non vérifié en détail.

### Analytics / Statistics (`/dashboard/statistics`)
**Rôle :** Trends temporels (spend, revenue, profit), breakdown réseau, P&L par campagne. Presets : Today, 7D, 30D, Month, 90D.  
**État :** Fonctionnel (client component avec fetch).  
**Faiblesses :** Données uniquement depuis Campaign table (sync réseau) — pas de fusion Conversion table ici.

### Conversions (`/dashboard/conversions`)
**Rôle :** Historique des postbacks reçus. Revenu CPA total, count, breakdown par source (CrakRevenue, MaxBounty, etc.). Pagination.  
**État :** Fonctionnel.  
**Faiblesses :** Aucune liaison visuelle campagne↔postback si `campaignId` absent du postback.

### Decision Engine / Rules (`/dashboard/rules`)
**Rôle :** Configuration du moteur. Presets (soft / balanced / aggressive / custom), seuils ROI, cooldowns, max actions/jour. Toggle Automatic vs Recommendation. Historique des 30 dernières actions engine.  
**État :** Fonctionnel.  
**Faiblesses :** Mode global (pas per-campagne). Si pas de revenus postback, tous les ROI sont négatifs → engine tue tout.

### Vault (`/dashboard/vault`)
**Rôle :** Inventaire des assets (landing pages, routes, offres).  
**État :** Fonctionnel (basique). Routes `/api/vault` et `/api/vault/inject` présentes.  
**Faiblesses :** Feature secondaire, peu documentée.

### Settings (`/dashboard/settings`)
**Rôle :** 4 tabs — Connexions réseau, Kill-Switch, Workspace (timezone/currency), Team (Command plan uniquement).  
**État :** Fonctionnel.  
**Faiblesses :** Tab Workspace nouvellement ajoutée — les colonnes `timezone`/`currency` en DB utilisent `$queryRaw` (pas les types Prisma générés).

### Security (`/dashboard/settings` → onglet sécurité ou page dédiée)
**Rôle :** Logs d'audit (sync, actions, MFA events, sign-in avec IP), MFA setup/disable, trusted devices, recovery codes, "sign out all devices".  
**État :** Fonctionnel.  
**Faiblesses :** Non vérifié : recovery codes (modèle en place, flow complet non confirmé).

### Onboarding
**État :** L'ancien composant `GettingStarted` a été supprimé. Pas de remplacement prévu pour V1. Un utilisateur qui s'inscrit arrive directement sur le dashboard.

---

## 5. Decision Engine

### Ce qu'il fait
Moteur autonome qui tourne toutes les N minutes (cron Vercel). Pour chaque campagne active d'un utilisateur, il calcule le ROI sur 24h glissantes et applique une des trois actions :

| Action | Condition | Conséquence |
|---|---|---|
| **KILL** | ROI < seuil kill (défaut -30%) | Pause la campagne via API réseau + status KILLED en DB |
| **WATCH** | ROI entre seuil watch_low (-15%) et watch_high (0%) | Signal seulement, aucune action réseau |
| **SCALE** | ROI ≥ seuil scale (défaut 30%) ET spend ≥ minSpend ET conversions ≥ minConversions | Augmente le bid (défaut +10%) via API réseau |

### Recommend vs Automatic
Défini dans `DecisionRule.engineMode` (1 seul choix par utilisateur, global) :
- **Automatic** : actions réelles sur les API réseaux
- **Recommendation** : logs uniquement, message préfixé `[RECOMMEND]`, aucun appel API réseau

### Problème du ROI sans revenu
Si l'utilisateur n'a pas configuré de postback (ou que le réseau ne remonte pas de revenu), `Campaign.revenue = 0` systématiquement. ROI = -100%. Le moteur va tuer toutes les campagnes.  
**Pas de garde-fou explicite dans le code actuellement.** Direction envisagée : mode Spend Only.

### Spend Only / Budget Protection
`UserSettings.spendOnlyMode` existe en DB. Quand activé : l'engine ignore le ROI et kill uniquement sur budget (`maxSpendPerCampaign`). Protège les utilisateurs qui n'ont pas de postback configuré.  
**État : champ en DB, logique présente dans kill-switch, pas de UI claire dédiée.**

### Sécurités intégrées
- **Cooldown par campagne** : killCooldownH (défaut 6h), scaleCooldownH (défaut 6h) → évite les oscillations
- **Hold time** : condition doit persister killHoldMin (30min) ou scaleHoldMin (60min) avant action
- **Max par jour** : maxKillsDay (5), maxScalesDay (2)
- **enginePausedUntil** : suspend toute l'automation jusqu'à une date (emergency stop)
- **excludeFromEngine** : flag par campagne pour exclure du moteur (mode manuel)

### Presets disponibles (en DB)
| Preset | killRoi | watchLow | scaleRoi | scaleInc | killHold | scaleHold |
|---|---|---|---|---|---|---|
| soft | -35% | -20% | 35% | 5% | 45min | 90min |
| balanced | -30% | -15% | 30% | 10% | 30min | 60min |
| aggressive | -20% | -10% | 20% | 20% | 25min | 45min |

### Ce qui reste flou
- L'intervalle exact du cron Vercel (défini dans `vercel.json`, non exploré)
- La logique de hold time côté code (s'appuie sur timestamps des logs — non confirmé robuste)
- Pas de per-campaign mode override (demande fréquente, non prévu V1)

---

## 6. Tracking / postbacks / transactions

### Comment le revenu arrive
```
CPA Network (CrakRevenue, MaxBounty, etc.)
  → GET /api/track?uid={userId}&token={hmac}&cid={campaignId}&clickid={clickId}&rev={revenue}&src={source}
  → Validation token → validation revenu → dédup → rate limit → insertion DB
```

### Rôle du postback
Endpoint universel — compatible avec n'importe quel réseau CPA. L'URL complète est générée dans Settings (`/api/postback-token`) et à copier-coller dans le panel du réseau CPA.

### Rôle du clickId
Identifiant unique de clic généré par le réseau publicitaire. Transmis dans l'URL de la landing page, récupéré à la conversion. Sert à :
1. Déduplication atomique (contrainte UNIQUE en DB)
2. Lier la conversion à la campagne source

### Logique de déduplication
- **Avec clickId** : contrainte `UNIQUE(clickId)` PostgreSQL. Race condition safe. Si doublon : `200 OK { duplicate: true }`. Ordre intentionnel : dédup *avant* rate limit (une conversion légitime ne doit jamais être droppée par un burst de doublons).
- **Sans clickId** : PostgreSQL `NULL ≠ NULL` → plusieurs nulls autorisés. Pas de dédup possible. Conversion acceptée avec flag `{ noClickId: true }`.

### Authentification du postback
Token = `HMAC-SHA256(userId, ENCRYPTION_KEY)` tronqué à 32 chars. Déterministe, recalculable à la volée (pas stocké en DB). Vérification en temps constant (protection timing attack).

### Rate limit actuel
- Seuil : 500 postbacks/min par token
- Comportement : `200 OK { limited: true }` — silencieux, jamais de 429
- Log DB : `LogType.POSTBACK_OVERAGE` pour monitoring
- **Risque** : in-process uniquement (Map Node.js). Sur plusieurs instances Vercel : limite effective = 500 × N instances.

### Stratégie actuelle : simple et gratuit
Pas de Redis, pas de store partagé. Fonctionne correctement pour un volume normal (< quelques milliers/min). Au-delà, il faudra un rate limiter distribué.

---

## 7. Sécurité

| Élément | État |
|---|---|
| **API keys réseau** | Chiffrées AES-256-GCM en DB (`apiKeyEnc`, `apiSecretEnc`). IV aléatoire par encryption. Tag d'authentification 16 bytes (protection contre altération). |
| **2FA / MFA** | TOTP via Supabase (facteurs enrollés, challenge/verify). UI complète (enroll, disable, verify). |
| **Trusted device** | Cookie httpOnly 30j signé JWT (`__profitdash-trusted-device`). Bypass MFA si device connu. |
| **Recovery codes** | Modèle en DB (`RecoveryCode.codeHash` SHA-256, `usedAt`). Flow complet non confirmé. |
| **Session nonces** | Max 3 appareils simultanés. Nonce FIFO dans `user_metadata.session_nonces`. 4ème login = éviction du plus ancien. Contrôle en proxy (middleware). |
| **Logs sécurité** | `SECURITY_EVENT` : sign-in, new IP login, MFA enable/disable. Visible dans dashboard Settings > Security. |
| **Sign out all devices** | `POST /api/auth/sign-out-all` → révocation globale via Supabase admin API. |
| **Multi-tenancy** | Tous les queries filtrés par `userId`. Cascade delete sur Account, Campaign, Log, Conversion. |
| **Postback token** | HMAC-SHA256, vérification constant-time. |
| **Plan update** | Protégé par `PLAN_UPDATE_SECRET` (header auth côté serveur). |

**Points à améliorer :**
- Rate limit postback distribué (actuellement in-process)
- Recovery codes : flow à vérifier de bout en bout
- Pas d'audit log sur qui a modifié les règles du Decision Engine

---

## 8. Pricing

### Plans actuels (définis dans le code)
| Plan | Accès |
|---|---|
| **Observer** | Read-only présumé (logique exacte non explorée) |
| **Operator** | Accès complet pour 1 utilisateur, sans team |
| **Dominion** | Intermédiaire (logique exacte non explorée) |
| **Command** | Accès complet + features team (invitations, membres, workspace partagé) |

**Stockage :** `user_metadata.plan` (Supabase). Mis à jour via `POST /api/plan/update` (PLAN_UPDATE_SECRET — probablement webhook Stripe, non confirmé).

### Logique de gating actuelle
- Routes team (`/api/team/*`) : plan Command requis, sinon 403
- Features UI team : visibles uniquement si Command
- Rôles team (editor/viewer) : visibles uniquement en Command

### Direction future si tracking natif
Non décidé. Si ProfitDash intègre son propre tracking (clickId natif, stats réelles), ça change la proposition de valeur — et potentiellement le pricing (actuellement tracker-agnostique).

### Questions ouvertes
- Observer vs Operator : différence de fonctionnalités exacte non documentée dans le code
- Dominion : différence avec Operator non claire
- Pas de page pricing dans le codebase (présumé landing page ou Stripe checkout externe)

---

## 9. Onboarding

### Logique actuelle
L'ancien composant `GettingStarted` (3 étapes : connecter réseau / créer campagne / explorer stats) a été supprimé. Il n'y a plus d'onboarding dans la V1. Un utilisateur qui s'inscrit arrive directement sur le dashboard.

### Étapes critiques pour qu'un utilisateur soit opérationnel
1. Connecter au moins 1 compte réseau publicitaire (Settings > Connexions) — obligatoire
2. Lancer une première sync (manuel ou attendre le cron) — obligatoire
3. Configurer le postback URL dans son réseau CPA — critique pour le ROI
4. Choisir un preset Decision Engine (soft / balanced / aggressive) — recommandé
5. Définir le mode (Automatic vs Recommendation) — recommandé avant d'activer en auto

### Obligatoire vs optionnel
- Sans réseau connecté : dashboard vide, aucun moteur actif
- Sans postback : revenue = 0, ROI négatif systématique → moteur tue tout
- Sans règles configurées : défauts appliqués (preset balanced, mode automatic)

### Ce qui ne doit pas être dans la V1
- Wizard multi-étapes complexe
- Intégration forcée d'un tracker externe
- Vidéos / tutoriels inline

### Place du Decision Engine dans l'onboarding
Le moteur tourne dès que `killSwitchEnabled = true` dans UserSettings. Il faut que l'utilisateur comprenne le mode Recommendation avant d'activer le mode Automatic — risque de kill massif si les données de revenu sont absentes.  
**Recommandation non implémentée :** forcer le mode Recommendation par défaut à l'inscription, avec prompt explicite pour passer en Automatic.

---

## 10. Bugs / risques / sujets ouverts

### Bugs critiques connus
- **ROI faux sans postback** : si revenue = 0, ROI = -100% → engine kill tout en mode Automatic. Pas de garde-fou.
- **Rate limit non distribué** : sur plusieurs instances Vercel, la limite postback est × N instances.

### Choix techniques non tranchés
- **Prisma generate** : impossible en sandbox. Les nouvelles colonnes (`timezone`, `currency`, `lastLoginIp`) utilisent `$queryRaw` / `$executeRaw`. À régulariser en prod avec un vrai `prisma generate`.
- **Hold time engine** : s'appuie sur timestamps des logs. Si log absent ou mal formé, la condition hold time peut ne pas s'appliquer. À vérifier.
- **ExoClick session cache** : module-level. Sur longue durée avec beaucoup d'utilisateurs, peut fuiter mémoire. Pas de TTL explicite hors des appels 401.

### Débats produit ouverts
- **Per-campaign engine mode** : mode global (auto/recommendation) par utilisateur. Plusieurs usecase nécessitent un contrôle par campagne. Non prévu V1.
- **Spend Only mode** : champ en DB (`spendOnlyMode`), logique kill-switch présente, mais pas d'UI claire dédiée. À finaliser ou à afficher clairement.
- **Voluum / BeMob** : dans l'enum Network mais sans adapter. Utilité actuelle : uniquement via postback. À clarifier dans l'UI (ne pas proposer "connecter Voluum" comme un réseau publicitaire).
- **Tracking natif vs tracker externe** : ProfitDash dépend actuellement du clickId généré par le réseau publicitaire. Un tracking natif (propre clickId) changerait l'architecture de fond.
- **Daily briefing email** : mentionné dans CLAUDE.md, non implémenté.

### Dépendances importantes
- Vercel Pro (cron jobs, `maxDuration: 300s`) — Hobby plan = 10s max, pas viable pour le kill-switch
- Supabase (auth + DB) — single point of failure potentiel
- API réseaux publicitaires : pas de webhooks entrants, uniquement polling (sync manuelle ou cron)

---

## 11. Priorités actuelles

### À corriger maintenant
1. **Mode Spend Only visible dans l'UI** — sans ça, les utilisateurs sans postback configuré risquent un kill massif
2. **Warning explicite** si revenue = 0 et mode Automatic activé
3. **Prisma generate** en prod — aligner les types générés avec les colonnes réelles en DB
4. **Vérifier le flow recovery codes** de bout en bout

### À construire ensuite
1. **Onboarding minimal** : au moins une page post-inscription qui explique les 3 étapes critiques (réseau → postback → mode engine)
2. **Daily briefing email** (si dans le scope)
3. **Rate limit postback distribué** (Redis ou Upstash) — à partir d'un certain volume

### Ce qui peut attendre
- Mobile redesign complet (structure responsive de base en place)
- Per-campaign engine mode override
- Voluum / BeMob adapters complets
- Tracking natif (clickId ProfitDash)
- Geo analytics détaillées

---

## 12. Glossaire rapide

| Terme | Définition |
|---|---|
| **Postback** | Requête HTTP envoyée par un réseau CPA vers ProfitDash quand une conversion se produit. Contient le revenu, le clickId, la source. |
| **clickId** | Identifiant unique de clic généré par le réseau publicitaire. Transmis dans l'URL de la landing page, renvoyé dans le postback. Sert à la déduplication et à la liaison campagne↔conversion. |
| **ROI** | (Revenue − Spend) / Spend × 100. Exprimé en %. Négatif si perte, positif si profit. |
| **Spend Only** | Mode du Kill-Switch qui ignore le ROI et kill uniquement quand le budget max par campagne est dépassé. Utile sans postback configuré. |
| **Recommend** | Mode du Decision Engine : analyse les campagnes et logue les recommandations, mais n'appelle aucune API réseau. Aucune action réelle. |
| **Automatic** | Mode du Decision Engine : appelle les API réseaux pour vraiment pauser ou scaler les campagnes. |
| **Tracker externe** | Outil tiers (Voluum, BeMob, Bemob, RedTrack...) qui gère le tracking des clics et conversions. ProfitDash reçoit le revenu via postback depuis ces trackers. |
| **Tracking natif** | Tracking géré directement par ProfitDash (clickId propre, redirect, postback interne). Non implémenté. |
| **Preset** | Configuration prédéfinie des seuils du Decision Engine (soft / balanced / aggressive / custom). |
| **Hold time** | Durée pendant laquelle une condition (ROI < seuil) doit persister avant que le moteur agisse. Évite les actions sur des fluctuations temporaires. |
| **Cooldown** | Délai minimum entre deux actions engine sur la même campagne. Évite les oscillations kill/resume/kill. |
| **Command plan** | Plan SaaS qui donne accès aux features team (invitations, membres, workspace partagé). |
| **Workspace** | Périmètre de données d'un utilisateur. En team, les membres voient les données du owner (via `resolveWorkspaceUserId`). |
| **Nonce de session** | UUID unique généré à chaque login, stocké dans `user_metadata.session_nonces` (max 3). Permet de limiter les sessions simultanées et de détecter le partage de credentials. |

---

## 13. Résumé final ultra court

> **Ce qu'un reviewer externe doit comprendre en 30 secondes**

ProfitDash est un robot de gestion de campagnes pub. Il surveille ExoClick, TrafficStars, PropellerAds, Adsterra et TrafficJunky, et kill/scale automatiquement selon des seuils ROI. Le revenue vient des postbacks CPA (uniquement si bien configuré — sinon le robot croit que tout perd de l'argent et tue tout). Le code est mature : 38 endpoints API, 5 adapters réseau, auth MFA complète, team management, chiffrement des clés. La base tient. Les deux points critiques avant mise en prod réelle : (1) protéger les utilisateurs qui n'ont pas de postback configuré (Spend Only visible + warning), (2) vérifier que le cron Vercel tourne sur un plan Pro (maxDuration 300s requis).
