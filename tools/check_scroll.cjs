// Scroll / UX review: wheel scrolling (stalls), nav-link + button anchor jumps (interrupted smooth scroll),
// long tasks and layout shifts while scrolling. Desktop and phone viewports.
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('playwright-core'); } })();
(async () => {
  const base = process.env.SITE_URL;
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const report = {};
  for (const [label, vp, thr] of [['desk', { width: 1440, height: 900 }, 1], ['phone', { width: 390, height: 844 }, 1], ['desk-cpu4x', { width: 1440, height: 900 }, 4]]) {
    const page = await browser.newPage({ viewport: vp });
    if (thr > 1) { const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: thr }); }
    await page.addInitScript(() => {
      window.__lt = []; window.__cls = [];
      new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask', buffered: true });
      new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (!e.hadRecentInput) window.__cls.push([Math.round(e.startTime), +e.value.toFixed(4), (e.sources || []).map((s) => s.node && (s.node.id || s.node.className || s.node.tagName)).join('|')]); })).observe({ type: 'layout-shift', buffered: true });
      // log every programmatic scroll of the window
      window.__prog = [];
      for (const fn of ['scrollTo', 'scrollBy', 'scroll']) { const o = window[fn].bind(window); window[fn] = (...a) => { window.__prog.push([fn, Math.round(performance.now())]); return o(...a); }; }
      const siv = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = function (...a) { window.__prog.push(['scrollIntoView:' + (this.getAttribute('href') || this.id || this.tagName), Math.round(performance.now())]); return siv.apply(this, a); };
    });
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const H = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    // 1) wheel scroll down the whole page, mouse at several x positions
    const r = { stalls: [], steps: 0 };
    await page.evaluate(() => { window.__fr = []; let last = 0; const f = (t) => { if (last) window.__fr.push(t - last); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f); });
    for (const xFrac of [0.5, 0.25]) {
      await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300);
      await page.mouse.move(vp.width * xFrac, vp.height * 0.55);
      let last = 0, stuck = 0;
      for (let i = 0; i < 400; i++) {
        await page.mouse.wheel(0, 240);
        await page.waitForTimeout(70);
        const y = await page.evaluate(() => scrollY);
        r.steps++;
        if (y <= last + 1 && y < H - 2) {
          stuck++;
          const what = await page.evaluate(([x, yy]) => { const el = document.elementFromPoint(x, yy); let n = el, path = []; while (n && path.length < 4) { path.push(n.id ? '#' + n.id : (n.className && typeof n.className === 'string' ? '.' + n.className.split(' ')[0] : n.tagName)); n = n.parentElement; } return path.join(' < '); }, [vp.width * xFrac, vp.height * 0.55]);
          r.stalls.push({ x: xFrac, y, over: what });
        } else stuck = 0;
        if (stuck > 25 || y >= H - 2) break;
        last = y;
      }
    }
    const fr = await page.evaluate(() => window.__fr.slice());
    fr.sort((a, b) => a - b);
    r.frames = { n: fr.length, p50: +fr[Math.floor(fr.length * 0.5)].toFixed(1), p95: +fr[Math.floor(fr.length * 0.95)].toFixed(1), over50ms: fr.filter((x) => x > 50).length };
    // 2) anchor jumps from the nav and the hero button
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(400);
    r.anchors = [];
    const links = label === 'desk' ? ['#video', '#idea', '#flow-matching', '#sceneflow', '#teacher', '#arena', '#results', '#student', '#deploy'] : ['#idea', '#teacher', '#student'];
    for (const h of ['hero', ...links]) {
      if (h === 'hero') { await page.locator('.hero-cta a[href="#idea"]').click(); }
      else { await page.locator(`.nav nav a[href="${h}"]`).click(); }
      await page.waitForTimeout(2200);
      const id = h === 'hero' ? 'idea' : h.slice(1);
      const top = await page.evaluate((i) => Math.round(document.getElementById(i).getBoundingClientRect().top), id);
      r.anchors.push([h, top, Math.abs(top - 72) < 40 ? 'ok' : 'MISSED']);
    }
    r.programmatic = (await page.evaluate(() => window.__prog)).slice(0, 12);
    r.programmaticCount = await page.evaluate(() => window.__prog.length);
    r.longtasks = (await page.evaluate(() => window.__lt)).sort((a, b) => b[1] - a[1]).slice(0, 8);
    r.cls = (await page.evaluate(() => window.__cls)).filter((e) => e[1] > 0.001).slice(0, 10);
    report[label] = r;
    await page.close();
  }
  console.log(JSON.stringify(report, null, 1));
  await browser.close();
})();
