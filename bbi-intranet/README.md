# BBI Intranet — SPFx 1.22.2 · version 1.1.0

**Un accueil complet et 12 modules autonomes**, aux couleurs du logo BBI : bleu nuit `#0E265C`, rouge `#D21419`, fonds clairs. React 17 / TypeScript 5.8 / Node 22.

## Installation rapide

1. Déployer **[`../deliverables/spfx/bbi-intranet.sppkg`](../deliverables/spfx/bbi-intranet.sppkg)** dans l’App Catalog SharePoint. Accepter la mise à niveau s’il existe déjà.
2. Le déploiement à tous les sites est possible. Sinon, ajouter l’application au site cible depuis **Contenu du site**.
3. Sur un **site de communication**, créer une page moderne, ajouter une section pleine largeur (ou une colonne), puis **BBI Accueil**. Publier.
4. Les sources réelles sont activées par défaut. Créer les listes avec le script ci-dessous. Pour une présentation immédiate, activer **Données fictives de démonstration** dans les propriétés de BBI Accueil.
5. Renseigner les liens de l’espace formateurs, du support, les contenus et les indicateurs. Désactiver la démonstration avant publication réelle.

**Installer le package ne remplace pas la page d’accueil existante.** Ajouter BBI Accueil suffit à composer tous les modules, sans ajouter douze webparts à la main. Le script peut aussi créer une page et, uniquement sur demande explicite, en faire l’accueil du site.

Les composants internes sont partagés en React ; on **n’imbrique pas des instances SPFx**, technique fragile/non supportée. Chaque module est également disponible séparément dans la boîte à outils. Les sources restent gérées par SharePoint et ses permissions. Pas d’iframe, pas d’API Graph ni d’autorisation applicative additionnelle requise par les webparts.

## Les 13 webparts

| Webpart | Clé | Source par défaut / comportement |
|---|---|---|
| BBI Accueil | `home` | Compose tous les modules ci-dessous |
| BBI Bienvenue | `hero` | Logo et visuel embarqués, texte/CTA configurables |
| BBI Actualités | `news` | `BBI Actualités`, tri par date décroissante |
| BBI Sessions et planning | `sessions` | `Sessions`, sessions non terminées |
| BBI Liens rapides | `links` | `BBI Liens`, URL ou ancre de module |
| BBI Catalogue des formations | `catalog` | `Formations`, statut `Actif`, recherche et filières |
| BBI Documents sécurisés | `documents` | `Supports publiés`, fichiers uniquement, ouverture `web=1` |
| BBI Annuaire des formateurs | `directory` | `BBI Annuaire`, recherche et contacts mail |
| BBI Indicateurs | `metrics` | `BBI Indicateurs`, valeurs et périodes éditoriales |
| BBI Ressources et qualité | `resources` | `BBI Ressources`, recherche et catégories |
| BBI Communauté | `community` | `BBI Communauté`, sujets et liens Teams/Viva Engage |
| BBI Espace formateur | `trainer` | `Sessions`, filtre sur l’e-mail de l’utilisateur connecté |
| BBI Support et FAQ | `support` | `BBI FAQ`, recherche, accordéons et URL du support |

Les indicateurs ne sont **pas** synchronisés à Power BI ; la communauté est une sélection éditoriale de liens, **pas** un flux Viva Engage embarqué. Le tableau de bord formateur présente le planning et ouvre l’espace de contribution configuré : l’édition des documents et des sessions se fait dans SharePoint, selon les droits. Ces choix évitent de simuler des intégrations non configurées.

### Configuration

- Site source : site courant par défaut ; URL absolue HTTPS pour un autre site autorisé du tenant.
- Sources : noms des listes/bibliothèques. Pour l’accueil, JSON par clé :
  ```json
  {"news":"Actualités internes","catalog":"Formations","documents":"Supports publiés","trainer":"Sessions"}
  ```
  Les valeurs du JSON priment sur le champ de liste autonome. JSON invalide = message explicite, pas de panne silencieuse.
- Modules masqués : clés séparées par virgules, par exemple `metrics,community`. La navigation et les ancres correspondantes s’adaptent.
- Nombre initial de cartes : de 1 à 48 ; bouton **Afficher plus**. Chargement paginé plafonné à 500 éléments (25 pages maximum), signalé à l’utilisateur. La recherche porte sur les éléments chargés ; ce n’est pas un moteur de recherche global SharePoint.
- Logo, visuel, titre, introduction et liens de destination configurables. Pas de modification du thème global ni de la navigation du tenant.
- Responsive : viewport **et largeur réelle de la colonne du webpart** ; styles isolés par CSS Modules.
- Une erreur 400/403/404 ou réseau reste une erreur, avec **Réessayer** et l’ID de requête SharePoint lorsqu’il est disponible. Aucun basculement automatique vers du faux contenu.

## Provisionner les listes et, éventuellement, la page

Prérequis : PowerShell 7.4+ (ou version requise par votre PnP.PowerShell), module `PnP.PowerShell`, propriétaire du site et application Entra autorisée pour votre connexion PnP. Utiliser votre propre client ID, jamais un secret dans le dépôt.

```powershell
Connect-PnPOnline -Url "https://TENANT.sharepoint.com/sites/bbi" -Interactive -ClientId "ID-DE-VOTRE-APPLICATION-PNP"

# Prévisualiser, puis créer les 10 listes/bibliothèques et les liens internes.
./scripts/Provision-Bbi.ps1 -SeedNavigation -WhatIf
./scripts/Provision-Bbi.ps1 -SeedNavigation

# Après le déploiement du package : créer/publier une page BBI, sans changer l’accueil actuel.
./scripts/Provision-Bbi.ps1 -CreateHomePage

# Option explicite : en faire la page d’accueil du site.
./scripts/Provision-Bbi.ps1 -CreateHomePage -SetAsHomePage
```

Le script conserve les listes/pages existantes, crée uniquement les objets manquants et signale les types incompatibles. Il ne supprime aucune donnée, ne modifie pas les permissions et n’ajoute pas de personnes, sessions ou indicateurs fictifs. Les liens initiaux sont dédupliqués par titre. Une page existante n’est pas réécrite : si une première création a échoué après la création du brouillon, ajouter le webpart manuellement puis publier, ou choisir un nouveau `-PageName`.

### Contrat des données

Source de vérité : [`scripts/lists.schema.json`](scripts/lists.schema.json). `Title` et `Id` sont natifs. **Noms internes exacts** ci-dessous ; renommer uniquement un libellé affiché ne suffit pas.

| Liste | Colonnes personnalisées |
|---|---|
| BBI Actualités | `Description` (texte multiligne brut), `Categorie` (texte), `Lien`, `ImageUrl` (texte multiligne brut contenant une URL), `DatePublication` (date/heure) |
| Sessions | `DateDebut`, `DateFin` (date/heure), `Lieu`, `Modalite`, `FormateurEmail` (texte), `Lien` (URL en texte multiligne brut) |
| BBI Liens | `Description` (multiligne brut), `Categorie` (texte), `Lien` (URL en texte multiligne brut), `Ordre` (nombre) |
| Formations | `CodeFormation`, `Filiere`, `Modalite`, `Niveau`, `StatutCatalogue` (texte), `DureeH` (nombre) |
| Supports publiés | Bibliothèque standard : `Title`, `FileRef`, `FileLeafRef`, `Modified`, `FSObjType` natifs |
| BBI Annuaire | `Fonction`, `Email`, `Categorie` (texte), `Ordre` (nombre) |
| BBI Indicateurs | `Valeur`, `Periode` (texte), `Ordre` (nombre) |
| BBI Ressources | `Description`, `Lien` (multiligne brut), `Categorie` (texte), `Ordre` (nombre) |
| BBI Communauté | `Description`, `Lien` (multiligne brut), `Categorie` (texte), `DatePublication` (date/heure) |
| BBI FAQ | `Description` (réponse, multiligne brut), `Categorie` (texte), `Ordre` (nombre) |

**À renseigner pour rendre les modules utiles :**
- Formation : `StatutCatalogue = Actif` (les statuts vides/inactifs sont exclus).
- Session : les deux dates, notamment `DateFin` ≥ maintenant pour apparaître. `FormateurEmail` doit correspondre à l’adresse du compte Microsoft 365, pas au nom affiché. Une adresse par session dans cette version.
- Liens rapides : URL HTTPS dans `Lien`, ou clé de module (`catalog`, `trainer`, `sessions`, `support`, etc.) dans `Categorie` pour naviguer dans l’accueil. Un module autonome n’a pas les ancres des autres modules : renseigner des URL dans ce cas.
- Actualités : texte brut, catégorie, date ; image facultative. `Lien` facultatif : sans lien, le formulaire réel de l’élément SharePoint est utilisé.
- Ressources/communauté : renseigner `Lien` pour ouvrir la destination. FAQ : réponse en texte brut, sans HTML.
- Indicateurs : renseigner la période et la provenance dans `Periode` ; ne pas publier des exemples comme des chiffres réels.

`Lien` et `ImageUrl` sont volontairement des champs de texte brut et non des colonnes Hyperlien (objet `{Url,Description}`). Les longs liens Teams sont ainsi acceptés. Un schéma existant différent nécessite une adaptation, pas une migration destructive. Le script indexe les principaux champs de filtre/tri ; vérifier les vues/volumétries et la délégation des droits avant une exploitation à grande échelle.

## Docker & erreur `Script error for manifests.js`

Voir le **[guide de diagnostic détaillé](docs/DEBUG-WORKBENCH.md)**. Le point de configuration corrigé : écoute réseau **`0.0.0.0` dans le conteneur**, URL publique **`localhost` dans le navigateur**. Le chemin `/temp/build/manifests.js` est correct pour cette version.

```bash
cp .env.example .env       # renseigner SPFX_TENANT_DOMAIN
docker compose up --build -d
docker compose logs -f spfx
```

Attendre la fin de compilation, puis ouvrir **directement** :

```text
https://localhost:4321/temp/build/manifests.js
```

Ce doit être du JavaScript, pas une page HTML. Faire confiance au **CA du conteneur sur l’ordinateur du navigateur** (procédure du guide). Ouvrir ensuite :

```text
https://TENANT.sharepoint.com/sites/bbi/_layouts/15/workbench.aspx?debug=true&noredir=true&loadSPFX=true&debugManifestsFile=https://localhost:4321/temp/build/manifests.js
```

Le workbench est hébergé sur votre tenant. Un workbench local n’est pas fourni par cette solution. Sans serveur de debug local, tester le package déployé dans une vraie page SharePoint en mode édition.

## Développement local, aperçu et tests

```bash
# Node 22, >=22.14 et <23
npm ci
npm run trust-dev-cert     # sur la machine qui exécute Node, sans Docker
npm start                 # serveur de debug HTTPS 4321

# Aperçu hors SharePoint : mêmes composants React, uniquement démonstration/simulations
npm run preview:build
npm run preview           # http://localhost:3000

npm test                  # tests unitaires et transport SharePoint simulé
npx playwright install chromium
npm run test:browser      # navigateur : interactions, responsive, axe WCAG A/AA
npm run build             # tests unitaires + lint + TS + bundle production + package
```

Le package résultant est `sharepoint/solution/bbi-intranet.sppkg`. Le copier vers `../deliverables/spfx/bbi-intranet.sppkg` après validation. Version solution : **1.1.0.0**. Les IDs du catalogue, des documents et de la solution sont conservés pour la mise à niveau. Le catalogue et les documents conservent leurs anciennes propriétés de source (`listTitle` / `libraryTitle`, `siteUrl`, `maxItems`). Le nouveau mode par défaut est **réel**, même sur les anciennes instances.

## Sécurité et limites de validation

- Les requêtes s’exécutent dans le contexte de l’utilisateur connecté. Les filtres du planning ne remplacent **jamais** les permissions de la liste.
- `web=1` demande une ouverture navigateur, **ne bloque pas le téléchargement/l’impression**. Configurer permissions, labels/IRM et accès conditionnel côté Microsoft 365. Les captures d’écran ne sont pas bloquées.
- Liens HTTP(S) uniquement, e-mails validés ; contenu rendu par React sans injection HTML. Pour la production, privilégier HTTPS et des images hébergées dans le tenant.
- La démonstration ne contacte pas SharePoint et affiche un bandeau permanent. Elle ne prouve pas une intégration au tenant.
- Tests et validation du manifeste local documentés dans [`docs/VALIDATION.md`](docs/VALIDATION.md). Le provisioning PnP et le workbench authentifié doivent encore être validés dans **votre tenant** : aucun tenant n’a été utilisé dans cet environnement.
