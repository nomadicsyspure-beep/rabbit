"""캐릭터 시트(art/source)에서 게임용 스프라이트를 잘라 src/assets에 저장한다.

    python3 tools/extract_art.py

시트 배경(베이지)을 가장자리부터 지우고, 가장 큰 덩어리(+근처 큰 조각)만 남긴 뒤 여백을 잘라낸다.
"""
from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art" / "source"
OUT = ROOT / "src" / "assets"

# 캐릭터 시트 좌표 (x0, y0, x1, y1)
SPRITES = {
    # 토끼: 기본 동작 줄은 오른쪽을 본다
    "rabbit_idle": (5, 520, 85, 605),
    "rabbit_walk1": (85, 520, 162, 605),
    "rabbit_walk2": (162, 520, 242, 605),
    "rabbit_attack": (548, 520, 632, 605),
    "rabbit_hit": (824, 520, 898, 605),
    "rabbit_down": (1022, 525, 1108, 605),
    "rabbit_front": (338, 42, 468, 160),
    # 몬스터
    "slime": (1372, 828, 1448, 905),
    "bat": (1438, 826, 1532, 895),
    "ghost": (1448, 932, 1528, 1010),
    "demon": (505, 820, 645, 962),
}


def cut_sprite(sheet: Image.Image, box):
    img = sheet.crop(box).convert("RGBA")
    w, h = img.size
    px = img.load()
    # 가장자리부터 배경색과 비슷한 픽셀을 지운다 (flood fill)
    seen = [[False] * h for _ in range(w)]
    q = deque()
    for x in range(w):
        q.append((x, 0))
        q.append((x, h - 1))
    for y in range(h):
        q.append((0, y))
        q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[x][y]:
            continue
        seen[x][y] = True
        r, g, b, _ = px[x, y]
        # 시트 배경: 밝고 채도가 낮은 따뜻한 베이지 (흰 유령처럼 푸른 기가 있는 흰색은 남긴다)
        bright = (r + g + b) / 3
        sat = max(r, g, b) - min(r, g, b)
        if bright < 175 or sat > 60 or r - b < 10:
            continue
        px[x, y] = (0, 0, 0, 0)
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))

    keep_largest(img)
    # 테두리를 살짝 부드럽게
    alpha = img.getchannel("A").filter(ImageFilter.MinFilter(3)).filter(ImageFilter.SMOOTH)
    img.putalpha(alpha)
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img


def keep_largest(img: Image.Image, keep_ratio=0.12):
    """불투명 덩어리 중 가장 큰 것과, 그 크기의 keep_ratio 이상인 조각만 남긴다."""
    w, h = img.size
    px = img.load()
    label = [[-1] * h for _ in range(w)]
    sizes = []
    for sx in range(w):
        for sy in range(h):
            if label[sx][sy] != -1 or px[sx, sy][3] == 0:
                continue
            idx = len(sizes)
            n = 0
            q = deque([(sx, sy)])
            label[sx][sy] = idx
            while q:
                x, y = q.popleft()
                n += 1
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and label[nx][ny] == -1 and px[nx, ny][3] > 0:
                        label[nx][ny] = idx
                        q.append((nx, ny))
            sizes.append(n)
    if not sizes:
        return
    biggest = max(sizes)
    for x in range(w):
        for y in range(h):
            i = label[x][y]
            if i != -1 and sizes[i] < biggest * keep_ratio:
                px[x, y] = (0, 0, 0, 0)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    sheet = Image.open(SRC / "character-sheet.webp").convert("RGB")
    for name, box in SPRITES.items():
        cut_sprite(sheet, box).save(OUT / f"{name}.png", optimize=True)
    print("saved to", OUT)


if __name__ == "__main__":
    main()
