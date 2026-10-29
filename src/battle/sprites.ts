import bat from '../assets/bat.png';
import demon from '../assets/demon.png';
import ghost from '../assets/ghost.png';
import slime from '../assets/slime.png';
import { loadStrip, type Anim } from './anim';

// 주인공(병아리)은 src/assets/chick의 프레임 띠 PNG를 쓴다 (256×256 프레임, 투명 배경).
// 원본 GIF(art/source/chick/walking, running)를 tools/chick_frames.py로 바꾼 것.
//   파일 이름: <동작>-<방향>.png  동작 walk / run, 방향 south / south-east / east / north-east / north / north-west / west / south-west
// 몬스터는 캐릭터 시트에서 잘라낸 것 (tools/extract_art.py).

/**
 * 8방향 인덱스. 화면 기준 오른쪽(0°)부터 시계 방향으로 45°씩:
 * 0 오른쪽, 1 오른쪽 아래, 2 아래, 3 왼쪽 아래, 4 왼쪽, 5 왼쪽 위, 6 위, 7 오른쪽 위
 */
const DIRS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];

const chickStrips = import.meta.glob<string>('../assets/chick/*.png', { eager: true, query: '?url', import: 'default' });

/** 원본 GIF 프레임 시간(ms) ÷ 배율 = 게임 재생 프레임 시간 */
const SOURCE_FRAME_MS = 200;
export const HERO_ANIM_SPEED = { walk: 2, run: 3 };
export type HeroMotion = keyof typeof HERO_ANIM_SPEED;

/** 파일 이름에서 가장 긴 방향 단어를 찾아 인덱스로 (예: north-east가 north보다 먼저) */
function dirOf(name: string): number {
  let best = -1;
  for (let i = 0; i < DIRS.length; i++) {
    const re = new RegExp(`(^|[^a-z])${DIRS[i]}([^a-z]|$)`);
    if (re.test(name) && (best < 0 || DIRS[i].length > DIRS[best].length)) best = i;
  }
  return best;
}

function load(url: string) {
  const img = new Image();
  img.src = url;
  return img;
}

export const SPRITES = {
  /** 동작별 8방향 애니메이션. 불러오기 전이거나 파일이 없으면 null */
  hero: {
    walk: DIRS.map(() => null) as (Anim | null)[],
    run: DIRS.map(() => null) as (Anim | null)[],
  },
  slime: load(slime),
  bat: load(bat),
  ghost: load(ghost),
  demon: load(demon),
};

for (const [path, url] of Object.entries(chickStrips)) {
  const name = path.split('/').pop()!.toLowerCase();
  const motion = name.split('-')[0] as HeroMotion;
  const d = dirOf(name);
  if (!(motion in HERO_ANIM_SPEED) || d < 0) continue;
  loadStrip(url, SOURCE_FRAME_MS / HERO_ANIM_SPEED[motion])
    .then((anim) => {
      SPRITES.hero[motion][d] = anim;
    })
    .catch(() => {
      // 못 불러오면 그 방향은 도형으로 대신 그린다
    });
}

/** 주인공 그림 한 변 크기(px)와, 그림 안에서 발이 있는 높이 비율 */
export const HERO_SIZE = 46;
export const HERO_FOOT = 0.95;

/** 바라보는 방향 → 8방향 인덱스 (아래 = 2) */
export function heroDirIndex(fx: number, fy: number) {
  const a = Math.atan2(fy, fx);
  return ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
}

export const isReady = (img: HTMLImageElement | null): img is HTMLImageElement =>
  !!img && img.complete && img.naturalWidth > 0;
