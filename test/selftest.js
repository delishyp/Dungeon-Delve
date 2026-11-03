// Desktop selftest of the single-file build: node test/selftest.js [url-hash]
const puppeteer = require('puppeteer-core');
// ---- 2.4.4 text checks: placeholders filled, no old (borrowed) names in player-visible text ----
function textChecks() {
  const fs = require('fs'), path = require('path');
  const OLD = ['Xanathar', 'Aldric', 'Waterdeep', 'Grukka', 'Elaria', 'Underdark', 'Tymora', 'Yawning Portal', 'Myconid', 'Illithid', 'Beholder', 'Mind Flayer', 'Eye Tyrant', 'Yeenoghu', 'Lolth', 'Elder Brain', 'Candlekeep', 'Deck of Many Things'];   // 'Vessa' allowed again: her art is in (LORE: the Watcher was a placeholder until then)
  const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
  global.window = global; const D = require('../src/data.js'); require('../src/content.js');
  const fails = [];
  // 1) every shown story / event / ending string through the helper
  const shown = [];
  const walk = (o, p) => { if (typeof o === 'string') shown.push([p, o]); else if (o && typeof o === 'object') for (const k in o) walk(o[k], p + '.' + k); };
  walk(D.STORY, 'STORY');
  for (const [id, ev] of Object.entries(D.EVENTS)) {
    shown.push([`EVENTS.${id}.name`, ev.name], [`EVENTS.${id}.text`, ev.text]);
    (ev.choices || []).forEach((c, i) => { shown.push([`EVENTS.${id}.choices[${i}].label`, c.label], [`EVENTS.${id}.choices[${i}].hint`, c.hint || '']); walk(c.ops, `EVENTS.${id}.choices[${i}].ops`); walk(c.chance, `EVENTS.${id}.choices[${i}].chance`); });
  }
  shown.push(['endHTML.win', 'You Climbed Out'], ['endHTML.lose', 'You Have Fallen']);
  for (const [p, t] of shown) { const f = D.fillNames(t); if (/[{}]/.test(f)) fails.push(`placeholder left in ${p}: ${f}`); }
  // 2) old names in display text of the BUILT page: every string literal that isn't a bare id / file key
  const code = html.replace(/data:[a-z]+\/[\w+.-]+;base64,[A-Za-z0-9+/=]+/g, '');
  const lit = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
  for (const m of code.matchAll(lit)) {
    const t = m[1] ?? m[2] ?? m[3];
    if (/^[a-z0-9_./-]*$/.test(t)) continue;           // ids, file names, keys
    for (const n of OLD) if (t.includes(n)) fails.push(`old name "${n}" in built text: ${t.slice(0, 90)}`);
  }
  return fails;
}

(async () => {
  const tf = textChecks();
  if (tf.length) { console.log('TEXT CHECK FAIL\n' + [...new Set(tf)].join('\n')); process.exit(1); }
  console.log('TEXT CHECK PASS (placeholders filled, no old names in built display text)');
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.setViewport({ width: 1440, height: 860 });
  await page.goto('file://' + require('path').resolve(__dirname, '../index.html') + '#selftest');
  await page.waitForFunction(() => document.body.dataset.selftest, { timeout: 600000 });
  const res = await page.evaluate(() => document.body.dataset.selftest);
  console.log(res);
  if (errs.length) console.log('JS errors:', errs.slice(0, 5).join(' | '));
  await browser.close();
  process.exit(res.startsWith('SELFTEST PASS') && !errs.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
