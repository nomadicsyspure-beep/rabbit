"""배경이 흰색/검은색인 그림 시트(art/source/sheets2/*.webp)에서 그림을 하나씩 잘라낸다.

    pip install pillow numpy scipy
    python3 tools/sheet_cut.py index      # 번호 붙인 미리보기(art/source/sheets2/index-<시트>.png)를 만든다
    python3 tools/sheet_cut.py export     # tools/sheet_names.py의 번호 → 이름대로 src/assets에 저장

배경 지우기: 시트 가장자리에서 배경색(흰색 또는 검은색)과 비슷한 픽셀을 이어서 지운다.
그림 안쪽의 흰색(눈 하이라이트 등)은 외곽선에 막혀 남는다.
가까이 붙은 조각(이펙트 파편 등)은 한 그림으로 묶는다.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art" / "source" / "sheets2"
SHEETS = {"monsters-a": "white", "monsters-b": "white", "monsters-c": "white", "ui-a": "black", "ui-b": "black"}
# 조각을 한 그림으로 묶는 거리(px)
GROUP = {"white": 1, "black": 1}


def background_mask(rgb: np.ndarray, bg: str) -> np.ndarray:
    r, g, b = rgb[..., 0].astype(int), rgb[..., 1].astype(int), rgb[..., 2].astype(int)
    if bg == "white":
        near = (np.minimum(np.minimum(r, g), b) > 232) & (np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b) < 18)
    else:
        near = np.maximum(np.maximum(r, g), b) < 22
    # 가장자리와 이어진 배경색만 (안쪽 흰색은 남긴다)
    lab, _ = ndimage.label(near)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    return np.isin(lab, list(edge))


def pieces(name: str, with_mask=False):
    bg = SHEETS[name]
    img = Image.open(SRC / f"{name}.webp").convert("RGB")
    rgb = np.array(img)
    fg = ~background_mask(rgb, bg)
    # 작은 잡티 제거
    fg = ndimage.binary_opening(fg, iterations=1)
    grouped = ndimage.binary_dilation(fg, iterations=GROUP[bg])
    lab, n = ndimage.label(grouped)
    out = []
    for i, sl in enumerate(ndimage.find_objects(lab)):
        ys, xs = sl
        part = (lab[sl] == i + 1) & fg[sl]
        if part.sum() < 60:
            continue
        out.append((xs.start, ys.start, xs.stop, ys.stop, part))
    # 위에서 아래, 왼쪽에서 오른쪽 (줄 단위)
    out.sort(key=lambda p: (round(((p[1] + p[3]) / 2) / 40), p[0]))
    return (img, out, fg) if with_mask else (img, out)


def crop(img: Image.Image, p) -> Image.Image:
    x0, y0, x1, y1, part = p
    rgba = img.crop((x0, y0, x1, y1)).convert("RGBA")
    a = np.array(rgba)
    a[..., 3] = np.where(part, 255, 0)
    return Image.fromarray(a)


def index():
    for name in SHEETS:
        img, ps = pieces(name)
        sheet = img.convert("RGB").copy()
        d = ImageDraw.Draw(sheet)
        for i, (x0, y0, x1, y1, _) in enumerate(ps):
            d.rectangle((x0, y0, x1 - 1, y1 - 1), outline=(255, 0, 0))
            d.rectangle((x0, y0, x0 + 22, y0 + 11), fill=(255, 255, 0))
            d.text((x0 + 1, y0), str(i), fill=(0, 0, 0))
        sheet.save(SRC / f"index-{name}.png")
        print(name, len(ps))


def export():
    sys.path.insert(0, str(Path(__file__).parent))
    from sheet_names import NAMES  # noqa: E402

    for name, table in NAMES.items():
        img, ps, fg = pieces(name, with_mask=True)
        for idx, (folder, out_name, max_px) in table.items():
            if isinstance(idx, tuple):
                # 사각형: 그 안의 그림 부분만, 빈 테두리는 잘라낸다
                _, x0, y0, x1, y1 = idx
                part = fg[y0:y1, x0:x1]
                # 가장 큰 덩어리만 (옆 그림 조각이 섞여 들어오지 않게)
                lab, n = ndimage.label(part)
                if n > 1:
                    sizes = ndimage.sum(part, lab, range(1, n + 1))
                    part = lab == (int(np.argmax(sizes)) + 1)
                ys, xs = np.nonzero(part)
                bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
                im = crop(img, (x0 + bx0, y0 + by0, x0 + bx1, y0 + by1, part[by0:by1, bx0:bx1]))
            else:
                im = crop(img, ps[idx])
            if max_px and max(im.size) > max_px:
                k = max_px / max(im.size)
                im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
            dst = ROOT / "src" / "assets" / folder / f"{out_name}.png"
            dst.parent.mkdir(parents=True, exist_ok=True)
            im.save(dst, optimize=True)
        print(name, len(table), "saved")
    # 무기 아이콘은 스테이지에서 옆에 둥둥 뜨는 그림으로도 쓴다 (src/assets/gear/<장비id>.png)
    import shutil

    for f in (ROOT / "src" / "assets" / "icons").glob("gear-*.png"):
        gid = f.stem[5:]
        if gid in WEAPONS:
            shutil.copy(f, ROOT / "src" / "assets" / "gear" / f"{gid}.png")


WEAPONS = {"staff_feather", "rod_fire", "fan_thunder", "wand_star", "scythe_dark", "sword_demon"}


if __name__ == "__main__":
    {"index": index, "export": export}[sys.argv[1] if len(sys.argv) > 1 else "index"]()
