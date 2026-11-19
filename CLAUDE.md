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
- **Carnet de prix compact** : l'appli lit `priceBook/{magasin}_{0-3}` (`functions/src/pricebook.ts`, `expandBook` dans `src/lib/pricing.ts`), reconstruit après chaque capture, fusion/suppression d'article et passage du robot (signal `priceBookDirty/{magasin}`) ; repli sur `prices` tant qu'il est vide. 8 variantes au plus par article.
- **Maintenance** sans connexion manuelle : workflow GitHub « Maintenance » (`seed`, `rebuild-pricebook`, `oneoff` = correction ponctuelle `scripts/maintenance/oneoff.mts`) avec le compte de service du déploiement.
- Plats principaux = **repas** : avec leur accompagnement habituel, ou `light` (repas léger / déjà complet : salade-repas, omelette, moussaka, viande et sa garniture), décidé par le cuisinier (`LIGHT_MEALS` pour la base, champ `light` à la génération, vérifié par le relecteur ; `hasStarch` testé). Jamais de féculent artificiel. Doublons de noms refusés.
- Prix : usage privé, jamais publiés. Un connecteur en panne ne casse jamais l'appli (derniers prix connus affichés avec leur date).

## Architecture
- `src/lib/` : logique pure et testée (catalogue, unités, planificateur, liste de courses, prédiction, coûts, prix).
- `src/state/` : `store.tsx` (abonnements Firestore, cache hors ligne persistant) et `actions.ts` (écritures).
- `src/views/` : écrans (Semaine, Courses, Stock, Mes plats, Réglages, Capteur de prix, Ticket de caisse).
- `src/data/` : catalogue de départ (~280 articles) et 250 recettes de base classées par **cuisine** (`recipes-raw.ts` + `recipes-more.ts`, `CUISINES` dans `constants.ts`). `npx tsx scripts/seed.ts` les copie dans Firestore sans écraser les alias appris ni les recettes masquées.
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
- **Grande bibliothèque** : console → onglet Recettes lance `adminLibraryJob` ; `onLibraryJob` (déclencheur sur `libraryJobs/current`) s'appuie sur un **plan** de vrais plats avec leurs éléments clés (`libraryPlan/{cuisine}_{course}`, Sonnet, tâche `planLibrary`), écrit des lots de 15 de ces plats (Haiku, tâche `growLibrary`), filtrés par des contrôles de bon sens puis relus par un « chef critique » (Sonnet, tâche `reviewLibrary`, refus listés dans la console), sans doublon, ingrédients reliés au catalogue, écrit `recipes/lib-…` (complètes) et `library/{cuisine}-{n}` (fiches compactes sans étapes, lues par l'appli et gardées hors ligne ; étapes chargées à l'ouverture). `course` : apéritif, entrée, soupe, plat, accompagnement, dessert, pâtisserie, petit-déjeuner ; seul `mains()` (plats) alimente le planificateur. `prepMin` = durée totale réelle ; pas d’eau ni de variantes de marque comme ingrédients.
- **Recettes écrites à la main** (sans IA, sans coût) : `scripts/library/*.txt` (format compact décrit dans `format.ts` : quantités de la recette entière, parts, durée, saisons, viande + version végé, `l` = repas léger), vérifiées par `npx tsx scripts/library/check.mts` et par un test (catalogue, unités, féculent, doublons), une ligne `r` remplace le plat de base du même nom (version détaillée : photo recopiée, ancienne fiche masquée), envoyées par le workflow Maintenance → `library` (crée les articles manquants du catalogue, écrit `recipes/lib-…`, reconstruit toutes les fiches `library/`).
- Cuisines préférées (`options.cuisines`) : favorisées par le planificateur (×2,5, les autres ×0,5) et demandées à l'IA ; « Plats » = bibliothèque filtrable par cuisine.
- Jours de repas : `settings.lunchDays` / `dinnerDays` (0 = lundi), cochés dans Options ; à défaut, `lunches` / `dinners` répartis sur la semaine (`mealDays` dans `src/lib/planner.ts`).
- **Types de repas** (`weekFrame`, `poolFor`, `isLightMeal` dans `planner.ts`) : `settings.breakfastDays` = déjeuner du matin (`Slot.meal = "matin"`, recette `petitdej`, conseillé le week-end ; en semaine le stock prévoit pain, lait…) ; `settings.lightSlots` (« 2-midi ») = repas léger (`Slot.light` : soupe ou plat salade-repas, tartine, omelette…). Options : une touche par jour = complet → 🥗 léger → rien ; fiche recette : « 🥗 Repas léger / complet » (`setSlotLight`, retenu pour les semaines suivantes).
- Plats IA de la semaine : l'appli envoie tous les plats principaux connus (`knownNames`), le serveur refuse un nom identique ou très proche (`similarity` ≥ 0,75).
- **Goûts du foyer** (`src/lib/tastes.ts`, document `meta/tastes`) : un profil par membre (âge, régime, allergies, « jamais » / « j'adore » par groupes d'ingrédients `TASTE_GROUPS`, cuisines, piquant, curiosité) et ses avis (`ratings`, 😍 / 🙂 / 🙅). Le planificateur multiplie le score par `groupScore` (moyenne géométrique : un plat refusé par un membre disparaît presque) et applique les allergies de chacun. Saisie : Réglages → « Les goûts du foyer », jeu « Ça te tente ? », note « Le plat d'hier » dans Semaine. Les profils fixent adultes/ados/enfants et `vegEaters`.
- **Illustrations des plats** (sans image stockée ni IA) : `artSpec` (`src/lib/dishart.ts`) lit la recette (type de plat → contenant ; féculent, protéine, légumes, couleur de sauce ou de dessert, garnitures) et `DishArt` (`src/views/DishArt.tsx`) dessine un SVG déterministe. Tout nouveau plat (IA, perso, bibliothèque) a donc son image. Liste des plats, fiche recette, jeu « Ça te tente ? ».
- **Photos des plats** (`functions/src/images.ts`) : modèle d'images de Gemini sur Vertex AI (`gemini-3.1-flash-image`, réglable par `DISH_IMAGE_MODEL` ; Imagen arrêté par Google en 2026), sans clé ni licence. Générées à la création d'une recette (`onRecipeCreated`, 300/mois max, coupables par `config/app.dishImages = false`) et en masse par le workflow Maintenance (`images-setup`, `images-test`, `images` + nombre). Rangées dans Firestore : `dishThumbs/{id}` (~6 Ko) et `dishImages/{id}` (~30 Ko). `DishImage` affiche la photo, sinon l'illustration `DishArt`.
- **Accompagnement au choix** (`src/lib/sides.ts`) : sur un repas, `slot.side` = une recette « accompagnement » de la même famille (pommes de terre, riz, grains, pain). `withSide` retire le féculent d'origine du plat, ajoute les ingrédients et étapes de l'accompagnement ; `slotRecipe` est la recette effective utilisée par les courses, le coût, le stock et la fiche. Pas d'accompagnement interchangeable quand le féculent est le plat (`CORE` : moules-frites, pâtes, risotto, gratin dauphinois, stoemp…). **Un plat ne nomme pas son accompagnement** (« Boulettes sauce tomate », pas « … et purée ») : il s'affiche à côté du nom (`sideLabel`, ligne `s` des fichiers de recettes ; une ligne `o Ancien nom` garde l'identifiant, la photo et les semaines prévues d'un plat renommé).
- Planificateur : plats pour enfants (sans épices), promos de la semaine, équilibre (poisson, légumineuses, viande limitée, féculents variés) — `src/lib/balance.ts`. Boissons conseillées sans IA (`src/lib/drinks.ts`). « Frigo vide » : `fridgeIdeas` + plat IA « stock uniquement ».
