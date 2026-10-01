# BBI — Annonces internes, version 1.10.0.0

Package : `bbi-intranet.sppkg` dans ce dossier.

## Changements

- Le bloc **Actualités BBI** est rétabli sur l'accueil : seul l'encart de détail vide « Cette actualité n'est plus disponible » doit disparaître, ainsi que l'organigramme complet sur l'accueil. Les vues Actualités et Organigramme restent accessibles.
- Le bandeau supérieur où figurait « Certification — 12 nouveaux formateurs certifiés » reste à son emplacement. Il lit désormais une liste **Annonces** distincte de **Actualites**.
- Le lien « Les annonces » ouvre la liste des dernières annonces (`#annonces`). Le bandeau et cette liste présentent jusqu’à huit annonces récentes non expirées, triées par date de création.
- Chaque annonce ouvre sa page dédiée dans le portail : `#annonce?id=23`. Les liens directs chargent l'annonce par son identifiant, pas seulement parmi les huit dernières du bandeau.
- Mariage, anniversaire, naissance, arrivée, départ, félicitations : type et pictogramme dédiés. Le corps éditorial est nettoyé avant affichage.
- Les corrections précédentes sont conservées : navigation bleue, statistiques après « Vos espaces », plein écran et sortie via ⚙ / Alt + Maj + E.

## Installer

1. Remplacer le package dans le catalogue d'applications et **Déployer** la version **1.10.0.0**. Selon votre mode de déploiement, mettre aussi l'application à jour sur le site.
2. Créer une liste SharePoint **Annonces** sur le site configuré dans la web part (le package ne crée pas automatiquement les listes).
3. Ajouter les colonnes ci-dessous. Pour conserver les noms internes attendus, créer d'abord les colonnes avec le nom technique, puis renommer leur libellé si souhaité.
4. Dans les propriétés de **BBI Accueil**, renseigner « Liste des annonces » : `Annonces`. Activer le bandeau.
5. **Laisser « Annonces déroulantes » vide** : des anciens textes/liens saisis dans ce champ restent prioritaires sur la liste. Effacer notamment un éventuel texte de certification saisi manuellement.
6. Ajouter de vraies annonces, republier la page et actualiser le navigateur. Le cache des annonces dure une minute.

## Colonnes

| Nom interne | Type | Usage |
|---|---|---|
| Title | Texte (déjà présent) | Titre de l'annonce |
| AnnonceType | Choix | Mariage, Anniversaire, Naissance, Arrivée, Départ, Félicitations, Autre |
| Body | Texte multiligne | Détails ; texte enrichi possible |
| EventDate | Date et heure | Date de l'événement |
| Image | Lien hypertexte / URL image | Photo facultative |
| ExpiresOn | Date et heure | Facultatif : après cette date, l'annonce disparaît du bandeau |

Les auteurs et dates de création sont ceux de SharePoint. Les autres colonnes sont facultatives ; une liste ne contenant que Title fonctionne mais sans détails supplémentaires.

Le script existant `deploy/provision-bbi-intranet.ps1` a également été enrichi pour créer cette liste et ses colonnes ; suivre son guide et son mode de simulation avant de l'exécuter (il provisionne aussi le reste du portail).

## Confidentialité et exemples

- Les annonces respectent les autorisations de la liste SharePoint. Réserver la publication aux responsables RH/communication et la lecture aux collaborateurs concernés.
- Pour les anniversaires, photos, mariages et naissances, ne publier que les informations autorisées par les personnes concernées.
- Une liste créée mais vide ne génère **aucun faux événement** : le bandeau disparaît.
- Si la source est indisponible (liste absente, erreur ou accès refusé), des exemples fictifs s'affichent, préfixés **« Exemple »** dans le bandeau et signalés sur la page de détail. Ils ne proviennent jamais des actualités. Créer et rendre accessible la liste avant utilisation en production.
- Une annonce expirée quitte le bandeau ; son lien direct reste accessible tant que l'élément existe et que le lecteur y a accès. L'expiration n'est pas une restriction d'accès.

## Vérifications effectuées

- Build de production propre et création du package : réussis, six avertissements de lint préexistants.
- Vérification du package : 10 contrôles réussis, aucun avertissement.
- Tests des données et du routage existants : 130 contrôles réussis.
- Tests du module Annonces : 38 contrôles réussis (source distincte, champs, filtre d'expiration, lien direct, liste vide et exemples).
- Rendu du bundle réel sous DOM simulé : parcours réussis pour workbench (liste alimentée, vide, indisponible) et page publiée (liste alimentée, vide). Sont contrôlés la source dédiée, les liens directs, le nettoyage du HTML, l’emplacement des statistiques, les actualités conservées, le chrome masqué et sa restauration. Aucune connexion au tenant n’est effectuée par ces tests.

Commandes depuis `bbi-intranet/` :

```bash
node tools/verify-announcements.js
node tools/verify-fallback.js
node tools/verify-package.js
node tools/css-harness.js release workbench live
node tools/css-harness.js release workbench empty
node tools/css-harness.js release workbench demo
node tools/css-harness.js release page live
node tools/css-harness.js release page empty
```

`live` désigne ici une liste **simulée** alimentée avec des fixtures, pas une connexion SharePoint réelle.

La validation visuelle et fonctionnelle sur votre tenant SharePoint reste à faire : ajouter une annonce, cliquer sur le bandeau, ouvrir le lien direct après actualisation, puis vérifier Accueil / Actualités / Organigramme et le plein écran sur page publiée et workbench.
