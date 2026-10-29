import bat from '../assets/bat.png';
import demon from '../assets/demon.png';
import ghost from '../assets/ghost.png';
import rabbitDown from '../assets/rabbit_down.png';
import slime from '../assets/slime.png';
import { loadGif, type GifAnim } from './gif';

// 주인공은 art/source/hero 원본을 그대로 쓴다 (256×256, 투명 배경).
// 파일 이름 속 방향 단어로 방향을 찾으니, 같은 단어만 들어 있으면 이름을 바꿔 올려도 된다.
//   멈춤 PNG: bunny-front / front-right / right / back-right / back / back-left / left / front-left
//   이동 GIF: south / south-east / east / north-east / north / north-west / west / south-west
// 몬스터와 쓰러진 토끼는 캐릭터 시트에서 잘라낸 것 (tools/extract_art.py).

/**
 * 8방향 인덱스. 화면 기준 오른쪽(0°)부터 시계 방향으로 45°씩:
 * 0 오른쪽, 1 오른쪽 아래, 2 아래, 3 왼쪽 아래, 4 왼쪽, 5 왼쪽 위, 6 위, 7 오른쪽 위
 */
const PNG_DIRS = ['right', 'front-right', 'front', 'front-left', 'left', 'back-left', 'back', 'back-right'];
const GIF_DIRS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];

const heroPngs = import.meta.glob<string>('../../art/source/hero/*.png', { eager: true, query: '?url', import: 'default' });
const heroGifs = import.meta.glob<string>('../../art/source/hero/*.gif', { eager: true, query: '?url', import: 'default' });

/** 파일 이름에서 가장 긴 방향 단어를 찾아 인덱스로 (예: north-east가 north보다 먼저) */
function dirOf(path: string, words: string[]): number {
  const name = path.split('/').pop()!.toLowerCase();
  let best = -1;
  for (let i = 0; i < words.length; i++) {
    const re = new RegExp(`(^|[^a-z])${words[i]}([^a-z]|$)`);
    if (re.test(name) && (best < 0 || words[i].length > words[best].length)) best = i;
  }
  return best;
}

function byDir(files: Record<string, string>, words: string[]): (string | null)[] {
  const out: (string | null)[] = words.map(() => null);
  for (const [path, url] of Object.entries(files)) {
    const d = dirOf(path, words);
    if (d >= 0) out[d] = url;
  }
  return out;
}

function load(url: string) {
  const img = new Image();
  img.src = url;
  return img;
}

export const SPRITES = {
  /** 멈춰 있을 때 8방향 */
  heroDirs: byDir(heroPngs, PNG_DIRS).map((u) => (u ? load(u) : null)),
  /** 이동할 때 8방향 애니메이션. 불러오기 전이거나 파일이 없으면 null */
  heroWalk: GIF_DIRS.map(() => null) as (GifAnim | null)[],
  rabbitDown: load(rabbitDown),
  slime: load(slime),
  bat: load(bat),
  ghost: load(ghost),
  demon: load(demon),
};

byDir(heroGifs, GIF_DIRS).forEach((url, i) => {
  if (!url) return;
  loadGif(url)
    .then((anim) => {
      SPRITES.heroWalk[i] = anim;
    })
    .catch(() => {
      // 못 불러오면 그 방향은 멈춤 PNG로 대신 걷는다
    });
});

/** GIF 재생 속도 배율 (원본 프레임 시간 ÷ 이 값) */
export const HERO_ANIM_SPEED = 2;

/** 주인공 그림 한 변 크기(px)와, 그림 안에서 발이 있는 높이 비율 */
export const HERO_SIZE = 52;
export const HERO_FOOT = 0.88;

/** 바라보는 방향 → 8방향 인덱스 (아래 = 2) */
export function heroDirIndex(fx: number, fy: number) {
  const a = Math.atan2(fy, fx);
  return ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
}

export const isReady = (img: HTMLImageElement | null): img is HTMLImageElement =>
  !!img && img.complete && img.naturalWidth > 0;
