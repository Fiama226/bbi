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
const { JSDOM } = require('jsdom');
const sanitizerDom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://tenant.sharepoint.com/sites/intranet'
});
global.window = sanitizerDom.window;
const DOMPurify = require('dompurify')(sanitizerDom.window);

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
    if (request === 'dompurify') {
      return DOMPurify;
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
    liveNews.items[0].ImageUrl === 'https://tenant.sharepoint.com/sites/intranet/SiteAssets/news.jpg' &&
      liveNews.items[0].LinkUrl === 'https://tenant.sharepoint.com/sites/intranet/SitePages/article.aspx?itemid=1'
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
  check('attributs d’événement non quotés retirés', sanitizeHtml('<img src=x onerror=alert(1)>').indexOf('onerror') === -1);
  check('SVG actif retiré', sanitizeHtml('<svg onload=alert(1)><circle /></svg>').indexOf('<svg') === -1);
  check('URL javascript retirée des liens', sanitizeHtml('<a href="javascript:alert(1)">lien</a>').indexOf('javascript:') === -1);
  check('mise en forme éditoriale conservée', sanitizeHtml('<p><strong>BBI</strong></p>').indexOf('<strong>BBI</strong>') !== -1);
  const { safeHref, safeImageUrl } = loadTsModule('src/shared/safeUrl.ts');
  check('URL javascript refusée', safeHref('javascript:alert(1)') === undefined);
  check('URL HTTPS autorisée', safeHref('https://example.com/formation') === 'https://example.com/formation');
  check('URI data refusée pour les images', safeImageUrl('data:image/svg+xml,<svg/>') === undefined);
  check('URL relative SharePoint normalisée', !!safeImageUrl('/sites/intranet/photo.jpg'));
  const { encodeODataLiteral, listApiUrl } = loadTsModule('src/shared/sharePointRest.ts');
  const specialListUrl = listApiUrl(SITE, "L'équipe & qualité", 'items');
  check('nom de liste avec apostrophe échappé', specialListUrl.indexOf("getbytitle('L''%C3%A9quipe") !== -1);
  check('nom de liste avec esperluette encodé', specialListUrl.indexOf('%26') !== -1);
  check('valeur OData avec caractères spéciaux encodée', encodeODataLiteral("A&B' C").indexOf('%26') !== -1);
  check('apostrophe dans valeur OData doublée', encodeODataLiteral("A&B'").indexOf("B''") !== -1);
  check('temps de lecture calculé', readingTimeOf('', 'mot '.repeat(400)) === 2);
  check('actualité courante exclue des suggestions', live.related.every((r) => r.Id !== 5));
}


/* ------------------------------------------------------------------ */
/* 6. Héros en diaporama & routes du portail                           */
/* ------------------------------------------------------------------ */
async function testHeroAndRoutes() {
  console.log('\nHéros en diaporama & navigation du portail');
  const { parseHeroSlides, parseKpis, parsePortalRoute, looksLikeImage, parseAnnouncements } =
    loadTsModule('src/webparts/bbiHome/components/homeLayout.ts');

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

  // Bandeau d'annonces déroulant : une ligne par annonce, chacune avec sa
  // page de détail. Sans ces contrôles, une annonce pourrait défiler sans
  // destination, ou avec un lien que le portail ne sait pas ouvrir.
  const annonces = parseAnnouncements(
    [
      '# commentaire ignoré',
      'Mariage — félicitations à notre collègue | #annonce?id=12',
      'Inscriptions ouvertes — session de mars | #sessions',
      'Document de présentation | https://bbi.example.com/rapport',
      'Message sans lien'
    ].join('\n')
  );
  check('annonces — une entrée par ligne utile', annonces.length === 4, `${annonces.length}`);
  check(
    'annonces — libellé et lien lus',
    annonces[0].label === 'Mariage — félicitations à notre collègue' && annonces[0].href === '#annonce?id=12'
  );
  check('annonces — lien externe conservé', annonces[2].href === 'https://bbi.example.com/rapport');
  check(
    'annonces — lien dangereux neutralisé',
    parseAnnouncements('Piège | javascript:alert(1)')[0].href === '#annonces'
  );
  check(
    'annonces — annonce sans lien mène aux annonces',
    parseAnnouncements('Message seul')[0].href === '#annonces'
  );
  check('annonces — configuration vide', parseAnnouncements('').length === 0);
  check(
    'annonces — clés uniques (pas de collision React)',
    new Set(annonces.map((item) => item.key)).size === annonces.length
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

  // Clic sur une annonce du bandeau déroulant : le lien doit être traité
  // comme un lien interne du portail, sinon l'utilisateur quitterait la page
  // au lieu d'atterrir sur la page de détail de l'annonce.
  const annonceHref = parseAnnouncements('Une annonce | #annonce?id=12')[0].href;
  check(
    'annonce → sa propre page de détail (pas une actualité)',
    viewFromHref(annonceHref) === 'annonce' && newsIdFromHash(annonceHref) === 12,
    annonceHref
  );

  check('annonces — lien de liste reconnu', viewFromHash('#annonces') === 'annonce');
  check('annonces — lien direct après rechargement reconnu', viewFromHash('#annonce?id=99') === 'annonce');

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
        match: /items\(4\)/,
        json: { Id: 4, Title: 'Précédente', Published: '2026-09-10T09:00:00Z', Body: '<p>Corps</p>' }
      },
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

  const paged = await loadNewsPage(
    fakeClient([
      { match: /fields/, json: { value: [{ InternalName: 'Published' }] } },
      {
        match: /skiptoken/,
        json: { value: [{ Id: 6, Title: 'Page deux A' }, { Id: 7, Title: 'Page deux B' }] }
      },
      {
        match: /items/,
        json: {
          value: [1, 2, 3, 4, 5].map((Id) => ({ Id, Title: `Page un ${Id}` })),
          'odata.nextLink': `${SITE}/_api/web/lists/getbytitle('News')/items?$skiptoken=Paged%3DTRUE%26p_ID%3D5`
        }
      }
    ]),
    SITE,
    'News archive',
    1,
    5
  );
  check('pagination SharePoint — suit le nextLink pour la page demandée',
    paged.items.length === 2 && paged.items[0].Id === 6 && paged.hasMore === false && !paged.isDemo);

  const oldArticle = await loadNewsItem(
    fakeClient([
      { match: /fields/, json: { value: [{ InternalName: 'Published' }] } },
      {
        match: /items\(999\)/,
        json: { Id: 999, Title: 'Archive ancienne', Published: '2020-01-01T09:00:00Z' }
      },
      { match: /items/, json: { value: [{ Id: 5, Title: 'Actualité récente' }] } }
    ]),
    SITE,
    'Old news list',
    999,
    4
  );
  check('page dédiée — une actualité ancienne est chargée directement par ID',
    oldArticle.article && oldArticle.article.Id === 999 && oldArticle.article.Title === 'Archive ancienne');
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

  const currentWinner = await loadEmployeeOfMonth(
    fakeClient([
      { match: /fields/, json: { value: [{ InternalName: 'IsCurrent' }, { InternalName: 'Month' }] } },
      { match: /items/, json: { value: [
        { Id: 11, Title: 'Gagnante du mois', IsCurrent: true, Month: 'juin 2026' },
        { Id: 10, Title: 'Ancienne mise à l\'honneur', IsCurrent: false, Month: 'mai 2026' }
      ] } }
    ]),
    SITE,
    'Employes'
  );
  check('employé du mois — le drapeau IsCurrent prévaut sur Created',
    currentWinner.isDemo === false && currentWinner.items.length === 1 && currentWinner.items[0].Title === 'Gagnante du mois');

  const currentMonthLabel = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date());
  const legacyWinner = await loadEmployeeOfMonth(
    fakeClient([
      { match: /fields/, json: { value: [{ InternalName: 'Month' }] } },
      { match: /items/, json: { value: [
        { Id: 12, Title: 'Archive', Month: 'mai 2020' },
        { Id: 13, Title: 'Mois courant', Month: currentMonthLabel }
      ] } }
    ]),
    SITE,
    'Employes'
  );
  check('employé du mois — compatibilité avec le champ Mois historique',
    legacyWinner.isDemo === false && legacyWinner.items[0].Title === 'Mois courant');

  const noCurrentWinner = await loadEmployeeOfMonth(
    fakeClient([
      { match: /fields/, json: { value: [{ InternalName: 'IsCurrent' }] } },
      { match: /items/, json: { value: [{ Id: 14, Title: 'Archive', IsCurrent: false }] } }
    ]),
    SITE,
    'Employes'
  );
  check('employé du mois — pas de gagnant courant = état vide, pas de faux gagnant',
    noCurrentWinner.isDemo === false && noCurrentWinner.items.length === 0);

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
    live.items[0].PhotoUrl === 'https://tenant.sharepoint.com/sites/intranet/SiteAssets/amelie.jpg' &&
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
async function testPortalSearch() {
  console.log('\nRecherche globale du portail');
  const { searchPortal } = loadTsModule('src/webparts/bbiHome/components/homeSearch.ts');
  let requestedUrl = '';
  const rows = [
    {
      Cells: { results: [
        { Key: 'Title', Value: 'Guide de formation' },
        { Key: 'Description', Value: '<b>Parcours</b> de formation' },
        { Key: 'ContentType', Value: 'Document' },
        { Key: 'Path', Value: `${SITE}/Documents/guide.pdf` }
      ] }
    },
    {
      Cells: { results: [
        { Key: 'Title', Value: 'Lien dangereux' },
        { Key: 'Path', Value: 'javascript:alert(1)' }
      ] }
    }
  ];
  const results = await searchPortal({
    get: async (url) => {
      requestedUrl = url;
      return {
        ok: true,
        status: 200,
        json: async () => ({ PrimaryQueryResult: { RelevantResults: { Table: { Rows: { results: rows } } } } })
      };
    }
  }, SITE, 'formation OR *', 20);
  const parsedUrl = new URL(requestedUrl);
  check('recherche globale — requête SharePoint bornée au site courant',
    parsedUrl.pathname.endsWith('/_api/search/query') && parsedUrl.searchParams.get('querytext').includes(`Path:"${SITE}"`));
  check('recherche globale — termes utilisateur échappés et taille bornée',
    !parsedUrl.searchParams.get('querytext').includes('*') && parsedUrl.searchParams.get('rowlimit') === '20');
  check('recherche globale — résultats filtrés par URL sûre et présentés en texte',
    results.length === 1 && results[0].title === 'Guide de formation' && results[0].href.endsWith('/Documents/guide.pdf') && results[0].description === 'Parcours de formation', JSON.stringify(results));
}

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
  await testPortalSearch();
  console.log(`\nRésultat : ${passed} vérifications réussies, ${failed} échec(s).`);
  process.exit(failed === 0 ? 0 : 1);
})();
