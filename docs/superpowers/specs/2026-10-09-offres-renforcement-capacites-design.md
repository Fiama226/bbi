# Portail BBI : repositionnement « renforcement de capacités » (Formation, Conseil, Coaching)

Date : 2026-10-09 · Statut : en attente de relecture · Cible : `bbi-intranet/src/webparts/bbiHome`

## 1. Contexte et objectif

Après la présentation au client, le retour est positif mais le portail est jugé trop centré sur la formation. Selon le client, la formation ne représente qu'environ 20 % de l'activité de BBI. Le reste est du conseil et du coaching. BBI se définit comme un acteur du **renforcement de capacités**.

Objectif : le portail présente les trois pôles **Formation, Conseil, Coaching** à égalité, sans perdre les fonctions existantes (sessions, actualités, ressources, communauté).

Critères de réussite :

1. Un visiteur comprend en dix secondes que BBI fait trois métiers, depuis le héros et l'accueil.
2. Le catalogue se filtre par pôle puis par filière, et chaque offre porte les informations adaptées à son pôle (durée libre, livrables).
3. Le contrat de repli à trois états (source absente, vide, alimentée) est respecté pour la nouvelle liste.
4. Aucun lien existant (`#formations`, favoris, alias historiques) ne casse.

## 2. Décisions validées avec le demandeur

| Question | Décision |
|---|---|
| Profondeur | Trois pôles dans le catalogue, textes rééquilibrés, pas une vue par pôle |
| Données | **Nouvelle liste `Offres`**, la liste `Formations` n'est plus lue par le portail |

Hors périmètre : une vue de navigation par pôle, la migration automatique des lignes de `Formations` vers `Offres`, la suppression du web part autonome `trainingCatalog` (conservé pour compatibilité).

## 3. Navigation et routage

- Le libellé « Formations » devient **« Nos offres »** (`#offres`).
- La vue interne garde l'identifiant `formations`. Cela évite de toucher aux attributs `data-bbi-view`, aux ancres et à la recherche. Seul l'alias d'URL est ajouté : `offres: "formations"` dans `VIEW_FROM_HASH`. `#formations` et `#catalogue` restent valides.
- Le filtre de pôle se pilote par l'URL : `#offres?pole=conseil` (valeurs `formation`, `conseil`, `coaching`). Le parsing reste dans `portalRoutes.ts` / `homeLayout.ts`, en fonctions pures.
- « Sessions » devient **« Sessions & missions »**. Aucun changement de schéma sur la liste `Sessions`.

## 4. Modèle de données : liste `Offres`

| Colonne | Nom interne | Type |
|---|---|---|
| Titre | `Title` | Texte |
| Pôle | `Pole` | Choix : Formation, Conseil, Coaching |
| Code | `CodeOffre` | Texte |
| Filière | `Filiere` | Texte |
| Format | `Format` | Choix : Présentiel, Distanciel, Hybride, Sur site client |
| Durée | `Duree` | Texte libre (« 2 jours », « 6 mois », « 3 ateliers ») |
| Public cible | `PublicCible` | Texte |
| Niveau | `Niveau` | Choix : Débutant, Intermédiaire, Confirmé, Expert |
| Statut catalogue | `StatutCatalogue` | Choix : Actif, En refonte, Archivé |
| Description | `Description` | Note |
| Objectifs | `Objectifs` | Note |
| Programme ou démarche | `Programme` | Note |
| Prérequis | `Prerequis` | Note |
| Livrables | `Livrables` | Note |

Règles :

- Noms internes sans espace ni accent, conformément au schéma du projet.
- Ligne sans `Pole` : traitée comme **Formation**.
- Seules les lignes `StatutCatalogue = Actif` sont affichées. Une valeur vide est traitée comme Actif, comme aujourd'hui.
- Le web part gagne une propriété de volet `offersListTitle` (défaut `Offres`), à côté de `formationsListTitle`, qui reste pour le web part autonome.

## 5. Composants

**Nouveau, dans `bbiHome/components/`** (pas de modification de `trainingCatalog`, qui reste utilisé en autonome) :

- `offersData.ts` : types, pôles, données de démonstration, chargeur à trois états via `listApiUrl`, normalisation (pôle par défaut, statut), regroupement et filtres. Pur et testable sans navigateur.
- `OffersCatalog.tsx` + `.module.scss` : puces de pôle (Formation, Conseil, Coaching, avec compteurs), filtre de filière en second niveau, recherche texte reprise du catalogue actuel, cartes affichant pôle, format, durée, niveau. Mode `compact` pour l'accueil. L'URL `?pole=` initialise la puce active.
- `PillarsStrip` (dans `OffersCatalog.tsx` ou fichier voisin) : bandeau de trois cartes sous le héros de l'accueil. Chaque carte : pictogramme, promesse en une ligne, lien `#offres?pole=…`.

**Modifiés :**

- `BbiHome.tsx` : navigation, en-tête de vue (« Renforcement de capacités » / « Nos offres »), remplacement de `TrainingCatalog` par `OffersCatalog` dans la vue et dans l'aperçu d'accueil (deux offres par pôle au lieu de six formations), libellés « Sessions & missions ».
- `BbiHomeWebPart.ts` : propriété `offersListTitle`, textes par défaut recentrés (voir 6).
- `portalRoutes.ts` : alias `offres`, lecture du paramètre `pole`.

Les cartes d'offre gardent le comportement des cartes du catalogue actuel (point ouvert 1).

## 6. Textes par défaut (modifiables dans le volet de propriétés)

Ils ne s'appliquent que quand la propriété est vide. Un site déjà configuré garde ses textes.

- **Héros** : diapositives recentrées sur les trois pôles. Exemple : « Renforcer les capacités de vos équipes et de vos organisations », accroche « Formation, conseil et coaching pour transformer vos ambitions en résultats durables », bouton « Découvrir nos offres » vers `#offres`.
- **Chiffres clés** : remplacer « 10+ Formations au catalogue » par « 3 pôles : formation, conseil, coaching ». Les autres chiffres restent.
- **Vision, mission, objectifs** : reformulés autour du renforcement de capacités. Les valeurs par défaut sont proposées en relecture et le client valide le fond.
- **Liens rapides** : « Catalogue des formations » devient « Nos offres : formation, conseil, coaching ».

## 7. Contenu de démonstration

Pour que la page soit complète sans aucune donnée, le repli contient environ douze offres : cinq Formation, quatre Conseil (diagnostic organisationnel, structuration de dispositif de formation, accompagnement au changement, mise en conformité qualité), trois Coaching (coaching de dirigeants, coaching d'équipe, cycle d'accompagnement d'entrepreneurs). Les actualités et sessions de démonstration de `homeData.ts` sont rééquilibrées de la même façon (missions de conseil, cycles de coaching).

## 8. Provisionnement

Dans `deploy/provision-bbi-intranet.ps1` :

- Création de la liste `Offres` et de ses colonnes avec les fonctions existantes (`Ensure-BbiList`, `Ensure-BbiField`), plus deux vues (« Catalogue actif », « Par pôle »).
- Ajout de `offersListTitle = 'Offres'` dans les propriétés du web part et du texte d'accroche par défaut.
- Données d'exemple sous `-SeedDemoData`, alignées sur la section 7.
- `deploy/README.md` : table des listes et schéma mis à jour. `CLAUDE.md` : mention de la liste `Offres` et de la vue « Nos offres ».

## 9. Vérification

- `tools/verify-fallback.js` : nouvelle suite pour `Offres` (absente, vide, alimentée), pôle par défaut, filtrage Actif, alias `#offres` et `?pole=`. Le compteur total est mis à jour dans la documentation.
- `tools/css-harness.js` : les nouvelles classes (puces de pôle, bandeau des trois pôles) sont réellement injectées.
- `tools/preview-smoke.js` : l'aperçu `deliverables/audit-2026/apercu-portail.html` suit le nouveau libellé. Si l'aperçu est généré à la main, la mise à jour est faite à la main.
- Build de production, `tools/verify-package.js`, puis nouvelle version du paquet (1.9.0.0) pour déclencher la mise à niveau dans le catalogue.

## 10. Risques et points ouverts

1. Les cartes du catalogue actuel renvoient-elles vers une fiche ? À lire dans `TrainingCatalog.tsx` avant d'écrire `OffersCatalog`, pour garder le même comportement.
2. La recherche globale (`homeSearch.ts`) indexe peut-être le catalogue. Si oui, elle doit lire `Offres` avec le même repli.
3. Les textes de Vision, Mission et Objectifs doivent être validés par le client. Ils sont fournis comme proposition.
4. Les sites filiales exécutent le même web part et auront une liste `Offres` vide : le repli de démonstration s'appliquera tant que le provisionnement n'a pas été relancé sur chaque filiale.
5. L'ancienne liste `Formations` du tenant n'est plus lue. Aucune migration automatique n'est prévue.
