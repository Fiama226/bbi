/**
 * BBI — harnais de vérification du rendu CSS des web parts.
 *
 * Charge le bundle réel (production ou dev) dans un environnement simulé
 * (jsdom + AMD + les vraies bibliothèques @microsoft/sp-* de node_modules),
 * instancie la web part comme le ferait SharePoint, puis vérifie :
 *   1. que les <style> sont injectés dans <head>,
 *   2. que le CSS des .module.scss y figure,
 *   3. que le DOM rendu utilise bien les classes (hachées) du CSS.
 *
 * Exécution : node tools/css-harness.js [dist|release] [workbench|page] [demo|live|empty]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const mode = process.argv[2] === 'release' ? 'release' : 'dist';
const pageMode = process.argv.includes('page') ? 'page' : 'workbench';
const announcementScenario = process.argv.includes('live') ? 'live' : process.argv.includes('empty') ? 'empty' : 'demo';
const requests = [];
const announcementFixtures = [
  { Id: 23, Title: 'Mariage de notre collègue', AnnonceType: 'Mariage', Body: '<p>MARIAGE_DETAIL_ONLY</p><script>bad()</script><img src="x" onerror="bad()">', Author: { Title: 'RH' } },
  { Id: 24, Title: 'Joyeux anniversaire !', AnnonceType: 'Anniversaire', Body: '<p>ANNIVERSAIRE_DETAIL_ONLY</p>' },
  { Id: 99, Title: 'Annonce accessible par lien direct', AnnonceType: 'Autre', Body: '<p>DIRECT_DETAIL_ONLY</p>' },
];
console.log(`Contexte : ${pageMode} · annonces : ${announcementScenario}`);
const bundleName =
  mode === 'release'
    ? 'bbi-home-web-part_en-us_'
    : 'bbi-home-web-part_en-us_';
const folder =
  mode === 'release'
    ? path.join(root, 'release', 'assets')
    : path.join(root, 'dist');

const bundleFile = fs
  .readdirSync(folder)
  .filter((f) => f.startsWith(bundleName) && f.endsWith('.js'))
  .sort((a, b) => fs.statSync(path.join(folder, b)).mtimeMs - fs.statSync(path.join(folder, a)).mtimeMs)[0];
if (!bundleFile) {
  console.error(`✗ bundle introuvable dans ${folder}`);
  process.exit(1);
}
console.log(`Bundle testé : ${path.join(folder, bundleFile)}`);

// --- Environnement DOM simulé ---------------------------------------------
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
  url: pageMode === 'page'
    ? 'https://businessbuilderinter.sharepoint.com/sites/intranet/SitePages/accueil.aspx'
    : 'https://businessbuilderinter.sharepoint.com/_layouts/15/workbench.aspx',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});
const { window } = dom;

// Polices / APIs manquantes sous jsdom
window.scrollTo = () => {};
if (!window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = () => {};
}

// Les bibliothèques SP utilisent le global `window` au chargement —
// l'exposer dans Node avant de les require().
global.window = window;
global.document = window.document;
Object.defineProperty(global, 'navigator', { value: window.navigator, configurable: true });
global.HTMLElement = window.HTMLElement;
global.self = window;
global.CSPSettings = window.CSPSettings = { nonce: undefined };

// --- Stub des modules internes Microsoft (fournis par SharePoint à l'exec)
const Module = require('module');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '@msinternal/ecs-flight') {
    return { Ecs: { create: () => ({ flight: () => null }) } };
  }
  if (request.startsWith('@msinternal/')) {
    // Stub générique : les modules @msinternal/* sont injectés par SharePoint.
    return new Proxy({}, { get: (t, k) => (k === '__esModule' ? false : (...a) => undefined) });
  }
  if (/\.(scss|css|module\.scss)$/.test(request)) {
    // Les imports de styles des bibliothèques SP sont ignorés (inutiles ici).
    return { __esModule: true, default: {} };
  }
  if (request === '@microsoft/sp-property-pane') {
    // Fabriqué factice : le panneau de propriétés est hors périmètre du test.
    const fakeField = () => (name) => ({ name, type: 'fake-field' });
    return {
      __esModule: true,
      PropertyPaneTextField: fakeField(),
      PropertyPaneSlider: fakeField(),
      PropertyPaneToggle: fakeField(),
      PropertyPaneDropdown: fakeField(),
      PropertyPaneGroup: fakeField(),
    };
  }
  return originalLoad.apply(this, arguments);
};

// --- AMD (définition du style SharePoint) ---------------------------------
// Les require() se font ici, après l'exposition des globals ci-dessus.
// sp-property-pane n'est utilisé que pour le panneau de propriétés (hors
// périmètre du test CSS) : on le remplace par des fabriques factices.
const fakePaneField = () => (name) => ({ name, type: 'fake-field' });
const spModules = {
  '@microsoft/sp-core-library': require('@microsoft/sp-core-library'),
  '@microsoft/sp-property-pane': {
    PropertyPaneTextField: fakePaneField(),
    PropertyPaneSlider: fakePaneField(),
    PropertyPaneToggle: fakePaneField(),
    PropertyPaneDropdown: fakePaneField(),
    PropertyPaneGroup: fakePaneField(),
  },
  '@microsoft/sp-webpart-base': {
    // Substitute fidèle de la classe de base : le flux vérifié ici
    // (injection CSS + rendu React) ne dépend pas des services du framework.
    // (constructeur fonction classique : le __extends de TypeScript fait
    // _super.call(this), incompatible avec une classe ES6 native)
    BaseClientSideWebPart: (function () {
      function FakeBase() {
        this.properties = {};
      }
      Object.defineProperty(FakeBase.prototype, 'domElement', {
        get: function () {
          return this.context && this.context.domElement;
        },
        configurable: true,
      });
      Object.defineProperty(FakeBase.prototype, 'displayMode', {
        get: function () {
          return 1;
        },
        configurable: true,
      });
      return FakeBase;
    })(),
  },
  '@microsoft/sp-http': require('@microsoft/sp-http'),
};

let defined = null;
window.define = (deps, factory) => {
  const resolved = deps.map((d) => {
    if (spModules[d]) {
      return spModules[d];
    }
    throw new Error(`dépendance AMD inconnue : ${d}`);
  });
  defined = factory.apply(null, resolved);
};
window.define.amd = {};

// --- Évalue le bundle (comme un <script> chargé par SharePoint) -----------
const bundleSource = fs.readFileSync(path.join(folder, bundleFile), 'utf8');
let evalError = null;
try {
  window.eval(bundleSource);
} catch (e) {
  evalError = e;
}

if (evalError) {
  console.log('✗ ÉVALUATION DU BUNDLE EN ERREUR :', evalError.message);
  process.exit(1);
}

const stylesBefore = window.document.head.querySelectorAll('style');
console.log(`\n--- Après évaluation du bundle (avant rendu) ---`);
console.log(`<style> dans <head> : ${stylesBefore.length}`);
stylesBefore.forEach((s, i) => {
  const css = s.textContent || '';
  console.log(`  [${i}] ${css.length} octets — contient .module.scss :`,
    /_[A-Za-z0-9]{5,8}\{/.test(css) ? 'OUI' : 'NON',
    '| bbi-bleed:', css.includes('bbi-bleed') ? 'oui' : 'non');
});

// --- Instantiation de la web part (simulation du framework SPFx) ----------
const WpClass = defined && (defined.default || defined);
if (typeof WpClass !== 'function') {
  console.log('✗ Le bundle n’exporte pas une classe de web part :', Object.keys(defined || {}));
  process.exit(1);
}

const nativeChrome = window.document.createElement('div');
nativeChrome.id = 'mock-sharepoint-chrome';
nativeChrome.textContent = 'Commandes SharePoint';
window.document.body.appendChild(nativeChrome);
const hostDiv = window.document.createElement('div');
window.document.body.appendChild(hostDiv);

const wp = new WpClass();
// Comme le framework SPFx : les propriétés du manifeste sont injectées dans la
// web part avant onInit(), puis onInit() applique les valeurs par défaut.
wp.properties = JSON.parse(
  JSON.stringify(
    require(path.join(root, 'src/webparts/bbiHome/BbiHomeWebPart.manifest.json'))
      .preconfiguredEntries[0].properties
  )
);
wp.context = {
  pageContext: {
    web: { absoluteUrl: 'https://businessbuilderinter.sharepoint.com/sites/intranet' },
    pageLocation: { queryParameters: {} },
  },
  properties: JSON.parse(
    JSON.stringify(
      require(path.join(root, 'src/webparts/bbiHome/BbiHomeWebPart.manifest.json'))
        .preconfiguredEntries[0].properties
    )
  ),
  spHttpClient: {
    get: async (url) => {
      requests.push(url);
      if (announcementScenario !== 'demo' && url.includes("getbytitle('Annonces')")) {
        if (url.includes('/fields')) {
          const fields = ['Id', 'Title', 'Created', 'Author', 'Body', 'AnnonceType'];
          return { ok: true, json: async () => ({ value: fields.map((InternalName) => ({ InternalName })) }) };
        }
        const filter = new URL(url).searchParams.get('$filter') || '';
        const id = (filter.match(/^Id eq (\d+)$/) || [])[1];
        const items = announcementScenario === 'empty' ? [] : id
          ? announcementFixtures.filter((item) => item.Id === Number(id))
          : announcementFixtures.filter((item) => item.Id !== 99);
        return { ok: true, json: async () => ({ value: items }) };
      }
      throw new Error('no network in harness');
    },
  },
  serviceScope: {
    consume: () => undefined,
  },
  manifest: { isInternal: false },
  host: { type: 3 },
  sdks: {},
  displayMode: 1,
  domElement: hostDiv,
  statusRenderer: {
    clearLoadingIndicator: () => {},
    renderError: () => {},
    renderLoading: () => {},
  },
};

try {
  // Cycle de vie réel : onInit() (valeurs par défaut, migration) puis render().
  Promise.resolve(typeof wp.onInit === 'function' ? wp.onInit() : undefined)
    .catch(() => undefined)
    .then(() => {
      try {
        wp.render();
      } catch (e) {
        console.log('✗ RENDU EN ERREUR :', e);
        process.exit(1);
      }
    });
} catch (e) {
  console.log('✗ RENDU EN ERREUR :', e);
  process.exit(1);
}

// Le composant charge ses données async (Promise) puis re-rend — on attend.
const verifyRender = async () => {
  // Plein écran : le portail est monté dans un calque fixe rattaché au <body>
  // (workbench hébergé) ; sinon il vit dans l'élément de la web part.
  const portalHost = window.document.getElementById('bbi-portal-host');
  const renderRoot = portalHost || hostDiv;
  const styles = window.document.head.querySelectorAll('style');
  const allCss = Array.from(styles)
    .map((s) => s.textContent || '')
    .join('\n');

  const rendered = renderRoot.innerHTML;
  const renderedClasses = [
    ...new Set((rendered.match(/class="[^"]+"/g) || []).join(' ').match(/[\w-]+_[A-Za-z0-9]{5,8}/g) || [])
  ];

  console.log(`\n--- Après rendu de la web part ---`);
  console.log(`<style> dans <head> : ${styles.length}`);
  console.log(`octets de CSS injectés : ${allCss.length}`);
  console.log(`classe .home dans le DOM : ${rendered.includes('class="') && /home_[A-Za-z0-9]{5,8}/.test(rendered) ? 'OUI' : 'NON'}`);
  console.log(`classes hachées distinctes dans le DOM : ${renderedClasses.length}`);

  const missing = renderedClasses.filter((c) => !allCss.includes(`.${c}`));
  console.log(`classes du DOM absentes du CSS : ${missing.length}`, missing.slice(0, 10));

  const domUsesCss = renderedClasses.length > 0;
  const styleOk =
    styles.length > 0 &&
    allCss.includes('bbi-bleed') &&
    domUsesCss &&
    missing.length === 0;

  // Non-régression : la bande de chiffres clés ne doit jamais être rendue
  // dans la zone rognée du diaporama (c'était la cause de son invisibilité).
  const kpiBand = renderRoot.querySelector('[data-bbi-kpi-band]');
  const kpiInsideStage = renderRoot.querySelector('[data-bbi-hero-stage] [data-bbi-kpi-band]');
  const kpiCount = renderRoot.querySelectorAll('[data-bbi-kpi-band] > li').length;
  const slideCount = renderRoot.querySelectorAll('[data-bbi-hero-slide]').length;
  const pagination = renderRoot.querySelector('[data-bbi-news-pagination]');
  console.log(
    `Bande de chiffres clés : ${kpiBand ? `${kpiCount} chiffre(s)` : 'ABSENTE'} — hors zone rognée : ${
      kpiBand && !kpiInsideStage ? 'OUI' : 'NON'
    }`
  );
  console.log(`Diapositives du héros : ${slideCount}`);
  console.log(`Pagination des actualités : ${pagination ? 'PRÉSENTE' : 'ABSENTE'}`);

  const spaces = renderRoot.querySelector('#acces');
  const statsSection = renderRoot.querySelector('#chiffres-cles');
  const kpiBelowSpaces = !!spaces && spaces.nextElementSibling === statsSection &&
    !!statsSection && statsSection.contains(kpiBand) && !kpiBand.closest('[data-bbi-block="hero"]');
  const kpiOk = !!kpiBand && !kpiInsideStage && kpiCount >= 3 && kpiBelowSpaces;
  console.log(`Chiffres clés dans leur section après « Vos espaces » : ${kpiBelowSpaces ? 'OUI' : 'NON'}`);
  const slidesOk = slideCount >= 2;
  const paginationOk = !!pagination;

  /* ------------------------------------------------------------------
     Non-régressions de mise en page (bundle compilé, pas de navigateur).
     ------------------------------------------------------------------ */

  /** Règle CSS d'une classe hachée : `.hero_kpiBand_ab12cd{…}`. */
  const ruleOf = (element, suffix) => {
    if (!element) {
      return '';
    }
    const className = (element.getAttribute('class') || '')
      .split(/\s+/)
      .find((name) => suffix.test(name));
    if (!className) {
      return '';
    }
    const start = allCss.indexOf('.' + className + '{');
    return start === -1 ? '' : allCss.slice(start, allCss.indexOf('}', start));
  };

  /* 1. La barre de navigation reste bleue sur l'accueil comme ailleurs.
        Elle était transparente tant que la vue courante était « accueil ». */
  const topbar = renderRoot.querySelector('header');
  const topbarRule = ruleOf(topbar, /topbar/i);
  const topbarOpaque =
    /background(?:-color)?:\s*(?:rgba?\(|#[0-9a-f]{3,8})/i.test(topbarRule) &&
    !/background(?:-color)?:\s*transparent/.test(topbarRule) &&
    window.getComputedStyle(topbar).backgroundColor === 'rgb(14, 38, 92)';
  const overlayOk =
    !!portalHost &&
    portalHost.hasAttribute('data-bbi-scroller') &&
    /\.bbi-portal-host\s*\{[^}]*position:\s*fixed/.test(allCss) &&
    /\.bbi-portal-host\s*\{[^}]*bottom:\s*0/.test(allCss);
  const nativeChromeHidden = window.getComputedStyle(nativeChrome).visibility === 'hidden';
  console.log(`Calque plein écran (${pageMode}) : ${overlayOk && nativeChromeHidden ? 'OUI — fixe, chrome masqué, défile seul' : 'ABSENT / CHROME VISIBLE'}`);
  console.log(`Barre de navigation : ${topbarOpaque ? 'BLEUE (fond opaque)' : 'NON OPAQUE'}`);

  /* 2. La bande de chiffres clés ne doit plus remonter sur le héros : sa
        marge haute était négative et masquait boutons et textes. */
  const kpiRule = ruleOf(kpiBand, /kpiBandStandalone/);
  const kpiMargin = (kpiRule.match(/margin:\s*([^;]+)/) || [])[1] || '';
  const kpiOverlaps = /margin:\s*-\d/.test(kpiRule);
  console.log(
    `Chiffres clés : marge « ${kpiMargin.trim()} » — ${
      kpiOverlaps ? 'RECOUVRE LE HÉROS' : 'bloc autonome après Vos espaces'
    }`
  );

  /* 3. L'accueil ne montre plus l'organigramme ni la page d'une actualité :
        ces deux sections ont leur propre vue. Le minifieur retire les
        guillemets des valeurs d'attributs : les deux écritures sont admises. */
  const homeHides = /\[data-view=("?)accueil\1\][^{]*\[data-bbi-view=("?)organigramme\2\]/.test(
    allCss
  );
  const homeHidesArticle = /\[data-view=("?)accueil\1\][^{]*\[data-bbi-view=("?)actualite\2\]/.test(
    allCss
  );
  console.log(
    `Accueil sans organigramme ni page d'actualité : ${
      homeHides && homeHidesArticle ? 'OUI' : 'NON'
    }`
  );

  const newsColumn = renderRoot.querySelector('[class*="newsColumn_"]');
  const homeNewsVisible = !!newsColumn && window.getComputedStyle(newsColumn).display !== 'none' &&
    window.getComputedStyle(newsColumn.parentElement).display !== 'none';
  const homeDetailAbsent = renderRoot.querySelector('[data-bbi-view="actualite"]').children.length === 0;
  console.log(`Accueil : actualités conservées, détail vide non monté : ${homeNewsVisible && homeDetailAbsent ? 'OUI' : 'NON'}`);

  /* 4. Annonces séparées des actualités : liens de détail #annonce?id=… */
  const ticker = renderRoot.querySelector('[role="region"][aria-label="Annonces BBI"]');
  const tickerLinks = ticker ? ticker.querySelectorAll('a[href]') : [];
  const tickerHrefs = Array.from(tickerLinks).map((a) => a.getAttribute('href'));
  const tickerOk = announcementScenario === 'empty'
    ? !ticker
    : !!ticker && tickerHrefs.some((href) => /^#annonce\?id=\d+$/.test(href)) &&
      tickerHrefs.every((href) => /^#annonce\?id=\d+$|^#annonces$/.test(href));
  const tickerSourceOk = !ticker || !ticker.textContent.includes('12 nouveaux formateurs certifiés');
  const examplesMarked = announcementScenario !== 'demo' || !!ticker && ticker.textContent.includes('Exemple —');
  console.log(`Annonces : ${ticker ? `${tickerHrefs.length} lien(s)` : 'liste vide — bandeau masqué'} · source distincte : ${tickerOk && tickerSourceOk && examplesMarked ? 'OK' : 'ÉCHEC'}`);

  const chromeOk = topbarOpaque && !kpiOverlaps && homeHides && homeHidesArticle &&
    homeNewsVisible && homeDetailAbsent && tickerOk && tickerSourceOk && examplesMarked && nativeChromeHidden;

  const routeRoot = renderRoot.querySelector('#bbi-home-root');
  const trainingLink = renderRoot.querySelector('header nav a[href="#formations"]');
  if (trainingLink) {
    trainingLink.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  }
  const trainingRouteOk = routeRoot && routeRoot.getAttribute('data-view') === 'formations';
  const homeLink = renderRoot.querySelector('header nav a[href="#accueil"]');
  if (homeLink) {
    homeLink.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  }
  const homeRouteOk = routeRoot && routeRoot.getAttribute('data-view') === 'accueil';
  console.log(`Navigation SPA (Accueil → Formations → Accueil) : ${trainingRouteOk && homeRouteOk ? 'OK' : 'ÉCHEC'}`);

  const orgLink = renderRoot.querySelector('header nav a[href="#organigramme"]');
  if (orgLink) {
    orgLink.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  }
  const orgRouteOk = !!orgLink && routeRoot && routeRoot.getAttribute('data-view') === 'organigramme';
  console.log(`Navigation SPA vers #organigramme : ${orgRouteOk ? 'OK' : 'ÉCHEC'}`);

  // Attend une mutation du vrai DOM React, avec un délai maximal explicite.
  const waitFor = (predicate, label) => new Promise((resolve, reject) => {
    if (predicate()) { resolve(); return; }
    const observer = new window.MutationObserver(() => {
      if (predicate()) {
        observer.disconnect();
        clearTimeout(timeout);
        resolve();
      }
    });
    const timeout = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Délai dépassé : ${label}`));
    }, 3000);
    observer.observe(renderRoot, { subtree: true, childList: true, attributes: true, characterData: true });
  });
  const detailHeading = () => renderRoot.querySelector('[data-bbi-view="annonce"] h1');
  const detailSection = () => renderRoot.querySelector('[data-bbi-view="annonce"]');

  let announcementRouteOk = true;
  let sanitizedOk = true;
  if (announcementScenario !== 'empty') {
    const link = Array.from(tickerLinks).find((node) => /^#annonce\?id=/.test(node.getAttribute('href')));
    const expectedTitle = announcementScenario === 'live'
      ? announcementFixtures[0].Title
      : 'Félicitations à Aïcha et Moussa pour leur mariage !';
    link.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    await waitFor(() => detailHeading() && detailHeading().textContent === expectedTitle, 'détail de l’annonce');
    announcementRouteOk = routeRoot.getAttribute('data-view') === 'annonce' &&
      window.location.hash === link.getAttribute('href') &&
      window.getComputedStyle(detailSection()).display !== 'none' &&
      window.getComputedStyle(newsColumn.parentElement).display === 'none';
    sanitizedOk = !detailSection().querySelector('script, [onerror]');
    if (announcementScenario === 'live') {
      sanitizedOk = sanitizedOk && detailSection().textContent.includes('MARIAGE_DETAIL_ONLY');
      window.location.hash = '#annonce?id=99';
      await waitFor(() => detailHeading() && detailHeading().textContent === announcementFixtures[2].Title, 'lien direct hors du bandeau');
      announcementRouteOk = announcementRouteOk && detailSection().textContent.includes('DIRECT_DETAIL_ONLY') &&
        requests.some((url) => url.includes("getbytitle('Annonces')") && url.includes('$filter=Id eq 99'));
    }
  }
  console.log(`Détail d’annonce autonome, navigation et HTML nettoyé : ${announcementRouteOk && sanitizedOk ? 'OK' : 'ÉCHEC'}`);

  window.location.hash = '#annonces';
  await waitFor(() => detailHeading() && detailHeading().textContent === "Annonces de l'équipe", 'liste des annonces');
  const overviewOk = routeRoot.getAttribute('data-view') === 'annonce' &&
    !detailSection().textContent.includes('Annonce introuvable') &&
    (announcementScenario !== 'empty' || detailSection().textContent.includes('Aucune annonce en cours'));
  console.log(`Vue des dernières annonces / état vide réel : ${overviewOk ? 'OK' : 'ÉCHEC'}`);

  const returnLink = detailSection().querySelector('a[href="#accueil"]');
  returnLink.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  const announcementBackOk = routeRoot.getAttribute('data-view') === 'accueil' &&
    window.getComputedStyle(detailSection()).display === 'none' &&
    !renderRoot.querySelector('[data-bbi-view="actualite"]').children.length;

  const toggle = window.document.querySelector('[data-bbi-chrome-toggle]');
  toggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  const chromeRestored = !window.document.body.classList.contains('bbi-portal-open') &&
    !window.document.getElementById('bbi-portal-host') &&
    window.getComputedStyle(nativeChrome).visibility !== 'hidden';
  console.log(`Retour à l’accueil puis accès aux commandes SharePoint : ${announcementBackOk && chromeRestored ? 'OK' : 'ÉCHEC'}`);

  const allOk = styleOk && trainingRouteOk && homeRouteOk && orgRouteOk && kpiOk &&
    slidesOk && paginationOk && chromeOk && overlayOk && announcementRouteOk &&
    sanitizedOk && overviewOk && announcementBackOk && chromeRestored;
  console.log(`\n${allOk
    ? '✓ CSS, ACCUEIL, STATISTIQUES, ANNONCES DISTINCTES, NAVIGATION ET PLEIN ÉCRAN OK'
    : '✗ VÉRIFICATION EN ÉCHEC'} (mode ${mode}, ${pageMode}, ${announcementScenario})`);
  process.exit(allOk ? 0 : 1);
};
setTimeout(() => {
  verifyRender().catch((error) => {
    console.error('✗ VÉRIFICATION EN ERREUR :', error.message);
    process.exit(1);
  });
}, 300);
