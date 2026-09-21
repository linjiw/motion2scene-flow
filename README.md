# Motion2Scene Flow — public research notebook

A detailed research review of scene–motion representations and flow matching for
whole-body traversal: problem definition, 11 experimental study blocks, scientific
figures, interactive explanation, primary literature, limitations and a staged plan.

Published site: https://linjiw.github.io/motion2scene-flow/

The site is static HTML/CSS/JavaScript with no external runtime dependencies.
Serve this directory with `python3 -m http.server 8000` to preview it. The checked-in
`index.html` is deployable directly through GitHub Pages from the main branch root.

`content/review.md` and `data/experiments.json` hold the editorial content. `build.py`
requires Python Markdown (`python3 -m pip install markdown`). Run `python3 build.py`
to rebuild the page. In a standalone checkout it retains the published evidence;
inside the original research workspace it refreshes note/figure snapshots from
the parent. It does not train models or change experiments. Evidence manifests distinguish source hashes
from published hashes when machine-specific home paths have been generalized.

Original datasets, weights, robot assets and large experiment arrays are not part
of this website repository. The public notes describe local artifact identifiers;
the website does not claim those data are downloadable here. Reported results are
offline proxy studies and native-reference audits, not robot execution or MTC
pretraining. Related repositories are linked without pooling their outcomes.
