# BBI Intranet — Guide de mise en place (portail unifié)

Ce dossier contient **le script d'installation complet** de l'intranet BBI : il crée les listes,
les bibliothèques, les colonnes, les vues, une seule page d'accueil applicative, le thème et l'identité
visuelle. Sur cette page, **une seule web part BBI Accueil** fournit plusieurs vues internes (formations,
sessions, actualités — avec page dédiée par actualité — ressources, communauté et organigramme) sans navigation
vers des pages SharePoint séparées.

> Expérience **sans aucun chrome SharePoint** (Teams / Viva Connections) : [`../teams/README.md`](../teams/README.md)
> Fichier principal : [`provision-bbi-intranet.ps1`](./provision-bbi-intranet.ps1)
> Package SPFx à installer avant : [`../deliverables/spfx/bbi-intranet.sppkg`](../deliverables/spfx/bbi-intranet.sppkg) (v1.6.0.0)

---

## 0. Ce que vous obtenez à la fin

| Page | Type | Contenu |
|---|---|---|
| `accueil.aspx` | **Unique page applicative** | Une seule web part `BBI Accueil`, avec navigation intégrée : Accueil, Formations, Sessions, Actualités, Ressources (supports + galerie), Communauté et **Organigramme**. Chaque vue partage le même en-tête, la même identité visuelle et la même page. |

Et les listes : `Actualites`, `Sessions`, `Formateurs`, `Employés du mois`, `Certifications`, `Organigramme`,
`Formations`, `Supports publiés`, `Galerie médias`.

> **Le portail est présentable dès la fin du déploiement, même sans aucune donnée.** Si une liste ou une
> bibliothèque est absente, non créée ou vide, la vue concernée présente un contenu de repli professionnel.
> Les pages distinctes du catalogue, des sessions, des actualités et de la galerie ne sont plus à créer.
>
> Pour visualiser ce mécanisme pendant la mise en place, activez l'option **« Afficher les indicateurs de
> données de démonstration »** dans le volet Propriétés de chaque web part : un bandeau précise alors la
> source concernée. L'option est **désactivée par défaut** (aucun indicateur en production).

---

## 0 bis. Que se passe-t-il si une source est vide ?

| Vue du portail | Source surveillée | Comportement si absente / vide | Ce qui remplace les exemples |
|---|---|---|---|
| Accueil / actualités | `Actualites` | À la une + flux d'actualités paginé + page dédiée par actualité | Publier une actualité |
| Accueil — chiffres clés | *(propriétés de la web part)* | Les 4 chiffres par défaut, toujours visibles sous le héros | Modifier la propriété « Chiffres clés » |
| Accueil — vie de l'équipe | `Employés du mois`, `Certifications` | Portraits et certifications d'exemple | Publier l'employé du mois, puis les certifications |
| Sessions | `Sessions` | Planning de sessions à venir | Publier des sessions avec `Date de début` |
| Formations | `Formations` | Catalogue filtrable | Publier une formation (`Statut catalogue = Actif`) |
| Ressources | `Supports publiés`, `Galerie médias` | Supports et galerie de démonstration | Publier des documents, photos ou vidéos |
| Communauté | `Formateurs` | Annuaire d'exemple + fiches contact | Publier un formateur (photo, téléphone, e-mail, WhatsApp) |
| Organigramme | `Organigramme` | Arbre de 12 postes d'exemple | Publier les postes avec leur `Responsable` |

Le remplacement se fait **source par source** : vous pouvez publier les actualités avant les sessions,
l'accueil reste cohérent à chaque étape.

**Vérifier soi-même** (optionnel, sans SharePoint) :

```powershell
cd ../bbi-intranet
node tools/verify-fallback.js     # 100 contrôles : source absente, source vide, source alimentée
node tools/css-harness.js dist    # styles réellement injectés, chiffres clés, pagination, navigation
node tools/preview-smoke.js       # 34 contrôles de parcours sur l'aperçu cliquable
```

Et pour parcourir le portail sans rien installer : ouvrez `deliverables/audit-2026/apercu-portail.html`
(diaporama, actualités paginées et page dédiée, fiche formateur, organigramme).

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

> **Avant la première exécution — vérifier la syntaxe du script (10 secondes, aucun changement appliqué) :**
>
> ```powershell
> $errors = $null
> [System.Management.Automation.Language.Parser]::ParseFile(
>     (Resolve-Path .\provision-bbi-intranet.ps1), [ref]$null, [ref]$errors) | Out-Null
> if ($errors) { $errors } else { 'Syntaxe OK' }
> # Optionnel (si PSScriptAnalyzer est installé) : Invoke-ScriptAnalyzer .\provision-bbi-intranet.ps1
> ```
>
> Le script a été validé par un contrôle structurel (délimiteurs, chaînes, continuations) mais **pas par un parseur
> PowerShell** dans l'environnement de développement hors ligne : cette vérification garantit une première exécution
> sans surprise, et `-DryRun` ne modifie rien.

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

La web part **BBI Accueil** applique elle-même un mode immersif lorsqu'elle est chargée : elle masque la barre Microsoft 365, l'en-tête et la navigation SharePoint, la navigation latérale, le titre et (en lecture seule) la barre de commandes. Le comportement est embarqué dans le bundle de la web part : il fonctionne sur la page publiée depuis le `.sppkg` et dans le workbench hébergé avec les manifests de debug. En mode édition, les commandes sont conservées pour pouvoir modifier la page.

> Les sélecteurs s'appuient sur les identifiants/accessibility hooks actuels de SharePoint. Microsoft peut les faire évoluer ; vérifier le rendu après les mises à jour SharePoint. La page `SingleWebPartAppPage` et l'extension BBI Plein écran restent recommandées pour obtenir le canevas bord à bord le plus fiable.

---

## 5. Le portail tient sur une page

`accueil.aspx` est une **SingleWebPartAppPage** qui reçoit une seule web part : `BBI Accueil`. Son menu
change de vue dans la même application — les destinations se reflètent dans le fragment de l'URL
(`#formations`, `#sessions`, `#actualites`, `#ressources`, `#communaute`) pour permettre les favoris
et les liens directs, sans créer de pages SharePoint additionnelles.

- **Accueil** : raccourcis, actualités récentes, prochaines sessions et aperçu de l'équipe.
- **Formations** : catalogue complet avec recherche et filtres.
- **Sessions** : planning à venir.
- **Actualités** : flux d'actualités.
- **Ressources** : supports publiés et galerie médias.
- **Communauté** : annuaire des formateurs référents et liens d'entraide.

Ajoutez uniquement **BBI Accueil** à `accueil.aspx`. Les autres composants du package servent de briques
internes à cette web part ; il n'est pas nécessaire d'ajouter séparément catalogue, documents ou galerie.

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

## 5 bis. Navigation entre les vues

Le menu et les tuiles restent dans le portail :

| Vue | Fragment |
|---|---|
| Accueil | `#accueil` |
| Formations | `#formations` |
| Sessions | `#sessions` |
| Actualités | `#actualites` |
| Ressources et galerie | `#ressources` |
| Communauté / formateurs | `#communaute` |

Les fragments peuvent être utilisés dans les favoris ou les liens internes. Les actions qui doivent
réellement sortir du portail (par exemple ouvrir un document ou rejoindre un formulaire d'inscription)
restent des liens vers leur destination sécurisée SharePoint.

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
`Titre` (nom) · `Rôle` · `Filière` · `Initiales` (pastille) · **`Photo (URL)`** (laissez vide pour afficher
les initiales) · `Téléphone` · `E-mail` · **`WhatsApp`** · `Localisation` · `Biographie` · `Spécialités` ·
`Certifications` · `Profil LinkedIn`
👉 Un clic sur une carte ouvre la fiche complète du formateur : coordonnées cliquables (téléphone, e-mail,
WhatsApp, Teams), spécialités, certifications et ses prochaines sessions. La colonne `WhatsApp` accepte
toutes les écritures (`+33 6 …`, `0033…`, `0612…`) : le lien est normalisé automatiquement.

### Employé du mois — liste `Employés du mois`
`Titre` (nom) · `Poste` · `Pôle` · `Mois` · `Message` · `Faits marquants` · `Photo (URL)`
👉 Le **dernier élément créé** est mis en avant dans la section « Vie de l'équipe ».

### Certifications — liste `Certifications`
`Titre` · `Organisme` · `Périmètre` · `Valide jusqu'au` · `Statut`
👉 Elles s'affichent à côté de l'employé du mois (Qualiopi, Datadock, certifications internes…).

### Organigramme — liste `Organigramme`
`Titre` (nom) · `Poste` · `Pôle` · **`Responsable`** (nom du manager, rattachement hiérarchique) ·
`Ordre` (numéro d'affichage) · `Localisation` · `E-mail` · `Téléphone`
👉 Laissez `Responsable` vide pour le dirigeant : il devient la racine de l'arbre. Les boucles de
rattachement sont détectées et ne font perdre aucun poste. Un clic sur un poste affiche la fiche contact.

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
