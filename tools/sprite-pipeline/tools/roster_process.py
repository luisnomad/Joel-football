"""Roster processing helper (the Bob pilot recipe, docs/SPRITE_PILOT_BOB.md §2).

  roster_process.py STEP CHAR      (run with the Kick or Treat venv python)
  STEP: review | strips | idle | kick | celebrate | run | poses | sheets | pack

idle must run first (it sets char.json ref_height). kick finds the real window on the
largest connected component (ignores an invented, detached ball); pack picks the
sharpest near-full-extension frame as kick contact. Clip overrides: CLIP_KICK=path etc.
Review images go to source-assets/sprite-pipeline/review/work/.
idle, kick, celebrate, run and poses use Sprite Studio on the ATOM.
"""
import glob, json, os, subprocess, sys
import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT = '/Volumes/SSD_Storage2TB/Users/luisnomad/Projects/head-soccer'
PY = '/Volumes/SSD_Storage2TB/Users/luisnomad/Projects/kickortreat/.venv/bin/python'
SCR = '/Volumes/SSD_Storage2TB/Users/luisnomad/Projects/head-soccer/source-assets/sprite-pipeline/review/work'
os.makedirs(SCR, exist_ok=True)
SP = os.path.join(ROOT, 'tools/sprite-pipeline')
W = os.path.join(ROOT, 'source-assets/sprite-pipeline')
os.chdir(ROOT)
step, k = sys.argv[1], sys.argv[2]
clips = f'{W}/{k}/clips'
CLIP = {
    'idle': f'{clips}/p4_{k}_idle_h3_1.mp4',
    'kick': f'{clips}/p4_{k}_kick_h3_1.mp4',
    'celebrate': f'{clips}/p4_{k}_celebrate_h3_1.mp4',
    'run': f'{clips}/pv_{k}_run_h3cloud_1.mp4',
}
# per-action clip overrides (re-rolls): CLIP_<ACTION>=path
for _name in list(CLIP):
    if os.environ.get(f'CLIP_{_name.upper()}'):
        CLIP[_name] = os.environ[f'CLIP_{_name.upper()}']


def sh(*args):
    r = subprocess.run([*args], capture_output=True, text=True, cwd=ROOT)
    out = (r.stdout + r.stderr)
    lines = [l for l in out.splitlines() if ('frames ' in l and 'cells' in l) or 'ref_height' in l or 'Traceback' in l or 'Error' in l or 'loop' in l.lower()[:40]]
    print('\n'.join(lines[-6:]))
    if r.returncode:
        print(out[-1500:])
        sys.exit(r.returncode)


def masks(path):
    cap = cv2.VideoCapture(path)
    out = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        b, g, r = (f[..., i].astype(int) for i in range(3))
        out.append(~((g > r + 40) & (g > b + 40)))
    return out


def largest(m):
    """Largest connected component: ignores a detached ball or specks."""
    n, labels, stats, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), connectivity=8)
    if n <= 1:
        return m
    return labels == 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))


def extents(m):
    ys = np.nonzero(m.any(1))[0]
    xs = np.nonzero(m.any(0))[0]
    if not len(xs):
        return None
    return xs.min(), xs.max(), ys.min(), ys.max()


if step == 'strips':
    rows = []
    for name, path in CLIP.items():
        if not os.path.exists(path):
            print('missing', name)
            continue
        out = f'{SCR}/strip_{k}_{name}.png'
        n = int(subprocess.run(['ffprobe', '-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries',
                                'stream=nb_read_frames', '-of', 'csv=p=0', path], capture_output=True, text=True).stdout.strip())
        stepn = max(1, n // 15)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', path, '-vf', f"select='not(mod(n\\,{stepn}))',scale=150:150,tile=15x1",
                        '-frames:v', '1', out], check=True)
        rows.append(Image.open(out))
    c = Image.new('RGB', (max(r.width for r in rows), 150 * len(rows)))
    for i, r in enumerate(rows):
        c.paste(r, (0, 150 * i))
    c.save(f'{SCR}/strips_{k}.png')
    print('saved', f'{SCR}/strips_{k}.png', 'rows', list(CLIP)[:len(rows)])

elif step == 'review':
    subprocess.run([PY, __file__, 'strips', k], check=True, capture_output=True)
    strips = Image.open(f'{SCR}/strips_{k}.png')
    P = f'{W}/_poses'
    names = ['jump', 'stun', 'hit_impact', 'hit_recover', 'chilena_c1', 'chilena_c2', 'chilena_c3']
    poses = Image.new('RGB', (7 * 300, 300))
    for i, n in enumerate(names):
        f = (sorted(glob.glob(f'{P}/{k}_pose_{n}_gpt_v2_1.png')) or sorted(glob.glob(f'{P}/{k}_pose_{n}_gpt_v1_1.png')))[0]
        poses.paste(Image.open(f).convert('RGB').resize((300, 300)), (i * 300, 0))
    c = Image.new('RGB', (max(strips.width, poses.width), strips.height + 300))
    c.paste(strips, (0, 0))
    c.paste(poses, (0, strips.height))
    c.save(f'{SCR}/review_{k}.png')
    print('saved', f'{SCR}/review_{k}.png')

elif step == 'idle':
    sh(PY, f'{SP}/make_action.py', '--char', k, '--action', 'idle', '--clip', CLIP['idle'], '--mode', 'loop', '--keep', '8', '--fps', '8')
    cfg = json.load(open(f'{W}/{k}/char.json'))
    hs = [e[3] - e[2] + 1 for e in (extents(m) for m in masks(CLIP['idle'])[4:]) if e]
    print('ref_height', cfg['ref_height'], 'idle clip standing median', int(np.median(hs)), 'p90', int(np.percentile(hs, 90)))

elif step == 'kick':
    ms = masks(CLIP['kick'])
    ex = [extents(largest(m)) for m in ms]
    widths = np.array([e[1] - e[0] if e else 0 for e in ex])
    rights = np.array([e[1] if e else 0 for e in ex])
    rest = np.median(widths[-20:])
    active = np.nonzero(widths > rest + 25)[0]
    active = active[active > 3]
    if not len(active):
        sys.exit(f'no kick motion (rest width {rest})')
    start = max(0, active[0] - 3)
    # contact = furthest forward boot extent (art faces right) after the action starts
    search_end = min(len(ms) - 1, active[0] + 40)
    contact = start + int(np.argmax(rights[start:search_end + 1]))
    end = contact
    while end + 1 < len(ms) and not (end - contact > 6 and widths[end] <= rest + 8):
        end += 1
    end = min(len(ms) - 1, end + 3)
    print(f'kick window {start}..{end} contact {contact} (width {widths[contact]} rest {rest:.0f}) frames {end - start + 1}')
    cut = f'{clips}/p4_{k}_kick_h3_1_cut{start}-{end}.mp4'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', CLIP['kick'], '-vf', f"select='between(n\\,{start}\\,{end})',setpts=N/24/TB",
                    '-r', '24', '-c:v', 'libx264', '-crf', '4', '-pix_fmt', 'yuv420p', cut], check=True)
    sh(PY, f'{SP}/make_action.py', '--char', k, '--action', 'kick', '--clip', cut, '--mode', 'once', '--whole',
       '--hit', str(contact - start), '--keep', '12', '--fps', '14')
    sh(PY, f'{SP}/tools/clean_specks.py', f'{W}/sheets/{k}/kick.png', f'{W}/sheets/{k}/kick.json')

elif step == 'celebrate':
    sh(PY, f'{SP}/make_action.py', '--char', k, '--action', 'celebrate', '--clip', CLIP['celebrate'], '--mode', 'loop',
       '--keep', '8', '--fps', '10', '--min', '8', '--max', '30')
    sh(PY, f'{SP}/tools/clean_specks.py', f'{W}/sheets/{k}/celebrate.png', f'{W}/sheets/{k}/celebrate.json')

elif step == 'run':
    cfg = json.load(open(f'{W}/{k}/char.json'))
    ms = masks(CLIP['run'])
    first = [extents(m) for m in ms[:3]]
    standing = float(np.median([e[3] - e[2] + 1 for e in first if e]))
    scale = standing / cfg['ref_height']
    print(f'cloud run standing {standing:.0f}px vs ref_height {cfg["ref_height"]} -> ref-scale {scale:.4f}')
    sh(PY, f'{SP}/make_action.py', '--char', k, '--action', 'run', '--clip', CLIP['run'], '--mode', 'loop', '--keep', '8',
       '--fps', '12', '--min', '8', '--max', '24', '--ref-scale', f'{scale:.4f}')
    sh(PY, f'{SP}/tools/clean_specks.py', f'{W}/sheets/{k}/run.png', f'{W}/sheets/{k}/run.json')

elif step == 'poses':
    P = f'{W}/_poses'
    ref = f'source-assets/sprite-pipeline/{k}/ref/{k}_ref_approved.png'
    pick = lambda p: (sorted(glob.glob(f'{P}/{k}_pose_{p}_gpt_v2_1.png')) or sorted(glob.glob(f'{P}/{k}_pose_{p}_gpt_v1_1.png')))[0]
    sh(PY, f'{SP}/pose_sheet.py', '--char', k, '--ref', ref, '--action', 'jump', '--poses', f'{pick("jump")}:1',
       '--mode', 'once', '--hit', '0', '--fps', '8', '--headroom', '1.3')
    sh(PY, f'{SP}/pose_sheet.py', '--char', k, '--ref', ref, '--action', 'hit', '--poses',
       f'{pick("hit_impact")}:1,{pick("stun")}:1,{pick("hit_recover")}:1', '--mode', 'once', '--hit', '0', '--fps', '8', '--headroom', '1.3')
    sh(PY, f'{SP}/pose_sheet.py', '--char', k, '--ref', ref, '--action', 'chilena', '--poses',
       f'{pick("chilena_c1")}:1,{pick("chilena_c2")}:1,{pick("chilena_c3")}:1', '--mode', 'once', '--hit', '1', '--fps', '8', '--headroom', '1.3')
    for a in ['jump', 'hit', 'chilena']:
        sh(PY, f'{SP}/tools/clean_specks.py', f'{W}/sheets/{k}/{a}.png', f'{W}/sheets/{k}/{a}.json')

elif step == 'sheets':
    rows = []
    for a in ['idle', 'run', 'kick', 'celebrate', 'jump', 'hit', 'chilena']:
        j = json.load(open(f'{W}/sheets/{k}/{a}.json'))
        im = Image.open(f'{W}/sheets/{k}/{a}.png').convert('RGBA')
        fw, fh, cols = j['frame_width'], j['frame_height'], j['columns']
        row = Image.new('RGB', (fw * j['frame_count'], fh + 18), (34, 38, 52))
        d = ImageDraw.Draw(row)
        for i in range(j['frame_count']):
            f = im.crop(((i % cols) * fw, (i // cols) * fh, (i % cols + 1) * fw, (i // cols + 1) * fh))
            row.paste(f, (i * fw, 18), f)
            hs = ys = np.nonzero(np.array(f)[:, :, 3].any(1))[0]
            d.text((i * fw + 3, 2), f"{a}{i}{' H' if i == j.get('hit_frame') else ''} h{(ys[-1]-ys[0]+1) if len(ys) else 0}", fill='white')
        rows.append(row)
    c = Image.new('RGB', (max(r.width for r in rows), sum(r.height for r in rows)), (34, 38, 52))
    y = 0
    for r in rows:
        c.paste(r, (0, y))
        y += r.height
    c.thumbnail((2600, 2600))
    c.save(f'{SCR}/sheets_{k}.png')
    print('saved', f'{SCR}/sheets_{k}.png')

elif step == 'pack':
    def cells(a):
        j = json.load(open(f'{W}/sheets/{k}/{a}.json'))
        im = Image.open(f'{W}/sheets/{k}/{a}.png').convert('RGBA')
        fw, fh, cols = j['frame_width'], j['frame_height'], j['columns']
        return j, [im.crop(((i % cols) * fw, (i // cols) * fh, (i % cols + 1) * fw, (i // cols + 1) * fh)) for i in range(j['frame_count'])]

    def height(c):
        ys = np.nonzero(np.array(c)[:, :, 3].any(1))[0]
        return ys[-1] - ys[0] + 1

    def width(c):
        xs = np.nonzero(np.array(c)[:, :, 3].any(0))[0]
        return xs[-1] - xs[0] + 1

    def sharp(c):
        a = np.array(c.convert('L')).astype(np.float64)
        mask = np.array(c)[:, :, 3] > 0
        lap = cv2.Laplacian(a, cv2.CV_64F)
        return lap[mask].var() if mask.any() else 0

    _, idle = cells('idle')
    order = sorted(range(len(idle)), key=lambda i: -height(idle[i]))
    tallest = order[0]
    mid = order[len(order) // 2]
    low = order[-1]
    _, run = cells('run')
    blur = sorted(range(len(run)), key=lambda i: sharp(run[i]))[:max(0, len(run) - 6)]
    keep = [i for i in range(len(run)) if i not in blur]
    widest = max(keep, key=lambda i: width(run[i]))
    keep = keep[keep.index(widest):] + keep[:keep.index(widest)]
    kj, kick = cells('kick')
    hit = kj.get('hit_frame', len(kick) // 2)
    n = len(kick)
    # Contact: the sharpest near-full-extension frame around the detected hit,
    # so a motion-blur / invented-ball blob frame loses to its clean neighbour.
    around = [i for i in range(hit - 1, hit + 3) if 0 <= i < n]
    reach = max(width(kick[i]) for i in around)
    candidates = [i for i in around if width(kick[i]) >= 0.85 * reach]
    contact = max(candidates, key=lambda i: sharp(kick[i]))
    if os.environ.get('KICK_CONTACT'):
        contact = int(os.environ['KICK_CONTACT'])
    windup = max(0, contact - 3)
    follow = min(n - 1, contact + 2)
    hit = contact
    recover = n - 2 if n - 2 > follow else n - 1
    _, cel = cells('celebrate')
    celeb = [i for i in (0, 2, 4, 6) if i < len(cel)]
    while len(celeb) < 4:
        celeb.append(celeb[-1])
    frames = ([['idle', tallest], ['idle', mid], ['idle', low]]
              + [['run', i] for i in keep]
              + [['kick', windup], ['kick', hit], ['kick', follow], ['kick', recover]]
              + [['jump', 0]] + [['hit', 0], ['hit', 1], ['hit', 2]]
              + [['chilena', 0], ['chilena', 1], ['chilena', 2]]
              + [['celebrate', i] for i in celeb])
    assert len(frames) == 24, len(frames)
    plan = {'char': k, 'layout': 'roster-v2', 'scale': 1.0, 'frames': frames,
            '_comment': f'auto (roster fork): idle tallest/mid/low {tallest},{mid},{low}; run kept {keep} (dropped blurriest {blur}, widest first so the sprint uses opposite strides at cells 3 and 6); kick windup {windup}, contact {hit}, follow {follow}, recover {recover}; GPT jump/hit/chilena.'}
    json.dump(plan, open(f'{W}/{k}/atlas_plan.json', 'w'), indent=1)
    review = f'{W}/review/{k}_atlas_v1.png'
    r = subprocess.run([PY, f'{SP}/pack_atlas.py', f'{W}/{k}/atlas_plan.json', '--review', review], capture_output=True, text=True, cwd=ROOT)
    print('\n'.join(l for l in (r.stdout + r.stderr).splitlines() if 'measures' in l or 'allows' in l or 'Error' in l or 'atlas (' in l))
    if r.returncode:
        print(r.stdout[-800:], r.stderr[-800:])
        sys.exit(1)
    print('review', review)
