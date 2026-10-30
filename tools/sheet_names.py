"""tools/sheet_cut.py export 가 쓰는 표: 시트 → {조각 번호 또는 사각형: (폴더, 이름, 최대 크기 px)}.

조각 번호는 `python3 tools/sheet_cut.py index` 로 만든 미리보기의 번호.
사각형 ("rect", x0, y0, x1, y1)은 큰 그림이 옆 그림과 붙어 있어 번호로 못 자를 때 시트 좌표로 직접.
"""

M = 96  # 몬스터
B = 180  # 보스
P = 80  # 바닥 장식
I = 64  # 아이콘
F = 128  # 이펙트

NAMES = {
    "monsters-a": {
        # 몬스터 (한 장짜리, 게임에서 통통 튀며 움직인다)
        0: ("monsters2", "rabbit_sword", M), 2: ("monsters2", "rabbit_shield", M), 4: ("monsters2", "rabbit_knight", M),
        11: ("monsters2", "rabbit_king", M), 15: ("monsters2", "flower_slime", M), 16: ("monsters2", "leaf_slime", M),
        18: ("monsters2", "tree_sprite", M), 19: ("monsters2", "stump_walker", M), 21: ("monsters2", "mush_red", M),
        22: ("monsters2", "mush_orange", M), 25: ("monsters2", "mush_blue", M), 27: ("monsters2", "mush_wizard", M),
        28: ("monsters2", "mush_hog", M), 44: ("monsters2", "hedgehog", M), 45: ("monsters2", "slime_blue", M),
        47: ("monsters2", "slime_yellow", M), 48: ("monsters2", "slime_purple", M), 49: ("monsters2", "slime_violet", M),
        54: ("monsters2", "boar", M), 55: ("monsters2", "boar_red", M), 58: ("monsters2", "boar_dark", M),
        69: ("monsters2", "cloud_ghost", M), 73: ("monsters2", "bat_purple", M), 76: ("monsters2", "bat_horn", M),
        78: ("monsters2", "bat_king", M), 79: ("monsters2", "demon_bat", M), 80: ("monsters2", "demon_bat2", M),
        85: ("monsters2", "duck_sword", M), 86: ("monsters2", "duck", M), 88: ("monsters2", "skeleton_helm", M),
        90: ("monsters2", "skeleton_staff", M), 91: ("monsters2", "skeleton_shield", M), 92: ("monsters2", "skeleton", M),
        93: ("monsters2", "wisp_purple", M), 98: ("monsters2", "shadow_blob", M), 100: ("monsters2", "fire_spirit", M),
        101: ("monsters2", "bush_slime", M), 105: ("monsters2", "fox_fire", M), 106: ("monsters2", "cat_knight", M),
        113: ("monsters2", "cat_black", M), 116: ("monsters2", "mush_big", M),
        110: ("monsters2", "boss_boar_king", B), 111: ("monsters2", "boss_golem", B),
        ("rect", 1035, 365, 1155, 498): ("monsters2", "boss_ice_golem", B),
        ("rect", 1152, 305, 1330, 500): ("monsters2", "boss_ent", B),
        ("rect", 1325, 345, 1536, 506): ("monsters2", "boss_demon_king", B),
        # 바닥 장식
        121: ("deco", "rock", P), 122: ("deco", "rocks_moss", P), 123: ("deco", "flowers", P), 125: ("deco", "bush", P),
        126: ("deco", "grass", P), 127: ("deco", "log", P), 130: ("deco", "crystal_blue", P), 132: ("deco", "tree_dead", P),
        133: ("deco", "tree", P), 136: ("deco", "tree_autumn", P), 137: ("deco", "pine", P), 139: ("deco", "pillar_broken", P),
        141: ("deco", "ruin_pillar", P), 143: ("deco", "crystal_purple", P), 144: ("deco", "ruin", P),
        150: ("deco", "stump", P), 151: ("deco", "flower_orange", P), 152: ("deco", "skull_bush", P),
        153: ("deco", "flowers_blue", P), 166: ("deco", "boulder", P), 169: ("deco", "crystal_small", P),
        176: ("deco", "fence", P), 177: ("deco", "sign", P), 179: ("deco", "barrel", P), 185: ("deco", "torch", P),
        186: ("deco", "bone", P), 182: ("deco", "candle", P),
        # 상자·아이콘
        161: ("icons", "chest-2", I), 164: ("icons", "chest-1", I),
        255: ("icons", "crown", I), 258: ("icons", "heart", I), 260: ("icons", "shield", I), 264: ("icons", "orb_gold", I),
        265: ("icons", "orb_blue", I), 266: ("icons", "orb_purple", I), 267: ("icons", "ice_gem", I), 270: ("icons", "leaf", I),
        271: ("icons", "fire", I), 272: ("icons", "drop", I), 276: ("icons", "hourglass", I), 277: ("icons", "coin", I),
        281: ("icons", "gem_blue", I), 282: ("icons", "essence", I), 283: ("icons", "gem_red", I), 284: ("icons", "shadow", I),
        285: ("icons", "skull", I), 294: ("icons", "snow_gem", I), 295: ("icons", "potion_red", I), 300: ("icons", "spellbook", I),
        304: ("icons", "bomb", I), 306: ("icons", "key", I), 314: ("icons", "lava_rock", I),
        # 이펙트
        192: ("fx", "tornado_gold", F), 193: ("fx", "leaves", F), 201: ("fx", "crescent_gold", F), 205: ("fx", "lightning_gold", F),
        208: ("fx", "water_wave", F), 209: ("fx", "explosion", F), 218: ("fx", "ghost_skull", F), 219: ("fx", "ice_lightning", F),
        223: ("fx", "tornado_blue", F), 224: ("fx", "ice_burst", F), 230: ("fx", "star4", F), 244: ("fx", "heal_ring", F),
        245: ("fx", "star_burst2", F), 248: ("fx", "halo", F), 253: ("fx", "dark_spike", F), 254: ("fx", "pink_star", F),
    },
    "monsters-b": {
        8: ("monsters2", "wisp_blue", M), 10: ("monsters2", "wisp_green", M), 11: ("monsters2", "wisp_fire", M),
        12: ("monsters2", "wisp_pink", M), 14: ("monsters2", "ghost_lantern", M), 16: ("monsters2", "ghost_purple", M),
        17: ("monsters2", "reaper", M), 18: ("monsters2", "skull_mage", M), 19: ("monsters2", "pumpkin", M),
        22: ("monsters2", "pumpkin_fire", M), 23: ("monsters2", "shadow_cat", M), 34: ("monsters2", "shadow_spike", M),
        38: ("monsters2", "ice_blob", M), 39: ("monsters2", "ice_beast", M), 41: ("monsters2", "moss_golem", M),
        44: ("monsters2", "cactus", M), 46: ("monsters2", "fruit_slime", M), 49: ("monsters2", "flytrap", M),
        50: ("monsters2", "flytrap_fire", M), 62: ("monsters2", "crystal_beast", M), 63: ("monsters2", "rock_beast", M),
        64: ("monsters2", "cloud", M), 66: ("monsters2", "penguin", M), 67: ("monsters2", "penguin_hat", M),
        69: ("monsters2", "lava_bear", M), 71: ("monsters2", "wolf", M), 72: ("monsters2", "wolf_dark", M),
        74: ("monsters2", "sheep", M), 76: ("monsters2", "deer", M), 77: ("monsters2", "deer_white", M),
        88: ("monsters2", "turtle_fire", M), 90: ("monsters2", "jellyfish", M), 101: ("monsters2", "robot", M),
        113: ("monsters2", "witch_skull", M), 120: ("monsters2", "moth", M), 123: ("monsters2", "bee", M),
        124: ("monsters2", "fairy_blue", M), 128: ("monsters2", "boss_green_dragon", B), 129: ("monsters2", "boss_blue_dragon", B),
        132: ("monsters2", "boss_white_dragon", B), 135: ("monsters2", "boss_dark_dragon", B),
        # 장비 아이콘
        136: ("icons", "gear-sword", I), 137: ("icons", "gear-sword_demon", I), 145: ("icons", "gear-scythe_dark", I),
        146: ("icons", "gear-wand_star", I), 169: ("icons", "gear-staff_feather", I), 183: ("icons", "gear-rod_fire", I),
        172: ("icons", "gear-fan_thunder", I),
        151: ("icons", "gear-hat_straw", I), 159: ("icons", "gear-hat_mush", I), 161: ("icons", "gear-hat_ice", I),
        184: ("icons", "gear-hat_fire", I), 149: ("icons", "gear-hat_demon", I),
        206: ("icons", "gear-bag_leather", I), 152: ("icons", "gear-cape_red", I), 174: ("icons", "gear-cape_demon", I),
        179: ("icons", "gear-acc_magnet", I), 204: ("icons", "gear-acc_watch", I), 226: ("icons", "gear-acc_eye", I),
        217: ("icons", "gear-acc_charm", I), 199: ("icons", "gear-wings_angel", I), 197: ("icons", "gear-wings_bat", I),
        190: ("icons", "potion_heart", I), 215: ("icons", "skillbook", I), 230: ("icons", "chest-0", I),
        239: ("icons", "crystal", I), 240: ("icons", "skull_orb", I),
        # 이펙트
        247: ("fx", "tornado_blue2", F), 250: ("fx", "heal_plus", F), 252: ("fx", "halo2", F), 253: ("fx", "star_burst3", F),
        255: ("fx", "explosion2", F), 256: ("fx", "fireball2", F), 259: ("fx", "skull_fire", F), 260: ("fx", "dark_slash", F),
        263: ("fx", "skull_dark", F), 264: ("fx", "dark_spike2", F), 265: ("fx", "dark_burst", F), 266: ("fx", "gold_slash", F),
        268: ("fx", "ice_slash", F), 270: ("fx", "ice_shard", F), 272: ("fx", "ice_burst2", F),
        # 바닥 장식
        291: ("deco", "tomb", P), 292: ("deco", "tomb2", P), 293: ("deco", "obelisk_purple", P), 297: ("deco", "pillar_moss", P),
        298: ("deco", "portal_blue", P), 300: ("deco", "portal_purple", P), 303: ("deco", "palm", P), 314: ("deco", "mushroom_red", P),
        318: ("deco", "mushroom_blue", P), 307: ("deco", "mushroom_orange", P), 333: ("deco", "pine2", P), 339: ("deco", "crystal_big", P),
        342: ("deco", "bush2", P), 346: ("deco", "flower_pink", P), 349: ("deco", "stump2", P), 354: ("deco", "rock2", P),
        363: ("deco", "crystal_ice", P), 371: ("deco", "puddle", P), 372: ("deco", "puddle_poison", P),
        373: ("deco", "puddle_purple", P), 375: ("deco", "crack", P), 378: ("deco", "snow_patch", P), 379: ("deco", "ice_patch", P),
        380: ("deco", "lava_crack", P), 381: ("deco", "grass_patch", P), 382: ("deco", "flower_patch", P), 385: ("deco", "stone_patch", P),
    },
    "monsters-c": {
        46: ("monsters2", "slime_crown_blue", M), 48: ("monsters2", "slime_crown_green", M), 50: ("monsters2", "slime_crown_red", M),
        53: ("monsters2", "boss_slime_king", B), 54: ("monsters2", "slime_winged", M), 61: ("monsters2", "ghost_purple2", M),
        74: ("monsters2", "duck2", M), 78: ("monsters2", "mole", M), 80: ("monsters2", "golem_small", M),
        86: ("monsters2", "fox", M), 89: ("monsters2", "fox_sword", M), 93: ("monsters2", "fox_king", M),
        94: ("monsters2", "turtle", M), 95: ("monsters2", "turtle_sprout", M), 100: ("monsters2", "boss_turtle", B),
        123: ("monsters2", "imp", M), 124: ("monsters2", "imp_spear", M),
        # 이펙트
        110: ("fx", "crescent_gold2", F), 116: ("fx", "star_burst4", F), 131: ("fx", "ice_lightning2", F), 136: ("fx", "water_tornado", F),
        140: ("fx", "water_vortex", F), 141: ("fx", "leaves2", F), 142: ("fx", "leaf_tornado", F), 143: ("fx", "heal_burst", F),
        144: ("fx", "green_spike", F), 146: ("fx", "void_orb", F), 147: ("fx", "dark_flame", F), 148: ("fx", "purple_slash", F),
        149: ("fx", "purple_ghost", F), 150: ("fx", "skull_wisp", F), 155: ("fx", "snowflake", F), 156: ("fx", "moon", F),
        # 아이콘
        161: ("icons", "plus_green", I), 163: ("icons", "snowflake", I), 164: ("icons", "lightning", I), 166: ("icons", "skull2", I),
        167: ("icons", "skull_purple", I), 169: ("icons", "star", I), 186: ("icons", "diamond", I), 206: ("icons", "chest-3", I),
        209: ("icons", "mushroom", I), 201: ("icons", "potion_yellow", I),
    },
    "ui-a": {
        46: ("icons", "emote-alert", I), 47: ("icons", "emote-question", I), 48: ("icons", "emote-heart", I),
        49: ("icons", "emote-angry", I), 50: ("icons", "emote-sweat", I), 51: ("icons", "emote-dizzy", I),
        35: ("icons", "coin2", I), 36: ("icons", "ruby", I),
    },
    "ui-b": {
        8: ("icons", "mail", I), 10: ("icons", "gift", I), 11: ("icons", "calendar", I),
        23: ("icons", "tile-heart", I), 24: ("icons", "tile-sword", I), 25: ("icons", "tile-shield", I), 26: ("icons", "tile-boot", I),
        27: ("icons", "tile-clover", I), ("rect", 533, 498, 605, 575): ("icons", "target-red", I),
        ("rect", 606, 498, 678, 575): ("icons", "target-green", I), 42: ("icons", "tile-lock", I), 45: ("icons", "chest-big", I), 47: ("icons", "chest-purple", I),
        64: ("icons", "tile-up-orange", I), 65: ("icons", "tile-up-green", I), 66: ("icons", "tile-sword-up", I),
        67: ("icons", "tile-shield-up", I), 71: ("icons", "tile-skull", I), 72: ("icons", "tile-fire", I),
        73: ("icons", "tile-poison", I), 74: ("icons", "tile-ice", I), 75: ("icons", "tile-dark-fire", I),
        34: ("icons", "el-fire", I), 35: ("icons", "el-water", I), 36: ("icons", "el-leaf", I), 37: ("icons", "el-bolt", I),
        38: ("icons", "el-moon", I), 39: ("icons", "el-star", I), 59: ("icons", "heart2", I), 60: ("icons", "star2", I),
    },
}
