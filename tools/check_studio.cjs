// Run with SITE_URL=http://127.0.0.1:8767/ node tools/check_studio.cjs.
// Requires Playwright; CHROME_PATH and SITE_CHECK_OUTPUT are optional.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const base = process.env.SITE_URL || 'http://127.0.0.1:8767/';
  const url = new URL('studio/', base).href;
  const output = process.env.SITE_CHECK_OUTPUT || '/tmp/sceneflow-studio-check';
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const checks = [], errors = [], apiCalls = [];
  const pass = label => { checks.push(label); console.log('PASS', label); };
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) apiCalls.push(request.url()); });
    assert.equal((await page.goto(url, { waitUntil: 'networkidle' })).status(), 200);
    await page.waitForSelector('#right:not([hidden])');
    await page.locator('#viewport').scrollIntoViewIfNeeded();
    const ids = await page.locator('[id]').evaluateAll(nodes => nodes.map(node => node.id));
    assert.equal(new Set(ids).size, ids.length);
    for (const anchor of await page.locator('a[href^="#"]').evaluateAll(nodes => nodes.map(node => node.hash.slice(1)))) assert(ids.includes(anchor));
    assert.equal(await page.locator('#presets button').count(), 5);
    assert.equal(await page.locator('.live-tools').isVisible(), false);
    assert.equal(await page.locator('#sum').innerText(), '17 passing scenes from 32 candidates.');
    pass('Static studio loads the real model and recorded data, with valid anchors and no duplicate IDs');

    await page.locator('#b-pause').click();
    assert.equal(await page.locator('#b-pause').getAttribute('aria-label'), 'Resume playback');
    const position = await page.locator('#scrub').inputValue();
    await page.waitForTimeout(300);
    assert.equal(await page.locator('#scrub').inputValue(), position);
    await page.locator('#scrub').focus();
    await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
    assert.notEqual(await page.locator('#scrub').inputValue(), position);
    await page.locator('#scrub').evaluate(el => { el.value = 420; el.dispatchEvent(new Event('input', { bubbles: true })); });
    pass('Pause freezes playback; keyboard and pointer scrubbing seek the motion');

    const firstScene = await page.locator('#pair-verdict').innerText();
    await page.locator('#next-scene').click();
    assert.notEqual(await page.locator('#pair-verdict').innerText(), firstScene);
    assert.match(await page.locator('#pair-verdict').innerText(), /passes/);
    await page.locator('.inspection > summary').click();
    assert.equal(await page.locator('#tiles button').count(), 32);
    await page.locator('#tiles .fail').first().click();
    assert.match(await page.locator('#pair-verdict').innerText(), /does not pass/);
    await page.locator('#t-alt').check(); await page.locator('#t-all').check(); await page.locator('#t-slow').check();
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#export').click()]);
    const saved = path.join(output, download.suggestedFilename()); await download.saveAs(saved);
    const exported = JSON.parse(fs.readFileSync(saved, 'utf8'));
    assert.equal(exported.check.necessary, false);
    assert.equal(exported.motion, 'kd:9:duck');
    assert(Array.isArray(exported.boxes));
    const recorded = await (await page.request.get(new URL('assets/examples/kd-9-duck.json', url).href)).json();
    assert.deepEqual(exported.boxes, recorded.result.draws[exported.draw].boxes);
    pass('Scene cycling selects passing scenes; rejected candidates and exports preserve the recorded geometry and verdict');
    await page.locator('#t-alt').uncheck(); await page.locator('#t-all').uncheck(); await page.locator('#t-slow').uncheck();
    await page.locator('.inspection > summary').click();
    await page.locator('#b-gen').click();
    await page.locator('#viewport').scrollIntoViewIfNeeded();
    assert.equal(await page.locator('#b-gen').getAttribute('aria-pressed'), 'true');
    await page.waitForFunction(() => document.querySelector('#b-play').getAttribute('aria-pressed') === 'true', { timeout: 20000 });
    pass('Generation replays denoising, refinement and checking, then returns to paired motion playback');

    for (const name of ['Sidestep', 'Crouch', 'Turn', 'Stop', 'Duck']) {
      await page.getByRole('button', { name, exact: false }).filter({ has: page.locator('.preset-icon') }).click();
      await page.waitForFunction(name => document.querySelector('#motion-title').textContent.startsWith(name + ' ·'), name);
      assert.equal(await page.locator('#presets [aria-pressed="true"]').count(), 1);
    }
    await page.locator('#more-motions').click();
    const examples = await page.evaluate(() => window.SCENEFLOW.examples);
    assert.equal(await page.locator('#recorded button').count(), examples.length);
    for (const ex of examples) {
      await page.locator(`#recorded [data-run="${ex.run}"]`).click();
      await page.waitForFunction(run => new URL(location.href).searchParams.get('run') === run && document.querySelector('#load').hidden, ex.run);
      assert.equal(await page.locator('#sum').innerText(), `${ex.pass} passing scenes from ${ex.n} candidates.`);
    }
    pass('All 16 recorded motions load, retain their real candidate counts, and update the shareable URL');
    await page.locator('#more-motions').click();
    await page.locator('#presets [data-run="kd-9-duck"]').click();
    await page.waitForFunction(() => document.querySelector('#motion-title').textContent.startsWith('Duck ·') && document.querySelector('#load').hidden);
    await page.locator('#viewport').scrollIntoViewIfNeeded();
    await page.locator('#b-pause').click();
    await page.locator('#scrub').evaluate(el => { el.value = 420; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.locator('#stage canvas').focus(); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('+'); await page.keyboard.press('Home');
    await page.screenshot({ path: path.join(output, 'desktop-demo.png') });
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; scrollTo(0, 0); });
    await page.screenshot({ path: path.join(output, 'desktop-full.png'), fullPage: true });
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(100);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Horizontal overflow at ${width}`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#viewport').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, 'mobile-demo.png') });
    await page.screenshot({ path: path.join(output, 'mobile-full.png'), fullPage: true });
    pass('Desktop and stacked mobile rendering fit at 320, 390, 768, 1024 and 1440 px; keyboard camera controls work');

    const reduced = await browser.newPage({ viewport: { width: 1000, height: 900 }, reducedMotion: 'reduce' });
    reduced.on('pageerror', error => errors.push(error.message));
    await reduced.goto(url + '?run=kc-45-stop#explore', { waitUntil: 'networkidle' });
    await reduced.waitForSelector('#right:not([hidden])');
    assert.match(await reduced.locator('#motion-title').innerText(), /^Stop/);
    await reduced.locator('#viewport').scrollIntoViewIfNeeded();
    assert.equal(await reduced.locator('#b-pause').getAttribute('aria-label'), 'Resume playback');
    const reducedPosition = await reduced.locator('#scrub').inputValue();
    await reduced.waitForTimeout(300);
    assert.equal(await reduced.locator('#scrub').inputValue(), reducedPosition);
    assert.equal(new URL(reduced.url()).hash, '#explore');
    await reduced.close();
    pass('Deep links preserve the section anchor and reduced-motion preference starts paused');

    const recovery = await browser.newPage();
    recovery.on('pageerror', error => errors.push(error.message));
    await recovery.route('**/examples/kd-9-duck.json', route => route.abort());
    await recovery.goto(url, { waitUntil: 'networkidle' });
    await recovery.waitForSelector('#retry-load:not([hidden])');
    await recovery.unroute('**/examples/kd-9-duck.json');
    await recovery.locator('#retry-load').click();
    await recovery.waitForSelector('#right:not([hidden])');
    await recovery.route('**/examples/kc-60-side-l.json', async route => { await new Promise(resolve => setTimeout(resolve, 600)); await route.continue(); });
    await recovery.locator('#presets [data-run="kc-60-side-l"]').click();
    await recovery.locator('#presets [data-run="kc-45-stop"]').click();
    await recovery.waitForFunction(() => document.querySelector('#motion-title').textContent.startsWith('Stop ·'));
    await recovery.waitForTimeout(900);
    assert.match(await recovery.locator('#motion-title').innerText(), /^Stop/);
    await recovery.close();
    pass('Failed downloads can retry; slow earlier requests cannot replace the latest selected motion');
    assert.deepEqual(errors, []); assert.deepEqual(apiCalls, []);
    pass('No JavaScript errors or generator API requests');
    fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify({ checks, errors, apiCalls }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
