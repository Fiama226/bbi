# BBI Intranet dans Teams & Viva Connections — zéro chrome SharePoint

Cette partie répond à la limite honnête du navigateur : **dans un navigateur, la barre de suite Microsoft
(waffle, recherche, avatar) ne peut pas être retirée** (personnalisation interdite et non supportée par Microsoft).
Dans **Teams**, il n'y a aucun chrome SharePoint : la page BBI s'affiche en plein écran, intégralement.

> Ce n'est pas une application « différente » : ce sont **les mêmes web parts SPFx**, déclarées dans
> leurs manifestes avec les hôtes `TeamsTab` et `TeamsPersonalApp`. Une seule base de code, deux expériences.

---

## 1. Comment ça marche (l'essentiel)

Depuis **SPFx 1.20+**, Teams est un *hôte de développement continu* : les composants destinés à Teams ne sont
plus embarqués dans le `.sppkg` ; ils sont déployés via le **catalogue d'applications Teams**. On fournit donc :

1. la solution SPFx (déjà déployée) — qui déclare les hôtes Teams ;
2. un **package d'application Teams** (`.zip` contenant `manifest.json` + 2 icônes) par application, généré par le script de ce dossier.

Le manifeste pointe vers l'URL de la page SharePoint. Résultat : la même page sert
en **onglet personnel Teams**, dans **Viva Connections**, et dans le navigateur.

---

## 2. Générer les packages

Le tenant et le site sont lus dans **`bbi-environnement.json`** (racine du dépôt) —
`businessbuilderinter.sharepoint.com` et `/sites/intranet` — donc plus rien à saisir :

```powershell
cd teams

# 1) Aperçu (aucun fichier créé)
.\New-BbiTeamsPackage.ps1 -DryRun

# 2) Génération des trois applications
.\New-BbiTeamsPackage.ps1

# 3) Une seule application, avec une version plus récente
.\New-BbiTeamsPackage.ps1 -App Home -Version 1.0.1
```

Sortie : `deliverables/teams/bbi-teams-home.zip`, `bbi-teams-gallery.zip`, `bbi-teams-fiche.zip`.

| Application | Page SharePoint | Onglet Teams |
|---|---|---|
| `bbi-teams-home.zip` | `SitePages/accueil.aspx` | Accueil (plein écran) |
| `bbi-teams-gallery.zip` | `SitePages/galerie.aspx` | Galerie médias |
| `bbi-teams-fiche.zip` | `SitePages/formation.aspx` | Fiche formation |

---

## 3. Déployer dans Teams

1. **Teams admin center** → *Équipes* → *Applications* → **Gérer les applications** → **Téléverser une application personnalisée**.
2. Téléverser chaque `.zip` → **Autoriser pour l'organisation**.
3. **Épingler** l'application pour les équipes concernées (formateurs, direction) :
   *Applications* → *Politiques de configuration* → épingler « BBI Intranet — Accueil » dans la barre latérale.
4. Pour **Viva Connections** : utiliser la même page comme expérience d'accueil dans *Viva Connections* →
   tableau de bord et flux de la page d'accueil.

### Installation individuelle (test rapide)

Dans Teams : *Applications* → *Gérer vos applications* → *Télécharger une application personnalisée* →
sélectionner le `.zip`. L'onglet apparaît immédiatement dans la barre latérale.

---

## 4. Bonnes pratiques & pièges

| Point | Recommandation |
|---|---|
| **Nom & description** | Déjà rédigés (français, orientés usage). Modifiez-les dans le script, pas dans le `.zip`. |
| **Icônes** | `bbi-intranet/teams/<id>_color.png` (192×192) et `<id>_outline.png` (32×32) — fournies aux couleurs BBI (#0E265C / #D21419). |
| **Domaine déclaré** | `validDomains` contient uniquement votre domaine SharePoint : obligatoire, sinon l'onglet reste blanc. |
| **Version** | Incrémentez `-Version` à chaque republication, sinon Teams refuse la mise à jour. |
| **Authentification** | Le contexte utilisateur est celui de Teams (SSO Microsoft 365) : aucune configuration supplémentaire. |
| **Mobile** | Vérifiez la page d'accueil sur Teams mobile : les hero plein écran et la galerie ont été conçus pour cela. |
| **Impression / documents** | Les protections SharePoint (étiquette « afficher uniquement ») continuent de s'appliquer dans Teams. |

---

## 5. Vérification après déploiement

```powershell
# La page répond bien
Invoke-WebRequest "https://businessbuilderinter.sharepoint.com/sites/intranet/SitePages/accueil.aspx" -Method Head
```

Puis dans Teams :

1. Ouvrir l'application **BBI Intranet — Accueil** depuis la barre latérale.
2. Contrôler : aucun en-tête SharePoint, héros plein écran, navigation interne fonctionnelle.
3. Cliquer un élément de la galerie → la visionneuse s'ouvre en plein écran.
4. Ouvrir une fiche formation depuis le catalogue → l'URL contient `?code=BBI-…`.

> **Si l'onglet reste vide** : `validDomains` ne correspond pas au domaine de l'URL, ou l'utilisateur n'a pas
> accès au site. Le script affiche un avertissement si une icône manque — vérifiez aussi que le `.zip` contient
> bien `manifest.json` **à la racine**.
