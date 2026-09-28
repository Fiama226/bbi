const esbuild = require('esbuild');
const sass = require('sass');
const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve(__dirname, '../preview/dist');
fs.mkdirSync(output, { recursive: true });
esbuild.build({
  entryPoints: [path.resolve(__dirname, '../preview/index.tsx')], bundle: true, outfile: path.join(output, 'app.js'), minify: true,
  define: { 'process.env.NODE_ENV': '"production"' }, loader: { '.png': 'file', '.jpg': 'file' },
  plugins: [{ name: 'preview-scss-modules', setup(build) {
    build.onLoad({ filter: /\.module\.scss$/ }, async args => {
      const compiled = sass.compile(args.path, { style: 'compressed' });
      // Use esbuild's actual CSS modules pipeline, not a separate approximation of the SPFx styles.
      return { contents: compiled.css, loader: 'local-css', resolveDir: path.dirname(args.path) };
    });
  } }]
}).then(() => {
  fs.writeFileSync(path.join(output, 'index.html'), '<!doctype html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>BBI · Intranet — aperçu interactif</title><link rel="stylesheet" href="app.css"><style>body{margin:0;background:#f4f6fa}#preview-toolbar{font:12px Segoe UI,Arial,sans-serif;padding:10px 20px;background:#071a3e;color:white;display:flex;align-items:center;gap:14px;flex-wrap:wrap}#preview-toolbar select{padding:6px;border-radius:4px;min-width:0;max-width:100%}#preview-toolbar label{display:flex;align-items:center;gap:8px;max-width:100%;min-width:0}#preview-toolbar a{color:white;margin-left:auto}</style></head><body><div id="root"></div><script src="app.js"></script></body></html>');
  console.log(`Aperçu React généré : ${output}`);
}).catch(error => { console.error(error); process.exitCode = 1; });
