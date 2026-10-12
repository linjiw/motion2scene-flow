"""Build the public review without modifying or exporting the underlying datasets."""

import hashlib
import html
import json
import re
import shutil
from pathlib import Path

import markdown

SITE = Path(__file__).resolve().parent
ROOT = SITE.parent


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build():
    experiments = json.loads((SITE / "data/experiments.json").read_text())
    previous_path = SITE / "evidence/manifest.json"
    previous = json.loads(previous_path.read_text()) if previous_path.exists() else {"files": []}
    manifest = {"review_date": "2026-09-21", "scope": "Public research review, not a full experiment-data release", "files": []}
    if not (ROOT / "research").is_dir():
        manifest["files"].extend(f for f in previous["files"] if f.get("published", "").startswith("evidence/notes/"))
    for source in sorted((ROOT / "research").glob("*.md")):
        target = SITE / "evidence/notes" / (source.stem + ".txt")
        target.write_text(source.read_text().replace("/home/linjiw/", "$WORKSPACE_PARENT/"))
        manifest["files"].append({"source": str(source.relative_to(ROOT)), "source_sha256": digest(source), "published": str(target.relative_to(SITE)), "published_sha256": digest(target), "transformation": "Plain-text snapshot; machine-specific home prefix generalized."})
    figures = {
        "artifacts/hybrid-checker-v1/hybrid_results.png": "hybrid_results.png",
        "artifacts/hybrid-checker-v1/hybrid_results.pdf": "hybrid_results.pdf",
        "artifacts/native-event-v1/missed-event-00623-52.png": "missed-event.png",
        "artifacts/bounded-flow-v1/bounded_comparison.png": "bounded_comparison.png",
        "artifacts/native-budget-v1/budget_results.png": "budget_results.png",
    }
    for source_name, name in figures.items():
        source, target = ROOT / source_name, SITE / "assets" / name
        if source.exists():
            shutil.copy2(source, target)
            manifest["files"].append({"source": source_name, "source_sha256": digest(source), "published": str(target.relative_to(SITE)), "published_sha256": digest(target), "transformation": "Unmodified scientific figure."})
        else:
            entry = next(f for f in previous["files"] if f.get("source") == source_name)
            assert digest(target) == entry["published_sha256"]
            manifest["files"].append(entry)
    cards = []
    for index, e in enumerate(experiments, 1):
        esc = html.escape
        extra_figure = ""
        if e["id"] in ("bounded", "budget"):
            image_name = "bounded_comparison.png" if e["id"] == "bounded" else "budget_results.png"
            caption = "Measured bounded-output comparison; definitions and uncertainty are in the result note." if e["id"] == "bounded" else "Measured new-source budget curves; the witness-detection panels begin at 80%, not zero."
            extra_figure = f'<figure><a href="assets/{image_name}"><img src="assets/{image_name}" alt="{caption}" loading="lazy"/></a><figcaption>{caption} Click to inspect full size.</figcaption></figure>'
        cards.append(f'''<article class="study" id="study-{e['id']}" data-track="{esc(e['track'])}">
<div class="study-meta"><span class="study-number">{index:02}</span><span>{esc(e['track'])}</span><span class="badge">{esc(e['status'])}</span></div>
<h3>{esc(e['title'])}</h3><p class="result">{esc(e['result'])}</p>
<details><summary>Design, interpretation &amp; evidence</summary><dl>{''.join(f'<dt>{label}</dt><dd>{esc(e[key])}</dd>' for key,label in [('question','Question'),('design','Design & population'),('meaning','What this supports'),('limit','What it does not establish'),('next','Decision it prompted')])}</dl>
<a class="evidence-link" href="evidence/notes/{Path(e['source']).stem}.txt">Read the original result note ↗</a>{extra_figure}</details></article>''')
    notes = '<details class="notes"><summary>Browse all original protocols, result notes and the initial research plan</summary><ul>' + ''.join(f'<li><a href="{f["published"]}">{html.escape(Path(f["source"]).stem)}</a></li>' for f in manifest['files'] if f['published'].startswith('evidence/notes/')) + '</ul></details>'
    content = markdown.markdown((SITE / "content/review.md").read_text(), extensions=["tables", "fenced_code", "toc"])
    content = content.replace("<!-- EXPERIMENTS -->", '<div class="study-grid">' + ''.join(cards) + '</div>').replace("<!-- NOTES -->", notes)
    content = re.sub(r'<table>', '<div class="table-scroll" tabindex="0" role="region" aria-label="Scrollable comparison table"><table>', content).replace('</table>', '</table></div>')
    headings = re.findall(r'<h2 id="([^"]+)">([^<]+)</h2>', content)
    navigation = ''.join(f'<a href="#{key}"><span>{i:02}</span>{title}</a>' for i,(key,title) in enumerate(headings,1))
    content = re.sub(r'(<h2 id="[^"]+">)', r'</section><section class="chapter">\1', content)
    content = content.removeprefix('</section>') + '</section>'
    page = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Motion2Scene Flow — Learning to move through clutter</title>
<meta name="description" content="A research review of scene–motion representations, flow matching for robotics, eleven controlled experiments, and the path toward scene-aware humanoid traversal.">
<meta name="theme-color" content="#14382f"><meta property="og:title" content="Motion2Scene Flow — Research, evidence and next steps"><meta property="og:description" content="What geometry must a motion model preserve? Eleven experiments, an illustrated flow-matching guide, and a testable research roadmap.">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="style.css"><script defer src="app.js"></script></head>
<body><a class="skip" href="#the-problem">Skip to research</a>
<header class="topbar"><a class="brand" href="#top"><span class="brand-mark">M↦S</span> Motion2Scene <strong>Flow</strong></a><div class="top-links"><a href="index.html">Two Flows (home)</a><a href="#experiments-and-findings">Experiments</a><a href="#research-roadmap">Roadmap</a><a href="https://github.com/linjiw/motion2scene-flow">GitHub ↗</a></div></header>
<div class="hero" id="top"><div class="hero-copy"><p class="eyebrow">Research notebook / Humanoid traversal / 21 September 2026</p><h1>Learning to move<br>through <em>clutter.</em></h1><p class="lede">Which geometric details must a motion model preserve—and how can flow matching turn them into useful whole-body actions?</p><p class="hero-description">A complete review of our representation, generation and verification experiments. The promising results, the failed hypotheses, and the questions that should come next.</p><div class="hero-actions"><a class="button" href="#flow-matching-carefully">Understand the method <span>↗</span></a><a class="text-link" href="#experiments-and-findings">Explore the evidence ↓</a><a class="text-link" href="two-flows/">Latest: Two Flows presentation, 9 Oct 2026 →</a></div></div>
<div class="hero-visual"><svg viewBox="0 0 440 340" role="img" aria-label="Conceptual whole-body clearance diagram beneath an overhead obstacle"><defs><pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="#d4e0d7" stroke-width=".6"/></pattern></defs><rect x="10" y="10" width="420" height="300" rx="12" fill="url(#grid)"/><path d="M25 278H413" stroke="#899b91" stroke-width="2"/><path d="M140 30H345V114H140Z" fill="#ad7660" opacity=".65"/><path d="M155 115H332" stroke="#804831" stroke-width="3"/><path d="M44 228C100 230 124 191 180 184S293 218 402 226" fill="none" stroke="#487f6b" stroke-width="2" stroke-dasharray="6 6"/><g stroke="#164f40" stroke-width="14" stroke-linecap="round" fill="none"><path d="M188 171L222 204L203 235L173 266M222 204L251 232L282 263M194 179L156 200L128 222M204 177L244 176L268 207"/></g><g fill="#bfd6c9" stroke="#164f40" stroke-width="2"><circle cx="181" cy="148" r="19"/><circle cx="220" cy="202" r="12"/><circle cx="202" cy="236" r="9"/><circle cx="252" cy="232" r="9"/></g><path d="M180 118V128M175 118H185M175 128H185" stroke="#c95b30" stroke-width="2"/><text x="205" y="139" fill="#874729" font-size="12">clearance is local</text><text x="35" y="302" fill="#52665f" font-size="12">prepare → pass → whole-body exit → recover</text><text x="35" y="330" fill="#52665f" font-size="11">Concept illustration · not an experimental robot rollout</text></svg></div></div>
<div class="status-strip"><div><b>11</b><span>study blocks reviewed</span></div><div><b>75</b><span>tests in the latest research suite</span></div><div><b>3</b><span>continuous controls in current FM</span></div><div><b>0</b><span>robot rollouts in these studies</span></div></div>
<div class="page-layout"><aside><nav aria-label="Research contents"><p class="eyebrow">Inside the notebook</p>{navigation}</nav><div class="aside-note"><b>Evidence first.</b><p>Measured proxy results, native-reference audits, literature and future hypotheses are labeled separately.</p><button type="button" id="print-review">Print / save PDF</button></div></aside><main>{content}</main></div>
<footer><span>Motion2Scene Flow · Research workspace by <a href="https://github.com/linjiw">linjiw</a></span><span>Updated 21 September 2026 · <a href="evidence/manifest.json">Evidence manifest</a> · <a href="#top">Back to top ↑</a></span></footer></body></html>'''
    (SITE / "notebook.html").write_text(page)  # the homepage (index.html) is the Two Flows overview
    for name in ["data/experiments.json", "content/review.md"]:
        manifest["files"].append({"published": name, "published_sha256": digest(SITE / name), "transformation": "New research synthesis; results trace to the original notes above."})
    (SITE / "evidence/manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    (SITE / ".nojekyll").touch()
    print(f"Built {len(experiments)} studies, {len(headings)} chapters, {len(manifest['files'])} evidence entries.")


if __name__ == "__main__":
    build()
