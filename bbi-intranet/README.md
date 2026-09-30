# BBI Intranet — Solution SPFx (SharePoint Online)

Solution **SPFx 1.22.2** pour l'intranet Business Builders International. Le package embarque aussi des briques autonomes historiques, mais **le portail demandé ne nécessite qu'une seule web part sur une seule page** : `BBI Accueil — portail unifié`.

| Web part | ID | Rôle |
|---|---|---|
| **BBI Accueil — portail unifié** | `6a9b6e3b-44f1-4a70-8f0a-45c82b29126d` | **La seule web part à ajouter à la page SharePoint** : une application interne avec Accueil (héros en diaporama images + textes, chiffres clés sous le héros, employé du mois, certifications), Formations, Sessions, Actualités (flux paginé + **page dédiée par actualité**), Ressources (documents + galerie), Communauté (annuaire des formateurs avec **photo et fiche contact WhatsApp/Teams**) et **Organigramme interactif**. La navigation change de vue sans recharger ni quitter cette page. **Plein écran dans tous les sens** : chrome SharePoint, barre de commandes et cadre du workbench masqués, dans le package publié comme dans le workbench. **Alt + Maj + E** rétablit le chrome SharePoint quand vous devez gérer la page. |
| **BBI Catalogue des formations** | `d37a426e-48db-484f-bf10-c38675bb7b43` | Cartes filtrables (filière) + recherche, alimentées par la liste `Formations`. Affiche des données d'exemple si la liste n'existe pas encore. |
| **BBI Galerie médias** | `f0f19a37-2c11-4812-9006-8aa71a9254f1` | Galerie photos/vidéos alimentée par la bibliothèque d'images « Galerie médias » : albums filtrables, mosaïque, visionneuse plein écran accessible (clavier, focus, `aria-modal`), vidéos mp4, vignettes générées par SharePoint. |
| **BBI Plein écran** *(extension)* | `ae430672-9740-4b5a-ace1-fd5d5ab6e9bf` | Application Customizer : supprime les marges du canevas **uniquement sur les pages applicatives** (`SingleWebPartAppPage`) pour un rendu bord à bord réel, **et dans le workbench hébergé**, où il retire en plus la barre de commandes et le cadre d'édition. `hideCommandBar` vaut `true` par défaut. Propriétés : `mode`, `edgeToEdge`, `hidePageTitle`, `hideCommandBar`, `topBannerText`, `customCss`. |
| **BBI Fiche formation** *(modèle)* | `a9c99e25-db18-4419-894b-08bc9c5b9081` | Modèle de page : la page lit `?code=BBI-MGT-101` et affiche présentation, objectifs, programme, prérequis, public visé, prochaines sessions (Événements de la liste Sessions, filtrées par code), supports publiés et formateurs référents. |
| **BBI Sessions & inscriptions** | `96216ee2-85b1-473b-aaec-e5b646a151ee` | Planning groupé par mois : recherche, filtres filière/modalité, statut d'inscription, lien « Ajouter à mon agenda » (Outlook) et lien vers la fiche formation (code extrait du titre). |
| **BBI Article d'actualité** *(modèle)* | `f769f3df-2c27-4a30-bce2-d4ae5793557b` | Modèle de page : lit `?itemid=12`, affiche visuel, chapô, auteur, temps de lecture, partage (e-mail/Teams/copie du lien) et actualités liées. Le HTML éditorial est nettoyé (scripts et événements retirés). |
| **BBI Documents sécurisés** | `c9a1e6d4-3b27-4e1f-8f5a-6d0b9c2e7a41` | Brique autonome conservée dans le package ; ses contenus sont intégrés dans la vue Ressources du portail. |

> Pour le déploiement standard : téléversez le package, puis ajoutez **uniquement `BBI Accueil — portail unifié`** à `accueil.aspx`. N'ajoutez pas les briques Catalogue, Galerie ou Documents séparément.

Package prêt à installer : **`../deliverables/spfx/bbi-intranet.sppkg`** — version **1.7.0.0** (7 web parts + 1 extension, assets embarqués, déploiement tenant autorisé).

### Contenus de repli (production ready)

Toutes les sources sont tolérantes : liste absente (404), liste non créée, **ou liste créée mais vide** → la page reste complète.

| Composant | Source | Si absente / vide |
|---|---|---|
| BBI Accueil | `Actualites`, `Sessions`, `Formateurs` | Actualités (12), sessions à venir (8) et formateurs d'exemple (10, coordonnées complètes) |
| BBI Accueil — vie de l'équipe | `Employés du mois`, `Certifications` | 1 portrait (Léa Marchand) + 4 certifications (Qualiopi, Datadock, BBI, TOSA/ICDL) |
| BBI Accueil — organigramme | `Organigramme` | Arbre de 12 postes (direction, 4 pôles, antennes) avec coordonnées |
| BBI Catalogue | `Formations` | 5 formations BBI représentatives |
| BBI Fiche formation | `Formations`, `Sessions`, `Supports publiés`, `Formateurs` | Fiche complète (objectifs, programme, prérequis, sessions, supports, référent) — y compris pour un code inconnu |
| BBI Sessions | `Sessions`, `Formations` | Planning de 6 sessions réparties sur les mois à venir |
| BBI Article | `Actualites` | Article rédigé (corps > 300 caractères) + 3 actualités liées + visuel embarqué |
| BBI Galerie | `Galerie médias` | 8 photos réparties dans 4 albums (4 visuels embarqués) |
| BBI Documents | `Supports publiés` | 4 supports ; le bouton d'ouverture est neutralisé (aucun fichier inexistant n'est appelé) |

Les bandeaux « données de démonstration » sont masqués par défaut : option `showDataNotices` dans le volet de propriétés (manifeste : `false`).

**Vérifications :** `node tools/verify-fallback.js` — **128 contrôles** exécutés sur les couches de données réelles (aucun accès réseau requis) · `node tools/css-harness.js release` — styles et classes réellement injectés, barre de navigation opaque, chiffres clés sous le héros (jamais par-dessus), accueil sans organigramme, annonces déroulantes, pagination, navigation · `node tools/preview-smoke.js` — **34 contrôles** de parcours sur l'aperçu cliquable (`deliverables/audit-2026/apercu-portail.html`).

> Le harnais CSS se lance sur `release` après un build de production (`npx heft build --production`) : en production, les bundles sont écrits dans `release/assets/`, pas dans `dist/`.

> **Provisionnement** : `../deploy/provision-bbi-intranet.ps1` crée les listes, bibliothèques (dont « Galerie médias »), **une page d'accueil et une web part**. Les anciennes pages éventuellement déjà présentes ne sont pas supprimées ; le nouveau menu ne les utilise plus. Guide : `../deploy/README.md`.

---

## 1. Test rapide sans Docker (production) — 5 minutes

1. Télécharger `deliverables/spfx/bbi-intranet.sppkg`.
2. SharePoint admin center → **More features** → **App catalog** (ou la page du catalogue) → *Distribute apps for SharePoint*.
3. **Upload** du `.sppkg` → cocher *Make this solution available to all sites* → **Deploy**.
4. Ouvrir une page moderne → **Éditer** → **+** → catégorie *Advanced* (ou recherche « BBI ») → ajouter **BBI Accueil**. Il peut être placé seul sur une page pleine largeur.
5. Republisher la page. Les web parts affichent des exemples tant que les listes n'existent pas (§5).

> Vous pouvez aussi tester dans le **workbench hébergé** : `https://businessbuilderinter.sharepoint.com/_layouts/15/workbench.aspx` → ajouter les web parts.

---

## 2. Développement avec Docker (workbench)

⚠️ **À savoir** : depuis SPFx 1.20+ (pipeline Heft), le *workbench local* (`localhost:4321/temp/workbench.html`) **n'existe plus**. Le conteneur Docker héberge le **serveur de debug** (code compilé en continu sur `https://localhost:4321`), et la page de test est le **workbench hébergé de votre tenant** — pour BBI : `https://businessbuilderinter.sharepoint.com/_layouts/15/workbench.aspx`
(également renseigné dans `webpack.dev.config.js` et `.vscode/launch.json` — ce projet est *éjecté*, donc `webpack.dev.config.js` fait autorité et non `config/serve.json`). Il vous faut donc un tenant M365 (le tenant développeur gratuit du *Microsoft 365 Developer Program* convient parfaitement).

### Démarrage

```bash
cd bbi-intranet
cp .env.example .env            # puis renseigner votre domaine : SPFX_TENANT_DOMAIN=monTenant.sharepoint.com
docker compose up --build -d    # build image + npm install + serveur de dev
docker compose logs -f          # attendre « Started Webpack Dev Server » puis Ctrl+C
```

### Ouvrir le workbench hébergé en mode debug

1. **Accepter d'abord le certificat auto-signé** du serveur de dev : ouvrir une fois `https://localhost:4321/` et valider l'avertissement navigateur.
   *(Linux/Docker : le certificat est `/home/user/.rushstack/rushstack-serve.pem` dans le conteneur — montez-le ou acceptez simplement l'avertissement.)*
2. Ouvrir :

```
https://businessbuilderinter.sharepoint.com/_layouts/15/workbench.aspx?debug=true&noredir=true&debugManifestsFile=https://localhost:4321/temp/manifests.js
```

3. **+** → *Advanced* → ajouter **BBI Accueil** (ou les web parts individuelles) → les versions de *debug* (hot-reload) s'affichent.

### Boucle de développement

- Modifiez le code sous `src/` → recompilation incrémentale automatique → rafraîchir le workbench.
- Arrêt : `docker compose down`.
- Astuce : lancer des commandes dans le conteneur → `docker compose exec spfx bash`.

---

## 3. Développement sans Docker

Prérequis : **Node.js 22** (>= 22.14). 

```bash
npm install
SPFX_SERVE_TENANT_DOMAIN=monTenant.sharepoint.com npm run start   # serveur de debug port 4321
# puis même URL de workbench hébergé que ci-dessus
```

---

## 3 bis. Dépannage — « Script error » / « Something went wrong » au chargement d'une web part

### Ce que signifie l'erreur

```
Could not load bbi-home-web-part in require. Error: Script error for "6a9b6e3b-44f1-4a70-8f0a-45c82b29126d_*"
https://requirejs.org/docs/errors.html#scripterror
    at makeError (...)
    at HTMLScriptElement.onScriptError (...)
```

Une seule lecture possible : **le navigateur n'a pas réussi à télécharger le fichier JavaScript de la web part.**

Le manifeste, lui, s'est bien chargé — sinon la web part n'apparaîtrait pas du tout dans la boîte à outils.
C'est donc le **bundle** (`bbi-home-web-part_*.js`) qui est introuvable ou bloqué. Le chargeur SPFx
(`@microsoft/sp-loader`) résout l'URL ainsi :

```
internalModuleBaseUrls[0]  +  "/"  +  scriptResources[entryModuleId]
```

* **mode debug** (workbench + `debugManifestsFile`) :
  `https://localhost:4321/dist/` + `bbi-home-web-part_en-us_<hash>.js`
* **mode production** (`.sppkg` déployé) :
  `HTTPS://SPCLIENTSIDEASSETLIBRARY/` + `../assets/bbi-home-web-part_en-us_<hash>.js`

### Le diagnostic en 30 secondes (à faire en premier)

1. Ouvrez la page, appuyez sur **F12** → onglet **Réseau** (Network).
2. Cochez **Conserver le journal** / *Preserve log*, puis rechargez et ajoutez la web part.
3. Cherchez la requête en rouge (statut `404`, `failed`, `(blocked)` ou `ERR_CERT_*`).
4. Regardez son URL : elle vous dit immédiatement laquelle des causes ci-dessous s'applique.

| URL de la requête en échec | Cause | Correctif |
|---|---|---|
| `https://localhost:4321/dist/...` | Le serveur de debug n'est pas démarré, s'est arrêté, ou son certificat auto-signé n'est pas accepté | Relancer `npm run start`, ouvrir **une fois** `https://localhost:4321/` et valider le certificat |
| `https://localhost:4321/dist/...` avec un **hash qui n'existe plus** dans `dist/` | Page du workbench périmée : webpack a recompilé (nouveaux hachages) sans rechargement | **Recharger** la page du workbench (F5) après chaque recompilation |
| `https://<tenant>.sharepoint.com/.../ClientSideAssets/...` | La solution est *installée* mais pas **déployée** : la bibliothèque *Client Side Assets* est vide | Catalogue d'applications → solution → **Deploy** (et cocher « disponible pour tous les sites ») |
| `https://<tenant>.sharepoint.com/...` en `404` | Version en cache côté SharePoint après un *Upgrade* | Attendre quelques minutes, puis `?web=0` / vider le cache ; au besoin ré-uploader le `.sppkg` en **Upgrade** |
| `(blocked:mixed-content)` ou `ERR_CERT_*` | Page HTTPS + ressource HTTP, ou certificat non validé | Passer le workbench et le serveur de debug en HTTPS |

### Vérifier le package avant de le téléverser

Un package incohérent (manifeste qui pointe vers un bundle absent) produit **exactement** cette erreur.
Le dépôt fournit un contrôle automatique, sans dépendance externe :

```bash
node tools/verify-package.js           # vérifie deliverables/spfx/bbi-intranet.sppkg
node tools/verify-package.js --dev     # vérifie temp/manifests.js + dist/ (chemin workbench debug)
```

Le contrôle échoue (code de sortie 1) si un bundle référencé manque, si l'extension `js` n'est pas
déclarée dans `[Content_Types].xml`, ou si le package contient des bundles orphelins.

### Rappels de déploiement

1. **Toujours reconstruire proprement** : `npm run build` nettoie désormais `release/` avant de compiler
   (`heft clean && ...`). Sans ce nettoyage, d'anciens bundles s'accumulent dans `release/assets` et
   finissent embarqués dans le `.sppkg` sans être référencés par aucun manifeste.
2. **Copier** le résultat dans `../deliverables/spfx/` puis **Upgrade** dans le catalogue d'applications.
3. **Vérifier le déploiement** : catalogue d'applications → la solution doit afficher *Deployed*
   (et non seulement *Validated* / *Installed*).
4. La web part à poser est **`BBI Accueil (plein écran)`** (id `6a9b6e3b-44f1-4a70-8f0a-45c82b29126d`).

---

## 4. Recompiler le package (.sppkg)

```bash
npm run build            # lint + TS + bundle production
# → sharepoint/solution/bbi-intranet.sppkg
```

Copier ensuite le `.sppkg` vers `../deliverables/spfx/` et le redéployer sur l'App Catalog (l'App Catalog propose « *Upgrade/Add* » — les instances existantes des web parts se mettent à jour).

---

## 5. Créer les listes et bibliothèques

Dans le site SharePoint cible, ouvrir **Contenu du site → Nouveau → Liste → Liste vierge**. Créer les listes ci-dessous avec le titre indiqué, puis ajouter les colonnes en conservant exactement leur nom (les noms sans espace deviennent les noms internes utilisés par l'API). `Title` est la colonne par défaut de SharePoint.

| Titre de liste | Colonnes à ajouter (nom : type) |
|---|---|
| `Actualites` | `Summary` : plusieurs lignes de texte ; `Category` : une ligne de texte ; `Published` : date et heure ; `AuthorName` : une ligne de texte ; `ImageUrl` : une ligne de texte ; `LinkUrl` : une ligne de texte contenant une URL complète. |
| `Sessions` | `StartDate` : date et heure ; `Modality` : choix (`Présentiel`, `Distanciel`, `Hybride`) ; `Location` : une ligne de texte ; `Status` : une ligne de texte ; `RegistrationUrl` : une ligne de texte contenant une URL complète. |
| `Formateurs` | `Role` : une ligne de texte ; `Filiere` : une ligne de texte ; `Initials` : une ligne de texte. |
| `Formations` | `CodeFormation`, `Filiere`, `Modalite`, `Niveau`, `StatutCatalogue` : une ligne de texte ; `DureeH` : nombre. Valeur de `StatutCatalogue` : `Actif`. |

Pour les documents, ouvrir **Contenu du site → Nouveau → Bibliothèque de documents** et nommer la bibliothèque `Supports publiés`. La web part utilise les colonnes natives `Title`, `FileRef`, `FileLeafRef` et `Modified`.

Après création, ajouter **BBI Accueil** sur la page d'accueil en mode édition. Dans ses propriétés, vérifier les titres des listes et de la bibliothèque; laisser l'URL du site vide pour utiliser le site courant. Publier la page puis choisir **Définir comme page d'accueil** depuis la bibliothèque **Pages du site** si elle doit remplacer l'accueil du site.

Si une liste ou la bibliothèque n'existe pas, ou si son schéma n'est pas encore prêt, la section concernée affiche son jeu d'exemples et un bandeau explicatif. Une liste présente mais vide affiche un état vide, sans inventer de données.

## 6. Données attendues (mode réel)

**Liste `Formations`** (sur le site du catalogue, par défaut le site courant de la web part) — colonnes utilisées : `Title`, `CodeFormation`, `Filiere`, `Modalite`, `DureeH`, `Niveau`, `StatutCatalogue` (valeur `Actif` = affiché). Colonnes absentes = valeurs vides, la web part le gère.

**Bibliothèque `Supports publiés`** — documents avec nom/titre ; tri par date de modification décroissante ; ouverture en `?web=1` (visionneuse navigateur).

> Le catalogue, les documents, les actualités, les sessions et les formateurs basculent indépendamment en **données d'exemple** lorsque leur source est absente ou inaccessible.

## 6 bis. Annonces déroulantes, plein écran et chiffres clés

### Bandeau d'annonces déroulant

La première section au-dessus de la barre de navigation n'affiche plus un texte fixe : c'est un **ruban d'annonces qui défile en boucle**. Chaque annonce est un lien qui ouvre sa **page de détail** partageable (`#actualite?id=12`).

- **Source par défaut** : les dernières actualités (`Actualites`). Le ruban se remplit tout seul, sans configuration.
- **Source personnalisée** : propriété `announcementText`, **une ligne par annonce** — `libellé | lien`. Le lien accepte une ancre du portail (`#actualite?id=12`, `#sessions`…) ou une URL externe ; une URL dangereuse (`javascript:`) est neutralisée vers `#actualites`, une annonce sans lien mène aux actualités.
- **Confort de lecture** : le ruban se fige au survol et dès qu'une annonce reçoit le focus (clavier compris). Si l'utilisateur a demandé « animations réduies », il ne bouge plus et devient simplement défilable.
- **Accessibilité** : la seconde copie du ruban (celle qui rentre par la droite) est `aria-hidden` et retirée du parcours de tabulation — chaque annonce n'est annoncée et atteinte qu'une fois.
- Masquer tout le bandeau : propriété `enableAnnouncement` (par défaut `true`).

### Plein écran réel (workbench et application installée)

Le portail occupe toute la fenêtre, **y compris dans le workbench hébergé** : en-tête de site, barre de navigation gauche, barre de commandes, bandeau d'applications et cadre d'édition du workbench sont masqués, le canevas est élargi à 100 % sans marge ni bordure. L'extension **BBI Plein écran** applique le même traitement (elle masque aussi la barre de commandes dans le workbench, `hideCommandBar` vaut `true` par défaut).

> **Alt + Maj + E** bascule le chrome SharePoint : pratique pour revenir à l'écran SharePoint classique et gérer la page (supprimer une web part, par exemple) sans toucher au code.

### Chiffres clés sous le héros

La bande des 4 chiffres clés est posée **sous** le diaporama, dans le flux normal. Elle remontait auparavant de 48 px par-dessus le héros et masquait les pastilles, les flèches, le lien « Explorer » et le bas des textes lorsque le héros était chargé (titre long, petit écran). Aucune marge négative : les chiffres ne peuvent plus recouvrir un bouton.

> L'accueil s'arrête aux contenus de l'accueil : l'**organigramme** et la **page d'une actualité** ne s'y affichent plus, ils restent accessibles par leur propre vue (`#organigramme`, `#actualite?id=12`).

## 7. Sécurité

Les web parts **n'ajoutent pas** de sécurité : elles *révèlent* ce que le serveur autorise. Toute la protection des supports repose sur la configuration plateforme (permissions Lecture, étiquette de sensibilité « afficher uniquement »/IRM, accès conditionnel web-only, audit) — détaillée dans le dossier de conception §7.
