// 프레임 애니메이션. 프레임을 가로로 이어 붙인 PNG 한 장(정사각형 프레임 × N)을 잘라서 캔버스에서 직접 재생한다.
// 원본 GIF는 tools/chick_frames.py가 배경 찌꺼기를 지우고 이 형식으로 바꿔 둔다.

export interface Anim {
  frames: HTMLCanvasElement[];
  /** 프레임 한 장 표시 시간(ms) */
  frameMs: number;
}

/**
 * 그림 불러오기. img.decode()는 아이폰 사파리 등에서 가끔 실패해서 onload로 기다리고,
 * 실패하면 잠깐 쉬었다 몇 번 더 시도한다.
 */
export function loadImage(url: string, tries = 4): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const attempt = (left: number) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => (left > 1 ? setTimeout(() => attempt(left - 1), 400) : reject(new Error(`load failed: ${url}`)));
      img.src = url;
    };
    attempt(tries);
  });
}

/** 프레임 띠 PNG를 불러와 프레임으로 자른다. 프레임 크기는 이미지 높이와 같은 정사각형. */
export async function loadStrip(url: string, frameMs: number): Promise<Anim> {
  const img = await loadImage(url);
  const size = img.naturalHeight;
  const count = Math.max(1, Math.round(img.naturalWidth / size));

  const frames: HTMLCanvasElement[] = [];
  for (let i = 0; i < count; i++) {
    const out = document.createElement('canvas');
    out.width = size;
    out.height = size;
    out.getContext('2d')!.drawImage(img, i * size, 0, size, size, 0, 0, size, size);
    frames.push(out);
  }
  return { frames, frameMs };
}

/** 재생 시각(ms)에 해당하는 프레임 */
export function frameAt(anim: Anim, timeMs: number): HTMLCanvasElement {
  const i = Math.floor(timeMs / anim.frameMs) % anim.frames.length;
  return anim.frames[i];
}
