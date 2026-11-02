# Real-ESRGAN (CPU, via spandrel) upscaler with tiling.
# usage: upscale.py model.pth out_dir file1.jpg [file2 ...]   -> out_dir/<name>.png (4x)
import sys, os, time, torch, numpy as np
from PIL import Image
from spandrel import ModelLoader
torch.set_num_threads(os.cpu_count())
model_path, out_dir, files = sys.argv[1], sys.argv[2], sys.argv[3:]
m = ModelLoader().load_from_file(model_path).eval()
S = m.scale; TILE = int(os.environ.get('TILE', 256)); PAD = 16
os.makedirs(out_dir, exist_ok=True)
for f in files:
    t0 = time.time()
    im = np.asarray(Image.open(f).convert('RGB')).astype(np.float32) / 255
    x = torch.from_numpy(im).permute(2, 0, 1)[None]
    _, _, H, W = x.shape
    out = torch.zeros(1, 3, H * S, W * S)
    with torch.inference_mode():
        for y0 in range(0, H, TILE):
            for x0 in range(0, W, TILE):
                y1, x1 = min(y0 + TILE, H), min(x0 + TILE, W)
                py0, px0, py1, px1 = max(0, y0 - PAD), max(0, x0 - PAD), min(H, y1 + PAD), min(W, x1 + PAD)
                o = m(x[:, :, py0:py1, px0:px1])
                out[:, :, y0 * S:y1 * S, x0 * S:x1 * S] = o[:, :, (y0 - py0) * S:(y0 - py0 + y1 - y0) * S, (x0 - px0) * S:(x0 - px0 + x1 - x0) * S]
    arr = (out[0].clamp(0, 1).permute(1, 2, 0).numpy() * 255 + 0.5).astype(np.uint8)
    name = os.path.splitext(os.path.basename(f))[0]
    Image.fromarray(arr).save(os.path.join(out_dir, name + '.png'), compress_level=1)
    print(name, f'{W}x{H} -> {W*S}x{H*S}', f'{time.time()-t0:.0f}s', flush=True)
