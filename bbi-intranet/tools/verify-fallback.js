/**
 * BBI — harnais de vérification des contenus de repli.
 *
 * Objectif : garantir qu'aucune page n'est vide, que la source SharePoint soit
 * absente (404), non créée, ou créée mais vide.
 *
 * Exécution :  node tools/verify-fallback.js   (depuis bbi-intranet/)
 *
 * Le script transpile les modules TypeScript réels avec la version de TypeScript
 * du projet, puis les exécute avec un client SharePoint simulé. Aucun accès réseau.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

let passed = 0;
let failed = 0;

function check(label, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

/** Charge un module TS du projet en CommonJS, avec des dépendances simulées. */
function loadTsModule(relativePath) {
  const file = path.join(__dirname, '..', relativePath);
  const source = fs.readFileSync(file, 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2018,
      esModuleInterop: true
    },
    fileName: file
  }).outputText;

  const module = { exports: {} };
  const localRequire = (request) => {
    if (request === '@microsoft/sp-http') {
      return { SPHttpClient: { configurations: { v1: 1 } } };
    }
    if (request === '@microsoft/sp-component-base') {
      return {};
    }
    // Types et modules non exécutés dans ce harnais.
    return {};
  };
  new Function('require', 'exports', 'module', js)(localRequire, module.exports, module);
  return module.exports;
}

/**
 * Client SharePoint simulé.
 * @param {Array<{match: RegExp, ok?: boolean, status?: number, json?: any}>} routes
 */
function fakeClient(routes) {
  return {
    get: async (url) => {
      const route = routes.filter((r) => r.match.test(url))[0];
      if (!route) {
        return { ok: false, status: 404, json: async () => ({}) };
      }
      return {
        ok: route.ok !== false,
        status: route.status || 200,
        json: async () => route.json || { value: [] }
      };
    }
  };
}

const SITE = 'https://tenant.sharepoint.com/sites/intranet';

/* ------------------------------------------------------------------ */
/* 1. Galerie média                                                    */
/* ------------------------------------------------------------------ */
async function testGallery() {
  console.log('\nGalerie média (BBI Galerie médias)');
  const { loadGallery, isDemoItem, thumbUrlOf } = loadTsModule(
    'src/webparts/bbiGallery/components/galleryData.ts'
  );

  // (a) bibliothèque non créée → 404 sur /fields
  const missing = await loadGallery(
    fakeClient([{ match: /fields/, ok: false, status: 404 }]),
    SITE,
    'Galerie médias',
    24,
    ''
  );
  check('bibliothèque absente → contenu de repli', missing.items.length >= 6, `${missing.items.length} éléments`);
  check('bibliothèque absente → état « demo »', missing.state === 'demo' && missing.isDemo === true);
  check('repli → 4 albums distincts', new Set(missing.items.map((i) => i.Album)).size === 4);
  check('repli → visuels embarqués (pas de fichier à charger)', missing.items.every(isDemoItem));
  check('repli → aucune vignette SharePoint appelée', missing.items.every((i) => thumbUrlOf(i, 800) === ''));

  // (b) bibliothèque créée mais vide
  const empty = await loadGallery(
    fakeClient([
      { match: /fields/, json: { value: [{ InternalName: 'Album' }, { InternalName: 'Lieu' }] } },
      { match: /items/, json: { value: [] } }
    ]),
    SITE,
    'Galerie médias',
    24,
    ''
  );
  check('bibliothèque vide → contenu de repli', empty.items.length >= 6 && empty.state === 'demo');

  // (c) bibliothèque alimentée
  const live = await loadGallery(
    fakeClient([
      { match: /fields/, json: { value: [{ InternalName: 'Album' }, { InternalName: 'Lieu' }] } },
      {
        match: /items/,
        json: {
          value: [
            { Id: 7, Title: 'Séminaire BBI', FileRef: '/sites/intranet/Galerie/photo-1.jpg', FileLeafRef: 'photo-1.jpg', File_x0020_Type: 'jpg', Album: 'Vie BBI', Created: '2026-09-01T10:00:00Z' },
            { Id: 8, Title: 'Atelier', FileRef: '/sites/intranet/Galerie/photo-2.png', FileLeafRef: 'photo-2.png', File_x0020_Type: 'png', Album: 'Sessions de formation', Created: '2026-09-02T10:00:00Z' },
            { Id: 9, Title: 'Notes de réunion', FileRef: '/sites/intranet/Galerie/notes.docx', FileLeafRef: 'notes.docx', File_x0020_Type: 'docx' }
          ]
        }
      }
    ]),
    SITE,
    'Galerie médias',
    24,
    ''
  );
  check('bibliothèque alimentée → état « live »', live.state === 'live' && live.isDemo === false);
  check('fichiers non image filtrés', live.items.length === 2, `${live.items.length} éléments`);
  check('vignettes générées par SharePoint', thumbUrlOf(live.items[0], 800).indexOf('?width=800') !== -1);
}

/* ------------------------------------------------------------------ */
/* 2. Accueil (actualités, sessions, formateurs)                       */
/* ------------------------------------------------------------------ */
async function testHome() {
  console.log('\nAccueil (BBI Accueil plein écran)');
  const { loadHomeNews, loadHomeSessions, loadHomeTrainers } = loadTsModule(
    'src/webparts/bbiHome/components/homeData.ts'
  );

  const missing = fakeClient([{ match: /items/, ok: false, status: 404 }]);
  for (const [label, loader] of [
    ['actualités', loadHomeNews],
    ['sessions', loadHomeSessions],
    ['formateurs', loadHomeTrainers]
  ]) {
    const result = await loader(missing, SITE, 'X', 5);
    check(`${label} — liste absente → repli`, result.items.length > 0 && result.isDemo === true);
  }

  const empty = fakeClient([{ match: /items/, json: { value: [] } }]);
  const news = await loadHomeNews(empty, SITE, 'Actualites', 5);
  check('actualités — liste vide → repli', news.items.length > 0 && news.isDemo === true);
  check('actualités — images/URL définies', typeof news.items[0].Title === 'string' && news.items[0].Title.length > 5);

  const sessionsEmpty = await loadHomeSessions(empty, SITE, 'Sessions', 5);
  check('sessions — liste vide → repli daté', sessionsEmpty.items.every((s) => !!s.StartDate));
  check(
    'sessions — dates futures (jamais périmées)',
    sessionsEmpty.items.every((s) => new Date(s.StartDate).getTime() > Date.now())
  );

  const filled = fakeClient([
    {
      match: /items/,
      json: {
        value: [{
          Id: 1,
          Title: 'Vraie actualité',
          Published: '2026-09-20T09:00:00Z',
          Category: 'Vie BBI',
          ImageUrl: { Url: '/sites/intranet/SiteAssets/news.jpg', Description: 'Visuel' },
          LinkUrl: { Url: '/sites/intranet/SitePages/article.aspx?itemid=1', Description: 'Lire' }
        }]
      }
    }
  ]);
  const liveNews = await loadHomeNews(filled, SITE, 'Actualites', 5);
  check('actualités — liste alimentée → données réelles', liveNews.isDemo === false && liveNews.items[0].Title === 'Vraie actualité');
  check(
    'actualités — liens Hyperlink SharePoint normalisés',
    liveNews.items[0].ImageUrl === '/sites/intranet/SiteAssets/news.jpg' &&
      liveNews.items[0].LinkUrl === '/sites/intranet/SitePages/article.aspx?itemid=1'
  );
  check(
    'actualités — URL de visuel résolue sans erreur',
    new URL(liveNews.items[0].ImageUrl, SITE).toString() ===
      'https://tenant.sharepoint.com/sites/intranet/SiteAssets/news.jpg'
  );
}

/* ------------------------------------------------------------------ */
/* 3. Planning des sessions                                            */
/* ------------------------------------------------------------------ */
async function testSessions() {
  console.log('\nSessions & inscriptions');
  const { loadSessions, codeFromTitle } = loadTsModule(
    'src/webparts/sessionsInscription/components/sessionsData.ts'
  );

  check('extraction du code formation depuis le titre', codeFromTitle("Management d'équipe — Cohorte 7 — BBI-MGT-101") === 'BBI-MGT-101');

  const missing = await loadSessions(fakeClient([{ match: /items/, ok: false, status: 404 }]), SITE, 'Sessions', 'Formations', 30, false);
  check('liste absente → planning de repli', missing.items.length >= 5 && missing.isDemo === true);
  check('repli → codes formation présents', missing.items.every((s) => !!s.CodeFormation));
  check('repli → filières renseignées', missing.items.every((s) => !!s.Filiere));

  const live = await loadSessions(
    fakeClient([
      { match: /Sessions/, json: { value: [{ Id: 4, Title: 'Atelier — BBI-COM-110', StartDate: '2099-01-10T09:00:00Z', Modality: 'Présentiel', Location: 'Lyon', Status: 'Ouvert' }] } },
      { match: /Formations/, json: { value: [{ CodeFormation: 'BBI-COM-110', Filiere: 'Commerce' }] } }
    ]),
    SITE,
    'Sessions',
    'Formations',
    30,
    false
  );
  check('liste alimentée → session réelle', live.isDemo === false && live.items.length === 1);
  check('filière résolue via la liste Formations', live.items[0].Filiere === 'Commerce');

  const empty = await loadSessions(fakeClient([{ match: /items/, json: { value: [] } }]), SITE, 'Sessions', 'Formations', 30, false);
  check('liste vide → planning de repli', empty.items.length >= 5 && empty.isDemo === true);
}

/* ------------------------------------------------------------------ */
/* 4. Fiche formation                                                  */
/* ------------------------------------------------------------------ */
async function testFiche() {
  console.log('\nFiche formation');
  const { loadFicheFormation } = loadTsModule('src/webparts/ficheFormation/components/ficheData.ts');

  const missing = await loadFicheFormation(fakeClient([{ match: /fields/, ok: false, status: 404 }]), SITE, 'Formations', 'Sessions', 'Supports publiés', 'Formateurs', 'BBI-MGT-101', { sessions: true, documents: true, trainer: true });
  check('liste absente → fiche de repli complète', !!missing.formation && missing.isDemo === true);
  check('repli → objectifs, programme et prérequis renseignés', !!missing.formation.Objectifs && !!missing.formation.Programme && !!missing.formation.Prerequis);
  check('repli → sessions à venir datées', missing.sessions.length >= 2 && missing.sessions.every((s) => !!s.StartDate));
  check('repli → supports publiés présents', missing.documents.length >= 3);
  check('repli → formateur référent présent', missing.trainers.length >= 1);

  const notFound = await loadFicheFormation(
    fakeClient([
      { match: /fields/, json: { value: [] } },
      { match: /Formations/, json: { value: [] } }
    ]),
    SITE, 'Formations', 'Sessions', 'Supports publiés', 'Formateurs', 'BBI-XXX-999', { sessions: true, documents: true, trainer: true }
  );
  check('code inconnu → fiche de repli (pas de page vide)', !!notFound.formation && notFound.isDemo === true);

  const live = await loadFicheFormation(
    fakeClient([
      { match: /fields/, json: { value: [{ InternalName: 'CodeFormation' }, { InternalName: 'Objectifs' }, { InternalName: 'Filiere' }] } },
      { match: /Formations/, json: { value: [{ Id: 3, Title: 'Management d\'équipe', CodeFormation: 'BBI-MGT-101', Filiere: 'Management', Objectifs: 'Cadrer\nDéléguer' }] } },
      { match: /Sessions/, json: { value: [{ Id: 1, Title: 'Session — BBI-MGT-101', StartDate: '2099-03-04T09:00:00Z' }] } },
      { match: /Supports/, json: { value: [{ Id: 1, Title: 'Slides', FileRef: '/x.pptx', FileLeafRef: 'x.pptx' }] } },
      { match: /Formateurs/, json: { value: [] } }
    ]),
    SITE, 'Formations', 'Sessions', 'Supports publiés', 'Formateurs', 'BBI-MGT-101', { sessions: true, documents: true, trainer: true }
  );
  check('formation trouvée → données réelles', live.isDemo === false && live.formation.Filiere === 'Management');
  check('champ optionnel multi-lignes repris', (live.formation.Objectifs || '').indexOf('Déléguer') !== -1);
  check('sessions filtrées par code', live.sessions.length === 1 && live.sessions[0].Title.indexOf('BBI-MGT-101') !== -1);
}

/* ------------------------------------------------------------------ */
/* 5. Article d'actualité                                              */
/* ------------------------------------------------------------------ */
async function testArticle() {
  console.log("\nArticle d'actualité");
  const { loadArticle, sanitizeHtml, readingTimeOf } = loadTsModule(
    'src/webparts/articleActualite/components/articleData.ts'
  );

  const missing = await loadArticle(fakeClient([{ match: /fields/, ok: false, status: 404 }]), SITE, 'Actualites', 12, 3);
  check('liste absente → article de repli', !!missing.article && missing.isDemo === true);
  check('repli → corps de texte rédigé', (missing.article.Body || '').length > 300);
  check('repli → actualités liées proposées', missing.related.length === 3);

  const empty = await loadArticle(fakeClient([{ match: /items/, json: { value: [] } }]), SITE, 'Actualites', 12, 3);
  check('article introuvable → article de repli', !!empty.article && empty.isDemo === true);

  const live = await loadArticle(
    fakeClient([
      { match: /fields/, json: { value: [{ InternalName: 'Body' }] } },
      { match: /items\(5\)/, json: { Id: 5, Title: 'Certification réussie', Body: '<p>Texte <script>alert(1)</script><b onclick="x()">gras</b></p>' } },
      { match: /items/, json: { value: [{ Id: 5, Title: 'Certification réussie' }, { Id: 6, Title: 'Autre actualité' }] } }
    ]),
    SITE, 'Actualites', 5, 3
  );
  check('article trouvé → données réelles', live.isDemo === false && live.article.Title === 'Certification réussie');
  check('scripts retirés du HTML éditorial', sanitizeHtml('<p>a</p><script>alert(1)</script>').indexOf('<script') === -1);
  check('gestionnaires d\'événements retirés', sanitizeHtml('<b onclick="x()">a</b>').indexOf('onclick') === -1);
  check('temps de lecture calculé', readingTimeOf('', 'mot '.repeat(400)) === 2);
  check('actualité courante exclue des suggestions', live.related.every((r) => r.Id !== 5));
}

/* ------------------------------------------------------------------ */
(async () => {
  console.log('BBI — vérification des contenus de repli (production ready)');
  console.log('Aucune source SharePoint disponible : les pages doivent rester complètes.');
  await testGallery();
  await testHome();
  await testSessions();
  await testFiche();
  await testArticle();
  console.log(`\nRésultat : ${passed} vérifications réussies, ${failed} échec(s).`);
  process.exit(failed === 0 ? 0 : 1);
})();
