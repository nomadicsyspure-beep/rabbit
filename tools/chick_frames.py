"""병아리 원본 GIF(art/source/chick)를 게임용 프레임 띠 PNG(src/assets/chick)로 바꾼다.

    python3 tools/chick_frames.py

원본 GIF에는 배경을 지우다 남은 회색 얼룩이 붙어 있어서 그걸 지운다.
결과는 프레임을 가로로 이어 붙인 PNG 한 장 (256×256 프레임 × N).
파일 이름: <동작>-<방향>.png  (예: walk-south-east.png)
"""
import colorsys
from collections import deque
from pathlib import Path

from PIL import Image

from extract_art import keep_largest

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art" / "source" / "chick"
OUT = ROOT / "src" / "assets" / "chick"

# 원본 폴더 이름 → 게임에서 쓰는 동작 이름
ANIMS = {"walking": "walk", "running": "run"}
DIRS = ["south-east", "south-west", "north-east", "north-west", "south", "north", "east", "west"]

# 방향별 머리(얼굴) 노란색 밝기 보정. 옆모습 원본이 다른 방향보다 얼굴이 어둡게 나와서 맞춘다
HEAD_LIGHTEN = {"east": 0.05, "west": 0.05}
# 이 높이(px)까지는 보정을 다 하고, HEAD_FADE_END까지 점점 줄여 몸통과 경계가 안 생기게 한다
HEAD_FADE_START, HEAD_FADE_END = 160, 200


def dir_of(name: str):
    # north-east가 north보다 먼저 걸리도록 긴 단어부터 찾는다
    for d in DIRS:
        if f"_{d}." in name or f"-{d}." in name or f"_{d}_" in name:
            return d
    return None


def is_gray(p):
    """회색 얼룩 본체: 채도가 거의 없는 중간 밝기"""
    r, g, b, a = p
    return a > 0 and max(r, g, b) - min(r, g, b) <= 8 and 105 <= max(r, g, b) <= 150


def is_grayish(p):
    """얼룩과 캐릭터 외곽선 사이에 섞인 경계 픽셀"""
    r, g, b, a = p
    return a > 0 and max(r, g, b) - min(r, g, b) <= 22 and 80 <= max(r, g, b) <= 170


def clean(frame: Image.Image):
    w, h = frame.size
    px = frame.load()
    edge = deque()
    for y in range(h):
        for x in range(w):
            if is_gray(px[x, y]):
                px[x, y] = (0, 0, 0, 0)
                edge.append((x, y, 0))
    # 지운 자리에 붙은 회색 경계를 2픽셀까지 더 지운다
    while edge:
        x, y, n = edge.popleft()
        if n >= 2:
            continue
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and is_grayish(px[nx, ny]):
                px[nx, ny] = (0, 0, 0, 0)
                edge.append((nx, ny, n + 1))
    keep_largest(frame)
    return frame


def lighten_head(frame: Image.Image, amount: float):
    """노란 깃털만 밝게 한다 (외곽선·눈·부리·볼은 그대로)"""
    w, h = frame.size
    px = frame.load()
    for y in range(min(h, HEAD_FADE_END)):
        k = 1.0 if y <= HEAD_FADE_START else (HEAD_FADE_END - y) / (HEAD_FADE_END - HEAD_FADE_START)
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            hue, light, sat = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            if not (0.09 < hue < 0.19 and light > 0.35):
                continue
            r2, g2, b2 = colorsys.hls_to_rgb(hue, min(1.0, light + amount * k), sat)
            px[x, y] = (round(r2 * 255), round(g2 * 255), round(b2 * 255), a)
    return frame


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for folder, anim in ANIMS.items():
        for path in sorted((SRC / folder).glob("*.gif")):
            d = dir_of(path.name)
            if not d:
                print("방향 단어 없음, 건너뜀:", path.name)
                continue
            gif = Image.open(path)
            w, h = gif.size
            strip = Image.new("RGBA", (w * gif.n_frames, h))
            for i in range(gif.n_frames):
                gif.seek(i)
                frame = clean(gif.convert("RGBA"))
                if d in HEAD_LIGHTEN:
                    lighten_head(frame, HEAD_LIGHTEN[d])
                strip.paste(frame, (i * w, 0))
            strip.save(OUT / f"{anim}-{d}.png", optimize=True)
            print(f"{anim}-{d}.png  {gif.n_frames}프레임")


if __name__ == "__main__":
    main()
