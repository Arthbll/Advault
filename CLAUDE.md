# ProfitDash

## ⚠️ RÈGLE N°1 — TOUJOURS EXPLIQUER COMME À UN ENFANT DE 10 ANS

**Cette règle prime sur tout le reste.**

Arthur n'a aucune connaissance en code. Zéro.

Chaque explication doit être écrite comme si tu parlais à un enfant curieux qui n'a jamais vu du code de sa vie.
- Pas de jargon technique sans une analogie simple immédiatement après
- Pas de "lance juste cette commande" sans expliquer en une phrase ce qu'elle fait
- Si c'est complexe, coupe en petits morceaux
- L'objectif : qu'Arthur comprenne ce qui se passe et pourquoi — pas juste qu'il copie-colle correctement

**Toujours répondre en français.**

---

## Product identity

ProfitDash is a 24/7 autonomous campaign operator — not a passive dashboard.

Think of it as a robot employee that never sleeps.
It watches the user's campaigns around the clock, applies their rules, and either:
- **acts on its own** (automatic mode — pauses, scales, kills campaigns directly via ad network APIs)
- **flags what it would have done** (recommendation mode — logs the decision so the user can review it when they open the dashboard)

The user should almost never need to manually intervene.
ProfitDash is the operator. The user is the owner who checks in.

This is the most important product principle and it affects every technical decision:
- automation must run server-side (Vercel crons), not in the browser
- the dashboard is just a window into what the robot has been doing
- a user who never opens the dashboard should still have their campaigns managed correctly
- alerts and flags must reach the user even when they are not logged in (email, future: Slack/push)

Core product pillars:
1. autonomous campaign operation (the robot works 24/7, server-side, even when the dashboard is closed)
2. real profit visibility (what is actually happening with money)
3. user control (the user sets the rules and can override at any time)
4. operational clarity (when the user checks in, they understand exactly what happened and why)

## Automation architecture — mandatory rule

All Decision Engine logic (kill-switch, automation rules, scaling) MUST run server-side via Vercel cron jobs.
Never rely on client-side polling for automation. The browser might be closed.

The correct architecture:
- Vercel cron (every 5 min or less) → runs automation rules → calls ad network APIs if in automatic mode, logs if in recommendation mode
- The dashboard is READ-ONLY from an automation perspective — it shows what the robot did, it does not power the robot

This is non-negotiable. A user who never opens the dashboard must still have their campaigns managed.

## Daily briefing email

Every user should receive a personalized email at 9am (their local timezone) summarizing:
- what the robot did overnight (paused X, scaled Y, flagged Z)
- current campaign status overview (how many scaling / watching / needs action)
- any campaign that needs the user's attention today
- yesterday's performance vs the day before (spend, revenue, ROI)

This is a core product feature, not a nice-to-have.
The goal: the user reads the email over coffee and knows exactly what happened and what (if anything) needs their attention today.

## Automatic vs Recommendation mode

These are features built FOR future clients, not for Arthur personally.
- Automatic mode: the robot takes real actions on the ad network APIs (pause, scale, kill)
- Recommendation mode: the robot logs what it WOULD have done, but does not act — the user reviews and decides

Both modes must run server-side. The difference is only whether real API calls are made.

**Mode is set per campaign, not globally.**
A user can have some campaigns in automatic mode and others in recommendation mode.
ProfitDash must always know which mode applies to which campaign before taking any engine action.

**The daily email adapts to the mode:**
- Automatic: "here is what the robot did overnight" — informative, past tense, no action needed
- Recommendation: "here is what the robot recommends" — consultative, action required, CTA leads to approval page in dashboard
- Mixed: email shows both sections clearly separated

**In recommendation mode, every suggested action must include a plain-language "why".**
The user needs to understand the reasoning, not just see a number.
The goal: the user reads the recommendation in 10 seconds and can approve or ignore it confidently.

## What ProfitDash is NOT

- not a generic analytics suite
- not a simple tracker
- not a finance backoffice
- not just a campaign launcher
- not a collection of unrelated pretty pages

## Product model

### Dashboard
Immediate operating view.
Shows what matters now:
- live performance
- active issues
- current engine actions
- quick operational shortcuts

Dashboard must not replace Analytics, Transactions, or Decision Rules.

### Campaigns
Main operating list of campaigns.
Each campaign must lead to a Campaign Detail page.
New campaign flow should be direct and intentional.
If a paused campaign requires a decision, show the resume/new/archive decision modal only when relevant.

### Campaign Detail
Single-campaign operating view.
Must connect:
- performance
- engine profile / rules
- assets / routes
- filtered revenue events
- metadata

### Wizard
Used to create campaigns.
Should stay launch-oriented and feel better than creating directly in ad networks.

### Preview
Separate from the wizard steps.
Used to preview how the ad format renders.
Must receive actual context from selected format, route, and creative.

### Vault
Operating inventory for assets and routes.
Not dead storage.
Assets and URLs must connect to campaigns and preview flows.

### Transactions
Revenue events received through affiliate postbacks.
Not invoices, not accounting, not payment history.
This is the money signal feeding real profit.

### Analytics
Strategic analysis layer.
Used to understand patterns over time.
Not a second dashboard.
Not a transactions clone.

### Decision Rules
Logic layer behind engine behavior.
Full editing belongs on a dedicated page.
Dashboard and Campaign Detail only show compact summaries.

### Settings
A section, not one giant page.
Must include:
- Overview
- Connections
- Postbacks
- Engine Defaults
- Team & Roles
- Security

### Resume / New / Archive flow
When relevant, clicking New campaign can trigger a decision modal.
The modal must clearly differentiate:
- Resume current campaign
- Start a new campaign from scratch
- Archive current campaign

Archived campaigns:
- leave active operating flow
- remain accessible in history / filters / analytics
- are not deleted

## Visual direction

ProfitDash should feel:
- premium
- dark
- clean
- deliberate
- operator-focused
- confident

Avoid:
- generic enterprise admin feel
- ugly form walls
- visual clutter
- oversized fake charts with no meaning
- random components without page purpose

## UX principles

- every page must have a clear role
- pages must connect to each other naturally
- avoid dead ends
- empty states must guide the next action
- error states must explain what broke and what is affected
- important actions should feel intentional, not hidden in tiny buttons
- clarity beats cleverness
- cohesion beats extra decoration

## Functional architecture rules

- clicking campaigns always opens Campaign Detail
- Transactions should link back to the related campaign
- Analytics should support drill-down to campaigns / networks / geos when relevant
- Vault assets and routes should be attachable to campaigns
- Preview must receive real context
- Settings must expose trust signals: connections, postbacks, defaults, permissions
- Dashboard should surface live issues but defer deep editing to dedicated pages

## Implementation priorities

When choosing between:
- adding more visual polish
- or improving product coherence and page relationships

always prioritize product coherence.

## Terminology rules

Use these consistently:
- Transactions = revenue events / postback events
- Analytics = strategic performance analysis
- Dashboard = real-time operating view
- Vault = assets and routes inventory
- Decision Rules = engine logic controls
- Campaign Detail = single campaign operating page

Do not rename these inconsistently.

## Coding behavior

Before building new UI:
1. inspect existing routes, components, and data flow
2. reuse existing patterns when possible
3. preserve the current visual system
4. connect new work to real product flows
5. avoid isolated mockup-style additions

## Final mindset

Make ProfitDash feel like one real product.
Every page must know:
- why it exists
- what user job it solves
- what it links to
- what the next action should be

---

## Performance page — current state (avril 2026)

### Architecture
Single-column layout in `components/dashboard/BentoDashboard.tsx`:
1. Demo banner (if ?demo=auto or ?demo=reco)
2. Header — "Performance" + Engine live pill
3. **Decision Engine card** — status bar + 4 mini-stats + Event Stream (all in one card)
4. Campaign P&L table
5. Analytics (chart, network breakdown, world map, etc.)

### Demo mode
- URL params: `?demo=auto` or `?demo=reco` — 100% client-side, zero DB writes
- `DEMO_FEED_AUTO` / `DEMO_FEED_RECO` — 7 fake events each
- `DEMO_COUNTS_AUTO` / `DEMO_COUNTS_RECO` — fake engine stats
- Demo banner with toggle between modes + "Exit demo" link

### Event Stream — UX rules
- **KILL / SCALE events** = action cards — full card with accent bar + badge + Approve/Ignore (reco) or Restore (auto)
- **WATCH events** = NOT actions — rendered as compact "Monitoring" info rows under a "Under surveillance" separator. Never shown as action cards.
- **Approve flow**: button → "✓ Approved" green state (1.8s) → card slides right off screen
- **Ignore flow**: card slides right off immediately
- **AnimatePresence mode="popLayout"** handles the exit animations; `layout` prop makes remaining cards fill the gap smoothly
- **Live pending counter** in stream header: pill badge showing remaining count, animates on change
- **All clear state**: when all reco action events are processed → green ✓ "Nothing pending · Engine is watching"
- **Live counter update**: approving a KILL increments "Suggested kills", approving a SCALE increments "Suggested scales" in the mini-stats

### Recommendation mode specifics
- Badges show as dashed border + "KILL?" instead of solid "KILL"
- Accent bar opacity 0.45 (vs 0.65 for auto)
- Header: "What the robot recommends" vs "What the robot did"
- "Pending" indicator (purple) vs "Live" (green)
- Protected stat = 0 (nothing protected until user approves)
- `approvedKilled` / `approvedScaled` state increments live as user approves

### What's NOT built yet
- Real Approve/Ignore API endpoint (`POST /api/engine/recommendations/{id}/approve`) — buttons work visually but don't hit the server in real mode

### What IS already built (don't re-do)
- Daily briefing email → fully built at `app/api/cron/daily-briefing/run/route.ts` — sends real emails via Resend, 3 modes: demo / production / test fallback
- Decision Rules page → fully built at `app/(dashboard)/dashboard/rules/page.tsx` — presets (Careful / Balanced / Aggressive / Custom) + all thresholds configurable
- Engine actions API → `app/api/engine/actions/route.ts` — returns real engine events with kill/watch/scale/recommend flags

---

## Plans — structure officielle (avril 2026)

Source de vérité : `lib/plans.ts` + `hooks/usePlan.ts`

| Feature | Free (observer) | Operator (~$99/mo) | Dominion (~$200/mo) |
|---|---|---|---|
| Campagnes actives | 3 | 50 | Illimité |
| Connexions réseau | 1 | Toutes | Toutes |
| Vault assets | 5 | Illimité | Illimité |
| Mode auto (kill/scale réel) | ✗ | ✓ | ✓ |
| Règle Scale | ✗ | ✓ | ✓ |
| Kill-Switch d'urgence | ✗ | ✓ | ✓ |
| Scan engine | 30 min | 10 min | **1 min** |
| Analytics | ✗ | Basique | Complet |
| Drill-down (réseau, geo) | ✗ | ✓ | ✓ |
| Export CSV | ✗ | ✗ | ✓ |
| Briefing email quotidien | ✗ | ✓ | ✓ |
| Historique logs/transactions | 7 jours | Illimité | Illimité |
| Postbacks/jour | 500 | Illimité | Illimité |
| Support | — | Email | Prioritaire |

**Agence** = tarif custom (hors app, devis sur mesure)

**Argument béton Dominion vs Operator :** scan à 1 min vs 10 min.
Sur une campagne qui brûle $50/heure : 10 min = $8 perdus avant que le robot réagisse. 1 min = $0.80.

**Ce qui N'EST PAS encore implémenté côté backend** (décisions prises, code à faire) :
- Limite 1 réseau sur Free (`networkConnectionLimit`) — vérification à ajouter dans `/api/accounts`
- Scan interval par plan — cron à adapter pour lire `PLANS[planId].scanIntervalMinutes`
- Limite 500 postbacks/jour sur Free — rate limit à ajouter dans `/api/track`
- Rétention 7 jours — filtre à ajouter dans les queries logs/transactions pour Free
- `canUseKillSwitch` — vérification dans `/api/kill-switch/run`
- `canReceiveBriefing` — check dans le cron daily-briefing

### Email quotidien — limitation timezone (V1)

Le cron tourne une seule fois par jour à 7h UTC (plan Vercel gratuit = 1 cron/jour max).
Le fuseau horaire de l'utilisateur est bien stocké (`UserSettings.timezone`) et affiché dans l'email,
mais l'envoi se fait à 7h UTC pour tout le monde — pas à 9h dans le fuseau local de chaque client.

**Impact** : utilisateurs européens (UTC+1/+2) → reçoivent l'email entre 8h et 9h ✅
Utilisateurs US/Asie → reçoivent l'email tôt le matin ou la nuit ❌

**Fix V2** (nécessite plan Vercel Pro) : passer le cron à `"0 * * * *"` (toutes les heures),
et dans `sendProductionBriefings()`, ajouter un check :
```ts
const userHour = new Intl.DateTimeFormat("en", { hour: "numeric", hour12: false, timeZone: timezone }).format(new Date());
if (Number(userHour) < 8 || Number(userHour) >= 10) continue; // skip — not 9am yet
```
Avec idempotence déjà en place (`lastDailyBriefingSentAt`), chaque user ne reçoit qu'un seul email par jour même si le cron tourne 24 fois.

---

## Decision Engine — architecture actuelle (V1, avril 2026)

### Ce qui EST implémenté

- Règles moteur = **globales par utilisateur** — table `DecisionRule` (`userId @unique`)
- Tous les campagnes d'un utilisateur partagent les mêmes seuils (kill/watch/scale)
- Contrôle par campagne = **deux flags uniquement** sur le modèle `Campaign` :
  - `excludeFromEngine` (boolean) — exclut complètement la campagne du moteur
  - `automationPaused` (boolean) — pause temporaire de l'automation
- Le wizard Step 7 expose `excludeFromEngine` et explique que les règles sont globales
- Les règles globales se configurent dans Settings → Rules

### V2 — Règles par campagne (à implémenter plus tard)

Quand on veut que chaque campagne ait ses propres seuils :
1. Ajouter les champs kill/watch/scale sur le modèle `Campaign` dans `prisma/schema.prisma`
2. Faire une migration Prisma
3. Mettre à jour l'API `/api/campaigns/create` pour sauvegarder ces champs
4. Mettre à jour `lib/kill-switch.ts` pour que `runKillSwitchForUser()` lise les règles par campagne plutôt que la `DecisionRule` globale (fallback sur global si non défini par campagne)
5. Mettre à jour le wizard Step 7 pour ré-exposer les inputs kill/watch/scale

**Ne pas implémenter en V1** — complexité inutile tant qu'un seul jeu de règles suffit.

---

## ProfitDash is a SaaS — not a personal project

This is the most important engineering context rule.

ProfitDash is built for multiple paying clients, not for Arthur alone.

Every technical decision must be made with this in mind.

### What this changes concretely

**Data integrity is non-negotiable.**
Clients' revenue data feeds their Decision Engine.
If a transaction is lost, duplicated, or corrupted:
- their revenue figure is wrong
- their ROI is wrong
- the engine makes bad decisions (wrong kills, wrong scales)
- they lose real money

This is not a bug. This is a business liability.

**Multi-tenancy is mandatory.**
Every database query, every API route, every engine action must be scoped to `userId`.
A client must never see or affect another client's data.
There are no exceptions.

**Production standards apply at all times.**
No fake data. No hardcoded fallbacks. No debug routes in production.
No `console.log` as the only observability. No silent data corruption.
If something breaks in production, a real paying client is affected.

**Rate limiting, deduplication, and error handling are product features — not nice-to-haves.**
A postback endpoint that loses transactions is not a minor tech issue.
It directly impacts what clients see, what they pay for, and whether they trust the product.

**Engine decisions affect real money.**
The kill-switch and automation rules make real API calls that pause or scale live campaigns.
A bad decision caused by bad data = client loses real ad budget.
Treat every engine output as if it had direct financial consequences — because it does.

### The mindset rule

Before every technical decision, ask:
> "If 100 clients are using this simultaneously, what breaks?"

If the answer is "nothing" — proceed.
If the answer is "it could lose data / mix client data / crash under load" — fix it first.

### SaaS quality bar

| Topic | Minimum standard |
|---|---|
| Data isolation | Every query filtered by `userId` |
| Deduplication | DB-level UNIQUE constraints, not just application-level checks |
| Error handling | All errors logged to DB, surfaced to the right client only |
| Engine actions | Always respect cooldowns, modes, and per-user settings |
| Debug routes | Never in production — deleted before any deployment |
| Fallback values | No hardcoded fallbacks that mask missing real data |
| Rate limiting | Soft and monitored — never drop real client transactions silently without a DB log |

---

## Working with Arthur — mandatory rules

Arthur is not a developer. He has no technical background.
He does not know what a migration is, what a type error means, or what a database query looks like.

When explaining things to Arthur:
- use plain language, no jargon
- use simple analogies when needed (like explaining to a curious non-technical person)
- never assume he knows what a term means — define it if you use it
- keep explanations short and direct

When making changes:
- always explain briefly what you changed and why, in plain terms
- never just dump code without context

**After every response, if you have any open questions, uncertainties, or decisions that require Arthur's input — ask them explicitly at the end of your message. Do not make assumptions and move on. Do not save questions for later. Ask immediately.**

This is not optional. It is a working rule.

**Explain everything as if Arthur is 10 years old.**
Arthur has zero coding knowledge. Every explanation must be written like you are talking to a curious child who has never seen code before.
- No technical jargon without an immediate simple analogy
- No "just run this command" without explaining what the command does in one plain sentence
- If something is complex, break it into the smallest possible steps
- The goal is that Arthur understands what is happening and why, not just that he copies and pastes correctly

---

## ⚠️ RÈGLE — TOUJOURS VÉRIFIER LA DOC API OFFICIELLE EN PREMIER

Avant d'essayer de reverse-engineer une API interne, d'intercepter le trafic réseau, ou de hacker un panel web, **vérifier d'abord la documentation officielle de l'API**.

Exemple concret : pour Adsterra, on a passé des heures à tenter d'utiliser l'API interne du panel (beta.partners.adsterra.com) avec des cookies de session, alors que l'API V3 publique (api3.adsterratools.com) supporte déjà la mise à jour des bids via `PATCH /campaign/{id}/update.json`.

**Procédure systématique avant tout travail sur un adaptateur réseau :**
1. Chercher la doc API officielle (Swagger, OpenAPI, YAML spec)
2. Lister TOUS les endpoints disponibles (GET, POST, PUT, PATCH, DELETE)
3. Vérifier si le besoin est déjà couvert avant d'aller chercher ailleurs
4. Seulement si l'API officielle ne couvre pas le besoin → envisager des alternatives

**URLs des specs connues :**
- Adsterra V3 : `https://docs.adsterratools.com/docs/public/v3/partners-api.yml`
- ExoClick : (à documenter)
- TrafficStars : (à documenter)
- TrafficJunky : (à documenter)
- PropellerAds : (à documenter)

---

## Project identity — do not confuse projects

Arthur has multiple projects in GitHub and Supabase (including a separate project with his cousin).

**The project we are always working on here is: `advault-project` (ProfitDash).**

Rules:
- Never make assumptions about which GitHub repo, Supabase project, or Vercel deployment to touch
- Always confirm you are on `advault-project` before making any change
- If a GitHub repo, Supabase project, or Vercel project name is ambiguous, stop and ask Arthur to confirm before proceeding
- Never touch anything that belongs to another project
// Sat Apr 25 18:58:22 UTC 2026
