import { FX_URLS, SPRITES, UI_URLS } from '../battle/sprites';
import { frameAt } from '../battle/anim';
import { hueRecolor, recolored } from '../battle/tint';
import type { SkillDef } from '../data/skills';

// DOM 만들기 도우미 (여러 화면이 같이 쓴다)

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text) el.textContent = text;
  return el;
}

export function svgIcon(svg: string, color?: string) {
  const el = h('div', 'icon');
  el.innerHTML = svg;
  if (color) el.style.background = color;
  return el;
}

/** UI 시트 그림 한 장 */
export function art(name: string, cls = '') {
  const img = h('img', cls);
  img.src = UI_URLS[name] ?? '';
  img.alt = '';
  img.draggable = false;
  return img;
}

/** 스킬 아이콘: UI 시트 그림, 또는 이펙트 그림을 나무 틀 안에 */
export function skillIcon(def: SkillDef, cls: string): HTMLElement {
  if (!def.icon.startsWith('fx:')) {
    // 시트 아이콘은 그림 속 나무 틀(찌꺼기)을 잘라 내고 CSS 틀 안에 넣는다
    const box = h('div', cls + ' fx-icon sheet-icon');
    box.append(art(def.icon));
    return box;
  }
  const box = h('div', cls + ' fx-icon');
  const [name, hue] = def.icon.slice(3).split('@');
  if (!hue) {
    const img = h('img');
    img.src = FX_URLS[name] ?? '';
    img.alt = '';
    img.draggable = false;
    box.append(img);
    return box;
  }
  // 색을 바꾼 이펙트 그림: 불러온 뒤 캔버스에 칠해 넣는다
  const c = h('canvas');
  const src = SPRITES.fx[name];
  const paint = () => {
    if (!src?.naturalWidth) return;
    const out = recolored(src, hueRecolor(Number(hue)));
    c.width = out.width;
    c.height = out.height;
    c.getContext('2d')!.drawImage(out, 0, 0);
  };
  if (src?.complete) paint();
  else src?.addEventListener('load', paint, { once: true });
  box.append(c);
  return box;
}

export function coin(text: string) {
  const s = h('span', 'gold');
  s.append(art('coin', 'coin'), document.createTextNode(text));
  return s;
}

/** 누르고 있으면 반복 실행 (강화 버튼용) */
export function holdRepeat(el: HTMLElement, fn: () => boolean) {
  let delay = 0;
  let timer = 0;
  const stop = () => {
    clearTimeout(delay);
    clearInterval(timer);
  };
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    stop();
    if (!fn()) return;
    delay = window.setTimeout(() => {
      timer = window.setInterval(() => {
        if (!fn()) stop();
      }, 90);
    }, 350);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel'] as const) el.addEventListener(ev, stop);
}

/** 몬스터(동료) 첫 프레임 그림. 그림이름@색상이면 색을 바꿔서 */
export function monsterPic(skin: string, size = 44, cls = 'pet-pic') {
  const c = h('canvas', cls);
  c.width = c.height = size * 2;
  c.style.width = c.style.height = `${size}px`;
  const [name, hue] = skin.split('@');
  const draw = () => {
    const anim = SPRITES.monsters[name];
    if (!anim) return false;
    const src = anim.frames[0];
    c.getContext('2d')!.drawImage(hue ? recolored(src, hueRecolor(Number(hue))) : src, 0, 0, c.width, c.height);
    return true;
  };
  retryDraw(draw);
  return c;
}

/** 그림이 아직 안 불러졌으면 불러질 때까지 다시 그린다 (폰에선 늦게 불러지기도 한다) */
function retryDraw(draw: () => boolean, tries = 40) {
  if (draw() || tries <= 0) return;
  setTimeout(() => retryDraw(draw, tries - 1), 250);
}

/** 병아리 정면 그림 (가방 탭 가운데) */
export function chickPic(size = 96, walk = false) {
  const c = h('canvas', 'chick-pic');
  c.width = c.height = size * 2;
  c.style.width = c.style.height = `${size}px`;
  const draw = () => {
    const anim = SPRITES.hero.walk[2];
    if (!anim) return false;
    // walk = 정면으로 걷는 모습 (프레임을 돌린다)
    const src = walk ? frameAt(anim, performance.now()) : anim.frames[0];
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(src, 0, 0, c.width, c.height);
    return true;
  };
  retryDraw(draw);
  if (walk) {
    // 화면에서 떨어지면(탭을 옮기면) 멈춘다
    const loop = () => {
      if (!c.isConnected && c.dataset.started) return;
      if (c.isConnected) c.dataset.started = '1';
      draw();
      setTimeout(loop, 80);
    };
    loop();
  }
  return c;
}

/** 깔끔한 아이콘 틀 (CSS로 그림): 안에 글자 아이콘이나 그림 */
export function ibox(content: string | HTMLElement, cls = '') {
  const b = h('div', 'ibox' + (cls ? ' ' + cls : ''));
  if (typeof content === 'string') b.textContent = content;
  else b.append(content);
  return b;
}
