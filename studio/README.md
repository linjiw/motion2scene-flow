# SceneFlow Studio

A static, interactive explanation of motion-conditioned scene generation. The input motion and the same motion in a generated scene play in synchronized 3D views. Five presets introduce the interaction; **All motions** exposes every published recording.

- **View pair:** play, pause or scrub both views together.
- **Try another scene:** cycle through passing candidates for the same motion.
- **Watch generation:** replay the recorded denoising, obstacle refinement and geometry checks.
- **Compare alternatives & inspect all candidates:** show the alternative motion, show other draws, slow playback, or inspect a rejected candidate.
- **Export scene JSON:** download the selected candidate's obstacle geometry, motion identifier, generation settings and check results. Pose sequences are not part of this export.
- **SceneFlow Atlas:** browse 83 checked pairs, filter by motion or source, search, and open a recorded replay or an orbitable collision-capsule view. Candidate strips show all 32 draws and identify the scene displayed.
- **Inside the flow:** play the existing noise-to-scene and one-motion/many-scenes films.

Motion playback interpolates position and rotation between recorded samples for smooth display. The generation rail highlights generate, refine, check and pair stages. Interpolation does not change source recordings, checks or exports.

## Atlas provenance and playback

`atlas/index.json` contains the generated-motion subset of `presentation-20261028-atlas`: 83 checked pairs from 92 attempts, including 44 displayed motions unseen by SceneFlow during training. Nine attempts did not yield a checked pair. These are selected geometric examples, not an aggregate performance claim. The allowlisted sources are `kv`, `kc`, `kp2`, `sc` and `ksk`; no licensed motion-capture sources or their derivatives are included.

Each replay shows the first passing draw, with a 4 cm input clearance requirement. `atlas/pairs/` contains centimetre-quantized collision capsule endpoints, downsampled from 50 Hz to 50/3 Hz, plus obstacle geometry and the alternative's collision frame. The viewer interpolates these display samples; reported clearances come from the original full-precision checks. Both views replay at ¾ speed. The alternative freezes red at the recorded penetration event. This is kinematic visualization, not controller execution.

Videos in `atlas/clips/` are byte-identical to the original packet. Posters are extracted from those videos. `atlas/provenance.json` records allowed sources and video hashes. `atlas/story/` bundles the existing published Kimodo films from `two-flows/media/` so the studio also works as a standalone build. Regenerate the package with `python3 tools/pack_studio_atlas.py --source /path/to/presentation-20261028-atlas --out studio/atlas`; this runs only packaging and thumbnail extraction, not model generation.

The gallery initially renders 12 cards and loads videos only for visible previews, with at most four playing. The dialog loads 3D data on demand, cancels stale requests and disposes its WebGL resources on close. Hidden/offscreen animations pause. Reduced-motion preferences show still previews and start all replays paused. The atlas includes a global preview pause, keyboard-accessible dialog, replay timeline, camera controls, recovery buttons and shareable `?atlas=kv-002#atlas` links. Atlas links can coexist with the original `?run=` selection.

The opening candidate has the fewest obstacles among passing scenes, with ties broken by total obstacle volume. All candidate geometry, verdicts and counts come from the existing recordings. A passing geometry check does not establish physical execution or prove the motion is the only possible solution.

The public page does not run the generator or accept uploads. A connected lab build supports its existing library and upload workflow. Public recordings and model assets live in `assets/`; `config.js` lists the available examples. UI changes do not require regenerating these files.

## Local preview

From the repository root:

```sh
python3 -m http.server 8767
```

Open `http://localhost:8767/studio/`. The `?run=kd-9-duck` query selects a recording and can be combined with `#explore`.

Drag either view to orbit both cameras. Ctrl/Command + scroll zooms without intercepting ordinary page scrolling. Focus the canvas and use arrow keys to orbit, `+`/`-` to zoom, or Home to reset. Reduced-motion preferences start playback paused. Small screens stack the two views vertically.

## Browser verification

With Playwright available to Node:

```sh
SITE_URL=http://127.0.0.1:8767/ CHROME_PATH=/path/to/chrome node tools/check_studio.cjs
SITE_URL=http://127.0.0.1:8767/ CHROME_PATH=/path/to/chrome node tools/check_studio_atlas.cjs
```

`SITE_CHECK_OUTPUT` selects an output directory for screenshots, the exported sample and the check report. The check covers all recordings, generation playback, scrubbing, candidate selection, export fidelity, responsive layouts, reduced motion, deep links, download recovery and racing requests. It also checks for JavaScript errors and unexpected generator requests.
