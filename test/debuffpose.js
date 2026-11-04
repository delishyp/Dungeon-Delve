// Debuff poses: Barbarian and Wizard debuff cards swap to hero_<class>_debuff; the Fighter falls back to cast.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..'); let n = 0;
const ok = (c, m) => { n++; if (!c) { console.error('FAIL ' + m); process.exit(1); } };
const md5 = f => crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, 'assets', f))).digest('hex');
ok(md5('hero_barbarian_debuff.webp') === '21104566f06cee8fef993b90374ad955', 'barbarian debuff file is the handoff');
ok(md5('hero_wizard_debuff.webp') === 'c59e3e452d1d3388d8afd0f70da10bba', 'wizard debuff file is the handoff');
ok(!fs.existsSync(path.join(ROOT, 'assets/hero_fighter_debuff.webp')), 'fighter debuff waits for his repaint');
(async () => {
  const puppeteer = require('puppeteer-core');
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const errs = [];
  for (const hero of ['barbarian', 'wizard', 'fighter']) {
    const pg = await b.newPage(); pg.on('pageerror', e => errs.push(e.message));
    await pg.goto('file://' + path.join(ROOT, 'index.html') + '#demo-map-' + hero); await new Promise(r => setTimeout(r, 1200));
    const r = await pg.evaluate((hero) => { const D = window.GameData, A = window.ASSETS || {};
      const deb = Object.keys(D.CARDS).find(id => D.CARDS[id].cls === hero && D.frameOf(D.CARDS[id], id) === 'debuff');
      return { deb, src: document.documentElement.innerHTML.length > 0 }; }, hero);
    if (hero !== 'fighter') ok(r.deb, hero + ' has a debuff card to pose with');
    await pg.close();
  }
  const ui = fs.readFileSync(path.join(ROOT, 'src/ui.js'), 'utf8');
  ok(/POSES = \[[^\]]*'debuff'/.test(ui), 'pose list has debuff');
  ok(/POSE_FALLBACK = \{ debuff: 'cast' \}/.test(ui), 'debuff falls back to cast');
  ok(/fr === 'debuff' \? 'debuff'/.test(ui), 'debuff-frame cards pick the debuff pose');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(html.includes('hero_barbarian_debuff') && html.includes('hero_wizard_debuff') && !html.includes('hero_fighter_debuff'), 'build bundles the two debuff poses only');
  await b.close(); ok(!errs.length, 'no page errors: ' + errs.join(' | '));
  console.log('debuffpose ok (' + n + ' checks)');
})().catch(e => { console.error(e); process.exit(1); });
