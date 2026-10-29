// SceneFlow Studio: pick or upload a G1 motion, run the learned scene generator on the server, then replay what it
// did: every draw's boxes condensing from noise over 40 Euler steps (guidance in the last 20), the snap to the margin,
// the exact check, and the motion walking through the chosen scene while its alternative stops where it hits.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const $ = (id) => document.getElementById(id);
// window.SCENEFLOW (config.js): {api: base URL of the generator API, assets: static files dir (public page), staticLibrary,
// examples: [{file, label}] recorded runs shown when the generator is offline}. The local studio leaves it empty.
const CFG = Object.assign({ api: '', assets: null, staticLibrary: false, public: false, examples: [] }, window.SCENEFLOW || {});
const STATIC = CFG.public && !CFG.api;  // the page alone (GitHub Pages): recorded runs only, no generator calls
const COL = { tgt: 0x168b80, alt: 0x7d8792, bad: 0xd34f56, good: 0x26836a, box: 0xe7aa55, boxLow: 0xc88a37, ghost: 0x9aaeb1, ring: 0x9cc7bf };
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const KINDS = ['ground', 'low', 'mid', 'overhead'];
const DATUM = 0.081;
const GEN_S = 4.6, SNAP_S = 0.9, CHECK_S = 1.4;

// ---------------------------------------------------------------------------------------------- scene
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true }); }
catch (error) {
  $('load-txt').textContent = 'This 3D demo needs WebGL. Try a browser with graphics acceleration enabled.';
  $('retry-load').hidden = false;
  $('retry-load').onclick = () => location.reload();
  throw error;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize($('stage').clientWidth, $('stage').clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
$('stage').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf1f5f5);
scene.fog = new THREE.Fog(0xf1f5f5, 14, 40);
const camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.05, 200);
camera.position.set(-2.2, 2.6, 4.0);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
renderer.domElement.style.touchAction = 'pan-y';
renderer.domElement.tabIndex = 0;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.49;
controls.target.set(0.8, 0.7, 0);
scene.add(new THREE.HemisphereLight(0xeef2f8, 0xcedbd5, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.position.set(-3, 7, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
const rim = new THREE.DirectionalLight(0xc8d6ec, 1.0);
rim.position.set(-6, 5, -8);
scene.add(rim);
const world = new THREE.Group(); // Z-up, like MuJoCo
world.rotation.x = -Math.PI / 2;
scene.add(world);
const W2S = (x, y, z) => new THREE.Vector3(x, z, -y); // world (z-up) -> scene (y-up)

(function floor() {
  const size = 1024, c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#edf2f2'; g.fillRect(0, 0, size, size);
  g.strokeStyle = 'rgba(75,110,105,0.07)'; g.lineWidth = 2;
  for (let i = 0; i <= 8; i++) { const p = (i * size) / 8; g.beginPath(); g.moveTo(p, 0); g.lineTo(p, size); g.moveTo(0, p); g.lineTo(size, p); g.stroke(); }
  g.strokeStyle = 'rgba(75,110,105,0.1)'; g.lineWidth = 3; g.strokeRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(30, 30); tex.anisotropy = 8; tex.colorSpace = THREE.SRGBColorSpace;
  const f = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 }));
  f.position.set(0.5, 0.5, 0); f.receiveShadow = true; world.add(f);
})();

// One renderer, two synchronized views. Size the camera to its panel, not the browser window.
let viewWidth = 1, viewHeight = 1, stacked = false;
function fitView() {
  viewWidth = $('stage').clientWidth; viewHeight = $('stage').clientHeight;
  stacked = matchMedia('(max-width: 700px)').matches;
  renderer.setSize(viewWidth, viewHeight);
  camera.aspect = stacked ? viewWidth / (viewHeight / 2) : (viewWidth / 2) / viewHeight;
  camera.clearViewOffset(); camera.updateProjectionMatrix();
  renderer.domElement.setAttribute('aria-label', stacked
    ? 'Input motion above; the same motion with a generated scene below. Drag or use arrow keys to rotate both views; plus and minus zoom, Home resets.'
    : 'Input motion left; the same motion with a generated scene right. Drag or use arrow keys to rotate both views; plus and minus zoom, Home resets.');
  $('stage').setAttribute('aria-label', renderer.domElement.getAttribute('aria-label'));
}
fitView();
new ResizeObserver(fitView).observe($('stage'));
controls.enableZoom = false; // Let the page scroll; zoom intentionally with Ctrl/Command + scroll.
renderer.domElement.addEventListener('wheel', (event) => {
  if (!event.ctrlKey && !event.metaKey) return;
  event.preventDefault();
  const offset = camera.position.clone().sub(controls.target);
  offset.multiplyScalar(event.deltaY > 0 ? 1.08 : 0.92);
  offset.clampLength(1.5, 25); camera.position.copy(controls.target).add(offset);
}, { passive: false });
let viewerVisible = true;
new IntersectionObserver(([entry]) => { viewerVisible = entry.isIntersecting; }).observe($('viewport'));

// ---------------------------------------------------------------------------------------------- robot
async function loadModel() {
  const base = CFG.assets ? `${CFG.assets}/g1` : '/api/model';
  const manifest = await (await fetch(`${base}.json`)).json();
  const blob = await (await fetch(`${base}.bin`)).arrayBuffer();
  const geo = { full: new Map(), lite: new Map() };
  for (const [id, m] of Object.entries(manifest.meshes)) {
    for (const lod of ['full', 'lite']) {
      const d = m[lod], g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(blob, d.v, d.nv * 3), 3));
      g.setIndex(new THREE.BufferAttribute(new Uint32Array(blob, d.f, d.nf * 3), 1));
      g.computeVertexNormals();
      geo[lod].set(Number(id), g);
    }
  }
  return { manifest, geo };
}
class Robot {
  constructor(model, lod, material, castShadow) {
    this.nextQuaternion = new THREE.Quaternion();
    this.root = new THREE.Group();
    this.bodies = model.manifest.bodies.map(() => { const b = new THREE.Group(); this.root.add(b); return b; });
    for (const g of model.manifest.geoms) {
      const mesh = new THREE.Mesh(model.geo[lod].get(g.mesh), material(g.rgba));
      mesh.position.set(...g.pos);
      mesh.quaternion.set(g.quat[1], g.quat[2], g.quat[3], g.quat[0]);
      mesh.castShadow = mesh.receiveShadow = castShadow;
      this.bodies[g.body].add(mesh);
    }
    world.add(this.root);
  }
  setPose(P, Q, f) { // P: Float32Array (F*30*3), Q: (F*30*4) wxyz; f: frame
    const n = this.bodies.length, lastFrame = P.length / (n * 3) - 1;
    f = clamp(f, 0, lastFrame);
    const f0 = Math.floor(f), f1 = Math.min(f0 + 1, lastFrame), u = f - f0;
    const o3 = f0 * n * 3, o4 = f0 * n * 4, next3 = f1 * n * 3, next4 = f1 * n * 4;
    for (let i = 0; i < n; i++) {
      this.bodies[i].position.set(
        THREE.MathUtils.lerp(P[o3 + 3 * i], P[next3 + 3 * i], u),
        THREE.MathUtils.lerp(P[o3 + 3 * i + 1], P[next3 + 3 * i + 1], u),
        THREE.MathUtils.lerp(P[o3 + 3 * i + 2], P[next3 + 3 * i + 2], u));
      this.bodies[i].quaternion.set(Q[o4 + 4 * i + 1], Q[o4 + 4 * i + 2], Q[o4 + 4 * i + 3], Q[o4 + 4 * i]);
      this.nextQuaternion.set(Q[next4 + 4 * i + 1], Q[next4 + 4 * i + 2], Q[next4 + 4 * i + 3], Q[next4 + 4 * i]);
      this.bodies[i].quaternion.slerp(this.nextQuaternion, u);
    }
  }
}
const heroMat = (() => { const tint = new THREE.Color(COL.tgt); const cache = new Map();
  return (rgba) => { const k = rgba.join(','); if (!cache.has(k)) { const c = new THREE.Color().setRGB(rgba[0], rgba[1], rgba[2], THREE.SRGBColorSpace).lerp(tint, 0.35);
    cache.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.15, emissive: tint, emissiveIntensity: 0.06 })); } return cache.get(k); }; })();
const altMaterial = new THREE.MeshStandardMaterial({ color: COL.alt, emissive: COL.alt, emissiveIntensity: 0.25, roughness: 0.8, transparent: true, opacity: 0.35, depthWrite: false });

// ---------------------------------------------------------------------------------------------- helpers
const f32 = (b64) => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new Float32Array(u.buffer); };
const clamp = (x, a, b) => Math.min(Math.max(x, a), b);
const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const sig = (x) => 1 / (1 + Math.exp(-x));
function decodeSlot(s, o) { // SceneFlow's decode_slots for one slot (12 numbers at s[o..]) -> grounded box + existence logit
  let k = 0; for (let i = 1; i < 4; i++) if (s[o + 1 + i] > s[o + 1 + k]) k = i;
  const kind = KINDS[k];
  let zb = s[o + 10] * 0.6 + 0.6, zt = s[o + 11] * 0.6 + 1.2;
  if (kind === 'ground' || kind === 'low') zb = 0; else if (kind === 'mid') zb = clamp(zb, 0.36, 0.79); else zb = Math.max(zb, 0.8);
  zt = Math.min(Math.max(zt, zb + 0.03), 2.6);
  return { kind, e: s[o], cx: s[o + 5] * 1.5 + 1, cy: s[o + 6] * 1.2, yaw: clamp(s[o + 7], -1, 1) * Math.PI / 4,
    hx: Math.max(Math.exp(clamp(s[o + 8], -3, 2.5) - 1.4), 0.02), hy: Math.max(Math.exp(clamp(s[o + 9], -3, 2.5) - 1.4), 0.02),
    zb: Math.max(zb - DATUM, 0), zt: zt - DATUM };
}
const lerpBox = (a, b, u) => ({ kind: u < 0.5 ? a.kind : b.kind, e: a.e + (b.e - a.e) * u, cx: a.cx + (b.cx - a.cx) * u, cy: a.cy + (b.cy - a.cy) * u,
  yaw: a.yaw + (b.yaw - a.yaw) * u, hx: a.hx + (b.hx - a.hx) * u, hy: a.hy + (b.hy - a.hy) * u, zb: a.zb + (b.zb - a.zb) * u, zt: a.zt + (b.zt - a.zt) * u });
const UNIT = new THREE.BoxGeometry(1, 1, 1);
const UNIT_EDGES = new THREE.EdgesGeometry(UNIT);
function placeBox(m, b) {
  const h = Math.max(b.zt - b.zb, 0.01);
  m.position.set(b.cx, b.cy, b.zb + h / 2);
  m.rotation.set(0, 0, b.yaw);
  m.scale.set(2 * b.hx, 2 * b.hy, h);
}
async function api(path, body, headers, timeoutMs) {
  const init = body === undefined ? {} : { method: 'POST', body: typeof body === 'string' || body instanceof ArrayBuffer ? body : JSON.stringify(body),
    headers: Object.assign({ 'Content-Type': body instanceof ArrayBuffer ? 'application/octet-stream' : 'application/json' }, headers || {}) };
  let r;
  if (timeoutMs) init.signal = AbortSignal.timeout(timeoutMs);
  try { r = await fetch(CFG.api + path, init); } catch (e) { throw new Error('the generator is not reachable right now'); }
  const j = await r.json().catch(() => ({ error: r.statusText }));
  if (!r.ok || j.error) throw Object.assign(new Error(String(j.error || r.statusText).slice(0, 300)), { status: r.status });
  return j;
}
// Build DOM from parts; strings always become text, never markup (results and errors come from the server).
function h(tag, cls, ...kids) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const k of kids) if (k != null) e.append(k instanceof Node ? k : String(k));
  return e;
}

// ---------------------------------------------------------------------------------------------- state
const S = { model: null, hero: null, alt: null, motion: null, P: null, result: null, sel: 0, mode: 'idle', t: 0, paused: reducedMotion,
  draws: [], boxGroup: new THREE.Group(), trail: null, altTrail: null, ring: null, prof: null };
world.add(S.boxGroup);

function setPhase(s) { if ($('phase').textContent !== s) $('phase').textContent = s; }
function opt() {
  const o = {};
  document.querySelectorAll('.seg').forEach((seg) => {
    const k = seg.dataset.key, on = [...seg.querySelectorAll('button[aria-pressed="true"]')].map((b) => b.dataset.v);
    if (seg.classList.contains('multi')) o[k] = on;
    else o[k] = on[0];
  });
  return { draws: +o.draws, guidance: o.guidance, margin: +o.margin, n_obs: +o.n_obs || null, kinds: o.kinds.length ? o.kinds : null,
    model: o.model, specificity: $('o-spec').checked, snap: $('o-snap').checked, seed: +$('o-seed').value || 0 };
}
document.querySelectorAll('.seg').forEach((seg) => seg.addEventListener('click', (ev) => {
  const b = ev.target.closest('button'); if (!b) return;
  if (seg.classList.contains('multi')) b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
  else seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
}));
$('dice').addEventListener('click', () => { $('o-seed').value = Math.floor(Math.random() * 10000); });

// ---------------------------------------------------------------------------------------------- library
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach((x) => x.setAttribute('aria-selected', String(x === t)));
  document.querySelectorAll('.tabpane').forEach((p) => { p.hidden = p.dataset.pane !== t.dataset.tab; });
  if (t.dataset.tab === 'search' && !$('results').childElementCount) search();
}));
function listInto(el, items) {
  el.innerHTML = '';
  for (const it of items) {
    const b = document.createElement('button');
    b.className = 'item'; b.type = 'button'; b.dataset.id = it.id;
    b.innerHTML = '<b></b><span></span>';
    b.querySelector('b').textContent = it.label;
    b.querySelector('span').textContent = `${it.source} · ${it.why || it.sub}`;
    b.addEventListener('click', () => pick(it.id));
    el.appendChild(b);
  }
}
let searchTimer = null, LIB = null;
function searchLocal(q, src) {
  const toks = q.toLowerCase().split(/\s+/).filter(Boolean), srcs = src === 'all' ? null : src.split(','), out = [];
  for (const [id, label, s] of LIB.items) {
    if (srcs && !srcs.includes(s)) continue;
    const hay = label.toLowerCase();
    if (toks.every((t) => hay.includes(t))) { out.push({ id, label, src: s, source: LIB.sources[s], sub: LIB.sources[s] }); if (out.length >= 80) break; }
  }
  return { items: out };
}
async function search() {
  const j = LIB ? searchLocal($('q').value, $('src').value)
    : await api(`/api/library?q=${encodeURIComponent($('q').value)}&src=${encodeURIComponent($('src').value)}`);
  listInto($('results'), j.items);
  $('libcount').textContent = j.items.length >= 80 ? 'first 80 matches · type more to narrow' : `${j.items.length} matches`;
}
$('q').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(search, 200); });
$('src').addEventListener('change', search);
const drop = $('drop');
drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) upload(e.dataTransfer.files[0]); });
$('file').addEventListener('change', (e) => { if (e.target.files[0]) upload(e.target.files[0]); });
async function upload(file) {
  if (file.size > 8 * 2 ** 20) { setPhase('Upload failed: the file is larger than 8 MB'); return; }
  setPhase('Reading the motion…');
  const name = file.name.replace(/[^\w.-]+/g, '_').slice(-120);  // header values must be plain ASCII
  try { showMotion(await api('/api/upload', await file.arrayBuffer(), { 'X-Filename': name }, 120000)); }
  catch (err) { setPhase('Upload failed: ' + err.message); }
}
async function pick(id) {
  document.querySelectorAll('.item').forEach((x) => x.setAttribute('aria-current', String(x.dataset.id === id)));
  setPhase('Loading the motion…');
  try { showMotion(await api('/api/motion', { id })); }
  catch (err) { setPhase('Could not load: ' + err.message); }
}

// ---------------------------------------------------------------------------------------------- motion preview
function clearResult() {
  S.result = null;
  for (const draw of S.draws) { draw.mat.dispose(); draw.emat.dispose(); }
  S.boxGroup.clear(); S.draws = [];
  $('right').hidden = true; $('legend').hidden = true;
  $('b-gen').disabled = $('b-play').disabled = $('b-pause').disabled = true;
  for (const k of ['trail', 'altTrail']) if (S[k]) { world.remove(S[k]); S[k].geometry.dispose(); S[k].material.dispose(); S[k] = null; }
  S.alt.root.visible = false;
}
function line(points, color, dashed) {
  const g = new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(p[0], p[1], 0.006)));
  const m = dashed ? new THREE.LineDashedMaterial({ color, dashSize: 0.06, gapSize: 0.05, transparent: true, opacity: 0.8 })
    : new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
  const l = new THREE.Line(g, m); if (dashed) l.computeLineDistances(); world.add(l); return l;
}
function frameCamera(pts, boxes) {
  let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
  for (const p of pts) { mnx = Math.min(mnx, p[0]); mxx = Math.max(mxx, p[0]); mny = Math.min(mny, p[1]); mxy = Math.max(mxy, p[1]); }
  for (const b of boxes || []) { mnx = Math.min(mnx, b.cx); mxx = Math.max(mxx, b.cx); mny = Math.min(mny, b.cy); mxy = Math.max(mxy, b.cy); }
  const cx = (mnx + mxx) / 2, cy = (mny + mxy) / 2, ext = Math.max(mxx - mnx, mxy - mny, 1.5);
  const p0 = pts[0], p1 = pts[pts.length - 1];
  let dx = p1[0] - p0[0], dy = p1[1] - p0[1]; const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
  const d = (ext * 0.72 + 1.7) * Math.min(2.6, Math.max(1, 1.25 / camera.aspect));  // portrait screens see a narrow slice: pull back
  controls.target.copy(W2S(cx, cy, 0.65));
  camera.position.copy(W2S(cx - dx * d * 0.85 + dy * d * 0.7, cy - dy * d * 0.85 - dx * d * 0.7, d * 0.55));
}
function showMotion(m) {
  S.motion = m;
  document.querySelector('.recording-pill').textContent = m.recorded ? 'Recorded model output' : 'Live motion preview';
  $('motion-title').textContent = m.label;
  $('sel-opt').hidden = true;
  S.hero.root.visible = true;
  S.pv = { pos: f32(m.pos), quat: f32(m.quat), F: m.frames };
  clearResult();
  $('sel').hidden = $('dp').hidden = $('gen').hidden = false;
  $('sel-src').textContent = m.source + (m.kind === 'group' ? ` · siblings: ${m.siblings.join(', ')}` : '');
  $('sel-label').textContent = m.label;
  $('sel-alt').textContent = 'Alternative to rule out: ' + m.alt_kind;
  $('dp-fixed').hidden = m.kind === 'single';
  $('dp-free').hidden = m.kind !== 'single';
  const pts = []; for (let f = 0; f < m.frames; f++) pts.push([S.pv.pos[f * 90], S.pv.pos[f * 90 + 1]]);
  S.pvPts = pts;
  if (S.trail) world.remove(S.trail);
  S.trail = line(pts, COL.tgt, false);
  if (m.kind === 'single') {
    const chips = $('dp-chips'); chips.innerHTML = '';
    const sl = $('dp-slider'); sl.min = m.window.min_P; sl.max = m.window.max_P; sl.step = 5;
    const pick0 = m.points.length ? m.points.reduce((a, b) => (b.magnitude > a.magnitude ? b : a)) : { P: Math.round((m.window.min_P + m.window.max_P) / 2) };
    for (const p of m.points) {
      const c = document.createElement('button'); c.type = 'button'; c.className = 'chip';
      c.textContent = `${(p.P / 50).toFixed(1)} s · ${p.kind} ${p.magnitude.toFixed(2)} m`;
      c.addEventListener('click', () => setP(p.P)); c.dataset.p = p.P; chips.appendChild(c);
    }
    if (!m.points.length) chips.innerHTML = '<span class="dim small">No point where it leaves its gait; pick a time with the slider.</span>';
    setP(pick0.P);
  } else setP(m.points[0].P);
  frameCamera(pts);
  S.mode = 'preview'; S.t = 0; S.paused = false;
  setPhase('Preview the motion, choose a decision point, then generate scenes.');
}
function setP(P) {
  S.P = P;
  $('dp-slider').value = P; $('dp-t').textContent = `${(P / 50).toFixed(2)} s`;
  document.querySelectorAll('#dp-chips .chip').forEach((c) => c.setAttribute('aria-pressed', String(+c.dataset.p === P)));
  const f = Math.min(Math.round(P / 2), S.pv.F - 1);
  if (!S.ring) {
    S.ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.25, 48), new THREE.MeshBasicMaterial({ color: COL.ring, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    world.add(S.ring);
  }
  S.ring.visible = true;
  S.ring.position.set(S.pv.pos[f * 90], S.pv.pos[f * 90 + 1], 0.008);
}
$('dp-slider').addEventListener('input', (e) => setP(+e.target.value));

// ---------------------------------------------------------------------------------------------- generate
$('go').addEventListener('click', async () => {
  if (!S.motion) return;
  $('go').disabled = true; $('prog').hidden = false; $('prog-bar').style.width = '0%';
  setPhase('SceneFlow is running on the server…');
  try {
    const { job } = await api('/api/generate', { id: S.motion.id, P: S.P, opt: opt() });
    for (;;) {
      await new Promise((r) => setTimeout(r, CFG.public ? 400 : 150));
      let j;
      try { j = await api(`/api/job?id=${encodeURIComponent(job)}`, undefined, undefined, 20000); } catch (e) {
        if (e.status === 429) { await new Promise((r) => setTimeout(r, 3000)); continue; }
        throw e;
      }
      if (j.state === 'error') throw new Error(j.error);
      const frac = j.phase === 'sampling' ? 0.5 * j.step / j.steps : j.phase === 'checking' ? 0.5 + 0.5 * j.checked / j.total : 0;
      $('prog-bar').style.width = `${Math.round(frac * 100)}%`;
      $('prog-txt').textContent = j.phase === 'sampling' ? `sampling · Euler step ${j.step} / ${j.steps}` : j.phase === 'checking' ? `exact check · draw ${j.checked} / ${j.total}`
        : j.ahead ? `queued · ${j.ahead} run${j.ahead > 1 ? 's' : ''} ahead` : 'queued';
      if (j.state === 'done') { onResult(j.result); break; }
    }
  } catch (err) { setPhase('Failed: ' + err.message); }
  $('go').disabled = !S.online && CFG.public; $('prog').hidden = true;
});

function onResult(r) {
  document.querySelector('.recording-pill').textContent = S.motion.recorded ? 'Recorded model output' : 'Live model output';
  S.result = r;
  r.tp = { pos: f32(r.target.pos), quat: f32(r.target.quat) };
  r.ap = { pos: f32(r.alt.pos), quat: f32(r.alt.quat) };
  for (const draw of S.draws) { draw.mat.dispose(); draw.emat.dispose(); }
  S.boxGroup.clear();
  S.draws = r.draws.map((d) => {
    const xs = f32(d.xs);
    const g = new THREE.Group(); S.boxGroup.add(g);
    const mat = new THREE.MeshStandardMaterial({ color: COL.ghost, roughness: 0.7, transparent: true, opacity: 0.2, depthWrite: false });
    const emat = new THREE.LineBasicMaterial({ color: COL.ghost, transparent: true, opacity: 0.4 });
    const meshes = [];
    for (let k = 0; k < 8; k++) {
      const m = new THREE.Mesh(UNIT, mat); m.castShadow = true;
      m.add(new THREE.LineSegments(UNIT_EDGES, emat));
      g.add(m); meshes.push(m);
    }
    return { d, xs, g, mat, emat, meshes };
  });
  // Start with the simplest passing scene; preserve every candidate for inspection.
  const volume = d => d.boxes.reduce((sum, b) => sum + 4 * b.hx * b.hy * (b.zt - b.zb), 0);
  const accepted = r.draws.map((d, i) => ({ d, i })).filter(({ d }) => d.necessary);
  accepted.sort((a, b) => a.d.boxes.length - b.d.boxes.length || volume(a.d) - volume(b.d));
  S.sel = accepted[0]?.i ?? 0;
  // trails and profiles in the result's canonical frame
  const F = r.frames, pts = [], apts = [];
  for (let f = 0; f < F; f++) { pts.push([r.tp.pos[f * 90], r.tp.pos[f * 90 + 1]]); apts.push([r.ap.pos[f * 90], r.ap.pos[f * 90 + 1]]); }
  for (const k of ['trail', 'altTrail']) if (S[k]) { world.remove(S[k]); S[k].geometry.dispose(); S[k].material.dispose(); }
  S.trail = line(pts, COL.tgt, false);
  S.altTrail = line(apts, COL.alt, true);
  const df = Math.round(r.decision_frame);
  S.ring.position.set(pts[df][0], pts[df][1], 0.008);
  S.prof = { x: pts.map((p) => p[0]), top: [], atop: [] };
  for (let f = 0; f < F; f++) {
    let t = 0, a = 0; for (let b = 0; b < 30; b++) { t = Math.max(t, r.tp.pos[f * 90 + 3 * b + 2]); a = Math.max(a, r.ap.pos[f * 90 + 3 * b + 2]); }
    S.prof.top.push(t + 0.12); S.prof.atop.push(a + 0.12);
  }
  S.prof.ax = apts.map((p) => p[0]);
  if (!S.alt) return;
  S.alt.root.visible = true;
  $('right').hidden = false; $('legend').hidden = false;
  $('b-gen').disabled = $('b-play').disabled = $('b-pause').disabled = false;
  renderTiles(); renderDetail();
  frameCamera(pts.concat(apts.slice(0, Math.round(r.decision_frame) + 20)), r.draws[S.sel].boxes);
  startPlay();
  if (reducedMotion) { S.paused = true; S.t = (r.decision_frame + 20) / r.fps; }
  updatePlaybackControls();
}
function updatePlaybackControls() {
  const generating = ['gen', 'snap', 'check'].includes(S.mode);
  $('b-play').setAttribute('aria-pressed', String(!generating));
  $('b-gen').setAttribute('aria-pressed', String(generating));
  $('b-pause').textContent = S.paused ? '▶' : 'Ⅱ';
  $('b-pause').setAttribute('aria-label', S.paused ? 'Resume playback' : 'Pause playback');
  $('output-subtitle').textContent = generating ? 'Replaying how the scene was generated' : 'The same movement, with context';
}
function startGen() { S.mode = 'gen'; S.t = 0; S.paused = false; updatePlaybackControls(); }
function startPlay() { S.mode = 'play'; S.t = 0; S.paused = false; updatePlaybackControls(); }
$('b-pause').addEventListener('click', () => { S.paused = !S.paused; updatePlaybackControls(); });
renderer.domElement.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', 'Home'].includes(event.key)) return;
  event.preventDefault();
  if (event.key === 'Home') { $('reset-view').click(); return; }
  const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
  if (event.key === 'ArrowLeft') spherical.theta -= 0.12;
  if (event.key === 'ArrowRight') spherical.theta += 0.12;
  if (event.key === 'ArrowUp') spherical.phi -= 0.08;
  if (event.key === 'ArrowDown') spherical.phi += 0.08;
  if (event.key === '+' || event.key === '=') spherical.radius *= 0.92;
  if (event.key === '-') spherical.radius *= 1.08;
  spherical.phi = clamp(spherical.phi, 0.1, Math.PI * 0.49);
  spherical.radius = clamp(spherical.radius, 1.5, 25);
  camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
});
$('reset-view').addEventListener('click', () => {
  if (S.prof && S.result) frameCamera(S.prof.x.map((x, i) => [x, S.result.tp.pos[i * 90 + 1]]), S.result.draws[S.sel].boxes);
  else if (S.pvPts) frameCamera(S.pvPts);
});
$('next-scene').addEventListener('click', () => {
  if (!S.result) return;
  const accepted = S.result.draws.map((d, i) => d.necessary ? i : -1).filter(i => i >= 0);
  S.sel = accepted[(accepted.indexOf(S.sel) + 1) % accepted.length];
  renderDetail(); markTiles(); $('reset-view').click(); startPlay();
});
$('b-gen').addEventListener('click', startGen);
$('b-play').addEventListener('click', startPlay);
$('scrub').addEventListener('input', (e) => {
  const u = e.target.value / 1000;
  S.paused = true;
  if (S.mode === 'gen' || S.mode === 'snap' || S.mode === 'check') { S.mode = 'gen'; S.t = u * GEN_S; }
  else if (S.mode === 'play' && S.result) S.t = u * (S.result.frames - 1) / S.result.fps;
  else if (S.mode === 'preview') S.t = u * (S.pv.F - 1) / 25;
  updatePlaybackControls();
});

// ---------------------------------------------------------------------------------------------- results panel
function renderTiles() {
  const r = S.result, el = $('tiles');
  $('sum').replaceChildren(h('b', '', r.stats.pass), ` passing scenes from ${r.stats.n} candidates.`);
  $('next-scene').disabled = r.stats.pass < 2;
  $('run-details').textContent = `Recorded with SceneFlow ${r.opt.model} · ${r.stats.steps} denoising steps · ${Math.round(r.opt.margin * 100)} cm requested margin · seed ${r.opt.seed}. Sampling: ${r.stats.gen_s} s; checking: ${r.stats.check_s} s on the lab CPU.`;
  el.innerHTML = '';
  r.draws.forEach((d, j) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tile ' + (d.necessary ? 'pass' : 'fail');
    b.setAttribute('aria-label', `Scene ${j + 1}: ${d.necessary ? 'passes' : 'fails'}`);
    const cv = h('canvas'); cv.width = 160; cv.height = 120;
    b.append(cv, h('span', 'j', j + 1), h('span', 'v', d.necessary ? '✓' : '✕'));
    drawTile(cv, d);
    b.addEventListener('click', () => { S.sel = j; renderDetail(); markTiles(); $('reset-view').click(); startPlay(); });
    el.appendChild(b);
  });
  markTiles();
}
function markTiles() { [...$('tiles').children].forEach((t, j) => t.setAttribute('aria-current', String(j === S.sel))); }
function drawTile(cv, d) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height, P = S.prof;
  const x0 = Math.min(...P.x) - 0.6, x1 = Math.max(...P.x) + 0.6, Z = 2.1;
  const X = (x) => 6 + (x - x0) / (x1 - x0) * (W - 12), Y = (z) => H - 8 - z / Z * (H - 16);
  g.fillStyle = '#f0f5f4'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#d0ded9'; g.beginPath(); g.moveTo(0, Y(0)); g.lineTo(W, Y(0)); g.stroke();
  for (const b of d.boxes) {
    g.fillStyle = b.kind === 'ground' || b.kind === 'low' ? 'rgba(194,119,10,0.85)' : 'rgba(245,158,11,0.9)';
    g.fillRect(X(b.cx - b.hx), Y(Math.min(b.zt, Z)), Math.max(X(b.cx + b.hx) - X(b.cx - b.hx), 1.5), Y(b.zb) - Y(Math.min(b.zt, Z)));
  }
  const prof = (xs, ts, upto, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); for (let f = 0; f < upto; f++) { const p = [X(xs[f]), Y(ts[f])]; f ? g.lineTo(...p) : g.moveTo(...p); } g.stroke(); };
  prof(P.ax, P.atop, d.alt_hit != null ? Math.ceil(d.alt_hit) + 1 : P.ax.length, 'rgba(163,163,163,0.8)', 1.2);
  prof(P.x, P.top, P.x.length, '#168b80', 2);
}
function renderDetail() {
  const d = S.result.draws[S.sel], el = $('detail');
  $('pair-verdict').textContent = d.necessary ? `✓ Scene ${S.sel + 1} passes the geometry check` : `× Scene ${S.sel + 1} does not pass` ;
  document.querySelector('.selection-note').classList.toggle('failed', !d.necessary);
  $('pair-clearance').textContent = d.target_clear == null ? 'No clearance available' : `Motion clearance: ${(d.target_clear * 100).toFixed(1)} cm · requested: ${Math.round(S.result.opt.margin * 100)} cm`;
  const cm = (m) => (m * 100).toFixed(1) + ' cm';
  const why = d.necessary ? 'Passes: motion clears; tested alternatives blocked.' : `Fails: ${d.reason || 'not necessary'}.`;
  const kv = h('dl', 'kv');
  const row = (k, v) => kv.append(h('dt', '', k), h('dd', '', v));
  row('motion clears', d.target_clear != null ? cm(d.target_clear) : '–');
  if (d.alt_clear != null) row(S.result.alt.label, d.alt_clear <= -0.04 ? 'blocked, ≥ ' + cm(-d.alt_clear) : 'clears ' + cm(d.alt_clear));
  for (const [k, v] of Object.entries(d.cf_blocked || {})) row(k.replace('cf_', '').replace('_', ' '), v ? 'blocked' : 'gets through');
  if (d.sib) {
    const n = Object.values(d.sib).filter((v) => v <= -0.04).length;
    row('siblings blocked', `${n} of ${Object.keys(d.sib).length}${n === Object.keys(d.sib).length ? ' · strong' : ''}`);
  }
  const boxes = h('div', 'boxes');
  d.boxes.forEach((b) => boxes.append(h('div', '', `${String(b.kind).padEnd(8)} ${(2 * b.hx).toFixed(2)} × ${(2 * b.hy).toFixed(2)} m, ${b.zb.toFixed(2)}–${b.zt.toFixed(2)} m`)));
  if (!d.boxes.length) boxes.append('no boxes');
  el.replaceChildren(h('div', `verdict ${d.necessary ? 'ok' : 'no'}`, `Scene ${S.sel + 1} · ${why}`), kv, boxes);
}
$('export').addEventListener('click', () => {
  const r = S.result; if (!r) return;
  const d = r.draws[S.sel];
  const out = { motion: r.motion, label: r.label, decision_frame_50hz: r.P, draw: S.sel, options: r.opt, frame: 'canonical at the decision point, heights above the floor (m)',
    boxes: d.boxes, check: { necessary: d.necessary, valid: d.valid, target_clear_m: d.target_clear, alternative_clear_m: d.alt_clear, counterfactuals_blocked: d.cf_blocked, siblings_clear_m: d.sib } };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }));
  a.download = `sceneflow_${r.motion.replace(/[^\w.-]+/g, '_')}_draw${S.sel}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

// ---------------------------------------------------------------------------------------------- animation
function poseDraws(step, which) {
  const s0 = Math.floor(step), s1 = Math.min(s0 + 1, 40), u = step - s0;
  for (let j = 0; j < S.draws.length; j++) {
    const D = S.draws[j], show = which === 'all' || j === S.sel;
    D.g.visible = show && ($('t-all').checked || j === S.sel);
    if (!D.g.visible) continue;
    for (let k = 0; k < 8; k++) {
      const a = decodeSlot(D.xs, (s0 * 8 + k) * 12), b = decodeSlot(D.xs, (s1 * 8 + k) * 12), x = lerpBox(a, b, u);
      const m = D.meshes[k], ex = sig(8 * x.e);
      m.visible = ex > 0.05;
      if (m.visible) placeBox(m, x);
    }
  }
}
function styleDraws(phase, u) {
  for (let j = 0; j < S.draws.length; j++) {
    const D = S.draws[j], sel = j === S.sel, pass = D.d.necessary;
    let col = COL.ghost, op = phase === 'gen' ? 0.04 + 0.12 * u : 0.16, eop = phase === 'gen' ? 0.1 + 0.3 * u : 0.35;
    if (sel) { col = COL.box; op = phase === 'gen' ? 0.12 + 0.83 * u * u : 0.95; eop = phase === 'gen' ? 0.3 + 0.6 * u : 0.9; }
    else if (phase === 'check') { col = pass ? COL.good : COL.bad; op = pass ? 0.12 : 0.08 * (1 - u); eop = pass ? 0.4 : 0.3 * (1 - u); }
    else if (phase === 'play') { col = pass ? COL.good : COL.bad; op = pass ? 0.06 : 0; eop = pass ? 0.16 : 0; }
    D.mat.color.setHex(col); D.mat.opacity = op; D.mat.depthWrite = op > 0.9; D.mat.transparent = op < 0.99;
    D.emat.color.setHex(sel ? 0x7c4a03 : col); D.emat.opacity = eop;
  }
}
function setSnap(u) {
  const D = S.draws[S.sel], d = D.d;
  for (let k = 0; k < 8; k++) D.meshes[k].visible = false;
  d.boxes.forEach((b, i) => { const r = d.raw[i] || b, m = D.meshes[i]; m.visible = true; placeBox(m, lerpBox(r, b, ease(u))); });
}
let last = performance.now();
let atlasModalOpen = false, shownStage = '';
document.addEventListener('sceneflow:atlas', event => { atlasModalOpen = event.detail.open; });
const stageIndicators = [...document.querySelectorAll('.generation-steps [data-phase]')];
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min((now - last) / 1000, 0.1) * ($('t-slow').checked ? 0.5 : 1); last = now;
  if (!viewerVisible || document.hidden || atlasModalOpen) return;
  if (shownStage !== S.mode) {
    shownStage = S.mode;
    stageIndicators.forEach(indicator => { indicator.dataset.active = String(indicator.dataset.phase === S.mode); });
  }
  if (!S.paused) S.t += dt;
  const r = S.result;
  if (S.hero && S.mode === 'preview' && S.pv) {
    const F = S.pv.F, f = (S.t * 25) % F;
    S.hero.setPose(S.pv.pos, S.pv.quat, f);
    $('scrub').value = String(Math.round(1000 * f / (F - 1)));
  } else if (S.hero && r) {
    const F = r.frames;
    S.alt.root.visible = $('t-alt').checked;
    if (S.mode === 'gen') {
      const step = clamp(S.t / GEN_S * 40, 0, 40);
      poseDraws(step, 'all'); styleDraws('gen', step / 40);
      S.hero.setPose(r.tp.pos, r.tp.quat, Math.round(r.decision_frame));
      S.alt.setPose(r.ap.pos, r.ap.quat, Math.round(r.decision_frame)); altMaterial.color.setHex(COL.alt); altMaterial.opacity = 0.25;
      setPhase(`Scene generation · step ${Math.floor(step)} of 40${step >= 20 ? ' · refining clearance' : ' · from noise to obstacles'}`);
      $('scrub').value = String(Math.round(1000 * step / 40));
      if (S.t >= GEN_S && !S.paused) { S.mode = 'snap'; S.t = 0; }
    } else if (S.mode === 'snap') {
      poseDraws(40, 'all'); styleDraws('gen', 1); setSnap(S.t / SNAP_S);
      setPhase(r.opt.snap ? `Refine the scene · adjust obstacles to keep ${Math.round(r.opt.margin * 100)} cm of clearance` : 'Final boxes');
      if (S.t >= SNAP_S && !S.paused) { S.mode = 'check'; S.t = 0; }
    } else if (S.mode === 'check') {
      poseDraws(40, 'all'); setSnap(1); styleDraws('check', clamp(S.t / CHECK_S, 0, 1));
      setPhase(`Check the pairs · ${r.stats.pass} of ${r.stats.n} scenes pass`);
      if (S.t >= CHECK_S && !S.paused) startPlay();
    } else if (S.mode === 'play') {
      poseDraws(40, 'all'); setSnap(1); styleDraws('play', 1);
      const total = (F - 1) / r.fps + 1.0, tt = S.t % total, f = Math.min(tt * r.fps, F - 1);
      S.hero.setPose(r.tp.pos, r.tp.quat, f);
      const d = r.draws[S.sel], hit = d.alt_hit, frozen = hit != null && f >= hit;
      S.alt.setPose(r.ap.pos, r.ap.quat, frozen ? hit : f);
      altMaterial.color.setHex(frozen ? COL.bad : COL.alt); altMaterial.opacity = frozen ? 0.6 : 0.3;
      setPhase(d.necessary ? (frozen ? ($('t-alt').checked ? 'The alternative hits an obstacle. The input motion gets through.' : 'The input motion clears the generated scene.') : 'Same motion in both views. The generated scene adds context.')
        : `Scene ${S.sel + 1} fails the check: ${d.reason || 'not necessary'}`);
      $('scrub').value = String(Math.round(1000 * f / (F - 1)));
    }
  }
  const duration = S.result ? (S.result.frames - 1) / S.result.fps : 0;
  const time = ['gen', 'snap', 'check'].includes(S.mode) ? S.t : duration ? Math.min(S.t % (duration + 1), duration) : 0;
  $('play-time').textContent = `${time.toFixed(1)} s`;
  controls.update();
  const inputRect = stacked ? [0, viewHeight / 2, viewWidth, viewHeight / 2] : [0, 0, viewWidth / 2, viewHeight];
  const outputRect = stacked ? [0, 0, viewWidth, viewHeight / 2] : [viewWidth / 2, 0, viewWidth / 2, viewHeight];
  renderer.setScissorTest(true);
  // Hide only the context for the input view. The robot's pose and camera remain identical.
  const contextual = [S.boxGroup, S.alt?.root, S.altTrail, S.ring].filter(Boolean);
  const visibility = contextual.map(object => object.visible);
  contextual.forEach(object => { object.visible = false; });
  renderer.setViewport(...inputRect); renderer.setScissor(...inputRect); renderer.render(scene, camera);
  contextual.forEach((object, i) => { object.visible = visibility[i]; });
  if (S.altTrail) S.altTrail.visible = $('t-alt').checked;
  if (S.ring) S.ring.visible = false;
  renderer.setViewport(...outputRect); renderer.setScissor(...outputRect); renderer.render(scene, camera);
  renderer.setScissorTest(false);
}

// ---------------------------------------------------------------------------------------------- health, recorded runs
async function health() {
  const pill = $('status');
  if (STATIC) { pill.hidden = true; S.online = false; return; }
  if (!CFG.public) { pill.hidden = true; S.online = true; return; }
  pill.hidden = false;
  if (pill.dataset.state === undefined) { pill.textContent = 'checking the generator…'; $('go').disabled = true; }
  try {
    const h = await api('/api/health', undefined, undefined, 5000);
    S.online = true;
    pill.dataset.state = h.busy ? 'busy' : 'online';
    pill.textContent = h.busy ? 'generator busy · try later' : `generator online${h.queue ? ` · ${h.queue} queued` : ''}`;
    if (h.max_draws < 64) $('gen').querySelector('[data-key="draws"] [data-v="64"]').remove();
  } catch (e) {
    S.online = false;
    pill.dataset.state = 'offline';
    pill.textContent = 'generator offline · recorded runs below still play';
  }
  $('go').disabled = !S.online;
  $('go').textContent = S.online ? 'Generate scenes' : 'Generator offline';
}
const PRESETS = [
  { run: 'kd-9-duck', name: 'Duck', icon: '↘' },
  { run: 'kc-60-side-l', name: 'Sidestep', icon: '↔' },
  { run: 'kc-12-crouch', name: 'Crouch', icon: '↓' },
  { run: 'kc-63-veer-l', name: 'Turn', icon: '↰' },
  { run: 'kc-45-stop', name: 'Stop', icon: '⊣' },
];
let recordedRequest = 0;
async function playRecorded(ex) {
  const request = ++recordedRequest;
  $('load').hidden = false; $('retry-load').hidden = true;
  $('load-txt').textContent = 'Loading the motion and its generated scenes…';
  try {
    const response = await fetch(`${CFG.assets}/examples/${ex.file}`);
    if (!response.ok) throw new Error('This recording could not be downloaded.');
    const j = await response.json();
    if (request !== recordedRequest) return;
    showMotion(Object.assign(j.summary, { recorded: true }));
    onResult(j.result);
    const preset = PRESETS.find(item => item.run === ex.run);
    $('motion-title').textContent = preset ? `${preset.name} · ${ex.source}` : ex.label;
    document.querySelectorAll('#recorded .item').forEach(x => x.setAttribute('aria-current', String(x.dataset.run === ex.run)));
    document.querySelectorAll('.preset').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.run === ex.run)));
    if (STATIC && ex.run) {
      const url = new URL(location.href); url.searchParams.set('run', ex.run);
      history.replaceState(null, '', url);
    }
    $('load').hidden = true;
    setPhase('Same motion in both views. The generated scene adds context.');
  } catch (error) {
    if (request !== recordedRequest) return;
    $('load-txt').textContent = error.message || 'Could not load this recording.';
    $('retry-load').hidden = false; $('retry-load').onclick = () => playRecorded(ex);
    setPhase('Recording unavailable. Retry or choose another motion.');
  }
}

// ---------------------------------------------------------------------------------------------- boot
$('more-motions').addEventListener('click', () => { $('motion-library').open = !$('motion-library').open; });
$('motion-library').addEventListener('toggle', () => { $('more-motions').setAttribute('aria-expanded', String($('motion-library').open)); });
(async () => {
  try {
    S.model = await loadModel();
    S.hero = new Robot(S.model, 'full', heroMat, true);
    S.alt = new Robot(S.model, 'lite', () => altMaterial, false);
    S.alt.root.visible = false;
    S.hero.root.visible = false;  // shown once a motion is loaded
    $('load').hidden = true;
    let feat = null;
    if (STATIC) document.body.classList.add('static');
    else if (CFG.staticLibrary) {
      LIB = await (await fetch(`${CFG.assets}/library.json`)).json();
      feat = LIB.featured;
      for (const o of [...$('src').options]) if (o.value !== 'all' && !o.value.split(',').some((s) => LIB.sources[s])) o.remove();
      $('libcount').textContent = `${LIB.items.length.toLocaleString()} motions`;
    } else {
      const f = await api('/api/featured'); feat = f.items;
      $('libcount').textContent = `${f.total.toLocaleString()} motions`;
    }
    if (feat) listInto($('featured'), feat);
    if (CFG.examples.length) {
      $('recorded-wrap').hidden = false;
      $('recorded').innerHTML = '';
      for (const preset of PRESETS) {
        const ex = CFG.examples.find(ex => ex.run === preset.run); if (!ex) continue;
        const button = h('button', 'preset', h('span', 'preset-icon', preset.icon), preset.name);
        button.type = 'button'; button.dataset.run = preset.run; button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => playRecorded(ex)); $('presets').append(button);
      }
      for (const ex of CFG.examples) {
        const b = document.createElement('button'); b.className = 'item'; b.type = 'button';
        b.innerHTML = '<b></b><span></span>'; b.querySelector('b').textContent = ex.label; b.dataset.run = ex.run || '';
        b.querySelector('span').textContent = ex.n ? `${ex.pass} passing scenes · ${ex.source}` : 'recorded run · works offline';
        b.addEventListener('click', () => playRecorded(ex)); $('recorded').appendChild(b);
      }
    }
    setPhase('Pick a motion');
    const qs = new URLSearchParams(location.search), want = !STATIC && qs.get('motion');
    const run = CFG.examples.find((ex) => ex.run && ex.run === qs.get('run'));
    if (want) pick(want);
    else if (CFG.examples.length) await playRecorded(run || CFG.examples[0]);  // open on a recorded run: moving at once, no server cost
    health();  // in the background; the status pill updates when it answers (or after 5 s)
    if (CFG.public && !STATIC) setInterval(health, 60000);
  } catch (err) { $('load').hidden = false; $('load-txt').textContent = 'Could not start: ' + err.message; $('retry-load').hidden = false; $('retry-load').onclick = () => location.reload(); }
  requestAnimationFrame(tick);
})();
