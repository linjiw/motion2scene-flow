"""Package existing generated-motion Atlas recordings; never runs generation or physics.

python3 tools/pack_studio_atlas.py --source /path/to/presentation-20261028-atlas --out studio/atlas
The explicit allowlist excludes licensed motion-capture sources and their derivatives.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess

PUBLIC_SOURCES = frozenset({'kv', 'kc', 'kp2', 'sc', 'ksk'})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--story-source', type=Path, default=Path(__file__).resolve().parent.parent / 'two-flows/media')
    args = parser.parse_args()
    page = (args.source / 'web/index.html').read_text()
    original = json.loads(re.search(r'const IDX = (.*?);\n', page).group(1))
    records = [row for row in original if row['src'] in PUBLIC_SOURCES]
    assert records and len({r['id'] for r in records}) == len(records)
    args.out.mkdir(parents=True, exist_ok=True)
    for directory in ('clips', 'posters', 'pairs'):
        (args.out / directory).mkdir(exist_ok=True)
    # Refuse to combine an old export with a different subset.
    allowed = {r['id'] for r in records}
    for directory in ('clips', 'posters', 'pairs'):
        assert all(p.stem in allowed for p in (args.out / directory).iterdir()), 'Unexpected asset in output'
    shards = {}
    receipts = []

    def package(row):
        assert re.fullmatch(r'(kv|kc|kp2|sc|ksk)-\d{3}', row['id'])
        source = args.source / 'clips' / f"{row['id']}.mp4"
        clip = args.out / 'clips' / source.name
        shutil.copyfile(source, clip)
        poster = args.out / 'posters' / f"{row['id']}.jpg"
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-threads', '1', '-filter_threads', '1', '-ss', '2.5',
                        '-i', str(clip), '-frames:v', '1', '-vf', 'scale=480:270', '-q:v', '4', str(poster)], check=True)
        return {'id': row['id'], 'clip_sha256': hashlib.sha256(clip.read_bytes()).hexdigest()}

    for row in records:
        shard = row['shard']
        if shard not in shards:
            shards[shard] = json.loads((args.source / 'web/data' / f'shard_{shard}.json').read_text())
        data = shards[shard][row['id']]
        assert set(data) == {'radius', 'caps_t', 'caps_a', 'boxes', 'hit'}
        assert len(row['pass']) == 32 and row['pass'].count('1') == row['n_pass']
        assert row['pass'][row['shown']] == '1' and row['tclear'] >= 0.04
        (args.out / 'pairs' / f"{row['id']}.json").write_text(json.dumps(data, separators=(',', ':')))
    with ThreadPoolExecutor(max_workers=3) as pool:
        receipts = list(pool.map(package, records))
    keep = ('id', 'src', 'family', 'unseen', 'kind', 'label', 'clip', 'alt_kind', 'n_pass', 'shown', 'pass', 'tclear', 'aclear', 'boxes')
    entries = [{key: row[key] for key in keep} for row in records]
    attempts = [json.loads(line) for line in (args.source / 'data/attempts.jsonl').read_text().splitlines() if line.strip()]
    attempts = [a for a in attempts if a['src'] in PUBLIC_SOURCES]
    stats = {'pairs': len(entries), 'unseen': sum(r['unseen'] for r in entries), 'attempted': len(attempts),
             'without_pair': sum(a['id'] not in allowed for a in attempts), 'draws_per_motion': 32}
    metadata = {'recorded': '2026-10-28', 'source_packet': 'presentation-20261028-atlas', 'model': 'SceneFlow v3c',
                'scope': 'Kimodo and SONIC generated-motion subset; selected checked pairs, not a general benchmark',
                'stats': stats, 'items': entries}
    (args.out / 'index.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
    story_names = ('sf_flow_duck.mp4', 'sf_flow_duck_flow.jpg', 'sf_many.mp4', 'sf_many.jpg')
    story = args.out / 'story'
    story.mkdir(exist_ok=True)
    assert all(p.name in story_names for p in story.iterdir()), 'Unexpected story asset'
    story_receipts = []
    for name in story_names:
        shutil.copyfile(args.story_source / name, story / name)
        story_receipts.append({'file': name, 'sha256': hashlib.sha256((story / name).read_bytes()).hexdigest()})
    (args.out / 'provenance.json').write_text(json.dumps({'packet': metadata['source_packet'],
        'allowed_sources': sorted(PUBLIC_SOURCES), 'assets': receipts,
        'story_source': 'published two-flows/media; generated Kimodo motions', 'story': story_receipts}, indent=2) + '\n')
    print(json.dumps(stats))


if __name__ == '__main__':
    main()
