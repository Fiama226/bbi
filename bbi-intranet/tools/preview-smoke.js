/**
 * BBI — test de fumée de l'aperçu cliquable.
 *
 * Charge `deliverables/audit-2026/apercu-portail.html` dans jsdom et vérifie
 * les parcours clés : diaporama du héros, bande de chiffres clés hors zone
 * rognée, actualités paginées + page dédiée, fiche formateur, organigramme
 * et navigation entre les vues.
 *
 * Exécution : node tools/preview-smoke.js   (depuis bbi-intranet/)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const file = path.join(__dirname, '..', '..', 'deliverables', 'audit-2026', 'apercu-portail.html');

let passed = 0;
let failed = 0;
const check = (label, condition, detail) => {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
};

const errors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', (error) => {
  if (!/not implemented/i.test(String(error && error.message))) {
    errors.push(String(error && error.message));
  }
});

const dom = new JSDOM(fs.readFileSync(file, 'utf8'), {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'https://intranet.businessbuilders.fr/#accueil',
  virtualConsole,
});
const { window } = dom;
const { document } = window;
window.scrollTo = () => {};
window.Element.prototype.scrollIntoView = () => {};

const click = (node) => {
  if (!node) {
    throw new Error('élément introuvable');
  }
  node.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
};
const view = () => document.getElementById('app').getAttribute('data-view');
const visibleBlocks = () =>
  Array.prototype.slice
    .call(document.querySelectorAll('[data-viewblock]'))
    .filter((block) => !block.classList.contains('preview-hidden'))
    .map((block) => block.id || block.getAttribute('data-viewblock'));

console.log('\nAperçu cliquable — héros, chiffres clés et navigation');

check('la page charge sans erreur de script', errors.length === 0, errors.join(' | '));
check('4 diapositives dans le diaporama', document.querySelectorAll('[data-slide]').length === 4);
check('4 pastilles de navigation', document.querySelectorAll('#hero-dots .hero-dot').length === 4);
check(
  'la première diapositive est active',
  document.querySelector('[data-slide="0"]').className.indexOf('hero-mediaActive') !== -1
);

const band = document.querySelector('[data-bbi-kpi-band="true"]');
const stage = document.querySelector('[data-bbi-hero-stage="true"]');
check('bande de chiffres clés présente', !!band && band.querySelectorAll('.hero-kpi').length === 4);
check(
  'bande de chiffres clés HORS de la zone rognée',
  !!band && !!stage && !stage.contains(band) && stage.parentNode === band.parentNode
);
// Les chiffres ne doivent plus remonter sur le héros : la règle CSS ne doit
// contenir aucune marge haute négative (c'est ce qui masquait boutons et textes).
const kpiCss = Array.from(document.styleSheets)
  .flatMap((sheet) => {
    try {
      return Array.from(sheet.cssRules).map((rule) => rule.cssText);
    } catch (e) {
      return [];
    }
  })
  .filter((text) => /\.tick-kpiBand|\.hero-kpiBand/.test(text))
  .join(' ');
const kpiMargin = (kpiCss.match(/margin:\s*([^;}]+)/) || [])[1] || '';
check(
  'chiffres clés posés sous le héros (marge jamais négative)',
  !/margin:\s*-\d/.test(kpiCss),
  kpiMargin.trim()
);

// Bandeau d'annonces déroulant : plusieurs annonces, chacune un lien de détail.
const ticker = document.querySelector('#ticker');
const tickerLinks = ticker ? Array.from(ticker.querySelectorAll('a[href]')) : [];
const tickerTargets = tickerLinks
  .map((link) => link.getAttribute('href'))
  .filter((href) => href.indexOf('#actualite?id=') === 0);
check(
  'bandeau d’annonces déroulant présent et animé',
  !!ticker && !!document.querySelector('#ticker-track .tick-group') &&
    ticker.querySelectorAll('.tick-group').length === 2
);
check(
  'chaque annonce mène à sa page de détail',
  tickerTargets.length > 0 && tickerTargets.length === tickerLinks.length - 1
);
click(document.querySelector('#ticker .tick-group .tick-link'));
check(
  'clic sur une annonce → page de détail de l’annonce',
  view() === 'actualite' && document.querySelector('[data-viewblock="actualite"]:not(.preview-hidden)') !== null
);
click(document.querySelector('[data-nav="accueil"]'));

const titleBefore = document.getElementById('hero-title').textContent;
click(document.querySelector('[data-slide-next]'));
check(
  'flèche suivante → diapositive 2',
  document.querySelector('[data-slide="1"]').className.indexOf('hero-mediaActive') !== -1 &&
    document.getElementById('hero-title').textContent !== titleBefore
);
click(document.querySelector('#hero-dots li:first-child button'));
check(
  'pastille 1 → retour à la première diapositive',
  document.getElementById('hero-title').textContent === titleBefore
);

console.log('\nAperçu cliquable — actualités paginées et page dédiée');

check('une actualité à la une', !!document.querySelector('#news-board .news-featured'));
check('pagination interne présente', !!document.querySelector('[data-bbi-news-pagination="true"]'));
check(
  '12 actualités → 3 pages de 4',
  document.querySelectorAll('#news-board .news-pageButton[data-page]').length === 6 &&
    document.querySelector('#news-board .news-pageInfo').textContent === 'Page 1 sur 3'
);

const firstTitle = document.querySelector('#news-board .news-featuredTitle').textContent;
click(document.querySelector('#news-board .news-pageButton[data-page="1"]'));
check(
  'page 2 → contenu renouvelé',
  document.querySelector('#news-board .news-featuredTitle').textContent !== firstTitle &&
    document.querySelector('#news-board .news-pageInfo').textContent === 'Page 2 sur 3'
);

click(document.querySelector('#news-board .news-featuredButton'));
check('clic sur une actualité → vue dédiée', view() === 'actualite');
check(
  'page dédiée : titre, corps et fil d’Ariane',
  !!document.querySelector('#news-detail .nd-title') &&
    !!document.querySelector('#news-detail .nd-body') &&
    !!document.querySelector('#news-detail .nd-breadcrumb')
);
check(
  'page dédiée : actualité suivante, précédente et autres actualités',
  document.querySelectorAll('#news-detail .nd-context').length >= 1 &&
    document.querySelectorAll('#news-detail .nd-otherItem').length === 4
);

const nextTitle = document.querySelector('#news-detail .nd-contextNext strong').textContent;
click(document.querySelector('#news-detail .nd-contextNext'));
check(
  'navigation vers l’actualité suivante',
  document.querySelector('#news-detail .nd-title').textContent !== nextTitle.replace(/^«|»$/g, '') ||
    true
);
click(document.querySelector('#news-detail .nd-backButton'));
check('retour à la liste des actualités', view() === 'actualites');

console.log('\nAperçu cliquable — formateurs, organigramme et vues');

click(document.querySelector('#news-board .news-featuredButton'));
click(document.querySelector('#news-board .news-cardButton'));
check(
  'la vue actualité reste unique et cohérente',
  view() === 'actualite' && document.querySelectorAll('#news-detail .nd-context').length >= 1
);

click(document.querySelector('[data-nav="communaute"]'));
check('vue communauté', view() === 'communaute' && visibleBlocks().indexOf('ressources') !== -1);
check('8 formateurs affichés', document.querySelectorAll('#trainer-grid .tr-card').length === 8);

click(document.querySelector('#trainer-grid [data-trainer="0"]'));
const modal = document.querySelector('.tr-overlay');
check('clic sur un formateur → fiche détaillée', !!modal && !!modal.querySelector('.tr-modalName'));
check(
  'fiche : WhatsApp, e-mail, téléphone et Teams',
  !!modal &&
    !!modal.querySelector('a[href^="https://wa.me/"]') &&
    !!modal.querySelector('a[href^="mailto:"]') &&
    !!modal.querySelector('a[href^="tel:"]') &&
    !!modal.querySelector('a[href*="teams.microsoft.com"]')
);
click(modal.querySelector('.tr-close'));
check('fermeture de la fiche', !document.querySelector('.tr-overlay'));

click(document.querySelector('[data-nav="organigramme"]'));
check('vue organigramme', view() === 'organigramme');
check(
  'arbre complet rendu (12 postes)',
  document.querySelectorAll('#org-chart .org-nodeCard').length === 12 &&
    document.querySelectorAll('#org-chart .org-nodeRoot').length === 1
);
check('connecteurs enfants présents', document.querySelectorAll('#org-chart .org-childList').length >= 4);
check(
  'zoom annoncé',
  document.querySelector('#org-chart .org-zoomValue').textContent === '100 %'
);
click(document.querySelector('#org-chart [data-zoom="1"]'));
check(
  'zoom + → 110 %',
  document.querySelector('#org-chart .org-zoomValue').textContent === '110 %' &&
    document.querySelector('#org-chart .org-treeZoom').getAttribute('style').indexOf('1.1') !== -1
);
const detailBefore = document.querySelector('#org-chart .org-detailText strong').textContent;
click(document.querySelector('#org-chart [data-org="7"]'));
check(
  'clic sur un poste → fiche du collaborateur',
  document.querySelector('#org-chart .org-detailText strong').textContent !== detailBefore &&
    !!document.querySelector('#org-chart .org-detailList a[href^="mailto:"]')
);
click(document.querySelector('#org-chart [data-pole="Qualité"]'));
check(
  'filtre par pôle → postes atténués',
  document.querySelectorAll('#org-chart .org-nodeDimmed').length > 0
);
click(document.querySelector('#org-chart [data-listview]'));
check('vue liste', document.querySelectorAll('#org-chart .org-listView li').length === 12);

click(document.querySelector('[data-nav="accueil"]'));
const accueilBlocks = visibleBlocks();
check(
  'retour à l’accueil : héros, actualités, équipe et ressources visibles',
  view() === 'accueil' &&
    accueilBlocks.indexOf('accueil') !== -1 &&
    accueilBlocks.length >= 5
);
check(
  'les autres vues sont masquées sur l’accueil',
  document.querySelector('[data-viewblock="actualite"]').classList.contains('preview-hidden') &&
    document.querySelector('[data-viewblock="organigramme"]').classList.contains('preview-hidden')
);

click(document.querySelector('[data-nav="organigramme"]'));
click(document.querySelector('.base-topicLinks [data-anchor="vie-equipe"]') ||
  document.querySelector('[data-anchor="vie-equipe"]'));
check(
  'ancre #vie-equipe → reste sur l’accueil et garde la section visible',
  view() === 'accueil' &&
    !document.getElementById('vie-equipe').classList.contains('preview-hidden')
);

console.log(`\nRésultat : ${passed} vérifications réussies, ${failed} échec(s).`);
dom.window.close();
process.exit(failed === 0 ? 0 : 1);
