# BBI — Intranet SharePoint Online · Livrables de conception

Livrables produits à partir du logo, des captures d'inspiration et des besoins fonctionnels BBI
(organisme de formation professionnelle).

## 🚀 Application SPFx prête à installer

- **Package** : `deliverables/spfx/bbi-intranet.sppkg` — à téléverser dans l'App Catalog SharePoint Online
- **Sources** : `bbi-intranet/` (SPFx 1.22.2, TypeScript 5.8, React 17)
  - `BBI Accueil` — maquette d'accueil convertie en web part responsive ; actualités, sessions et formateurs viennent de listes SharePoint, avec exemples si les sources sont absentes ; réutilise le catalogue et les documents.
  - `BBI Catalogue des formations` — cartes filtrables alimentées par la liste `Formations` (mode démo auto si la liste est absente)
  - `BBI Documents sécurisés` — visionneuse lecture seule des supports publiés (`?web=1`, badge 🔒)
- **Dev sous Docker** : `cd bbi-intranet && cp .env.example .env && docker compose up --build -d` — instructions complètes dans `bbi-intranet/README.md` (le workbench utilisé est celui du tenant SPO, le workbench local n'existe plus depuis SPFx 1.20+/Heft).


## 🆕 Itération 2026 — accueil plein écran, galerie, provisionnement

| Fichier | Rôle |
|---|---|
| `deliverables/audit-2026/index.html` | **Audit & recommandations** : comparatif des 3 routes « plein écran », refonte de l'accueil bloc par bloc (12 améliorations), **catalogue des pages #00 → #26**, modèle de contenu, design system, gouvernance, feuille de route 90 jours. |
| `deliverables/audit-2026/catalogue-pages.csv` | Le catalogue des pages en tableur (suivi projet). |
| `deliverables/audit-2026/apercu-accueil.html` | Aperçu visuel de la page d'accueil plein écran (styles compilés depuis le composant livré). |
| `deliverables/audit-2026/apercu-modeles-pages.html` | Aperçu visuel des trois modèles de page : fiche formation, sessions & inscriptions, article. |
| `deliverables/audit-2026/apercu-repli.html` | **Aperçu du comportement à vide** : galerie, catalogue et documents rendus avec des sources absentes ou vides, à partir des styles compilés et des visuels réellement embarqués. |
| `deploy/provision-bbi-intranet.ps1` | **Script PnP PowerShell idempotent** : listes, colonnes, vues, bibliothèques, pages, web parts, custom action « plein écran », thème, navigation, données d'exemple. Modes `-DryRun` (simulation) et `-VerifyOnly` (audit). |
| `deploy/README.md` | Guide de mise en place pas à pas + réglages de conformité (étiquettes, IRM, ouverture navigateur) + dépannage. |
| `deliverables/spfx/bbi-intranet.sppkg` | **Package v1.4.0.0** : 7 web parts + 1 extension, visuels de repli embarqués. |
| `teams/New-BbiTeamsPackage.ps1` | **Générateur de packages Teams / Viva Connections** (manifestes + icônes + .zip) pour l'expérience *zéro chrome SharePoint*. Guide : `teams/README.md`. |
| `bbi-environnement.json` | **Tenant et site du client** — source unique de vérité : `businessbuilderinter.sharepoint.com`, `/sites/intranet`, groupe concepteurs, URL du workbench hébergé. Les scripts PowerShell et les réglages de développement s'y réfèrent. |

### Ce que fait la version 1.4.0.0

- **Aucune page vide, quelles que soient les données.** Chaque composant interroge sa source SharePoint ; si la liste, la bibliothèque ou la galerie est **absente, non créée ou encore vide**, il affiche un contenu de repli réaliste (visuels et textes BBI embarqués dans le package) au lieu d'un écran vide ou d'un message d'erreur. Aucune configuration n'est nécessaire pour que les pages soient présentables dès l'installation ; vos contenus remplacent automatiquement les exemples dès la première publication.
- **Bandeaux d'information masqués par défaut.** L'option de propriété `Afficher les indicateurs de données de démonstration` (`showDataNotices`, désactivée par défaut) permet d'afficher un bandeau expliquant qu'un contenu de repli est utilisé — utile pendant la mise en place, invisible en production.
- **Harnais de vérification livré** — `bbi-intranet/tools/verify-fallback.js` transpile les couches de données réelles et les exécute contre un client SharePoint simulé : **42 vérifications** couvrant source absente (404), source vide et source alimentée. Commande : `node tools/verify-fallback.js`.

### Ce que fait la version 1.3.0.0

- **`BBI Fiche formation`** *(nouveau, modèle de page)* — la page lit `?code=BBI-MGT-101` : objectifs, programme, prérequis, public, sessions à venir, supports et formateurs référents.
- **`BBI Sessions & inscriptions`** *(nouveau)* — planning groupé par mois, recherche, filtres filière/modalité, statut d'inscription, « Ajouter à mon agenda », lien vers la fiche formation.
- **`BBI Article d'actualité`** *(nouveau, modèle de page)* — piloté par `?itemid=12` : visuel, chapô, auteur, temps de lecture, partage et actualités liées (HTML assaini).
- **Packages Teams / Viva Connections** — `teams/New-BbiTeamsPackage.ps1` génère les 3 applications (Accueil, Galerie, Fiche) à téléverser dans le catalogue d'applications Teams : la page BBI s'y affiche **sans aucun chrome SharePoint**.

### Ce que fait la version 1.2.0.0

- **`BBI Accueil (plein écran)`** — héros 100 % écran (mesure automatique du chrome SharePoint, y compris en workbench), bandeau d'information, chiffres clés, accès directs, actualités, sessions, catalogue intégré, galerie, supports publiés, formateurs, pied de page, retour en haut. Manifeste : `supportsFullBleed` + `SharePointFullPage`.
- **`BBI Galerie médias`** (nouveau) — albums filtrables, mosaïque, visionneuse plein écran accessible (clavier, focus, `aria-modal`), vidéos mp4, vignettes `?width=800`, repli sur données d'exemple.
- **`BBI Plein écran`** (nouvelle extension) — supprime les marges du canevas **uniquement sur les pages applicatives** (`SingleWebPartAppPage`) : c'est ce qui donne le bord-à-bord réel, sans toucher au cadre Microsoft (interdit et non supporté).

### Mise en service en 3 commandes

Le tenant et le site sont déjà renseignés dans **`bbi-environnement.json`** (racine du dépôt) :
`businessbuilderinter.sharepoint.com` · site `https://businessbuilderinter.sharepoint.com/sites/intranet`.
Rien à ressaisir : les scripts `deploy/` et `teams/` lisent ce fichier.

```powershell
cd deploy
.\provision-bbi-intranet.ps1 -DryRun        # simulation
.\provision-bbi-intranet.ps1 -SeedDemoData  # installation
.\provision-bbi-intranet.ps1 -VerifyOnly    # audit
```

## Contenu

| Fichier | Rôle |
|---|---|
| `deliverables/index.html` | **Dossier de conception complet** (13 sections + 2 annexes) : architecture hub, page d'accueil, UX, UI/thème, gestion des formations, protection des documents (lecture seule / anti-téléchargement / anti-impression), SPFx, configurations, gouvernance, ALM, feuille de route, licences. |
| `deliverables/maquette-accueil.html` | Maquette HTML d'origine; sa version fonctionnelle est la web part **BBI Accueil** dans `bbi-intranet/`. |
| `deliverables/bbi-theme.json` | Thème SharePoint personnalisé BBI (bleu nuit #0E265C) à publier via `Add-PnPTenantTheme`. |
| `deliverables/spfx/bbi-intranet.sppkg` | **Package installable** (web parts ci-dessus, assets embarqués). |
| `bbi-intranet/` | Projet SPFx source (Dockerfile + docker-compose inclus). |
| `deliverables/assets/img/` | Logo BBI (converti en PNG) + visuels d'illustration générés pour la maquette. |

## Palette dérivée du logo

- Bleu nuit : `#0E265C` (primaire)
- Rouge BBI : `#D21419` (accent)
- Neutres : texte `#21252B`, bordures `#E1E4EA`, fonds `#F4F6FA`

## Points d'attention clés

1. **Architecture** : 1 hub + 3 sites (vitrine / catalogue / espace formateurs) — l'édition est confinée à l'Espace Formateurs, la publication est une copie verrouillée.
2. **Protection documentaire** : défense en profondeur (permissions Lecture → étiquette/IRM « afficher uniquement » → accès conditionnel web-only → audit). La capture d'écran reste impossible à bloquer nativement — parades documentées (§7.4).
3. **SPFx ciblé** : trois web parts (`BBI Accueil`, `BBI Catalogue des formations`, `BBI Documents sécurisés`) — les autres fonctions restent en web parts natives.
