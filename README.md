# Motion2Scene Flow — public project site

Published site: https://linjiw.github.io/motion2scene-flow/

| page | what it is |
|---|---|
| `index.html` | **Two Flows** (12 Oct 2026), the project overview. It has the 15-minute narrated video, SceneFlow (motion → scene) and the flow-matching planner (scene → motion), learned hallucination, the G1 Traverse Arena, the lidar student and the deployment status. It also has five interactive explainers: the hallucination beam slider, a flow-matching toy, a SceneFlow slot scrubber, a slalom planning explorer and a lidar memory explorer. |
| `notebook.html` | The September 2026 research notebook: representation, generation and verification studies. It is built by `build.py` (requires `python3 -m pip install markdown`). |
| `two-flows/` | The 9 Oct 2026 Two Flows deck, with three.js viewers. |

The site is static HTML, CSS and JavaScript with no external runtime dependencies. The fonts (Archivo, IBM Plex,
Noto Sans Mono) are subset to woff2 in `home/fonts/`. To preview it, serve this directory with
`python3 -m http.server 8000`. GitHub Pages deploys it from the root of the main branch.

## Homepage assets (`home/`)

- `style.css` and `app.js` drive the page and its widgets. `app.js` loads each widget's data lazily when it scrolls
  into view.
- `media/` holds:
  - the film (720p, with a separate `.vtt` captions file) and its poster;
  - the hero reel;
  - the gallery clips;
  - the comparison clips.

  All robot footage is Isaac Lab closed-loop physics replayed in MuJoCo, or a MuJoCo rehearsal of the deploy stack.
  None of it is hardware.
- `img/` holds stills of the film's illustrations, the arena gallery and the G1 cutouts.
- `data/*.json` holds the widget data, with arrays packed as base64 int16, uint8 or 2-bit values:
  - the exact flow-matching toy field;
  - a recorded SceneFlow v3c 40-step sample;
  - the slalom replans, with 16 candidates re-sampled offline at each recorded state;
  - the student run, with the lidar memory rebuilt by the same ray caster and seed.

Everything in `home/` is generated from the research workspace by the scripts in
`artifacts/presentation-20261012-intro/scripts/`:
- `web_media.sh` makes the clips;
- `web_stills.py` makes the stills;
- `web_data.py` makes the widget data.

That folder's README explains the film itself.

## Notebook build

`content/review.md` and `data/experiments.json` hold the notebook's editorial content. Run `python3 build.py` to
rebuild `notebook.html`. In a standalone checkout it keeps the published evidence; inside the research workspace it
refreshes the note and figure snapshots from the parent. It does not train models or change experiments. Evidence
manifests distinguish source hashes from published hashes where machine-specific home paths were generalized.

## Checks

```bash
SITE_URL=http://127.0.0.1:8000/ node tools/check_home.cjs
SITE_URL=http://127.0.0.1:8000/ node tools/check.cjs
```

The first checks the homepage: local resources, JS errors, widget behaviour, no horizontal overflow at desktop or
phone width, and section screenshots. The second checks the notebook. Both need `playwright` or `playwright-core`
plus a local Chrome.

## Scope

Original datasets, weights, robot assets and large experiment arrays are not part of this repository. The public
notes describe local artifact identifiers; the website does not claim those data are downloadable here. Numbers on the
homepage are dev-grade results as of 12 October 2026, and the sealed arena test was unread at the time. The
notebook's results are offline proxy studies and native-reference audits. Related repositories are linked without
pooling their outcomes.
