const BASE_SUFFIX = ['', 'K', 'M', 'B', 'T'];

function suffix(tier: number): string {
  if (tier < BASE_SUFFIX.length) return BASE_SUFFIX[tier];
  // T 다음부터 aa, ab, ... zz (탭타이탄 표기 방식)
  const i = tier - BASE_SUFFIX.length;
  const a = String.fromCharCode(97 + (Math.floor(i / 26) % 26));
  const b = String.fromCharCode(97 + (i % 26));
  return a + b;
}

/** 방치형 큰 수 표기: 999, 1.23K, 45.6M, 7.89aa */
export function fmt(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  if (n < 0) return '-' + fmt(-n);
  if (n < 1000) return n < 10 && n % 1 !== 0 ? n.toFixed(1) : Math.floor(n).toString();
  let tier = Math.floor(Math.log10(n) / 3);
  let scaled = n / Math.pow(10, tier * 3);
  if (scaled >= 999.5) {
    tier++;
    scaled /= 1000;
  }
  const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
  return scaled.toFixed(digits) + suffix(tier);
}

export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}시간 ${m % 60}분`;
  if (m > 0) return `${m}분`;
  return `${Math.floor(sec)}초`;
}
