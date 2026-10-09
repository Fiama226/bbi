---
name: verify-before-ship
description: Run the full pre-delivery verification suite for the bbi-intranet SPFx solution (fallback-data checks, CSS harness, preview smoke tests, package integrity). Use before packaging a release, before upgrading the App Catalog, or when asked to verify/validate the build.
---

# Verify before ship

Run these steps in order from `bbi-intranet/`, stopping at the first failure (later steps assume earlier artifacts are valid — e.g. step 6 needs step 5's freshly rebuilt `.sppkg`):

1. `npx heft build` — compiles and type-checks.
2. `node tools/verify-fallback.js` — 100 checks that every data layer handles absent/empty/populated SharePoint sources correctly (no network needed).
3. `node tools/css-harness.js dist` — confirms compiled styles are actually injected (KPI band outside the clipped hero area, pagination, nav).
4. `node tools/preview-smoke.js` — 34 journey checks against `deliverables/audit-2026/apercu-portail.html`.
5. `npm run build` — full production rebuild (`heft clean && heft build --production && heft package-solution --production`), produces `sharepoint/solution/bbi-portail.sppkg`.
6. `node tools/verify-package.js` — validates the rebuilt `.sppkg`'s manifest-vs-bundle consistency.

If all six steps pass, remind the user to:
- Copy the new `.sppkg` to `deliverables/spfx/`.
- Re-upload it as an **Upgrade** in the SharePoint App Catalog.
- Confirm the catalog shows the solution as **Deployed** (not just *Validated*/*Installed*) before considering the release done.

Report which step failed and its exact output — don't paraphrase verification failures, they're the whole point of running this.
