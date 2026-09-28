# BBI Intranet — Guide de mise en place (listes, documents, galerie, page plein écran)

Ce dossier contient **le script d'installation complet** de l'intranet BBI : il crée les listes,
les bibliothèques, les colonnes, les vues, les pages, la galerie médias, la page d'accueil plein
écran et l'identité visuelle — **exactement dans le format attendu par le code SPFx**.

> Expérience **sans aucun chrome SharePoint** (Teams / Viva Connections) : [`../teams/README.md`](../teams/README.md)
> Fichier principal : [`provision-bbi-intranet.ps1`](./provision-bbi-intranet.ps1)
> Package SPFx à installer avant : [`../deliverables/spfx/bbi-intranet.sppkg`](../deliverables/spfx/bbi-intranet.sppkg) (v1.2.0.0)

---

## 0. Ce que vous obtenez à la fin

| Page | Type | Contenu |
|---|---|---|
| `accueil.aspx` | **Page applicative plein écran** | Web part `BBI Accueil` : héros 100 % écran, bandeau d'info, chiffres clés, accès directs, actualités, sessions, catalogue, galerie, supports, formateurs |
| `catalogue.aspx` | Page article | `BBI Catalogue des formations` (recherche + filtres par filière) |
| `galerie.aspx` | Page article | `BBI Galerie médias` (albums + visionneuse plein écran) |
| `formation.aspx` | **Modèle de page** | `BBI Fiche formation` — une fiche par formation, pilotée par `?code=BBI-XXX` |
| `sessions.aspx` | Page article | `BBI Sessions & inscriptions` (planning groupé par mois, filtres, agenda) |
| `article.aspx` | **Modèle de page** | `BBI Article d'actualité` — piloté par `?itemid=12` |
| `vie-bbi.aspx` | Page article | Variante compacte de l'accueil (vie d'entreprise) |
| `support.aspx`, `mentions-legales.aspx` | Pages article | À compléter (FAQ, mentions) |

Et les listes : `Actualites`, `Sessions`, `Formateurs`, `Formations`, `Supports publiés`, `Galerie médias`.

> **Les pages sont présentables dès la fin du déploiement, même sans aucune donnée.** Si une liste, une
> bibliothèque ou la galerie est absente, non créée ou encore vide, la web part affiche un contenu de
> repli réaliste et professionnel (textes et visuels BBI embarqués dans le package). Rien à configurer :
> vos premiers éléments publiés remplacent automatiquement les exemples, bloc par bloc.
>
> Pour visualiser ce mécanisme pendant la mise en place, activez l'option **« Afficher les indicateurs de
> données de démonstration »** dans le volet Propriétés de chaque web part : un bandeau précise alors la
> source concernée. L'option est **désactivée par défaut** (aucun indicateur en production).

---

## 0 bis. Que se passe-t-il si une source est vide ?

| Web part | Source surveillée | Comportement si absente / vide | Ce qui remplace les exemples |
|---|---|---|---|
| `BBI Accueil` | `Actualites`, `Sessions`, `Formateurs` | Blocs alimentés par des exemples datés relativement | Publier une actualité / une session / un formateur |
| `BBI Catalogue` | `Formations` | 5 formations représentatives | Publier une formation (`Statut catalogue = Actif`) |
| `BBI Fiche formation` | `Formations`, `Sessions`, `Supports publiés`, `Formateurs` | Fiche complète même pour un code inconnu | Renseigner `Code formation` sur la formation |
| `BBI Sessions & inscriptions` | `Sessions`, `Formations` | Planning de 6 sessions sur les mois à venir | Publier des sessions avec `Date de début` |
| `BBI Article d'actualité` | `Actualites` | Article rédigé + 3 actualités liées + visuel | Renseigner le `Corps de l'article` |
| `BBI Galerie médias` | `Galerie médias` | 8 photos dans 4 albums | Téléverser une image dans la bibliothèque |
| `BBI Documents sécurisés` | `Supports publiés` | 4 supports, ouverture neutralisée | Publier un document dans la bibliothèque |

Le remplacement se fait **source par source** : vous pouvez publier les actualités avant les sessions,
l'accueil reste cohérent à chaque étape.

**Vérifier soi-même** (optionnel, sans SharePoint) :

```powershell
cd ../bbi-intranet
node tools/verify-fallback.js     # 42 contrôles : source absente, source vide, source alimentée
```

Pour voir le rendu sans rien installer, ouvrez `deliverables/audit-2026/apercu-repli.html` dans un
navigateur : la galerie, le catalogue et les documents y sont présentés tels qu'ils apparaissent
quand la source n'existe pas encore.

---

## 1. Prérequis (5 minutes)

```powershell
# Windows PowerShell 7 recommandé
Install-Module PnP.PowerShell -Scope CurrentUser

# Autoriser l'authentification interactive PnP (si votre tenant l'exige)
Register-PnPEntraIDAppForInteractiveLogin -ApplicationName "PnP PowerShell BBI" -Tenant votretenant.onmicrosoft.com
```

Droits nécessaires : **administrateur SharePoint** (ou propriétaire du site + droit de publier un thème).

---

## 2. Étape 1 — Déployer la solution SPFx

1. Téléverser `bbi-intranet.sppkg` dans le **catalogue d'applications** (Centre d'administration SharePoint → *Autres fonctionnalités* → *Catalogue d'applications* → *Distribuer des applications*).
2. Cocher **« Rendre cette solution disponible pour tous les sites »** puis **Déployer**.
3. Dans le site BBI : ⚙️ → *Ajouter une application* → **BBI Intranet** (ou attendez la propagation automatique, `skipFeatureDeployment` est activé).

> Mise à jour ultérieure : re-téléverser le `.sppkg` → SharePoint propose **Upgrade**. Les instances
> déjà posées des web parts se mettent à jour seules.

---

## 3. Étape 2 — Lancer le provisionnement

Le script lit le tenant et le site dans **`bbi-environnement.json`** (racine du dépôt) :

```json
{
  "tenantHost": "businessbuilderinter.sharepoint.com",
  "siteUrl": "https://businessbuilderinter.sharepoint.com/sites/intranet",
  "editorsGroup": "BBI-Concepteurs"
}
```

```powershell
cd deploy

# 1) SIMULATION : aucun changement, montre ce qui serait fait
.\provision-bbi-intranet.ps1 -DryRun

# 2) INSTALLATION complète + données d'exemple (recommandé pour la première fois)
.\provision-bbi-intranet.ps1 -SeedDemoData

# 3) AUDIT : vérifie que tout est conforme au code SPFx (à relancer après chaque évolution)
.\provision-bbi-intranet.ps1 -VerifyOnly
```

> Pour installer sur un autre site, soit vous modifiez `siteUrl` dans `bbi-environnement.json`,
> soit vous passez `-SiteUrl https://businessbuilderinter.sharepoint.com/sites/autre-site`
> (le paramètre est prioritaire sur le fichier).

Le script est **idempotent** : relancez-le sans crainte, il ne recrée pas ce qui existe.
Options utiles :

| Paramètre | Effet |
|---|---|
| `-SiteUrl` | Site à provisionner (prioritaire sur `bbi-environnement.json`) |
| `-DataSiteUrl` | Créer les listes sur un autre site que le site d'accueil |
| `-EditorsGroup` | Groupe autorisé à modifier les supports publiés (défaut `BBI-Concepteurs`) |
| `-DryRun` | Simulation, aucune écriture |
| `-VerifyOnly` | Audit + rapport des manques |

---

## 4. Étape 3 — Ce que le script NE peut pas faire (à faire à la main, 15 minutes)

Ces réglages sont volontairement hors script : ils touchent à la **conformité** et se paramètrent
dans les interfaces d'administration (et doivent être tracés pour Qualiopi).

| # | Réglage | Où | Valeur recommandée |
|---|---|---|---|
| 1 | **Étiquette de confidentialité** « BBI — Supports internes » | Purview → Protection des informations → Étiquettes | Chiffrement : *Afficher uniquement* (pas de copie, pas d'impression) |
| 2 | **Ouverture navigateur uniquement** | Bibliothèque *Supports publiés* → Paramètres → Paramètres avancés → *Ouvrir les documents dans le navigateur par défaut* | Activé |
| 3 | **Restreindre la synchronisation** | Admin SharePoint → Accès des appareils non gérés | « Accès limité, navigateur uniquement » (à tester d'abord sur un groupe) |
| 4 | **IRM / sensibilité par défaut** | Paramètres de la bibliothèque → *Étiquettes* | Étiquette BBI appliquée par défaut aux nouveaux fichiers |
| 5 | **Expiration des liens de partage** | Admin SharePoint → Partage externe | « Personnes existantes », expiration 30 jours |
| 6 | **Fonts de marque (optionnel)** | Brand center → *Brand fonts* | Téléverser la police institutionnelle (woff2) + jeu de polices BBI |
| 7 | **Footer du site** | ⚙️ → *Modifier l'apparence* → Pied de page | Mentions légales · RGPD · Accessibilité · Contact |

> ⚠️ **Ce qui n'est pas techniquement possible** : masquer la barre de suite Microsoft 365 (waffle,
> recherche, avatar). Microsoft l'interdit explicitement et le CSS « pirate » casse à chaque mise à
> jour. La page applicative supprime **l'en-tête de site, la navigation et le titre de page** ;
> pour un écran 100 % sans chrome, publiez la même page dans **Teams / Viva Connections**.

---

## 5. Comprendre la page d'accueil « plein écran »

La page `accueil.aspx` est une **SingleWebPartAppPage**. Concrètement :

- elle n'affiche **ni en-tête de site, ni navigation, ni titre de page** — le rendu ressemble à un vrai site web ;
- la web part `BBI Accueil` y occupe **toute la largeur** (`supportsFullBleed: true`) et son héros fait **100 % de la hauteur visible** (`100svh` moins la hauteur réelle du chrome, mesurée automatiquement) ;
- l'extension **BBI Plein écran** (ClientSideExtension) supprime les marges résiduelles du canevas SharePoint : c'est elle qui rend le bord-à-bord parfait, y compris en mode *workbench*.

### Vérifier / modifier l'extension

```powershell
Connect-PnPOnline -Url https://businessbuilderinter.sharepoint.com/sites/intranet -Interactive
Get-PnPCustomAction -Scope Web | Where-Object { $_.Location -eq 'ClientSideExtension.ApplicationCustomizer' } |
  Format-List Name, Title, ClientSideComponentProperties
```

Propriétés disponibles (`ClientSideComponentProperties`) :

| Propriété | Défaut | Rôle |
|---|---|---|
| `mode` | `appPage` | `appPage` = ne s'active que sur les pages applicatives · `always` = partout |
| `edgeToEdge` | `true` | Supprime les marges/paddings du canevas |
| `hidePageTitle` | `true` | Masque le titre de page |
| `hideCommandBar` | `false` | Masque la barre de commandes (⚠️ masque aussi le bouton *Modifier*) |
| `topBannerText` | *(vide)* | Affiche un bandeau bleu nuit en haut de page |
| `customCss` | *(vide)* | CSS complémentaire avancé |

Pour modifier :

```powershell
Set-PnPCustomAction -Identity <IdGuid> -ClientSideComponentProperties '{"mode":"appPage","edgeToEdge":true,"hidePageTitle":true,"hideCommandBar":false}'
```

### Revenir à une page normale

```powershell
Set-PnPClientSidePage -Identity accueil.aspx -LayoutType Article
# ou via l'interface : Pages du site → accueil.aspx → ... → Type de mise en page
```

---

## 5 bis. Utiliser les modèles de page (équipes éditoriales)

Deux modèles sont créés par le script et apparaissent dans **Nouveau → Page** :

### Fiche formation (`formation.aspx`)
1. Ouvrir le catalogue, cliquer une formation → l'URL se termine par `?code=BBI-MGT-101`.
2. La page `formation.aspx` lit ce code et affiche la fiche complète (objectifs, programme, sessions, supports, formateurs).
3. Pour créer une nouvelle fiche : *Nouveau → Page → BBI Fiche formation*, puis publier et partager le lien
   en ajoutant `?code=<CODE>` — ou, plus simple, **lier le catalogue** directement :
   `…/SitePages/formation.aspx?code=BBI-MGT-101`.
4. Les champs `Objectifs`, `Programme`, `Prérequis` sont **multi-lignes** : une ligne = une puce / une étape.

> Conseil : conservez **une seule page** `formation.aspx` et pilotez-la par le code (pas une page par formation).
> Vous évitez ainsi les pages orphelines et gardez un design unique. Si vous préférez une page par formation,
> le modèle permet aussi de partir d'une copie.

### Article d'actualité (`article.aspx`)
1. Noter l'identifiant de l'actualité (colonne **ID** de la liste `Actualites`).
2. Lien à partager : `…/SitePages/article.aspx?itemid=12` — visuel, chapô, auteur, temps de lecture,
   boutons de partage (e-mail, Teams, copie du lien) et actualités liées sont générés automatiquement.
3. Renseigner la colonne `Corps de l'article` (multi-lignes enrichi) pour le texte long.

### Sessions & inscriptions (`sessions.aspx`)
Page prête à l'emploi : recherche, filtres filière/modalité, regroupement par mois, `Ajouter à mon agenda`,
lien vers la fiche formation (le code est extrait automatiquement du titre de la session, ex. « … — BBI-MGT-101 »).

> 💡 **Astuce de nommage** : placez toujours le code formation dans le titre de la session
> (`Management d'équipe — Cohorte 7 — BBI-MGT-101`) : le planning en déduit la filière et le lien vers la fiche.

---

## 6. Alimenter les contenus (mode d'emploi pour les équipes)

### Actualités — liste `Actualites`
`Titre` · `Résumé` · **`Corps de l'article`** (texte long) · `Rubrique` · `Date de publication` · `Auteur` · `Image (URL)` · `Lien (URL)`
👉 La web part affiche le **dernier élément publié en avant**, puis le reste en liste.

### Sessions — liste `Sessions`
`Titre` (avec le code formation) · `Date de début` · `Date de fin` · `Modalité` (Présentiel / Distanciel / Hybride) · `Lieu` · `Statut` · `Inscription (URL)`
👉 Les sessions passées sont automatiquement filtrées côté page d'accueil.

### Catalogue — liste `Formations`
`Titre` · `Code formation` · `Filière` · `Modalité` · `Durée (heures)` · `Niveau` · `Statut catalogue`
et, pour la fiche formation : `Description` · `Objectifs pédagogiques` · `Programme` · `Prérequis` · `Public visé` · `Formateurs référents` · `Contact pédagogique`
👉 Seuls les éléments **Actif** apparaissent (les autres restent visibles en interne).

### Formateurs — liste `Formateurs`
`Titre` (nom) · `Rôle` · `Filière` · `Initiales` (pastille colorée)

### Documents — bibliothèque `Supports publiés`
Déposer les fichiers **publiés** uniquement. Colonnes : `Code formation`, `Type de support`,
`Statut`, `Date de validité`, `Formateur auteur`. Les documents sont ouverts **en lecture seule dans
le navigateur** (`?web=1`), sans bouton de téléchargement.

### Galerie — bibliothèque d'images `Galerie médias`
1. *Téléverser* → photos (jpg/png) ou **vidéos (mp4)**.
2. Renseigner `Titre` (légende), `Album`, `Lieu`, `Crédit photo`, `Date de la photo`.
3. Les albums créent automatiquement les filtres affichés dans la web part.
4. Pour une vidéo hébergée ailleurs (Stream/YouTube), renseigner `Lien vidéo (URL)`.

> Les vignettes sont générées par SharePoint (`?width=800`) : pas de retraitement d'image nécessaire.
> Formats conseillés : 1600–2000 px de large, < 300 Ko, JPEG qualité 80.

---

## 7. Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| Un bandeau « données de démonstration » apparaît | Vous avez activé `Afficher les indicateurs de données de démonstration` et la source est vide | Normal : publier un élément, ou désactiver l'option pour masquer le bandeau |
| Une web part affiche des contenus d'exemple alors que votre liste est remplie | Liste non publiée, ou mauvais nom de liste | Vérifier le titre exact (ou le renseigner dans le volet Propriétés) et que les éléments sont bien approuvés/publiés |
| Le héros ne prend pas toute la hauteur | Web part placée dans une page article (pas une page applicative) | Utiliser `accueil.aspx` ou passer la page en *SingleWebPartAppPage* |
| Il reste des marges blanches | Extension « BBI Plein écran » absente | Relancer le script (§4 custom action) ou vérifier `Get-PnPCustomAction` |
| Album vide dans la galerie | Colonne `Album` non renseignée | Renseigner la colonne, sinon tout est regroupé sous « Tous les albums » |
| La barre de commandes a disparu | `hideCommandBar: true` | Repasser la propriété à `false` (§5) |
| Le thème ne s'applique pas | Thème publié mais non appliqué au site | `Set-PnPWebTheme -Theme 'BBI Bleu nuit' -WebUrl https://businessbuilderinter.sharepoint.com/sites/intranet` |

---

## 8. Cycle de vie (ALM) — mettre à jour la solution

```powershell
cd bbi-intranet
npm run build                       # → sharepoint/solution/bbi-intranet.sppkg
# (version à incrémenter dans config/package-solution.json avant le build)
```

1. Re-téléverser le `.sppkg` dans le catalogue → **Upgrade**.
2. `.\provision-bbi-intranet.ps1 -VerifyOnly` pour contrôler l'intégrité.
3. Noter la version déployée dans le journal de recette (voir `deliverables/` index §11.2).
