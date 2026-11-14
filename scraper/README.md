# Robot de prix Stoemp

Relève les prix une fois par semaine et les écrit dans Firestore (usage privé, jamais publiés).
Chaque enseigne a un connecteur `search(query) → produits[]`. Un connecteur en panne ne casse rien : l'appli garde les derniers prix connus avec leur date, et le rapport est dans les logs et dans la collection `scraperRuns`.

| Enseigne | Où il tourne | Comment |
|---|---|---|
| Renmans | GitHub Actions, chaque dimanche | catalogue public, prix au kilo sur chaque fiche |
| Colruyt, Delhaize, Carrefour, AH | **ton ordinateur**, chaque dimanche | vrai navigateur, ton magasin choisi, ta connexion (les sites bloquent les serveurs) |
| Toutes | depuis l'appli | bouton « 📥 Envoyer à Stoemp » et photo du ticket de caisse |

Les articles relevés en priorité sont ceux présents dans les listes et stocks des foyers (150 par passe, modifiable avec `MAX_ITEMS`).
La correspondance produit est mémorisée (`productMatches`) ; les cas ambigus passent par l'IA (`matchQueue`).

## Installer le robot sur ton ordinateur (une seule fois, ~10 minutes)

1. Installe **Node.js 22** (nodejs.org) et **Google Chrome**.
2. Récupère le projet : `git clone https://github.com/qtheun27/Stoemp.git` puis `cd Stoemp/scraper && npm install`.
3. Donne au robot l'accès à ta base Firestore avec ton compte Google : installe le [Google Cloud CLI](https://cloud.google.com/sdk/docs/install), puis
   ```
   gcloud auth application-default login
   gcloud auth application-default set-quota-project stoemp-app
   ```
4. Prépare le navigateur du robot : `npm run robot:preparer`. Une fenêtre Chrome s'ouvre : accepte les cookies, **choisis ton magasin Colruyt**, fais une recherche (« lait ») pour vérifier que les prix s'affichent, puis ferme la fenêtre.
5. Essaie : `npm run robot:local` (le résumé s'affiche à la fin).
6. Planifie-le chaque dimanche :
   - **Mac** : `./planif/installer-mac.sh`
   - **Windows** (PowerShell) : `powershell -ExecutionPolicy Bypass -File planif\installer-windows.ps1`
   - **Linux** : `crontab -e` puis `23 10 * * 0 cd /chemin/Stoemp/scraper && npm run robot:local`

L'ordinateur doit être allumé (ou se réveiller) le dimanche ; sinon le passage est rattrapé au prochain démarrage.
Si un site change sa présentation, relance `npm run robot:preparer` et vérifie que les prix s'affichent.

## Commandes
- `npm run prix` : toutes les enseignes, sans interface (GitHub Actions)
- `npm run prix -- renmans` : une enseigne précise
- `npm test` : tests de lecture des formats et de correspondance
