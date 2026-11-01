// 앱으로 설치(홈 화면에 추가).
// 안드로이드 크롬 등: 브라우저가 주는 설치 창(beforeinstallprompt)을 잡아 뒀다가 버튼을 누르면 띄운다.
// 아이폰 사파리: 설치 창이 없어서 '공유 → 홈 화면에 추가' 방법을 보여 준다.

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners: (() => void)[] = [];

/** 이미 앱으로 열려 있나 (홈 화면에서 실행) */
export function isInstalled() {
  return window.matchMedia('(display-mode: fullscreen)').matches
    || window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** 버튼 한 번으로 설치 창을 띄울 수 있나 */
export const canPrompt = () => deferred !== null;

/** 설치 상태가 바뀌면 (버튼 다시 그리기) */
export function onInstallChange(fn: () => void) {
  listeners.push(fn);
}

export function setupInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    listeners.forEach((f) => f());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((f) => f());
  });
  // 서비스 워커: 개발 서버에선 안 쓴다
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
    });
  }
}

/** 설치 창 띄우기. 결과: accepted / dismissed / unavailable */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable';
  const ev = deferred;
  deferred = null;
  await ev.prompt();
  const choice = await ev.userChoice;
  listeners.forEach((f) => f());
  return choice.outcome;
}
