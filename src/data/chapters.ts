import type { EnemyLook } from '../battle/engine';
import { chapterOf, subOf } from './balance';

// 장(챕터) 보스와 정예. 장마다 색과 패턴이 다르다 (그림은 나중에 보스마다 바꾼다. 지금은 색만).
// 패턴 번호 (battle/engine.ts updateRaidBoss):
//   0 장판 · 1 나선 탄막 · 2 돌진 · 3 졸개 소환 · 4 사방 이중 탄막 · 5 조준 산탄 · 6 회전 십자 · 7 레이저 길 · 8 탄막 비

/** X-1·X-2: 이만큼 버티면 정예 / X-3: 이만큼 버티면 장 보스 */
export const STAGE_SECONDS = 40;
export const BOSS_STAGE_SECONDS = 30;
/** 1-1은 맛보기로 짧게 */
export const FIRST_STAGE_SECONDS = 25;

export interface ChapterBoss {
  name: string;
  skin: EnemyLook;
  pats: number[];
  minion: EnemyLook;
  /** 패턴 세기 0~1 */
  heat: number;
  hp: number;
  dmg: number;
  speed: number;
  r: number;
}

const COLORS: [string, number][] = [
  ['붉은', 0], ['푸른', 200], ['초록', 110], ['보라', 270], ['황금', 45],
  ['분홍', 320], ['청록', 165], ['주황', 25], ['남색', 235], ['연두', 80],
];

/** 장마다 보스 패턴 (앞쪽 장은 직접 고르고, 그 뒤는 섞어서) */
const BOSS_PATS: number[][] = [
  [5, 0, 2],
  [1, 5, 3, 2],
  [6, 0, 5, 2],
  [7, 4, 5, 3],
  [8, 7, 1, 2],
  [6, 7, 5, 0, 3],
  [8, 4, 7, 2, 5],
];
const PAT_POOL = [0, 1, 2, 3, 4, 5, 6, 7, 8];

/** 장 번호로 늘 같은 섞기 */
function seeded(ch: number) {
  let x = ch * 9301 + 49297;
  return () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  };
}

/** 장 보스 기본 체력·피해 (액션 모드 고정 수치: 내 힘은 권장 전투력 배율로 따로 들어온다) */
const BOSS_HP = 4500;
const BOSS_DMG = 34;
const ELITE_HP = 1300;
const ELITE_DMG = 26;
/** 1장은 처음 하는 사람용으로 보스·정예 체력을 조금 낮춘다 */
const FIRST_CHAPTER = 0.7;

export function chapterBoss(stage: number): ChapterBoss {
  const ch = chapterOf(stage);
  const [color, hue] = COLORS[(ch - 1) % COLORS.length];
  let pats = BOSS_PATS[ch - 1];
  if (!pats) {
    const rnd = seeded(ch);
    const pool = [...PAT_POOL];
    pats = [];
    // 늘 레이저 길이나 탄막 비 하나는 들어간다
    pats.push(rnd() < 0.5 ? 7 : 8);
    while (pats.length < 5) {
      const p = pool[Math.floor(rnd() * pool.length)];
      if (!pats.includes(p)) pats.push(p);
    }
  }
  const heat = Math.min(1, (ch - 1) / 10);
  return {
    name: `${ch}장 보스 · ${color} 마왕`,
    skin: hue ? `devil@${hue}` : 'devil',
    pats,
    minion: hue ? `bat@${hue}` : 'bat',
    heat,
    hp: BOSS_HP * (1 + 0.06 * (ch - 1)) * (ch === 1 ? FIRST_CHAPTER : 1),
    dmg: BOSS_DMG * (ch === 1 ? 0.8 : 1),
    speed: 46 + Math.min(20, ch * 2),
    r: 34,
  };
}

/** X-1·X-2 끝에 나오는 정예: 패턴 두세 개 */
export function chapterElite(stage: number): ChapterBoss {
  const ch = chapterOf(stage);
  const sub = subOf(stage);
  const [color, hue] = COLORS[(ch + sub) % COLORS.length];
  const sets = [[5, 2], [0, 4], [1, 2], [5, 0], [6, 2], [7, 5], [4, 3]];
  const pats = sets[(ch * 2 + sub) % sets.length];
  return {
    name: `${color} 정예 토끼`,
    skin: hue ? `rabbit@${hue}` : 'rabbit',
    pats: ch >= 3 ? [...pats, sets[(ch + sub * 3) % sets.length][0]] : pats,
    minion: 'bat',
    heat: Math.min(0.8, (ch - 1) / 12),
    hp: ELITE_HP * (1 + 0.05 * (ch - 1)) * (sub === 2 ? 1.15 : 1) * (ch === 1 ? FIRST_CHAPTER : 1),
    dmg: ELITE_DMG,
    speed: 58,
    r: 24,
  };
}
