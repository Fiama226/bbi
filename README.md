# BBI — Intranet SharePoint Online · Livrables de conception

Livrables produits à partir du logo, des captures d'inspiration et des besoins fonctionnels BBI
(organisme de formation professionnelle).

## Contenu

| Fichier | Rôle |
|---|---|
| `deliverables/index.html` | **Dossier de conception complet** (13 sections + 2 annexes) : architecture hub, page d'accueil, UX, UI/thème, gestion des formations, protection des documents (lecture seule / anti-téléchargement / anti-impression), SPFx, configurations, gouvernance, ALM, feuille de route, licences. |
| `deliverables/maquette-accueil.html` | **Maquette haute-fidélité** de la page d'accueil (rendu statique non contractuel, pour atelier de validation UX/UI). |
| `deliverables/bbi-theme.json` | Thème SharePoint personnalisé BBI (bleu nuit #0E265C) à publier via `Add-PnPTenantTheme`. |
| `deliverables/assets/img/` | Logo BBI (converti en PNG) + visuels d'illustration générés pour la maquette. |

## Palette dérivée du logo

- Bleu nuit : `#0E265C` (primaire)
- Rouge BBI : `#D21419` (accent)
- Neutres : texte `#21252B`, bordures `#E1E4EA`, fonds `#F4F6FA`

## Points d'attention clés

1. **Architecture** : 1 hub + 3 sites (vitrine / catalogue / espace formateurs) — l'édition est confinée à l'Espace Formateurs, la publication est une copie verrouillée.
2. **Protection documentaire** : défense en profondeur (permissions Lecture → étiquette/IRM « afficher uniquement » → accès conditionnel web-only → audit). La capture d'écran reste impossible à bloquer nativement — parades documentées (§7.4).
3. **SPFx chirurgical** : 2–3 web parts seulement (`bbi-training-catalog`, `bbi-secure-documents`, `bbi-trainer-dashboard` en v2) — le reste en web parts natives.
