import heroBack from '../../art/source/hero/bunny-back-256x256.png';
import heroBackLeft from '../../art/source/hero/bunny-back-left-256x256.png';
import heroBackRight from '../../art/source/hero/bunny-back-right-256x256.png';
import heroFront from '../../art/source/hero/bunny-front-256x256.png';
import heroFrontLeft from '../../art/source/hero/bunny-front-left-256x256.png';
import heroFrontRight from '../../art/source/hero/bunny-front-right-256x256.png';
import heroLeft from '../../art/source/hero/bunny-left-256x256.png';
import heroRight from '../../art/source/hero/bunny-right-256x256.png';
import heroWalkDown from '../../art/source/hero/Idle_custom-The_rabbit_sits_still_then_it_south.gif';
import bat from '../assets/bat.png';
import demon from '../assets/demon.png';
import ghost from '../assets/ghost.png';
import rabbitDown from '../assets/rabbit_down.png';
import slime from '../assets/slime.png';

// 주인공은 art/source/hero 원본을 그대로 쓴다 (256×256, 투명 배경).
// 몬스터와 쓰러진 토끼는 캐릭터 시트에서 잘라낸 것 (tools/extract_art.py).

function load(url: string) {
  const img = new Image();
  img.src = url;
  return img;
}

export const SPRITES = {
  /**
   * 8방향. 화면 기준 오른쪽(0°)부터 시계 방향으로 45°씩:
   * 오른쪽, 오른쪽 아래, 아래, 왼쪽 아래, 왼쪽, 왼쪽 위, 위, 오른쪽 위
   */
  heroDirs: [heroRight, heroFrontRight, heroFront, heroFrontLeft, heroLeft, heroBackLeft, heroBack, heroBackRight].map(load),
  rabbitDown: load(rabbitDown),
  slime: load(slime),
  bat: load(bat),
  ghost: load(ghost),
  demon: load(demon),
};

/** 아래로 걸을 때 쓰는 GIF. 캔버스에선 애니메이션이 안 돌아서 <img>로 겹쳐 띄운다. */
export const HERO_WALK_DOWN_GIF = heroWalkDown;

/** 8방향 PNG/GIF 기준 그림 한 변 크기(px)와, 그림 안에서 발이 있는 높이 비율 */
export const HERO_SIZE = 52;
export const HERO_FOOT = 0.88;

/** 바라보는 방향 → heroDirs 인덱스 (아래 = 2) */
export function heroDirIndex(fx: number, fy: number) {
  const a = Math.atan2(fy, fx);
  return ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
}

export const isReady = (img: HTMLImageElement) => img.complete && img.naturalWidth > 0;
