# ProfitDash — Résumé de session

*Bilan de ce qu'on a fait ensemble, ce qui a été appliqué, et ce qui reste à faire.*

---

## Le contexte

ProfitDash est un SaaS B2B pour les media buyers CPA/CPM. Le produit central, c'est un **robot autonome 24/7** qui surveille les campagnes publicitaires du client, applique ses règles, et agit (tue / scale / pause) automatiquement via les APIs des régies — ou flaggue les actions en mode recommandation.

On a bossé sur trois grandes phases :

1. **Robustesse du moteur de décision (kill-switch)**
2. **Infrastructure postback (la tuyauterie qui reçoit les conversions)**
3. **Email quotidien du robot (le feature principal en cours)**

---

## Phase 1 — Moteur de décision (kill-switch)

### Ce qu'on a fait

| Élément | Statut | Explication en clair |
|---|---|---|
| Grace period 48h dans `kill-switch.ts` | Appliqué | Quand le postback d'une campagne est silencieux, on ne tue pas immédiatement — on attend 48h parce que le postback peut juste être cassé temporairement. C'est comme attendre avant de déclarer un site "en panne" si le ping revient pas tout de suite. |
| Downgrade auto vers Recommend | Appliqué | Si une campagne en mode auto commence à faire n'importe quoi (données bizarres), on la repasse automatiquement en mode "Recommandation" pour protéger le client. |
| Nouveaux `LogType` : `KILL_BLOCKED_NO_DATA`, `SAFETY_DOWNGRADE` | Appliqué | On log chaque fois que le robot a été empêché d'agir faute de données, ou qu'une campagne a été downgrade automatiquement. Comme le carnet de bord d'un pilote. |
| Vérification comportement en conditions réelles | Appliqué | On s'est assuré que tout ça marche sur des campagnes actives, pas juste en laboratoire. |

---

## Phase 2 — Infrastructure postback

### Ce qu'on a fait

| Élément | Statut | Explication en clair |
|---|---|---|
| Endpoint `/api/postback/test` | Appliqué | Une porte d'entrée qui permet au client de simuler un postback pour tester que sa config est bonne. |
| Endpoint `/api/postback/status` | Appliqué | Une porte d'entrée qui dit "est-ce que le postback de cette campagne reçoit bien des événements ?" — utilisé par le robot pour décider de la grace period. |
| Intégration de la bannière dans `layout.tsx` dashboard | Appliqué | La bannière d'alerte (paiement, postback HS, etc.) est maintenant visible partout dans le dashboard, pas juste sur une seule page. |
| Vérification impact TypeScript sur build Vercel | Appliqué | On a vérifié que les types TypeScript existants ne cassent pas le déploiement Vercel. |
| Tri des 71 fichiers non committés + commandes de push | Appliqué | On a nettoyé les fichiers qui traînaient en local et on t'a fourni les commandes pour pousser le tout propre sur GitHub. |

---

## Phase 3 — Email quotidien (en cours)

### Ce qu'on a fait

**Décisions produit tranchées**

| Décision | Choix |
|---|---|
| Provider email | Resend |
| Format | Bilingue FR/EN dès le départ |
| Langue du mail | Dépend du setting user |
| Heure d'envoi | 9h dans le fuseau de l'user (via cron Vercel UTC + `UserSettings.timezone`) |
| Fond du mail | Light (#f5f5f7) — pour éviter l'inversion auto de Gmail |
| Max d'événements détaillés par mail | 5 lignes max, puis "Tout voir →" |
| Section "Top créatif de la nuit" | Incluse |
| "Kill" vs "Pause" | Distinction faite : Kill = tue la campagne, Pause = temporaire |
| 2 tiers utilisateurs | Solo et Pro (pas 3) |
| Détection du tier | Question à l'onboarding + auto-ajustement |
| Telegram pour les Pros | 1 chat par workspace (= 1 chat par client pour les agences) |
| Grace period paiement | 7 jours avant suspension |
| Robot à la suspension | Désactivé totalement |

**Mockups créés**

| Mockup | Fichier | Statut |
|---|---|---|
| Page interactive du mail quotidien Solo (6 variantes : 2 langues × 3 modes + toggle normal/busy) | `mockups/daily-email-preview.html` | Prêt |
| Email HTML propre envoyé dans ta boîte Gmail (version light) | `mockups/email-sample-fr-auto.html` + draft Gmail | Envoyé |
| Page interactive du mail quotidien Pro (ton formel, vue par client, KPIs consolidés) | `mockups/daily-email-pro-preview.html` | Prêt |
| Galerie complète des 19 emails ProfitDash (transactionnels, billing, opérationnels, engagement) | `mockups/emails-gallery.html` | Prêt |

---

## Ce qui est prêt à passer au code

Ces décisions sont prises, ces mockups sont validés : on peut les coder dès que tu décides.

### Audit de l'existant (22 avril)

| Élément | État actuel |
|---|---|
| Package `resend` installé | Non |
| `vercel.json` avec crons | Oui — un seul cron (`/api/kill-switch/run`, toutes les minutes) |
| `UserSettings.timezone` | Existe (default `"UTC"`) ✅ |
| `User.tier` | N'existe pas — à ajouter |
| `User.lastDailyBriefingSentAt` | N'existe pas — à ajouter |
| Modèle `Workspace` dédié | N'existe pas (système `TeamMember` à la place) — donc `tier` ira sur `User` pour commencer |
| Auth | Supabase Auth |
| Env vars email (`RESEND_API_KEY`, `EMAIL_FROM`) | Absents — à ajouter |
| Code email existant | Aucun |

### Infrastructure email — plan d'exécution

**Marche 1 — Migration Prisma** : ajouter `tier: 'solo' \| 'pro'` (default `'solo'`) et `lastDailyBriefingSentAt: DateTime?` sur le modèle `User`.
**Marche 2 — Installer Resend** : `npm install resend`, créer un compte Resend, ajouter `RESEND_API_KEY` et `EMAIL_FROM` aux env vars Vercel.
**Marche 3 — Fonction `sendDailyBriefingSolo(userId)`** dans `lib/email/daily-briefing.ts` : récupère les données, génère le HTML du mockup light, envoie via Resend.
**Marche 4 — Route cron** `/api/cron/daily-briefing/run` calquée sur le pattern `kill-switch` (même auth `CRON_SECRET`). Toutes les 15 min, itère sur les users, calcule s'il est 9h chez eux via `UserSettings.timezone`, envoie + marque `lastDailyBriefingSentAt`.
**Marche 5 — Test E2E** : déclenchement manuel sur le user d'Arthur, réception effective dans sa boîte Gmail, validation.

### Différenciation Solo / Pro (après Marche 5)

- **Ajouter une étape onboarding** : "Tu es plutôt solo ou équipe/agence ?" avec 2 cartes
- **Créer un job hebdomadaire** qui recalcule automatiquement le tier à partir du spend réel (auto-ajustement)
- **Créer `buildProEmail()`** : variante Pro du générateur de mail

### Cycle de vie paiement (d'après les règles du CLAUDE.md)

- **Webhook Stripe `invoice.payment_failed`** → déclenche le mail J0
- **Cron quotidien** qui vérifie les paiements `past_due` et envoie les rappels J+3, J+5
- **Webhook Stripe `customer.subscription.updated`** → si statut `canceled` ou `unpaid` → désactive le robot + envoie mail de suspension
- **Champ `Subscription.status`** respecté par TOUS les crons (pas juste l'email, aussi le Decision Engine)

---

## Ce qui reste à concevoir (avant de coder)

Ces choses n'ont **pas encore** leur mockup ou leur décision produit :

- **Mockup détaillé du mail "paiement échoué" (J0, J+3, J+5)** — 3 templates séparés
- **Mockup détaillé du mail "compte suspendu" et "compte réactivé"**
- **Mockup de l'étape onboarding "Solo ou Pro ?"** (2 cartes visuelles)
- **Mockup du mail "alerte urgente"** (kill massif, postback HS >4h, spend anormal)
- **Mockup détaillé du récap mensuel Solo**
- **Mockup détaillé du récap mensuel Pro**
- **Mockups des emails transactionnels** (verify email, welcome, reset password, new device login)
- **Design du bot Telegram** (Phase 2 — tu as dit "on garde email d'abord")

---

## Roadmap à plus long terme

### Avant ouverture aux premiers clients

- **Buy `profitdash.app` domain** (pas fait — tu as dit "plus tard, pas tout de suite")
- **Recovery codes 2FA — vérification E2E** (reste dans le backlog)
- **Onboarding 3 steps complet** (le flow d'arrivée d'un nouvel user)
- **Override counter dans le dashboard** (compteur des fois où l'user a overridé le robot)
- **ROI unknown display** (comment on affiche un ROI inconnu sans mentir)
- **Force Automatic bypass** (pour les cas où un admin doit forcer une bascule)
- **Distributed rate limit** (pour ne pas perdre de postbacks sous forte charge)
- **Per-campaign engine mode** (mode Auto/Reco par campagne, pas global)

### Phase 2 — après lancement

- **Bot Telegram** pour alertes urgentes (kill-switch massif, postback dead, spend anormal)
- **Emails de récap mensuel**
- **Emails d'engagement** (onboarding drip, inactivité, feature announcements)

### Phase 3 — scale

- **Multi-workspace fluide** pour les agences
- **API publique ProfitDash** pour les intégrations client custom
- **Rapports trimestriels PDF** pour les gros comptes

---

## Les règles qu'on a posées (et qui doivent être respectées partout)

Ces règles sont **non-négociables** — elles viennent du `CLAUDE.md` et sont nos principes :

1. **ProfitDash est un SaaS, pas un projet perso.** Chaque ligne de code doit passer le test : "si 100 clients utilisent ça en même temps, qu'est-ce qui casse ?"
2. **Isolation multi-tenant.** Chaque requête DB, chaque appel API doit être scopé par `userId`. Zéro mélange de données entre clients.
3. **Données postback = argent réel.** Si on perd une transaction, le ROI est faux, le robot prend une mauvaise décision, le client perd de l'argent. Pas de droit à l'erreur.
4. **Tout le moteur tourne côté serveur (Vercel crons).** Pas de polling browser. Le dashboard est read-only côté automation.
5. **Le mail quotidien est un feature core, pas un nice-to-have.** Un user qui n'ouvre jamais le dashboard doit quand même être informé.
6. **Vérifier la doc API officielle en premier** avant de reverse-engineer un panel web.
7. **Toujours confirmer qu'on est sur `advault-project`** avant de toucher à un repo ou une DB — pas d'autre projet d'Arthur.

---

*Document généré le 22 avril 2026. À mettre à jour au fur et à mesure.*

---

## Session du 23 avril 2026 — Pivot positioning + infrastructure démo

### Ce qui a changé côté produit

- **Pivot de positioning** après recherche compétitive (Voluum Automizer, TheOptimizer, etc.) :
  - le Decision Engine pur est déjà commoditisé sur le marché mainstream
  - on se différencie par **3 axes** :
    1. le briefing quotidien personnalisé (feature sous-exploitée chez les concurrents)
    2. les **templates par verticale** (Dating d'abord, puis Cam/VOD/Adult E-com) — pas de "one-size-fits-all" pour les adult buyers
    3. le **solo tier < 100$/mois** — Voluum commence à 375$, TheOptimizer à 199$ — personne n'adresse correctement le media buyer solo
- **Verticale de lancement confirmée : Dating.** Plus gros volume sur ExoClick/TrafficJunky, le plus mature en workflow, le meilleur match pour valider les templates.

### Infrastructure email

- **Resend** branché : client singleton dans `lib/email/resend-client.ts`, template FR dans `lib/email/daily-briefing.ts`.
- **Premier mail de test reçu et validé** sur Gmail mobile — rendu propre, table-based, light theme.
- **Cron quotidien** : route `/api/cron/daily-briefing/run`, schedule `0 7 * * *` dans `vercel.json` (= 9h00 Paris en heure d'été). Auth par `CRON_SECRET`.

### Mode démo — architecture anti-résidu

Règles non-négociables pour éviter que le démo laisse des traces dans le codebase métier :

1. **Un seul user fictif** : `demo@profitdash.internal`. Toutes les données démo sont scopées à son `userId`. Supprimer ce user → cascade Prisma nettoie tout (campagnes, conversions, logs, settings).
2. **Zéro code démo dans les composants métier.** Pas de `if (isDemo)` dans `app/` ou dans les adaptateurs — tout vit dans `lib/demo/`.
3. **Un seul flag / un seul dossier.** Flag = `DEMO_MODE_ENABLED` env var. Dossier = `lib/demo/`. Si demain on retire le démo : `git rm -rf lib/demo app/api/demo` + passer le flag à `false`, point.
4. **Reset documenté et réversible.** Endpoint `POST /api/demo/reset` supprime le user démo. L'appeler avant un rollback.

### Fichiers créés

| Fichier | Rôle |
|---|---|
| `lib/demo/config.ts` | Constantes (email démo, flag `isDemoModeEnabled()`) |
| `lib/demo/campaigns.ts` | Catalogue des 15 campagnes Dating (FR, DE, IT, US, UK, CA, ES) |
| `lib/demo/seed.ts` | Seed idempotent : user + account fictif + 15 campagnes |
| `lib/demo/reset.ts` | Cleanup complet via `prisma.user.delete` |
| `lib/demo/simulator.ts` | Tick d'évolution des stats (impressions, clics, conversions, ROI) + trigger Decision Engine simulé |
| `lib/demo/briefing-data.ts` | Construit `BriefingData` depuis les vraies données démo Prisma |
| `app/api/cron/daily-briefing/run/route.ts` | Cron 9h — si `DEMO_MODE_ENABLED` : seed + simulateOneDay + mail démo |
| `app/api/demo/seed/route.ts` | POST admin — déclenche un seed manuel |
| `app/api/demo/reset/route.ts` | POST admin — supprime le workspace démo |
| `app/api/demo/simulate-tick/route.ts` | POST admin — déclenche un tick (ou 24h) à la demande |
| `app/api/dev/send-test-briefing/route.ts` | POST admin — envoie un briefing test hardcodé |

### Env vars ajoutées

- `.env.local` : `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_EMAIL`, `CRON_SECRET`, `DEMO_MODE_ENABLED=true`
- `.env.example` : documentation de `DEMO_MODE_ENABLED` ajoutée
- **Vercel** : les 5 variables ci-dessus sont configurées en Production + Preview (fait via Chrome)

### Point d'attention plan Vercel

Le projet est sur **Hobby plan**. Ça impose :
- **2 crons max par projet** (daily-briefing + kill-switch = on est à 2, plus de place pour un simulator séparé)
- **Fréquence daily** (1x/jour max) → le kill-switch cron `* * * * *` ne tourne pas vraiment sur Hobby, il sera exécuté 1x/jour au mieux

**Workaround** : le simulator est appelé **inline depuis le cron daily-briefing** (24 ticks d'un coup avant l'envoi du mail). Les stats du workspace démo évoluent donc 1x par jour. Pour un démo vivant toutes les 15 min → upgrade Pro ($20/mois).

### Check-list avant push (demain matin ou ce soir)

1. `git add . && git commit -m "feat: demo workspace + daily briefing cron" && git push`
2. Vercel redéploie automatiquement — vérifier logs
3. À 9h00 Paris le lendemain : le mail démo arrive sur arthur.bonelli67@gmail.com
4. Si besoin de reset le démo : `POST /api/demo/reset` authentifié via session admin
