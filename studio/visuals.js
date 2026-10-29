const video = document.getElementById('story-video'), play = document.getElementById('story-play');
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const stories = {
  flow: { file: 'sf_flow_duck', poster: 'sf_flow_duck_flow', caption: 'Recorded denoising trajectory · held-out Kimodo motion', label: 'Recorded SceneFlow denoising around a ducking motion' },
  many: { file: 'sf_many', poster: 'sf_many', caption: 'Eight scenes for one crouch · six pass, two are rejected in this recorded run', label: 'Eight generated environments for the same crouching motion' },
};
let selected = 'flow', visible = false, userPaused = reduce.matches, modalOpen = false, internalPause = false;
const safePlay = () => video.play().catch(() => {});
function source() { if (!video.hasAttribute('src')) video.src = `atlas/story/${stories[selected].file}.mp4`; }
function sync() {
  if (visible && !document.hidden && !userPaused && !modalOpen) { source(); safePlay(); }
  else if (!video.paused) { internalPause = true; video.pause(); }
}
function updateButton() { play.textContent = video.paused ? 'Play visualization ▷' : 'Pause visualization Ⅱ'; }
video.addEventListener('play', () => { userPaused = false; updateButton(); });
video.addEventListener('pause', () => { if (!internalPause) userPaused = true; internalPause = false; updateButton(); });
video.addEventListener('error', () => { document.getElementById('story-error').hidden = false; });
video.addEventListener('loadeddata', () => { document.getElementById('story-error').hidden = true; });
play.addEventListener('click', () => {
  userPaused = !video.paused;
  if (!userPaused) { source(); if (video.error) video.load(); safePlay(); } else video.pause();
});
document.querySelectorAll('[data-story]').forEach(button => button.addEventListener('click', () => {
  if (!video.paused) { internalPause = true; video.pause(); }
  selected = button.dataset.story;
  document.querySelectorAll('[data-story]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  const story = stories[selected];
  video.poster = `atlas/story/${story.poster}.jpg`; video.src = `atlas/story/${story.file}.mp4`;
  video.setAttribute('aria-label', story.label); document.getElementById('story-caption').textContent = story.caption;
  document.getElementById('story-error').hidden = true; sync();
}));
new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }, { threshold: .15 }).observe(video);
document.addEventListener('visibilitychange', sync);
document.addEventListener('sceneflow:atlas', event => { modalOpen = event.detail.open; sync(); });
reduce.addEventListener('change', () => { userPaused = reduce.matches; sync(); });
