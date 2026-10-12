// Functional UX review: play buttons, chapters, clip autoplay, nav highlight, mobile nav strip, gallery expander,
// keyboard sliders, reduced-motion mode.
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('playwright-core'); } })();
const results = [];
const ok = (name, cond, extra = '') => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  · ' + extra : ''}`);
(async () => {
  const base = process.env.SITE_URL;
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(base, { waitUntil: 'networkidle' });
  ok('hero reel autoplays', await page.locator('#reel').evaluate((v) => new Promise((r) => setTimeout(() => r(!v.paused && v.currentTime > 0), 1500))));
  // chapters seek + play the film
  await page.locator('#video').scrollIntoViewIfNeeded();
  await page.locator('.chapters button[data-t="476"]').click();
  await page.waitForTimeout(1500);
  const ft = await page.locator('#film').evaluate((v) => [v.currentTime, v.paused]);
  ok('chapter button seeks + plays film', ft[0] > 475 && !ft[1], `t=${ft[0].toFixed(1)}`);
  ok('active chapter highlighted', (await page.locator('.chapters button.on').getAttribute('data-t')) === '476');
  await page.locator('#film').evaluate((v) => v.pause());
  // nav highlight follows sections
  for (const id of ['flow-matching', 'teacher', 'student']) {
    await page.locator('#' + id).evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 60));
    await page.waitForTimeout(500);
    ok(`nav highlights #${id}`, (await page.locator('.nav nav a.on').getAttribute('href')) === '#' + id);
  }
  // widgets: play buttons
  for (const [w, sel, label] of [['#w-fm', '.v-t', 'flow toy'], ['#w-slots', '.v-k', 'slot scrubber'], ['#w-plan', '.v-n', 'planning explorer'], ['#w-lidar', '.v-t', 'lidar explorer']]) {
    await page.locator(w).scrollIntoViewIfNeeded(); await page.waitForSelector(w + '[data-ready]');
    await page.waitForTimeout(w === '#w-fm' ? 4000 : 200); // the flow toy autoplays once
    const before = await page.locator(w + ' ' + sel).textContent();
    await page.locator(w + ' .play').click(); await page.waitForTimeout(1200);
    const after = await page.locator(w + ' ' + sel).textContent();
    ok(`${label}: play advances`, before !== after, `${before.trim()} → ${after.trim()}`);
    const btxt = await page.locator(w + ' .play').textContent();
    await page.locator(w + ' .play').click();
    ok(`${label}: button toggles to pause`, /Pause/.test(btxt));
  }
  // flow toy condition switch + checkboxes
  await page.locator('#w-fm .seg button[data-c="duck"]').click(); await page.waitForTimeout(300);
  ok('flow toy: condition switch restarts from t=0', /t = 0\.[0-2]/.test(await page.locator('#w-fm .v-t').textContent()));
  await page.locator('#w-fm .v-pairs').check(); await page.locator('#w-fm .v-field').uncheck();
  ok('flow toy: toggles work', await page.locator('#w-fm .v-pairs').isChecked() && !(await page.locator('#w-fm .v-field').isChecked()));
  // keyboard: focus a slider and press arrows
  await page.locator('#w-lfh').scrollIntoViewIfNeeded(); await page.waitForSelector('#w-lfh[data-ready]');
  await page.locator('#w-lfh input[type=range]').focus();
  for (let i = 0; i < 25; i++) await page.keyboard.press('ArrowRight');
  ok('beam slider works from the keyboard', /1\.3[0-9]/.test(await page.locator('#w-lfh .v-z').textContent()), await page.locator('#w-lfh .v-text').textContent());
  await page.locator('#w-lfh .v-ghost').uncheck(); await page.waitForTimeout(400);
  ok('counterfactual toggle hides the ghost', (await page.locator('#w-lfh .lfh-img.ghost').evaluate((e) => getComputedStyle(e).opacity)) === '0');
  // clips autoplay when visible, pause when not
  const g = page.locator('.vgrid.g3 video').first();
  await g.scrollIntoViewIfNeeded(); await page.waitForTimeout(1500);
  ok('gallery clip autoplays in view', await g.evaluate((v) => !v.paused && v.currentTime > 0));
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(800);
  ok('gallery clip pauses out of view', await g.evaluate((v) => v.paused));
  // gallery expander
  await page.locator('#arena').scrollIntoViewIfNeeded();
  const h0 = await page.locator('#arena-gallery').evaluate((e) => e.clientHeight);
  await page.locator('.expand-btn').click(); await page.waitForTimeout(300);
  const h1 = await page.locator('#arena-gallery').evaluate((e) => e.clientHeight);
  ok('gallery expands to the full image', h1 > h0 + 100 && h1 >= (await page.locator('#arena-gallery img').evaluate((i) => Math.floor(i.getBoundingClientRect().height))), `${h0} → ${h1}px`);
  await page.locator('.expand-btn').click(); await page.waitForTimeout(600);
  ok('gallery collapses', (await page.locator('#arena-gallery').evaluate((e) => e.clientHeight)) === h0);
  ok('no JS errors (desktop)', errs.length === 0, errs.join(' | '));
  await page.close();
  // phone: nav strip follows the active section
  const ph = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await ph.goto(base, { waitUntil: 'networkidle' });
  await ph.locator('#deploy').evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 60));
  await ph.waitForTimeout(1200);
  const vis = await ph.evaluate(() => { const n = document.querySelector('.nav nav'), a = n.querySelector('a.on'); if (!a) return 'none'; const nr = n.getBoundingClientRect(), ar = a.getBoundingClientRect(); return ar.left >= nr.left - 1 && ar.right <= nr.right + 1 ? 'visible' : 'hidden'; });
  ok('phone: active nav link scrolled into the strip', vis === 'visible', vis);
  await ph.close();
  // reduced motion
  const rm = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const rerr = []; rm.on('pageerror', (e) => rerr.push(e.message));
  await rm.goto(base, { waitUntil: 'networkidle' }); await rm.waitForTimeout(800);
  ok('reduced motion: reel does not autoplay, has controls', await rm.locator('#reel').evaluate((v) => v.paused && v.controls));
  const g2 = rm.locator('.vgrid.g3 video').first(); await g2.scrollIntoViewIfNeeded(); await rm.waitForTimeout(800);
  ok('reduced motion: clips load with controls, no autoplay', await g2.evaluate((v) => v.paused && v.controls && !!v.src));
  ok('no JS errors (reduced motion)', rerr.length === 0, rerr.join(' | '));
  await rm.close();
  await browser.close();
  console.log(results.join('\n'));
})().catch((e) => { console.log(results.join('\n')); console.error('ERROR', e.message); process.exit(1); });
