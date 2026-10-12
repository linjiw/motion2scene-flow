/* Two Flows homepage: hero field, video chapters, lazy clips, scroll-spy, animated bars and five interactive explainers.
   No dependencies. Widget data lives in home/data/*.json (base64-packed arrays). */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const C = {
    amber: "#e8892b", amberL: "#fbe3c8", teal: "#13897f", tealL: "#cdeee9", indigo: "#4a55c8", red: "#d9473b",
    green: "#2f9e57", slate: "#5b6578", blue: "#2f6fd6", ink: "#141a26", ink2: "#3d4657", muted: "#677184",
    line: "#d5dbe4", bg: "#f3f5f8", bg2: "#e8ecf2", white: "#ffffff",
  };
  const MONO = "500 13px 'Plex Mono', ui-monospace, monospace";
  const SANS = (w, s) => `${w} ${s}px 'Plex Sans', Arial, sans-serif`;

  // ------------------------------------------------------------------ helpers
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, u) => a + (b - a) * u;
  const ease = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, u) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], u))).join(",")})`; };
  function bytes(s) { const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function i16(o) { const u = bytes(o.i16); const a = new Int16Array(u.buffer); const f = new Float32Array(a.length); for (let i = 0; i < a.length; i++) f[i] = a[i] * o.scale; return f; }
  function u8(o) { return bytes(o.u8); }
  function u2(o) { const b = bytes(o.u2); const out = new Uint8Array(b.length * 4); for (let i = 0; i < b.length; i++) { const v = b[i]; out[4 * i] = v & 3; out[4 * i + 1] = (v >> 2) & 3; out[4 * i + 2] = (v >> 4) & 3; out[4 * i + 3] = (v >> 6) & 3; } return out; }
  function fit(cv) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }
  function lazy(el, fn, margin = "400px") {
    if (!("IntersectionObserver" in window)) return fn();
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); fn(); } }, { rootMargin: margin });
    io.observe(el);
  }
  const getJSON = (u) => fetch(u).then((r) => r.json());
  function rrect(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function poly(ctx, pts) { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); }
  function arrowHead(ctx, x, y, dx, dy, s) { const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - dx * s - dy * s * 0.55, y - dy * s + dx * s * 0.55); ctx.lineTo(x - dx * s + dy * s * 0.55, y - dy * s - dx * s * 0.55); ctx.closePath(); ctx.fill(); }
  function pillText(ctx, x, y, s, bg, fg, font = SANS(600, 13), anchor = "l") {
    ctx.font = font; const w = ctx.measureText(s).width + 20, h = 24;
    const x0 = anchor === "r" ? x - w : anchor === "c" ? x - w / 2 : x;
    rrect(ctx, x0, y, w, h, 12); ctx.fillStyle = bg; ctx.fill(); ctx.fillStyle = fg; ctx.textBaseline = "middle"; ctx.fillText(s, x0 + 10, y + h / 2 + 0.5); ctx.textBaseline = "alphabetic";
  }
  /** play/pause loop that calls step(dtSeconds); returns {start, stop, playing} */
  function looper(btn, step, labels) {
    let raf = 0, last = 0, on = false;
    const tick = (now) => { const dt = last ? Math.min((now - last) / 1000, 0.1) : 0; last = now; if (step(dt) === false) { stop(); return; } raf = requestAnimationFrame(tick); };
    function start() { if (on) return; on = true; last = 0; btn.textContent = labels[1]; raf = requestAnimationFrame(tick); }
    function stop() { on = false; cancelAnimationFrame(raf); btn.textContent = labels[0]; }
    btn.addEventListener("click", () => (on ? stop() : start()));
    return { start, stop, get playing() { return on; } };
  }

  // ------------------------------------------------------------------ hero flow field
  (function hero() {
    const cv = $("#hero-field"); if (!cv) return;
    let parts = [], visible = true, raf = 0, t = 0;
    function reset() {
      const { w, h } = fit(cv);
      const n = Math.round(Math.min(900, (w * h) / 1500));
      parts = Array.from({ length: n }, (_, i) => ({ x: Math.random() * w, y: Math.random() * h, c: i % 2 ? "rgba(244,162,79," : "rgba(63,193,180," }));
      const ctx = cv.getContext("2d"); ctx.fillStyle = C.ink; ctx.fillStyle = "#0f1420"; ctx.fillRect(0, 0, w, h);
    }
    function vel(x, y, w, h) {
      const X = (x / w) * 6.28, Y = (y / h) * 6.28;
      return [(Math.cos(Y * 0.9 + 0.3 * t) + 0.6 * Math.sin(X * 0.5 - 0.2 * t)) * 55, (0.5 * Math.sin(X * 0.8 + 0.25 * t) - 0.35 * Math.cos(Y * 1.3)) * 55];
    }
    function frame() {
      const { ctx, w, h } = fit(cv);
      ctx.fillStyle = "rgba(15,20,32,0.075)"; ctx.fillRect(0, 0, w, h);
      ctx.lineWidth = 1.4;
      const dt = 1 / 60; t += dt;
      for (const p of parts) {
        const [vx, vy] = vel(p.x, p.y, w, h);
        const nx = p.x + vx * dt, ny = p.y + vy * dt;
        ctx.strokeStyle = p.c + "0.42)"; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(nx, ny); ctx.stroke();
        p.x = nx; p.y = ny;
        if (p.x < 0 || p.x > w || p.y < 0 || p.y > h || Math.random() < 0.004) { p.x = Math.random() * w; p.y = Math.random() * h; }
      }
      if (visible && !RM) raf = requestAnimationFrame(frame);
    }
    reset();
    if (RM) { for (let i = 0; i < 160; i++) frame(); } else raf = requestAnimationFrame(frame);
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible && !RM) { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); } }).observe(cv);
    let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(reset, 150); });
  })();

  // ------------------------------------------------------------------ video, clips, nav, bars
  const reel = $("#reel");
  if (reel && !RM) new IntersectionObserver((es) => { es[0].isIntersecting ? reel.play().catch(() => {}) : reel.pause(); }, { threshold: 0.25 }).observe(reel);
  if (reel && RM) reel.setAttribute("controls", "");

  const film = $("#film");
  const chapterBtns = $$(".chapters button");
  chapterBtns.forEach((b) => b.addEventListener("click", () => { film.currentTime = +b.dataset.t; film.play().catch(() => {}); }));
  if (film) film.addEventListener("timeupdate", () => {
    let cur = chapterBtns[0];
    for (const b of chapterBtns) if (film.currentTime + 0.3 >= +b.dataset.t) cur = b;
    chapterBtns.forEach((b) => b.classList.toggle("on", b === cur));
  });

  const clipIO = new IntersectionObserver((es) => {
    for (const e of es) {
      const v = e.target;
      if (e.isIntersecting) {
        if (!v.src) v.src = v.dataset.src;
        if (RM) v.setAttribute("controls", ""); else v.play().catch(() => {});
      } else if (!v.paused) v.pause();
    }
  }, { threshold: 0.35 });
  $$("video[data-src]").forEach((v) => clipIO.observe(v));

  const barIO = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); barIO.unobserve(e.target); } }), { threshold: 0.3 });
  $$("[data-anim]").forEach((el) => barIO.observe(el));

  const navLinks = new Map($$(".nav nav a").map((a) => [a.getAttribute("href").slice(1), a]));
  const spy = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) { navLinks.forEach((a) => a.classList.remove("on")); const a = navLinks.get(e.target.id); if (a) { a.classList.add("on"); a.scrollIntoView({ block: "nearest", inline: "nearest" }); } }
  }, { rootMargin: "-40% 0px -55% 0px" });
  ["video", "idea", "flow-matching", "sceneflow", "teacher", "arena", "results", "student", "deploy"].forEach((id) => { const s = document.getElementById(id); if (s) spy.observe(s); });

  // ------------------------------------------------------------------ 1. learning from hallucination: beam slider
  (function lfh() {
    const root = $("#w-lfh"); if (!root) return;
    lazy(root, async () => {
      const m = await getJSON(root.dataset.src);
      const cv = $(".lfh-canvas", root), sl = $("input[type=range]", root), gh = $(".v-ghost", root), ghostImg = $(".lfh-img.ghost", root);
      const P = (x, z) => [(m.cx + (x - m.xref) * m.fpx) * m.sc, (m.cy - (z - m.zref) * m.fpx - m.y0) * m.sc];
      function draw() {
        const { ctx, w, h } = fit(cv); const s = w / m.w; ctx.clearRect(0, 0, w, h);
        const z0 = +sl.value;
        const [x0, y0] = P(m.beam_x - m.beam_half, z0 + m.beam_thick), [x1, y1] = P(m.beam_x + m.beam_half, z0);
        // height guide
        ctx.setLineDash([7, 6]); ctx.strokeStyle = "rgba(232,137,43,.75)"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(0, y1 * s); ctx.lineTo(w, y1 * s); ctx.stroke(); ctx.setLineDash([]);
        // beam seen end-on, with a soft halo
        ctx.fillStyle = "rgba(232,137,43,.18)"; rrect(ctx, (x0 - 16) * s, (y0 - 16) * s, (x1 - x0 + 32) * s, (y1 - y0 + 32) * s, 10); ctx.fill();
        ctx.fillStyle = C.amber; rrect(ctx, x0 * s, y0 * s, (x1 - x0) * s, (y1 - y0) * s, 4); ctx.fill();
        ctx.font = SANS(600, Math.max(12, 21 * s)); ctx.fillStyle = C.amber;
        ctx.fillText(`${z0.toFixed(2)} m`, 8, y1 * s - 7);
        const up = z0 < m.upright_top, dk = z0 < m.duck_top;
        $(".v-z", root).textContent = `${z0.toFixed(2)} m`;
        const vu = $(".v-up", root), vd = $(".v-dk", root), vt = $(".v-text", root);
        vu.textContent = up ? "hits" : "clears"; vu.classList.toggle("hit", up);
        vd.textContent = dk ? "hits" : "clears"; vd.classList.toggle("hit", dk);
        vt.classList.remove("bad", "meh");
        if (dk) { vt.textContent = "impossible: the duck hits too — rejected"; vt.classList.add("bad"); }
        else if (up) vt.textContent = "necessary: upright hits, duck clears — kept";
        else { vt.textContent = "explains nothing: both clear — rejected"; vt.classList.add("meh"); }
      }
      sl.addEventListener("input", draw);
      gh.addEventListener("change", () => { ghostImg.style.opacity = gh.checked ? 1 : 0; });
      new ResizeObserver(draw).observe(cv); draw(); root.dataset.ready = "1";
    });
  })();

  // ------------------------------------------------------------------ 2. flow matching toy
  (function fm() {
    const root = $("#w-fm"); if (!root) return;
    lazy(root, async () => {
      const d = await getJSON(root.dataset.src);
      const NS = d.ts.length, NP = d.traj.stand.shape[1];
      const traj = { stand: i16(d.traj.stand), duck: i16(d.traj.duck) };
      const data = { stand: i16(d.data.stand), duck: i16(d.data.duck) };
      const grid = i16(d.grid), field = { stand: i16(d.field.stand), duck: i16(d.field.duck) }, NG = d.grid.shape[0];
      // colour by final height on the standing silhouette, bucketed for fast batched drawing
      let ymin = 1e9, ymax = -1e9; const last = (NS - 1) * NP * 2;
      for (let i = 0; i < NP; i++) { const y = traj.stand[last + 2 * i + 1]; ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); }
      const NB = 18, bucket = new Uint8Array(NP), bcol = Array.from({ length: NB }, (_, k) => mix(C.amber, C.indigo, k / (NB - 1)));
      for (let i = 0; i < NP; i++) bucket[i] = Math.round(((traj.stand[last + 2 * i + 1] - ymin) / (ymax - ymin)) * (NB - 1));
      const pairs = Array.from({ length: 14 }, (_, k) => Math.floor((k * 9973) % NP));
      const cv = $(".fm-canvas", root), sl = $("input[type=range]", root), fld = $(".v-field", root), prs = $(".v-pairs", root);
      let cond = "stand", t = +sl.value;
      const R = 1.85;
      function draw() {
        const { ctx, w, h } = fit(cv); const S = w / (2 * R);
        const X = (x) => w / 2 + x * S, Y = (y) => h / 2 - y * S;
        ctx.fillStyle = C.white; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#edf0f5"; ctx.lineWidth = 1;
        for (let k = -1.5; k <= 1.51; k += 0.5) { ctx.beginPath(); ctx.moveTo(X(k), 0); ctx.lineTo(X(k), h); ctx.moveTo(0, Y(k)); ctx.lineTo(w, Y(k)); ctx.stroke(); }
        // ghost of the data
        ctx.fillStyle = "rgba(232,137,43,.22)"; const D = data[cond];
        for (let i = 0; i < D.length; i += 2) ctx.fillRect(X(D[i]) - 1.4, Y(D[i + 1]) - 1.4, 2.8, 2.8);
        // field arrows
        if (fld.checked) {
          const tf = Math.min(t, 0.95), ft = d.ft; let j = 0; while (j < ft.length - 2 && ft[j + 1] <= tf) j++;
          const u = clamp((tf - ft[j]) / (ft[j + 1] - ft[j])), F = field[cond], o0 = j * NG * 2, o1 = (j + 1) * NG * 2;
          let ref = 0; const mags = new Float32Array(NG);
          for (let g = 0; g < NG; g++) { const vx = lerp(F[o0 + 2 * g], F[o1 + 2 * g], u), vy = lerp(F[o0 + 2 * g + 1], F[o1 + 2 * g + 1], u); mags[g] = Math.hypot(vx, vy); }
          const sorted = Array.from(mags).sort((a, b) => a - b); ref = sorted[Math.floor(NG * 0.9)] + 1e-6;
          const cell = (S * 3.0) / 24;
          ctx.strokeStyle = C.ink2; ctx.fillStyle = C.ink2; ctx.lineWidth = 1.3;
          for (let g = 0; g < NG; g++) {
            const vx = lerp(F[o0 + 2 * g], F[o1 + 2 * g], u), vy = lerp(F[o0 + 2 * g + 1], F[o1 + 2 * g + 1], u), m = mags[g];
            const L = Math.min(m / ref, 1) * cell * 0.85; if (L < 2.5) continue;
            const px = X(grid[2 * g]), py = Y(grid[2 * g + 1]), dx = vx / m, dy = -vy / m;
            ctx.globalAlpha = 0.2 + 0.5 * Math.min(m / ref, 1);
            ctx.beginPath(); ctx.moveTo(px - dx * L * 0.15, py - dy * L * 0.15); ctx.lineTo(px + dx * L, py + dy * L); ctx.stroke();
            arrowHead(ctx, px + dx * (L + 3), py + dy * (L + 3), dx, dy, 5.5);
          }
          ctx.globalAlpha = 1;
        }
        // particles
        const f = t * (NS - 1), i0 = Math.floor(Math.min(f, NS - 1.0001)), uu = f - i0, A = traj[cond], o0 = i0 * NP * 2, o1 = (i0 + 1) * NP * 2;
        const r = Math.max(1.6, w / 300);
        for (let b = 0; b < NB; b++) {
          ctx.fillStyle = bcol[b]; ctx.beginPath();
          for (let i = 0; i < NP; i++) {
            if (bucket[i] !== b) continue;
            const x = lerp(A[o0 + 2 * i], A[o1 + 2 * i], uu), y = lerp(A[o0 + 2 * i + 1], A[o1 + 2 * i + 1], uu);
            ctx.moveTo(X(x) + r, Y(y)); ctx.arc(X(x), Y(y), r, 0, 6.2832);
          }
          ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1;
        }
        // training pairs: noise point, data point, the in-between x_t and its target velocity
        if (prs.checked) {
          const oL = (NS - 1) * NP * 2;
          for (const i of pairs) {
            const x0 = A[2 * i], y0 = A[2 * i + 1], x1 = A[oL + 2 * i], y1 = A[oL + 2 * i + 1];
            ctx.setLineDash([5, 5]); ctx.strokeStyle = "rgba(20,26,38,.55)"; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(X(x0), Y(y0)); ctx.lineTo(X(x1), Y(y1)); ctx.stroke(); ctx.setLineDash([]);
            ctx.fillStyle = C.slate; ctx.beginPath(); ctx.arc(X(x0), Y(y0), 4.5, 0, 6.28); ctx.fill();
            ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(X(x1), Y(y1), 4.5, 0, 6.28); ctx.fill();
            const xt = lerp(x0, x1, t), yt = lerp(y0, y1, t), qx = X(xt), qy = Y(yt), dx = (x1 - x0) * S * 0.3, dy = -(y1 - y0) * S * 0.3;
            ctx.strokeStyle = C.teal; ctx.fillStyle = C.teal; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(qx + dx, qy + dy); ctx.stroke(); arrowHead(ctx, qx + dx, qy + dy, dx, dy, 9);
            ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(qx, qy, 5, 0, 6.28); ctx.fill();
          }
        }
        pillText(ctx, 12, 12, `condition c = ${cond}`, cond === "duck" ? C.amber : C.ink, C.white);
        pillText(ctx, w - 12, 12, `Euler step ${Math.round(t * 48)} / 48`, C.ink, C.white, MONO, "r");
        $(".v-t", root).textContent = `t = ${t.toFixed(2)}`;
      }
      const btn = $(".play", root);
      const loop = looper(btn, (dt) => { t = Math.min(1, t + dt / 3.2); sl.value = t; draw(); return t < 1; }, ["▶ Play the flow", "❚❚ Pause"]);
      btn.addEventListener("click", () => { if (!loop.playing && t >= 0.999) { t = 0; } }, true);
      sl.addEventListener("input", () => { loop.stop(); t = +sl.value; draw(); });
      fld.addEventListener("change", draw); prs.addEventListener("change", draw);
      $$(".seg button", root).forEach((b) => b.addEventListener("click", () => {
        cond = b.dataset.c; $$(".seg button", root).forEach((x) => x.classList.toggle("on", x === b));
        t = 0; sl.value = 0; draw(); if (!RM) loop.start();
      }));
      new ResizeObserver(draw).observe(cv); draw(); root.dataset.ready = "1";
      if (!RM) { const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { io.disconnect(); setTimeout(() => loop.start(), 400); } }, { threshold: 0.5 }); io.observe(cv); }
    });
  })();

  // ------------------------------------------------------------------ 3. SceneFlow slot scrubber
  (function slots() {
    const root = $("#w-slots"); if (!root) return;
    lazy(root, async () => {
      const d = await getJSON(root.dataset.src);
      const P = d.path, MP = d.motion, cv = $(".slots-canvas", root), sl = $("input[type=range]", root);
      const COLS = ["exist", "ground", "low", "mid", "over", "x", "y", "yaw", "size x", "size y", "bottom", "top"];
      const KINDS = ["ground", "low", "mid", "overhead"];
      let k = +sl.value;
      const heat = (v) => { v = clamp(v / 2, -1, 1); return v >= 0 ? mix("#ffffff", C.amber, v) : mix("#ffffff", C.slate, -v); };
      function decode(s) {
        let kk = 1; for (let j = 2; j <= 4; j++) if (s[j] > s[kk]) kk = j;
        const kind = KINDS[kk - 1], cx = s[5] * 1.5 + 1.0, cy = s[6] * 1.2, yaw = clamp(s[7], -1, 1) * Math.PI / 4;
        const hx = Math.max(Math.exp(clamp(s[8], -3, 2.5) - 1.4), 0.02), hy = Math.max(Math.exp(clamp(s[9], -3, 2.5) - 1.4), 0.02);
        return { kind, cx, cy, yaw, hx, hy, a: ease((s[0] + 0.15) / 0.45) };
      }
      function draw() {
        const { ctx, w, h } = fit(cv); ctx.clearRect(0, 0, w, h);
        const f = k, i0 = Math.min(Math.floor(f), 39), u = f - i0;
        const X = P[i0].map((row, r) => row.map((v, c) => lerp(v, P[i0 + 1][r][c], u)));
        const narrow = w < 640;
        const tableW = narrow ? w : Math.min(w * 0.6, 900), cw = (tableW - 70) / 12;
        const ch = narrow ? Math.min((h * 0.52 - 40) / 8, cw * 0.9) : Math.min((h - 60) / 8, cw * 0.72), tx = 64, ty = narrow ? 8 : 26;
        ctx.font = SANS(600, Math.max(10, Math.min(14, cw * 0.24))); ctx.textAlign = "center"; ctx.fillStyle = C.ink2;
        const SHORT = ["∃", "gnd", "low", "mid", "ovh", "x", "y", "yaw", "sx", "sy", "bot", "top"];
        (narrow ? SHORT : COLS).forEach((c, j) => ctx.fillText(c, tx + j * cw + cw / 2, ty + 8 * ch + 18));
        ctx.textAlign = "right"; ctx.fillStyle = C.muted; ctx.font = SANS(500, Math.max(10, Math.min(13, ch * 0.4)));
        for (let r = 0; r < 8; r++) {
          ctx.fillStyle = C.muted; ctx.textAlign = "right"; ctx.fillText(`slot ${r + 1}`, tx - 8, ty + r * ch + ch / 2 + 4);
          for (let c = 0; c < 12; c++) { ctx.fillStyle = heat(X[r][c]); rrect(ctx, tx + c * cw + 2, ty + r * ch + 2, cw - 4, ch - 4, 5); ctx.fill(); }
        }
        ctx.textAlign = "left";
        // top view
        const vx = narrow ? 0 : tableW + 30, vw = narrow ? w : w - vx - 4;
        const vy = narrow ? ty + 8 * ch + 34 : 14, vh = narrow ? h - vy - 4 : h - 30;
        rrect(ctx, vx, vy, vw, vh, 12); ctx.fillStyle = C.bg; ctx.fill();
        ctx.save(); rrect(ctx, vx, vy, vw, vh, 12); ctx.clip();
        const ppm = Math.min(vw / 4.6, vh / 3.6), ox = vx + vw * 0.16, oy = vy + vh / 2;
        const T = (x, y) => [ox + x * ppm, oy - y * ppm];
        ctx.strokeStyle = C.ink; ctx.lineWidth = 3; poly(ctx, MP.map((p) => T(p[0], p[1]))); ctx.stroke();
        for (const s of X) {
          const b = decode(s); if (b.a < 0.02) continue;
          const col = b.kind === "overhead" ? C.amber : b.kind === "ground" ? C.red : C.indigo;
          const [px, py] = T(b.cx, b.cy);
          ctx.save(); ctx.translate(px, py); ctx.rotate(-b.yaw); ctx.globalAlpha = 0.85 * b.a; ctx.fillStyle = col;
          ctx.fillRect(-b.hx * ppm, -b.hy * ppm, 2 * b.hx * ppm, 2 * b.hy * ppm); ctx.restore();
        }
        ctx.restore();
        ctx.font = SANS(500, 13); ctx.fillStyle = C.muted; ctx.fillText("top view · motion path + decoded boxes", vx + 12, vy + 20);
        if (f >= 20) pillText(ctx, vx + vw - 10, vy + vh - 34, "guidance on (t ≥ 0.5)", C.amber, C.white, SANS(600, 12), "r");
        $(".v-k", root).textContent = `${Math.round(f)} / 40 · t = ${(f / 40).toFixed(2)}`;
      }
      const loop = looper($(".play", root), (dt) => { k = Math.min(40, k + dt * 8); sl.value = k; draw(); return k < 40; }, ["▶ Play", "❚❚ Pause"]);
      $(".play", root).addEventListener("click", () => { if (k >= 40) { k = 0; } }, true);
      sl.addEventListener("input", () => { loop.stop(); k = +sl.value; draw(); });
      new ResizeObserver(draw).observe(cv); draw(); root.dataset.ready = "1";
    });
  })();

  // ------------------------------------------------------------------ 4. planning explorer (slalom)
  (function plan() {
    const root = $("#w-plan"); if (!root) return;
    lazy(root, async () => {
      const d = await getJSON(root.dataset.src);
      const cv = $(".plan-canvas", root), sl = $("input[type=range]", root), N = d.plans.length;
      sl.max = N - 1;
      let simT = d.plans[+sl.value].tick / 50;
      const xs = d.boxes.map((b) => b[0]), ys = d.boxes.map((b) => b[1]);
      const ext = [Math.min(...xs) - 0.4, Math.max(...xs) + 0.4, Math.min(...ys) - 0.4, Math.max(...ys) + 0.4];
      const planAt = (t) => { let n = 0; for (let i = 0; i < N; i++) if (d.plans[i].tick <= t * 50 + 1e-6) n = i; return n; };
      const pose = (t) => { const f = Math.min(t / d.dt, d.traj.length - 1.001), i = Math.floor(f), u = f - i, a = d.traj[i], b = d.traj[i + 1]; const dy = Math.atan2(Math.sin(b[2] - a[2]), Math.cos(b[2] - a[2])); return [lerp(a[0], b[0], u), lerp(a[1], b[1], u), a[2] + u * dy]; };
      function boxPath(ctx, T, b, s, infl = 0) {
        const [cx, cy, hx, hy, yaw] = b, c = Math.cos(yaw), sn = Math.sin(yaw);
        const pts = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([u, v]) => T(cx + c * u * (hx + infl) - sn * v * (hy + infl), cy + sn * u * (hx + infl) + c * v * (hy + infl)));
        poly(ctx, pts); ctx.closePath();
      }
      function scene(ctx, T, s, n, t, detail) {
        const p = d.plans[n];
        for (const b of d.boxes) { boxPath(ctx, T, b, s); ctx.fillStyle = b[7] >= 2 ? "#d8dde5" : C.red; ctx.globalAlpha = b[7] >= 2 ? 1 : 0.92; ctx.fill(); ctx.globalAlpha = 1; }
        if (detail) { ctx.setLineDash([6, 5]); ctx.strokeStyle = "rgba(217,71,59,.7)"; ctx.lineWidth = 1.5; for (const b of d.boxes) if (b[7] < 2) { boxPath(ctx, T, b, s, 0.08); ctx.stroke(); } ctx.setLineDash([]); }
        const g = T(d.goal[0], d.goal[1]); ctx.fillStyle = "rgba(47,158,87,.25)"; ctx.beginPath(); ctx.arc(g[0], g[1], 0.4 * s, 0, 6.28); ctx.fill();
        ctx.fillStyle = C.green; ctx.font = SANS(700, Math.max(10, 0.16 * s)); ctx.textAlign = "center"; ctx.fillText("goal", g[0], g[1] + 4); ctx.textAlign = "left";
        // trail
        ctx.fillStyle = C.blue; const ti = Math.floor(t / d.dt);
        for (let i = 0; i <= ti && i < d.traj.length; i += detail ? 1 : 2) { const q = T(d.traj[i][0], d.traj[i][1]); ctx.beginPath(); ctx.arc(q[0], q[1], detail ? 2.6 : 1.8, 0, 6.28); ctx.fill(); }
        if (detail) {
          ctx.setLineDash([8, 6]); ctx.strokeStyle = C.ink2; ctx.lineWidth = 2; poly(ctx, p.route.map((q) => T(q[0], q[1]))); ctx.stroke(); ctx.setLineDash([]);
          if (p.goal) { const q = T(p.goal[0], p.goal[1]); ctx.save(); ctx.translate(q[0], q[1]); ctx.rotate(Math.PI / 4); ctx.fillStyle = C.green; ctx.fillRect(-6, -6, 12, 12); ctx.restore(); }
          if (p.cands) {
            p.cands.forEach((cnd, i) => { if (i === p.choice) return; ctx.strokeStyle = p.safe[i] ? C.teal : C.red; ctx.globalAlpha = 0.75; ctx.lineWidth = 2.4; poly(ctx, cnd.map((q) => T(q[0], q[1]))); ctx.stroke(); const e = T(...cnd[cnd.length - 1]); ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(e[0], e[1], 3.4, 0, 6.28); ctx.fill(); });
            ctx.globalAlpha = 1;
            const ch = p.cands[p.choice].map((q) => T(q[0], q[1]));
            ctx.strokeStyle = C.teal; ctx.lineWidth = 5.5; poly(ctx, ch); ctx.stroke();
            // executed part: the first 0.16 s of the 1 s plan (points every 0.1 s)
            const ex = [ch[0], ch[1], [lerp(ch[1][0], ch[2][0], 0.6), lerp(ch[1][1], ch[2][1], 0.6)]];
            ctx.strokeStyle = C.blue; ctx.lineWidth = 8; ctx.lineCap = "round"; poly(ctx, ex); ctx.stroke(); ctx.lineCap = "butt";
            const e = ch[ch.length - 1]; ctx.fillStyle = C.teal; ctx.beginPath(); ctx.arc(e[0], e[1], 6.5, 0, 6.28); ctx.fill(); ctx.strokeStyle = C.white; ctx.lineWidth = 2; ctx.stroke();
          }
        }
        // robot
        const [rx, ry, yaw] = pose(t), q = T(rx, ry), half = (p.tight ? 0.19 : 0.25) * s, dep = 0.1 * s;
        ctx.save(); ctx.translate(q[0], q[1]); ctx.rotate(-yaw); rrect(ctx, -dep, -half, 2 * dep, 2 * half, Math.min(dep, half) * 0.8);
        ctx.fillStyle = detail ? "rgba(20,26,38,.55)" : C.ink; ctx.fill();
        ctx.strokeStyle = C.white; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0.3 * s, 0); ctx.stroke(); ctx.restore();
      }
      function draw() {
        const { ctx, w, h } = fit(cv); ctx.clearRect(0, 0, w, h);
        const n = planAt(simT), p = d.plans[n];
        // overview strip
        const oh = h * 0.27, os = Math.min((w - 24) / (ext[1] - ext[0]), (oh - 12) / (ext[3] - ext[2]));
        const ox = (w - (ext[1] - ext[0]) * os) / 2, oy = 6;
        const TO = (x, y) => [ox + (x - ext[0]) * os, oy + (ext[3] - y) * os];
        rrect(ctx, 0, 0, w, oh, 10); ctx.fillStyle = C.bg; ctx.fill();
        scene(ctx, TO, os, n, simT, false);
        // zoom view
        const zy = oh + 10, zh = h - zy, [rx, ry, yaw] = pose(simT);
        const span = Math.max(3.0, Math.min(4.4, w / 300)), zs = w / span;
        const cx = rx + 0.75 * Math.cos(yaw), cy = ry + 0.75 * Math.sin(yaw) * 0.3;
        const TZ = (x, y) => [w / 2 + (x - cx) * zs, zy + zh / 2 - (y - cy) * zs];
        // zoom window on the overview
        ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.strokeRect(TO(cx - span / 2, 0)[0], TO(0, cy + zh / zs / 2)[1], span * os, (zh / zs) * os);
        ctx.save(); rrect(ctx, 0, zy, w, zh, 10); ctx.clip(); ctx.fillStyle = C.white; ctx.fillRect(0, zy, w, zh);
        ctx.strokeStyle = "#eef1f5"; ctx.lineWidth = 1;
        for (let gx = Math.floor(cx - span); gx <= cx + span; gx += 0.5) { const q = TZ(gx, 0); ctx.beginPath(); ctx.moveTo(q[0], zy); ctx.lineTo(q[0], h); ctx.stroke(); }
        for (let gy = Math.floor(cy - 3); gy <= cy + 3; gy += 0.5) { const q = TZ(0, gy); ctx.beginPath(); ctx.moveTo(0, q[1]); ctx.lineTo(w, q[1]); ctx.stroke(); }
        scene(ctx, TZ, zs, n, simT, true);
        ctx.restore();
        rrect(ctx, 0.5, zy + 0.5, w - 1, zh - 1, 10); ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.stroke();
        pillText(ctx, 12, zy + 12, `t = ${simT.toFixed(1)} s`, C.ink, C.white, MONO);
        sl.value = n;
        $(".v-n", root).textContent = `${n + 1} / ${N}`;
        const mode = p.narrow ? "narrow: smaller margins" : p.tight ? "tight: slow + arms in" : "walk";
        const vm = $(".v-mode", root); vm.textContent = `mode · ${mode}`; vm.className = `chip v-mode ${p.tight ? "blue" : ""}`;
        $(".v-safe", root).textContent = p.safe ? `${p.safe.reduce((a, b) => a + b, 0)} / ${p.safe.length} safe` : "—";
      }
      const loop = looper($(".play", root), (dt) => { simT += dt * 0.6; if (simT >= d.T) { simT = d.T; draw(); return false; } draw(); return true; }, ["▶ Play run", "❚❚ Pause"]);
      $(".play", root).addEventListener("click", () => { if (simT >= d.T - 0.05) simT = 0; }, true);
      sl.addEventListener("input", () => { loop.stop(); simT = d.plans[+sl.value].tick / 50; draw(); });
      new ResizeObserver(draw).observe(cv); draw(); root.dataset.ready = "1";
    });
  })();

  // ------------------------------------------------------------------ 5. lidar explorer (student, double beam)
  (function lidar() {
    const root = $("#w-lidar"); if (!root) return;
    lazy(root, async () => {
      const d = await getJSON(root.dataset.src);
      const [X0, X1, Y0, Y1] = d.view, [NI, NJ] = d.grid, NK = d.mem_t.length;
      const mem = u2(d.mem), tmap = u8(d.tmap), smap = u8(d.smap);
      const cv = $(".lidar-canvas", root), ct = $(".map-t", root), cs = $(".map-s", root), sl = $("input[type=range]", root);
      sl.max = d.T;
      let t = +sl.value;
      const PAL = [[0, 0, 0, 0], [214, 220, 230, 235], [217, 71, 59, 240], [232, 137, 43, 250]];
      const memCanvas = Array.from({ length: NK }, () => null);
      function memLayer(k) {
        if (memCanvas[k]) return memCanvas[k];
        const off = document.createElement("canvas"); off.width = NI; off.height = NJ;
        const g = off.getContext("2d"), img = g.createImageData(NI, NJ), base = k * NI * NJ;
        for (let i = 0; i < NI; i++) for (let j = 0; j < NJ; j++) {
          const c = PAL[mem[base + i * NJ + j]], o = ((NJ - 1 - j) * NI + i) * 4;
          img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = c[3];
        }
        g.putImageData(img, 0, 0); memCanvas[k] = off; return off;
      }
      function mapDraw(canvas, codes, n) {
        const { ctx, w, h } = fit(canvas), cw = w / 61, chh = h / 31, base = n * 31 * 61;
        ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);
        for (let r = 0; r < 31; r++) for (let c = 0; c < 61; c++) {
          const v = codes[base + (30 - r) * 61 + c]; if (!v) continue;
          ctx.fillStyle = v === 255 ? C.red : mix(C.amberL, C.amber, clamp(v / 200 * 1.6));
          ctx.fillRect(c * cw, r * chh, cw + 0.3, chh + 0.3);
        }
        ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(30.5 * cw, 15.5 * chh, Math.max(3, cw * 1.3), 0, 6.28); ctx.fill();
        ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(30.5 * cw, 15.5 * chh); ctx.lineTo(36 * cw, 15.5 * chh); ctx.stroke();
      }
      function draw() {
        const { ctx, w, h } = fit(cv), s = w / (X1 - X0), T = (x, y) => [(x - X0) * s, (Y1 - y) * s];
        ctx.fillStyle = C.white; ctx.fillRect(0, 0, w, h);
        const k = Math.min(NK - 1, Math.floor(t / d.cap_dt + 1e-6));
        ctx.imageSmoothingEnabled = false; ctx.drawImage(memLayer(k), 0, 0, w, h); ctx.imageSmoothingEnabled = true;
        // rays of the latest capture
        const cap = d.caps[Math.min(k, d.caps.length - 1)], o = T(cap.o[0], cap.o[1]);
        ctx.strokeStyle = "rgba(74,85,200,.10)"; ctx.lineWidth = 1; ctx.beginPath();
        cap.h.forEach((p, i) => { if (i % 2 && !cap.k[i]) return; const q = T(p[0], p[1]); ctx.moveTo(o[0], o[1]); ctx.lineTo(q[0], q[1]); }); ctx.stroke();
        cap.h.forEach((p, i) => { const q = T(p[0], p[1]); ctx.fillStyle = cap.k[i] ? C.amber : "rgba(74,85,200,.55)"; ctx.beginPath(); ctx.arc(q[0], q[1], cap.k[i] ? 3 : 1.6, 0, 6.28); ctx.fill(); });
        // true beams (unknown to the student)
        ctx.setLineDash([7, 5]); ctx.strokeStyle = C.amber; ctx.lineWidth = 2;
        for (const b of d.boxes) { const [cx, cy, hx, hy, yaw] = b, c = Math.cos(yaw), sn = Math.sin(yaw); poly(ctx, [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([u, v]) => T(cx + c * u * hx - sn * v * hy, cy + sn * u * hx + c * v * hy))); ctx.closePath(); ctx.stroke(); }
        ctx.setLineDash([]);
        const g = T(d.goal[0], d.goal[1]); ctx.fillStyle = "rgba(47,158,87,.22)"; ctx.beginPath(); ctx.arc(g[0], g[1], 0.4 * s, 0, 6.28); ctx.fill();
        const ti = Math.min(d.traj.length - 1, Math.floor(t / d.dt));
        ctx.fillStyle = C.blue; for (let i = 0; i <= ti; i++) { const q = T(d.traj[i][0], d.traj[i][1]); ctx.beginPath(); ctx.arc(q[0], q[1], 2.6, 0, 6.28); ctx.fill(); }
        const r = d.traj[ti], q = T(r[0], r[1]);
        ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(q[0], q[1], 9, 0, 6.28); ctx.fill();
        ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0] + Math.cos(r[2]) * 24, q[1] - Math.sin(r[2]) * 24); ctx.stroke();
        pillText(ctx, w - 12, 12, `t = ${t.toFixed(1)} s`, C.ink, C.white, MONO, "r");
        let n = 0; d.ticks.forEach((tk, i) => { if (tk <= t * 50 + 1e-6) n = i; });
        mapDraw(ct, tmap, n); mapDraw(cs, smap, n);
        $(".v-t", root).textContent = `t = ${t.toFixed(1)} s`;
      }
      const loop = looper($(".play", root), (dt) => { t = Math.min(d.T, t + dt * 0.3); sl.value = t; draw(); return t < d.T; }, ["▶ Play (slow motion)", "❚❚ Pause"]);
      $(".play", root).addEventListener("click", () => { if (t >= d.T - 0.02) t = 0; }, true);
      sl.addEventListener("input", () => { loop.stop(); t = +sl.value; draw(); });
      const ro = new ResizeObserver(draw); ro.observe(cv); ro.observe(ct); draw(); root.dataset.ready = "1";
    });
  })();
})();
