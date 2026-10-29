import { decompressFrames, parseGIF } from 'gifuct-js';

// GIF를 프레임 이미지로 풀어서 캔버스에서 직접 재생한다.
// <img>로 띄우면 속도를 바꿀 수 없고 캔버스 위에 따로 떠서 이펙트와 겹치는 순서가 어긋난다.

export interface GifAnim {
  width: number;
  height: number;
  frames: HTMLCanvasElement[];
  /** 프레임별 표시 시간(ms) */
  delays: number[];
  /** delays 합 */
  duration: number;
}

export async function loadGif(url: string): Promise<GifAnim> {
  const buf = await (await fetch(url)).arrayBuffer();
  const gif = parseGIF(buf);
  const parsed = decompressFrames(gif, true);
  const width = gif.lsd.width;
  const height = gif.lsd.height;

  // 프레임은 바뀐 부분(patch)만 담고 있어서, 화면 한 장에 차례로 덮어 그리며 완성본을 만든다
  const screen = document.createElement('canvas');
  screen.width = width;
  screen.height = height;
  const sctx = screen.getContext('2d')!;
  const patch = document.createElement('canvas');
  const pctx = patch.getContext('2d')!;

  const frames: HTMLCanvasElement[] = [];
  const delays: number[] = [];
  for (const f of parsed) {
    const { left, top, width: w, height: h } = f.dims;
    const before = f.disposalType === 3 ? sctx.getImageData(0, 0, width, height) : null;

    patch.width = w;
    patch.height = h;
    pctx.putImageData(new ImageData(new Uint8ClampedArray(f.patch), w, h), 0, 0);
    sctx.drawImage(patch, left, top);

    const out = document.createElement('canvas');
    out.width = width;
    out.height = height;
    out.getContext('2d')!.drawImage(screen, 0, 0);
    frames.push(out);
    delays.push(f.delay || 100);

    // 다음 프레임 전에 지우기 방식(disposal) 적용
    if (f.disposalType === 2) sctx.clearRect(left, top, w, h);
    else if (before) sctx.putImageData(before, 0, 0);
  }
  return { width, height, frames, delays, duration: delays.reduce((a, b) => a + b, 0) };
}

/** 재생 시각(ms)에 해당하는 프레임 */
export function gifFrameAt(anim: GifAnim, timeMs: number): HTMLCanvasElement {
  let t = timeMs % anim.duration;
  for (let i = 0; i < anim.frames.length; i++) {
    t -= anim.delays[i];
    if (t < 0) return anim.frames[i];
  }
  return anim.frames[anim.frames.length - 1];
}
