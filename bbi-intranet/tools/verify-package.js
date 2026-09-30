/* eslint-disable no-console */
/**
 * @file tools/verify-package.js
 *
 * Verifie un livrable SPFx AVANT de le téléverser dans le catalogue d'applications.
 *
 * L'erreur du workbench
 *   Could not load <entryModuleId> in require. Error: Script error for "<id>_<version>"
 * signifie une seule chose : le navigateur n'a PAS réussi à télécharger le bundle JS
 * de la web part. Le manifeste, lui, s'est bien chargé (sinon la web part n'apparaîtrait
 * pas dans la boîte à outils). La cause est donc presque toujours :
 *   - un manifeste qui pointe vers un fichier absent du package / de la bibliothèque
 *     « Client Side Assets »  (cas : package périmé, assets non déployés, version en
 *     cache côté SharePoint), ou
 *   - le serveur de debug local (https://localhost:4321) arrêté, périmé ou son
 *     certificat auto-signé non accepté.
 *
 * Ce script attrape le premier cas mécaniquement, sur le .sppkg réel :
 *   1. il ouvre le .spppk (lecteur ZIP intégré, aucune dépendance) ;
 *   2. il lit chaque manifeste embarqué dans les éléments <ClientSideComponent> ;
 *   3. il résout chaque ressource de script par rapport à internalModuleBaseUrls ;
 *   4. il vérifie que le fichier existe réellement dans ClientSideAssets/ ;
 *   5. il vérifie que [Content_Types].xml déclare bien l'extension ;
 *   6. il signale les bundles orphelins (embarqués mais référencés par personne).
 *
 * Usage :
 *   node tools/verify-package.js                       # deliverables/spfx/bbi-intranet.sppkg
 *   node tools/verify-package.js chemin/package.sppkg  # un package précis
 *   node tools/verify-package.js --dev                 # vérifie le chemin « workbench debug »
 *                                                        (temp/manifests.js + dist/) après npm run start
 *
 * Sortie : code 0 si tout est conforme, code 1 sinon (utilisable en CI / pré-upload).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT = path.resolve(__dirname, '..');
/** Emplacements possibles du package livré (racine du dépôt ou du projet). */
const PACKAGE_CANDIDATES = [
  path.join(ROOT, 'deliverables', 'spfx', 'bbi-intranet.sppkg'),
  path.join(ROOT, '..', 'deliverables', 'spfx', 'bbi-intranet.sppkg'),
  path.join(ROOT, 'sharepoint', 'solution', 'bbi-intranet.sppkg'),
];
function findDefaultPackage() {
  return PACKAGE_CANDIDATES.find((p) => fs.existsSync(p)) || PACKAGE_CANDIDATES[0];
}

const C = {
  ok: '\u001b[32m',
  warn: '\u001b[33m',
  err: '\u001b[31m',
  dim: '\u001b[2m',
  off: '\u001b[0m',
};

/** Compteurs partagés entre les deux modes. */
function newReport() {
  return { ok: 0, warn: 0, err: 0 };
}
function pass(report, msg) {
  report.ok += 1;
  console.log(`  ${C.ok}\u2713${C.off} ${msg}`);
}
function warn(report, msg) {
  report.warn += 1;
  console.log(`  ${C.warn}!${C.off} ${msg}`);
}
function fail(report, msg) {
  report.err += 1;
  console.log(`  ${C.err}\u2717${C.off} ${msg}`);
}
function heading(msg) {
  console.log(`\n${C.dim}\u2500\u2500\u2500 ${msg} ${C.off}`);
}

/* ------------------------------------------------------------------------- *
 * Lecteur ZIP minimal (aucune dépendance) : store (0) + deflate (8)
 * ------------------------------------------------------------------------- */
function readZip(file) {
  const buf = fs.readFileSync(file);
  const entries = new Map();
  let p = 0;
  while (p + 30 <= buf.length && buf.readUInt32LE(p) === 0x04034b50) {
    const method = buf.readUInt16LE(p + 8);
    const csize = buf.readUInt32LE(p + 18);
    const nlen = buf.readUInt16LE(p + 26);
    const elen = buf.readUInt16LE(p + 28);
    const name = buf.toString('utf8', p + 30, p + 30 + nlen);
    const start = p + 30 + nlen + elen;
    const raw = buf.subarray(start, start + csize);
    entries.set(name, method === 8 ? zlib.inflateRawSync(raw) : Buffer.from(raw));
    p = start + csize;
  }
  return entries;
}

/* ------------------------------------------------------------------------- *
 * Helpers manifestes
 * ------------------------------------------------------------------------- */
const ENTITIES = {
  '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>',
  '&#39;': "'", '&#x2F;': '/', '&amp;': '&',
};
function decodeEntities(s) {
  return s.replace(/&(quot|apos|lt|gt|#39|#x2F|amp);/g, (m, g) => ENTITIES[`&${g};`]);
}

/**
 * Extrait tous les manifestes de composants d'un .sppkg en lisant les éléments
 * <ClientSideComponent ComponentManifest="..."> des fichiers de la feature.
 */
function extractManifestsFromSppkg(entries) {
  const manifests = [];
  for (const [name, data] of entries) {
    if (!name.endsWith('.xml')) continue;
    if (!/^(?:[^/]+\/)?(?:WebPart|Extension)_[0-9a-fA-F-]{36}\.xml$/.test(name)) continue;
    const xml = data.toString('utf8');
    const re = /<ClientSideComponent\b[^>]*>/g;
    let m;
    while ((m = re.exec(xml)) !== null) {
      const tag = m[0];
      const mm = tag.match(/ComponentManifest="([^"]*)"/);
      if (!mm) continue;
      let manifest;
      try {
        manifest = JSON.parse(decodeEntities(mm[1]));
      } catch (e) {
        manifests.push({ source: name, parseError: e.message, manifest: null });
        continue;
      }
      const title = decodeEntities((tag.match(/Name="([^"]*)"/) || [])[1] || manifest.alias);
      manifests.push({ source: name, title, manifest });
    }
  }
  return manifests;
}

/**
 * Normalise un chemin de ressource de manifeste en nom de fichier réellement
 * présent dans le dossier ClientSideAssets du package.
 *
 * internalModuleBaseUrls = ["HTTPS://SPCLIENTSIDEASSETLIBRARY/"]
 * scriptResource         = "../assets/xxx.js"
 *  -> le loader concatène : HTTPS://SPCLIENTSIDEASSETLIBRARY/../assets/xxx.js
 *  -> SharePoint dépose les fichiers à la racine de la bibliothèque, donc le
 *     fichier à vérifier est simplement « xxx.js » dans ClientSideAssets/.
 */
function resourceBasename(resourcePath) {
  const p = String(resourcePath).replace(/\\/g, '/');
  return p.split('/').pop();
}

/**
 * Détecte la forme compacte des « localizedPath » émise par spfx-heft-plugins
 * en mode debug :  { p: "prefixe_", l: { "en-US": "en-us_<hash>" }, s: ".js" }
 */
function isCompactPaths(paths) {
  return (
    !!paths &&
    typeof paths === 'object' &&
    typeof paths.p === 'string' &&
    typeof paths.s === 'string' &&
    !!paths.l &&
    typeof paths.l === 'object'
  );
}

/** Retourne la liste { name, path } des ressources de script d'un manifeste. */
function scriptResourcePaths(manifest) {
  const lc = (manifest && manifest.loaderConfig) || {};
  const sr = lc.scriptResources || {};
  const out = [];
  for (const [resourceName, resource] of Object.entries(sr)) {
    if (!resource || typeof resource !== 'object') continue;
    if (resource.type === 'localizedPath') {
      const paths = resource.paths || {};
      if (isCompactPaths(paths)) {
        // Forme compacte émise par spfx-heft-plugins en mode debug :
        //   { p: "prefixe_", l: { "en-US": "en-us_<hash>" }, s: ".js" }
        // On reconstitue les vrais chemins par locale pour pouvoir les vérifier.
        const { p: prefix, l: locales, s: suffix } = paths;
        for (const [locale, value] of Object.entries(locales || {})) {
          const body = typeof value === 'string' ? value : value[0];
          if (typeof body === 'string') {
            out.push({ name: `${resourceName} [${locale}]`, path: `${prefix}${body}${suffix}` });
          }
        }
      } else {
        for (const [locale, p] of Object.entries(paths)) {
          if (typeof p === 'string') out.push({ name: `${resourceName} [${locale}]`, path: p });
        }
      }
      if (typeof resource.defaultPath === 'string') {
        out.push({ name: `${resourceName} [default]`, path: resource.defaultPath });
      }
    } else if (resource.type === 'path') {
      out.push({ name: resourceName, path: resource.path });
    }
    // type === 'component' : résolu par SharePoint depuis le catalogue, rien à vérifier ici.
  }
  return out;
}

/* ------------------------------------------------------------------------- *
 * Mode 1 : vérifier un .sppkg (chemin « production »)
 * ------------------------------------------------------------------------- */
function verifyPackage(packagePath, report) {
  heading(`Package : ${packagePath}`);
  if (!fs.existsSync(packagePath)) {
    fail(report, `introuvable : ${packagePath}`);
    console.log(
      `${C.dim}   Emplacements cherchés :\n` +
        PACKAGE_CANDIDATES.map((p) => `     ${p}`).join('\n') +
        `\n   Générez-le avec :  npm run clean && npm run build  ` +
        `puis copiez sharepoint/solution/bbi-intranet.sppkg vers deliverables/spfx/${C.off}`,
    );
    return;
  }

  const entries = readZip(packagePath);
  const sizeKb = Math.round(fs.statSync(packagePath).size / 1024);
  console.log(`  ${C.dim}${entries.size} entrées, ${sizeKb} Ko${C.off}`);

  // --- Types de contenu -----------------------------------------------------
  const ct = entries.get('[Content_Types].xml');
  if (!ct) {
    fail(report, '[Content_Types].xml absent du package');
  } else {
    const declared = new Set();
    for (const m of ct.toString('utf8').matchAll(/<Default\s+Extension="([^"]+)"/g)) {
      declared.add(m[1].toLowerCase());
    }
    if (declared.has('js')) {
      pass(report, '[Content_Types].xml déclare bien l’extension « js »');
    } else {
      fail(report, '[Content_Types].xml NE déclare PAS « js » : SharePoint refusera de servir les bundles');
    }
  }

  // --- Manifestes -----------------------------------------------------------
  const manifests = extractManifestsFromSppkg(entries);
  if (manifests.length === 0) {
    fail(report, 'aucun <ClientSideComponent> trouvé : package non reconnu ou corrompu');
    return;
  }

  const assetNames = new Set();
  for (const name of entries.keys()) {
    const base = name.split('/').pop();
    if (name.includes('ClientSideAssets/')) assetNames.add(base);
  }

  const referenced = new Set();
  let bad = 0;

  for (const item of manifests) {
    if (!item.manifest) {
      fail(report, `${item.source} : manifeste illisible (${item.parseError})`);
      bad += 1;
      continue;
    }
    const m = item.manifest;
    const id = m.id;
    const version = m.version === undefined ? '(non défini)' : m.version;
    const entry = (m.loaderConfig || {}).entryModuleId;
    const bases = (m.loaderConfig || {}).internalModuleBaseUrls || [];

    if (!entry) {
      fail(report, `${id} : aucun loaderConfig.entryModuleId`);
      bad += 1;
      continue;
    }
    if (!bases.length) {
      fail(report, `${id} : aucun internalModuleBaseUrls`);
      bad += 1;
      continue;
    }

    const resources = scriptResourcePaths(m);
    let missing = [];
    for (const r of resources) {
      const base = resourceBasename(r.path);
      referenced.add(base);
      if (!assetNames.has(base)) missing.push(`${r.name} -> ${r.path}`);
    }
    if (missing.length) {
      fail(report, `${id} (${item.title}) v${version} : ${missing.length} ressource(s) absente(s)`);
      for (const x of missing) console.log(`        ${C.err}manque${C.off} ${x}`);
      bad += 1;
    } else {
      pass(report, `${id} (${item.title}) v${version} : ${resources.length} ressource(s) présentes`);
    }
  }

  // --- Orphelins ------------------------------------------------------------
  const orphans = [...assetNames].filter(
    (n) => n.endsWith('.js') && !referenced.has(n),
  );
  if (orphans.length) {
    warn(
      report,
      `${orphans.length} bundle(s) orphelin(s) embarqué(s) mais référencé(s) par aucun manifeste ` +
        `(build sans nettoyage : lancez « npm run clean » avant « npm run build »)`,
    );
    for (const o of orphans) console.log(`        ${C.dim}${o}${C.off}`);
  } else {
    pass(report, 'aucun bundle orphelin : le package correspond exactement aux manifestes');
  }

  heading('Résultat');
  if (bad === 0 && report.err === 0) {
    console.log(
      `  ${C.ok}Package cohérent : tous les bundles référencés sont embarqués.${C.off}\n` +
        `  ${C.dim}Rappel : un package cohérent ne suffit pas \u2014 il faut aussi le Déployer ` +
        `(bouton « Deploy »), sinon la bibliothèque « Client Side Assets » reste vide.${C.off}`,
    );
  } else {
    console.log(
      `  ${C.err}Package INCOHÉRENT \u2014 ne le téléversez pas.${C.off}\n` +
        `  ${C.dim}Reconstruisez proprement :  npm run clean && npm run build${C.off}`,
    );
  }
}

/* ------------------------------------------------------------------------- *
 * Mode 2 : vérifier le chemin « workbench debug » (npm run start)
 * ------------------------------------------------------------------------- */
function verifyDev(report) {
  heading('Workbench debug (serveur local)');
  const manifestsFile = path.join(ROOT, 'temp', 'manifests.js');

  if (!fs.existsSync(manifestsFile)) {
    fail(report, `${manifestsFile} introuvable : lancez \u00ab npm run start \u00bb et attends la fin du premier build`);
    return;
  }
  pass(report, `temp/manifests.js pr\u00e9sent (${Math.round(fs.statSync(manifestsFile).size / 1024)} Ko)`);

  // Le fichier est un script qui finit par : self.debugManifests = a, define([], () => a)
  // La liste des manifestes est le premier litt\u00e9ral tableau [{...},{...}] qui suit
  // l'IIFE de calcul du publicPath :  ...})();const t=[{"id":"...", ...}];
  const src = fs.readFileSync(manifestsFile, 'utf8');
  if (src.indexOf('self.debugManifests') === -1) {
    fail(report, 'temp/manifests.js : structure inattendue (pas de self.debugManifests)');
    return;
  }
  const iifeEnd = src.indexOf('})();');
  const start = src.indexOf('[{', iifeEnd === -1 ? 0 : iifeEnd);
  if (start === -1) {
    fail(report, 'temp/manifests.js : tableau de manifestes introuvable');
    return;
  }

  // Équilibrage des crochets en respectant les chaînes JSON.
  let depth = 0;
  let endIdx = -1;
  let inStr = false;
  let quote = '';
  for (let i = start; i < src.length; i += 1) {
    const ch = src[i];
    if (inStr) {
      if (ch === '\\') i += 1;
      else if (ch === quote) inStr = false;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = true;
      quote = ch;
    } else if (ch === '[') depth += 1;
    else if (ch === ']') {
      depth -= 1;
      if (depth === 0) {
        endIdx = i + 1;
        break;
      }
    }
  }
  if (endIdx === -1) {
    fail(report, 'temp/manifests.js : tableau de manifestes mal ferm\u00e9');
    return;
  }

  let manifests;
  try {
    manifests = JSON.parse(src.slice(start, endIdx));
  } catch (e) {
    fail(report, `temp/manifests.js : JSON illisible (${e.message})`);
    return;
  }

  // Chaque manifeste porte son propre internalModuleBaseUrls : dist/ pour les
  // composants du projet, node_modules/<pkg>/dist/ pour les bibliothèques SPFx.
  // On résout donc l'URL racine en dossier local avant de vérifier les fichiers.
  const devRoot = 'https://localhost:4321/';
  function localDirFor(baseUrl) {
    if (!baseUrl || baseUrl.indexOf(devRoot) !== 0) return null;
    return path.join(ROOT, baseUrl.slice(devRoot.length));
  }

  let bad = 0;
  let checked = 0;
  const missingDirs = new Set();
  for (const m of manifests) {
    const lc = m.loaderConfig || {};
    const base = (lc.internalModuleBaseUrls || [])[0] || '';
    const dir = localDirFor(base);
    if (!dir) continue; // servi par le CDN Microsoft : hors périmètre
    if (!fs.existsSync(dir)) {
      // Dossier annoncé par le manifeste mais absent du disque : c'est
      // exactement l'état qui provoque « Script error for ... ».
      missingDirs.add(base);
      bad += 1;
      continue;
    }
    checked += 1;

    const files = new Set(fs.readdirSync(dir));
    const resources = scriptResourcePaths(m);
    const missing = [];
    for (const r of resources) {
      // Les chemins de ressources du mode debug sont relatifs au dossier du manifeste.
      const rel = String(r.path).replace(/^\.\.\//, '').split('/').pop();
      if (rel && !files.has(rel)) missing.push(`${r.name} -> ${r.path}`);
    }
    if (missing.length) {
      fail(report, `${m.id} (${m.alias}) : ${missing.length} bundle(s) absent(s) de ${base}`);
      for (const x of missing) console.log(`        ${C.err}manque${C.off} ${x}`);
      bad += 1;
    } else {
      pass(report, `${m.id} (${m.alias}) : ${resources.length} bundle(s) pr\u00e9sent(s)`);
    }
  }

  if (missingDirs.size) {
    for (const d of missingDirs) {
      fail(report, `dossier de sortie absent : ${d} \u2014 lance \u00ab npm run start \u00bb et attends la fin du premier build`);
    }
  }

  heading('R\u00e9sultat');
  console.log(`  ${C.dim}${checked} manifeste(s) servis localement v\u00e9rifi\u00e9(s)${C.off}`);
  if (bad === 0) {
    console.log(
      `  ${C.ok}Serveur local coh\u00e9rent.${C.off}\n` +
        `  ${C.dim}URL \u00e0 utiliser dans le workbench h\u00e9berg\u00e9 :${C.off}\n` +
        `  ${debugBenchUrl()}${C.off}`,
    );
  } else {
    console.log(
      `  ${C.err}Incoh\u00e9rence d\u00e9tect\u00e9e.${C.off}\n` +
        `  ${C.dim}Rafra\u00eechissez la page du workbench apr\u00e8s chaque recompilation webpack ` +
        `(les hachages de fichiers changent) : c'est la cause n\u00b02 du \u00ab Script error \u00bb.${C.off}`,
    );
  }
}

function debugBenchUrl() {
  return (
    'https://<votre-tenant>.sharepoint.com/_layouts/15/workbench.aspx' +
    '?debug=true&noredir=true&debugManifestsFile=https://localhost:4321/temp/manifests.js'
  );
}

/* ------------------------------------------------------------------------- */
function main() {
  const args = process.argv.slice(2);
  const devMode = args.includes('--dev');
  const report = newReport();

  console.log(`${C.dim}BBI \u2014 vérification du livrable SPFx${C.off}`);

  if (devMode) {
    verifyDev(report);
  } else {
    const pkg = args.find((a) => !a.startsWith('-')) || findDefaultPackage();
    verifyPackage(pkg, report);
  }

  console.log(
    `\n${report.ok ? C.ok + report.ok + ' OK' + C.off : ''}` +
      `${report.warn ? '  ' + C.warn + report.warn + ' avertissement(s)' + C.off : ''}` +
      `${report.err ? '  ' + C.err + report.err + ' erreur(s)' + C.off : ''}`,
  );
  process.exit(report.err > 0 ? 1 : 0);
}

main();
