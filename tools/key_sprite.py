# Chroma-key generated sprites (flat green or magenta background) -> trimmed transparent WebP.
# Usage: python3 tools/key_sprite.py raw.jpg out.webp [maxsize]
import sys, numpy as np
from PIL import Image, ImageFilter
def key(src, dst, maxsize=420):
    im = Image.open(src).convert('RGB')
    a = np.asarray(im).astype(np.float32)
    h, w, _ = a.shape
    border = np.concatenate([a[:8].reshape(-1, 3), a[-8:].reshape(-1, 3), a[:, :8].reshape(-1, 3), a[:, -8:].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    d = np.sqrt(((a - bg) ** 2).sum(-1))
    alpha = np.clip((d - 45) / 70.0, 0, 1)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    edge = alpha < 0.999
    if bg[1] > bg[0] and bg[1] > bg[2]:      # green screen: remove green spill on edges
        lim = np.maximum(r, b) + 12
        a[..., 1] = np.where(edge, np.minimum(g, lim), g)
    else:                                       # magenta screen
        a[..., 0] = np.where(edge, np.minimum(r, g + 25), r)
        a[..., 2] = np.where(edge, np.minimum(b, g + 25), b)
    al = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
    out = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).convert('RGBA')
    out.putalpha(al)
    bbox = out.getchannel('A').point(lambda v: 255 if v > 30 else 0).getbbox()
    if bbox:
        pad = 4
        out = out.crop((max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(w, bbox[2] + pad), min(h, bbox[3] + pad)))
    out.thumbnail((maxsize, maxsize), Image.LANCZOS)
    out.save(dst, 'WEBP', quality=80, method=6)
    return out.size
if __name__ == '__main__':
    print(key(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 420))
