import bat from '../assets/bat.png';
import demon from '../assets/demon.png';
import ghost from '../assets/ghost.png';
import rabbitAttack from '../assets/rabbit_attack.png';
import rabbitDown from '../assets/rabbit_down.png';
import rabbitHit from '../assets/rabbit_hit.png';
import rabbitIdle from '../assets/rabbit_idle.png';
import rabbitWalk1 from '../assets/rabbit_walk1.png';
import rabbitWalk2 from '../assets/rabbit_walk2.png';
import slime from '../assets/slime.png';

// 캐릭터 시트에서 잘라낸 스프라이트 (tools/extract_art.py로 다시 만들 수 있다).
// 토끼 프레임은 모두 오른쪽을 보고 있어서, 왼쪽을 볼 땐 좌우 반전해서 그린다.

function load(url: string) {
  const img = new Image();
  img.src = url;
  return img;
}

export const SPRITES = {
  rabbitIdle: load(rabbitIdle),
  rabbitWalk: [load(rabbitWalk1), load(rabbitWalk2)],
  rabbitAttack: load(rabbitAttack),
  rabbitHit: load(rabbitHit),
  rabbitDown: load(rabbitDown),
  slime: load(slime),
  bat: load(bat),
  ghost: load(ghost),
  demon: load(demon),
};

export const isReady = (img: HTMLImageElement) => img.complete && img.naturalWidth > 0;
