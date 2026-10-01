/**
 * BBI — annonces internes : tests du module TypeScript et de ses helpers réels.
 * Aucun réseau / tenant requis. Exécution : node tools/verify-announcements.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const modules = new Map();
const testWindow = { location: { href: 'https://tenant.sharepoint.com/sites/intranet/', protocol: 'https:' } };

function loadTs(relativePath) {
  const file = path.resolve(root, relativePath);
  if (modules.has(file)) {
    return modules.get(file).exports;
  }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: file,
  }).outputText;
  const module = { exports: {} };
  modules.set(file, module);
  const localRequire = (name) => {
    if (name === '@microsoft/sp-http') {
      return { SPHttpClient: { configurations: { v1: {} } } };
    }
    if (name.startsWith('.')) {
      return loadTs(path.resolve(path.dirname(file), `${name}.ts`));
    }
    return require(name);
  };
  new Function('require', 'exports', 'module', 'window', code)(localRequire, module.exports, module, testWindow);
  return module.exports;
}

const { loadAnnouncements, DEMO_ANNOUNCEMENTS, iconForAnnouncement } = loadTs(
  'src/webparts/bbiHome/components/announcementData.ts',
);
let passed = 0;
function check(label, condition) {
  assert(condition, label);
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const fields = ['Id', 'Title', 'Created', 'Author', 'Body', 'AnnonceType', 'EventDate', 'ExpiresOn', 'Image'];
const fixtures = [
  {
    Id: 23,
    Title: 'Mariage de notre collègue',
    Body: '<p>Félicitations à notre collègue.</p>',
    AnnonceType: 'Mariage',
    EventDate: '2026-09-28T12:00:00Z',
    Created: '2026-09-29T12:00:00Z',
    ExpiresOn: '2099-10-01T12:00:00Z',
    Image: { Url: 'https://tenant.sharepoint.com/sites/intranet/photo.jpg' },
    Author: { Title: 'RH' },
  },
  {
    Id: 99,
    Title: 'Anniversaire ancien',
    Body: 'Détails de l’annonce 99',
    AnnonceType: 'Anniversaire',
    Created: '2000-01-01T00:00:00Z',
    ExpiresOn: '2000-01-02T00:00:00Z',
  },
];

/** Simule SharePoint : champs, filtre d'ID/expiration, tri et $top. */
function clientOf(items, availableFields = fields) {
  const calls = [];
  return {
    calls,
    get: async (url) => {
      calls.push(url);
      const endpoint = new URL(url);
      if (endpoint.pathname.endsWith('/fields')) {
        return { ok: true, json: async () => ({ value: availableFields.map((InternalName) => ({ InternalName })) }) };
      }
      assert(endpoint.pathname.endsWith('/items'), `Endpoint inattendu : ${url}`);
      const filter = endpoint.searchParams.get('$filter') || '';
      const id = (filter.match(/^Id eq (\d+)$/) || [])[1];
      let selected = items.slice();
      if (id) {
        selected = selected.filter((item) => item.Id === Number(id));
      } else if (filter.includes('datetime')) {
        selected = selected.filter((item) => !item.ExpiresOn || new Date(item.ExpiresOn).getTime() >= Date.now());
      }
      selected.sort((a, b) => (b.Created || '').localeCompare(a.Created || ''));
      selected = selected.slice(0, Number(endpoint.searchParams.get('$top')) || 8);
      return { ok: true, json: async () => ({ value: selected }) };
    },
  };
}

(async () => {
  console.log('Annonces internes — données et liens indépendants des actualités');
  const site = 'https://tenant.sharepoint.com/sites/intranet';
  const client = clientOf(fixtures);
  const result = await loadAnnouncements(client, site, 'Annonces', 8);
  check('liste Annonces uniquement (jamais Actualites)', client.calls.every((url) => url.includes("getbytitle('Annonces')")));
  check('données réelles, pas d’exemples', !result.isDemo && result.items.length === 1);
  check('ID et titre lus', result.items[0].Id === 23 && result.items[0].Title === fixtures[0].Title);
  check('type mariage et détails lus', result.items[0].Type === 'Mariage' && result.items[0].Body === fixtures[0].Body);
  check('date de l’événement lue', result.items[0].EventDate === fixtures[0].EventDate);
  check('auteur SharePoint développé', result.items[0].Author === 'RH' && client.calls[1].includes('$expand=Author'));
  check('colonne lien image normalisée', result.items[0].ImageUrl === fixtures[0].Image.Url);
  check('annonce expirée exclue du bandeau', !result.items.some((item) => item.Id === 99));
  check('filtre d’expiration envoyé au serveur', client.calls[1].includes('ExpiresOn eq null') && client.calls[1].includes('ExpiresOn ge datetime'));
  check('tri et limite du bandeau envoyés', client.calls[1].includes('$orderby=Created desc') && client.calls[1].includes('$top=8'));

  const requestCount = client.calls.length;
  const cached = await loadAnnouncements(client, `${site}/`, 'Annonces', 8);
  check('cache par site / liste / taille (pas de nouvel appel)', cached === result && client.calls.length === requestCount);

  const direct = await loadAnnouncements(client, site, 'Annonces', 1, 99);
  check('lien direct hors du bandeau chargé par ID', direct.items.length === 1 && direct.items[0].Id === 99);
  check('détails propres à l’annonce demandée', direct.items[0].Body === fixtures[1].Body);
  const directQuery = client.calls[client.calls.length - 1];
  check('une annonce expirée reste accessible par lien direct', directQuery.includes('$filter=Id eq 99') && !directQuery.includes('ExpiresOn ge'));
  const missing = await loadAnnouncements(client, site, 'Annonces', 1, 404);
  check('ID absent : aucun événement inventé', !missing.isDemo && missing.items.length === 0);

  const invalidClient = clientOf(fixtures);
  for (const id of [0, -1, 1.5, NaN]) {
    const invalid = await loadAnnouncements(invalidClient, site, 'Annonces', 1, id);
    check(`ID invalide ${id} refusé sans requête`, !invalid.isDemo && invalid.items.length === 0 && invalidClient.calls.length === 0);
  }

  const minimalClient = clientOf([{ Id: 1, Title: 'Annonce simple' }], ['Id', 'Title', 'Created', 'Author']);
  const minimal = await loadAnnouncements(minimalClient, `${site}/minimal`, 'Annonces', 8);
  check('Title seul suffit : colonnes facultatives', !minimal.isDemo && minimal.items[0].Title === 'Annonce simple' && minimal.items[0].Body === '');
  check('pas de sélection de colonnes inexistantes', !minimalClient.calls[1].includes('AnnonceType') && !minimalClient.calls[1].includes('ExpiresOn'));

  const empty = await loadAnnouncements(clientOf([]), `${site}/empty`, 'Annonces', 8);
  check('liste vide : pas de mariage / anniversaire fictif', !empty.isDemo && empty.items.length === 0);
  const expired = await loadAnnouncements(clientOf([fixtures[1]]), `${site}/expired`, 'Annonces', 8);
  check('liste composée d’annonces expirées : état vide réel', !expired.isDemo && expired.items.length === 0);

  const aliasClient = clientOf([
    { Id: 2, Title: 'Naissance', TypeAnnonce: 'Naissance', Description: 'Bienvenue !', DateAnnonce: '2026-09-30', ImageUrl: '/sites/intranet/bebe.jpg' },
  ], ['Id', 'Title', 'TypeAnnonce', 'Description', 'DateAnnonce', 'ImageUrl']);
  const alias = await loadAnnouncements(aliasClient, `${site}/aliases`, 'Annonces', 8);
  check('noms de colonnes alternatifs reconnus', alias.items[0].Type === 'Naissance' && alias.items[0].Body === 'Bienvenue !' && alias.items[0].EventDate === '2026-09-30');
  check('image relative résolue par le helper de sécurité réel', alias.items[0].ImageUrl === 'https://tenant.sharepoint.com/sites/intranet/bebe.jpg');

  const images = await loadAnnouncements(clientOf([
    { Id: 1, Title: 'Image moderne', Image: JSON.stringify({ serverUrl: 'https://tenant.sharepoint.com', serverRelativeUrl: '/sites/intranet/image.jpg' }) },
    { Id: 2, Title: 'URL interdite', Image: 'javascript:alert(1)' },
    { Id: 3, Title: 'Image data interdite', Image: 'data:image/svg+xml,<svg></svg>' },
  ]), `${site}/images`, 'Annonces', 8);
  check('colonne Image moderne (JSON) lue', images.items.find((item) => item.Id === 1).ImageUrl === 'https://tenant.sharepoint.com/sites/intranet/image.jpg');
  check('URLs d’images actives refusées', images.items.filter((item) => item.Id > 1).every((item) => item.ImageUrl === undefined));

  const safeTitleClient = clientOf([]);
  await loadAnnouncements(safeTitleClient, site, "Annonces d'équipe", 8);
  check('apostrophe du titre échappée dans OData', safeTitleClient.calls[0].includes("getbytitle('Annonces%20d''%C3%A9quipe')"));

  const failedClient = { get: async () => ({ ok: false, status: 404 }) };
  const demo = await loadAnnouncements(failedClient, `${site}/missing`, 'Annonces', 8);
  check('source absente : exemples explicitement identifiés', demo.isDemo && demo.items.length === DEMO_ANNOUNCEMENTS.length);
  check('exemples issus de la vie d’équipe, pas des actualités', demo.items.some((item) => item.Type === 'Mariage') && demo.items.some((item) => item.Type === 'Anniversaire') && demo.items.every((item) => item.Type !== 'Certification'));
  const demoDetail = await loadAnnouncements(failedClient, `${site}/missing`, 'Annonces', 1, 2);
  check('détail d’exemple cohérent avec le bandeau', demoDetail.isDemo && demoDetail.items.length === 1 && demoDetail.items[0].Id === 2);
  const unknownDemo = await loadAnnouncements(failedClient, `${site}/missing`, 'Annonces', 1, 999);
  check('ID d’exemple inconnu : pas de substitution par une autre personne', unknownDemo.items.length === 0);

  for (const [type, icon] of [['Mariage', '💍'], ['Anniversaire', '🎂'], ['Naissance', '👶'], ['Arrivée', '👋'], ['Départ', '🌅'], ['Autre', '📣']]) {
    check(`pictogramme ${type}`, iconForAnnouncement(type) === icon);
  }

  console.log(`\nRésultat : ${passed} contrôles annonces réussis, 0 échec.`);
})().catch((error) => {
  console.error(`\n✗ ${error.message}`);
  process.exitCode = 1;
});
