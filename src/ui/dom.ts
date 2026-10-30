import { FX_URLS, ICON_URLS, SPRITES, UI_URLS } from '../battle/sprites';
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
  if (def.icon.startsWith('ic:')) {
    // 아이콘 그림 (src/assets/icons)
    const box = h('div', cls + ' fx-icon');
    const img = h('img');
    img.src = ICON_URLS[def.icon.slice(3)] ?? '';
    img.alt = '';
    img.draggable = false;
    box.append(img);
    return box;
  }
  if (!def.icon.startsWith('fx:')) return art(def.icon, cls);
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

/** 아이콘 그림 (src/assets/icons) */
export function icon(name: string, cls = '') {
  const img = h('img', cls);
  img.src = ICON_URLS[name] ?? '';
  img.alt = '';
  img.draggable = false;
  return img;
}

/** 그림 아이콘 + 숫자 칩 (재료·다이아 등) */
export function chip(name: string, text: string) {
  const c = h('span', 'chip');
  c.append(icon(name, 'chip-icon'), document.createTextNode(text));
  return c;
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
