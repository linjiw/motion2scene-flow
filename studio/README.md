# SceneFlow Studio

A static, interactive explanation of motion-conditioned scene generation. The input motion and the same motion in a generated scene play in synchronized 3D views. Five presets introduce the interaction; **All motions** exposes every published recording.

- **View pair:** play, pause or scrub both views together.
- **Try another scene:** cycle through passing candidates for the same motion.
- **Watch generation:** replay the recorded denoising, obstacle refinement and geometry checks.
- **Compare alternatives & inspect all candidates:** show the alternative motion, show other draws, slow playback, or inspect a rejected candidate.
- **Export scene JSON:** download the selected candidate's obstacle geometry, motion identifier, generation settings and check results. Pose sequences are not part of this export.

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
```

`SITE_CHECK_OUTPUT` selects an output directory for screenshots, the exported sample and the check report. The check covers all recordings, generation playback, scrubbing, candidate selection, export fidelity, responsive layouts, reduced motion, deep links, download recovery and racing requests. It also checks for JavaScript errors and unexpected generator requests.
