const $ = id => document.getElementById(id);
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const dialog = $('atlas-dialog'), grid = $('atlas-grid'), film = $('atlas-film');
const kinds = { posture: 'Posture', path: 'Path', body: 'Body width', narrow: 'Body width' };
const featured = ['kv-002', 'kc-166', 'sc-188', 'ksk-200', 'kv-008', 'kp2-180', 'kv-004', 'kc-170', 'sc-191', 'kv-006', 'kp2-176', 'ksk-201'];
let items = [], filtered = [], limit = 6, kind = 'all', previewsPaused = reduce.matches;
let current = null, view = 'film', viewer = null, revision = 0, request = null;
let priorFocus = null;
const visible = new Set();
const node = (tag, cls, text) => {
  const el = document.createElement(tag); if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text; return el;
};
const posterURL = item => `atlas/posters/${item.id}.jpg`;
const filmURL = item => `atlas/clips/${item.id}.mp4`;
const safePlay = video => video.play().catch(() => {});

function strip(item) {
  const bar = node('div', 'pass-strip');
  bar.setAttribute('role', 'img');
  bar.setAttribute('aria-label', `${item.n_pass} of 32 draws pass. Draw ${item.shown + 1} is shown.`);
  [...item.pass].forEach((bit, i) => bar.append(node('i', i === item.shown ? 'shown' : bit === '1' ? 'passed' : '')));
  return bar;
}
function syncPreviews() {
  let slots = 4;
  grid.querySelectorAll('video').forEach(video => {
    if (!previewsPaused && !document.hidden && !dialog.open && visible.has(video) && slots-- > 0) {
      if (!video.hasAttribute('src')) video.src = video.dataset.src;
      safePlay(video);
    } else video.pause();
  });
  $('atlas-motion').textContent = previewsPaused ? 'Play previews ▷' : 'Pause previews Ⅱ';
  $('atlas-motion').setAttribute('aria-pressed', String(previewsPaused));
}
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)); syncPreviews();
}, { threshold: 0.2 });

function makeCard(item) {
  const card = node('button', 'atlas-card'); card.type = 'button'; card.dataset.atlasId = item.id;
  const media = node('span', 'atlas-media'), video = node('video');
  video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'none';
  video.poster = posterURL(item); video.dataset.src = filmURL(item); video.setAttribute('aria-hidden', 'true');
  media.append(video, node('span', 'atlas-badge', item.unseen ? 'Unseen motion' : item.family.includes('SONIC') ? 'SONIC' : 'Kimodo'), node('span', 'atlas-open', '↗'));
  const body = node('span', 'atlas-card-body'), meta = node('span', 'atlas-card-meta');
  meta.append(node('span', '', kinds[item.kind]), node('span', '', item.id));
  const foot = node('span', 'atlas-card-foot');
  foot.append(node('strong', '', `${item.n_pass} / 32 scenes pass`), node('span', '', 'Open pair ↗'));
  body.append(meta, node('span', 'atlas-card-title', item.label), strip(item), foot);
  card.append(media, body); card.addEventListener('click', () => openPair(item, true));
  observer.observe(video); return card;
}
function render(reset = true) {
  if (reset) {
    limit = 6;
    const query = $('atlas-search').value.trim().toLowerCase(), source = $('atlas-source').value;
    filtered = items.filter(e => (kind === 'all' || (kind === 'body' ? ['body', 'narrow'].includes(e.kind) : kind === e.kind))
      && (source === 'all' || (source === 'unseen' ? e.unseen : source === 'sonic' ? e.src === 'sc' : e.src !== 'sc'))
      && `${e.label} ${e.family} ${e.id} ${e.boxes}`.toLowerCase().includes(query));
    observer.disconnect(); visible.clear(); grid.querySelectorAll('video').forEach(v => { v.pause(); v.removeAttribute('src'); v.load(); });
    grid.replaceChildren();
  }
  const start = grid.querySelectorAll('.atlas-card').length;
  filtered.slice(start, limit).forEach(item => grid.append(makeCard(item)));
  if (!filtered.length) grid.append(node('p', 'atlas-message', 'No matching pairs. Try another movement or source.'));
  $('atlas-count').textContent = `${Math.min(limit, filtered.length)} of ${filtered.length} pairs${filtered.length !== items.length ? ` · ${items.length} in the atlas` : ''}`;
  $('atlas-more').hidden = limit >= filtered.length;
  $('atlas-more').textContent = `Show ${Math.min(12, filtered.length - limit)} more pairs ↓`;
  grid.setAttribute('aria-busy', 'false'); syncPreviews();
}
function pairURL(item) {
  const url = new URL(location.href); url.searchParams.set('atlas', item.id); url.hash = 'atlas'; return url;
}
function stopGeometry() {
  revision++; request?.abort(); request = null; viewer?.dispose(); viewer = null;
  $('atlas-geometry').querySelector('canvas')?.remove();
  for (const id of ['atlas-3d-play', 'atlas-scrub', 'atlas-reset']) $(id).disabled = true;
}
function showView(which) {
  view = which;
  $('atlas-tab-film').setAttribute('aria-pressed', String(which === 'film'));
  $('atlas-tab-3d').setAttribute('aria-pressed', String(which === '3d'));
  $('atlas-film-panel').hidden = which !== 'film'; $('atlas-3d-panel').hidden = which !== '3d';
  film.pause();
  if (which === '3d') loadGeometry();
  else { stopGeometry(); if (!reduce.matches) safePlay(film); }
  $('atlas-detail-caption').textContent = which === '3d'
    ? 'Drag to orbit · scroll to zoom · arrow keys to rotate · + / − to zoom. Teal: input · amber: scene · red: blocked alternative.'
    : 'Teal: input motion · amber: generated scene · red: blocked alternative. Kinematic replay at ¾ speed.';
}
async function loadGeometry() {
  stopGeometry(); const token = revision, item = current; request = new AbortController();
  $('atlas-geometry-status').hidden = false; $('atlas-geometry-status').querySelector('span').textContent = 'Loading collision geometry…';
  $('atlas-3d-retry').hidden = true;
  try {
    const [module, response] = await Promise.all([import('./atlas-viewer.js'), fetch(`atlas/pairs/${item.id}.json`, { signal: request.signal })]);
    if (!response.ok) throw new Error('Geometry unavailable');
    const data = await response.json();
    if (token !== revision || !dialog.open || view !== '3d') return;
    viewer = module.createViewer($('atlas-geometry'), data, {
      reducedMotion: reduce.matches, alternative: $('atlas-alt').checked,
      onFrame: value => { $('atlas-scrub').value = String(value); },
      onPlay: playing => { $('atlas-3d-play').textContent = playing ? 'Pause' : 'Play'; },
    });
    $('atlas-geometry-status').hidden = true;
    for (const id of ['atlas-3d-play', 'atlas-scrub', 'atlas-reset']) $(id).disabled = false;
  } catch (error) {
    if (token !== revision || error.name === 'AbortError') return;
    $('atlas-geometry-status').querySelector('span').textContent = 'The 3D view could not load. Try again, or watch the motion replay.';
    $('atlas-3d-retry').hidden = false;
  }
}
function openPair(item, updateURL = false) {
  current = item; stopGeometry(); film.pause();
  if (!dialog.open) { priorFocus = document.activeElement; dialog.showModal(); }
  $('atlas-detail-id').textContent = `SceneFlow Atlas / ${item.id}`;
  $('atlas-detail-title').textContent = item.label;
  $('atlas-tags').replaceChildren(...[item.family, kinds[item.kind], item.unseen ? 'Unseen by SceneFlow' : 'From a training source'].map(text => node('span', '', text)));
  $('atlas-draw-summary').textContent = `${item.n_pass} of 32 scene candidates pass`;
  $('atlas-detail-strip').replaceChildren(strip(item));
  $('atlas-clearance').textContent = `${(item.tclear * 100).toFixed(1)} cm`;
  $('atlas-alt-clearance').textContent = `${(item.aclear * 100).toFixed(1)} cm`;
  $('atlas-draw').textContent = `${item.shown + 1} of 32`;
  $('atlas-boxes').textContent = `Obstacles: ${item.boxes}.`;
  $('atlas-alternative').textContent = `Tested alternative: ${item.alt_kind}. Negative clearance means penetration.`;
  $('atlas-permalink').href = pairURL(item).href;
  film.poster = posterURL(item); film.src = filmURL(item); $('atlas-film-error').hidden = true;
  $('atlas-prev').disabled = $('atlas-next').disabled = filtered.length < 2;
  if (updateURL) history.replaceState(null, '', pairURL(item));
  showView('film'); syncPreviews();
  document.dispatchEvent(new CustomEvent('sceneflow:atlas', { detail: { open: true } }));
}
function closePair() {
  if (dialog.open) dialog.close();
}
dialog.addEventListener('close', () => {
  film.pause(); film.removeAttribute('src'); film.load(); stopGeometry(); current = null;
  const url = new URL(location.href); url.searchParams.delete('atlas'); history.replaceState(null, '', url);
  syncPreviews(); priorFocus?.focus({ preventScroll: true });
  document.dispatchEvent(new CustomEvent('sceneflow:atlas', { detail: { open: false } }));
});
dialog.addEventListener('click', event => { if (event.target === dialog) { const b = dialog.getBoundingClientRect(); if (event.clientX < b.left || event.clientX > b.right || event.clientY < b.top || event.clientY > b.bottom) closePair(); } });
$('atlas-close').addEventListener('click', closePair);
$('atlas-tab-film').addEventListener('click', () => showView('film'));
$('atlas-tab-3d').addEventListener('click', () => showView('3d'));
$('atlas-3d-retry').addEventListener('click', loadGeometry);
$('atlas-film-retry').addEventListener('click', () => { film.load(); safePlay(film); });
film.addEventListener('error', () => { if (film.hasAttribute('src')) $('atlas-film-error').hidden = false; });
film.addEventListener('loadeddata', () => { $('atlas-film-error').hidden = true; });
$('atlas-3d-play').addEventListener('click', () => viewer?.toggle());
$('atlas-scrub').addEventListener('input', event => viewer?.seek(+event.target.value / 1000));
$('atlas-alt').addEventListener('change', event => viewer?.setAlternative(event.target.checked));
$('atlas-reset').addEventListener('click', () => viewer?.reset());
for (const [id, step] of [['atlas-prev', -1], ['atlas-next', 1]]) $(id).addEventListener('click', () => {
  if (!filtered.length) return;
  const i = filtered.findIndex(e => e.id === current.id);
  openPair(filtered[(i + step + filtered.length) % filtered.length], true);
});
$('atlas-filters').addEventListener('click', event => {
  const button = event.target.closest('[data-kind]'); if (!button) return;
  kind = button.dataset.kind; $('atlas-filters').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === button))); render();
});
$('atlas-search').addEventListener('input', () => render());
$('atlas-source').addEventListener('change', () => render());
$('atlas-more').addEventListener('click', () => { const old = limit; limit += 12; render(false); grid.querySelectorAll('.atlas-card')[old]?.focus({ preventScroll: true }); });
$('atlas-motion').addEventListener('click', () => { previewsPaused = !previewsPaused; syncPreviews(); });
document.addEventListener('visibilitychange', () => { syncPreviews(); if (document.hidden) film.pause(); });
reduce.addEventListener('change', () => { previewsPaused = reduce.matches; syncPreviews(); if (reduce.matches) { film.pause(); viewer?.pause(); } });
function openURL() {
  const id = new URL(location.href).searchParams.get('atlas'), item = items.find(e => e.id === id);
  if (item) openPair(item); else if (dialog.open) closePair();
}
window.addEventListener('popstate', openURL);
async function load() {
  grid.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch('atlas/index.json'); if (!response.ok) throw new Error('Atlas unavailable');
    const data = await response.json();
    items = [...featured.map(id => data.items.find(e => e.id === id)).filter(Boolean), ...data.items.filter(e => !featured.includes(e.id))];
    $('atlas-pair-count').textContent = data.stats.pairs; $('atlas-unseen-count').textContent = data.stats.unseen;
    $('atlas-scope').textContent = `${data.stats.pairs} checked pairs from ${data.stats.attempted} attempted generated motions; ${data.stats.without_pair} produced no passing pair. ${data.stats.unseen} displayed motions were unseen by SceneFlow during training. Recorded October 28, 2026 · SceneFlow v3c · Kimodo & SONIC subset. Selected geometric examples, not a general benchmark or physical robot execution.`;
    grid.replaceChildren(); render(); openURL();
  } catch {
    grid.setAttribute('aria-busy', 'false'); $('atlas-count').textContent = 'Atlas unavailable';
    const message = node('div', 'atlas-message', 'The atlas could not load.');
    const retry = node('button', 'button secondary', 'Try again'); retry.type = 'button'; retry.addEventListener('click', load);
    message.append(node('br'), retry); grid.replaceChildren(message);
  }
}
syncPreviews(); load();
