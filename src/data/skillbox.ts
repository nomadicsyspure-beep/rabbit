import { idleGoldPerSec } from './balance';
import { DIAMOND_OVERRIDE } from './shop';
import { SKILLS, SKILL_GRADE, type Grade, type SkillDef } from './skills';

// 스킬은 상자를 까서 얻는다. 상자마다 등급 확률이 다르고, 비싼 상자에서만 S급이 나온다.
// 이미 가진 스킬이 나오면 그 스킬 피해 +1 (피해가 최대면 골드로 돌려준다).

export type BoxId = 'wood' | 'silver' | 'gold' | 'legend';

export interface BoxDef {
  id: BoxId;
  name: string;
  icon: string;
  /** 등급별 확률 (%) — 합 100 */
  odds: Partial<Record<Grade, number>>;
  /** 골드 상자: 방치 수입 몇 초어치 (최고 스테이지 따라 오른다) */
  goldSec?: number;
  /** 다이아 상자: 1회 값 (10회는 9배) */
  diamonds?: number;
  /** 스킬북 1권 = 이 상자 1회 */
  book?: boolean;
}

export const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];

export const SKILL_BOXES: BoxDef[] = [
  { id: 'wood', name: '나무 상자', icon: '📦', goldSec: 300, odds: { B: 10, C: 35, D: 55 } },
  { id: 'silver', name: '은 상자', icon: '🎁', diamonds: 30, book: true, odds: { A: 10, B: 30, C: 40, D: 20 } },
  { id: 'gold', name: '금 상자', icon: '💛', diamonds: 100, odds: { S: 7, A: 28, B: 45, C: 20 } },
  { id: 'legend', name: '전설 상자', icon: '💜', diamonds: 300, odds: { S: 25, A: 50, B: 25 } },
];

export const BOX_BY_ID = Object.fromEntries(SKILL_BOXES.map((b) => [b.id, b])) as Record<BoxId, BoxDef>;

/** 상자 n회 값. 골드 상자는 { gold }, 다이아 상자는 { diamonds } */
export function boxCost(box: BoxDef, n: 1 | 10, maxStage: number): { gold?: number; diamonds?: number } {
  const mult = n === 1 ? 1 : 9;
  if (box.goldSec) return { gold: Math.max(500, Math.round(idleGoldPerSec(maxStage) * box.goldSec)) * mult };
  return { diamonds: (DIAMOND_OVERRIDE ?? box.diamonds!) * mult };
}

/** 등급 고르고 → 그 등급 스킬 중 하나 */
export function rollBox(box: BoxDef): SkillDef {
  let r = Math.random() * 100;
  let grade: Grade = 'D';
  for (const g of GRADES) {
    const p = box.odds[g] ?? 0;
    if (p <= 0) continue;
    grade = g;
    r -= p;
    if (r <= 0) break;
  }
  const pool = SKILLS.filter((s) => SKILL_GRADE[s.id] === grade);
  return pool[Math.floor(Math.random() * pool.length)];
}

/** 이 등급 스킬이 나오는 상자들 (확률 높은 순) */
export const boxesFor = (grade: Grade) =>
  SKILL_BOXES.filter((b) => (b.odds[grade] ?? 0) > 0).sort((a, b) => (b.odds[grade] ?? 0) - (a.odds[grade] ?? 0));

export const oddsText = (box: BoxDef) =>
  GRADES.filter((g) => box.odds[g]).map((g) => `${g} ${box.odds[g]}%`).join(' · ');
