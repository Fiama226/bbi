# BBI Intranet — Guide de mise en place (portail unifié)

Ce dossier contient **le script d'installation complet** de l'intranet BBI : il crée les listes,
les bibliothèques, les colonnes, les vues, une seule page d'accueil applicative, le thème et l'identité
visuelle. Sur cette page, **une seule web part BBI Accueil** fournit plusieurs vues internes (accueil,
formations, sessions — liste et calendrier —, actualités avec page dédiée par actualité, ressources et
communauté/trombinoscope) sans navigation vers des pages SharePoint séparées.

> Expérience **sans aucun chrome SharePoint** (Teams / Viva Connections) : [`../teams/README.md`](../teams/README.md)
> Fichier principal : [`provision-bbi-intranet.ps1`](./provision-bbi-intranet.ps1)
> **Recréer toute l'organisation (siège, filiales, groupes, identité) sur un autre tenant ou sur celui-ci : voir le [§ 9](#9-recréer-toute-lorganisation-sur-un-autre-tenant-ou-sur-celui-ci--kit--organisation-)**
> Package SPFx à installer avant : [`../deliverables/spfx/bbi-portail.sppkg`](../deliverables/spfx/bbi-portail.sppkg) (v1.9.0.0)

---

## 0. Ce que vous obtenez à la fin

| Page | Type | Contenu |
|---|---|---|
| `accueil.aspx` | **Unique page applicative** | Une seule web part `BBI Accueil`, avec navigation intégrée : Accueil (identité, annonces, vie de l'équipe, implantations, références), Nos offres (catalogue des offres formation, conseil et coaching + références pédagogiques), Sessions (liste + calendrier), Actualités, Ressources (supports pédagogiques + documents administratifs + galerie), Communauté (**Trombinoscope**). Chaque vue partage le même en-tête, la même identité visuelle et la même page. |

Et les listes : `Actualites`, `Sessions`, `Formateurs`, `Employés du mois`, `Certifications`, `Annonces`,
`Pensées du jour`, `Anniversaires`, `Implantations`, `Nos références`, `Références pédagogiques`,
`Formations` (catalogue autonome historique), `Offres`, `Supports publiés`, `Documents administratifs`, `Galerie médias`.

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
| Accueil — identité | *(propriétés de la web part)* | Masquée si Vision/Mission/Objectifs sont vides | Renseigner les propriétés « Vision », « Mission », « Objectifs » |
| Accueil — annonces | `Annonces` | Bandeau rotatif d'exemple (ou le texte configuré, ou la dernière actualité) | Publier une annonce avec une fenêtre de dates |
| Accueil — vie de l'équipe | `Employés du mois`, `Certifications`, `Pensées du jour`, `Anniversaires` | Portraits, certifications, citation et anniversaires d'exemple | Publier dans chaque liste |
| Accueil — siège et filiales | `Implantations` | Cartes de sites d'exemple | Publier une implantation ; `-ProvisionFiliales` renseigne `SiteUrl` |
| Accueil — Documents administratifs | `Documents administratifs` | Annuaire de tuiles (icône + libellé) d'exemple | Publier un document administratif |
| Accueil — Références pédagogiques | `Références pédagogiques` | Annuaire de tuiles (icône + libellé) d'exemple | Publier une référence pédagogique |
| Accueil — références | `Nos références` | Références clients d'exemple | Publier une référence client |
| Sessions | `Sessions` | Planning de sessions à venir (liste et calendrier) | Publier des sessions avec `Date de début` |
| Nos offres | `Offres` | Catalogue filtrable par pôle (Formation, Conseil, Coaching) puis par filière | Publier une offre (`Pôle`, `Statut catalogue = Actif`) |
| Formations — références pédagogiques | `Références pédagogiques` | Références d'exemple groupées par catégorie | Publier une référence pédagogique |
| Ressources | `Supports publiés`, `Documents administratifs`, `Galerie médias` | Supports, documents et galerie de démonstration | Publier des documents, photos ou vidéos |
| Communauté (Trombinoscope) | `Formateurs` | Annuaire d'exemple + fiches contact, filtrable par catégorie | Publier un collaborateur (photo, téléphone, e-mail, WhatsApp, `Catégorie`) |

Le remplacement se fait **source par source** : vous pouvez publier les actualités avant les sessions,
l'accueil reste cohérent à chaque étape.

**Vérifier soi-même** (optionnel, sans SharePoint) :

```powershell
cd ../bbi-intranet
node tools/verify-fallback.js     # 211 contrôles : source absente, source vide, source alimentée
node tools/css-harness.js dist    # styles réellement injectés, chiffres clés, pagination, navigation, sections orphelines,
                                  # cartes de sites, annuaires de tuiles, barre de navigation bleu nuit permanente
node tools/preview-smoke.js       # 34 contrôles de parcours sur l'aperçu cliquable
```

> `apercu-portail.html` et `preview-smoke.js` couvrent l'aperçu de conception et n'ont pas encore été
> remis à jour avec les blocs ajoutés cette itération (annonces, implantations, références, trombinoscope,
> calendrier des sessions) ni avec le retrait de l'organigramme — `tools/verify-fallback.js` et
> `tools/css-harness.js` ci-dessus, eux, testent le code réel et sont à jour.

Et pour parcourir le portail sans rien installer : ouvrez `deliverables/audit-2026/apercu-portail.html`
(diaporama, actualités paginées et page dédiée, fiche formateur).

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

1. Téléverser `bbi-portail.sppkg` dans le **catalogue d'applications** (Centre d'administration SharePoint → *Autres fonctionnalités* → *Catalogue d'applications* → *Distribuer des applications*).
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
| Nos offres | `#offres` ou `#offres?pole=conseil` (`#formations` reste valide) |
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

### Offres — liste `Offres`
Catalogue du portail (pôles Formation, Conseil, Coaching). Une ligne sans `Pôle` est comptée comme Formation.

| Colonne (nom interne) | Type | Contenu |
|---|---|---|
| `Title` | Texte | Intitulé de l'offre |
| `Pole` | Choix | Formation / Conseil / Coaching |
| `CodeOffre` | Texte | Code (ex. `BBI-CON-101`) |
| `Filiere` | Texte | Filière ou domaine |
| `Format` | Choix | Présentiel / Distanciel / Hybride / Sur site client |
| `Duree` | Texte | Durée libre (« 2 jours », « 3 à 6 semaines »…) |
| `PublicCible` | Texte | Public visé |
| `Niveau` | Choix | Débutant / Intermédiaire / Confirmé / Expert |
| `StatutCatalogue` | Choix | Actif / En refonte / Archivé (seul `Actif` est affiché) |
| `Description` | Texte long | Présentation |
| `Objectifs` | Texte long | Objectifs |
| `Programme` | Texte long | Programme ou démarche |
| `Prerequis` | Texte long | Prérequis |
| `Livrables` | Texte long | Livrables attendus |

### Formateurs / Trombinoscope — liste `Formateurs`
`Titre` (nom) · `Rôle` · `Filière` · `Initiales` (pastille) · **`Photo (URL)`** (laissez vide pour afficher
les initiales) · `Téléphone` · `E-mail` · **`WhatsApp`** · `Localisation` · `Biographie` · `Spécialités` ·
`Certifications` · `Profil LinkedIn` · **`Catégorie`** (Formateur / Permanent / Direction / Appui) · `Ordre`
👉 Un clic sur une carte ouvre la fiche complète : coordonnées cliquables (téléphone, e-mail,
WhatsApp, Teams), spécialités, certifications et ses prochaines sessions. La colonne `WhatsApp` accepte
toutes les écritures (`+33 6 …`, `0033…`, `0612…`) : le lien est normalisé automatiquement. La vue
**Ressources** affiche un extrait filtré sur `Catégorie = Formateur` (8 max) ; la vue **Communauté**
affiche l'annuaire complet avec un sélecteur de catégorie.

### Employé du mois — liste `Employés du mois`
`Titre` (nom) · `Poste` · `Pôle` · `Mois` · `Message` · `Faits marquants` · `Photo (URL)`
👉 Le **dernier élément créé** est mis en avant dans la section « Vie de l'équipe ».

### Certifications — liste `Certifications`
`Titre` · `Organisme` · `Périmètre` · `Valide jusqu'au` · `Statut`
👉 Elles s'affichent à côté de l'employé du mois (Qualiopi, Datadock, certifications internes…).

### Pensées du jour — liste `Pensées du jour`
`Titre` (texte de la citation) · `Auteur` · `Date de publication` · `Contexte`
👉 Une citation dont la `Date de publication` correspond au jour courant est prioritaire ; sinon, la
citation du jour tourne automatiquement (même citation pour tous, toute la journée).

### Anniversaires — liste `Anniversaires`
`Titre` (nom) · `Jour` · `Mois` · `Fonction` · `Photo (URL)` · `Message` · `Afficher` (case à cocher)
👉 **RGPD : ne renseignez jamais l'année de naissance**, seuls `Jour` et `Mois` sont utilisés. Décochez
`Afficher` pour qu'un collaborateur n'apparaisse jamais, même si sa date est dans la liste.

### Annonces — liste `Annonces`
`Titre` · `Message` · `Niveau` (Information / Important / Urgent) · `Date de début` · `Date de fin` ·
`Lien (URL)` · `Ordre`
👉 Remplace le bandeau configuré dans les propriétés de la web part (qui reste affiché en premier,
épinglé, si renseigné). Seules les annonces dans leur fenêtre de dates sont affichées ; les bornes
vides sont ouvertes (toujours actif).

### Implantations — liste `Implantations`
`Titre` · `Siège` (case à cocher) · `Pays` · `Ville` · `Adresse` · `Téléphone` · `E-mail` · `Responsable` ·
`Lien (carte)` · `Ordre` · `Site SharePoint` (SiteUrl) · `Couleur` (#RRGGBB) · `Initiales` (1-3 lettres)
👉 Cochez `Siège` sur une seule implantation : elle apparaît toujours en tête, suivie des filiales/
antennes triées par `Ordre`. `SiteUrl` est renseigné automatiquement par `-ProvisionFiliales` (voir § Hub et filiales).

### Hub et filiales — `-ProvisionFiliales`
Le site intranet devient **hub**. Chaque ligne d'`Implantations` dont `Siège` est décoché reçoit un
**site d'équipe** (groupe Microsoft 365) à l'adresse `/sites/<filialeSitePrefix><ville>` (ex.
`/sites/intranet-abidjan`), rattaché au hub, avec le même portail BBI et ses propres listes (vides au
départ : le portail y affiche le contenu de repli). `SiteUrl` est réécrit dans la ligne ; la navigation
hub liste le siège puis les filiales par `Ordre`.

```powershell
.\provision-bbi-intranet.ps1 -ProvisionFiliales -DryRun      # simulation
.\provision-bbi-intranet.ps1 -ProvisionFiliales              # création
.\provision-bbi-intranet.ps1 -ProvisionFiliales -VerifyOnly  # audit
```
Prérequis : le `.sppkg` doit être **Déployé** dans le catalogue avant d'exécuter la commande, et le compte
doit avoir le rôle d'**administrateur SharePoint** ainsi que le droit de créer des groupes Microsoft 365.
La création de chaque site attend la fin du provisionnement (`-Wait`) : une exécution avec plusieurs
nouvelles filiales prend donc plusieurs minutes. Mettre `hubEnabled` à `false` dans
`bbi-environnement.json` désactive cette section.
Pour ajouter une filiale : ajouter une ligne (Titre, Ville, Pays, Couleur, Initiales), relancer.

**Premier passage : une seule filiale.** Créer d'abord un site, le vérifier, puis lancer pour toutes :
```powershell
.\provision-bbi-intranet.ps1 -ProvisionFiliales -Filiale Abidjan   # une seule filiale (Ville, accents et casse ignorés)
.\provision-bbi-intranet.ps1 -ProvisionFiliales                    # puis toutes les filiales
```
- **Site neuf + `-SeedDemoData -ProvisionFiliales`** : la section filiales (6) s'exécute *avant* le jeu de
  démo (9) ; au premier passage, `Implantations` est encore vide et aucune filiale n'est créée. Relancer
  une seconde fois.
- **Tenants dont les sites de groupe sont sous `/teams/`** : l'URL réelle renvoyée par SharePoint à la
  création est utilisée et écrite dans `SiteUrl`.
- **Membres** : les membres de `BBI-Concepteurs` (groupe `editorsGroup`) sont copiés une fois par
  exécution (instantané) dans le groupe Membres de chaque filiale ; relancer pour propager les nouveaux.
- **Relances** : les sites existants sont conservés, ainsi que les réglages de leur web part BBI Accueil
  (elle n'est plus remplacée). Une ligne sans `Ville` est ignorée (le nom du site vient de `Ville`) ;
  deux lignes avec la même `Ville` : la seconde est ignorée avec un avertissement. Une filiale en échec
  n'interrompt pas les autres (statut `ÉCHEC` dans le rapport).
- **`-VerifyOnly -ProvisionFiliales`** audite aussi chaque filiale existante (listes, bibliothèques, page
  et web part) et signale les éléments manquants.

### Nos références — liste `Nos références`
`Titre` (nom du client/partenaire) · `Logo (URL)` · `Site web` · `Contact` · `Pays` · `Ville` · `Secteur` ·
`Ordre`
👉 Sans logo, les initiales du nom s'affichent sur un fond dégradé. Un `Site web` renseigné rend la
vignette cliquable (nouvel onglet).

### Références pédagogiques — liste `Références pédagogiques`
`Titre` · `Catégorie` (Ouvrage / Norme / Méthode / Étude / Outil) · `Auteur` · `Année` · `Lien (URL)` ·
`Résumé` · `Ordre`
👉 Affichées sous le catalogue des formations, regroupées par `Catégorie`.

### Documents — bibliothèque `Supports publiés`
Déposer les fichiers **publiés** uniquement. Colonnes : `Code formation`, `Type de support`,
`Statut`, `Date de validité`, `Formateur auteur`. Les documents sont ouverts **en lecture seule dans
le navigateur** (`?web=1`), sans bouton de téléchargement.

### Documents administratifs — bibliothèque `Documents administratifs`
Distincte des supports pédagogiques ci-dessus : RH, juridique, finance, qualité, modèles. Colonnes :
`Catégorie` (RH / Juridique / Finance / Qualité / Modèles), `Public` (Tous / Formateurs / Direction),
`Référence`, `Date de validité`. Affichée dans la vue Ressources, sous les supports pédagogiques.

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
npm run build                       # → sharepoint/solution/bbi-portail.sppkg
# (version à incrémenter dans config/package-solution.json avant le build)
```

1. Re-téléverser le `.sppkg` dans le catalogue → **Upgrade**.
2. `.\provision-bbi-intranet.ps1 -VerifyOnly` pour contrôler l'intégrité.
3. Noter la version déployée dans le journal de recette (voir `deliverables/` index §11.2).

---

## 9. Recréer toute l'organisation sur un autre tenant (ou sur celui-ci) — kit « organisation »

Le croquis du client montre un **siège** et des **filiales** (bandeau « Siège · Filiale 1 · Filiale… »), chacun avec le même tableau de bord. Ce kit recrée cette organisation de bout en bout, depuis **un seul fichier de configuration** : il fonctionne sur le tenant actuel comme sur un nouveau tenant client.

**Ce que le kit crée, sans rien refaire à la main :**

| Élément | Détail |
|---|---|
| **Site du siège** | Site d'équipe privé, devenu **hub** |
| **Sites de filiale** | Un site d'équipe par filiale, rattaché au hub (`/sites/intranet-<ville>`) : ce sont des sites frères reliés au siège, pas des sous-sites classiques |
| **Tableau de bord** | La page d'accueil du portail (`accueil.aspx`, web part *BBI Accueil*) sur le siège **et** sur chaque filiale |
| **Listes et bibliothèques** | Les 16 listes et bibliothèques du portail sur chaque site, dont `Offres` |
| **Application SPFx** | Téléversée et déployée dans le catalogue d'applications du tenant |
| **Bandeau Siège et filiales** | La liste `Implantations` est remplie depuis la configuration, puis recopiée sur chaque site, avec le lien, la couleur et les initiales de chaque filiale |
| **Groupes et permissions** | Groupe des éditeurs de contenu ; propriétaires, membres et visiteurs de chaque site ; option « tout le personnel en lecture » |
| **Identité visuelle** | Thème, en-tête compact, logo, pied de page et ses liens, sur chaque site |
| **Contenu de démonstration** | Offres, actualités, sessions, annonces… (option), pour que chaque site soit présentable le premier jour |
| **Audit** | Un bilan final site par site |

### Les fichiers du kit

| Fichier | Rôle |
|---|---|
| [`organisation.example.json`](./organisation.example.json) | Modèle de configuration à copier en `organisation.json` (ce dernier n'est pas versionné) |
| [`New-BbiOrganization.ps1`](./New-BbiOrganization.ps1) | **Le script à lancer** : enchaîne les neuf étapes ci-dessous |
| [`Test-BbiOrganization.ps1`](./Test-BbiOrganization.ps1) | Audit en lecture seule (appelé à la fin, utilisable seul) |
| [`BbiOrganization.ps1`](./BbiOrganization.ps1) | Fonctions communes (lecture et contrôle de la configuration, plan) |
| [`verify-organisation.ps1`](./verify-organisation.ps1) | Test hors ligne de la configuration et du plan (34 contrôles) |
| [`verify-organisation-flow.ps1`](./verify-organisation-flow.ps1) | Test hors ligne du déroulé complet contre un SharePoint simulé (49 contrôles) |
| [`verify-pnp-parameters.ps1`](./verify-pnp-parameters.ps1) | Vérifie que chaque appel PnP des scripts utilise des paramètres qui existent dans le module installé (à relancer après une mise à jour de PnP.PowerShell) |
| [`provision-bbi-intranet.ps1`](./provision-bbi-intranet.ps1) | Le script existant, réutilisé par le kit pour chaque site |

### Comment l'utiliser, pas à pas

**1. Prérequis (une seule fois)**

- PowerShell 7 et le module : `Install-Module PnP.PowerShell -Scope CurrentUser`.
- Un compte avec le rôle **administrateur SharePoint** et le droit de créer des groupes Microsoft 365.
- Un **catalogue d'applications** sur le tenant (centre d'administration SharePoint → *Plus de fonctionnalités* → *Applications* → *Catalogue d'applications*). Le script ne peut pas le créer.
- Le paquet `deliverables/spfx/bbi-portail.sppkg` (déjà dans le dépôt).

**2. Enregistrer l'application de connexion (une seule fois par tenant)**

PnP.PowerShell 2.x refuse la connexion interactive sans application Entra ID. Créez-la, puis notez l'identifiant :

```powershell
Register-PnPEntraIDAppForInteractiveLogin -ApplicationName "BBI Provisionnement" `
    -Tenant votretenant.onmicrosoft.com `
    -GraphDelegatePermissions "Group.ReadWrite.All","User.Read.All"
```

Les permissions Graph servent à ajouter propriétaires et membres aux groupes Microsoft 365 des sites. Selon la version du module, les noms de paramètres peuvent différer : voir la documentation de PnP.PowerShell. Donnez ensuite l'identifiant au script, par `-ClientId`, par `tenant.clientId` dans la configuration, ou ainsi :

```powershell
$env:BBI_CLIENT_ID = '<identifiant de l application>'
```

**3. Écrire la configuration**

```powershell
cd deploy
Copy-Item organisation.example.json organisation.json
```

Ouvrez `organisation.json` et adaptez-le. Les clés qui commencent par `_` sont des commentaires.

| Section | À renseigner |
|---|---|
| `tenant.nom` | La partie avant `.sharepoint.com` (ex. `businessbuilderinter`) |
| `siege` | `titre`, `alias` (fin de l'URL : `/sites/<alias>`), ville, pays, couleur, initiales, contacts |
| `filiales[]` | Une entrée par filiale : `titre`, **`ville`** (elle fournit l'URL du site), pays, couleur `#RRGGBB`, initiales |
| `siege` et `filiales[]` | `proprietaires`, `membres`, `visiteurs` : adresses e-mail Microsoft 365 (listes vides = rien ajouté) |
| `groupes` | `editeurs.nom` et `editeurs.membres` ; `lectureTous` pour donner la lecture à tout le personnel |
| `identite` | `nomTheme`, `logo` (fichier image, chemin relatif), `titrePiedDePage`, `piedDePage` (liens) |
| `options` | `prefixeFiliale`, `hub`, `donneesDemo`, `deployerApplication`, `cheminPaquet` |

**4. Contrôler, sans toucher à rien**

```powershell
# Tests hors ligne : aucune connexion, aucun tenant
pwsh -File .\verify-organisation.ps1
pwsh -File .\verify-organisation-flow.ps1
pwsh -File .\verify-pnp-parameters.ps1      # noms de paramètres PnP contre le module installé

# Le plan : sites, URL, nombre de personnes par site
pwsh -File .\New-BbiOrganization.ps1 -PlanOnly
```

`-PlanOnly` affiche exactement ce qui serait créé et refuse une configuration invalide (ville en double, adresse e-mail incorrecte, couleur mal écrite…) avant toute connexion.

**5. Simuler avec connexion en lecture seule**

```powershell
pwsh -File .\New-BbiOrganization.ps1 -DryRun -ClientId <identifiant>
```

Le script lit le tenant, dit ce qu'il créerait et ne modifie rien. Si le siège n'existe pas encore, la simulation s'arrête à ce point.

**6. Premier essai avec une seule filiale, puis tout créer**

```powershell
pwsh -File .\New-BbiOrganization.ps1 -ClientId <identifiant> -Filiale Abidjan   # siège + une filiale
pwsh -File .\New-BbiOrganization.ps1 -ClientId <identifiant>                    # toutes les filiales
```

La création des sites attend la fin du provisionnement : comptez plusieurs minutes. Le script est **idempotent** : relancez-le autant de fois que nécessaire, il ne recrée pas l'existant. En fin d'exécution, il affiche un rapport et lance l'audit.

**7. Auditer à tout moment**

```powershell
pwsh -File .\Test-BbiOrganization.ps1 -ClientId <identifiant>
# ou : pwsh -File .\New-BbiOrganization.ps1 -VerifyOnly -ClientId <identifiant>
```

Pour chaque site : existence, rattachement au hub, listes et bibliothèques, page `accueil.aspx`, web part, implantations, personnes de la configuration présentes dans les groupes. Sortie 0 si tout est conforme, 1 sinon.

### Les options utiles

| Option | Effet |
|---|---|
| `-PlanOnly` | Affiche le plan, aucune connexion |
| `-DryRun` | Connexion en lecture seule, simulation |
| `-VerifyOnly` | Audit uniquement |
| `-Filiale Abidjan` | Limite le travail à une ou plusieurs filiales (ville, accents et casse ignorés) |
| `-SkipAppDeploy` | N'envoie pas l'application (déjà déployée) |
| `-SkipDemoData` | Pas de données de démonstration (tenant de production) |
| `-SkipPermissions` | Ne touche ni aux propriétaires ni aux membres |
| `-SkipBranding` | Ne touche ni au thème, ni au logo, ni au pied de page |
| `-Config <fichier>` | Autre fichier de configuration (un fichier par client) |

### Les neuf étapes du script

| # | Étape | Détail |
|---|---|---|
| 1 | Connexion et siège | Crée le site d'équipe du siège s'il n'existe pas |
| 2 | Application | Envoie le `.sppkg` dans le catalogue et le déploie ; s'arrête avec un message clair si le catalogue n'existe pas |
| 3 | Groupe des éditeurs | Crée le groupe `BBI-Concepteurs` (ou le nom choisi) et y ajoute ses membres |
| 4 | Siège, première passe | `provision-bbi-intranet.ps1 -SkipNavigation` : listes, bibliothèques, page d'accueil (sans lien de menu : il est créé à l'étape 6) |
| 5 | Implantations | Remplit la liste `Implantations` du siège depuis la configuration (siège et filiales) |
| 6 | Hub et filiales | `provision-bbi-intranet.ps1 -ProvisionFiliales` : hub, un site par filiale, portail sur chacun, menu du hub, données de démonstration |
| 7 | Bandeau sur les filiales | Recopie `Implantations` sur chaque filiale, pour que le bandeau Siège et filiales y soit réel |
| 8 | Groupes et permissions | Propriétaires et membres dans le groupe Microsoft 365 du site, visiteurs dans le groupe SharePoint, option « tout le personnel » |
| 9 | Identité et audit | Thème, en-tête compact, logo, pied de page, puis `Test-BbiOrganization.ps1` |

### Pour un autre client ou un autre tenant

Copiez `organisation.json` vers un autre fichier (par exemple `client-b.json`), changez `tenant.nom`, le siège, les filiales et les groupes, puis lancez le script avec `-Config .\client-b.json`. Le fichier d'environnement que lisent les scripts existants est généré automatiquement : `bbi-environnement.json` n'est pas modifié. Le thème « BBI Bleu nuit » est publié sur le tenant par `provision-bbi-intranet.ps1`.

### Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| « Configuration invalide » | Une valeur ne respecte pas le format | Lire la liste : elle nomme chaque champ ; `-PlanOnly` pour revalider |
| Message sur `-ClientId` ou échec de connexion | Application Entra ID absente ou mal identifiée | Refaire l'étape 2 et vérifier l'identifiant |
| « Aucun catalogue d'applications » | Le tenant n'en a pas | Le créer dans le centre d'administration SharePoint, puis relancer |
| La création du siège ou d'une filiale échoue | Une adresse de site portant ce nom est dans la corbeille de la collection de sites | Supprimer définitivement l'ancien site (centre d'administration, *Sites supprimés*) ou changer `alias` ou `ville` |
| Propriétaires ou membres non ajoutés | Permissions Graph manquantes sur l'application | Ajouter `Group.ReadWrite.All` et `User.Read.All` (délégué) avec consentement administrateur |
| Le bilan signale « À VÉRIFIER » sur l'application | Elle est téléversée mais pas encore marquée Déployée | Attendre quelques minutes, ou la déployer à la main dans le catalogue |
| Un site de filiale reste en `ÉCHEC` dans le rapport | Les autres filiales ne sont pas bloquées | Relire le message, corriger, relancer (`-Filiale <ville>` pour cibler) |
| Les anciennes pages gardent « Formations » dans le menu | Les propriétés enregistrées de la web part priment sur les valeurs par défaut | Relancer sans `-PreserveWebPart` ou modifier le menu dans le volet Propriétés |

### Ce que le kit ne fait pas

- Il ne crée pas de **sous-sites classiques** : les filiales sont des sites d'équipe rattachés au hub, l'approche conseillée pour SharePoint moderne.
- Il ne crée pas de tableau de bord **Power BI**. Le « dashboard » est la page d'accueil du portail.
- Il ne migre aucun contenu existant d'un tenant vers un autre.
- Il ne fait pas les réglages de conformité du §4 (étiquettes de confidentialité, IRM, partage externe).

> **À savoir avant le premier vrai lancement.** Les tests hors ligne (`verify-organisation.ps1` et `verify-organisation-flow.ps1`) valident la configuration, le plan et l'enchaînement des étapes, y compris l'idempotence. `verify-pnp-parameters.ps1` contrôle en plus que chaque appel PnP existe dans le module installé (dernier contrôle : PnP.PowerShell 3.3.0, 137 appels reconnus). Aucun de ces tests ne valide les droits de votre tenant ni le comportement réel de SharePoint : le kit n'a pas encore été lancé sur un tenant réel. Commencez par `-PlanOnly`, puis `-DryRun`, puis une seule filiale (`-Filiale`), et gardez l'audit pour conclure.
