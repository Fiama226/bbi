# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

This repo delivers a SharePoint Online intranet for **Business Builders International (BBI)**, a professional training organization. There are two layers:

- `bbi-intranet/` — the actual SPFx (SharePoint Framework) source project, 1.22.2, TypeScript 5.8, React 17. This is where almost all code work happens.
- `deliverables/` — static HTML design deliverables (audit, mockups, theme JSON) and the installable package `deliverables/spfx/bbi-portail.sppkg`. These are generated/handwritten design artifacts, not build output — don't regenerate them casually.
- `deploy/provision-bbi-intranet.ps1` and `teams/New-BbiTeamsPackage.ps1` — PowerShell provisioning scripts that read tenant/site config from `bbi-environnement.json` (single source of truth: tenant `businessbuilderinter.sharepoint.com`, site `/sites/intranet`).

All substantive commands below are run from `bbi-intranet/` unless noted.

## Key architectural fact: one web part does almost everything

Although the solution manifest declares 7 web parts + 1 extension, **production only needs one**: `BBI Accueil — portail unifié` (`src/webparts/bbiHome`). It's a single-page-app-style web part with internal view routing (Accueil, Formations, Sessions, Actualités, Ressources, Communauté) that switches views without leaving the SharePoint page or reloading. The other web parts (`trainingCatalog`, `bbiGallery`, `secureDocuments`, `ficheFormation`, `sessionsInscription`, `articleActualite`) are legacy/standalone bricks kept in the package for backward compatibility; their functionality has been folded into `bbiHome`'s views. When making feature changes, check whether the real target is `bbiHome` before touching the standalone web parts.

The Accueil view now also carries several client-requested blocks beyond the original hero/news/sessions layout: Vision/Mission/Objectifs (identity), a rotating Annonces banner, Pensée du jour + Anniversaires (inside "vie de l'équipe"), Implantations (siège/filiales), Nos références (client logos), and Références pédagogiques (under Formations). Communauté is its own dedicated section — a staff Trombinoscope with category filter chips — not an alias of Ressources. Sessions carries a calendar-grid view (`SessionsCalendar.tsx` / `sessionsCalendarGrid.ts`) alongside the original text list, both reading the same `Sessions` data.

The siège Accueil also renders `SiteNetwork` (site cards read from `Implantations`, columns `SiteUrl`/`Couleur`/`Initiales`) and `LinkDirectory` (icon + label tiles fed by `linkDirectoryData.ts`, used for Documents administratifs and Références pédagogiques). The same web part runs on every filiale site: `-ProvisionFiliales` turns the intranet into a hub and creates one team site per non-siège `Implantations` row.

The Formations view is now "Nos offres" (hash `#offres`, internal view id still `formations`) with a pole filter driven by `#offres?pole=conseil|formation|coaching`.

Routing lives in `src/webparts/bbiHome/components/portalRoutes.ts` + `homeLayout.ts` as pure functions (hash → view, e.g. `#actualite?id=12`), deliberately testable without a browser — see `tools/verify-fallback.js`.

## Fallback-data pattern (important, pervasive)

Every data-driven component tolerates three states for its SharePoint source: **list/library absent (404), list created but empty, and list populated**. In all three cases the page renders complete, realistic content — never an empty or error screen:
- Missing/empty source → built-in demo data (e.g. `homeData.ts`, `galleryData.ts`, `sessionsData.ts`, `articleData.ts`, `ficheData.ts`) with embedded demo images under each web part's `assets/`.
- A `showDataNotices` property pane toggle (default `false`) controls whether a banner explains that demo data is in use.
- When adding a new data source or component, follow this same three-state contract and add corresponding checks to `tools/verify-fallback.js`.

REST calls to SharePoint lists go through `src/shared/sharePointRest.ts` (`listApiUrl`, OData literal escaping) — always use these helpers rather than hand-building `_api/web/lists/...` URLs, to keep OData escaping centralized. `src/shared/safeUrl.ts` sanitizes hrefs/image URLs before rendering (XSS-sensitive user-/editor-supplied content from lists goes through this plus `dompurify`).

## Build / dev / verification commands (run inside `bbi-intranet/`)

```bash
npm install
npm run start                      # heft start --clean: dev/debug server on https://localhost:4321
npm run build                      # heft clean && heft build --production && heft package-solution --production
npm run clean                      # heft clean
npm run eject-webpack              # already ejected; webpack.dev.config.js is authoritative, not config/serve.json
npm run verify-package             # node tools/verify-package.js — checks sppkg manifest/bundle consistency
```

There is **no local workbench** (removed since SPFx 1.20+/Heft). Testing is always against the **tenant-hosted workbench**:
```
https://businessbuilderinter.sharepoint.com/_layouts/15/workbench.aspx?debug=true&noredir=true&debugManifestsFile=https://localhost:4321/temp/manifests.js
```
You must open `https://localhost:4321/` once first and accept the self-signed dev certificate, or the web part fails to load with a generic "Script error".

### Docker dev loop
```bash
cp .env.example .env               # set SPFX_TENANT_DOMAIN
docker compose up --build -d
docker compose logs -f             # wait for "Started Webpack Dev Server"
docker compose exec spfx bash      # run commands inside the container
docker compose down
```

### Non-Docker dev
```bash
SPFX_SERVE_TENANT_DOMAIN=monTenant.sharepoint.com npm run start
```
Requires Node >= 22.14 (`engines` in package.json).

### Verification scripts (run before any delivery/package change)
```bash
npx heft build
node tools/verify-fallback.js      # 211 checks: data layers run against a simulated SharePoint client for each of the 3 source states (absent/empty/populated) — no network needed
node tools/css-harness.js dist     # confirms styles/classes are actually injected (KPI band outside clipped hero area, pagination, nav, site cards, link directories, nav bar permanently navy — never transparent)
node tools/preview-smoke.js        # 34 journey checks against deliverables/audit-2026/apercu-portail.html
node tools/verify-package.js       # validates deliverables/spfx/bbi-portail.sppkg manifest-vs-bundle consistency
node tools/verify-package.js --dev # same, but against temp/manifests.js + dist/ (debug path)
npm run build                      # full production rebuild -> sharepoint/solution/bbi-portail.sppkg
```
After `npm run build`, copy the resulting `.sppkg` to `deliverables/spfx/` and re-upload as an **Upgrade** in the SharePoint App Catalog — don't forget to confirm the catalog shows **Deployed**, not just *Validated*/*Installed*.

There is no unit test runner configured beyond the Heft Jest plugin scaffolding (`@rushstack/heft-jest-plugin` is a devDependency but no `test` script exists and no `*.test.ts` files were found) — correctness is validated via the `tools/*.js` harnesses above, which transpile and exercise the real data-layer code against simulated SharePoint responses.

## Debugging "Script error" on web part load

This is a recurring, well-documented failure mode (see `bbi-intranet/README.md` §3bis). It always means the browser couldn't fetch the JS bundle referenced by the manifest, not a code error. Diagnose via Network tab (F12) for the failing request, then match against:
- `localhost:4321/dist/...` request → dev server not running or cert not accepted.
- same but with a **stale hash** → webpack recompiled; reload the workbench page (F5).
- `ClientSideAssets/...` on tenant → solution installed but not Deployed in App Catalog.
- tenant URL 404 → stale cache after an Upgrade; wait and clear cache, or re-upload as Upgrade.
- `(blocked:mixed-content)` / `ERR_CERT_*` → protocol/cert mismatch between HTTPS page and dev server.

`npm run build` cleans `release/` before compiling specifically to prevent orphaned old bundles from accumulating in `release/assets` and getting embedded in the `.sppkg` without a manifest reference — don't skip the clean step when rebuilding.

## Required SharePoint schema (for real, non-demo data)

Lists/libraries the `bbiHome` web part expects, with exact internal column names (see `deploy/README.md` for the full table generated by the provisioning script): `Actualites`, `Sessions`, `Formateurs` (now with `Categorie`/`Ordre` for the Trombinoscope filter), `Formations` (legacy standalone catalogue only), `Offres` (the portal's catalogue: columns `Pole` Formation/Conseil/Coaching, `CodeOffre`, `Filiere`, `Format`, `Duree` free text, `PublicCible`, `Niveau`, `StatutCatalogue`, `Livrables`; rows without `Pole` count as Formation), document libraries `Supports publiés` and `Documents administratifs`, `Employés du mois`, `Certifications`, `Annonces`, `Pensées du jour`, `Anniversaires`, `Implantations` (now with SiteUrl/Couleur/Initiales for the site cards), `Nos références`, and `Références pédagogiques`. Column names must be entered without spaces so SharePoint's internal name matches what the REST layer queries (several lists use `Ordre`, deliberately not `Order`, which is a reserved/ambiguous OData token).

## Provisioning and environment config

`bbi-environnement.json` (repo root) is the single source of truth for tenant/site URLs; both `deploy/provision-bbi-intranet.ps1` and `teams/New-BbiTeamsPackage.ps1` read from it — don't hardcode tenant URLs elsewhere.
```powershell
cd deploy
.\provision-bbi-intranet.ps1 -DryRun        # simulate
.\provision-bbi-intranet.ps1 -SeedDemoData  # install lists/libraries/home page + demo data
.\provision-bbi-intranet.ps1 -ProvisionFiliales  # hub + one team site per filiale (needs SharePoint admin role)
.\provision-bbi-intranet.ps1 -VerifyOnly    # audit existing provisioning
.\provision-bbi-intranet.ps1 -ProvisionFiliales -Filiale Abidjan   # une seule filiale
```
