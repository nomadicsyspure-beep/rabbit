import type { Game } from '../game';

// 새 버전 확인: GitHub Pages는 index.html을 몇 분 동안 캐시해서, 새로고침해도 예전 버전이 뜰 수 있다.
// 그래서 index.html을 캐시 없이 다시 받아 지금 쓰는 스크립트 파일 이름(빌드마다 바뀜)과 비교하고,
// 다르면 저장한 뒤 다시 불러온다. 스테이지 중에는 기다렸다가 방치 화면으로 돌아오면.

const CHECK_MS = 60_000;

function currentScript() {
  const el = document.querySelector<HTMLScriptElement>('script[type="module"][src*="assets/index-"]');
  return el ? new URL(el.src, location.href).pathname.split('/').pop() ?? null : null;
}

async function latestScript() {
  const res = await fetch(`./index.html?v=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) return null;
  const m = (await res.text()).match(/assets\/(index-[^"']+\.js)/);
  return m ? m[1] : null;
}

export function watchForUpdates(game: Game) {
  const mine = currentScript();
  // 개발 서버(dev)에서는 파일 이름이 고정이라 하지 않는다
  if (!mine) return;
  let pending = false;
  // 방치 화면이고 열린 창이 없을 때만 (상자 여는 중 등은 기다린다)
  const calm = () => game.mode === 'idle' && !document.querySelector('.modal');
  const reload = () => {
    game.persist();
    location.reload();
  };
  const check = async () => {
    if (pending) {
      if (calm()) reload();
      return;
    }
    try {
      const latest = await latestScript();
      if (!latest || latest === mine) return;
      pending = true;
      if (calm()) reload();
      else game.ui.toast('새 버전이 있어요: 스테이지가 끝나면 업데이트돼요');
    } catch {
      // 오프라인 등: 다음에 다시
    }
  };
  setTimeout(check, 3000);
  setInterval(check, CHECK_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check();
  });
}
