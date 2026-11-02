# Generates the app icons (a gold d20 on a dark dungeon background). Run: python3 tools/make_icons.py
import math, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
OUT = os.path.join(os.path.dirname(__file__), '..', 'icons'); os.makedirs(OUT, exist_ok=True)
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'

def icon(size, pad=0.0):
    S = 1024
    img = Image.new('RGB', (S, S), '#0e0b10')
    # radial glow background
    glow = Image.new('L', (S, S), 0); g = ImageDraw.Draw(glow)
    for r in range(S // 2, 0, -8):
        g.ellipse([S/2-r, S/2-r*1.05, S/2+r, S/2+r*0.95], fill=int(90 * (1 - r / (S/2)) ** 1.4))
    img.paste(Image.new('RGB', (S, S), '#7a3a1a'), (0, 0), glow)
    d = ImageDraw.Draw(img)
    cx, cy = S / 2, S / 2 + 10
    R = S * 0.36 * (1 - pad)
    hexa = [(cx + R * math.sin(math.radians(a)), cy - R * math.cos(math.radians(a))) for a in range(0, 360, 60)]
    inner_r = R * 0.58
    tri = [(cx + inner_r * math.sin(math.radians(a)), cy - inner_r * math.cos(math.radians(a)) + R * 0.08) for a in (0, 120, 240)]
    gold, dark = '#f3d27a', '#b07a22'
    # die body (shadow + faces)
    sh = Image.new('L', (S, S), 0); ImageDraw.Draw(sh).polygon([(x + 18, y + 26) for x, y in hexa], fill=200)
    img.paste(Image.new('RGB', (S, S), '#000000'), (0, 0), sh.filter(ImageFilter.GaussianBlur(24)))
    d.polygon(hexa, fill='#3a2614')
    for i in range(6):
        a, b = hexa[i], hexa[(i + 1) % 6]
        t = tri[((i + 1) // 2) % 3]
        d.polygon([a, b, t], fill=['#5a3a1c', '#4a2f17', '#6b4520', '#4a2f17', '#5a3a1c', '#3e2713'][i])
    d.polygon(tri, fill='#8a5a22')
    w = max(6, int(S * 0.016))
    for i in range(6):
        d.line([hexa[i], hexa[(i + 1) % 6]], fill=gold, width=w)
        d.line([hexa[i], tri[((i + 1) // 2) % 3]], fill=dark, width=w - 2)
    d.line(tri + [tri[0]], fill=gold, width=w)
    font = ImageFont.truetype(FONT, int(R * 0.42))
    tw, th = d.textbbox((0, 0), '20', font=font)[2:]
    tx, ty = cx - tw / 2, (tri[0][1] + tri[1][1] * 2) / 3 - th / 2 - R * 0.06
    d.text((tx + 4, ty + 5), '20', font=font, fill='#000000')
    d.text((tx, ty), '20', font=font, fill='#fff1c4')
    return img.resize((size, size), Image.LANCZOS)

icon(180).save(os.path.join(OUT, 'apple-touch-icon.png'))
icon(192).save(os.path.join(OUT, 'icon-192.png'))
icon(512).save(os.path.join(OUT, 'icon-512.png'))
icon(512, pad=0.18).save(os.path.join(OUT, 'icon-maskable-512.png'))
icon(32).save(os.path.join(OUT, 'favicon-32.png'))
print('icons written to', os.path.abspath(OUT))
