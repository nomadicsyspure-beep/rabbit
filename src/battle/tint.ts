// 색 바꾸기: 그림의 픽셀 색상(hue)을 돌려 다른 색 병아리·스킬 이펙트를 만든다.
// 한 번 만든 그림은 (원본, 색) 짝으로 저장해 두고 다시 쓴다.

export interface Recolor {
  /** 색상 회전(도) */
  shift: number;
  /** 채도·밝기 배율 */
  sat: number;
  light: number;
  /** 이 색상 범위(도)의 픽셀만 바꾼다 (병아리 몸통 노랑만, 부리·발·눈은 그대로) */
  window?: readonly [number, number];
  /** 회전 대신 이 색상(도)으로 칠한다 (외곽선·눈처럼 색이 거의 없는 픽셀은 그대로). 몹 색 바꾸기용 */
  set?: number;
}

/** 스킬 그림을 한 가지 색상(도)으로 칠하기 ('sparkle@195' 같은 이름) */
const hues = new Map<number, Recolor>();
export function hueRecolor(hue: number): Recolor {
  let r = hues.get(hue);
  if (!r) hues.set(hue, (r = { shift: 0, sat: 1.15, light: 1, set: hue }));
  return r;
}

const cache = new WeakMap<object, Map<string, HTMLCanvasElement>>();

const keys = new WeakMap<Recolor, string>();
/** 색 묶음의 캐시 이름 (같은 묶음 객체는 한 번만 만든다: 몹마다 매 프레임 부르니까) */
export function recolorKey(r: Recolor) {
  let k = keys.get(r);
  if (k === undefined) keys.set(r, (k = `${r.shift}|${r.sat}|${r.light}|${r.window?.join('-') ?? ''}|${r.set ?? ''}`));
  return k;
}

/** 다시 칠한 그림 (원본이 아직 안 불러졌으면 원본 그대로) */
export function recolored(src: HTMLCanvasElement | HTMLImageElement, r: Recolor): HTMLCanvasElement | HTMLImageElement {
  const w = src instanceof HTMLImageElement ? src.naturalWidth : src.width;
  const h = src instanceof HTMLImageElement ? src.naturalHeight : src.height;
  if (!w || !h) return src;
  let byKey = cache.get(src);
  if (!byKey) cache.set(src, (byKey = new Map()));
  const key = recolorKey(r);
  const hit = byKey.get(key);
  if (hit) return hit;

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const rr = d[i] / 255;
    const gg = d[i + 1] / 255;
    const bb = d[i + 2] / 255;
    const max = Math.max(rr, gg, bb);
    const min = Math.min(rr, gg, bb);
    let l = (max + min) / 2;
    const c = max - min;
    let s = c === 0 ? 0 : c / (1 - Math.abs(2 * l - 1));
    let hue = 0;
    if (c !== 0) {
      if (max === rr) hue = 60 * (((gg - bb) / c + 6) % 6);
      else if (max === gg) hue = 60 * ((bb - rr) / c + 2);
      else hue = 60 * ((rr - gg) / c + 4);
    }
    if (r.window && (s < 0.2 || hue < r.window[0] || hue > r.window[1])) continue;
    if (r.set !== undefined && s < 0.15) continue;
    hue = r.set ?? (((hue + r.shift) % 360) + 360) % 360;
    s = Math.min(1, s * r.sat);
    l = Math.min(0.97, l * r.light);
    // HSL → RGB
    const k = (1 - Math.abs(2 * l - 1)) * s;
    const x = k * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = l - k / 2;
    const seg = Math.floor(hue / 60);
    const [r1, g1, b1] = seg === 0 ? [k, x, 0] : seg === 1 ? [x, k, 0] : seg === 2 ? [0, k, x] : seg === 3 ? [0, x, k] : seg === 4 ? [x, 0, k] : [k, 0, x];
    d[i] = (r1 + m) * 255;
    d[i + 1] = (g1 + m) * 255;
    d[i + 2] = (b1 + m) * 255;
  }
  ctx.putImageData(img, 0, 0);
  byKey.set(key, out);
  return out;
}
