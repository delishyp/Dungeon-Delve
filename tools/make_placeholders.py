#!/usr/bin/env python3
"""Placeholder card art (Anna, Nov 3 05:31): every card with no art (no assets/card_<id or art>.webp) gets a flat
image in its frame colour with the card name, saved as assets/placeholder/placeholder_<id>.webp, and is listed in
assets/placeholder/PLACEHOLDERS.md. Run from the repo root: python3 tools/make_placeholders.py
Placeholders are never a reference or starting point for real artwork. When real art lands as assets/card_<id>.webp
it wins automatically (ui.js cardHTML); delete the placeholder and its line then."""
import json, os, subprocess, textwrap
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'placeholder')
JS = """const D=require('./src/data.js');require('./src/content.js');
console.log(JSON.stringify(Object.entries(D.CARDS).map(([id,c])=>({id,name:c.name,cls:c.cls,type:c.type,rarity:c.rarity,art:c.art||id,frame:D.frameOf(c,id)}))));"""
cards = json.loads(subprocess.check_output(['node', '-e', JS], cwd=ROOT))
COL = {'attack': (150, 38, 38), 'defense': (38, 78, 150), 'buff': (44, 122, 58), 'debuff': (104, 48, 140),
       'utility': (150, 118, 40), 'curse': (40, 36, 40), 'status': (72, 72, 78)}
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'
FOR = {'attack': 'attack card', 'skill': 'skill card', 'power': 'power card', 'status': 'card'}
os.makedirs(OUT, exist_ok=True)
rows = []
for c in cards:
    if os.path.exists(os.path.join(ROOT, 'assets', 'card_' + c['art'] + '.webp')): continue
    W, H = 600, 800
    im = Image.new('RGB', (W, H), COL.get(c['frame'], (90, 90, 90)))
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(FONT, 64); small = ImageFont.truetype(FONT, 30)
    lines = textwrap.wrap(c['name'], 12)
    y = H * 0.36 - len(lines) * 40
    for ln in lines:
        w = d.textlength(ln, font=f); d.text(((W - w) / 2, y), ln, font=f, fill=(245, 240, 228)); y += 80
    for i, t in enumerate(['PLACEHOLDER', c['frame'] + ' / ' + c['rarity']]):
        w = d.textlength(t, font=small); d.text(((W - w) / 2, H * 0.08 + i * 40), t, font=small, fill=(235, 225, 205))
    fn = 'placeholder_' + c['id'] + '.webp'
    im.save(os.path.join(OUT, fn), 'WEBP', quality=80)
    rows.append(f"| `{fn}` | `{c['id']}` | {c['name']}: {c['cls']} {c['rarity']} {FOR.get(c['type'], c['type'])} illustration ({c['frame']} frame) |")
md = ["# Placeholder card art", "",
      "Anna (Nov 3, 05:31): until a card art style is settled, nobody waits on Palette for card art. Cards with no art get a",
      "generated flat placeholder (frame colour by card type + the card name). Made by `python3 tools/make_placeholders.py`.",
      "Palette: never use these as a reference or starting point for any artwork.",
      "To swap one out: add the real `assets/card_<card id>.webp` (it wins automatically), then delete the placeholder and its row.", "",
      "| File | Card id | What it is for |", "|---|---|---|"] + rows + [""]
open(os.path.join(OUT, 'PLACEHOLDERS.md'), 'w').write('\n'.join(md))
print('\n'.join(rows))
