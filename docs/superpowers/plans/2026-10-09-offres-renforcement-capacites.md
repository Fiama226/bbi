# Offres : Formation, Conseil, Coaching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reposition the BBI portal around three equal pillars (Formation, Conseil, Coaching) with a new `Offres` list, a pole-filterable catalogue, a three-pillar strip on the home view and rebalanced default texts.

**Architecture:** A new pure data module (`offersData.ts`) loads the `Offres` list with the project's three-state fallback contract. A new `OffersCatalog.tsx` replaces the embedded `TrainingCatalog` inside `bbiHome` only (the standalone `trainingCatalog` web part is untouched). `BbiHome.tsx` owns the pole filter state so URLs like `#offres?pole=conseil` keep working through `openView`, which otherwise rewrites the hash to `#formations`.

**Tech Stack:** SPFx 1.22.2, TypeScript 5.8, React 17, SCSS modules, PowerShell (PnP) provisioning, Node verification harnesses in `bbi-intranet/tools`.

**Spec:** `docs/superpowers/specs/2026-10-09-offres-renforcement-capacites-design.md`

## Global Constraints

- All commands run from `bbi-intranet/` unless a path says otherwise. Node >= 22.14.
- SharePoint internal column names have no spaces and no accents: `Pole`, `CodeOffre`, `Filiere`, `Format`, `Duree`, `PublicCible`, `Niveau`, `StatutCatalogue`, `Description`, `Objectifs`, `Programme`, `Prerequis`, `Livrables`.
- REST URLs are built only with `listApiUrl` from `src/shared/sharePointRest.ts`. Never hand-build `_api/web/lists/...`.
- Every data source follows the three-state contract (list absent, list empty, list populated) and gets checks in `tools/verify-fallback.js`.
- Routing logic stays in pure functions (`portalRoutes.ts`, `homeLayout.ts`, `offersData.ts`), testable without a browser.
- The internal view id stays `formations`; `#formations`, `#catalogue` and `.aspx` aliases must keep working. `#offres` is added as an alias.
- Do not modify `src/webparts/trainingCatalog/**`. Do not regenerate `deliverables/audit-2026/*.html`.
- The navigation bar stays navy via `var(--bbi-navy)`, never transparent.
- A list row without `Pole` is a Formation. Only rows with `StatutCatalogue` empty or `Actif` are shown. A populated list whose rows are all archived shows an empty state, never demo data.
- Package version becomes `1.9.0.0` (solution and feature) in `config/package-solution.json`. `shortDescription` must stay under 255 characters.
- Commit messages are in French in the `type(scope): message` style and end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- `Offres` list exists but the `Pole` column was never created: rows must load (no HTTP 400) and count as Formation. Pinned in Task 1.
- `Pole` typed with different case or spacing (`" coaching "`, `CONSEIL`): must match the right pole; an unknown value (`Accompagnement`) becomes Formation. Pinned in Task 1.
- `#offres?pole=xyz` or `#offres?pole=` : no filter, all poles shown, no crash. Pinned in Task 1.
- Only one pole has offers (for example only Conseil): the other chips show a zero count and a clear "aucune offre" message, and the home preview shows no empty headings. Pinned in Task 2 by construction and in Task 1 by `previewOffers` and `countByPole` checks.
- A page already provisioned keeps saved properties (`navLinks` with `#formations`, old hero texts, `formationsListTitle`, no `offersListTitle`): navigation must still work and the catalogue must read the `Offres` default. Pinned in Task 3 (default title) and Task 5 (upgrade procedure).

---

### Task 1: Data and routing layer (`offersData.ts`, `#offres` alias)

**Files:**
- Create: `src/webparts/bbiHome/components/offersData.ts`
- Modify: `src/webparts/bbiHome/components/portalRoutes.ts:23-26` (alias)
- Modify: `tools/verify-fallback.js` (new `testOffers`, registered in the final async block)

**Interfaces:**
- Consumes: `listApiUrl(siteUrl, listTitle, resource, query)` from `src/shared/sharePointRest.ts`; `parsePortalRoute(rawHash)` from `./homeLayout`; `SPHttpClient` from `@microsoft/sp-http`.
- Produces (all exported from `offersData.ts`):
  - `type OfferPole = 'Formation' | 'Conseil' | 'Coaching'`
  - `OFFER_POLES: OfferPole[]` (order: Formation, Conseil, Coaching)
  - `interface IOffer { Id: number; Title: string; Pole: OfferPole; CodeOffre?: string; Filiere?: string; Format?: string; Duree?: string; PublicCible?: string; Niveau?: string; StatutCatalogue?: string }`
  - `interface IOffersResult { items: IOffer[]; isDemo: boolean }`
  - `interface IOfferFilter { pole?: OfferPole | ''; filiere?: string; query?: string }`
  - `OFFER_PILLARS: { pole: OfferPole; icon: string; promise: string }[]`
  - `normalizePole(value: unknown): OfferPole`
  - `poleFromParam(value: string | undefined): OfferPole | ''`
  - `poleFromHash(hash: string): OfferPole | ''`
  - `loadOffers(spHttpClient: SPHttpClient, siteUrl: string, listTitle: string, maxItems?: number): Promise<IOffersResult>`
  - `activeOffers(items: IOffer[]): IOffer[]`
  - `countByPole(items: IOffer[]): { [pole: string]: number }`
  - `filieresOf(items: IOffer[]): string[]`
  - `filterOffers(items: IOffer[], filter: IOfferFilter): IOffer[]`
  - `previewOffers(items: IOffer[], perPole: number): IOffer[]`

- [ ] **Step 1: Write the failing test**

In `tools/verify-fallback.js`, insert this function just above the final `(async () => {` block:

```js
/* ------------------------------------------------------------------ */
/* 17. Offres : formation, conseil, coaching                           */
/* ------------------------------------------------------------------ */
async function testOffers() {
  console.log('\nOffres : trois pôles (Formation, Conseil, Coaching)');
  const {
    loadOffers, normalizePole, poleFromParam, poleFromHash, activeOffers,
    countByPole, filterOffers, filieresOf, previewOffers, OFFER_POLES
  } = loadTsModule('src/webparts/bbiHome/components/offersData.ts');
  const { viewFromHref } = loadTsModule('src/webparts/bbiHome/components/portalRoutes.ts');

  // (a) liste absente → 404 sur /fields
  const missing = await loadOffers(fakeClient([{ match: /fields/, ok: false, status: 404 }]), SITE, 'Offres');
  check('liste absente → offres de repli', missing.isDemo === true && missing.items.length >= 12, `${missing.items.length} offres`);
  check('repli → les trois pôles sont représentés', OFFER_POLES.every((p) => missing.items.some((o) => o.Pole === p)));
  const demoCounts = countByPole(activeOffers(missing.items));
  check('repli → 5 formations, 4 conseils, 3 coachings', demoCounts.Formation === 5 && demoCounts.Conseil === 4 && demoCounts.Coaching === 3, JSON.stringify(demoCounts));

  // (b) liste créée mais vide
  const empty = await loadOffers(fakeClient([
    { match: /fields/, json: { value: [{ InternalName: 'Title' }, { InternalName: 'Pole' }] } },
    { match: /items/, json: { value: [] } }
  ]), SITE, 'Offres');
  check('liste vide → offres de repli', empty.isDemo === true && empty.items.length >= 12);

  // (c) liste alimentée
  const allCols = ['Title', 'Pole', 'CodeOffre', 'Filiere', 'Format', 'Duree', 'PublicCible', 'Niveau', 'StatutCatalogue'].map((n) => ({ InternalName: n }));
  const rows = [
    { Id: 1, Title: 'Audit RH', Pole: 'Conseil', Filiere: 'RH', StatutCatalogue: 'Actif' },
    { Id: 2, Title: 'Sans pôle' },
    { Id: 3, Title: 'Ancienne offre', Pole: 'Coaching', StatutCatalogue: 'Archivé' },
    { Id: 4, Title: '   ', Pole: 'Conseil' },
    { Id: 5, Title: 'Casse', Pole: ' coaching ' },
    { Id: 6, Title: 'Pôle inconnu', Pole: 'Accompagnement' }
  ];
  const live = await loadOffers(fakeClient([
    { match: /fields/, json: { value: allCols } },
    { match: /items/, json: { value: rows } }
  ]), SITE, 'Offres');
  check('liste alimentée → données réelles, pas de repli', live.isDemo === false && live.items.length === 5, `${live.items.length} lignes`);
  check('ligne sans pôle → Formation', live.items.filter((o) => o.Id === 2)[0].Pole === 'Formation');
  check('pôle saisi « " coaching " » → Coaching', live.items.filter((o) => o.Id === 5)[0].Pole === 'Coaching');
  check('pôle inconnu → Formation', live.items.filter((o) => o.Id === 6)[0].Pole === 'Formation');
  check('titre vide → ligne ignorée', live.items.every((o) => o.Id !== 4));
  check('archivées exclues du catalogue', activeOffers(live.items).every((o) => o.Id !== 3) && activeOffers(live.items).length === 4);
  check('filtre par pôle', filterOffers(live.items, { pole: 'Conseil' }).length === 1);
  check('filtre par filière', filterOffers(live.items, { filiere: 'RH' }).length === 1);
  check('recherche texte insensible à la casse', filterOffers(live.items, { query: 'AUDIT' }).length === 1);
  check('filières listées', filieresOf(live.items).join(',') === 'RH');

  // (d) colonne « Pole » jamais créée : aucune erreur HTTP, tout est Formation
  const seen = [];
  const noPole = await loadOffers({
    get: async (url) => {
      seen.push(url);
      if (/\/fields/.test(url)) {
        return { ok: true, status: 200, json: async () => ({ value: [{ InternalName: 'Title' }, { InternalName: 'Filiere' }] }) };
      }
      return { ok: true, status: 200, json: async () => ({ value: [{ Id: 1, Title: 'Audit RH', Filiere: 'RH' }] }) };
    }
  }, SITE, 'Offres');
  const itemsUrl = seen.filter((u) => /\/items/.test(u))[0] || '';
  check('colonne Pole absente → non demandée dans $select', itemsUrl.indexOf('Pole') === -1, itemsUrl);
  check('colonne Pole absente → offre traitée comme Formation', noPole.isDemo === false && noPole.items[0].Pole === 'Formation');

  // (e) liste alimentée mais entièrement archivée : pas de repli, catalogue vide
  const archived = await loadOffers(fakeClient([
    { match: /fields/, json: { value: allCols } },
    { match: /items/, json: { value: [{ Id: 1, Title: 'Ancienne', Pole: 'Conseil', StatutCatalogue: 'Archivé' }] } }
  ]), SITE, 'Offres');
  check('tout archivé → pas de repli, catalogue vide', archived.isDemo === false && activeOffers(archived.items).length === 0);

  // (f) un seul pôle alimenté
  const onlyConseil = [{ Id: 1, Title: 'A', Pole: 'Conseil' }, { Id: 2, Title: 'B', Pole: 'Conseil' }, { Id: 3, Title: 'C', Pole: 'Conseil' }];
  const normalized = (await loadOffers(fakeClient([
    { match: /fields/, json: { value: allCols } },
    { match: /items/, json: { value: onlyConseil } }
  ]), SITE, 'Offres')).items;
  const oneCounts = countByPole(normalized);
  check('un seul pôle → compteurs à zéro pour les autres', oneCounts.Conseil === 3 && oneCounts.Formation === 0 && oneCounts.Coaching === 0);
  check('aperçu : 2 par pôle, sans pôle vide', previewOffers(normalized, 2).length === 2);
  check('aperçu du repli : 2 par pôle = 6 offres', previewOffers(missing.items, 2).length === 6);

  // (g) normalisation et paramètre d'URL
  check('normalizePole insensible à la casse et aux espaces', normalizePole('  CONSEIL ') === 'Conseil' && normalizePole(undefined) === 'Formation');
  check('poleFromParam valide', poleFromParam('conseil') === 'Conseil' && poleFromParam('Coaching') === 'Coaching');
  check('poleFromParam invalide ou vide → aucun filtre', poleFromParam('xyz') === '' && poleFromParam('') === '' && poleFromParam(undefined) === '');
  check('#offres?pole=conseil → Conseil', poleFromHash('#offres?pole=conseil') === 'Conseil');
  check('#offres?pole=xyz et #offres → aucun filtre', poleFromHash('#offres?pole=xyz') === '' && poleFromHash('#offres') === '');
  check('#formations → aucun filtre', poleFromHash('#formations') === '');

  // (h) routage
  check('#offres et #offres?pole=… ouvrent la vue catalogue', viewFromHref('#offres') === 'formations' && viewFromHref('#offres?pole=coaching') === 'formations');
  check('alias historiques #formations et #catalogue conservés', viewFromHref('#formations') === 'formations' && viewFromHref('#catalogue') === 'formations');
}

```

Then register it: in the final block, add `await testOffers();` on the line after `await testCountryFlags();`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node tools/verify-fallback.js`
Expected: the earlier suites print their checks, then the process crashes in `testOffers` with `ENOENT ... offersData.ts` (module not created yet), exit code 1.

- [ ] **Step 3: Write minimal implementation**

Create `src/webparts/bbiHome/components/offersData.ts`:

```ts
import { SPHttpClient } from '@microsoft/sp-http';
import { listApiUrl } from '../../../shared/sharePointRest';
import { parsePortalRoute } from './homeLayout';

/**
 * BBI : offres (Formation, Conseil, Coaching).
 *
 * Source : liste SharePoint « Offres ». Contrat de repli à trois états :
 * liste absente (404), liste vide, liste alimentée. Les fonctions de ce
 * fichier sont pures (hors loadOffers) et vérifiées par tools/verify-fallback.js.
 */

export type OfferPole = 'Formation' | 'Conseil' | 'Coaching';

export const OFFER_POLES: OfferPole[] = ['Formation', 'Conseil', 'Coaching'];

export interface IOffer {
  Id: number;
  Title: string;
  Pole: OfferPole;
  CodeOffre?: string;
  Filiere?: string;
  Format?: string;
  Duree?: string;
  PublicCible?: string;
  Niveau?: string;
  StatutCatalogue?: string;
}

export interface IOffersResult {
  items: IOffer[];
  isDemo: boolean;
}

export interface IOfferFilter {
  pole?: OfferPole | '';
  filiere?: string;
  query?: string;
}

/** Les trois cartes du bandeau de l'accueil. */
export const OFFER_PILLARS: { pole: OfferPole; icon: string; promise: string }[] = [
  { pole: 'Formation', icon: '▦', promise: 'Des parcours pratiques pour monter en compétences.' },
  { pole: 'Conseil', icon: '◈', promise: 'Un regard expert pour structurer et faire évoluer votre organisation.' },
  { pole: 'Coaching', icon: '◎', promise: 'Un accompagnement individuel et collectif pour franchir les caps.' }
];

const OFFER_COLUMNS: string[] = [
  'Title', 'Pole', 'CodeOffre', 'Filiere', 'Format', 'Duree', 'PublicCible', 'Niveau', 'StatutCatalogue'
];

const text = (value: unknown): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  const out = String(value).trim();
  return out ? out : undefined;
};

/** Pôle d'une ligne de liste : insensible à la casse, « Formation » par défaut. */
export const normalizePole = (value: unknown): OfferPole => {
  const key = (text(value) || '').toLowerCase();
  for (let i = 0; i < OFFER_POLES.length; i += 1) {
    if (OFFER_POLES[i].toLowerCase() === key) {
      return OFFER_POLES[i];
    }
  }
  return 'Formation';
};

/** Pôle d'un paramètre d'URL : strict, chaîne vide si inconnu (= aucun filtre). */
export const poleFromParam = (value: string | undefined): OfferPole | '' => {
  const key = (value || '').trim().toLowerCase();
  for (let i = 0; i < OFFER_POLES.length; i += 1) {
    if (OFFER_POLES[i].toLowerCase() === key) {
      return OFFER_POLES[i];
    }
  }
  return '';
};

export const poleFromHash = (hash: string): OfferPole | '' =>
  poleFromParam(parsePortalRoute(hash).params.pole);

const normalizeOffer = (raw: { [key: string]: unknown }): IOffer => ({
  Id: Number(raw.Id) || 0,
  Title: text(raw.Title) || '',
  Pole: normalizePole(raw.Pole),
  CodeOffre: text(raw.CodeOffre),
  Filiere: text(raw.Filiere),
  Format: text(raw.Format),
  Duree: text(raw.Duree),
  PublicCible: text(raw.PublicCible),
  Niveau: text(raw.Niveau),
  StatutCatalogue: text(raw.StatutCatalogue)
});

const DEMO_OFFERS: IOffer[] = [
  { Id: 1, Title: "Management d'équipe", Pole: 'Formation', CodeOffre: 'BBI-FOR-101', Filiere: 'Management', Format: 'Présentiel', Duree: '2 jours', Niveau: 'Confirmé', PublicCible: 'Managers de proximité', StatutCatalogue: 'Actif' },
  { Id: 2, Title: 'Vendre la valeur, pas le prix', Pole: 'Formation', CodeOffre: 'BBI-FOR-110', Filiere: 'Commerce', Format: 'Présentiel', Duree: '1 jour', Niveau: 'Débutant', PublicCible: 'Équipes commerciales', StatutCatalogue: 'Actif' },
  { Id: 3, Title: 'Prospection digitale', Pole: 'Formation', CodeOffre: 'BBI-FOR-140', Filiere: 'Digital', Format: 'Distanciel', Duree: '½ journée', Niveau: 'Débutant', PublicCible: 'Commerciaux et indépendants', StatutCatalogue: 'Actif' },
  { Id: 4, Title: 'Fondamentaux Qualiopi', Pole: 'Formation', CodeOffre: 'BBI-FOR-301', Filiere: 'Qualité & Certification', Format: 'Distanciel', Duree: '1 jour', Niveau: 'Intermédiaire', PublicCible: 'Responsables qualité', StatutCatalogue: 'Actif' },
  { Id: 5, Title: 'Leadership & gestion du changement', Pole: 'Formation', CodeOffre: 'BBI-FOR-210', Filiere: 'Management', Format: 'Hybride', Duree: '3 jours', Niveau: 'Confirmé', PublicCible: 'Cadres dirigeants', StatutCatalogue: 'Actif' },
  { Id: 6, Title: 'Diagnostic organisationnel', Pole: 'Conseil', CodeOffre: 'BBI-CON-101', Filiere: 'Organisation', Format: 'Sur site client', Duree: '3 à 6 semaines', Niveau: 'Confirmé', PublicCible: 'Directions générales', StatutCatalogue: 'Actif' },
  { Id: 7, Title: "Structuration d'un dispositif de formation", Pole: 'Conseil', CodeOffre: 'BBI-CON-120', Filiere: 'Ingénierie de formation', Format: 'Hybride', Duree: '2 à 4 mois', Niveau: 'Confirmé', PublicCible: 'Organismes et directions RH', StatutCatalogue: 'Actif' },
  { Id: 8, Title: 'Accompagnement au changement', Pole: 'Conseil', CodeOffre: 'BBI-CON-210', Filiere: 'Organisation', Format: 'Sur site client', Duree: '3 à 9 mois', Niveau: 'Expert', PublicCible: 'Comités de direction', StatutCatalogue: 'Actif' },
  { Id: 9, Title: 'Mise en conformité qualité (Qualiopi, ISO 21001)', Pole: 'Conseil', CodeOffre: 'BBI-CON-301', Filiere: 'Qualité & Certification', Format: 'Hybride', Duree: '6 à 10 semaines', Niveau: 'Confirmé', PublicCible: 'Organismes de formation', StatutCatalogue: 'Actif' },
  { Id: 10, Title: 'Coaching de dirigeants', Pole: 'Coaching', CodeOffre: 'BBI-COA-101', Filiere: 'Leadership', Format: 'Hybride', Duree: '6 mois', Niveau: 'Expert', PublicCible: 'Dirigeants et cadres supérieurs', StatutCatalogue: 'Actif' },
  { Id: 11, Title: "Coaching d'équipe", Pole: 'Coaching', CodeOffre: 'BBI-COA-120', Filiere: 'Management', Format: 'Présentiel', Duree: '4 mois', Niveau: 'Confirmé', PublicCible: 'Équipes de direction', StatutCatalogue: 'Actif' },
  { Id: 12, Title: "Cycle d'accompagnement d'entrepreneurs", Pole: 'Coaching', CodeOffre: 'BBI-COA-201', Filiere: 'Entrepreneuriat', Format: 'Hybride', Duree: '6 mois', Niveau: 'Intermédiaire', PublicCible: 'Porteurs de projet', StatutCatalogue: 'Actif' }
];

const demoOffers = (): IOffer[] => DEMO_OFFERS.map((offer) => ({ ...offer }));

/**
 * Charge la liste « Offres ». Les colonnes absentes de la liste ne sont pas
 * demandées (pas d'erreur HTTP 400) ; liste absente ou vide → offres de repli.
 */
export const loadOffers = async (
  spHttpClient: SPHttpClient,
  siteUrl: string,
  listTitle: string,
  maxItems: number = 300
): Promise<IOffersResult> => {
  try {
    const fieldsUrl = listApiUrl(siteUrl, listTitle, 'fields', '?$select=InternalName&$top=500');
    const fieldsResponse = await spHttpClient.get(fieldsUrl, SPHttpClient.configurations.v1);
    if (!fieldsResponse.ok) {
      throw new Error(`HTTP ${fieldsResponse.status}`);
    }
    const fieldsJson = (await fieldsResponse.json()) as { value?: { InternalName: string }[] };
    const available = (fieldsJson.value || []).map((field) => field.InternalName);
    const select = ['Id'].concat(OFFER_COLUMNS.filter((column) => available.indexOf(column) !== -1));
    const itemsUrl = listApiUrl(
      siteUrl,
      listTitle,
      'items',
      `?$select=${select.join(',')}&$orderby=Title&$top=${Math.max(1, maxItems)}`
    );
    const response = await spHttpClient.get(itemsUrl, SPHttpClient.configurations.v1);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const json = (await response.json()) as { value?: { [key: string]: unknown }[] };
    const items = (json.value || []).map(normalizeOffer).filter((offer) => !!offer.Title);
    if (items.length === 0) {
      return { items: demoOffers(), isDemo: true };
    }
    return { items, isDemo: false };
  } catch {
    return { items: demoOffers(), isDemo: true };
  }
};

export const activeOffers = (items: IOffer[]): IOffer[] =>
  items.filter((offer) => !offer.StatutCatalogue || offer.StatutCatalogue === 'Actif');

export const countByPole = (items: IOffer[]): { [pole: string]: number } => {
  const counts: { [pole: string]: number } = { Formation: 0, Conseil: 0, Coaching: 0 };
  items.forEach((offer) => {
    counts[offer.Pole] += 1;
  });
  return counts;
};

export const filieresOf = (items: IOffer[]): string[] => {
  const set: { [key: string]: boolean } = {};
  items.forEach((offer) => {
    const filiere = (offer.Filiere || '').trim();
    if (filiere) {
      set[filiere] = true;
    }
  });
  return Object.keys(set).sort((a, b) => a.localeCompare(b, 'fr'));
};

export const filterOffers = (items: IOffer[], filter: IOfferFilter): IOffer[] => {
  const query = (filter.query || '').trim().toLowerCase();
  return activeOffers(items).filter((offer) => {
    const matchPole = !filter.pole || offer.Pole === filter.pole;
    const matchFiliere = !filter.filiere || (offer.Filiere || '') === filter.filiere;
    const matchQuery =
      !query ||
      offer.Title.toLowerCase().indexOf(query) !== -1 ||
      (offer.CodeOffre || '').toLowerCase().indexOf(query) !== -1 ||
      (offer.PublicCible || '').toLowerCase().indexOf(query) !== -1;
    return matchPole && matchFiliere && matchQuery;
  });
};

/** Aperçu de l'accueil : jusqu'à `perPole` offres par pôle, dans l'ordre des pôles. */
export const previewOffers = (items: IOffer[], perPole: number): IOffer[] => {
  const active = activeOffers(items);
  return OFFER_POLES.reduce<IOffer[]>(
    (all, pole) => all.concat(active.filter((offer) => offer.Pole === pole).slice(0, perPole)),
    []
  );
};
```

In `src/webparts/bbiHome/components/portalRoutes.ts`, change the alias line:

```ts
  formations: "formations", catalogue: "formations",
```

to:

```ts
  formations: "formations", catalogue: "formations", offres: "formations",
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tools/verify-fallback.js`
Expected: every earlier suite still passes and the new `Offres : trois pôles` block prints only `✓` lines; the final line reads `Résultat : <N> vérifications réussies, 0 échec(s).` with exit code 0. Note the new total N for Task 5.

- [ ] **Step 5: Commit**

```bash
git add src/webparts/bbiHome/components/offersData.ts src/webparts/bbiHome/components/portalRoutes.ts tools/verify-fallback.js
git commit -m "feat(home): couche de données des offres (formation, conseil, coaching) et alias #offres

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `OffersCatalog` and `PillarsStrip` components

**Files:**
- Create: `src/webparts/bbiHome/components/OffersCatalog.tsx`
- Create: `src/webparts/bbiHome/components/OffersCatalog.module.scss`

**Interfaces:**
- Consumes (from Task 1, `./offersData`): `IOffer`, `OfferPole`, `OFFER_POLES`, `OFFER_PILLARS`, `loadOffers`, `activeOffers`, `countByPole`, `filterOffers`, `filieresOf`, `previewOffers`.
- Produces (from `OffersCatalog.tsx`):
  - `interface IOffersCatalogProps { siteUrl: string; listTitle: string; spHttpClient: SPHttpClient; showDataNotices: boolean; pole: OfferPole | ''; onPoleChange: (pole: OfferPole | '') => void; initialQuery?: string; compact?: boolean; perPole?: number }`
  - `OffersCatalog: React.FC<IOffersCatalogProps>` (default export too)
  - `interface IPillarsStripProps { onNavigate: (event: React.MouseEvent<HTMLAnchorElement>, href: string) => void }`
  - `PillarsStrip: React.FC<IPillarsStripProps>`

- [ ] **Step 1: Write the styles**

Create `src/webparts/bbiHome/components/OffersCatalog.module.scss`:

```scss
.offers {
  --bbi-navy: var(--themePrimary, #0E265C);
  --bbi-red: #D21419;
  --bbi-soft: var(--themeLighterAlt, #F4F6FA);
  --bbi-line: var(--neutralLight, #E1E4EA);
  --bbi-text: var(--neutralPrimary, #21252B);
  --bbi-muted: var(--neutralSecondary, #5A6270);
  --bbi-pole-formation: #0E265C;
  --bbi-pole-conseil: #D21419;
  --bbi-pole-coaching: #1F7A6D;
  color: var(--bbi-text);
}

.placeholder {
  padding: 24px;
  font-weight: 600;
  color: var(--bbi-muted);
}

.demoBanner {
  background: #FFF8E1;
  border: 1px solid #F0D48A;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12.5px;
  color: #7A5A00;
  margin-bottom: 10px;
}

.toolbar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 14px;
}

.search {
  max-width: 340px;
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--bbi-line);
  border-radius: 6px;
  font-size: 13.5px;
  outline: none;

  &:focus {
    border-color: var(--bbi-navy);
  }
}

.poleChips,
.filiereChips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  border: 1px solid var(--bbi-line);
  background: #fff;
  color: var(--bbi-text);
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;

  &:hover {
    border-color: var(--bbi-navy);
  }
}

.chipActive {
  background: var(--bbi-navy);
  border-color: var(--bbi-navy);
  color: #fff;
}

.count {
  margin-left: 6px;
  font-size: 12px;
  opacity: 0.8;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  background: #fff;
  border: 1px solid var(--bbi-line);
  border-radius: 10px;
}

.cardTop {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
  color: #fff;
}

.poleFormation { background: var(--bbi-pole-formation); }
.poleConseil { background: var(--bbi-pole-conseil); }
.poleCoaching { background: var(--bbi-pole-coaching); }

.code {
  font-size: 11.5px;
  color: var(--bbi-muted);
}

.cardTitle {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.3;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  font-size: 12.5px;
  color: var(--bbi-muted);
}

.audience {
  margin: 0;
  font-size: 12.5px;
  color: var(--bbi-muted);
}

.empty {
  padding: 24px;
  text-align: center;
  background: var(--bbi-soft);
  border-radius: 10px;
}

.emptyTitle {
  font-weight: 600;
  margin-bottom: 4px;
}

.emptyHint {
  color: var(--bbi-muted);
  font-size: 13px;
}

.reset {
  margin-top: 10px;
  border: 1px solid var(--bbi-navy);
  background: #fff;
  color: var(--bbi-navy);
  border-radius: 6px;
  padding: 6px 14px;
  cursor: pointer;
}

/* Bandeau des trois pôles (accueil) */
.pillars {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.pillarCard {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 18px 20px;
  background: #fff;
  border: 1px solid var(--bbi-line);
  border-top: 4px solid var(--bbi-navy);
  border-radius: 10px;
  color: var(--bbi-text);
  text-decoration: none;

  &:hover {
    box-shadow: 0 4px 14px rgba(14, 38, 92, 0.12);
  }
}

.pillarIcon {
  font-size: 22px;
  color: var(--bbi-navy);
}

.pillarTitle {
  font-size: 17px;
  font-weight: 700;
}

.pillarText {
  font-size: 13.5px;
  color: var(--bbi-muted);
}

.pillarLink {
  margin-top: auto;
  font-size: 13px;
  font-weight: 600;
  color: var(--bbi-red);
}

@media (max-width: 720px) {
  .pillars {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 2: Write the components**

Create `src/webparts/bbiHome/components/OffersCatalog.tsx`:

```tsx
import * as React from 'react';
import { SPHttpClient } from '@microsoft/sp-http';
import styles from './OffersCatalog.module.scss';
import {
  IOffer,
  OfferPole,
  OFFER_POLES,
  OFFER_PILLARS,
  loadOffers,
  activeOffers,
  countByPole,
  filterOffers,
  filieresOf,
  previewOffers
} from './offersData';

export interface IOffersCatalogProps {
  siteUrl: string;
  listTitle: string;
  spHttpClient: SPHttpClient;
  showDataNotices: boolean;
  /** Filtre de pôle, piloté par le portail (URL `#offres?pole=conseil`). */
  pole: OfferPole | '';
  onPoleChange: (pole: OfferPole | '') => void;
  initialQuery?: string;
  /** Aperçu de l'accueil : quelques offres par pôle, sans filtres. */
  compact?: boolean;
  perPole?: number;
}

const POLE_CLASS: { [pole: string]: string } = {
  Formation: styles.poleFormation,
  Conseil: styles.poleConseil,
  Coaching: styles.poleCoaching
};

const OfferCard: React.FC<{ offer: IOffer }> = ({ offer }) => (
  <article className={styles.card}>
    <div className={styles.cardTop}>
      <span className={`${styles.badge} ${POLE_CLASS[offer.Pole]}`}>{offer.Pole}</span>
      {offer.CodeOffre ? <span className={styles.code}>{offer.CodeOffre}</span> : null}
    </div>
    <h3 className={styles.cardTitle}>{offer.Title}</h3>
    <div className={styles.meta}>
      {offer.Format ? <span>{offer.Format}</span> : null}
      {offer.Duree ? <span>{offer.Duree}</span> : null}
      {offer.Niveau ? <span>{offer.Niveau}</span> : null}
    </div>
    {offer.PublicCible ? <p className={styles.audience}>{offer.PublicCible}</p> : null}
  </article>
);

export const OffersCatalog: React.FC<IOffersCatalogProps> = (props) => {
  const { siteUrl, listTitle, spHttpClient, showDataNotices, pole, onPoleChange, compact } = props;

  const [ready, setReady] = React.useState(false);
  const [items, setItems] = React.useState<IOffer[]>([]);
  const [isDemo, setIsDemo] = React.useState(false);
  const [query, setQuery] = React.useState(props.initialQuery || '');
  const [filiere, setFiliere] = React.useState('');

  React.useEffect(() => {
    if (props.initialQuery !== undefined) {
      setQuery(props.initialQuery);
    }
  }, [props.initialQuery]);

  React.useEffect(() => {
    setFiliere('');
  }, [pole]);

  React.useEffect(() => {
    let cancelled = false;
    setReady(false);
    loadOffers(spHttpClient, siteUrl, listTitle)
      .then((result) => {
        if (cancelled) { return; }
        setItems(result.items);
        setIsDemo(result.isDemo);
        setReady(true);
      })
      .catch(() => { /* loadOffers ne rejette jamais : repli intégré */ });
    return () => { cancelled = true; };
  }, [siteUrl, listTitle, spHttpClient]);

  const active = React.useMemo(() => activeOffers(items), [items]);
  const counts = React.useMemo(() => countByPole(active), [active]);
  const filieres = React.useMemo(
    () => filieresOf(filterOffers(items, { pole })),
    [items, pole]
  );
  const filtered = React.useMemo(
    () => filterOffers(items, { pole, filiere, query }),
    [items, pole, filiere, query]
  );

  if (!ready) {
    return (
      <div className={styles.offers}>
        <div className={styles.placeholder}>Nos offres — ⏳</div>
      </div>
    );
  }

  const banner = showDataNotices && isDemo ? (
    <div className={styles.demoBanner}>
      💡 Données de démonstration : la liste « Offres » est absente, non créée ou vide.
    </div>
  ) : null;

  if (compact) {
    const preview = previewOffers(items, props.perPole || 2);
    return (
      <div className={styles.offers}>
        {banner}
        <div className={styles.grid}>
          {preview.map((offer) => <OfferCard key={offer.Id} offer={offer} />)}
        </div>
      </div>
    );
  }

  const poleIsEmpty = !!pole && counts[pole] === 0;

  return (
    <div className={styles.offers}>
      {banner}
      <div className={styles.toolbar}>
        <input
          type="search"
          className={styles.search}
          placeholder="Rechercher une offre"
          value={query}
          onChange={(event) => { setQuery(event.target.value); }}
          aria-label="Rechercher une offre"
        />
        <div className={styles.poleChips} role="group" aria-label="Pôles">
          <button
            type="button"
            aria-pressed={pole === ''}
            className={pole === '' ? `${styles.chip} ${styles.chipActive}` : styles.chip}
            onClick={() => { onPoleChange(''); }}
          >
            Tous les pôles<span className={styles.count}>{active.length}</span>
          </button>
          {OFFER_POLES.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={pole === p}
              className={pole === p ? `${styles.chip} ${styles.chipActive}` : styles.chip}
              onClick={() => { onPoleChange(p); }}
            >
              {p}<span className={styles.count}>{counts[p]}</span>
            </button>
          ))}
        </div>
        {filieres.length > 1 && (
          <div className={styles.filiereChips} role="group" aria-label="Filières">
            <button
              type="button"
              aria-pressed={filiere === ''}
              className={filiere === '' ? `${styles.chip} ${styles.chipActive}` : styles.chip}
              onClick={() => { setFiliere(''); }}
            >
              Toutes les filières
            </button>
            {filieres.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filiere === f}
                className={filiere === f ? `${styles.chip} ${styles.chipActive}` : styles.chip}
                onClick={() => { setFiliere(f); }}
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>
            {poleIsEmpty && !query && !filiere
              ? `Aucune offre publiée pour le pôle ${pole} pour le moment.`
              : 'Aucune offre ne correspond à votre recherche.'}
          </div>
          <div className={styles.emptyHint}>Essayez un autre pôle ou une autre filière.</div>
          <button
            type="button"
            className={styles.reset}
            onClick={() => { setQuery(''); setFiliere(''); onPoleChange(''); }}
          >
            Réinitialiser les filtres
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((offer) => <OfferCard key={offer.Id} offer={offer} />)}
        </div>
      )}
    </div>
  );
};

export interface IPillarsStripProps {
  onNavigate: (event: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
}

export const PillarsStrip: React.FC<IPillarsStripProps> = ({ onNavigate }) => (
  <div className={styles.pillars}>
    {OFFER_PILLARS.map((pillar) => {
      const href = `#offres?pole=${pillar.pole.toLowerCase()}`;
      return (
        <a
          key={pillar.pole}
          className={styles.pillarCard}
          href={href}
          onClick={(event) => { onNavigate(event, href); }}
        >
          <span className={styles.pillarIcon} aria-hidden="true">{pillar.icon}</span>
          <span className={styles.pillarTitle}>{pillar.pole}</span>
          <span className={styles.pillarText}>{pillar.promise}</span>
          <span className={styles.pillarLink}>Voir les offres →</span>
        </a>
      );
    })}
  </div>
);

export default OffersCatalog;
```

- [ ] **Step 3: Type-check**

Run: `npx heft build`
Expected: build completes with 0 TypeScript errors. (React rendering is covered visually in Task 5; the logic it relies on is covered by Task 1.)

- [ ] **Step 4: Commit**

```bash
git add src/webparts/bbiHome/components/OffersCatalog.tsx src/webparts/bbiHome/components/OffersCatalog.module.scss
git commit -m "feat(home): catalogue des offres par pôle et bandeau des trois pôles

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Wire the catalogue, pole state and labels into `bbiHome`

**Files:**
- Modify: `src/webparts/bbiHome/components/BbiHome.tsx` (imports at 73-75, `defaultNav` at 136-149, state near 405, `openView` near 740, hashchange effect near 484, `followPortalLink` near 758, `catalogProps` at 846-857, JSX near 1212-1226, 1228-1245, 1348-1362, 1483-1515, 1660-1672, 1756-1768, quick links at 274-280)
- Modify: `src/webparts/bbiHome/components/IBbiHomeProps.ts:10`
- Modify: `src/webparts/bbiHome/BbiHomeWebPart.ts:24,277,374`
- Modify: `src/webparts/bbiHome/loc/fr-fr.resjson`, `src/webparts/bbiHome/loc/en-us.resjson`, `src/webparts/bbiHome/loc/mystrings.d.ts`
- Modify: `src/webparts/bbiHome/BbiHomeWebPart.manifest.json` (preconfigured `offersListTitle`)

**Interfaces:**
- Consumes (Task 1 and 2): `OfferPole`, `poleFromHash` from `./offersData`; `OffersCatalog`, `PillarsStrip`, `IOffersCatalogProps` from `./OffersCatalog`.
- Produces: web part property `offersListTitle` (default `'Offres'`); `IBbiHomeProps.offersListTitle: string`.

- [ ] **Step 1: Add the `offersListTitle` property end to end**

First read the exact existing lines, then add the new one next to each:

```bash
grep -n "formationsListTitle" src/webparts/bbiHome/components/IBbiHomeProps.ts src/webparts/bbiHome/BbiHomeWebPart.ts src/webparts/bbiHome/BbiHomeWebPart.manifest.json
grep -n "FormationsListFieldLabel" src/webparts/bbiHome/loc/fr-fr.resjson src/webparts/bbiHome/loc/en-us.resjson src/webparts/bbiHome/loc/mystrings.d.ts
```

Apply, using the exact lines printed above as `old_string` in each Edit:

- `IBbiHomeProps.ts`: after `formationsListTitle: string;` add `offersListTitle: string;`
- `BbiHomeWebPart.ts` interface (line 24): after `formationsListTitle: string;` add `offersListTitle: string;`
- `BbiHomeWebPart.ts` render mapping (line 277): after `formationsListTitle: properties.formationsListTitle || 'Formations',` add `offersListTitle: properties.offersListTitle || 'Offres',`
- `BbiHomeWebPart.ts` property pane (line 374): after the `formationsListTitle` text field add `PropertyPaneTextField('offersListTitle', { label: strings.OffersListFieldLabel }),`
- `fr-fr.resjson`: after the `"FormationsListFieldLabel"` entry add `"OffersListFieldLabel": "Liste des offres (formation, conseil, coaching)",`
- `en-us.resjson`: same key with `"Offers list (training, consulting, coaching)"`.
- `mystrings.d.ts`: after `FormationsListFieldLabel: string;` add `OffersListFieldLabel: string;`
- `BbiHomeWebPart.manifest.json`: in `preconfiguredEntries[0].properties`, after the `formationsListTitle` entry (add one if absent) add `"offersListTitle": "Offres",`

An existing page that saved properties before this change has no `offersListTitle`; the `|| 'Offres'` default in the render mapping covers it.

- [ ] **Step 2: Replace imports**

In `BbiHome.tsx`, replace the three trainingCatalog imports (lines 73-75):

```tsx
import TrainingCatalog from "../../trainingCatalog/components/TrainingCatalog";
import { ITrainingCatalogProps } from "../../trainingCatalog/components/ITrainingCatalogProps";
import trainingStrings from "TrainingCatalogWebPartStrings";
```

with:

```tsx
import OffersCatalog, {
  IOffersCatalogProps,
  PillarsStrip,
} from "./OffersCatalog";
import { OfferPole, poleFromHash } from "./offersData";
```

- [ ] **Step 3: Add the pole state and make `openView` carry it**

After the `activeView` state declaration (the `React.useState<PortalView>(() => viewFromHash(window.location.hash))` block), add:

```tsx
  const [pole, setPole] = React.useState<OfferPole | "">(() =>
    poleFromHash(window.location.hash),
  );
```

Replace the head of `openView`:

```tsx
  const openView = (
    view: PortalView,
    options?: { newsId?: number; silent?: boolean },
  ): void => {
    const targetNewsId =
      options && options.newsId !== undefined ? options.newsId : 0;
    const hash =
      view === "actualite" && targetNewsId
        ? `actualite?id=${targetNewsId}`
        : view;
```

with:

```tsx
  const openView = (
    view: PortalView,
    options?: { newsId?: number; silent?: boolean; pole?: OfferPole | "" },
  ): void => {
    const targetNewsId =
      options && options.newsId !== undefined ? options.newsId : 0;
    const targetPole = (options && options.pole) || "";
    const hash =
      view === "actualite" && targetNewsId
        ? `actualite?id=${targetNewsId}`
        : view === "formations" && targetPole
          ? `offres?pole=${targetPole.toLowerCase()}`
          : view;
```

and in the same function replace

```tsx
    setActiveView(view);
    setNewsId(targetNewsId);
    setMenuOpen(false);
    if (!options || !options.silent) {
```

with:

```tsx
    setActiveView(view);
    setNewsId(targetNewsId);
    setPole(targetPole);
    setMenuOpen(false);
    if (!options || !options.silent) {
```

In `followPortalLink`, replace

```tsx
      openView(view, { newsId: Number.isNaN(parsedId) ? 0 : parsedId });
```

with:

```tsx
      openView(view, {
        newsId: Number.isNaN(parsedId) ? 0 : parsedId,
        pole: poleFromHash(href),
      });
```

In the `syncViewFromUrl` effect, replace

```tsx
      setActiveView(viewFromHash(hash));
      setNewsId(newsIdFromHash(hash));
```

with:

```tsx
      setActiveView(viewFromHash(hash));
      setNewsId(newsIdFromHash(hash));
      setPole(poleFromHash(hash));
```

- [ ] **Step 4: Replace `catalogProps` with `offersProps`**

Replace the whole `const catalogProps: ITrainingCatalogProps = { ... };` block (lines 846-857) with:

```tsx
  const offersProps: IOffersCatalogProps = {
    siteUrl: props.siteUrl,
    listTitle: props.offersListTitle,
    spHttpClient: props.spHttpClient,
    showDataNotices: props.showDataNotices,
    initialQuery: searchQuery,
    pole,
    onPoleChange: setPole,
  };
```

- [ ] **Step 5: Replace the two catalogue usages and their headings**

Catalogue view: replace

```tsx
          aria-label="Catalogue des formations"
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Se former</p>
              <h2>Catalogue des formations</h2>
            </div>
          </div>
          <LazyMount active={activeView === "formations"} minHeight={210}>
            <TrainingCatalog {...catalogProps} />
          </LazyMount>
```

with:

```tsx
          aria-label="Nos offres : formation, conseil et coaching"
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Renforcement de capacités</p>
              <h2>Nos offres</h2>
            </div>
          </div>
          <LazyMount active={activeView === "formations"} minHeight={210}>
            <OffersCatalog {...offersProps} />
          </LazyMount>
```

Home preview: replace

```tsx
                <TrainingCatalog {...catalogProps} maxItems={6} compact />
```

with:

```tsx
                <OffersCatalog {...offersProps} compact perPole={2} />
```

and replace the link just below it:

```tsx
                  href="#formations"
                  onClick={(event) => {
                    followPortalLink(event, "#formations");
                  }}
                >
                  Voir tout le catalogue <span aria-hidden="true">→</span>
```

with:

```tsx
                  href="#offres"
                  onClick={(event) => {
                    followPortalLink(event, "#offres");
                  }}
                >
                  Voir toutes nos offres <span aria-hidden="true">→</span>
```

Home preview heading: replace

```tsx
                  <p className={styles.eyebrow}>Se former</p>
                  <h2>Parcours pédagogiques</h2>
```

with:

```tsx
                  <p className={styles.eyebrow}>Renforcement de capacités</p>
                  <h2>Nos offres</h2>
```

and in the same block replace `Nos plannings <span aria-hidden="true">→</span>` with `Sessions &amp; missions <span aria-hidden="true">→</span>`.

- [ ] **Step 6: Add the three-pillar strip under the hero**

In the render, directly after the `<HomeHero ... />` element (it ends with `onInternalNavigate={followPortalLink}\n        />`) and before the `{(props.visionText || props.missionText || objectives.length > 0) && (` block, insert:

```tsx
        <section
          className={styles.section}
          id="poles"
          data-bbi-view="accueil"
          aria-labelledby="bbi-poles-title"
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Notre métier</p>
              <h2 id="bbi-poles-title">
                Renforcer les capacités : former, conseiller, accompagner
              </h2>
            </div>
          </div>
          <PillarsStrip onNavigate={followPortalLink} />
        </section>
```

- [ ] **Step 7: Rebalance labels and fallback texts in `BbiHome.tsx`**

Apply each edit (use `replace_all` where the string occurs twice):

- `defaultNav`: replace `{ label: "Formations", url: "#formations" },` with `{ label: "Nos offres", url: "#offres" },` and `{ label: "Sessions", url: "#sessions" },` with `{ label: "Sessions & missions", url: "#sessions" },`
- `DEFAULT_QUICK_LINKS`: replace
  ```tsx
      title: "Catalogue des formations",
      subtitle: "Parcours, modalités et durées",
      url: "#formations",
  ```
  with
  ```tsx
      title: "Nos offres",
      subtitle: "Formation, conseil et coaching",
      url: "#offres",
  ```
- Hero fallbacks (replace_all): `"L'expertise qui fait grandir les dirigeants."` → `"Renforcer les capacités de vos équipes et de vos organisations."`; `"Formations, accompagnement et intelligence collective pour transformer vos ambitions en résultats durables."` → `"Formation, conseil et coaching pour transformer vos ambitions en résultats durables."`; `props.primaryCtaLabel || "Explorer les formations"` → `props.primaryCtaLabel || "Découvrir nos offres"`; `props.primaryCtaUrl || "#formations"` → `props.primaryCtaUrl || "#offres"`.
- Search shortcut button: `Parcourir le catalogue des formations{" "}` → `Parcourir nos offres{" "}`
- Path card: replace
  ```tsx
                Repérez les compétences utiles à vos enjeux et trouvez la
                formation adaptée.
  ```
  with
  ```tsx
                Repérez l'accompagnement utile à vos enjeux : formation,
                conseil ou coaching.
  ```
  and in the same card replace `href="#formations"` / `followPortalLink(event, "#formations");` / `Explorer le catalogue →` with `href="#offres"` / `followPortalLink(event, "#offres");` / `Découvrir nos offres →`.
- Sessions heading: `<h2>Prochaines sessions</h2>` → `<h2>Prochaines sessions et missions</h2>`

- [ ] **Step 8: Confirm nothing references the old catalogue, then build**

Run: `grep -n "TrainingCatalog\|trainingStrings\|catalogProps" src/webparts/bbiHome/components/BbiHome.tsx`
Expected: no output.

Run: `npx heft build`
Expected: 0 TypeScript errors.

Run: `node tools/verify-fallback.js`
Expected: `0 échec(s)`.

- [ ] **Step 9: Commit**

```bash
git add src/webparts/bbiHome
git commit -m "feat(home): vue « Nos offres », filtre de pôle dans l'URL et bandeau des trois pôles

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Default texts, provisioning and documentation

**Files:**
- Modify: `src/webparts/bbiHome/BbiHomeWebPart.ts:88-111` (`DEFAULT_HERO_SLIDES`, `DEFAULT_QUICK_LINKS`, `DEFAULT_KPIS`)
- Modify: `src/webparts/bbiHome/BbiHomeWebPart.manifest.json` (`kpis`, `visionText`, `missionText`, `objectivesText`)
- Modify: `deploy/provision-bbi-intranet.ps1` (new `Offres` list block after the `Formations` block ending near line 599, web part properties near 676-722, seeding near line 1009)
- Modify: `deploy/README.md` (lines 21-23, 49, 241), `CLAUDE.md` (schema paragraph), `bbi-intranet/README.md` if it lists the nav

**Interfaces:**
- Consumes: column names from Task 1 (`Pole`, `CodeOffre`, ...), property `offersListTitle` from Task 3.
- Produces: provisioning creates and seeds the `Offres` list; saved page properties use the new wording.

- [ ] **Step 1: Update the code defaults in `BbiHomeWebPart.ts`**

Replace the first hero slide line:

```ts
  ' | Business Builders International | L\'expertise qui fait grandir les dirigeants. | Formations, accompagnement et intelligence collective pour transformer vos ambitions en résultats durables. | Explorer les formations | #formations',
```

with:

```ts
  ' | Business Builders International | Renforcer les capacités de vos équipes et de vos organisations. | Formation, conseil et coaching pour transformer vos ambitions en résultats durables. | Découvrir nos offres | #offres',
```

Replace the second slide so it no longer talks only about training: replace

```ts
  ' | Notre méthode | Des parcours conçus pour le terrain. | Des mises en situation concrètes, des formateurs certifiés et un ancrage à 30 jours. | Voir les prochaines sessions | #sessions',
```

with:

```ts
  ' | Notre méthode | Des accompagnements conçus pour le terrain. | Des mises en situation concrètes, des experts certifiés et un suivi à 30 jours. | Voir les sessions et missions | #sessions',
```

Replace the quick link line `'▦ | Catalogue des formations | Parcours, modalités et durées | #formations',` with `'▦ | Nos offres | Formation, conseil et coaching | #offres',`.

Replace the KPI line `'10+ | Formations au catalogue',` with `'3 | Pôles : formation, conseil, coaching',`.

- [ ] **Step 2: Update the manifest preconfigured properties**

In `BbiHomeWebPart.manifest.json`, replace the `"kpis"` value (line 49) with:

```json
"kpis": "1 500+ | Professionnels accompagnés\n3 | Pôles : formation, conseil, coaching\n9 | Pays couverts par le réseau\n96 % | De satisfaction constatée",
```

and replace the three empty identity properties (lines 65-67) with the proposal below. These texts are a proposal the client validates before go-live.

```json
"visionText": "Être le partenaire de référence du renforcement de capacités des dirigeants, des équipes et des organisations en Afrique et au-delà.",
"missionText": "Accompagner nos clients par la formation, le conseil et le coaching, pour transformer leurs compétences en résultats durables.",
"objectivesText": "Proposer trois pôles d'expertise complémentaires : formation, conseil et coaching\nMesurer l'impact de chaque accompagnement sur le terrain\nPartager un référentiel de qualité commun à tout le réseau\nRenforcer la présence locale dans chaque pays d'implantation",
```

(`objectivesText` is one objective per line; confirm with `grep -n "parseObjectives" -A8 src/webparts/bbiHome/components/*.ts` before relying on the separator.)

- [ ] **Step 3: Add the `Offres` list to provisioning**

In `deploy/provision-bbi-intranet.ps1`, immediately after the `Ensure-BbiView -List 'Formations' -Title 'Par filière' ...` command (the one ending with `<OrderBy><FieldRef Name="Filiere"/><FieldRef Name="Title"/></OrderBy>'`), insert:

```powershell
        # --- Offres : IOffer { Title, Pole, CodeOffre, Filiere, Format, Duree, PublicCible, Niveau, StatutCatalogue }
        Ensure-BbiList -Title 'Offres' -Template GenericList | Out-Null
        Ensure-BbiField -List 'Offres' -DisplayName 'Pôle'            -InternalName 'Pole'            -Type Choice `
            -Choices @('Formation','Conseil','Coaching')
        Ensure-BbiField -List 'Offres' -DisplayName 'Code'            -InternalName 'CodeOffre'       -Type Text
        Ensure-BbiField -List 'Offres' -DisplayName 'Filière'         -InternalName 'Filiere'         -Type Text
        Ensure-BbiField -List 'Offres' -DisplayName 'Format'          -InternalName 'Format'          -Type Choice `
            -Choices @('Présentiel','Distanciel','Hybride','Sur site client')
        Ensure-BbiField -List 'Offres' -DisplayName 'Durée'           -InternalName 'Duree'           -Type Text
        Ensure-BbiField -List 'Offres' -DisplayName 'Public cible'    -InternalName 'PublicCible'     -Type Text
        Ensure-BbiField -List 'Offres' -DisplayName 'Niveau'          -InternalName 'Niveau'          -Type Choice `
            -Choices @('Débutant','Intermédiaire','Confirmé','Expert')
        Ensure-BbiField -List 'Offres' -DisplayName 'Statut catalogue' -InternalName 'StatutCatalogue' -Type Choice `
            -Choices @('Actif','En refonte','Archivé')
        Ensure-BbiField -List 'Offres' -DisplayName 'Description'     -InternalName 'Description'     -Type Note
        Ensure-BbiField -List 'Offres' -DisplayName 'Objectifs'       -InternalName 'Objectifs'       -Type Note
        Ensure-BbiField -List 'Offres' -DisplayName 'Programme ou démarche' -InternalName 'Programme'  -Type Note
        Ensure-BbiField -List 'Offres' -DisplayName 'Prérequis'       -InternalName 'Prerequis'       -Type Note
        Ensure-BbiField -List 'Offres' -DisplayName 'Livrables'       -InternalName 'Livrables'       -Type Note
        Ensure-BbiView  -List 'Offres' -Title 'Catalogue actif' -Fields @('Title','Pole','CodeOffre','Filiere','Format','Duree','Niveau') `
            -Query '<Where><Eq><FieldRef Name="StatutCatalogue"/><Value Type="Text">Actif</Value></Eq></Where><OrderBy><FieldRef Name="Title"/></OrderBy>'
        Ensure-BbiView  -List 'Offres' -Title 'Par pôle' -Fields @('Title','Pole','CodeOffre','Filiere','Format','Duree') `
            -Query '<OrderBy><FieldRef Name="Pole"/><FieldRef Name="Title"/></OrderBy>'
```

The block lives inside `Invoke-BbiSiteProvisioning`, which `-ProvisionFiliales` also runs for each filiale, so filiales get the list too.

- [ ] **Step 4: Update the web part properties in provisioning**

In the `$homeProps` hashtable, make these changes:

- after `formationsListTitle   = 'Formations'` add the line `offersListTitle       = 'Offres'`
- `heroTitle` → `"Renforcer les capacités de vos équipes et de vos organisations."`
- `heroSubtitle` → `"Formation, conseil et coaching pour transformer vos ambitions en résultats durables."`
- in `heroSlides`, replace the first slide segment `L'expertise qui fait grandir les dirigeants. | Formations, accompagnement et intelligence collective pour transformer vos ambitions en résultats durables. | Explorer les formations | #formations` with `Renforcer les capacités de vos équipes et de vos organisations. | Formation, conseil et coaching pour transformer vos ambitions en résultats durables. | Découvrir nos offres | #offres`
- `primaryCtaLabel` → `'Découvrir nos offres'`, `primaryCtaUrl` → `'#offres'`
- `navLinks` → `"# Accueil | #accueil`n# Nos offres | #offres`n# Sessions & missions | #sessions`n# Actualités | #actualites`n# Ressources | #ressources`n# Communauté | #communaute"`
- in `quickLinks`, replace `▦ | Catalogue des formations | Parcours, modalités et durées | #formations` with `▦ | Nos offres | Formation, conseil et coaching | #offres`
- `kpis` → `"1 500+ | Professionnels accompagnés`n3 | Pôles : formation, conseil, coaching`n9 | Pays couverts par le réseau`n96 % | De satisfaction constatée"`
- add, before the closing `} | ConvertTo-Json -Compress`, the three identity properties with the same texts as Step 2:
  ```powershell
              visionText            = "Être le partenaire de référence du renforcement de capacités des dirigeants, des équipes et des organisations en Afrique et au-delà."
              missionText           = "Accompagner nos clients par la formation, le conseil et le coaching, pour transformer leurs compétences en résultats durables."
              objectivesText        = "Proposer trois pôles d'expertise complémentaires : formation, conseil et coaching`nMesurer l'impact de chaque accompagnement sur le terrain`nPartager un référentiel de qualité commun à tout le réseau`nRenforcer la présence locale dans chaque pays d'implantation"
  ```

- [ ] **Step 5: Seed demo offers under `-SeedDemoData`**

In the `if ($SeedDemoData -and -not $DryRun -and -not $VerifyOnly) {` block, directly before the line `    # Actualités`, insert:

```powershell
    # Offres (formation, conseil, coaching)
    if ((Get-PnPListItem -List 'Offres' -PageSize 1).Count -eq 0) {
        Invoke-Bbi "Insertion des offres d'exemple" {
            $offres = @(
                @{ Title = "Management d'équipe"; Pole = 'Formation'; CodeOffre = 'BBI-FOR-101'; Filiere = 'Management'; Format = 'Présentiel'; Duree = '2 jours'; Niveau = 'Confirmé'; PublicCible = 'Managers de proximité' },
                @{ Title = 'Vendre la valeur, pas le prix'; Pole = 'Formation'; CodeOffre = 'BBI-FOR-110'; Filiere = 'Commerce'; Format = 'Présentiel'; Duree = '1 jour'; Niveau = 'Débutant'; PublicCible = 'Équipes commerciales' },
                @{ Title = 'Prospection digitale'; Pole = 'Formation'; CodeOffre = 'BBI-FOR-140'; Filiere = 'Digital'; Format = 'Distanciel'; Duree = '½ journée'; Niveau = 'Débutant'; PublicCible = 'Commerciaux et indépendants' },
                @{ Title = 'Fondamentaux Qualiopi'; Pole = 'Formation'; CodeOffre = 'BBI-FOR-301'; Filiere = 'Qualité & Certification'; Format = 'Distanciel'; Duree = '1 jour'; Niveau = 'Intermédiaire'; PublicCible = 'Responsables qualité' },
                @{ Title = 'Leadership & gestion du changement'; Pole = 'Formation'; CodeOffre = 'BBI-FOR-210'; Filiere = 'Management'; Format = 'Hybride'; Duree = '3 jours'; Niveau = 'Confirmé'; PublicCible = 'Cadres dirigeants' },
                @{ Title = 'Diagnostic organisationnel'; Pole = 'Conseil'; CodeOffre = 'BBI-CON-101'; Filiere = 'Organisation'; Format = 'Sur site client'; Duree = '3 à 6 semaines'; Niveau = 'Confirmé'; PublicCible = 'Directions générales' },
                @{ Title = "Structuration d'un dispositif de formation"; Pole = 'Conseil'; CodeOffre = 'BBI-CON-120'; Filiere = 'Ingénierie de formation'; Format = 'Hybride'; Duree = '2 à 4 mois'; Niveau = 'Confirmé'; PublicCible = 'Organismes et directions RH' },
                @{ Title = 'Accompagnement au changement'; Pole = 'Conseil'; CodeOffre = 'BBI-CON-210'; Filiere = 'Organisation'; Format = 'Sur site client'; Duree = '3 à 9 mois'; Niveau = 'Expert'; PublicCible = 'Comités de direction' },
                @{ Title = 'Mise en conformité qualité (Qualiopi, ISO 21001)'; Pole = 'Conseil'; CodeOffre = 'BBI-CON-301'; Filiere = 'Qualité & Certification'; Format = 'Hybride'; Duree = '6 à 10 semaines'; Niveau = 'Confirmé'; PublicCible = 'Organismes de formation' },
                @{ Title = 'Coaching de dirigeants'; Pole = 'Coaching'; CodeOffre = 'BBI-COA-101'; Filiere = 'Leadership'; Format = 'Hybride'; Duree = '6 mois'; Niveau = 'Expert'; PublicCible = 'Dirigeants et cadres supérieurs' },
                @{ Title = "Coaching d'équipe"; Pole = 'Coaching'; CodeOffre = 'BBI-COA-120'; Filiere = 'Management'; Format = 'Présentiel'; Duree = '4 mois'; Niveau = 'Confirmé'; PublicCible = 'Équipes de direction' },
                @{ Title = "Cycle d'accompagnement d'entrepreneurs"; Pole = 'Coaching'; CodeOffre = 'BBI-COA-201'; Filiere = 'Entrepreneuriat'; Format = 'Hybride'; Duree = '6 mois'; Niveau = 'Intermédiaire'; PublicCible = 'Porteurs de projet' }
            )
            foreach ($offre in $offres) {
                $offre['StatutCatalogue'] = 'Actif'
                Add-PnPListItem -List 'Offres' -Values $offre | Out-Null
            }
        } | Out-Null
    }

```

- [ ] **Step 6: Validate the PowerShell script syntax and dry run**

Run (PowerShell, from `deploy/`):

```powershell
$errors = $null; [System.Management.Automation.Language.Parser]::ParseFile("$PWD\provision-bbi-intranet.ps1", [ref]$null, [ref]$errors) | Out-Null; $errors.Count
```

Expected: `0`.

Run: `.\provision-bbi-intranet.ps1 -DryRun`
Expected: the `Offres` list and its columns appear in the simulated steps; no parse or runtime error. (This needs the tenant connection details the script already asks for; if it cannot connect offline, the syntax check above is the gate and the dry run is deferred to Task 5.)

- [ ] **Step 7: Update the documentation**

`deploy/README.md`:
- line 23: replace `` `Formations`, `Supports publiés`, `Documents administratifs`, `Galerie médias`. `` with `` `Formations` (catalogue autonome historique), `Offres`, `Supports publiés`, `Documents administratifs`, `Galerie médias`. ``
- line 49: replace `` | Formations | `Formations` | Catalogue filtrable | Publier une formation (`Statut catalogue = Actif`) | `` with `` | Nos offres | `Offres` | Catalogue filtrable par pôle (Formation, Conseil, Coaching) puis par filière | Publier une offre (`Pôle`, `Statut catalogue = Actif`) | ``
- line 241: replace `` | Formations | `#formations` | `` with `` | Nos offres | `#offres` ou `#offres?pole=conseil` (`#formations` reste valide) | ``
- add a short schema table for `Offres` (the 14 columns from the spec, section 4) in the section that lists list schemas.

`CLAUDE.md` (repo root): in "Required SharePoint schema", replace `` `Formations`, document libraries `` with `` `Formations` (legacy standalone catalogue only), `Offres` (the portal's catalogue: columns `Pole` Formation/Conseil/Coaching, `CodeOffre`, `Filiere`, `Format`, `Duree` free text, `PublicCible`, `Niveau`, `StatutCatalogue`, `Livrables`; rows without `Pole` count as Formation), document libraries ``. In "Key architectural fact", add one sentence: the Formations view is now "Nos offres" (hash `#offres`, internal view id still `formations`) with a pole filter driven by `#offres?pole=conseil|formation|coaching`.

- [ ] **Step 8: Build and verify**

Run: `npx heft build && node tools/verify-fallback.js`
Expected: 0 TypeScript errors, `0 échec(s)`.

- [ ] **Step 9: Commit**

```bash
git add src/webparts/bbiHome/BbiHomeWebPart.ts src/webparts/bbiHome/BbiHomeWebPart.manifest.json deploy/provision-bbi-intranet.ps1 deploy/README.md CLAUDE.md
git commit -m "feat(deploy): liste Offres, textes recentrés sur le renforcement de capacités et documentation

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Verification, package 1.9.0.0 and rollout notes

**Files:**
- Modify: `config/package-solution.json` (version, feature version)
- Modify: `deliverables/spfx/bbi-portail.sppkg` (rebuilt copy)
- Modify: documented check count in `CLAUDE.md`, `deploy/README.md`, `bbi-intranet/README.md` if present

**Interfaces:**
- Consumes: everything from Tasks 1-4.
- Produces: a deployable `bbi-portail.sppkg` v1.9.0.0 and a verified upgrade procedure.

- [ ] **Step 1: Bump the version**

In `config/package-solution.json`, set both `solution.version` and `solution.features[0].version` to `"1.9.0.0"`. Leave `shortDescription` under 255 characters (it is 148).

- [ ] **Step 2: Run every harness**

```bash
npx heft build
node tools/verify-fallback.js
node tools/css-harness.js dist
node tools/preview-smoke.js
```

Expected: zero TypeScript errors; `verify-fallback` reports `0 échec(s)`; `css-harness` reports the styles injected with no failures; `preview-smoke` passes its 34 journey checks. `preview-smoke` exercises the static HTML preview, which this plan does not change.

If `css-harness` has a list of expected class names, add the new ones (`pillars`, `pillarCard`, `poleChips`, `badge`) to it, following the existing entries, then rerun.

- [ ] **Step 3: Update the documented check count**

Take the total printed by `verify-fallback` (the new N from Task 1 Step 4) and replace `183` in `CLAUDE.md` (two occurrences: the verification commands list and the description) and in `deploy/README.md` line 61 with N.

- [ ] **Step 4: Production build and package check**

```bash
npm run build
cp sharepoint/solution/bbi-portail.sppkg ../deliverables/spfx/bbi-portail.sppkg
node tools/verify-package.js
```

Expected: build finishes with exit code 0; `verify-package` ends with `Package cohérent` and `0 erreur(s)`; `AppManifest.xml : solution « bbi-portail-client-side-solution » v1.9.0.0`; no script path contains a folder.

- [ ] **Step 5: Visual check in the workbench**

Run `npm run start`, open `https://localhost:4321/` once to accept the certificate, then open the tenant workbench URL from `CLAUDE.md`. Verify, with the `Offres` list absent (demo data):

1. The navigation shows "Nos offres" and "Sessions & missions".
2. The home view shows the three-pillar strip under the hero and a six-card preview (two per pole).
3. Clicking the "Conseil" pillar opens the catalogue with the Conseil chip active and four cards.
4. Clicking "Nos offres" in the nav shows all twelve cards and "Tous les pôles" active.
5. `#formations` typed in the address bar still opens the catalogue.
6. The navigation bar stays navy.

Expected: all six hold. Report any that fail with a screenshot description.

- [ ] **Step 6: Commit and roll out**

```bash
git add config/package-solution.json deliverables/spfx/bbi-portail.sppkg CLAUDE.md deploy/README.md
git commit -m "build: paquet 1.9.0.0 (offres formation, conseil, coaching)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Rollout (tenant, done by the user or the provisioning operator, not part of the automated build):

1. Upload `deliverables/spfx/bbi-portail.sppkg` to the App Catalog as an **Upgrade**; confirm the catalog shows version 1.9.0.0, Enabled and Deployed.
2. Create the list and seed demo offers: `cd deploy; .\provision-bbi-intranet.ps1 -SeedDemoData`. Existing lists and items are left alone.
3. **Existing pages keep their saved web part properties** (old navigation labels, hero texts, key figures). To apply the new wording either re-run provisioning without `-PreserveWebPart` (it rewrites the web part with the new properties) or edit the navigation links, hero slides and key figures in the web part pane.
4. For each filiale, run `.\provision-bbi-intranet.ps1 -ProvisionFiliales -Filiale <Nom>` so the filiale gets its own `Offres` list.
5. Hard-refresh the page (Ctrl+F5).

---

## Self-review notes

- **Spec coverage:** navigation and `#offres` alias (Tasks 1, 3); `?pole=` routing (Tasks 1, 3); `Offres` schema and rules (Tasks 1, 4); `OffersCatalog`, pole chips, filière filter, search, compact mode (Task 2); three-pillar strip (Tasks 2, 3); default texts, KPIs, vision, mission, objectives, quick links (Tasks 3, 4); demo content of twelve offers (Tasks 1, 4); provisioning, seeding, docs (Task 4); verification and version 1.9.0.0 (Task 5). The spec's rebalanced demo news and sessions in `homeData.ts` is the one item deliberately left for a follow-up: those lists are read from SharePoint, and rewriting 1,700 lines of demo data is a content task the client should review. It is flagged in the hand-off message.
- **Spec open points resolved by reading the code:** cards of the old catalogue are plain articles with no link (no detail page needed); global search does not index the catalogue (no change needed).
- **Type consistency:** `OfferPole`, `IOffer`, `loadOffers`, `previewOffers`, `poleFromHash`, `IOffersCatalogProps` (`pole`, `onPoleChange`) and `IPillarsStripProps.onNavigate` are defined in Tasks 1-2 and used with identical names in Task 3.
