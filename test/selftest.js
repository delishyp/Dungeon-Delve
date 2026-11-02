// Desktop selftest of the single-file build: node test/selftest.js [url-hash]
const puppeteer = require('/workspace/tools/node_modules/puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
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
