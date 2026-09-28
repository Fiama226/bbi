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
