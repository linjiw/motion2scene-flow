// Homepage check: resources, JS errors, widget behaviour, section screenshots (desktop + phone).
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('playwright-core'); } })();
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const base = process.env.SITE_URL || 'http://127.0.0.1:8765/';
  const out = process.env.OUT || '/tmp/m2s-site-preview/home';
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  for (const [label, vp] of [['desk', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport: vp, deviceScaleFactor: label === 'phone' ? 2 : 1 });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url() + ' ' + (r.failure() || {}).errorText));
    const resp = await page.goto(base, { waitUntil: 'networkidle' });
    assert.equal(resp.status(), 200);
    const ids = await page.locator('[id]').evaluateAll((n) => n.map((x) => x.id));
    assert.equal(new Set(ids).size, ids.length, 'duplicate ids');
    const anchors = await page.locator('a[href^="#"]').evaluateAll((n) => n.map((x) => x.hash.slice(1)));
    anchors.forEach((id) => assert(ids.includes(id), 'missing anchor ' + id));
    if (label === 'desk') {
      const urls = await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href], img[src], link[href], script[src], video[data-src], video[src], video[poster], source[src], track[src], [data-src], image')]
        .flatMap((n) => [n.href && n.href.baseVal !== undefined ? new URL(n.href.baseVal, location.href).href : n.href, n.src, n.poster, n.dataset && n.dataset.src && new URL(n.dataset.src, location.href).href])
        .filter((u) => typeof u === 'string' && u))]);
      let n = 0;
      for (const u of urls) {
        const url = new URL(u);
        if (url.origin !== new URL(base).origin || url.hash) continue;
        const r = await page.request.get(url.href);
        assert(r.ok(), 'broken local resource: ' + url.href);
        n++;
      }
      console.log('local resources ok:', n);
    }
    // scroll through to trigger lazy widgets
    const H = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y < H; y += 600) { await page.evaluate((yy) => window.scrollTo(0, yy), y); await page.waitForTimeout(120); }
    for (const w of ['#w-lfh', '#w-fm', '#w-slots', '#w-plan', '#w-lidar']) {
      await page.locator(w).scrollIntoViewIfNeeded();
      await page.waitForSelector(w + '[data-ready]', { timeout: 15000 });
    }
    // interactions
    await page.locator('#w-lfh input[type=range]').evaluate((el) => { el.value = '1.45'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.match(await page.locator('#w-lfh .v-text').textContent(), /explains nothing/);
    await page.locator('#w-lfh input[type=range]').evaluate((el) => { el.value = '0.90'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.match(await page.locator('#w-lfh .v-text').textContent(), /impossible/);
    await page.locator('#w-lfh input[type=range]').evaluate((el) => { el.value = '1.18'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.match(await page.locator('#w-lfh .v-text').textContent(), /necessary/);
    await page.locator('#w-fm input[type=range]').evaluate((el) => { el.value = '0.6'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.match(await page.locator('#w-fm .v-t').textContent(), /0\.60/);
    await page.locator('#w-slots input[type=range]').evaluate((el) => { el.value = '30'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.locator('#w-plan input[type=range]').evaluate((el) => { el.value = '52'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.match(await page.locator('#w-plan .v-safe').textContent(), /\/ 16 safe/);
    await page.locator('#w-lidar input[type=range]').evaluate((el) => { el.value = '2.1'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.locator('#film').evaluate((v) => v.readyState >= 1 || new Promise((r) => v.addEventListener('loadedmetadata', r, { once: true })));
    const dur = await page.locator('#film').evaluate((v) => v.duration);
    assert(dur > 860 && dur < 880, 'film duration ' + dur);
    for (const sel of ['#top', '.stats', '#video', '#idea', '#w-lfh', '#two-flows', '.pipeline', '#w-fm', '#sceneflow', '#w-slots', '#cycleflow', '#teacher', '#w-plan', '#arena', '#results', '#w-lidar', '#student', '#deploy', '#principles']) {
      const el = page.locator(sel).first();
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      const name = sel.replace(/[#.]/g, '');
      if (label === 'phone' && !['top', 'w-lfh', 'w-fm', 'w-plan', 'w-lidar', 'w-slots', 'stats', 'video', 'two-flows', 'pipeline', 'results'].includes(name)) continue;
      await el.screenshot({ path: path.join(out, `${label}_${name}.png`) });
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    console.log(label, 'horizontal overflow px:', overflow);
    console.log(label, 'errors:', errors.length ? errors : 'none');
    await page.close();
  }
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
process.on('exit', () => {});
