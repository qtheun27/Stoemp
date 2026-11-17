# Stoemp — consignes du projet

Appli PWA « Stoemp » : repas de saison de la semaine, liste de courses avec prix réels, stock et prédiction des rachats, pour plusieurs foyers.

## Règles
- Interface en **français de Belgique**, unités métriques, prix au format **2,49 €** (`eur()` dans `src/lib/text.ts`).
- Utilisable **à une main sur téléphone** : actions principales en bas (barre flottante, bouton d'action), cibles ≥ 40 px.
- Code simple et lisible, **pas de dépendance lourde sans raison**.
- Tests de base sur les calculs clés (quantités, liste de courses, prédiction, coûts) : `npm test`, `npm --prefix scraper test`.
- Le nom de l'ancien prestataire évoqué en début de projet (commençant par « ceph ») n'apparaît **nulle part** (un test le vérifie).
- **Aucune clé API côté client** : tous les appels IA passent par les Cloud Functions (`functions/`), clé dans le secret Firebase `ANTHROPIC_API_KEY`.
- Réponses IA validées avec **zod** (`functions/src/schemas.ts`).
- Prix : usage privé, jamais publiés. Un connecteur en panne ne casse jamais l'appli (derniers prix connus affichés avec leur date).

## Architecture
- `src/lib/` : logique pure et testée (catalogue, unités, planificateur, liste de courses, prédiction, coûts, prix).
- `src/state/` : `store.tsx` (abonnements Firestore, cache hors ligne persistant) et `actions.ts` (écritures).
- `src/views/` : écrans (Semaine, Courses, Stock, Mes plats, Réglages, Capteur de prix, Ticket de caisse).
- `src/data/` : catalogue de départ (~280 articles) et 185 recettes de base classées par **cuisine** (`recipes-raw.ts` + `recipes-more.ts`, `CUISINES` dans `constants.ts`). `npx tsx scripts/seed.ts` les copie dans Firestore sans écraser les alias appris ni les recettes masquées.
- `functions/` : Cloud Functions Node 22 (europe-west1) : generateRecipes, structureMyDish, classifyItem, matchProduct, extractPrices, readReceipt, createInvite, joinHousehold, onMatchQueued. Par défaut : Haiku 5.5 pour tout (recettes, plats perso, rangement, correspondances, capteur), Sonnet 5.5 pour la lecture des tickets de caisse. Réglable par fonction dans la console. Cache dans `aiCache`.
- `scraper/` : robot Playwright hebdomadaire (GitHub Actions `prix.yml`), connecteurs `search(query) → Product[]`.
- `firestore.rules` : un membre ne lit/écrit que ses foyers ; catalogue, prix et recettes de base en lecture seule côté client.

## Modèle de données
- `items`, `prices/{itemId}_{store}[_bio]`, `priceHistory`, `recipes` (base, ia, perso + householdId), `productMatches`, `matchQueue`, `aiCache`, `invites`, `scraperRuns`.
- `users/{uid}` : `households[]`, `current`.
- `households/{id}` : `name`, `members{uid: admin|member}`, `memberNames` ; sous-collections `meta/settings`, `meta/prefs` (favoris, rayons appris, historique « tu achètes souvent »), `stock`, `consumption`, `weeks/{isoWeek}`, `shopping/{lineId}`, `paidPrices`.

## Commandes
- `npm run dev` · `npm test` · `npm run build` (BASE=/Stoemp/ pour GitHub Pages)
- `VITE_EMULATORS=1 npm run dev` + `firebase emulators:start --only auth,firestore` pour tester sans toucher aux données réelles.
- Déploiement : chaque fusion dans `main` déploie site, règles, index et Cloud Functions via GitHub Actions (sans clé). Le secret `ANTHROPIC_API_KEY` est dans Secret Manager.
- Le projet est dans une organisation Google Workspace : une exception « Partage restreint au domaine » (iam.allowedPolicyMemberDomains) est posée sur le seul projet Stoemp pour rendre les fonctions appelables.
- `npm --prefix scraper run prix -- renmans colruyt` : robot de prix en local.

## Console d'administration (`#/admin`)
- Réservée aux comptes portant la marque `superAdmin` (jamais d'adresse e-mail dans le code : le dépôt est public).
  Donner l'accès : `npx tsx scripts/super-admin.mts <e-mail>` (le compte doit s'être connecté une fois), ou depuis l'onglet Utilisateurs.
- `config/app` : modules activables, maintenance, annonce, part IA de la semaine, fraîcheur des prix, réglages d'un nouveau foyer (lu en direct par l'appli).
- `config/ai` : modèle, effort, jetons max et activation par fonction IA, budget mensuel ; liste des modèles lue en direct via l'API Models d'Anthropic. Les Functions relisent ce document toutes les 30 s.
- `aiLogs` : journal des appels IA (jetons, coût estimé, durée, erreurs) pour le tableau de bord et le plafond de budget.

## Capteur de prix
- Le favori (`src/views/Settings.tsx`) clique lui-même sur « Voir plus », puis propose « 📥 Envoyer à Stoemp » ; `#/capture` transmet le texte à `extractPrices`.
- Colruyt : lecteur **sans IA** (`functions/src/readers/colruyt.ts`) + correspondance déterministe (`readers/match.ts`, poids moyen par pièce pour convertir kilo ↔ pièce). Règle : le **mot principal** du produit (après la marque) doit figurer dans l'article ; synonymes de cuisine (`SYN` : séché = sec, endive = chicon). L'IA ne sert qu'à classer les produits inconnus en **nouveaux articles génériques** (enrichissement du catalogue), avec la liste des articles existants pour réutiliser leurs noms (consignes « chef + sommelier »). Autres enseignes : lecture par l'IA, par morceaux.
- Chaque prix garde le magasin (`shop`, ex. « Colruyt Basecles »). Copie brute des pages dans `captures` (admin) pour écrire de nouveaux lecteurs ; les tests n'utilisent que des extraits fictifs (prix jamais publiés).
- **Variantes** : `prices/{itemId}_{store}.offers[]` garde les produits relevés (gamme `eco`/`maison`/`marque`, bio, `sans-gluten`/`sans-lactose`/`vegetal`), fusionnés d'un envoi à l'autre (60 jours). `pickOffer` (`src/lib/pricing.ts`) choisit selon le foyer : prix payés d'abord, puis allergies, bio, gamme (option « Gamme de produits », défaut marque du magasin). L'historique (`priceHistory`) n'enregistre qu'en cas de changement.

## Foyer et repas
- Foyer : `adults`, `teens` (portion entière), `kids` 3-10 ans (0,6 portion) → `portionsOf` (`src/lib/household.ts`) ; `persons` gardé = nombre total.
- Créneau : `guests` + `courses` (réception : apéritif, entrée, dessert via `generateMenu`), `leftovers` / `fromLeftovers` (restes du lendemain midi). Les courses suivent `slotPortions`/`coursePortions`.
- **Foyer mixte** (`settings.vegEaters`, `src/lib/mixed.ts`) : un seul plat ; base commune pour tous, viande pour les uns, variante végé + protéine végétale (`proteinFor`) pour les autres (`mealParts` → courses, coût, stock). Les allergies valent pour tout le repas.
- **Plats préparés** du magasin (`items.ready`, `src/lib/ready.ts`) : à part des ingrédients ; chacun devient une recette `source: "pret"` (« à réchauffer », portion 350 g ou part de l'emballage). Choisis via « 🥡 Soir sans cuisiner » ou « Plat préparé à la place » ; jamais placés par le planificateur (`cookable`) ni proposés comme ingrédients aux recettes IA. Section à part dans la liste de courses.
- **Grande bibliothèque** : console → onglet Recettes lance `adminLibraryJob` ; `onLibraryJob` (déclencheur sur `libraryJobs/current`) génère des lots de 15 (Haiku, tâche `growLibrary`) de plats **réels** uniquement, filtrés par des contrôles de bon sens puis relus par un « chef critique » (Sonnet, tâche `reviewLibrary`, refus listés dans la console), sans doublon, ingrédients reliés au catalogue, écrit `recipes/lib-…` (complètes) et `library/{cuisine}-{n}` (fiches compactes sans étapes, lues par l'appli et gardées hors ligne ; étapes chargées à l'ouverture). `course` : plat / entrée / dessert ; seul `mains()` alimente le planificateur.
- Cuisines préférées (`options.cuisines`) : favorisées par le planificateur (×2,5, les autres ×0,5) et demandées à l'IA ; « Plats » = bibliothèque filtrable par cuisine.
- Planificateur : plats pour enfants (sans épices), promos de la semaine, équilibre (poisson, légumineuses, viande limitée, féculents variés) — `src/lib/balance.ts`. Boissons conseillées sans IA (`src/lib/drinks.ts`). « Frigo vide » : `fridgeIdeas` + plat IA « stock uniquement ».
