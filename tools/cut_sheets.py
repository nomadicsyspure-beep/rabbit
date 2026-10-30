"""UI 시트(art/source/ui-sheet.webp)와 몬스터·이펙트 시트(art/source/fx-sheet.webp)에서 게임용 그림을 잘라낸다.

    python3 tools/cut_sheets.py

결과
  src/assets/ui/        HUD, 버튼, 패널, 조이스틱, 아이템, 스킬 아이콘
  src/assets/fx/        스킬 이펙트
  src/assets/monsters/  몬스터 걷기 프레임 띠(<이름>.png, 정사각형 칸) + 쓰러진 모습(<이름>-dead.png)
  src/assets/ground/    흙바닥에 흩뿌리는 돌·잎

시트에 그림으로 박혀 있는 숫자·글자(HP 120/120, STAGE 03 등)는 지우고, 게임이 그 자리에 실제 값을 쓴다.
좌표는 시트 픽셀 기준 (x0, y0, x1, y1).
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art" / "source"
OUT = ROOT / "src" / "assets"

ALPHA_MIN = 10


class Sheet:
    """투명 배경 시트. 불투명 덩어리(8방향 연결)를 미리 찾아 두고, 사각형 안에 중심이 있는 덩어리만 잘라낸다."""

    def __init__(self, path: Path):
        self.img = Image.open(path).convert("RGBA")
        self.w, self.h = self.img.size
        self._label()

    def _label(self):
        w, h = self.w, self.h
        alpha = self.img.getchannel("A").tobytes()
        label = [0] * (w * h)
        comps = [None]  # id -> [x0, y0, x1, y1, n, sx, sy]
        for start in range(w * h):
            if label[start] or alpha[start] < ALPHA_MIN:
                continue
            cid = len(comps)
            c = [w, h, 0, 0, 0, 0, 0]
            label[start] = cid
            stack = [start]
            while stack:
                i = stack.pop()
                x, y = i % w, i // w
                c[0] = min(c[0], x)
                c[1] = min(c[1], y)
                c[2] = max(c[2], x + 1)
                c[3] = max(c[3], y + 1)
                c[4] += 1
                c[5] += x
                c[6] += y
                for dy in (-1, 0, 1):
                    ny = y + dy
                    if ny < 0 or ny >= h:
                        continue
                    for dx in (-1, 0, 1):
                        nx = x + dx
                        if 0 <= nx < w:
                            j = ny * w + nx
                            if not label[j] and alpha[j] >= ALPHA_MIN:
                                label[j] = cid
                                stack.append(j)
            comps.append(c)
        self.label = label
        self.comps = comps

    def take(self, rect, hard=False):
        """rect 안에 중심이 있는 덩어리를 잘라 여백 없이 돌려준다.
        hard=True: 옆 그림과 붙어 있는 경우. rect 밖은 자르고, 큰 덩어리는 중심이 밖이어도 rect 안 부분을 쓴다."""
        x0, y0, x1, y1 = rect
        keep = set()
        for cid, c in enumerate(self.comps):
            if c is None:
                continue
            cx, cy = c[5] / c[4], c[6] / c[4]
            inside = x0 <= cx < x1 and y0 <= cy < y1
            overlaps = c[0] < x1 and c[2] > x0 and c[1] < y1 and c[3] > y0
            if inside or (hard and overlaps and c[4] > 1500):
                keep.add(cid)
        if not hard:
            # 고른 덩어리가 rect 밖으로 조금 나가도 통째로 담는다
            for cid in keep:
                c = self.comps[cid]
                x0, y0, x1, y1 = min(x0, c[0]), min(y0, c[1]), max(x1, c[2]), max(y1, c[3])
        out = Image.new("RGBA", (x1 - x0, y1 - y0))
        src = self.img.load()
        dst = out.load()
        for y in range(y0, y1):
            row = y * self.w
            for x in range(x0, x1):
                if self.label[row + x] in keep:
                    dst[x - x0, y - y0] = src[x, y]
        return out.crop(out.getbbox())

    def erase_rows(self, rect, sample_x):
        """rect를 줄마다 sample_x 열의 색으로 덮는다 (그림에 박힌 글자 지우기)"""
        px = self.img.load()
        x0, y0, x1, y1 = rect
        for y in range(y0, y1):
            c = px[sample_x, y]
            for x in range(x0, x1):
                px[x, y] = c

    def erase_circle(self, cx, cy, r, ring):
        """원 안을 바깥 고리(반지름 ring)의 평균색으로 덮는다 (조이스틱 손잡이 지우기)"""
        import math

        px = self.img.load()
        acc = [0, 0, 0, 0]
        n = 0
        for i in range(72):
            a = i / 72 * math.tau
            p = px[round(cx + math.cos(a) * ring), round(cy + math.sin(a) * ring)]
            for k in range(4):
                acc[k] += p[k]
            n += 1
        c = tuple(round(v / n) for v in acc)
        for y in range(cy - r, cy + r + 1):
            for x in range(cx - r, cx + r + 1):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                    px[x, y] = c

    def crop(self, rect):
        return self.img.crop(rect)


def save(img: Image.Image, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, optimize=True)


def strip(frames):
    """프레임들을 같은 크기 정사각형 칸에 발(아래 가운데) 기준으로 맞춰 가로로 잇는다"""
    size = max(max(f.width, f.height) for f in frames) + 2
    out = Image.new("RGBA", (size * len(frames), size))
    for i, f in enumerate(frames):
        out.paste(f, (i * size + (size - f.width) // 2, size - 1 - f.height), f)
    return out


# ---- 몬스터·이펙트 시트 ----

# 이름: (걷기 프레임들, 쓰러진 모습). hard=True인 칸은 옆 그림과 붙어 있어 사각형으로 자른다.
MONSTERS = {
    "rabbit": ([(26, 204, 89, 273), (95, 204, 156, 273), (161, 204, 215, 272), (225, 204, 300, 272)], (306, 216, 375, 269)),
    "slime": ([(402, 213, 455, 261), (466, 221, 518, 264), (527, 226, 573, 265), (580, 221, 638, 274)], (641, 223, 709, 265)),
    "mushroom": ([(758, 201, 815, 261), (820, 205, 876, 261), (886, 207, 940, 262), (953, 210, 1011, 263)], (1025, 217, 1091, 262)),
    "bat": ([(20, 285, 110, 344, "hard"), (110, 285, 206, 344, "hard"), (208, 287, 290, 340)], (302, 289, 374, 342)),
    "golem": ([(390, 274, 466, 340, "hard"), (466, 274, 542, 340, "hard"), (545, 274, 626, 346, "hard")], (626, 274, 727, 346, "hard")),
    "snail": ([(742, 274, 809, 338), (812, 275, 873, 338), (879, 275, 936, 338), (944, 285, 1022, 339)], (1038, 287, 1111, 338)),
    "sprout": ([(23, 353, 85, 419), (105, 355, 161, 421), (167, 353, 220, 419), (226, 365, 300, 418)], (304, 360, 369, 418)),
    "angel": ([(404, 346, 467, 416), (482, 348, 559, 413), (564, 359, 626, 417)], (637, 362, 709, 418)),
    "devil": ([(750, 351, 827, 418), (834, 353, 890, 418), (900, 353, 960, 419), (968, 352, 1050, 418, "hard")], (1050, 352, 1112, 418, "hard")),
}

FX = {
    "feather": (154, 433, 190, 514),
    "tornado": (263, 436, 350, 515),
    "star-burst": (361, 436, 461, 518),
    "fireball": (549, 448, 645, 522),
    "fire-burst": (649, 435, 725, 515),
    "purple-flame": (744, 430, 822, 522, "hard"),
    "dark-orb": (926, 432, 1004, 514),
    "ice-crystals": (173, 522, 264, 613),
    "heal-circle": (480, 522, 571, 605),
    "heal-cross": (581, 522, 683, 600),
    "pillar": (762, 522, 837, 609, "hard"),
    "dust": (22, 681, 111, 735),
    "sparkle": (129, 624, 175, 675),
    # 추가 스킬용
    "slash": (16, 437, 135, 522),
    "blue-slash": (21, 522, 112, 609),
    "purple-pit": (929, 528, 1020, 617),
    "purple-burst": (1016, 426, 1109, 522),
    "gold-sparkle": (1023, 529, 1110, 621),
}

GROUND = {
    "leaf": (148, 687, 196, 732),
    "dirt": (208, 687, 267, 733),
    "mound": (276, 682, 340, 733),
    "rock": (518, 694, 562, 733),
    "rubble": (831, 686, 901, 731),
}

# ---- UI 시트 ----

UI = {
    # 스킬 아이콘 (틀 포함). 큰 틀 4개는 아래 쿨다운 막대를 빼고 자른다
    "skill-feather": (55, 226, 226, 388, "hard"),
    "skill-tornado": (231, 226, 403, 388, "hard"),
    "skill-egg": (410, 226, 582, 388, "hard"),
    "skill-flame": (587, 226, 757, 388, "hard"),
    "skill-ice": (47, 456, 165, 575),
    "skill-heal": (170, 456, 289, 575),
    "skill-fire": (293, 456, 414, 576, "hard"),
    "skill-dark": (414, 456, 535, 576, "hard"),
    "pause": (1389, 31, 1502, 142),
    "btn-auto": (791, 234, 954, 398),
    "btn-gear": (1049, 864, 1156, 970),
    "coin": (279, 611, 342, 678),
    "gem-green": (449, 611, 503, 678),
    "gem-blue": (535, 610, 592, 675),
    "hp-bar": (609, 641, 896, 704),
    "xp-bar": (620, 715, 866, 773),
}


def cut_fx_sheet():
    sheet = Sheet(SRC / "fx-sheet.webp")

    def take(spec):
        rect, hard = spec[:4], len(spec) > 4
        return sheet.take(rect, hard)

    for name, (frames, dead) in MONSTERS.items():
        save(strip([take(f) for f in frames]), OUT / "monsters" / f"{name}.png")
        save(take(dead), OUT / "monsters" / f"{name}-dead.png")
    for name, spec in FX.items():
        save(take(spec), OUT / "fx" / f"{name}.png")
    for name, spec in GROUND.items():
        save(take(spec), OUT / "ground" / f"{name}.png")


def cut_ui_sheet():
    sheet = Sheet(SRC / "ui-sheet.webp")
    ui = OUT / "ui"

    # 숫자·글자가 박힌 그림: 원본에서 먼저 잘라 둘 조각 (게이지 채움)
    save(sheet.crop((289, 137, 428, 160)), ui / "hud-xp-fill.png")
    save(sheet.crop((76, 393, 139, 412)), ui / "cd-fill.png")

    # HUD: HP 숫자, "Lv. 12", 경험치 채움을 지운다
    sheet.erase_rows((336, 70, 482, 105), 320)
    sheet.erase_rows((190, 131, 278, 165), 277)
    sheet.erase_rows((286, 134, 432, 163), 445)
    save(sheet.take((23, 25, 603, 207)), ui / "hud.png")

    # 스테이지 표지판 (아래 큰 시간 숫자는 빼고 위 판자만)
    sheet.erase_rows((714, 48, 881, 84), 708)
    save(sheet.crop((629, 25, 967, 100)), ui / "plate.png")

    # 코인·해골 알약: 숫자를 지운다
    sheet.erase_rows((1076, 70, 1144, 106), 1070)
    save(sheet.take((995, 51, 1176, 124)), ui / "pill-coin.png")
    sheet.erase_rows((1274, 70, 1334, 106), 1268)
    save(sheet.take((1197, 51, 1368, 124)), ui / "pill-skull.png")

    # 쿨다운 막대: 파란 채움을 지운 빈 막대
    sheet.erase_rows((74, 391, 142, 414), 150)
    save(sheet.crop((68, 386, 211, 420)), ui / "cd-track.png")

    # 패널 두 종류: 오른쪽 아래 화살표를 지운다
    sheet.erase_rows((1448, 503, 1486, 536), 1440)
    save(sheet.take((1033, 433, 1506, 557), hard=True), ui / "panel-light.png")
    sheet.erase_rows((1448, 628, 1486, 661), 1440)
    save(sheet.take((1033, 560, 1506, 681), hard=True), ui / "panel-dark.png")

    # 조이스틱: 손잡이만 따로, 받침은 손잡이 자리를 메운다
    save(circle(sheet.crop((84, 663, 197, 776)), 56), ui / "joy-knob.png")
    sheet.erase_circle(140, 719, 55, 62)
    save(sheet.take((22, 601, 259, 838)), ui / "joy-base.png")

    # 네모 버튼: 집 아이콘을 지운 빈 틀 (탭 배경), 지도·막대그래프 아이콘
    save(icon_only(sheet.crop((1300, 885, 1374, 950))), ui / "icon-map.png")
    save(icon_only(sheet.crop((1184, 885, 1256, 950))), ui / "icon-stats.png")
    sheet.erase_rows((1418, 880, 1492, 956), 1420)
    save(sheet.take((1400, 864, 1509, 970)), ui / "btn-frame.png")

    for name, spec in UI.items():
        save(sheet.take(spec[:4], len(spec) > 4), ui / f"{name}.png")


def circle(img: Image.Image, r: float):
    """가운데 반지름 r 원 밖을 투명하게"""
    px = img.load()
    cx, cy = img.width / 2, img.height / 2
    for y in range(img.height):
        for x in range(img.width):
            if (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > r * r:
                px[x, y] = (0, 0, 0, 0)
    return img


def icon_only(img: Image.Image):
    """네모 버튼 안의 밝은(크림색) 아이콘만 남긴다"""
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            light = (r + g + b) / 3
            px[x, y] = (r, g, b, 0 if light < 120 else min(a, round((light - 120) / 60 * 255)))
    return img.crop(img.getbbox())


def main():
    cut_fx_sheet()
    cut_ui_sheet()
    print("saved to", OUT)


if __name__ == "__main__":
    main()
