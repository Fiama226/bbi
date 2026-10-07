# Hub + sites par filiale, cartes de sites et annuaires en tuiles — design

Date : 2026-10-07
Statut : approuvé en conversation, en attente de relecture du document

## 1. Intention

BBI veut que l'intranet suive le modèle observé sur le tenant ActionCoach :
un **site hub** (le siège, `/sites/intranet`) relié à **un site par filiale**,
chacun exécutant le même portail BBI mais alimenté par ses propres listes.
Sur la page d'accueil du siège, les implantations deviennent des **cartes de
sites** colorées (logo/initiales, nom, pays, bouton « Ouvrir le site »), et
les blocs *Documents administratifs* et *Références pédagogiques* adoptent le
style **annuaire de liens** (tuiles icône + libellé groupées par thème).
L'ordre des sections de l'accueil suit le croquis client (dossier
`recommendation/`).

### Ce que le client a dit
- Hub + un site par filiale (pas un site unique, pas de simples liens).
- Chaque filiale exécute le **même portail avec ses propres données**.
- « Toutes » les filiales sont à provisionner : au démarrage, celles des
  données de démonstration (Siège Paris, Filiale Abidjan, Antenne Bamako,
  Antenne Dakar) ; le mécanisme est piloté par la liste pour en ajouter.
- Cartes de sites façon ActionCoach sur l'accueil siège.
- Navigation hub SharePoint standard sur tous les sites.
- Style tuiles icône + libellé pour Documents administratifs et Références
  pédagogiques.
- Sites de filiale = **sites d'équipe connectés à un groupe Microsoft 365**.

### Hypothèses
- La liste `Implantations` est la **source unique de vérité** des filiales.
- Les sites de filiale sont créés par le script de provisioning, pas à la main.
- Aucune agrégation inter-sites (sessions/actualités des filiales remontées au
  siège) dans cette itération.

### Critères de succès
- Un éditeur ajoute une ligne à `Implantations`, relance le script : le site
  existe, est rattaché au hub, porte le portail, et sa carte apparaît sur
  l'accueil du siège.
- Une liste `Implantations` **ancienne** (sans les nouvelles colonnes) continue
  de s'afficher sans erreur (contrat trois états respecté).
- `verify-fallback.js`, `css-harness.js`, `npx heft build` passent.

## 2. Modèle de données

### Liste `Implantations` — trois colonnes ajoutées
| Nom affiché | Nom interne | Type | Rôle |
|---|---|---|---|
| Site SharePoint | `SiteUrl` | Hyperlink | URL du site de la filiale (siège : `/sites/intranet`) |
| Couleur | `Couleur` | Text | Hex `#RRGGBB` du bandeau de la carte |
| Initiales | `Initiales` | Text | 1 à 3 lettres affichées dans le carré logo |

`IHomeOffice` (homeData.ts) reçoit `SiteUrl?`, `Couleur?`, `Initiales?`.
Les données de démo renseignent ces trois champs pour les quatre implantations.
Une ligne sans `SiteUrl` est valide : la carte s'affiche sans bouton.

### Fichier `bbi-environnement.json` — deux clés ajoutées
```json
"hubEnabled": true,
"filialeSitePrefix": "intranet-"
```
Aucune liste de filiales dans ce fichier.

## 3. Provisioning (`deploy/provision-bbi-intranet.ps1`)

### Refactor préalable
Les étapes actuelles 2 à 5 (listes, bibliothèques, pages, web part, extension
plein écran) sont enveloppées dans une fonction `Invoke-BbiSiteProvisioning
-SiteUrl <url> -SeedDemo <bool>`. Le script l'appelle une fois pour le siège,
puis une fois par filiale. Le comportement du script **sans** le nouveau
commutateur est inchangé.

### Nouveau commutateur `-ProvisionFiliales`
Section « 6/10 · Hub et filiales », idempotente, respectant `-DryRun` et
`-VerifyOnly` :
1. **Hub** : si `/sites/intranet` n'est pas un hub, `Register-PnPHubSite`.
2. **Sites** : pour chaque ligne `Implantations` avec `EstSiege` faux :
   - slug = `filialeSitePrefix` + `Ville` normalisée (minuscules, sans
     accents ni espaces) → alias et URL `/sites/intranet-abidjan` ;
   - si le site n'existe pas : `New-PnPSite -Type TeamSite -Alias <slug>
     -Title "<Title>"` ;
   - `Add-PnPHubSiteAssociation` vers le hub ;
   - réécriture de `SiteUrl` dans la ligne.
3. **Portail** : `Invoke-BbiSiteProvisioning -SiteUrl <site filiale>
   -SeedDemo $false`. Les propriétés de la web part pointent `siteUrl` sur le
   site de la filiale. Les listes de filiale restent vides : le repli trois
   états affiche le contenu de démonstration jusqu'au remplissage.
4. **Permissions** : le groupe `BBI-Concepteurs` est ajouté au groupe
   *Membres* du site d'équipe. Les propriétaires du groupe M365 font office
   d'éditeurs locaux. Aucun groupe SharePoint supplémentaire.
5. **Navigation hub** : reconstruite depuis les lignes : Siège en premier,
   puis filiales par `Ordre`, libellé = `Title`, lien = `SiteUrl`.

### Prérequis
Le package `.sppkg` doit être **Déployé** dans le catalogue d'applications
avant l'étape 3, car chaque site de filiale installe la même application.

## 4. Web part (`src/webparts/bbiHome`)

### `SiteNetwork.tsx` + `.module.scss` (remplace `OfficeNetwork` sur l'accueil)
Carte par implantation : bandeau en `Couleur` (repli : couleur primaire du
thème), carré logo avec `Initiales` (repli : deux premières lettres de
`Title`), badge « Siège » ou libellé « Filiale », `Ville · Pays`, bouton
« Ouvrir le site » si `SiteUrl` (href via `safeUrl`), puis téléphone,
e-mail, lien carte comme aujourd'hui. Tri : siège puis `Ordre`.
`OfficeNetwork.tsx` est supprimé une fois le remplacement en place.

### `LinkDirectory.tsx` + `.module.scss` (nouveau, générique)
Props : `groups: { title: string; items: { icon: string; label: string;
href: string; hint?: string }[] }[]`. Rendu : titre de groupe puis grille
deux colonnes de tuiles icône + libellé (+ indice optionnel). Les hrefs
passent par `safeUrl` ; un href rejeté rend la tuile sans lien.

Deux adaptateurs purs dans `linkDirectoryData.ts` (testables sans navigateur) :
- `adminDocumentsToGroups(docs)` : groupe par `Categorie` (repli « Autres »),
  icône déduite de l'extension du fichier (pdf, docx, xlsx, pptx, autre).
- `pedagogicalReferencesToGroups(refs)` : groupe par `Categorie`, icône tirée
  d'un petit jeu interne indexé par catégorie, href = `LienUrl`.

Les rendus en cartes actuels de ces deux blocs sont retirés de l'accueil ;
les chargeurs de données sont inchangés.

### Ordre des sections de l'accueil (croquis client)
1. Hero avec Vision / Mission / Objectifs
2. Trombinoscope (bandeau)
3. Ligne deux colonnes : Documents administratifs (annuaire) | Parcours
   pédagogiques (= l'aperçu existant du catalogue Formations, sans nouveau
   composant) + lien vers la vue Nos Plannings
4. Ligne deux colonnes : Annonces | Pensée du jour + Anniversaires
5. Siège / Filiales (`SiteNetwork`)
6. Nos références (pied)

Références pédagogiques reste accessible sous Formations, rendu en annuaire.

### Mode filiale
Aucun code spécifique : la même web part, avec `siteUrl` sur le site de la
filiale, lit les listes de la filiale. Le retour au siège passe par la
navigation hub.

## 5. Tests et vérification

- `tools/verify-fallback.js` : trois états pour `Implantations` **avec** et
  **sans** les nouvelles colonnes ; `adminDocumentsToGroups` et
  `pedagogicalReferencesToGroups` : catégorie vide, extension inconnue, href
  non sûr rejeté, liste vide → aucun groupe.
- `tools/css-harness.js` : garde sur l'injection des classes bandeau de carte
  (`SiteNetwork`) et grille de tuiles (`LinkDirectory`).
- Script : `-DryRun -ProvisionFiliales` liste les actions sans rien créer ;
  `-VerifyOnly -ProvisionFiliales` audite hub, sites, listes.
- Première exécution réelle sur **une seule** filiale (Abidjan) avant les
  autres.

## 6. Déploiement
1. `npm run build`, copie du `.sppkg` dans `deliverables/spfx/`, Upgrade dans
   le catalogue, confirmer **Déployé**.
2. `.\provision-bbi-intranet.ps1 -ProvisionFiliales -DryRun`, puis sans
   `-DryRun`.
3. Vérifier l'accueil siège (cartes de sites, annuaires), puis un site de
   filiale (portail, navigation hub).

## 7. Hors périmètre
- Marque par filiale au-delà de `Couleur`.
- Agrégation inter-sites de sessions ou d'actualités sur le siège.
- Migration de documents existants.
- Mise à jour du HTML d'aperçu `deliverables/audit-2026/` (passe ultérieure).
