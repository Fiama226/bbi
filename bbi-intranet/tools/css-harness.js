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
 * Exécution : node tools/css-harness.js [dist|release]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const mode = process.argv[2] === 'release' ? 'release' : 'dist';
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
  url: 'https://businessbuilderinter.sharepoint.com/_layouts/15/workbench.aspx',
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
    get: () => Promise.reject(new Error('no network in harness')),
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
setTimeout(() => {
  const styles = window.document.head.querySelectorAll('style');
  const allCss = Array.from(styles)
    .map((s) => s.textContent || '')
    .join('\n');

  const rendered = hostDiv.innerHTML;
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
  const kpiBand = hostDiv.querySelector('[data-bbi-kpi-band]');
  const kpiInsideStage = hostDiv.querySelector('[data-bbi-hero-stage] [data-bbi-kpi-band]');
  const kpiCount = hostDiv.querySelectorAll('[data-bbi-kpi-band] > li').length;
  const slideCount = hostDiv.querySelectorAll('[data-bbi-hero-slide]').length;
  const pagination = hostDiv.querySelector('[data-bbi-news-pagination]');
  console.log(
    `Bande de chiffres clés : ${kpiBand ? `${kpiCount} chiffre(s)` : 'ABSENTE'} — hors zone rognée : ${
      kpiBand && !kpiInsideStage ? 'OUI' : 'NON'
    }`
  );
  console.log(`Diapositives du héros : ${slideCount}`);
  console.log(`Pagination des actualités : ${pagination ? 'PRÉSENTE' : 'ABSENTE'}`);

  const kpiOk = !!kpiBand && !kpiInsideStage && kpiCount >= 3;
  const slidesOk = slideCount >= 2;
  const paginationOk = !!pagination;

  const routeRoot = hostDiv.querySelector('#bbi-home-root');
  const trainingLink = hostDiv.querySelector('header nav a[href="#formations"]');
  if (trainingLink) {
    trainingLink.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  }
  const trainingRouteOk = routeRoot && routeRoot.getAttribute('data-view') === 'formations';
  const homeLink = hostDiv.querySelector('header nav a[href="#accueil"]');
  if (homeLink) {
    homeLink.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  }
  const homeRouteOk = routeRoot && routeRoot.getAttribute('data-view') === 'accueil';
  console.log(`Navigation SPA (Accueil → Formations → Accueil) : ${trainingRouteOk && homeRouteOk ? 'OK' : 'ÉCHEC'}`);

  const orgLink = hostDiv.querySelector('header nav a[href="#organigramme"]');
  if (orgLink) {
    orgLink.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  }
  const orgRouteOk = !!orgLink && routeRoot && routeRoot.getAttribute('data-view') === 'organigramme';
  console.log(`Navigation SPA vers #organigramme : ${orgRouteOk ? 'OK' : 'ÉCHEC'}`);

  const allOk =
    styleOk && trainingRouteOk && homeRouteOk && orgRouteOk && kpiOk && slidesOk && paginationOk;
  console.log(
    `\n${
      allOk
        ? '✓ CSS, HÉROS (DIAPORAMA + CHIFFRES CLÉS HORS ZONE ROGNÉE), PAGINATION ET NAVIGATION OK'
        : '✗ VÉRIFICATION EN ÉCHEC'
    } (mode ${mode})`
  );
  process.exit(allOk ? 0 : 1);
}, 300);
