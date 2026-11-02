// Builds the game from src/.  Run: node build.js
//  - index.html  single self-contained file (double-click to play, works offline). Art is embedded as data: URIs.
//  - dist/       installable PWA for hosting (GitHub Pages etc.): index.html, assets/ (art as separate WebP files),
//                manifest, service worker (caches everything for offline play), icons.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const here = (...p) => path.join(__dirname, ...p);
const src = (f) => fs.readFileSync(here('src', f), 'utf8');
// Art that git ignores (e.g. assets/hero_* work-in-progress listed in .git/info/exclude) is never built in.
const ignored = (() => { try { return new Set(require('child_process').execFileSync('git', ['ls-files', '--others', '--ignored', '--exclude-standard', '--', 'assets'], { cwd: __dirname }).toString().split('\n').filter(Boolean).map(f => path.basename(f))); } catch (e) { return new Set(); } })();
const assetFiles = fs.readdirSync(here('assets')).filter(f => /\.(webp|svg)$/.test(f) && !ignored.has(f)).sort();
const mime = (f) => f.endsWith('.svg') ? 'image/svg+xml' : 'image/webp';
const assetsMap = (embed) => 'window.ASSETS = ' + JSON.stringify(Object.fromEntries(assetFiles.map(f => [f.replace(/\.(webp|svg)$/, ''),
  embed ? 'data:' + mime(f) + ';base64,' + fs.readFileSync(here('assets', f)).toString('base64') : 'assets/' + f]))) + ';';
const game = (embed) => src('shell.html')
  .replace('/*@@CSS@@*/', () => src('style.css'))
  .replace('/*@@ASSETS@@*/', () => assetsMap(embed))
  .replace('/*@@DATA@@*/', () => src('data.js') + '\n' + src('content.js'))
  .replace('/*@@ENGINE@@*/', () => src('engine.js'))
  .replace('/*@@UI@@*/', () => 'window.GAME_VERSION = ' + JSON.stringify(require('./electron/package.json').version) + ';\n' + src('settings.js') + '\n' + src('icons.js') + '\n' + src('audio.js') + '\n' + src('ui.js'));
const single = game(true).replace('<!--@@PWA_HEAD@@-->', '');
fs.writeFileSync(here('index.html'), single);

const pwaHead = `<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">`;
const distHtml = game(false).replace('<!--@@PWA_HEAD@@-->', pwaHead);
const dist = here('dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'icons'), { recursive: true });
fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });
fs.writeFileSync(path.join(dist, 'index.html'), distHtml);
fs.copyFileSync(here('src', 'manifest.webmanifest'), path.join(dist, 'manifest.webmanifest'));
const h = crypto.createHash('sha1').update(distHtml);
for (const f of assetFiles) { const b = fs.readFileSync(here('assets', f)); h.update(b); fs.writeFileSync(path.join(dist, 'assets', f), b); }
const hash = h.digest('hex').slice(0, 10);
const files = assetFiles.map(f => `'./assets/${f}'`).join(', ');
fs.writeFileSync(path.join(dist, 'sw.js'), src('sw.js').replace('@@HASH@@', hash).replace("'@@ASSET_FILES@@'", files));
for (const f of fs.readdirSync(here('icons'))) fs.copyFileSync(here('icons', f), path.join(dist, 'icons', f));
fs.writeFileSync(path.join(dist, '.nojekyll'), '');
const size = (p) => fs.statSync(p).size;
const distSize = fs.readdirSync(dist, { recursive: true }).map(f => path.join(dist, f)).filter(p => fs.statSync(p).isFile()).reduce((a, p) => a + size(p), 0);
console.log(`built index.html (${(single.length / 1e6).toFixed(2)} MB, art embedded) and dist/ (${(distSize / 1e6).toFixed(2)} MB total, ${assetFiles.length} art files, cache ${hash})`);
