# Hub + sites par filiale, cartes de sites, annuaires en tuiles — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Le siège `/sites/intranet` devient un hub avec un site d'équipe par filiale exécutant le même portail, l'accueil siège affiche des cartes de sites et des annuaires en tuiles icône + libellé, dans l'ordre du croquis client.

**Architecture:** La liste `Implantations` reste la source unique de vérité (trois colonnes ajoutées). Le script PowerShell gagne une fonction `Invoke-BbiSiteProvisioning` réutilisée pour le siège et chaque filiale, plus un commutateur `-ProvisionFiliales`. Côté web part, deux nouveaux composants (`SiteNetwork`, `LinkDirectory`) alimentés par des adaptateurs purs testés dans `tools/verify-fallback.js`, et un réordonnancement des sections de `BbiHome.tsx`.

**Tech Stack:** SPFx 1.22.2, TypeScript 5.8, React 17, SCSS modules, PnP.PowerShell 2.x, harnais Node (`tools/verify-fallback.js`, `tools/css-harness.js`).

**Spec:** `docs/superpowers/specs/2026-10-07-hub-filiales-design.md`

## Global Constraints

- Node >= 22.14 ; toutes les commandes `npm`/`node` se lancent depuis `bbi-intranet/`.
- Contrat trois états : liste absente (404) / vide / alimentée → toujours un rendu complet. Une liste `Implantations` **sans** `SiteUrl`, `Couleur`, `Initiales` doit continuer de fonctionner.
- Tout href ou URL d'image issu d'une liste passe par `safeHref` / `safeImageUrl` (`src/shared/safeUrl.ts`).
- Les appels REST passent par `src/shared/sharePointRest.ts` (`listApiUrl`), jamais d'URL `_api` construite à la main.
- Noms internes de colonnes sans espaces ; `Ordre` et jamais `Order`.
- Le script de provisioning est idempotent et respecte `-DryRun` et `-VerifyOnly` ; son comportement **sans** `-ProvisionFiliales` est inchangé.
- Sites de filiale : `New-PnPSite -Type TeamSite` (groupe Microsoft 365), alias `intranet-<ville>`.
- Textes UI en français. Pas de nouvelle dépendance npm.
- Chaque tâche se termine par `node tools/verify-fallback.js` vert ; les tâches touchant du TSX se terminent aussi par `npx heft build` et `node tools/css-harness.js dist` verts.

## Review Focus

1. `Ville` avec accents, espaces ou apostrophe (`Côte d'Ivoire`, `San Pedro`) → le slug doit être `intranet-cote-divoire` / `intranet-san-pedro`, jamais un alias refusé par SharePoint. Test ajouté en Tâche 7 (`ConvertTo-BbiSlug`).
2. `Couleur` absente, vide ou invalide (`bleu`, `#12`, `javascript:`) → la carte prend la couleur du thème, aucune injection de style. Test ajouté en Tâche 1 (`safeColor`).
3. `SiteUrl` avec schéma dangereux (`javascript:alert(1)`) ou valeur Hyperlink objet `{ Url, Description }` → rejeté ou extrait proprement, jamais rendu brut. Test ajouté en Tâche 1.
4. `Initiales` de plus de 3 caractères ou absentes → repli sur les deux premières lettres significatives du `Title`, tronqué à 3. Test ajouté en Tâche 1 (`initialsOf`).
5. Document administratif sans extension ou avec extension inconnue (`.zip`), ou référence pédagogique sans `LienUrl` → tuile rendue sans lien, icône générique, aucune exception. Test ajouté en Tâche 2.

---

## Structure des fichiers

**Créés**
- `bbi-intranet/src/webparts/bbiHome/components/linkDirectoryData.ts` — adaptateurs purs : `adminDocumentsToGroups`, `pedagogicalReferencesToGroups`, types `ILinkGroup`, `ILinkItem`.
- `bbi-intranet/src/webparts/bbiHome/components/LinkDirectory.tsx` + `.module.scss` — grille de tuiles icône + libellé groupées.
- `bbi-intranet/src/webparts/bbiHome/components/SiteNetwork.tsx` + `.module.scss` — cartes de sites.
- `bbi-intranet/src/webparts/bbiHome/components/AnnouncementsList.tsx` + `.module.scss` — liste des annonces actives (colonne gauche de la ligne Annonces | Vie de l'équipe).
- `deploy/BbiSlug.ps1` — fonction `ConvertTo-BbiSlug` (séparée pour être testable sans exécuter le script).

**Modifiés**
- `bbi-intranet/src/webparts/bbiHome/components/homeData.ts` — `IHomeOffice`, `OFFICE_FIELDS`, `asOffice`, `DEMO_OFFICES`, helpers `safeColor`, `initialsOf`.
- `bbi-intranet/src/webparts/bbiHome/components/BbiHome.tsx` — imports, ordre des sections, nouveaux composants.
- `bbi-intranet/src/webparts/bbiHome/components/BbiHome.module.scss` — classe `.homeRow`.
- `bbi-intranet/tools/verify-fallback.js` — nouveaux `check`.
- `bbi-intranet/tools/css-harness.js` — gardes `[data-bbi-site-card]`, `[data-bbi-link-directory]`.
- `deploy/provision-bbi-intranet.ps1` — colonnes, fonction `Invoke-BbiSiteProvisioning`, section hub/filiales, contrôles.
- `bbi-environnement.json` — `hubEnabled`, `filialeSitePrefix`.
- `deploy/README.md`, `CLAUDE.md` — documentation.

**Supprimés** (après remplacement)
- `OfficeNetwork.tsx` + `.module.scss`, `PedagogicalReferences.tsx` + `.module.scss`, `DocumentShelf.tsx` + `.module.scss`.

---

### Task 1: Modèle `IHomeOffice` étendu (SiteUrl, Couleur, Initiales)

**Files:**
- Modify: `bbi-intranet/src/webparts/bbiHome/components/homeData.ts:115-128` (interface), `:993-1003` (OFFICE_FIELDS), `:1205-1220` (asOffice), `:669-710` (DEMO_OFFICES)
- Test: `bbi-intranet/tools/verify-fallback.js` (fonction `testOfficesAndReferences`)

**Interfaces:**
- Produces: `IHomeOffice.SiteUrl?: string`, `IHomeOffice.Couleur?: string`, `IHomeOffice.Initiales?: string` ; exports `safeColor(value?: string): string | undefined` (retourne `#RRGGBB` ou `undefined`) et `initialsOf(title: string, explicit?: string): string` (1 à 3 lettres majuscules).

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `tools/verify-fallback.js`, à la fin de `testOfficesAndReferences`, avant l'accolade fermante :

```js
  // --- Colonnes de site (SiteUrl, Couleur, Initiales) ---
  const { safeColor, initialsOf } = loadTsModule('src/webparts/bbiHome/components/homeData.ts');
  check('couleur — hex valide conservé', safeColor('#0E265C') === '#0E265C');
  check('couleur — hex court étendu', safeColor('#abc') === '#AABBCC');
  check('couleur — valeur invalide rejetée', safeColor('bleu') === undefined && safeColor('#12') === undefined);
  check('couleur — tentative d\'injection rejetée', safeColor('red;background:url(x)') === undefined);
  check('initiales — explicites conservées (3 max)', initialsOf('Filiale Abidjan', 'ABJX') === 'ABJ');
  check('initiales — repli sur le titre', initialsOf('Filiale Abidjan') === 'FA');
  check('initiales — titre à un mot', initialsOf('Siège') === 'SI');
  check('initiales — titre avec tiret cadratin', initialsOf('Siège — Paris') === 'SP');

  const demoWithSites = await loadHomeOffices(missing, SITE, 'Implantations');
  check('implantations — repli : chaque site a SiteUrl, Couleur et Initiales',
    demoWithSites.items.every((o) => !!o.SiteUrl && !!o.Couleur && !!o.Initiales));

  const legacyOffices = await loadHomeOffices(
    fakeClient([
      { match: /fields/, json: { value: [{ InternalName: 'EstSiege' }, { InternalName: 'Ville' }] } },
      { match: /items/, json: { value: [{ Id: 1, Title: 'Siège', EstSiege: true, Ville: 'Paris' }] } }
    ]),
    SITE,
    'Implantations'
  );
  check('implantations — liste ancienne sans colonnes de site → rendu sans erreur',
    legacyOffices.isDemo === false && legacyOffices.items[0].SiteUrl === undefined && legacyOffices.items[0].Couleur === undefined);

  const siteOffices = await loadHomeOffices(
    fakeClient([
      { match: /fields/, json: { value: [{ InternalName: 'SiteUrl' }, { InternalName: 'Couleur' }, { InternalName: 'Initiales' }] } },
      {
        match: /items/,
        json: {
          value: [
            { Id: 1, Title: 'Filiale Abidjan', SiteUrl: { Url: 'https://tenant.sharepoint.com/sites/intranet-abidjan', Description: 'Abidjan' }, Couleur: '#C8102E', Initiales: 'AB' },
            { Id: 2, Title: 'Antenne Bamako', SiteUrl: 'javascript:alert(1)', Couleur: 'rouge', Initiales: '' }
          ]
        }
      }
    ]),
    SITE,
    'Implantations'
  );
  check('implantations — SiteUrl Hyperlink (objet) extrait', siteOffices.items[0].SiteUrl === 'https://tenant.sharepoint.com/sites/intranet-abidjan');
  check('implantations — SiteUrl javascript: rejeté', siteOffices.items[1].SiteUrl === undefined);
  check('implantations — Couleur invalide ignorée', siteOffices.items[1].Couleur === undefined);
  check('implantations — Initiales vides → repli', siteOffices.items[1].Initiales === 'AB');
```

- [ ] **Step 2: Lancer le harnais, vérifier l'échec**

Run: `cd bbi-intranet && node tools/verify-fallback.js`
Expected: échecs `couleur —`, `initiales —`, `implantations — repli : chaque site…` (fonctions non définies / champs absents).

- [ ] **Step 3: Étendre l'interface et les helpers dans `homeData.ts`**

Remplacer l'interface `IHomeOffice` (lignes 115-128) par :

```ts
export interface IHomeOffice {
  Id: number;
  /** Nom de l'implantation (ex. « Siège » ou le nom de la filiale). */
  Title: string;
  EstSiege?: boolean;
  Pays?: string;
  Ville?: string;
  Adresse?: string;
  Telephone?: string;
  Email?: string;
  Responsable?: string;
  LienCarte?: string;
  Ordre?: number;
  /** URL du site SharePoint de l'implantation (hub pour le siège). */
  SiteUrl?: string;
  /** Couleur d'accent `#RRGGBB` du bandeau de la carte. */
  Couleur?: string;
  /** 1 à 3 lettres affichées dans le carré logo. */
  Initiales?: string;
}
```

Après `externalUrl` (vers la ligne 275), ajouter :

```ts
/** Couleur hex sûre (`#RGB` ou `#RRGGBB`) normalisée en `#RRGGBB` majuscules, sinon undefined. */
export const safeColor = (value?: string): string | undefined => {
  const clean = (value || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(clean)) {
    return clean.toUpperCase();
  }
  if (/^#[0-9a-fA-F]{3}$/.test(clean)) {
    return ('#' + clean.slice(1).split('').map((c) => c + c).join('')).toUpperCase();
  }
  return undefined;
};

/** Initiales d'une implantation : valeur explicite (3 max) ou première lettre de chaque mot du titre. */
export const initialsOf = (title: string, explicit?: string): string => {
  const given = (explicit || '').replace(/[^A-Za-z0-9À-ɏ]/g, '').toUpperCase();
  if (given) {
    return given.slice(0, 3);
  }
  const words = (title || '')
    .split(/[\s\-—–·,/]+/)
    .filter((w) => /[A-Za-z0-9À-ɏ]/.test(w));
  if (words.length >= 2) {
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  }
  return (words[0] || '??').slice(0, 2).toUpperCase();
};
```

Dans `OFFICE_FIELDS`, ajouter trois entrées :

```ts
  Ordre: ['Ordre', 'SortOrder', 'Rang'],
  SiteUrl: ['SiteUrl', 'SiteSharePoint', 'LienSite'],
  Couleur: ['Couleur', 'Color', 'Accent'],
  Initiales: ['Initiales', 'Initials']
```

Dans `asOffice`, après `Ordre:` ajouter :

```ts
  Ordre: mapping.Ordre ? asNumber(raw[mapping.Ordre]) : undefined,
  SiteUrl: mapping.SiteUrl ? safeHref(textOf(raw[mapping.SiteUrl]) || '') || undefined : undefined,
  Couleur: mapping.Couleur ? safeColor(textOf(raw[mapping.Couleur])) : undefined,
  Initiales: initialsOf(textOf(raw.Title) || '', mapping.Initiales ? textOf(raw[mapping.Initiales]) : undefined)
```

Vérifier que `textOf` (ligne 187) extrait déjà `.Url` d'un objet Hyperlink `{ Url, Description }` ; si ce n'est pas le cas, ajouter au début de `textOf` :

```ts
  if (value && typeof value === 'object' && typeof (value as { Url?: unknown }).Url === 'string') {
    return (value as { Url: string }).Url;
  }
```

Mettre à jour `DEMO_OFFICES` :

```ts
export const DEMO_OFFICES: IHomeOffice[] = [
  { Id: 1, Title: 'Siège — Paris', EstSiege: true, Pays: 'France', Ville: 'Paris', Adresse: '12 rue de la Croissance, 75008 Paris', Telephone: '+33 1 45 67 89 00', Email: 'contact@businessbuilders.fr', Responsable: 'Jean-Marc Okafor', Ordre: 0, SiteUrl: 'https://businessbuilderinter.sharepoint.com/sites/intranet', Couleur: '#0E265C', Initiales: 'SP' },
  { Id: 2, Title: 'Filiale Abidjan', Pays: "Côte d'Ivoire", Ville: 'Abidjan', Telephone: '+225 05 98 76 54 32', Email: 'abidjan@businessbuilders.fr', Responsable: 'Samuel Kouassi', Ordre: 1, SiteUrl: 'https://businessbuilderinter.sharepoint.com/sites/intranet-abidjan', Couleur: '#C8102E', Initiales: 'AB' },
  { Id: 3, Title: 'Antenne Bamako', Pays: 'Mali', Ville: 'Bamako', Telephone: '+223 76 12 34 56', Email: 'bamako@businessbuilders.fr', Responsable: 'Awa Traoré', Ordre: 2, SiteUrl: 'https://businessbuilderinter.sharepoint.com/sites/intranet-bamako', Couleur: '#6B2D8B', Initiales: 'BK' },
  { Id: 4, Title: 'Antenne Dakar', Pays: 'Sénégal', Ville: 'Dakar', Email: 'dakar@businessbuilders.fr', Ordre: 3, SiteUrl: 'https://businessbuilderinter.sharepoint.com/sites/intranet-dakar', Couleur: '#B5651D', Initiales: 'DK' }
];
```

- [ ] **Step 4: Relancer le harnais**

Run: `cd bbi-intranet && node tools/verify-fallback.js`
Expected: `… vérifications réussies, 0 échec(s)`.

- [ ] **Step 5: Compiler**

Run: `cd bbi-intranet && npx heft build`
Expected: 0 erreur TypeScript.

- [ ] **Step 6: Commit**

```bash
git add bbi-intranet/src/webparts/bbiHome/components/homeData.ts bbi-intranet/tools/verify-fallback.js
git commit -m "feat(home): étendre IHomeOffice avec SiteUrl, Couleur, Initiales"
```

---

### Task 2: Adaptateurs purs `linkDirectoryData.ts`

**Files:**
- Create: `bbi-intranet/src/webparts/bbiHome/components/linkDirectoryData.ts`
- Test: `bbi-intranet/tools/verify-fallback.js` (nouvelle fonction `testLinkDirectory`, ajoutée au lanceur)

**Interfaces:**
- Consumes: `IHomeAdminDocument`, `IHomePedagogicalReference` de `homeData.ts` ; `safeHref` de `../../../shared/safeUrl`.
- Produces:
  ```ts
  export interface ILinkItem { key: string; icon: string; label: string; href?: string; hint?: string; }
  export interface ILinkGroup { title: string; items: ILinkItem[]; }
  export const adminDocumentsToGroups: (docs: IHomeAdminDocument[]) => ILinkGroup[];
  export const pedagogicalReferencesToGroups: (refs: IHomePedagogicalReference[]) => ILinkGroup[];
  export const iconForFile: (fileName: string) => string;
  ```

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `tools/verify-fallback.js`, ajouter avant le bloc `(async () => {` :

```js
/* ------------------------------------------------------------------ */
/* Annuaires de liens (tuiles icône + libellé)                          */
/* ------------------------------------------------------------------ */
async function testLinkDirectory() {
  console.log('\nAnnuaires de liens');
  const { adminDocumentsToGroups, pedagogicalReferencesToGroups, iconForFile } = loadTsModule(
    'src/webparts/bbiHome/components/linkDirectoryData.ts'
  );
  const { DEMO_ADMIN_DOCUMENTS, DEMO_PEDAGOGICAL_REFERENCES } = loadTsModule(
    'src/webparts/bbiHome/components/homeData.ts'
  );

  check('annuaire — liste vide → aucun groupe', adminDocumentsToGroups([]).length === 0 && pedagogicalReferencesToGroups([]).length === 0);

  const docGroups = adminDocumentsToGroups(DEMO_ADMIN_DOCUMENTS);
  check('annuaire documents — groupes par catégorie', docGroups.length >= 4 && docGroups.every((g) => g.items.length > 0));
  check('annuaire documents — ordre des catégories métier (RH en premier)', docGroups[0].title === 'RH');

  const mixed = adminDocumentsToGroups([
    { Id: 1, Title: 'Sans catégorie', FileRef: '/sites/intranet/Docs/a.pdf', FileLeafRef: 'a.pdf' },
    { Id: 2, Title: 'Archive', FileRef: '/sites/intranet/Docs/b.zip', FileLeafRef: 'b.zip', Categorie: 'Finance' },
    { Id: 3, Title: 'Piégé', FileRef: 'javascript:alert(1)', FileLeafRef: 'x.pdf', Categorie: 'Finance' },
    { Id: 4, Title: 'Sans extension', FileRef: '/sites/intranet/Docs/readme', FileLeafRef: 'readme', Categorie: 'Finance' }
  ]);
  const autres = mixed.filter((g) => g.title === 'Autres')[0];
  const finance = mixed.filter((g) => g.title === 'Finance')[0];
  check('annuaire documents — catégorie vide → « Autres »', !!autres && autres.items[0].label === 'Sans catégorie');
  check('annuaire documents — extension inconnue → icône générique', finance.items[0].icon === iconForFile('readme'));
  check('annuaire documents — href dangereux → tuile sans lien', finance.items[1].href === undefined);
  check('annuaire documents — href sûr conservé', typeof finance.items[0].href === 'string' && finance.items[0].href.indexOf('b.zip') !== -1);
  check('annuaire documents — indice = référence ou nom de fichier', finance.items[0].hint === 'b.zip');
  check('icône fichier — pdf / docx / xlsx / pptx distinctes',
    new Set(['a.pdf', 'b.docx', 'c.xlsx', 'd.pptx'].map(iconForFile)).size === 4);

  const refGroups = pedagogicalReferencesToGroups(DEMO_PEDAGOGICAL_REFERENCES);
  check('annuaire références — ordre Ouvrage, Norme, Méthode, Étude, Outil',
    refGroups.map((g) => g.title).join(',') === 'Ouvrage,Norme,Méthode,Étude,Outil');
  check('annuaire références — sans LienUrl → tuile sans lien', refGroups[0].items[0].href === undefined);
  check('annuaire références — indice = auteur · année', refGroups[0].items[0].hint === 'Stephen Covey · 1989');
  const withLink = pedagogicalReferencesToGroups([{ Id: 9, Title: 'X', Categorie: 'Inconnue', LienUrl: 'https://example.org/x' }]);
  check('annuaire références — catégorie inconnue placée après les connues', withLink[0].title === 'Inconnue' && withLink[0].items[0].href === 'https://example.org/x');
}
```

Dans le lanceur, après `await testPortalSearch();` ajouter `await testLinkDirectory();`.

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `cd bbi-intranet && node tools/verify-fallback.js`
Expected: erreur de chargement du module `linkDirectoryData.ts` (fichier inexistant).

- [ ] **Step 3: Créer `linkDirectoryData.ts`**

```ts
import { IHomeAdminDocument, IHomePedagogicalReference } from "./homeData";
import { safeHref } from "../../../shared/safeUrl";

export interface ILinkItem {
  key: string;
  icon: string;
  label: string;
  href?: string;
  hint?: string;
}

export interface ILinkGroup {
  title: string;
  items: ILinkItem[];
}

const ADMIN_CATEGORY_ORDER = ["RH", "Juridique", "Finance", "Qualité", "Modèles"];
const PEDAGOGICAL_CATEGORY_ORDER = ["Ouvrage", "Norme", "Méthode", "Étude", "Outil"];
const FALLBACK_CATEGORY = "Autres";

const PEDAGOGICAL_ICONS: { [category: string]: string } = {
  Ouvrage: "📚",
  Norme: "📜",
  Méthode: "🧭",
  Étude: "📈",
  Outil: "🧰"
};
const GENERIC_ICON = "📄";

/** Icône selon l'extension du fichier ; générique si inconnue ou absente. */
export const iconForFile = (fileName: string): string => {
  const parts = (fileName || "").split(".");
  const ext = parts.length > 1 ? (parts.pop() || "").toLowerCase() : "";
  switch (ext) {
    case "pdf":
      return "📕";
    case "doc":
    case "docx":
      return "📘";
    case "xls":
    case "xlsx":
      return "📗";
    case "ppt":
    case "pptx":
      return "📙";
    default:
      return GENERIC_ICON;
  }
};

const groupBy = <T>(
  items: T[],
  categoryOf: (item: T) => string | undefined,
  order: string[],
  toLink: (item: T) => ILinkItem
): ILinkGroup[] => {
  const buckets = new Map<string, ILinkItem[]>();
  items.forEach((item) => {
    const key = (categoryOf(item) || "").trim() || FALLBACK_CATEGORY;
    if (!buckets.has(key)) {
      buckets.set(key, []);
    }
    buckets.get(key)!.push(toLink(item));
  });
  const known = order.filter((c) => buckets.has(c));
  const extra = Array.from(buckets.keys())
    .filter((c) => order.indexOf(c) === -1 && c !== FALLBACK_CATEGORY)
    .sort((a, b) => a.localeCompare(b, "fr"));
  const tail = buckets.has(FALLBACK_CATEGORY) ? [FALLBACK_CATEGORY] : [];
  return [...known, ...extra, ...tail].map((title) => ({ title, items: buckets.get(title)! }));
};

export const adminDocumentsToGroups = (docs: IHomeAdminDocument[]): ILinkGroup[] =>
  groupBy(
    docs,
    (d) => d.Categorie,
    ADMIN_CATEGORY_ORDER,
    (d) => ({
      key: `doc-${d.Id}`,
      icon: iconForFile(d.FileLeafRef),
      label: d.Title || d.FileLeafRef,
      href: safeHref(d.FileRef),
      hint: d.Reference || d.FileLeafRef
    })
  );

export const pedagogicalReferencesToGroups = (refs: IHomePedagogicalReference[]): ILinkGroup[] =>
  groupBy(
    refs
      .slice()
      .sort((a, b) => (a.Ordre ?? Number.MAX_SAFE_INTEGER) - (b.Ordre ?? Number.MAX_SAFE_INTEGER)),
    (r) => r.Categorie,
    PEDAGOGICAL_CATEGORY_ORDER,
    (r) => ({
      key: `ref-${r.Id}`,
      icon: PEDAGOGICAL_ICONS[r.Categorie || ""] || GENERIC_ICON,
      label: r.Title,
      href: r.LienUrl ? safeHref(r.LienUrl) : undefined,
      hint: [r.Auteur, r.Annee ? String(r.Annee) : undefined].filter((p) => !!p).join(" · ") || undefined
    })
  );
```

Note : `safeHref('#')` renvoie `'#'` (les documents de démo ont `FileRef: '#'`) — la tuile de démo reste cliquable sans navigation, c'est voulu.

- [ ] **Step 4: Relancer le harnais**

Run: `cd bbi-intranet && node tools/verify-fallback.js`
Expected: 0 échec.

- [ ] **Step 5: Commit**

```bash
git add bbi-intranet/src/webparts/bbiHome/components/linkDirectoryData.ts bbi-intranet/tools/verify-fallback.js
git commit -m "feat(home): adaptateurs purs pour les annuaires de liens"
```

---

### Task 3: Composant `LinkDirectory`

**Files:**
- Create: `bbi-intranet/src/webparts/bbiHome/components/LinkDirectory.tsx`, `LinkDirectory.module.scss`
- Test: `bbi-intranet/tools/css-harness.js` (garde ajoutée, vérifiée en Tâche 5 quand le composant est monté)

**Interfaces:**
- Consumes: `ILinkGroup` de `linkDirectoryData.ts`.
- Produces: `LinkDirectory: React.FC<ILinkDirectoryProps>` avec `{ groups: ILinkGroup[]; isDemo: boolean; showDataNotices: boolean; demoNote: string }`. Racine marquée `data-bbi-link-directory`.

- [ ] **Step 1: Créer `LinkDirectory.tsx`**

```tsx
import * as React from "react";
import styles from "./LinkDirectory.module.scss";
import { ILinkGroup } from "./linkDirectoryData";

export interface ILinkDirectoryProps {
  groups: ILinkGroup[];
  isDemo: boolean;
  showDataNotices: boolean;
  /** Texte du bandeau « données de démonstration ». */
  demoNote: string;
}

/** Annuaire de liens : groupes thématiques de tuiles icône + libellé (style tableau de bord). */
const LinkDirectory: React.FC<ILinkDirectoryProps> = (props) => {
  const { groups, isDemo, showDataNotices, demoNote } = props;
  if (groups.length === 0) {
    return null;
  }
  return (
    <div className={styles.wrap} data-bbi-link-directory="">
      {showDataNotices && isDemo && <p className={styles.demoNote}>{demoNote}</p>}
      {groups.map((group) => (
        <div className={styles.group} key={group.title}>
          <h3 className={styles.groupTitle}>{group.title}</h3>
          <ul className={styles.tiles}>
            {group.items.map((item) => {
              const body = (
                <>
                  <span className={styles.icon} aria-hidden="true">{item.icon}</span>
                  <span className={styles.text}>
                    <span className={styles.label}>{item.label}</span>
                    {item.hint && <small className={styles.hint}>{item.hint}</small>}
                  </span>
                </>
              );
              return (
                <li key={item.key} className={styles.tile}>
                  {item.href ? (
                    <a className={styles.link} href={item.href} target="_blank" rel="noopener noreferrer">
                      {body}
                    </a>
                  ) : (
                    <span className={`${styles.link} ${styles.linkInert}`}>{body}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
};

export default LinkDirectory;
```

- [ ] **Step 2: Créer `LinkDirectory.module.scss`**

```scss
.wrap {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.demoNote {
  margin: 0;
  font-size: 11.5px;
  color: #7a5500;
  background: #fff8e6;
  border: 1px solid #f0dca6;
  border-radius: 8px;
  padding: 8px 12px;
}

.group {
  min-width: 0;
}

.groupTitle {
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 700;
  color: var(--bbi-navy);
}

.tiles {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 18px;
}

.tile {
  min-width: 0;
}

.link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 10px;
  color: var(--bbi-navy-2);
  text-decoration: none;
  min-width: 0;
}

a.link:hover {
  background: var(--bbi-surface-2, #f4f6fa);
  color: var(--bbi-navy);
}

.linkInert {
  color: var(--bbi-muted);
  cursor: default;
}

.icon {
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid var(--bbi-line);
}

.text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.label {
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hint {
  font-size: 12px;
  color: var(--bbi-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 600px) {
  .tiles {
    grid-template-columns: minmax(0, 1fr);
  }
}
```

- [ ] **Step 3: Compiler**

Run: `cd bbi-intranet && npx heft build`
Expected: 0 erreur (le composant n'est pas encore monté ; les variables CSS `--bbi-*` existent déjà dans `BbiHome.module.scss`, vérifier `grep -n "\-\-bbi-navy-2\|\-\-bbi-line\|\-\-bbi-muted" src/webparts/bbiHome/components/BbiHome.module.scss` renvoie des définitions).

- [ ] **Step 4: Commit**

```bash
git add bbi-intranet/src/webparts/bbiHome/components/LinkDirectory.tsx bbi-intranet/src/webparts/bbiHome/components/LinkDirectory.module.scss
git commit -m "feat(home): composant LinkDirectory (tuiles icône + libellé)"
```

---

### Task 4: Composant `SiteNetwork` et remplacement d'`OfficeNetwork`

**Files:**
- Create: `bbi-intranet/src/webparts/bbiHome/components/SiteNetwork.tsx`, `SiteNetwork.module.scss`
- Modify: `bbi-intranet/src/webparts/bbiHome/components/BbiHome.tsx:31` (import), `:1714-1731` (section implantations)
- Delete: `OfficeNetwork.tsx`, `OfficeNetwork.module.scss`
- Test: `bbi-intranet/tools/css-harness.js`

**Interfaces:**
- Consumes: `IHomeOffice` (Tâche 1), `mailtoUrl`, `telUrl` de `homeData.ts`.
- Produces: `SiteNetwork: React.FC<{ offices: IHomeOffice[]; isDemo: boolean; showDataNotices: boolean }>` ; chaque carte porte `data-bbi-site-card`.

- [ ] **Step 1: Ajouter la garde au harnais CSS (échoue d'abord)**

Dans `tools/css-harness.js`, après le calcul de `paginationOk`, ajouter :

```js
  // Non-régression : cartes de sites (SiteNetwork) et annuaires de liens
  // (LinkDirectory) présents, et leurs classes effectivement stylées.
  const siteCards = hostDiv.querySelectorAll('[data-bbi-site-card]');
  const siteCardOpen = hostDiv.querySelectorAll('[data-bbi-site-card] a[data-bbi-site-open]');
  const linkDirectories = hostDiv.querySelectorAll('[data-bbi-link-directory]');
  console.log(`Cartes de sites : ${siteCards.length} (dont ${siteCardOpen.length} avec « Ouvrir le site »)`);
  console.log(`Annuaires de liens : ${linkDirectories.length}`);
  const siteCardsOk = siteCards.length >= 2 && siteCardOpen.length >= 2;
  const linkDirectoriesOk = linkDirectories.length >= 1;
```

et inclure `siteCardsOk && linkDirectoriesOk` dans l'expression `allOk`. Dans le message final (juste après `allOk`), ajouter les deux lignes au résumé si le fichier en imprime un par critère.

Run: `cd bbi-intranet && npx heft build && node tools/css-harness.js dist`
Expected: ÉCHEC sur `Cartes de sites : 0` et `Annuaires de liens : 0` (le reste reste vert). `linkDirectoriesOk` passera en Tâche 5 ; cette tâche fait passer `siteCardsOk`.

- [ ] **Step 2: Créer `SiteNetwork.tsx`**

```tsx
import * as React from "react";
import styles from "./SiteNetwork.module.scss";
import { IHomeOffice, mailtoUrl, telUrl } from "./homeData";

export interface ISiteNetworkProps {
  offices: IHomeOffice[];
  isDemo: boolean;
  showDataNotices: boolean;
}

/** Réseau des sites BBI : une carte par implantation (siège en tête), style tableau de bord. */
const SiteNetwork: React.FC<ISiteNetworkProps> = (props) => {
  const { offices, isDemo, showDataNotices } = props;
  if (offices.length === 0) {
    return null;
  }
  return (
    <div className={styles.wrap}>
      {showDataNotices && isDemo && (
        <p className={styles.demoNote}>
          Données de démonstration : la liste « Implantations » est absente, non créée ou vide.
        </p>
      )}
      <ul className={styles.grid}>
        {offices.map((office) => {
          const accent = office.Couleur || "var(--bbi-navy)";
          return (
            <li
              key={office.Id}
              className={office.EstSiege ? `${styles.card} ${styles.cardHq}` : styles.card}
              data-bbi-site-card=""
            >
              <div className={styles.band} style={{ background: accent }}>
                <span className={styles.logo} style={{ color: accent }} aria-hidden="true">
                  {office.Initiales || "BBI"}
                </span>
                <span className={styles.kind}>{office.EstSiege ? "Siège" : "Filiale"}</span>
              </div>
              <div className={styles.body}>
                <strong className={styles.name}>{office.Title}</strong>
                {(office.Ville || office.Pays) && (
                  <span className={styles.place}>
                    {[office.Ville, office.Pays].filter((part) => !!part).join(" · ")}
                  </span>
                )}
                {office.Responsable && <p className={styles.manager}>{office.Responsable}</p>}
                {office.SiteUrl && (
                  <a
                    className={styles.open}
                    href={office.SiteUrl}
                    data-bbi-site-open=""
                    style={{ background: accent }}
                  >
                    Ouvrir le site <span aria-hidden="true">→</span>
                  </a>
                )}
                <div className={styles.contactLinks}>
                  {office.Telephone && <a href={telUrl(office.Telephone)}>{office.Telephone}</a>}
                  {office.Email && <a href={mailtoUrl(office.Email)}>{office.Email}</a>}
                  {office.LienCarte && (
                    <a href={office.LienCarte} target="_blank" rel="noopener noreferrer">
                      Voir sur la carte ↗
                    </a>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default SiteNetwork;
```

`office.Couleur` est déjà validé `#RRGGBB` par `safeColor` (Tâche 1) : aucune valeur libre n'atteint l'attribut `style`.

- [ ] **Step 3: Créer `SiteNetwork.module.scss`**

```scss
.wrap { min-width: 0; }

.demoNote {
  margin: 0 0 12px;
  font-size: 11.5px;
  color: #7a5500;
  background: #fff8e6;
  border: 1px solid #f0dca6;
  border-radius: 8px;
  padding: 8px 12px;
}

.grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

.card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border: 1px solid var(--bbi-line);
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
}

.cardHq { box-shadow: 0 0 0 2px var(--bbi-navy) inset; }

.band {
  position: relative;
  height: 56px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 0 14px 0 0;
}

.logo {
  position: relative;
  top: 18px;
  left: 14px;
  width: 52px;
  height: 52px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border-radius: 8px;
  border: 1px solid var(--bbi-line);
  font-weight: 800;
  font-size: 18px;
  letter-spacing: 0.04em;
}

.kind {
  align-self: flex-start;
  margin-top: 10px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #fff;
  opacity: 0.9;
}

.body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 28px 16px 16px;
}

.name { font-size: 15px; color: var(--bbi-navy); }

.place {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--bbi-muted);
}

.manager { margin: 2px 0 0; font-size: 13px; color: var(--bbi-muted); }

.open {
  align-self: flex-start;
  margin-top: 10px;
  padding: 7px 12px;
  border-radius: 999px;
  color: #fff;
  font-size: 12.5px;
  font-weight: 700;
  text-decoration: none;
}

.open:hover { filter: brightness(1.08); }

.contactLinks {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 10px;
}

.contactLinks a {
  font-size: 12.5px;
  color: var(--bbi-navy-2);
  text-decoration: none;
}

.contactLinks a:hover { text-decoration: underline; }
```

- [ ] **Step 4: Remplacer `OfficeNetwork` dans `BbiHome.tsx`**

Ligne 31 : `import OfficeNetwork from "./OfficeNetwork";` → `import SiteNetwork from "./SiteNetwork";`
Lignes 1720-1730 : le titre devient « Siège et filiales », l'eyebrow « Nos sites », et `<OfficeNetwork` → `<SiteNetwork` (mêmes props).

Supprimer `OfficeNetwork.tsx` et `OfficeNetwork.module.scss` :

```bash
git rm bbi-intranet/src/webparts/bbiHome/components/OfficeNetwork.tsx bbi-intranet/src/webparts/bbiHome/components/OfficeNetwork.module.scss
```

- [ ] **Step 5: Compiler et vérifier**

Run: `cd bbi-intranet && npx heft build && node tools/css-harness.js dist && node tools/verify-fallback.js`
Expected: build 0 erreur ; harnais CSS : `Cartes de sites : 4 (dont 4 avec « Ouvrir le site »)` ; seul `Annuaires de liens : 0` reste en échec (Tâche 5) ; verify-fallback 0 échec.

- [ ] **Step 6: Commit**

```bash
git add -A bbi-intranet/src/webparts/bbiHome/components bbi-intranet/tools/css-harness.js
git commit -m "feat(home): cartes de sites SiteNetwork, retrait d'OfficeNetwork"
```

---

### Task 5: Réordonnancement de l'accueil et montage des annuaires

**Files:**
- Create: `bbi-intranet/src/webparts/bbiHome/components/AnnouncementsList.tsx`, `AnnouncementsList.module.scss`
- Modify: `bbi-intranet/src/webparts/bbiHome/components/BbiHome.tsx` (imports lignes 31-34 ; sections 1239-1731), `BbiHome.module.scss` (classe `.homeRow`)
- Delete: `PedagogicalReferences.tsx` + `.module.scss`, `DocumentShelf.tsx` + `.module.scss`
- Test: `bbi-intranet/tools/css-harness.js` (garde `linkDirectoriesOk` de la Tâche 4), `tools/verify-fallback.js`

**Interfaces:**
- Consumes: `LinkDirectory` (Tâche 3), `adminDocumentsToGroups`, `pedagogicalReferencesToGroups` (Tâche 2), `IHomeAnnouncement`, `isAnnouncementActive` de `homeData.ts`.
- Produces: `AnnouncementsList: React.FC<{ announcements: IHomeAnnouncement[]; isDemo: boolean; showDataNotices: boolean }>`.

- [ ] **Step 1: Créer `AnnouncementsList.tsx`**

```tsx
import * as React from "react";
import styles from "./AnnouncementsList.module.scss";
import { IHomeAnnouncement, isAnnouncementActive } from "./homeData";
import { safeHref } from "../../../shared/safeUrl";

export interface IAnnouncementsListProps {
  announcements: IHomeAnnouncement[];
  isDemo: boolean;
  showDataNotices: boolean;
}

/** Annonces actives, de la plus urgente à la moins urgente, puis par Ordre. */
const AnnouncementsList: React.FC<IAnnouncementsListProps> = (props) => {
  const { announcements, isDemo, showDataNotices } = props;
  const active = announcements.filter((a) => isAnnouncementActive(a));
  if (active.length === 0) {
    return <p className={styles.empty}>Aucune annonce en cours.</p>;
  }
  return (
    <div className={styles.wrap}>
      {showDataNotices && isDemo && (
        <p className={styles.demoNote}>Données de démonstration : la liste « Annonces » est absente, non créée ou vide.</p>
      )}
      <ul className={styles.list}>
        {active.map((a) => {
          const href = a.LienUrl ? safeHref(a.LienUrl) : undefined;
          return (
            <li key={a.Id} className={styles.item} data-bbi-level={a.Niveau || "Info"}>
              <span className={styles.level}>{a.Niveau || "Info"}</span>
              <div className={styles.text}>
                <strong>{a.Title}</strong>
                {a.Message && <p>{a.Message}</p>}
                {href && (
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    En savoir plus <span aria-hidden="true">→</span>
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default AnnouncementsList;
```

Vérifier les noms de champs d'`IHomeAnnouncement` (ligne 78 de `homeData.ts`) : `Title`, `Message`, `Niveau`, `DateDebut`, `DateFin`, `LienUrl`, `Ordre`. Adapter si un nom diffère.

`AnnouncementsList.module.scss` :

```scss
.wrap { min-width: 0; }
.empty { margin: 0; font-size: 13px; color: var(--bbi-muted); }
.demoNote {
  margin: 0 0 12px; font-size: 11.5px; color: #7a5500; background: #fff8e6;
  border: 1px solid #f0dca6; border-radius: 8px; padding: 8px 12px;
}
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.item {
  display: flex; gap: 12px; align-items: flex-start;
  padding: 12px 14px; border: 1px solid var(--bbi-line); border-radius: 10px; background: #fff;
}
.level {
  flex: 0 0 auto; font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
  padding: 3px 8px; border-radius: 999px; color: #fff; background: var(--bbi-navy);
}
.item[data-bbi-level="Urgent"] .level { background: var(--bbi-red); }
.item[data-bbi-level="Important"] .level { background: #b5651d; }
.text { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.text strong { font-size: 14px; color: var(--bbi-navy); }
.text p { margin: 0; font-size: 13px; color: var(--bbi-muted); }
.text a { font-size: 12.5px; color: var(--bbi-navy-2); text-decoration: none; }
.text a:hover { text-decoration: underline; }
```

- [ ] **Step 2: Ajouter `.homeRow` dans `BbiHome.module.scss`**

Après `.resources { … }` (vers la ligne 679) :

```scss
/* Ligne deux colonnes de l'accueil (croquis client). */
.homeRow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 30px;
  align-items: start;
  min-width: 0;
}

.homeRowCell { min-width: 0; }
```

Dans le bloc `@media (max-width: 900px)` existant, ajouter `.homeRow { grid-template-columns: minmax(0, 1fr); }`.

- [ ] **Step 3: Réordonner les sections dans `BbiHome.tsx`**

Imports : remplacer les lignes 33-34 (`PedagogicalReferences`, `DocumentShelf`) par :

```ts
import LinkDirectory from "./LinkDirectory";
import AnnouncementsList from "./AnnouncementsList";
import { adminDocumentsToGroups, pedagogicalReferencesToGroups } from "./linkDirectoryData";
```

Dans le corps du composant, après la déclaration des états (vers la ligne 380), ajouter :

```ts
  const adminDocumentGroups = React.useMemo(
    () => adminDocumentsToGroups(adminDocuments.items),
    [adminDocuments.items]
  );
  const pedagogicalGroups = React.useMemo(
    () => pedagogicalReferencesToGroups(pedagogicalReferences.items),
    [pedagogicalReferences.items]
  );
```

Nouvel ordre des blocs JSX dans `<main>` (déplacer les blocs existants sans en modifier le contenu sauf indication) :

1. `<HomeHero …/>` (inchangé)
2. section `#identite` (inchangée)
3. section `#acces` (inchangée)
4. **section `#communaute`** (déplacée ici depuis la fin : le Trombinoscope devient la bande sous le hero ; conserver `data-bbi-view="communaute"` et tout son contenu)
5. **nouvelle section** `#documents-parcours` :

```tsx
        <section
          className={styles.section}
          id="documents-parcours"
          data-bbi-view="accueil"
          aria-label="Documents administratifs et parcours pédagogiques"
        >
          <div className={styles.homeRow}>
            <div className={styles.homeRowCell} id="documents-administratifs">
              <div className={styles.sectionHeading}>
                <div>
                  <p className={styles.eyebrow}>RH, juridique, qualité</p>
                  <h2>Documents administratifs</h2>
                </div>
              </div>
              <LinkDirectory
                groups={adminDocumentGroups}
                isDemo={adminDocuments.isDemo}
                showDataNotices={props.showDataNotices}
                demoNote="Données de démonstration : la bibliothèque « Documents administratifs » est absente, non créée ou vide."
              />
            </div>
            <div className={styles.homeRowCell} id="parcours">
              <div className={styles.sectionHeading}>
                <div>
                  <p className={styles.eyebrow}>Se former</p>
                  <h2>Parcours pédagogiques</h2>
                </div>
                <a
                  className={styles.textLink}
                  href="#sessions"
                  onClick={(event) => {
                    followPortalLink(event, "#sessions");
                  }}
                >
                  Nos plannings <span aria-hidden="true">→</span>
                </a>
              </div>
              <LazyMount active={activeView === "accueil"} minHeight={210}>
                <TrainingCatalog {...catalogProps} />
              </LazyMount>
            </div>
          </div>
        </section>
```

6. **section `#vie-equipe`** (déplacée, contenu enveloppé) :

```tsx
        <section
          className={styles.section}
          id="vie-equipe"
          data-bbi-view="accueil"
          aria-label="Annonces et vie de l'équipe"
        >
          <div className={styles.homeRow}>
            <div className={styles.homeRowCell} id="annonces">
              <div className={styles.sectionHeading}>
                <div>
                  <p className={styles.eyebrow}>À savoir</p>
                  <h2>Annonces</h2>
                </div>
              </div>
              <AnnouncementsList
                announcements={announcements.items}
                isDemo={announcements.isDemo}
                showDataNotices={props.showDataNotices}
              />
            </div>
            <div className={styles.homeRowCell}>
              <TeamHighlights … (props identiques à l'existant) />
            </div>
          </div>
        </section>
```

7. section `#implantations` (`SiteNetwork`, Tâche 4) — déplacée ici.
8. section `#references` (`ClientReferences`) — déplacée en dernier bloc d'accueil.
9. Puis les sections de vues non-accueil, inchangées : `#actualites` (news + sessions), `#formations`, `#ressources`, `#actualite`, `#recherche`, `.learningPath`.

Dans la section `#formations`, remplacer `<PedagogicalReferences …/>` par :

```tsx
          <div className={styles.sectionHeading} id="references-pedagogiques">
            <div>
              <p className={styles.eyebrow}>Pour aller plus loin</p>
              <h2>Références pédagogiques</h2>
            </div>
          </div>
          <LinkDirectory
            groups={pedagogicalGroups}
            isDemo={pedagogicalReferences.isDemo}
            showDataNotices={props.showDataNotices}
            demoNote="Données de démonstration : la liste « Références pédagogiques » est absente, non créée ou vide."
          />
```

Dans la section `#ressources`, supprimer entièrement le bloc `{adminDocuments.items.length > 0 && (<div className={styles.adminDocuments} …>…</div>)}` (lignes 1603-1617).

Vérifier que le `TrainingCatalog` monté dans `#documents-parcours` n'entre pas en conflit d'`id` avec celui de `#formations` : si `TrainingCatalog` pose des `id` HTML fixes, passer `maxItems={4}` et une prop `compact` si elle existe (`grep -n "id=\"" ../../trainingCatalog/components/TrainingCatalog.tsx`) ; sinon dupliquer est acceptable.

Supprimer les composants désormais inutilisés :

```bash
git rm bbi-intranet/src/webparts/bbiHome/components/PedagogicalReferences.tsx bbi-intranet/src/webparts/bbiHome/components/PedagogicalReferences.module.scss bbi-intranet/src/webparts/bbiHome/components/DocumentShelf.tsx bbi-intranet/src/webparts/bbiHome/components/DocumentShelf.module.scss
```

Supprimer aussi `.adminDocuments` et `.adminDocuments h3` de `BbiHome.module.scss` (lignes 681-689).

- [ ] **Step 4: Vérifier la visibilité CSS des sections**

Toute section marquée `data-bbi-view="accueil"` est déjà couverte par la règle `.home:not([data-view="accueil"]) [data-bbi-view="accueil"]` (ligne 1077 du SCSS). Aucune règle à ajouter ; le harnais `orphanSectionsOk` le confirme.

- [ ] **Step 5: Compiler et lancer les trois harnais**

Run: `cd bbi-intranet && npx heft build && node tools/css-harness.js dist && node tools/verify-fallback.js && node tools/preview-smoke.js`
Expected: build 0 erreur ; CSS : `Annuaires de liens : 2`, `Sections data-bbi-view sans règle : AUCUNE`, tout OK ; verify-fallback 0 échec ; preview-smoke inchangé (34 OK, il lit le HTML d'aperçu, hors périmètre).

- [ ] **Step 6: Vérification visuelle dans le workbench hébergé**

Run: `cd bbi-intranet && npm run start` puis ouvrir `https://localhost:4321/` (accepter le certificat) et
`https://businessbuilderinter.sharepoint.com/_layouts/15/workbench.aspx?debug=true&noredir=true&debugManifestsFile=https://localhost:4321/temp/manifests.js`.
Vérifier : ordre des sections (hero, identité, accès, trombinoscope, documents | parcours, annonces | vie de l'équipe, siège et filiales, références), cartes de sites avec bandeau coloré et bouton, tuiles en deux colonnes, repli à une colonne sous 900 px.

- [ ] **Step 7: Commit**

```bash
git add -A bbi-intranet/src/webparts/bbiHome/components
git commit -m "feat(home): accueil réordonné selon le croquis client, annuaires en tuiles, liste d'annonces"
```

---

### Task 6: Colonnes `Implantations`, environnement et documentation du schéma

**Files:**
- Modify: `deploy/provision-bbi-intranet.ps1:509-521` (liste Implantations), `:940-962` (`$optionalChecks`), `:877-885` (seed)
- Modify: `bbi-environnement.json`
- Modify: `deploy/README.md:300-304`, `CLAUDE.md` (section « Required SharePoint schema »)

- [ ] **Step 1: Ajouter les colonnes**

Après la ligne `Ensure-BbiField -List 'Implantations' -DisplayName 'Ordre' …` :

```powershell
Ensure-BbiField -List 'Implantations' -DisplayName 'Site SharePoint' -InternalName 'SiteUrl'   -Type Hyperlink
Ensure-BbiField -List 'Implantations' -DisplayName 'Couleur'         -InternalName 'Couleur'   -Type Text
Ensure-BbiField -List 'Implantations' -DisplayName 'Initiales'       -InternalName 'Initiales' -Type Text
```

`Ensure-BbiField` accepte `Text | Note | Choice | DateTime | Number | Hyperlink | Boolean` ; `Hyperlink` est le même type que `LienCarte`.

Dans `$optionalChecks`, ajouter :

```powershell
    @{ List = 'Implantations'; Field = 'SiteUrl';   UsedBy = 'Cartes de sites — bouton « Ouvrir le site »' },
    @{ List = 'Implantations'; Field = 'Couleur';   UsedBy = 'Cartes de sites — couleur du bandeau' },
    @{ List = 'Implantations'; Field = 'Initiales'; UsedBy = 'Cartes de sites — carré logo' },
```

Dans le seed (ligne 880-881), compléter les deux `Add-PnPListItem` avec `Couleur = '#0E265C'; Initiales = 'SP'` (siège) et `Couleur = '#C8102E'; Initiales = 'AB'` (Abidjan), et ajouter deux lignes :

```powershell
            Add-PnPListItem -List 'Implantations' -Values @{ Title = 'Antenne Bamako'; Pays = 'Mali'; Ville = 'Bamako'; Telephone = '+223 76 12 34 56'; Email = 'bamako@businessbuilders.fr'; Responsable = 'Awa Traoré'; Ordre = 2; Couleur = '#6B2D8B'; Initiales = 'BK' } | Out-Null
            Add-PnPListItem -List 'Implantations' -Values @{ Title = 'Antenne Dakar'; Pays = 'Sénégal'; Ville = 'Dakar'; Email = 'dakar@businessbuilders.fr'; Ordre = 3; Couleur = '#B5651D'; Initiales = 'DK' } | Out-Null
```

`SiteUrl` n'est pas semé : il est écrit par la section hub (Tâche 8).

- [ ] **Step 2: Environnement**

Dans `bbi-environnement.json`, après `"editorsGroup"` :

```json
  "_hub": "Hub SharePoint : le site intranet devient hub, chaque filiale de la liste Implantations reçoit un site d'équipe rattaché (-ProvisionFiliales).",
  "hubEnabled": true,
  "filialeSitePrefix": "intranet-",
```

- [ ] **Step 3: Vérifier la syntaxe du script**

Run (PowerShell) :
```powershell
$t=$null;$e=$null;[System.Management.Automation.Language.Parser]::ParseFile("$PWD\deploy\provision-bbi-intranet.ps1",[ref]$t,[ref]$e)|Out-Null;$e.Count
```
Expected: `0`.

- [ ] **Step 4: Documentation**

`deploy/README.md` ligne 301-302 : ajouter `· Site SharePoint (SiteUrl) · Couleur (#RRGGBB) · Initiales (1-3 lettres)` et une phrase : « `SiteUrl` est renseigné automatiquement par `-ProvisionFiliales` (voir § Hub et filiales). »
`CLAUDE.md` § « Required SharePoint schema » : préciser `Implantations (now with SiteUrl/Couleur/Initiales for the site cards)`.

- [ ] **Step 5: Commit**

```bash
git add deploy/provision-bbi-intranet.ps1 bbi-environnement.json deploy/README.md CLAUDE.md
git commit -m "chore(deploy): colonnes SiteUrl/Couleur/Initiales, clés hub dans l'environnement"
```

---

### Task 7: `ConvertTo-BbiSlug` et fonction `Invoke-BbiSiteProvisioning`

**Files:**
- Create: `deploy/BbiSlug.ps1`
- Modify: `deploy/provision-bbi-intranet.ps1:403-707` (sections 2 à 5 enveloppées), `:388-401` (connexion)

**Interfaces:**
- Produces: `ConvertTo-BbiSlug -Prefix 'intranet-' -Value 'Côte d''Ivoire'` → `intranet-cote-divoire` ; `Invoke-BbiSiteProvisioning -TargetUrl <url> -DataUrl <url> -SeedDemo:$false` (se connecte à `TargetUrl`, crée listes, bibliothèques, sécurité, page et web part, puis laisse la connexion sur `TargetUrl`).

- [ ] **Step 1: Test du slug (échoue d'abord)**

Run (PowerShell) :
```powershell
. .\deploy\BbiSlug.ps1
@(
  (ConvertTo-BbiSlug -Prefix 'intranet-' -Value "Côte d'Ivoire") -eq 'intranet-cote-divoire',
  (ConvertTo-BbiSlug -Prefix 'intranet-' -Value 'San Pedro') -eq 'intranet-san-pedro',
  (ConvertTo-BbiSlug -Prefix 'intranet-' -Value '  Dakar  ') -eq 'intranet-dakar',
  (ConvertTo-BbiSlug -Prefix 'intranet-' -Value 'Siège — Paris') -eq 'intranet-siege-paris',
  (ConvertTo-BbiSlug -Prefix 'intranet-' -Value '') -eq ''
) -join ','
```
Expected: échec « fichier introuvable ».

- [ ] **Step 2: Créer `deploy/BbiSlug.ps1`**

```powershell
<# Slug d'alias de site SharePoint à partir d'une ville : minuscules ASCII, tirets, sans accents. #>
function ConvertTo-BbiSlug {
    param(
        [string]$Prefix = '',
        [string]$Value
    )
    $v = ("$Value").Trim()
    if (-not $v) { return '' }
    $decomposed = $v.Normalize([System.Text.NormalizationForm]::FormD)
    $sb = New-Object System.Text.StringBuilder
    foreach ($ch in $decomposed.ToCharArray()) {
        if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch) -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
            [void]$sb.Append($ch)
        }
    }
    $ascii = $sb.ToString().ToLowerInvariant()
    $ascii = $ascii -replace "['’]", ''          # apostrophes : collées (d'ivoire → divoire)
    $ascii = $ascii -replace '[^a-z0-9]+', '-'   # tout le reste → tiret
    $ascii = $ascii.Trim('-')
    if (-not $ascii) { return '' }
    return "$Prefix$ascii"
}
```

Re-run Step 1. Expected: `True,True,True,True,True`.

- [ ] **Step 3: Envelopper les sections 2 à 5 dans une fonction**

Dans `provision-bbi-intranet.ps1`, juste après les fonctions utilitaires (avant `# 1. CONNEXION`), ajouter `. (Join-Path $scriptRoot 'BbiSlug.ps1')`.

Déplacer tout le code des sections **2, 3, 4 et 5** (de `Write-Title "2/9 · Listes métier"` jusqu'à la fin du bloc `Ensure-BbiCustomAction … BbiFullScreen`, lignes ~403-707) dans :

```powershell
function Invoke-BbiSiteProvisioning {
    param(
        [Parameter(Mandatory)][string]$TargetUrl,
        [Parameter(Mandatory)][string]$DataUrl,
        [bool]$SeedDemo = $false,
        [string]$StepPrefix = ''
    )
    if ((Get-PnPConnection).Url.TrimEnd('/') -ne $TargetUrl.TrimEnd('/')) {
        Connect-PnPOnline -Url $TargetUrl -Interactive
        Write-Ok "Connecté à $TargetUrl"
    }
    $previousDataSite = $script:DataSiteUrl
    $script:DataSiteUrl = $DataUrl
    try {
        # ---- contenu déplacé des sections 2 à 5, inchangé, sauf :
        #   • les Write-Title deviennent Write-Title "$StepPrefix 2/10 · Listes métier" etc.
        #   • dans $homeProps, siteUrl = $DataUrl
        #   • la ligne Set-PnPHomePage reste (chaque site reçoit accueil.aspx)
    } finally {
        $script:DataSiteUrl = $previousDataSite
    }
}
```

Puis, à l'emplacement d'origine des sections, appeler :

```powershell
Invoke-BbiSiteProvisioning -TargetUrl $SiteUrl -DataUrl $script:DataSiteUrl -SeedDemo:$SeedDemoData
```

Renuméroter les titres : la numérotation passe de `/9` à `/10` (la section hub devient `6/10`, identité `7/10`, navigation `8/10`, données `9/10`, rapport `10/10`). Les sections 2 à 5 gardent leurs numéros.

- [ ] **Step 4: Vérifier syntaxe et simulation**

Run (PowerShell) :
```powershell
$t=$null;$e=$null;[System.Management.Automation.Language.Parser]::ParseFile("$PWD\deploy\provision-bbi-intranet.ps1",[ref]$t,[ref]$e)|Out-Null;$e.Count
```
Expected: `0`.

Puis, si une connexion tenant est possible : `cd deploy; .\provision-bbi-intranet.ps1 -DryRun` — les mêmes lignes `[SIMULATION]` qu'avant la tâche, dans le même ordre (comparer avec la sortie de `git stash; .\provision-bbi-intranet.ps1 -DryRun; git stash pop` si un doute subsiste).

- [ ] **Step 5: Commit**

```bash
git add deploy/BbiSlug.ps1 deploy/provision-bbi-intranet.ps1
git commit -m "refactor(deploy): Invoke-BbiSiteProvisioning réutilisable, ConvertTo-BbiSlug testé"
```

---

### Task 8: Section « Hub et filiales » (`-ProvisionFiliales`)

**Files:**
- Modify: `deploy/provision-bbi-intranet.ps1` (paramètres ; nouvelle section 6/10 entre l'appel `Invoke-BbiSiteProvisioning` du siège et « Identité visuelle » ; rapport final)

**Interfaces:**
- Consumes: `ConvertTo-BbiSlug`, `Invoke-BbiSiteProvisioning` (Tâche 7), `Ensure-BbiNavNode` (existant), `$BbiEnv.hubEnabled`, `$BbiEnv.filialeSitePrefix`.

- [ ] **Step 1: Paramètre et lecture de l'environnement**

Dans `param(…)`, après `[switch]$VerifyOnly` :

```powershell
    ,
    # Hub : enregistre le site comme hub, crée un site d'équipe par filiale (liste Implantations) et y déploie le portail
    [switch]$ProvisionFiliales
```

Après la lecture de `$EditorsGroup` :

```powershell
$HubEnabled = $true
if ($BbiEnv -and $null -ne $BbiEnv.hubEnabled) { $HubEnabled = [bool]$BbiEnv.hubEnabled }
$FilialePrefix = 'intranet-'
if ($BbiEnv -and $BbiEnv.filialeSitePrefix) { $FilialePrefix = "$($BbiEnv.filialeSitePrefix)" }
```

- [ ] **Step 2: Écrire la section**

```powershell
# ==================================================================
# 6. HUB ET SITES DE FILIALE (liste Implantations → un site d'équipe par filiale)
# ==================================================================
if ($ProvisionFiliales) {
    Write-Title "6/10 · Hub et filiales"
    if (-not $HubEnabled) {
        Write-Warn2 "hubEnabled = false dans bbi-environnement.json : section ignorée."
    } else {
        $hubUrl = $SiteUrl.TrimEnd('/')
        if ((Get-PnPConnection).Url.TrimEnd('/') -ne $hubUrl) { Connect-PnPOnline -Url $hubUrl -Interactive }

        # 6.1 Hub
        $hub = Get-PnPHubSite -Identity $hubUrl -ErrorAction SilentlyContinue
        if ($hub) {
            Write-Skip "Site hub $hubUrl"
            Add-Report 'Site hub' 'OK'
        } else {
            Invoke-Bbi "Enregistrement de $hubUrl comme site hub" {
                Register-PnPHubSite -Site $hubUrl | Out-Null
            } | Out-Null
            Add-Report 'Site hub' ($(if ($DryRun -or $VerifyOnly) { 'MANQUANT' } else { 'CRÉÉ' }))
        }

        # 6.2 Filiales
        $tenantRoot = ([uri]$hubUrl).GetLeftPart([UriPartial]::Authority)
        $rows = Get-PnPListItem -List 'Implantations' -PageSize 200 |
            Where-Object { -not [bool]$_['EstSiege'] } |
            Sort-Object { [int]($_['Ordre'] ?? 9999) }
        if (-not $rows) { Write-Warn2 "Aucune filiale dans « Implantations » (lignes avec Siège décoché)." }

        $hubRow = Get-PnPListItem -List 'Implantations' -PageSize 200 | Where-Object { [bool]$_['EstSiege'] } | Select-Object -First 1
        if ($hubRow -and -not $hubRow['SiteUrl']) {
            Invoke-Bbi "Siège : SiteUrl ← $hubUrl" { Set-PnPListItem -List 'Implantations' -Identity $hubRow.Id -Values @{ SiteUrl = "$hubUrl, $($hubRow['Title'])" } | Out-Null } | Out-Null
        }

        $filialeSites = @()
        foreach ($row in $rows) {
            $title = "$($row['Title'])"
            $slug  = ConvertTo-BbiSlug -Prefix $FilialePrefix -Value "$($row['Ville'])"
            if (-not $slug) { $slug = ConvertTo-BbiSlug -Prefix $FilialePrefix -Value $title }
            if (-not $slug) { Write-Warn2 "Ligne $($row.Id) « $title » : ni Ville ni Titre exploitable, ignorée."; continue }
            $url = "$tenantRoot/sites/$slug"

            $existing = Get-PnPTenantSite -Url $url -ErrorAction SilentlyContinue
            if ($existing) {
                Write-Skip "Site $url"
                Add-Report "Site filiale $title" 'OK' $url
            } else {
                Invoke-Bbi "Création du site d'équipe « $title » ($url)" {
                    New-PnPSite -Type TeamSite -Title $title -Alias $slug -IsPublic:$false -Lcid 1036 | Out-Null
                } | Out-Null
                Add-Report "Site filiale $title" ($(if ($DryRun -or $VerifyOnly) { 'MANQUANT' } else { 'CRÉÉ' })) $url
            }

            if (-not $DryRun -and -not $VerifyOnly) {
                Invoke-Bbi "Rattachement de $url au hub" {
                    Add-PnPHubSiteAssociation -Site $url -HubSite $hubUrl
                } | Out-Null
                $current = "$($row['SiteUrl'])"
                if ($current -notlike "$url*") {
                    Invoke-Bbi "« $title » : SiteUrl ← $url" {
                        Set-PnPListItem -List 'Implantations' -Identity $row.Id -Values @{ SiteUrl = "$url, $title" } | Out-Null
                    } | Out-Null
                }
            } else {
                Write-Step "[SIMULATION] rattachement au hub + écriture de SiteUrl pour « $title »"
            }
            $filialeSites += [pscustomobject]@{ Title = $title; Url = $url; Ordre = [int]($row['Ordre'] ?? 9999) }
        }

        # 6.3 Portail sur chaque filiale (listes vides → repli démo côté web part)
        $editors = @()
        try { $editors = Get-PnPGroupMember -Group $EditorsGroup -ErrorAction Stop } catch { Write-Warn2 "Groupe « $EditorsGroup » introuvable sur le hub : membres non recopiés." }
        foreach ($site in $filialeSites) {
            if ($DryRun -or $VerifyOnly) {
                Write-Step "[SIMULATION] portail BBI sur $($site.Url) (listes, bibliothèques, page accueil.aspx, web part)"
                continue
            }
            Invoke-BbiSiteProvisioning -TargetUrl $site.Url -DataUrl $site.Url -SeedDemo:$false -StepPrefix "[$($site.Title)]"
            $members = Get-PnPGroup -AssociatedMemberGroup
            foreach ($m in $editors) {
                Invoke-Bbi "« $($site.Title) » : $($m.LoginName) ← Membres" {
                    Add-PnPGroupMember -LoginName $m.LoginName -Group $members -ErrorAction SilentlyContinue
                } | Out-Null
            }
        }

        # 6.4 Navigation hub (= navigation supérieure du site hub) : siège puis filiales par Ordre
        Connect-PnPOnline -Url $hubUrl -Interactive
        Ensure-BbiNavNode -Title 'Siège' -Url "$hubUrl/SitePages/accueil.aspx"
        foreach ($site in ($filialeSites | Sort-Object Ordre)) {
            Ensure-BbiNavNode -Title $site.Title -Url "$($site.Url)/SitePages/accueil.aspx"
        }
    }
}
```

`Ensure-BbiNavNode -Title -Url [-Location]` a `TopNavigationBar` par défaut : rien à passer.

- [ ] **Step 3: Rapport final**

Dans la section « Rapport », après la liste des composants attendus, ajouter :

```powershell
if ($ProvisionFiliales) {
    Write-Host "Hub et filiales : relancez avec -VerifyOnly -ProvisionFiliales pour auditer ; ajoutez une ligne dans « Implantations » puis relancez pour créer un nouveau site." -ForegroundColor Gray
}
```

- [ ] **Step 4: Syntaxe + simulation**

Run (PowerShell) :
```powershell
$t=$null;$e=$null;[System.Management.Automation.Language.Parser]::ParseFile("$PWD\deploy\provision-bbi-intranet.ps1",[ref]$t,[ref]$e)|Out-Null;$e.Count
```
Expected: `0`.

Run (tenant) : `cd deploy; .\provision-bbi-intranet.ps1 -DryRun -ProvisionFiliales`
Expected: lignes `[SIMULATION] Enregistrement … comme site hub`, une ligne `Création du site d'équipe` par filiale avec l'URL `…/sites/intranet-abidjan`, `…/sites/intranet-bamako`, `…/sites/intranet-dakar`, aucune écriture.

Run (sans le commutateur) : `.\provision-bbi-intranet.ps1 -DryRun`
Expected: aucune ligne « Hub et filiales ».

- [ ] **Step 5: Commit**

```bash
git add deploy/provision-bbi-intranet.ps1
git commit -m "feat(deploy): -ProvisionFiliales : hub, un site d'équipe par filiale, portail et navigation hub"
```

---

### Task 9: Documentation, paquet et vérification finale

**Files:**
- Modify: `deploy/README.md` (nouvelle section « Hub et filiales » ; tableau des vues ; `.SYNOPSIS` du script déjà à jour en Tâche 8 si non fait), `bbi-intranet/README.md` (mention des cartes de sites et annuaires), `CLAUDE.md` (architecture : hub + filiales, nouveaux composants, `-ProvisionFiliales`)
- Produce: `deliverables/spfx/bbi-intranet.sppkg`

- [ ] **Step 1: `deploy/README.md`**

Ajouter après la section Implantations :

```markdown
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
Prérequis : le `.sppkg` doit être **Déployé** dans le catalogue avant d'exécuter la commande.
Pour ajouter une filiale : ajouter une ligne (Titre, Ville, Pays, Couleur, Initiales), relancer.
```

Dans le tableau des vues (ligne 44) : `| Accueil — siège et filiales | Implantations | Cartes de sites d'exemple | Publier une implantation ; -ProvisionFiliales renseigne SiteUrl |`. Ajouter deux lignes pour `Documents administratifs` et `Références pédagogiques` en « annuaire de tuiles ».

- [ ] **Step 2: `CLAUDE.md`**

Dans « Key architectural fact », ajouter un paragraphe : l'accueil siège affiche `SiteNetwork` (cartes de sites lues dans `Implantations`, colonnes `SiteUrl/Couleur/Initiales`) et `LinkDirectory` (tuiles icône + libellé alimentées par `linkDirectoryData.ts`) ; le même web part tourne sur chaque site de filiale (hub + sites d'équipe créés par `-ProvisionFiliales`). Dans « Provisioning » ajouter la ligne `.\provision-bbi-intranet.ps1 -ProvisionFiliales`.

- [ ] **Step 3: Suite complète de vérification**

Run: `cd bbi-intranet && npx heft build && node tools/verify-fallback.js && node tools/css-harness.js dist && node tools/preview-smoke.js && npm run build && node tools/verify-package.js`
Expected: tout vert ; `sharepoint/solution/bbi-intranet.sppkg` produit.

- [ ] **Step 4: Copier le paquet**

```bash
cp bbi-intranet/sharepoint/solution/bbi-intranet.sppkg deliverables/spfx/bbi-intranet.sppkg
cd bbi-intranet && node tools/verify-package.js
```
Expected: cohérence manifeste/bundle OK.

- [ ] **Step 5: Commit**

```bash
git add deploy/README.md bbi-intranet/README.md CLAUDE.md deliverables/spfx/bbi-intranet.sppkg
git commit -m "docs+build: hub et filiales documentés, paquet de production régénéré"
```

- [ ] **Step 6: Déploiement (manuel, hors dépôt)**

1. Catalogue d'applications : Upgrade avec `deliverables/spfx/bbi-intranet.sppkg`, confirmer **Déployé**.
2. `cd deploy; .\provision-bbi-intranet.ps1 -ProvisionFiliales -DryRun`, puis sans `-DryRun`. Première exécution réelle avec une seule ligne de filiale renseignée en `Ville` (Abidjan) ; vérifier le site puis compléter les autres lignes et relancer.
3. Ouvrir l'accueil siège (cartes, annuaires, ordre), puis `/sites/intranet-abidjan` (portail, navigation hub).
