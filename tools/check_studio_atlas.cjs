// Browser and asset checks for the packaged, generated-motion SceneFlow Atlas.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

(async () => {
  const url = new URL('studio/', process.env.SITE_URL || 'http://127.0.0.1:8767/').href;
  const output = process.env.SITE_CHECK_OUTPUT || '/tmp/sceneflow-atlas-check'; fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [], checks = [], requests = [];
  const pass = label => { checks.push(label); console.log('PASS', label); };
  const observe = page => { page.on('pageerror', e => errors.push(e.message)); page.on('request', r => requests.push(r.url())); };
  const scroll = (page, id) => page.evaluate(id => {
    document.documentElement.style.scrollBehavior = 'auto'; document.getElementById(id).scrollIntoView({ block: 'start' });
  }, id);
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } }); observe(page);
    assert.equal((await page.goto(url, { waitUntil: 'networkidle' })).status(), 200);
    await page.waitForSelector('.atlas-card');
    assert.equal(await page.locator('.atlas-card').count(), 12);
    assert(!requests.some(r => /atlas\/(clips|pairs)\//.test(r)), 'Offscreen gallery must not download videos or 3D pairs');
    assert(!requests.some(r => /atlas\/story\/.*mp4/.test(r)), 'Offscreen story must not download videos');
    const index = await (await page.request.get(new URL('atlas/index.json', url).href)).json();
    const receipts = await (await page.request.get(new URL('atlas/provenance.json', url).href)).json();
    assert.deepEqual(index.stats, { pairs: 83, unseen: 44, attempted: 92, without_pair: 9, draws_per_motion: 32 });
    // Validate all published geometry and original-video hashes, with bounded concurrency.
    let cursor = 0;
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (cursor < index.items.length) {
        const item = index.items[cursor++]; assert(receipts.allowed_sources.includes(item.src));
        assert.equal(item.pass.length, 32); assert.equal(item.pass.split('1').length - 1, item.n_pass);
        assert.equal(item.pass.indexOf('1'), item.shown); assert(item.tclear >= .04);
        const pairResponse = await page.request.get(new URL(`atlas/pairs/${item.id}.json`, url).href); assert.equal(pairResponse.status(), 200);
        const pair = await pairResponse.json(); assert.deepEqual(Object.keys(pair).sort(), ['boxes', 'caps_a', 'caps_t', 'hit', 'radius']);
        assert.equal(pair.radius.length, 45); const size = Buffer.from(pair.caps_t, 'base64').length;
        assert.equal(size % (45 * 6 * 2), 0); assert.equal(Buffer.from(pair.caps_a, 'base64').length, size);
        assert(pair.boxes.every(b => [b.cx,b.cy,b.hx,b.hy,b.yaw,b.zb,b.zt].every(Number.isFinite) && b.hx > 0 && b.hy > 0 && b.zt > b.zb));
        const video = await page.request.get(new URL(`atlas/clips/${item.id}.mp4`, url).href); assert.equal(video.status(), 200);
        assert.match(video.headers()['content-type'], /video\/mp4/);
        assert.equal(crypto.createHash('sha256').update(await video.body()).digest('hex'), receipts.assets.find(e => e.id === item.id).clip_sha256);
        assert.equal((await page.request.get(new URL(`atlas/posters/${item.id}.jpg`, url).href)).status(), 200);
      }
    }));
    pass('All 83 pairs have valid geometry, 32 recorded verdicts, original video hashes and accessible posters; no offscreen video downloads');
    await scroll(page, 'atlas');
    await page.waitForFunction(() => [...document.querySelectorAll('.atlas-grid video')].some(v => !v.paused && v.currentTime > .2));
    assert(await page.locator('.atlas-grid video').evaluateAll(v => v.filter(x => !x.paused).length <= 4));
    await page.locator('#atlas-motion').click();
    assert(await page.locator('.atlas-grid video').evaluateAll(v => v.every(x => x.paused)));
    await page.locator('#atlas-motion').click();
    await page.locator('[data-kind="body"]').click(); assert.match(await page.locator('#atlas-count').innerText(), /10 of 10/);
    await page.locator('[data-kind="path"]').click(); assert.match(await page.locator('#atlas-count').innerText(), /12 of 33/);
    await page.locator('[data-kind="all"]').click();
    await page.locator('#atlas-source').selectOption('unseen'); assert.match(await page.locator('#atlas-count').innerText(), /12 of 44/);
    await page.locator('#atlas-source').selectOption('sonic'); assert.match(await page.locator('#atlas-count').innerText(), /11 of 11/);
    await page.locator('#atlas-source').selectOption('all');
    await page.locator('#atlas-search').fill('kv-002'); assert.equal(await page.locator('.atlas-card').count(), 1);
    await page.locator('#atlas-search').fill('no-such-pair'); assert.equal(await page.locator('.atlas-card').count(), 0);
    assert.match(await page.locator('#atlas-grid').innerText(), /No matching pairs/);
    await page.locator('#atlas-search').fill('');
    while (await page.locator('#atlas-more').isVisible()) await page.locator('#atlas-more').click();
    assert.equal(await page.locator('.atlas-card').count(), 83);
    assert.equal(new Set(await page.locator('.atlas-card').evaluateAll(nodes => nodes.map(n => n.dataset.atlasId))).size, 83);
    pass('Preview play/pause, motion and source filters, search, empty state and load-more cover all 83 pairs');

    await page.locator('[data-atlas-id="kv-002"]').click();
    await page.waitForFunction(() => document.getElementById('atlas-film').currentTime > .2);
    assert.equal(new URL(page.url()).searchParams.get('atlas'), 'kv-002');
    assert(await page.locator('.atlas-grid video').evaluateAll(v => v.every(x => x.paused)));
    assert.equal(await page.locator('#atlas-draw-summary').innerText(), '10 of 32 scene candidates pass');
    await page.locator('#atlas-tab-3d').click();
    await page.waitForFunction(() => !document.getElementById('atlas-3d-play').disabled);
    assert.equal(await page.locator('#atlas-geometry canvas').count(), 1);
    await page.waitForFunction(() => +document.getElementById('atlas-scrub').value > 50);
    await page.locator('#atlas-3d-play').click(); const position = await page.locator('#atlas-scrub').inputValue();
    await page.waitForTimeout(200); assert.equal(await page.locator('#atlas-scrub').inputValue(), position);
    await page.locator('#atlas-scrub').evaluate(el => { el.value = 650; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.waitForTimeout(100); assert.equal(await page.locator('#atlas-scrub').inputValue(), '650');
    await page.locator('#atlas-alt').uncheck(); await page.locator('#atlas-alt').check();
    await page.locator('#atlas-geometry canvas').focus(); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('+'); await page.keyboard.press('Home');
    await page.screenshot({ path: path.join(output, 'atlas-3d-desktop.png') });
    await page.locator('#atlas-next').click(); assert.match(await page.locator('#atlas-detail-id').innerText(), /kc-166/i);
    assert.equal(await page.locator('#atlas-geometry canvas').count(), 0);
    await page.locator('#atlas-prev').click(); assert.match(await page.locator('#atlas-detail-id').innerText(), /kv-002/i);
    await page.keyboard.press('Escape'); assert.equal(await page.locator('#atlas-dialog').isVisible(), false);
    await page.waitForFunction(() => !new URL(location.href).searchParams.has('atlas'));
    assert.equal(await page.evaluate(() => document.activeElement.dataset.atlasId), 'kv-002');
    pass('Dialog replays real video, pauses background media, renders 3D, scrubs, toggles alternative, navigates and restores keyboard focus');

    await scroll(page, 'visualize');
    await page.waitForFunction(() => document.getElementById('story-video').currentTime > .2);
    await page.locator('#story-play').click(); assert(await page.locator('#story-video').evaluate(v => v.paused));
    await page.locator('[data-story="many"]').click(); assert(await page.locator('#story-video').evaluate(v => v.paused));
    await page.locator('#story-play').click();
    await page.waitForFunction(() => document.getElementById('story-video').currentTime > .2 && !document.getElementById('story-video').paused);
    assert.match(await page.locator('#story-caption').innerText(), /six pass, two are rejected/);
    await page.screenshot({ path: path.join(output, 'story-desktop.png') });
    await scroll(page, 'atlas'); await page.waitForTimeout(100);
    assert(await page.locator('#story-video').evaluate(v => v.paused));
    await page.screenshot({ path: path.join(output, 'atlas-desktop.png') });
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Page overflow at ${width}`);
      await page.locator('[data-atlas-id="kv-002"]').click();
      assert(await page.locator('#atlas-dialog').evaluate(el => el.scrollWidth <= el.clientWidth), `Dialog overflow at ${width}`);
      if (width === 390) { await page.locator('#atlas-tab-3d').click(); await page.waitForFunction(() => !document.getElementById('atlas-3d-play').disabled); await page.screenshot({ path: path.join(output, 'atlas-mobile-dialog.png') }); }
      await page.keyboard.press('Escape');
    }
    await page.setViewportSize({ width: 390, height: 844 }); await scroll(page, 'atlas');
    await page.screenshot({ path: path.join(output, 'atlas-mobile.png') });
    pass('Both visual-story films play and pause; offscreen playback stops; page and dialog fit 320–1440 px');

    const reduced = await browser.newPage({ viewport: { width: 1000, height: 900 }, reducedMotion: 'reduce' }); observe(reduced);
    await reduced.goto(url + '?run=kc-45-stop&atlas=ksk-200#atlas');
    await reduced.waitForSelector('#atlas-dialog[open]');
    await reduced.waitForSelector('#right:not([hidden])');
    assert.match(await reduced.locator('#motion-title').innerText(), /^Stop/);
    assert(await reduced.locator('#atlas-film').evaluate(v => v.paused));
    await reduced.locator('#atlas-tab-3d').click(); await reduced.waitForFunction(() => !document.getElementById('atlas-3d-play').disabled);
    assert.equal(await reduced.locator('#atlas-3d-play').innerText(), 'Play');
    const stopped = await reduced.locator('#atlas-scrub').inputValue(); await reduced.waitForTimeout(250);
    assert.equal(await reduced.locator('#atlas-scrub').inputValue(), stopped);
    await reduced.keyboard.press('Escape'); await scroll(reduced, 'atlas');
    assert.equal(new URL(reduced.url()).searchParams.get('run'), 'kc-45-stop');
    assert(await reduced.locator('.atlas-grid video').evaluateAll(v => v.every(x => x.paused && !x.hasAttribute('src'))));
    await scroll(reduced, 'visualize'); assert(await reduced.locator('#story-video').evaluate(v => v.paused));
    await reduced.close();
    pass('Reduced motion starts every preview and replay paused; atlas and original motion deep links coexist');

    const recovery = await browser.newPage(); observe(recovery);
    await recovery.route('**/atlas/index.json', route => route.abort()); await recovery.goto(url + '#atlas');
    await recovery.getByRole('button', { name: 'Try again', exact: true }).filter({ visible: true }).waitFor();
    await recovery.unroute('**/atlas/index.json'); await recovery.locator('#atlas-grid button').click();
    await recovery.waitForSelector('.atlas-card'); await recovery.locator('.atlas-card').first().click();
    await recovery.route('**/atlas/pairs/*.json', route => route.abort());
    await recovery.locator('#atlas-tab-3d').click(); await recovery.locator('#atlas-3d-retry').waitFor({ state: 'visible' });
    await recovery.unroute('**/atlas/pairs/*.json'); await recovery.locator('#atlas-3d-retry').click();
    await recovery.waitForFunction(() => !document.getElementById('atlas-3d-play').disabled);
    // A delayed pair may not reappear after switching to another item or closing.
    await recovery.locator('#atlas-tab-film').click();
    await recovery.route('**/atlas/pairs/kv-002.json', async route => { await new Promise(resolve => setTimeout(resolve, 600)); await route.continue().catch(() => {}); });
    await recovery.locator('#atlas-tab-3d').click(); await recovery.locator('#atlas-next').click();
    await recovery.waitForTimeout(800); assert.match(await recovery.locator('#atlas-detail-id').innerText(), /kc-166/i);
    assert.equal(await recovery.locator('#atlas-geometry canvas').count(), 0);
    await recovery.keyboard.press('Escape'); await recovery.close();
    pass('Atlas and geometry request failures recover; delayed requests cannot replace another pair or recreate a closed viewer');
    assert.deepEqual(errors, []); pass('No uncaught JavaScript errors');
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ url, checks, errors, checkedPairs: index.stats.pairs }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
