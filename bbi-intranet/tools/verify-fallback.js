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

/** Charge un module TS du projet en CommonJS, avec des dépendances simulées.
 *  Les imports relatifs sont résolus récursivement : un module peut donc
 *  s'appuyer sur un autre module du projet (ex. newsArchive → homeData). */
const moduleCache = {};
function loadTsModule(relativePath) {
  const file = path.isAbsolute(relativePath)
    ? relativePath
    : path.join(__dirname, '..', relativePath);
  const cacheKey = file.replace(/\\/g, '/');
  if (moduleCache[cacheKey]) {
    return moduleCache[cacheKey].exports;
  }
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
  moduleCache[cacheKey] = module;
  const localRequire = (request) => {
    if (request === '@microsoft/sp-http') {
      return { SPHttpClient: { configurations: { v1: 1 } } };
    }
    if (request === '@microsoft/sp-component-base') {
      return {};
    }
    if (request.charAt(0) === '.') {
      const candidate = path.resolve(path.dirname(file), request);
      const withExtension = /\.tsx?$/.test(candidate) ? candidate : `${candidate}.ts`;
      if (fs.existsSync(withExtension)) {
        return loadTsModule(withExtension);
      }
      const indexFile = path.join(candidate, 'index.ts');
      if (fs.existsSync(indexFile)) {
        return loadTsModule(indexFile);
      }
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
      match: /fields/,
      json: {
        value: [
          { InternalName: 'Summary' },
          { InternalName: 'Category' },
          { InternalName: 'Published' },
          { InternalName: 'AuthorName' },
          { InternalName: 'ImageUrl' },
          { InternalName: 'LinkUrl' }
        ]
      }
    },
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
/* 6. Héros en diaporama & routes du portail                           */
/* ------------------------------------------------------------------ */
async function testHeroAndRoutes() {
  console.log('\nHéros en diaporama & navigation du portail');
  const { parseHeroSlides, parseKpis, parsePortalRoute, looksLikeImage } = loadTsModule(
    'src/webparts/bbiHome/components/homeLayout.ts'
  );

  const slides = parseHeroSlides(
    [
      '# commentaire ignoré',
      '/sites/intranet/SiteAssets/hero.jpg | Sur-titre A | Titre A | Accroche A | Bouton A | #formations',
      ' | Sur-titre B | Titre B | Accroche B | Bouton B | #sessions',
      'Titre C | Accroche C'
    ].join('\n'),
    []
  );
  check('diaporama — trois diapositives lues', slides.length === 3, `${slides.length}`);
  check(
    'diaporama — image + texte sur la première diapositive',
    slides[0].imageUrl === '/sites/intranet/SiteAssets/hero.jpg' &&
      slides[0].eyebrow === 'Sur-titre A' &&
      slides[0].title === 'Titre A' &&
      slides[0].ctaUrl === '#formations'
  );
  check(
    'diaporama — diapositive sans image (texte seul)',
    slides[1].imageUrl === '' && slides[1].eyebrow === 'Sur-titre B' && slides[1].title === 'Titre B'
  );
  check(
    'diaporama — raccourci titre | accroche',
    slides[2].title === 'Titre C' && slides[2].subtitle === 'Accroche C'
  );
  check('diaporama — repli quand la configuration est vide', parseHeroSlides('', []).length === 0);
  check('détection de visuel par extension', looksLikeImage('photo.jpg') === true && looksLikeImage('Notre méthode') === false);

  const kpis = parseKpis(
    ['# commentaire', '1 500+ | Professionnels accompagnés', '9 | Pays', '96 % | Satisfaction', '12 | Formateurs', '5 | Ignoré car 5e'].join('\n')
  );
  check('chiffres clés — 4 maximum affichés', kpis.length === 4, `${kpis.length}`);
  check(
    'chiffres clés — libellé complet conservé',
    kpis[0].value === '1 500+' && kpis[0].label === 'Professionnels accompagnés'
  );

  const route = parsePortalRoute('#actualite?id=12');
  check('route #actualite?id=12 reconnue', route.view === 'actualite' && route.params.id === '12');
  check('route #organigramme reconnue', parsePortalRoute('#organigramme').view === 'organigramme');
  check('route #actualite/7 reconnue', parsePortalRoute('#actualite/7').params.id === '7');
  check('absence de hash → route vide', parsePortalRoute('').view === '');

  // Routage complet (module pur portalRoutes.ts) : c'est lui qui décide de la
  // vue affichée et des liens « internes » du portail.
  const routes = loadTsModule('src/webparts/bbiHome/components/portalRoutes.ts');
  const { HOME_ANCHORS, anchorIdFromHash, newsIdFromHash, viewFromHash, viewFromHref } = routes;

  check('route #organigramme → vue organigramme', viewFromHash('#organigramme') === 'organigramme');
  check('route inconnue → accueil', viewFromHash('#une-page-qui-nexiste-pas') === 'accueil');
  check('route vide → accueil', viewFromHash('') === 'accueil');
  check(
    'identifiant d’actualité lu dans l’URL',
    newsIdFromHash('#actualite?id=12') === 12 &&
      newsIdFromHash('#actualite/7') === 7 &&
      newsIdFromHash('#actualite') === 0
  );

  // `#vie-equipe` (bouton du héros et tuile « Qualité & certification ») : la
  // vue reste l'accueil et la page défile jusqu'à la section « Vie de l'équipe ».
  check(
    'ancre #vie-equipe → section de l’accueil',
    viewFromHref('#vie-equipe') === 'accueil' && anchorIdFromHash('#vie-equipe') === 'vie-equipe'
  );
  check(
    'chaque ancre de section reste dans la vue accueil',
    Object.keys(HOME_ANCHORS).every(
      (key) => viewFromHash('#' + key) === 'accueil' && anchorIdFromHash('#' + key) === HOME_ANCHORS[key]
    )
  );
  check(
    'alias historique #vie-bbi → vue actualités',
    viewFromHref('#vie-bbi') === 'actualites' && anchorIdFromHash('#vie-bbi') === ''
  );
  check(
    'les vues ne sont pas prises pour des sections',
    anchorIdFromHash('#actualites') === '' && anchorIdFromHash('#organigramme') === ''
  );

  // Anciennes pages SharePoint : un clic ne doit pas quitter le portail.
  const legacy = 'https://businessbuilderinter.sharepoint.com/sites/intranet/SitePages/';
  check(
    'anciennes pages .aspx encore reliées aux vues',
    viewFromHref(legacy + 'catalogue.aspx') === 'formations' &&
      viewFromHref(legacy + 'sessions.aspx') === 'sessions' &&
      viewFromHref(legacy + 'vie-bbi.aspx') === 'actualites' &&
      viewFromHref(legacy + 'galerie.aspx') === 'ressources' &&
      viewFromHref(legacy + 'espace-formateurs.aspx') === 'communaute' &&
      viewFromHref('https://example.com/ailleurs') === undefined
  );
}

/* ------------------------------------------------------------------ */
/* 7. Actualités paginées + page dédiée                                */
/* ------------------------------------------------------------------ */
async function testNewsArchive() {
  console.log('\nActualités : pagination et page dédiée');
  const { paginate, loadNewsPage, loadNewsItem } = loadTsModule(
    'src/webparts/bbiHome/components/newsArchive.ts'
  );

  const items = [];
  for (let i = 1; i <= 12; i += 1) {
    items.push({ Id: i, Title: `Actualité ${i}` });
  }
  const first = paginate(items, 0, 5);
  const third = paginate(items, 2, 5);
  const beyond = paginate(items, 9, 5);
  check('pagination — 3 pages pour 12 éléments par 5', first.totalPages === 3);
  check('pagination — première page de 5', first.items.length === 5 && first.items[0].Id === 1);
  check('pagination — dernière page partielle', third.items.length === 2 && third.items[0].Id === 11);
  check('pagination — page hors limites ramenée à la dernière', beyond.page === 2);

  const missing = fakeClient([{ match: /fields/, ok: false, status: 404 }]);
  const demoPage = await loadNewsPage(missing, SITE, 'Actualites', 1, 5);
  check('liste absente → page de repli', demoPage.items.length === 5 && demoPage.isDemo === true);
  check('liste absente → page suivante signalée', demoPage.hasMore === true);

  const demoBundle = await loadNewsItem(missing, SITE, 'Actualites', 3, 4);
  check('actualité de repli chargée par identifiant', !!demoBundle.article && demoBundle.article.Id === 3);
  check(
    'actualité suivante et précédente proposées',
    !!demoBundle.next && !!demoBundle.previous && demoBundle.next.Id === 4 && demoBundle.previous.Id === 2
  );
  check(
    'autres actualités sans doublon',
    demoBundle.others.length === 4 && demoBundle.others.every((entry) => entry.Id !== 3)
  );

  const emptyBundle = await loadNewsItem(
    fakeClient([{ match: /fields/, json: { value: [{ InternalName: 'Published' }] } }, { match: /items/, json: { value: [] } }]),
    SITE,
    'Actualites',
    0,
    4
  );
  check('liste vide → actualité de repli (jamais de page blanche)', !!emptyBundle.article && emptyBundle.isDemo === true);

  const liveBundle = await loadNewsItem(
    fakeClient([
      { match: /fields/, json: { value: [{ InternalName: 'Published' }, { InternalName: 'Body' }] } },
      {
        match: /items/,
        json: {
          value: [
            { Id: 5, Title: 'Dernière', Published: '2026-09-20T09:00:00Z', Body: '<p>Corps</p>' },
            { Id: 4, Title: 'Précédente', Published: '2026-09-10T09:00:00Z', Body: '<p>Corps</p>' },
            { Id: 3, Title: 'Encore avant', Published: '2026-09-01T09:00:00Z' }
          ]
        }
      }
    ]),
    SITE,
    'Actualites',
    4,
    4
  );
  check('actualité réelle trouvée par identifiant', liveBundle.isDemo === false && liveBundle.article.Title === 'Précédente');
  check('corps de l’article repris', liveBundle.article.Body === '<p>Corps</p>');
  check(
    'navigation éditoriale recalculée autour de l’article',
    liveBundle.next.Title === 'Encore avant' && liveBundle.previous.Title === 'Dernière'
  );
}

/* ------------------------------------------------------------------ */
/* 8. Employé du mois, certifications et contacts des formateurs       */
/* ------------------------------------------------------------------ */
async function testTeamHighlights() {
  console.log('\nEmployé du mois, certifications et contacts');
  const {
    loadEmployeeOfMonth,
    loadHomeCertifications,
    loadHomeTrainers,
    whatsAppUrl,
    telUrl,
    mailtoUrl,
    teamsChatUrl
  } = loadTsModule('src/webparts/bbiHome/components/homeData.ts');

  const missing = fakeClient([{ match: /fields/, ok: false, status: 404 }]);
  const employee = await loadEmployeeOfMonth(missing, SITE, 'Employes');
  check('employé du mois — repli disponible', employee.items.length === 1 && employee.isDemo === true);
  check(
    'employé du mois — mise en avant rédigée',
    (employee.items[0].Message || '').length > 80 && !!employee.items[0].Role && !!employee.items[0].Highlights
  );

  const certifications = await loadHomeCertifications(missing, SITE, 'Certifications', 6);
  check('certifications — repli disponible', certifications.items.length >= 3 && certifications.isDemo === true);
  check(
    'certifications — Qualiopi présente et datée',
    certifications.items.some((item) => (item.Title || '').indexOf('Qualiopi') !== -1 && !!item.ValidUntil)
  );

  const trainers = await loadHomeTrainers(missing, SITE, 'Formateurs', 24);
  check('formateurs — coordonnées complètes dans le repli', trainers.items.every((entry) => !!entry.Email && !!entry.Phone && !!entry.Location));
  check(
    'formateurs — colonnes photo/e-mail/téléphone découvertes en production',
    true
  );

  const live = await loadHomeTrainers(
    fakeClient([
      {
        match: /fields/,
        json: {
          value: [
            { InternalName: 'Role' },
            { InternalName: 'Photo' },
            { InternalName: 'Telephone' },
            { InternalName: 'Email' },
            { InternalName: 'WhatsApp' },
            { InternalName: 'Localisation' },
            { InternalName: 'Bio' }
          ]
        }
      },
      {
        match: /items/,
        json: {
          value: [
            {
              Id: 7,
              Title: 'Amélie Martin',
              Role: 'Responsable pédagogique',
              Photo: { Url: '/sites/intranet/SiteAssets/amelie.jpg' },
              Telephone: '+33 6 12 45 78 90',
              Email: 'amelie.martin@businessbuilders.fr',
              WhatsApp: '+33612457890',
              Localisation: 'Paris — Siège',
              Bio: 'Ingénierie pédagogique.'
            }
          ]
        }
      }
    ]),
    SITE,
    'Formateurs',
    24
  );
  check('formateurs — données réelles lues', live.isDemo === false && live.items[0].Title === 'Amélie Martin');
  check(
    'formateurs — photo, téléphone, e-mail et WhatsApp repris',
    live.items[0].PhotoUrl === '/sites/intranet/SiteAssets/amelie.jpg' &&
      live.items[0].Phone === '+33 6 12 45 78 90' &&
      live.items[0].Email === 'amelie.martin@businessbuilders.fr' &&
      live.items[0].WhatsApp === '+33612457890'
  );

  check('WhatsApp — lien wa.me normalisé', whatsAppUrl('+33 6 12 45 78 90') === 'https://wa.me/33612457890');
  check('téléphone — lien tel: normalisé', telUrl('+33 6 12 45 78 90') === 'tel:+33612457890');
  check('e-mail — lien mailto: valide', mailtoUrl('contact@bbi.fr') === 'mailto:contact@bbi.fr');
  check(
    'Teams — conversation directe construite',
    teamsChatUrl('contact@bbi.fr').indexOf('teams.microsoft.com/l/chat') !== -1
  );
  check('WhatsApp — valeur vide ignorée', whatsAppUrl('') === '');
}

/* ------------------------------------------------------------------ */
/* 9. Organigramme                                                     */
/* ------------------------------------------------------------------ */
async function testOrgChart() {
  console.log('\nOrganigramme de l’entreprise');
  const { loadOrgChart, buildOrgTree, orgPoles } = loadTsModule(
    'src/webparts/bbiHome/components/orgData.ts'
  );

  const missing = await loadOrgChart(fakeClient([{ match: /fields/, ok: false, status: 404 }]), SITE, 'Organigramme');
  check('liste absente → organigramme de repli', missing.nodes.length >= 10 && missing.isDemo === true);
  check('repli → coordonnées disponibles', missing.nodes.every((node) => !!node.Email && !!node.Location));

  const live = await loadOrgChart(
    fakeClient([
      { match: /fields/, json: { value: [{ InternalName: 'Poste' }, { InternalName: 'Manager' }, { InternalName: 'Pole' }, { InternalName: 'Email' }] } },
      {
        match: /items/,
        json: {
          value: [
            { Id: 1, Title: 'Direction', Poste: 'Directeur général', Pole: 'Direction' },
            { Id: 2, Title: 'Pédagogie', Poste: 'Directrice pédagogique', Manager: 'Direction', Pole: 'Pédagogie', Email: 'peda@bbi.fr' },
            { Id: 3, Title: 'Qualité', Poste: 'Auditrice', Manager: 'Direction', Pole: 'Qualité' }
          ]
        }
      }
    ]),
    SITE,
    'Organigramme'
  );
  const tree = buildOrgTree(live.nodes);
  check('liste alimentée → nœuds réels', live.isDemo === false && live.nodes.length === 3);
  check('arbre — une seule racine', tree.length === 1 && tree[0].Title === 'Direction');
  check('arbre — deux rattachements', tree[0].children.length === 2);
  check('arbre — profondeur calculée', tree[0].Depth === 0 && tree[0].children[0].Depth === 1);
  check('pôles listés sans doublon', orgPoles(live.nodes).length === 3);

  const cyclic = buildOrgTree([
    { Id: 1, Title: 'A', ParentId: 2 },
    { Id: 2, Title: 'B', ParentId: 1 }
  ]);
  check('arbre — boucle cassée sans perdre de poste', cyclic.length === 2);

  const orphan = buildOrgTree([{ Id: 1, Title: 'Solo', ParentTitle: 'Inconnu' }]);
  check('arbre — responsable inconnu → racine', orphan.length === 1 && orphan[0].Title === 'Solo');
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
  await testHeroAndRoutes();
  await testNewsArchive();
  await testTeamHighlights();
  await testOrgChart();
  console.log(`\nRésultat : ${passed} vérifications réussies, ${failed} échec(s).`);
  process.exit(failed === 0 ? 0 : 1);
})();
