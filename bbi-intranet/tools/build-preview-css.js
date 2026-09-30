/**
 * BBI — génération de la feuille de styles de l'aperçu HTML.
 *
 * Compile les vrais modules SCSS des composants du portail, préfixe les classes
 * par composant (comme le fait CSS Modules à l'exécution) puis écrit
 * `deliverables/audit-2026/apercu-portail.css`, utilisé par la maquette
 * cliquable `deliverables/audit-2026/apercu-portail.html`.
 *
 * Exécution : node tools/build-preview-css.js   (depuis bbi-intranet/)
 * Les visuels référencés sont copiés dans deliverables/audit-2026/assets/.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const sass = require('sass');
const postcss = require('postcss');

const root = path.join(__dirname, '..');
const componentsDir = path.join(root, 'src/webparts/bbiHome/components');
const outDir = path.join(root, '..', 'deliverables/audit-2026');
const outAssets = path.join(outDir, 'assets');
const cssFile = path.join(outDir, 'apercu-portail.css');

/** Un préfixe par composant : aucune collision de classes entre les modules. */
const MODULES = [
  { file: 'BbiHome.module.scss', prefix: 'base-', title: 'Page d’accueil (structure)' },
  { file: 'HomeHero.module.scss', prefix: 'hero-', title: 'Héros en diaporama + chiffres clés' },
  { file: 'NewsBoard.module.scss', prefix: 'news-', title: 'Fil d’actualités paginé' },
  { file: 'NewsDetail.module.scss', prefix: 'nd-', title: 'Page dédiée à une actualité' },
  { file: 'TeamHighlights.module.scss', prefix: 'team-', title: 'Employé du mois + certifications' },
  { file: 'TrainerDirectory.module.scss', prefix: 'tr-', title: 'Annuaire des formateurs + fiche' },
  { file: 'OrgChart.module.scss', prefix: 'org-', title: 'Organigramme interactif' },
  { file: 'AnnouncementTicker.module.scss', prefix: 'tick-', title: 'Annonces déroulantes' },
];

/** Visuels utilisés par l'aperçu (copiés depuis les ressources des web parts). */
const ASSETS = [
  { from: 'src/webparts/bbiHome/assets/hero-formation.jpg', to: 'hero-formation.jpg' },
  { from: 'src/webparts/bbiHome/assets/hero-management.jpg', to: 'hero-management.jpg' },
  { from: 'src/webparts/bbiHome/assets/hero-seminaire.jpg', to: 'hero-seminaire.jpg' },
  { from: 'src/webparts/bbiHome/assets/hero-coaching.jpg', to: 'hero-coaching.jpg' },
  { from: 'src/webparts/bbiHome/assets/news-certification.jpg', to: 'news-certification.jpg' },
  { from: 'src/webparts/bbiHome/assets/logo.png', to: 'logo.png' },
  { from: 'src/webparts/bbiGallery/assets/galerie-atelier.jpg', to: 'galerie-atelier.jpg' },
  { from: 'src/webparts/bbiGallery/assets/galerie-certification.jpg', to: 'galerie-certification.jpg' },
  { from: 'src/webparts/bbiGallery/assets/galerie-studio.jpg', to: 'galerie-studio.jpg' },
];

const classPattern = /\.([A-Za-z0-9_-]+)/g;

/** Préfixe toutes les classes d'une règle (hors @keyframes). */
const prefixRule = (selector, prefix) =>
  selector.replace(classPattern, (_, name) => `.${prefix}${name}`);

function buildModule(entry) {
  const file = path.join(componentsDir, entry.file);
  const compiled = sass.renderSync({
    file,
    outputStyle: 'expanded',
    quietDeps: true,
    charset: false,
  }).css.toString('utf8');

  const root = postcss.parse(compiled);
  root.walkRules((rule) => {
    const parent = rule.parent;
    if (parent && parent.type === 'atrule' && /keyframes/i.test(parent.name)) {
      return;
    }
    rule.selector = rule.selector
      .split(',')
      .map((part) => prefixRule(part.trim(), entry.prefix))
      .join(', ');
  });

  return `/* ===== ${entry.title} — source : ${entry.file} ===== */\n${root.toString()}`;
}

fs.mkdirSync(outAssets, { recursive: true });
ASSETS.forEach((asset) => {
  const source = path.join(root, asset.from);
  if (fs.existsSync(source)) {
    fs.copyFileSync(source, path.join(outAssets, asset.to));
  }
});

const header = [
  '/* GÉNÉRÉ AUTOMATIQUEMENT par bbi-intranet/tools/build-preview-css.js',
  '   Ne pas modifier à la main : styles compilés depuis les composants SPFx livrés. */\n',
].join('\n');

const body = MODULES.map(buildModule).join('\n\n');
const css = `${header}\n${body}\n`.replace(/url\("\.\.\/assets\//g, 'url("assets/');

fs.writeFileSync(cssFile, css, 'utf8');
console.log(`✓ ${path.relative(root, cssFile)} — ${Math.round(css.length / 1024)} Ko`);
console.log(`✓ visuels copiés dans ${path.relative(root, outAssets)}`);
