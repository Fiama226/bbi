# BBI Intranet — Solution SPFx (SharePoint Online)

Solution **SPFx 1.22.2** contenant les trois web parts métier de l'intranet Business Builders International :

| Web part | ID | Rôle |
|---|---|---|
| **BBI Accueil** | `6a9b6e3b-44f1-4a70-8f0a-45c82b29126d` | Page d'accueil responsive : actualités, sessions, accès rapides, formateurs, catalogue et supports. Chaque liste absente affiche des données d'exemple. |
| **BBI Catalogue des formations** | `d37a426e-48db-484f-bf10-c38675bb7b43` | Cartes filtrables (filière) + recherche, alimentées par la liste `Formations`. Affiche des données d'exemple si la liste n'existe pas encore. |
| **BBI Documents sécurisés** | `c9a1e6d4-3b27-4e1f-8f5a-6d0b9c2e7a41` | Visionneuse des supports publiés : badge 🔒 *Lecture seule*, ouverture **navigateur uniquement** (`?web=1`). La protection réelle (anti-téléchargement / anti-impression) est appliquée par la plateforme : permissions *Lecture*, étiquette de sensibilité ou IRM, accès conditionnel — voir `../deliverables/index.html` §7. |

Package prêt à installer : **`../deliverables/spfx/bbi-intranet.sppkg`** (assets embarqués, déploiement tenant autorisé).

---

## 1. Test rapide sans Docker (production) — 5 minutes

1. Télécharger `deliverables/spfx/bbi-intranet.sppkg`.
2. SharePoint admin center → **More features** → **App catalog** (ou la page du catalogue) → *Distribute apps for SharePoint*.
3. **Upload** du `.sppkg` → cocher *Make this solution available to all sites* → **Deploy**.
4. Ouvrir une page moderne → **Éditer** → **+** → catégorie *Advanced* (ou recherche « BBI ») → ajouter **BBI Accueil**. Il peut être placé seul sur une page pleine largeur.
5. Republisher la page. Les web parts affichent des exemples tant que les listes n'existent pas (§5).

> Vous pouvez aussi tester dans le **workbench hébergé** : `https://<votretenant>.sharepoint.com/_layouts/15/workbench.aspx` → ajouter les web parts.

---

## 2. Développement avec Docker (workbench)

⚠️ **À savoir** : depuis SPFx 1.20+ (pipeline Heft), le *workbench local* (`localhost:4321/temp/workbench.html`) **n'existe plus**. Le conteneur Docker héberge le **serveur de debug** (code compilé en continu sur `https://localhost:4321`), et la page de test est le **workbench hébergé de votre tenant** (`https://<tenant>.sharepoint.com/_layouts/15/workbench.aspx`). Il vous faut donc un tenant M365 (le tenant développeur gratuit du *Microsoft 365 Developer Program* convient parfaitement).

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
https://<VOTRE-TENANT>.sharepoint.com/_layouts/15/workbench.aspx?debug=true&noredir=true&loadSPFX=true&debugManifestsFile=https://localhost:4321/temp/build/manifests.js
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

## 7. Sécurité

Les web parts **n'ajoutent pas** de sécurité : elles *révèlent* ce que le serveur autorise. Toute la protection des supports repose sur la configuration plateforme (permissions Lecture, étiquette de sensibilité « afficher uniquement »/IRM, accès conditionnel web-only, audit) — détaillée dans le dossier de conception §7.
