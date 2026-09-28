#!/usr/bin/env node
const https = require('node:https');
const fs = require('node:fs');
const args = process.argv.slice(2);
const urlArg = args.find(arg => arg.startsWith('https://'));
const url = new URL(urlArg || 'https://localhost:4321/temp/build/manifests.js');
const insecure = args.includes('--allow-untrusted');
const caIndex = args.indexOf('--ca');
const ca = caIndex >= 0 ? fs.readFileSync(args[caIndex + 1]) : undefined;
const config = JSON.parse(fs.readFileSync(require('node:path').join(__dirname, '../config/serve.json'), 'utf8'));
console.log(`BBI · Diagnostic SPFx · Node ${process.version}`);
console.log(`Manifeste : ${url.href}`);
if (insecure) console.warn('ATTENTION : vérification TLS désactivée pour ce diagnostic uniquement. Cela ne valide pas la confiance du navigateur.');
if (config.hostname !== 'localhost') console.warn('Vérifiez que le hostname est joignable depuis le navigateur.');
const req = https.get(url, { rejectUnauthorized: !insecure, ca, family: args.includes('--container') ? 4 : undefined, timeout: 7000 }, res => {
  let body = '';
  res.on('data', chunk => { body += chunk; });
  res.on('end', () => {
    console.log(`HTTP ${res.statusCode} · ${res.headers['content-type'] || 'type absent'}`);
    const looksLikeJs = /javascript/.test(res.headers['content-type'] || '') && !/^\s*</.test(body) && body.length > 100;
    if (res.statusCode !== 200 || !looksLikeJs) {
      console.error('ÉCHEC : le manifeste JavaScript n’est pas disponible. Vérifiez les logs de compilation, le port et /temp/build/manifests.js.');
      process.exitCode = 1;
    } else {
      console.log(`OK : JavaScript reçu (${body.length} caractères).`);
      console.log(`CORS : ${res.headers['access-control-allow-origin'] || 'absent'}`);
      console.log('Ensuite : ouvrir cette URL dans LE navigateur du workbench, vérifier le certificat et l’autorisation réseau local.');
      if (args.includes('--container')) console.log('Ce test interne ne prouve pas que le port Docker est accessible depuis votre ordinateur.');
    }
  });
});
req.on('timeout', () => req.destroy(new Error('Délai de connexion dépassé')));
req.on('error', error => {
  console.error(`ÉCHEC : ${error.code || ''} ${error.message}`);
  console.error('ECONNREFUSED : vérifier npm start, le binding 0.0.0.0 dans config/spfx-customize-webpack.js et le port Docker.');
  console.error('Erreur TLS : importer le CA de développement sur l’ordinateur du navigateur. Ne pas désactiver globalement TLS.');
  process.exitCode = 1;
});
