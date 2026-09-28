# Validation BBI 1.1.0 — 28 septembre 2026

## Exécuté dans cet environnement

| Contrôle | Résultat |
|---|---|
| `npm ci` (Node 22.22.3, npm 10.9.8) | Dépendances installées à partir du lockfile |
| `npm test` | **15 tests réussis** |
| `npm run build` | Tests, TypeScript 5.8.3, ESLint, Webpack production et packaging réussis, sans avertissement de build |
| Package `.sppkg` | 13 définitions de webparts ; version de solution 1.1.0.0 ; IDs catalogue/documents/solution conservés |
| `npm run test:browser` | **5 scénarios Playwright réussis** sur Chromium headless |
| Axe-core WCAG 2 A/AA et 2.1 AA | Aucune violation détectée sur l’accueil de démonstration ; ceci n’est pas un audit d’accessibilité complet |
| Responsive | Aucun débordement horizontal de page à 320, 390, 768, 1024 et 1440 px ; colonne autonome de 340 px testée sur viewport desktop |
| Serveur Heft/SPFx | Démarrage sur `0.0.0.0:4321`, compilation debug réussie |
| Manifeste via localhost | `/temp/build/manifests.js` : **HTTP 200**, `application/javascript`, CORS `*`, 13 IDs présents |
| Manifeste via interface réseau | **HTTP 200**, confirme l’écoute hors loopback interne |
| Certificat (Node) | Échec attendu sans confiance du CA ; succès avec `doctor --ca <CA local>` et vérification TLS active |
| `git diff --check` | Pas d’erreur d’espacement |

Tests navigateur exécutés sur le **rendu React autonome**, pas dans une page SharePoint. Le téléchargement standard de Chromium par Playwright n’était pas accessible dans ce sandbox ; Chromium 138 a été fourni via le paquet de test `@sparticuz/chromium`, hors du dépôt, avec ses bibliothèques runtime. La commande standard documentée utilise le navigateur installé par `npx playwright install chromium` ; un exécutable existant peut être fourni par `CHROMIUM_PATH`. Aucun binaire navigateur ni certificat n’est versionné.

### Ce que couvrent les tests unitaires

- Filtrage texte (insensible aux accents), code de formation et catégorie.
- Échappement OData des apostrophes.
- Validation JSON des sources ; cohérence entre les colonnes REST et le schéma de provisioning.
- Liens HTTP(S) uniquement, e-mails, conservation de la query et du fragment des documents lors de l’ajout de `web=1`.
- Pagination, limite de 500 éléments, refus des continuations hors site et détection des boucles.
- Erreurs HTTP 400, 403, 404, 500 et erreurs réseau propagées sans données fictives.
- Filtre utilisateur connecté du planning et exclusion des dossiers documentaires.
- Conservation des IDs des webparts existants ; mode réel par défaut.
- Correction de l’écoute Docker sans altérer l’URL publique du navigateur.

### Ce que couvrent les tests navigateur

- Composition de l’accueil et affichage des 12 modules autonomes.
- Navigation vers le catalogue, filtres, recherche, réinitialisation, ouverture de FAQ.
- États vides/erreur et bouton Réessayer, sans basculement silencieux en mode démo.
- Chargement des images, affichage mobile, colonne SharePoint simulée étroite.
- Analyse automatisée des libellés, structures et contrastes.

## Non exécuté ici — recette obligatoire dans votre environnement

**Aucun tenant Microsoft 365 n’a été connecté, et Docker/PnP PowerShell ne sont pas disponibles dans le sandbox.** La correction réseau a été exécutée via le même pipeline Heft, pas via Docker Desktop.

1. Exécuter `docker compose up --build -d` sur l’ordinateur cible ; vérifier le healthcheck puis l’URL du manifeste dans le navigateur.
2. Importer le CA du conteneur sur ce même ordinateur. Vérifier les politiques Edge/Chrome de réseau local et l’autorisation de scripts de debug SharePoint.
3. Déployer le `.sppkg` en site de recette. Tester les anciennes instances Catalogue/Documents et les nouvelles instances.
4. Exécuter le script PnP avec `-WhatIf`, puis sans ; le relancer pour vérifier l’absence de doublons et la conservation des contenus. Tester la création de page séparément.
5. Renseigner au moins une formation `Actif`, une session future avec l’adresse du formateur, un document autorisé et un document interdit à un utilisateur test.
6. Tester avec un propriétaire puis un lecteur : aucune donnée interdite ne doit être visible ; une erreur ne doit pas devenir une démonstration. **Le filtre FormateurEmail n’est pas une barrière de sécurité.**
7. Vérifier les liens réels des formulaires SharePoint, Teams/Viva Engage, l’espace de contribution, le contact support et l’ouverture Office/PDF.
8. Tester les sources absentes, les colonnes incorrectes, les listes vides et les comptes sans adresse disponible.
9. Confirmer les politiques de protection documentaire dans Microsoft 365. Ne jamais promettre l’absence de téléchargement/impression sur la seule base du webpart.
10. Recette clavier/lecteur d’écran, navigateur d’entreprise, thème de page, pleine largeur et large volumétrie. Publier seulement après validation des contenus et des droits.
