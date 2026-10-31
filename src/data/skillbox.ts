import { idleGoldPerSec } from './balance';
import { DIAMOND_OVERRIDE } from './shop';
import { SKILLS, SKILL_GRADE, type Grade, type SkillDef, type SkillType } from './skills';

// 스킬은 상자를 까서 얻는다. 상자마다 등급 확률이 다르고, S급은 비싼 상자일수록 잘 나온다 (나무 0.1% · 은 1% · 금 7% · 전설 25%), 나무 상자도 A 1%.
// 이미 가진 스킬이 나오면 그 스킬의 스킬 포인트 +1 (다 찍을 만큼 모았으면 골드).

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
  { id: 'wood', name: '나무 상자', icon: '📦', goldSec: 600, odds: { S: 0.1, A: 1, B: 10, C: 35, D: 53.9 } },
  { id: 'silver', name: '은 상자', icon: '🎁', diamonds: 40, book: true, odds: { S: 1, A: 10, B: 30, C: 40, D: 19 } },
  { id: 'gold', name: '금 상자', icon: '💛', diamonds: 150, odds: { S: 7, A: 28, B: 45, C: 20 } },
  { id: 'legend', name: '전설 상자', icon: '💜', diamonds: 450, odds: { S: 25, A: 50, B: 25 } },
];

export const BOX_BY_ID = Object.fromEntries(SKILL_BOXES.map((b) => [b.id, b])) as Record<BoxId, BoxDef>;

/** 상자 n회 값. 골드 상자는 { gold }, 다이아 상자는 { diamonds } */
export function boxCost(box: BoxDef, n: 1 | 10, maxStage: number): { gold?: number; diamonds?: number } {
  const mult = n === 1 ? 1 : 9;
  if (box.goldSec) return { gold: Math.max(1000, Math.round(idleGoldPerSec(maxStage) * box.goldSec)) * mult };
  return { diamonds: (DIAMOND_OVERRIDE ?? box.diamonds!) * mult };
}

/** 등급 고르고 → 그 등급 스킬 중 하나 (type을 주면 그 형태에서만: 튜토리얼 상자는 공격형) */
export function rollBox(box: BoxDef, type?: SkillType): SkillDef {
  let r = Math.random() * 100;
  let grade: Grade = 'D';
  for (const g of GRADES) {
    const p = box.odds[g] ?? 0;
    if (p <= 0) continue;
    grade = g;
    r -= p;
    if (r <= 0) break;
  }
  const pool = SKILLS.filter((s) => SKILL_GRADE[s.id] === grade && (!type || s.type === type));
  return pool[Math.floor(Math.random() * pool.length)];
}

/** 이 등급 스킬이 나오는 상자들 (확률 높은 순) */
export const boxesFor = (grade: Grade) =>
  SKILL_BOXES.filter((b) => (b.odds[grade] ?? 0) > 0).sort((a, b) => (b.odds[grade] ?? 0) - (a.odds[grade] ?? 0));

export const oddsText = (box: BoxDef) =>
  GRADES.filter((g) => box.odds[g]).map((g) => `${g} ${box.odds[g]}%`).join(' · ');
