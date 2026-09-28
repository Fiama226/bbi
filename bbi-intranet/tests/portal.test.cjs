const test = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');
// Load production TypeScript directly, with only the SPFx transport replaced by a fake.
const cache = {};
function load(file) {
  file = path.resolve(__dirname, '../src/shared', file.endsWith('.ts') ? file : `${file}.ts`);
  if (cache[file]) return cache[file].exports;
  const module = { exports: {} }; cache[file] = module;
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText;
  new Function('require', 'module', 'exports', js)(name => name === '@microsoft/sp-http' ? { SPHttpClient: { configurations: { v1: {} } } } : name.startsWith('.') ? load(path.resolve(path.dirname(file), name)) : require(name), module, module.exports);
  return module.exports;
}
const utils = load('utils');
const { modules, defaults } = load('registry');
const { SharePointSource } = load('SharePointSource');
const base = 'https://tenant.sharepoint.com/sites/bbi';
const response = (value, status = 200) => ({ ok: status === 200, status, headers: new Map([['SPRequestGuid', 'test-correlation']]), json: async () => value });
const request = (key = 'catalog') => ({ key, siteUrl: base, listTitle: modules[key].list, userEmail: 'alex@example.com' });
test('HTTP(S) links only, relative URLs resolved against source site', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', '#', '']) assert.equal(utils.safeUrl(url, base), undefined);
  assert.equal(utils.safeUrl('/sites/bbi/test', base), `${base}/test`);
  assert.equal(utils.emailUrl('someone@example.com'), 'mailto:someone@example.com');
  assert.equal(utils.emailUrl('a@b.com?subject=spoof'), undefined);
});
test('document web=1 preserves existing queries and hashes', () => {
  const url = new URL(utils.documentUrl('/sites/bbi/a.pdf?x=1&web=0#p2', base));
  assert.equal(url.searchParams.get('web'), '1'); assert.equal(url.searchParams.get('x'), '1'); assert.equal(url.hash, '#p2');
});
test('OData escapes apostrophes before encoding', () => assert.equal(decodeURIComponent(utils.odataLiteral("L'équipe & BBI")), "L''équipe & BBI"));
test('source configuration rejects invalid JSON shapes', () => {
  for (const value of ['[]', 'null', '"x"', '{', '{"news":3}']) assert.throws(() => utils.parseSources(value));
  assert.deepEqual(utils.parseSources('{"news":"Actualités"}'), { news: 'Actualités' });
});
test('filters handle accents, code, category and empty results', () => {
  const items = [{ Id: 1, Title: 'Équipe', CodeFormation: 'MGT-101', Filiere: 'Management' }];
  assert.equal(utils.filterItems(items, 'equipe', '').length, 1);
  assert.equal(utils.filterItems(items, 'mgt', 'Management').length, 1);
  assert.equal(utils.filterItems(items, '', 'Coaching').length, 0);
  assert.equal(utils.filterItems(items, 'absent', '').length, 0);
});
test('production mode is default and list schema matches all REST selects', () => {
  assert.equal(defaults.demoMode, false);
  const schema = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../scripts/lists.schema.json'), 'utf8'));
  for (const [key, definition] of Object.entries(modules)) {
    if (key === 'hero') continue;
    const list = schema.find(list => list.title === definition.list); assert.ok(list, key);
    const fields = new Set(['FileRef', 'FileLeafRef', 'Modified', ...list.fields.map(field => field.name)]);
    for (const field of definition.fields.split(',')) assert.ok(fields.has(field), `${key}.${field}`);
  }
});
test('all 13 webpart IDs unique, catalog and documents IDs preserved', () => {
  const ids = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../scripts/webpart-ids.json')));
  assert.equal(new Set(Object.values(ids)).size, 13);
  assert.equal(ids.catalog, 'd37a426e-48db-484f-bf10-c38675bb7b43');
  assert.equal(ids.documents, 'c9a1e6d4-3b27-4e1f-8f5a-6d0b9c2e7a41');
});
test('pagination and real display form links', async () => {
  const calls = [];
  const source = new SharePointSource({ get: async url => {
    calls.push(url);
    if (url.includes('?$select=Default')) return response({ DefaultDisplayFormUrl: '/sites/bbi/Lists/Formations/DispForm.aspx' });
    if (url.endsWith('page=2')) return response({ value: [{ Id: 2, Title: 'Second' }] });
    return response({ value: [{ Id: 1, Title: 'First' }], '@odata.nextLink': `${base}/_api/page=2` });
  } });
  const data = await source.load(request()); assert.equal(data.items.length, 2); assert.equal(data.truncated, false);
  assert.equal(data.items[0].Lien, `${base}/Lists/Formations/DispForm.aspx?ID=1`);
  assert.ok(decodeURIComponent(calls[1]).includes("StatutCatalogue eq 'Actif'"));
});
test('403, 404 and incompatible schema never fall back to demo data', async () => {
  for (const status of [403, 404, 400, 500]) {
    const source = new SharePointSource({ get: async () => response({}, status) });
    await assert.rejects(source.load(request('directory')), new RegExp(`HTTP ${status}.*test-correlation`));
  }
});
test('personal sessions use current user and upcoming end-date filters', async () => {
  let endpoint;
  const source = new SharePointSource({ get: async url => { endpoint = decodeURIComponent(url); return response(url.includes('DefaultDisplayFormUrl') ? {} : { value: [] }); } });
  await source.load({ ...request('trainer'), userEmail: "o'neil@example.com" });
  assert.ok(endpoint.includes("FormateurEmail eq 'o''neil@example.com'")); assert.ok(endpoint.includes('DateFin ge datetime'));
  await assert.rejects(source.load({ ...request('trainer'), userEmail: '' }), /adresse utilisateur/);
});
test('documents exclude folders and network errors propagate', async () => {
  let endpoint;
  const source = new SharePointSource({ get: async url => { endpoint = decodeURIComponent(url); return response({ value: [] }); } });
  await source.load(request('documents')); assert.ok(endpoint.includes('FSObjType eq 0'));
  await assert.rejects(new SharePointSource({ get: async () => { throw new Error('offline'); } }).load(request('documents')), /offline/);
});
test('pagination cannot send authenticated calls to an external origin', async () => {
  let count = 0;
  const source = new SharePointSource({ get: async () => { count++; return response({ value: [], '@odata.nextLink': 'https://evil.example/_api/data' }); } });
  await assert.rejects(source.load(request('documents')), /pagination/); assert.equal(count, 1);
});
test('pagination bounded at 500 items with truncation reported', async () => {
  let count = 0;
  const source = new SharePointSource({ get: async () => { count++; return response({ value: Array.from({ length: 100 }, (_, i) => ({ Id: i, Title: 'x' })), 'odata.nextLink': `${base}/_api/next${count}` }); } });
  const result = await source.load(request('documents')); assert.equal(result.items.length, 500); assert.equal(result.truncated, true); assert.equal(count, 5);
});
test('Docker listens on all interfaces without changing browser-facing URLs', () => {
  const customize = require('../config/spfx-customize-webpack');
  const config = { devServer: { host: 'localhost', client: { webSocketURL: { hostname: 'localhost' } } } };
  customize(config); assert.equal(config.devServer.host, '0.0.0.0'); assert.equal(config.devServer.client.webSocketURL.hostname, 'localhost');
});
test('repeated empty continuation pages cannot cause an infinite request loop', async () => {
  const source = new SharePointSource({ get: async () => response({ value: [], '@odata.nextLink': `${base}/_api/repeat` }) });
  await assert.rejects(source.load(request('documents')), /Boucle de pagination/);
});
