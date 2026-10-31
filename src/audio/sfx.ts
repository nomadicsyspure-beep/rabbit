// 효과음: 소리 파일 없이 Web Audio로 그 자리에서 만든다.
// 브라우저는 사용자가 한 번 터치한 뒤에야 소리를 낼 수 있어서, 첫 터치 때 켠다.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
/** 방치 화면에선 전투 소리를 끈다 (계속 울리면 시끄럽다) */
let combat = false;
const last: Record<string, number> = {};

function audio() {
  if (!enabled) return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.18;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** 같은 소리가 너무 자주 겹치지 않게 (ms) */
function throttle(key: string, ms: number) {
  const now = performance.now();
  if (now - (last[key] ?? 0) < ms) return false;
  last[key] = now;
  return true;
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0) {
  const a = audio();
  if (!a || !master) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol: number, lowpass: number) {
  const a = audio();
  if (!a || !master) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = lowpass;
  const g = a.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start();
}

export const sfx = {
  /** 첫 터치 때 부른다 */
  unlock() {
    audio();
  },
  setEnabled(on: boolean) {
    enabled = on;
    if (!on && ctx) void ctx.suspend();
  },
  setCombat(on: boolean) {
    combat = on;
  },
  hit() {
    if (combat && throttle('hit', 40)) tone(900 + Math.random() * 200, 0.04, 'square', 0.05);
  },
  /** 콤보가 오를수록 음이 올라간다 (100마다 다시 낮아짐) */
  kill(combo: number) {
    if (!combat || !throttle('kill', 35)) return;
    const step = combo % 100;
    tone(320 + step * 9, 0.07, 'triangle', 0.12, 520 + step * 12);
  },
  gem() {
    if (combat && throttle('gem', 50)) tone(1200, 0.06, 'sine', 0.06, 1800);
  },
  boom() {
    if (!combat || !throttle('boom', 90)) return;
    noise(0.25, 0.35, 900);
    tone(120, 0.2, 'sine', 0.25, 50);
  },
  crit() {
    if (combat && throttle('crit', 60)) tone(1500, 0.05, 'square', 0.06, 2200);
  },
  fever() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'square', 0.12, undefined, i * 0.08));
  },
  levelUp() {
    [659, 880, 1175].forEach((f, i) => tone(f, 0.15, 'triangle', 0.14, undefined, i * 0.07));
  },
  chest() {
    tone(440, 0.08, 'square', 0.1, 880);
    tone(1320, 0.25, 'triangle', 0.1, undefined, 0.08);
  },
  coin() {
    if (throttle('coin', 60)) {
      tone(988, 0.06, 'square', 0.08);
      tone(1319, 0.12, 'square', 0.08, undefined, 0.06);
    }
  },
  /** 버튼 누름: 짧고 또렷한 '톡' */
  click() {
    if (!throttle('click', 40)) return;
    tone(880, 0.035, 'triangle', 0.12);
    tone(1320, 0.03, 'sine', 0.06, undefined, 0.015);
  },
};
