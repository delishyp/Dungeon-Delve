// node test/shots.js <width> <height> <prefix> hash1 hash2 ...  (desktop single-file screenshots)
const puppeteer = require('puppeteer-core');
const [w, h, prefix, ...hashes] = process.argv.slice(2);
(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  for (const hash of hashes) {
    const page = await browser.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.setViewport({ width: +w, height: +h, deviceScaleFactor: 1 });
    await page.goto('file://' + require('path').resolve(__dirname, '../index.html') + '#' + hash);
    await new Promise(r => setTimeout(r, 1500));
    const f = `shots/${prefix}-${hash.replace(/^demo-/, '')}.png`;
    await page.screenshot({ path: f });
    console.log(f, errs.length ? 'ERR ' + errs.join('|') : 'ok');
    await page.close();
  }
  await browser.close();
})();
