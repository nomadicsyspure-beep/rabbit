import { RELIC_BY_ID } from '../data/relics';
import type { Engine } from './engine';
import { HERO_FOOT, HERO_SIZE, SPRITES, isReady } from './sprites';

// 병아리 몸에 보이는 장비: 모자(머리 위) / 등(몸 뒤, 위를 볼 땐 앞) / 무기(옆에 둥둥).
//
// 머리 위치는 프레임마다 그림의 투명 부분을 읽어서 찾는다 (손으로 좌표를 찍지 않는다).
// 걸을 때 머리가 들썩이면 모자도 같이 따라간다.
//
// 진짜 그림은 src/assets/gear에 넣는다 (README.md 참고).
//   모자·등: <장비id>-<방향>.png, 기준 프레임(art/templates/chick-<방향>.png) 위에 그린 레이어만 같은 크기로.
//     방향은 south / south-east / east / north-east / north 5개면 되고, 왼쪽은 뒤집어 쓴다.
//   무기: <장비id>.png 한 장
// 그림이 없으면 모자·무기는 아이콘 글자, 등은 코드로 그린 모양으로 대신한다.

/** 모자·등 장비를 몸에 그릴지 (지금은 꺼 둠: 무기만 옆에 둥둥) */
const SHOW_BODY_GEAR = false;
/** 무기가 떠 있는 거리(px) */
const HAND_DIST = 36;

const DIR_NAMES = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
/** 그림이 없는 왼쪽 방향은 오른쪽 그림을 뒤집어 쓴다: 방향 → [그림 방향, 뒤집기] */
const MIRROR: [number, boolean][] = [[0, false], [1, false], [2, false], [1, true], [0, true], [7, true], [6, false], [7, false]];

interface Anchor {
  /** 프레임 픽셀 기준: 그림 맨 위 / 맨 아래, 머리 가운데 x */
  top: number;
  bottom: number;
  cx: number;
}

const anchors = new WeakMap<HTMLCanvasElement, Anchor>();

/** 프레임의 머리 위치 (한 번 계산해 두고 다시 쓴다) */
function anchorOf(frame: HTMLCanvasElement): Anchor {
  const hit = anchors.get(frame);
  if (hit) return hit;
  const w = frame.width;
  const h = frame.height;
  const d = frame.getContext('2d')!.getImageData(0, 0, w, h).data;
  const solid = (x: number, y: number) => d[(y * w + x) * 4 + 3] > 128;
  const rowCount = (y: number) => {
    let n = 0;
    for (let x = 0; x < w; x++) if (solid(x, y)) n++;
    return n;
  };
  let top = 0;
  while (top < h - 1 && rowCount(top) < 3) top++;
  let bottom = h - 1;
  while (bottom > top && rowCount(bottom) < 3) bottom--;
  // 머리 가운데: 위쪽 30% 띠에 있는 픽셀들의 평균 x
  let sx = 0;
  let n = 0;
  const band = top + Math.round((bottom - top) * 0.3);
  for (let y = top; y < band; y++) {
    for (let x = 0; x < w; x++) {
      if (solid(x, y)) {
        sx += x;
        n++;
      }
    }
  }
  const a = { top, bottom, cx: n ? sx / n : w / 2 };
  anchors.set(frame, a);
  return a;
}

/** 지금 프레임이 그려지는 자리 (renderer가 넘겨준다) */
export interface HeroPlace {
  frame: HTMLCanvasElement;
  /** 8방향 인덱스 (0 오른쪽, 2 아래, 6 위) */
  dir: number;
  left: number;
  top: number;
}

/** 위를 보고 있으면 등이 앞에 보인다 */
const facingUp = (dir: number) => dir >= 5;

/** 방향별 레이어 그림을 머리 위치에 맞춰 그린다. 그림이 없으면 false */
function drawLayer(ctx: CanvasRenderingContext2D, id: string, at: HeroPlace) {
  let img = SPRITES.gear[`${id}-${DIR_NAMES[at.dir]}`];
  let srcDir = at.dir;
  let flip = false;
  if (!isReady(img)) {
    [srcDir, flip] = MIRROR[at.dir];
    img = SPRITES.gear[`${id}-${DIR_NAMES[srcDir]}`];
  }
  const tplFrame = SPRITES.hero.walk[srcDir]?.frames[0];
  if (!isReady(img) || !tplFrame) return false;
  const k = HERO_SIZE / at.frame.width;
  const cur = anchorOf(at.frame);
  const tpl = anchorOf(tplFrame);
  const tplCx = flip ? tplFrame.width - tpl.cx : tpl.cx;
  const x = at.left + (cur.cx - tplCx) * k;
  const y = at.top + (cur.top - tpl.top) * k;
  ctx.save();
  if (flip) {
    ctx.translate(x + HERO_SIZE, y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, HERO_SIZE, HERO_SIZE);
  } else {
    ctx.drawImage(img, x, y, HERO_SIZE, HERO_SIZE);
  }
  ctx.restore();
  return true;
}

/** 아이콘 글자 하나 그리기 */
function drawIcon(ctx: CanvasRenderingContext2D, icon: string, x: number, bottomY: number, size: number) {
  ctx.font = `${Math.round(size)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(icon, x, bottomY);
}

/** 모자: 머리 꼭대기에 */
function drawHat(ctx: CanvasRenderingContext2D, id: string, at: HeroPlace) {
  if (drawLayer(ctx, id, at)) return;
  const def = RELIC_BY_ID[id];
  if (!def) return;
  const k = HERO_SIZE / at.frame.width;
  const a = anchorOf(at.frame);
  // 머리 윗부분을 덮게 (머리털은 가린다)
  drawIcon(ctx, def.icon, at.left + a.cx * k, at.top + (a.top + (a.bottom - a.top) * 0.42) * k, HERO_SIZE * 0.55);
}

/** 등: 그림이 있을 때만 */
function drawBack(ctx: CanvasRenderingContext2D, id: string, at: HeroPlace) {
  drawLayer(ctx, id, at);
}

/** 공짜 스킬 유물: 병아리 옆(바라보는 쪽)에 둥둥 떠서 살랑살랑 */
let handSide = 1;
function drawHand(ctx: CanvasRenderingContext2D, eng: Engine, id: string, footY: number) {
  const def = RELIC_BY_ID[id];
  if (!def) return;
  const p = eng.player;
  // 좌우를 바꿀 때 순간이동하지 않게 천천히 옮긴다
  const want = p.faceX < -0.2 ? -1 : p.faceX > 0.2 ? 1 : handSide > 0 ? 1 : -1;
  handSide += (want - handSide) * 0.12;
  const x = p.x + handSide * HAND_DIST;
  const y = footY - HERO_SIZE * 0.7 + Math.sin(eng.time * 3) * 4;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(eng.time * 2) * 0.2 + handSide * 0.3);
  const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, 16);
  glow.addColorStop(0, 'rgba(255,240,170,0.55)');
  glow.addColorStop(1, 'rgba(255,240,170,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.fill();
  const img = SPRITES.gear[id];
  if (isReady(img)) {
    const w = 24;
    ctx.drawImage(img, -w / 2, (-w * img.naturalHeight) / img.naturalWidth / 2, w, (w * img.naturalHeight) / img.naturalWidth);
  } else {
    drawIcon(ctx, def.icon, 0, 9, 18);
  }
  ctx.restore();
}

/** 병아리 뒤에 그릴 것 (등 장비, 위를 볼 땐 무기) */
export function drawOutfitBehind(ctx: CanvasRenderingContext2D, eng: Engine, at: HeroPlace) {
  const { back, hand } = eng.look;
  if (SHOW_BODY_GEAR && back && !facingUp(at.dir)) drawBack(ctx, back, at);
  if (hand && facingUp(at.dir)) drawHand(ctx, eng, hand, at.top + HERO_SIZE * HERO_FOOT);
}

/** 병아리 앞에 그릴 것 (모자, 위를 볼 땐 등 장비, 무기) */
export function drawOutfitFront(ctx: CanvasRenderingContext2D, eng: Engine, at: HeroPlace) {
  const { hat, back, hand } = eng.look;
  if (SHOW_BODY_GEAR && back && facingUp(at.dir)) drawBack(ctx, back, at);
  if (SHOW_BODY_GEAR && hat) drawHat(ctx, hat, at);
  if (hand && !facingUp(at.dir)) drawHand(ctx, eng, hand, at.top + HERO_SIZE * HERO_FOOT);
}
