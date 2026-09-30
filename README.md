# BBI — Intranet SharePoint Online · Livrables de conception

Livrables produits à partir du logo, des captures d'inspiration et des besoins fonctionnels BBI
(organisme de formation professionnelle).

## 🚀 Application SPFx prête à installer

- **Package** : `deliverables/spfx/bbi-intranet.sppkg` — à téléverser dans l'App Catalog SharePoint Online
- **Sources** : `bbi-intranet/` (SPFx 1.22.2, TypeScript 5.8, React 17)
  - **`BBI Accueil — portail unifié`** — ajoutez uniquement cette web part à la page d'accueil : les vues Accueil, Formations, Sessions, Actualités, Ressources (supports + galerie) et Communauté sont intégrées dans une seule application sans quitter la page. Recherche locale et URLs partageables par vue.
- **Vérifications avant livraison** : `npx heft build` · `node tools/verify-fallback.js` (100 contrôles) · `node tools/css-harness.js dist` · `node tools/preview-smoke.js` (34 contrôles) · `npm run build` (package `sharepoint/solution/bbi-intranet.sppkg`).
- **Dev sous Docker** : `cd bbi-intranet && cp .env.example .env && docker compose up --build -d` — instructions complètes dans `bbi-intranet/README.md` (le workbench utilisé est celui du tenant SPO, le workbench local n'existe plus depuis SPFx 1.20+/Heft).


## 🆕 Itération 2026 — accueil plein écran, galerie, provisionnement

| Fichier | Rôle |
|---|---|
| `deliverables/audit-2026/index.html` | **Audit & recommandations** : comparatif des 3 routes « plein écran », refonte de l'accueil bloc par bloc (12 améliorations), **catalogue des pages #00 → #26**, modèle de contenu, design system, gouvernance, feuille de route 90 jours. |
| `deliverables/audit-2026/catalogue-pages.csv` | Le catalogue des pages en tableur (suivi projet). |
| `deliverables/audit-2026/apercu-accueil.html` | Aperçu visuel de la page d'accueil plein écran (styles compilés depuis le composant livré). |
| `deliverables/audit-2026/apercu-modeles-pages.html` | Aperçu visuel des trois modèles de page : fiche formation, sessions & inscriptions, article. |
| `deliverables/audit-2026/apercu-repli.html` | **Aperçu du comportement à vide** : galerie, catalogue et documents rendus avec des sources absentes ou vides, à partir des styles compilés et des visuels réellement embarqués. |
| `deploy/provision-bbi-intranet.ps1` | **Script PnP PowerShell idempotent** : listes, colonnes, bibliothèques et une seule page d'accueil avec une web part BBI Accueil, custom action « plein écran », thème et données d'exemple. Modes `-DryRun` et `-VerifyOnly`. |
| `deploy/README.md` | Guide de mise en place pas à pas + réglages de conformité (étiquettes, IRM, ouverture navigateur) + dépannage. |
| `deliverables/spfx/bbi-intranet.sppkg` | **Package v1.7.0.0** : portail BBI Accueil unifié (ajoutez une seule web part à la page), barre de navigation bleue, annonces déroulantes, diaporama du héros, chiffres clés sous le héros, actualités paginées avec page dédiée, employé du mois, certifications, organigramme, plein écran workbench inclus, extension plein écran et briques intégrées. |
| `teams/New-BbiTeamsPackage.ps1` | **Générateur de packages Teams / Viva Connections** (manifestes + icônes + .zip) pour l'expérience *zéro chrome SharePoint*. Guide : `teams/README.md`. |
| `bbi-environnement.json` | **Tenant et site du client** — source unique de vérité : `businessbuilderinter.sharepoint.com`, `/sites/intranet`, groupe concepteurs, URL du workbench hébergé. Les scripts PowerShell et les réglages de développement s'y réfèrent. |

| `deliverables/audit-2026/audit-minutieux.html` | **Audit minutieux de l'itération 2** : 8 demandes livrées et vérifiées, 18 écarts résiduels (accessibilité, performance, gouvernance, RGPD, Qualiopi), benchmark des bonnes pratiques 2026, **22 propositions priorisées**, feuille de route 90 jours, **cahier de recette en 22 contrôles**, risques et décisions à arbitrer. |
| `deliverables/audit-2026/apercu-portail.html` | **Aperçu cliquable du portail** : diaporama du héros, chiffres clés, actualités paginées + page dédiée, fiche formateur (WhatsApp, Teams), employé du mois, certifications, organigramme interactif. Styles compilés depuis les composants livrés (`bbi-intranet/tools/build-preview-css.js`) et vérifiés par `tools/preview-smoke.js`. |

### Ce que fait la version 1.7.0.0

- **Barre de navigation toujours bleue.** Elle n'était opaque que sur les autres vues : sur l'accueil elle redevenait translucide et laissait voir le héros. Le fond de marque est désormais appliqué à la barre elle-même, sur toutes les vues et à tous les défilements.
- **Annonces déroulantes.** La première section, au-dessus de la barre de navigation, n'est plus un texte fixe : c'est un ruban d'annonces qui défile en boucle. **Chaque annonce est un lien vers sa page de détail partageable** (`#actualite?id=12`). Source par défaut = les dernières actualités ; sinon la propriété `announcementText` accepte une ligne par annonce (`libellé | lien`). Le ruban se fige au survol et au focus, s'immobilise si l'utilisateur a demandé « animations réduites », et sa seconde copie est retirée du parcours de tabulation.
- **Chiffres clés sous le héros.** La bande des 4 KPI avait une marge haute de −48 px : elle passait **par-dessus** le diaporama et masquait les pastilles, les flèches, le lien « Explorer » et le bas des textes dès que le héros était chargé ou l'écran petit. Elle est posée dans le flux normal, avec un espacement régulier.
- **Accueil recentré.** L'organigramme et l'encart « Cette actualité n'est plus disponible » qui le précédait ne s'affichent plus sur l'accueil : chacun garde sa propre vue (`#organigramme`, `#actualite?id=12`), toujours accessible depuis le menu, les accès directs et le pied de page.
- **Plein écran réel, workbench compris.** Chrome SharePoint, barre de navigation gauche, barre de commandes et cadre d'édition du workbench sont masqués ; le canevas est élargi à 100 % sans marge ni bordure. L'extension **BBI Plein écran** s'applique aussi au workbench et masque la barre de commandes par défaut. **Alt + Maj + E** rétablit le chrome SharePoint pour les opérations de maintenance.
- **Vérifications renforcées** : `verify-fallback` 100 → **128** contrôles (dont 8 sur les annonces et leur routage), `preview-smoke` 34 → **38** (bandeau déroulant, clic → page de détail, chiffres clés sans marge négative), `css-harness` vérifie en plus la barre opaque, la position des chiffres et l'absence d'organigramme sur l'accueil.

### Ce que fait la version 1.6.0.0

- **Héros en diaporama (images *et* textes).** Défilement automatique de 8 s, flèches, pastilles, barre de progression, pause au survol et à l'onglet inactif, arrêt si l'utilisateur a demandé « animations réduites ». Une diapositive peut n'avoir **que du texte** : `image | sur-titre | titre | accroche | bouton | lien` (le premier champ vide = diapositive sans visuel).
- **Chiffres clés enfin visibles.** La bande des 4 KPI est sortie de la zone rognée du diaporama (`overflow:hidden`) : elle reste dans le flux et s'affiche à toutes les largeurs (puisée sous le héros depuis la 1.7.0.0).
- **Actualités paginées + page dédiée.** Clic sur une actualité → page complète (`#actualite?id=12`, partageable) avec fil d'Ariane, chapô, auteur, date, temps de lecture, HTML assaini, partage Outlook / Teams / copie du lien, **actualité suivante, précédente et autres actualités**. Pagination « précédent / numéros / suivant » alimentée page par page côté serveur : le volume ne dégrade pas l'affichage.
- **Employé du mois & certifications.** Nouvelle section « Vie de l'équipe » alimentée par deux nouvelles listes (portrait, fonction, message, faits marquants, organisme, périmètre, échéance, statut).
- **Annuaire des formateurs avec photo et fiche contact.** Au clic : téléphone, e-mail, **WhatsApp** (`wa.me` normalisé), Teams, localisation, biographie, spécialités, certifications et sessions animées. Fiche accessible au clavier (Échap, focus piégé puis restitué).
- **Organigramme interactif.** Nouvelle vue `#organigramme` dans la barre de navigation, le pied de page et les accès directs : arbre connecté, zoom 60–140 %, mise en avant par pôle, bascule liste, fiche contact au clic. Colonne « Ordre » créée sous son nom interne sûr (`Ordre`, jamais `Order`).
- **Densité revue.** Espaces de section réduits (96 → 50 px, 46 px pour actualités/sessions), galerie replacée à droite des supports sans colonne vide, blocs « Accès directs » et « Communauté » compactés.
- **Vérifications automatisées.** `node tools/verify-fallback.js` → **100 vérifications** (source absente, vide, alimentée), `node tools/css-harness.js dist` (styles réellement injectés, KPI hors zone rognée, pagination, navigation) et `node tools/preview-smoke.js` → **34 vérifications** de parcours sur l'aperçu cliquable.

### Ce que fait la version 1.4.0.0

- **Aucune page vide, quelles que soient les données.** Chaque composant interroge sa source SharePoint ; si la liste, la bibliothèque ou la galerie est **absente, non créée ou encore vide**, il affiche un contenu de repli réaliste (visuels et textes BBI embarqués dans le package) au lieu d'un écran vide ou d'un message d'erreur. Aucune configuration n'est nécessaire pour que les pages soient présentables dès l'installation ; vos contenus remplacent automatiquement les exemples dès la première publication.
- **Bandeaux d'information masqués par défaut.** L'option de propriété `Afficher les indicateurs de données de démonstration` (`showDataNotices`, désactivée par défaut) permet d'afficher un bandeau expliquant qu'un contenu de repli est utilisé — utile pendant la mise en place, invisible en production.
- **Harnais de vérification livré** — `bbi-intranet/tools/verify-fallback.js` transpile les couches de données réelles et les exécute contre un client SharePoint simulé : **42 vérifications** couvrant source absente (404), source vide et source alimentée (portées à **100** depuis la version 1.6.0.0, puis à **128** depuis la 1.7.0.0). Commande : `node tools/verify-fallback.js`.

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
| `deliverables/spfx/bbi-intranet.sppkg` | **Package installable v1.7.0.0** (web parts ci-dessus, assets embarqués). |
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
