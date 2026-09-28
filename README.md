# BBI — Intranet SharePoint Online

## Version 1.1 : accueil complet et modules réutilisables

La solution comprend **13 webparts SPFx** : **BBI Accueil**, qui compose une page complète, et 12 modules autonomes : bienvenue, actualités, sessions/planning, liens rapides, catalogue, documents, annuaire, indicateurs, ressources/qualité, communauté, espace formateur, support/FAQ.

- **[Package installable 1.1.0.0](deliverables/spfx/bbi-intranet.sppkg)** — assets embarqués, IDs existants conservés.
- **[Installation, configuration et données](bbi-intranet/README.md)** — commencer ici.
- **[Diagnostic workbench / Docker / manifests.js](bbi-intranet/docs/DEBUG-WORKBENCH.md)** — correction réseau, certificat, erreurs et outils de diagnostic.
- **[Script PnP de création des listes et de la page](bbi-intranet/scripts/Provision-Bbi.ps1)** — ne remplace l’accueil existant que sur demande explicite.
- **[Rapport de validation](bbi-intranet/docs/VALIDATION.md)** — tests exécutés et vérifications restant à réaliser sur le tenant.

### Utilisation

Déployer le package dans l’App Catalog, créer une page moderne puis ajouter **BBI Accueil** : les modules se composent automatiquement. **Le déploiement du package seul ne remplace pas votre page d’accueil.** Pour alimenter la page, créer les listes via le script PnP et renseigner les contenus. Le mode démo est explicite, désactivé par défaut, et n’écrit aucune donnée.

Aperçu interactif hors SharePoint (mêmes composants React, données fictives et simulations) :

```bash
cd bbi-intranet
npm ci
npm run preview:build
npm run preview
```

Ouvrir `http://localhost:3000`. Cet aperçu ne se substitue pas au workbench authentifié du tenant.

### Identité visuelle

Logo BBI existant ; bleu nuit **#0E265C**, rouge **#D21419**, texte #21252B, bordures #E1E4EA et fonds #F4F6FA. Mise en page responsive, cartes, navigation, filtres, états vides/erreur et prise en charge des colonnes SharePoint étroites.

## Livrables de conception initiaux (référence historique)

| Fichier | Rôle |
|---|---|
| `deliverables/index.html` | Dossier de conception : architecture, gouvernance, sécurité documentaire, licences et feuille de route. |
| `deliverables/maquette-accueil.html` | Première maquette statique non contractuelle ; la solution React/SPFx est désormais la référence de l’implémentation. |
| `deliverables/bbi-theme.json` | Thème SharePoint BBI à publier séparément via `Add-PnPTenantTheme`. |
| `deliverables/assets/img/` | Logo et illustrations utilisés dans la conception. |

Ces documents décrivent aussi des pistes de configuration/intégration, pas toutes automatisées dans le package. **`web=1` n’est pas une protection anti-téléchargement ou anti-impression** : permissions, labels/IRM, accès conditionnel et audit doivent être configurés côté Microsoft 365. Les indicateurs sont éditoriaux ; les liens communautaires ouvrent Teams/Viva Engage sans simuler un flux intégré.
