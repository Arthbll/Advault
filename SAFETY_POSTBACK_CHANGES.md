# Défense en profondeur postback — changements effectués

**Date :** 2026-04-21
**Objectif :** Empêcher l'engine de tuer des campagnes quand le user n'a pas encore (ou plus) de postback branché.

---

## 1. Ce qui a été changé

### a) Schema Prisma — 2 nouveaux LogType
`prisma/schema.prisma` : ajout dans l'enum `LogType` de :
- `KILL_BLOCKED_NO_DATA` — un kill a été bloqué parce que la grace period 48h est active
- `SAFETY_DOWNGRADE` — l'engine a basculé tout seul en mode Recommend

### b) Migration SQL
`prisma/migrations/20240421000000_safety_log_types/migration.sql` : fichier créé qui ajoute les 2 valeurs à l'enum côté PostgreSQL.

### c) Logique engine — `lib/kill-switch.ts`
Deux nouveaux comportements :

**Grace period (couche 1)** — Dans les premières 48h après la connexion du premier réseau, si aucun postback n'a jamais été reçu, les KILL par ROI sont bloqués. Les KILL par budget (maxSpendPerCampaign) continuent de marcher normalement parce qu'ils ne dépendent pas du revenue.

**Downgrade automatique (couche 2)** — Après 48h sans postback, si le user est en mode automatic, l'engine bascule tout seul en mode recommendation et log un événement `SAFETY_DOWNGRADE`. Les actions suivantes ne seront plus réelles — juste des logs.

**Exception** — Le mode `spendOnlyMode = true` désactive toutes les protections. L'utilisateur a choisi explicitement de kill uniquement sur budget, il n'a pas besoin de postback.

### d) Nouvel endpoint `/api/postback/test` (POST)
Fichier : `app/api/postback/test/route.ts`

Permet à un user connecté de créer une conversion de test (`source: "test"`, `revenue: 1.00`, `clickId` unique). Effet secondaire utile : crée une ligne dans `Conversion`, donc `firstPostback` n'est plus null, donc la grace period se termine.

### e) Nouvel endpoint `/api/postback/status` (GET)
Fichier : `app/api/postback/status/route.ts`

Retourne l'état actuel pour alimenter les bannières UI :
```json
{
  "hasAnyPostback": false,
  "firstPostbackAt": null,
  "oldestAccountConnectedAt": "2026-04-20T14:30:00Z",
  "inGracePeriod": true,
  "hoursUntilDowngrade": 24,
  "wasDowngraded": false,
  "downgradedAt": null,
  "currentEngineMode": "automatic",
  "spendOnlyMode": false,
  "killSwitchEnabled": true,
  "gracePeriodHours": 48
}
```

### f) Composant `PostbackSafetyBanner`
Fichier : `components/dashboard/PostbackSafetyBanner.tsx`

Composant auto-contenu (fait son propre fetch) qui affiche :
- Rien, si tout va bien
- Une bannière ambre si grace period active (prévention)
- Une bannière rouge si downgrade déjà fait (alerte)

Utilisation minimale :
```tsx
import PostbackSafetyBanner from "@/components/dashboard/PostbackSafetyBanner";
// ...dans ton layout ou ta page dashboard :
<PostbackSafetyBanner />
```

---

## 2. Ce qu'il faut faire pour activer (5 minutes)

**Étape 1** — Ouvrir le terminal dans le dossier `advault-project`.

**Étape 2** — Lancer la migration :
```bash
npx prisma migrate deploy
```
Cette commande applique la migration qui ajoute les 2 valeurs à l'enum `LogType` en base. `deploy` est la bonne commande en prod/staging. Pour créer une nouvelle migration locale et l'appliquer en dev, on utiliserait `prisma migrate dev`, mais ici le fichier migration.sql existe déjà donc `deploy` suffit.

**Étape 3** — Régénérer le Prisma Client pour que TypeScript connaisse les nouvelles valeurs :
```bash
npx prisma generate
```

**Étape 4** — Ajouter la bannière quelque part. Le plus simple : dans le layout dashboard, juste avant `{children}`. Ouvrir `app/(dashboard)/dashboard/layout.tsx` et ajouter :

```tsx
import PostbackSafetyBanner from "@/components/dashboard/PostbackSafetyBanner";

// Plus bas, juste avant {children} dans le JSX :
<PostbackSafetyBanner />
{children}
```

**Étape 5** — Déployer. `git add . && git commit -m "feat: postback safety guards" && git push`. Vercel redéploie automatiquement.

---

## 3. Comment tester

### Scénario A — Grace period active (prévention)
1. Créer un user fraîchement inscrit
2. Connecter un réseau publicitaire
3. Ne **pas** configurer le postback
4. Activer le kill-switch en mode automatic
5. Attendre le prochain cron (`/api/kill-switch/run` toutes les minutes)
6. ✅ Les campagnes avec ROI négatif **ne doivent pas être killées**. Un log `KILL_BLOCKED_NO_DATA` doit apparaître dans la table `Log`.

### Scénario B — Downgrade automatique
1. Même user, simuler que le compte réseau a été connecté il y a 48h+ (modifier `Account.createdAt` en base manuellement pour tester)
2. Attendre le prochain cron
3. ✅ Le `DecisionRule.engineMode` doit passer de `"automatic"` à `"recommendation"`. Un log `SAFETY_DOWNGRADE` doit apparaître.

### Scénario C — Sortie de grace period par le test
1. User en grace period
2. Appeler `POST /api/postback/test` depuis l'app (authentifié)
3. ✅ Une ligne apparaît dans `Conversion` avec `source="test"`
4. Au prochain cron, `hasAnyPostback = true`, grace period levée, l'engine agit normalement

### Scénario D — Spend Only (bypass)
1. User avec `spendOnlyMode = true`, aucun postback
2. ✅ Pas de grace period, pas de downgrade, l'engine kill normalement selon le budget

---

## 4. Erreurs pré-existantes (non causées par ces changements)

Le `tsc --noEmit` remonte 4 erreurs qui existaient **avant** cette série de changements :

- `app/api/stats/route.ts:146` — `PropellerAdsCampaign.title` n'existe pas
- `app/api/sync/route.ts:389` — idem
- `app/api/sync/route.ts:402` — idem
- `lib/kill-switch.ts:564` — `PropellerAds.scaleBid` retourne un type incompatible avec la signature attendue

Ces erreurs sont dans le code PropellerAds et datent d'avant. À traiter séparément.

---

## 5. Décisions restées ouvertes (à discuter)

1. **Durée de grace period : 48h.** À ajuster à 24h ou 72h si besoin.
2. **Bypass "Forcer Automatic"** — l'utilisateur peut-il choisir de rester en automatic même sans postback après downgrade ? Pas implémenté pour l'instant. Ma recommandation : ajouter ce bouton **seulement après un test postback réussi**, sinon pas de bypass.
3. **Compteur d'overrides** (ré-activation manuelle d'une campagne tuée par l'engine) — pas implémenté, à voir si tu veux le filet de sécurité supplémentaire.
4. **Affichage "ROI: unknown" vs "-100%"** — pas encore fait. À creuser ensuite, c'est une modification des composants de tableau de campagnes.
5. **Position exacte de la bannière** — placée où dans le layout ? Actuellement le composant se colle en haut avec `marginBottom: 12`. À confirmer en voyant le rendu.

---

## 6. Fichiers touchés — résumé rapide

| Fichier | Type | Description |
|---------|------|-------------|
| `prisma/schema.prisma` | Modifié | Ajout des 2 LogType |
| `prisma/migrations/20240421000000_safety_log_types/migration.sql` | Créé | Migration SQL |
| `lib/kill-switch.ts` | Modifié | Grace period + downgrade logic + passage de `inGracePeriod` aux 5 appels |
| `app/api/postback/test/route.ts` | Créé | Endpoint test postback |
| `app/api/postback/status/route.ts` | Créé | Endpoint statut pour UI |
| `components/dashboard/PostbackSafetyBanner.tsx` | Créé | Composant bannière auto-contenu |
