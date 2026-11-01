import { isBossStage, playerPower, recommendedHp, recommendedPower, stageEase, type PlayerStats } from './balance';
import type { Grade } from './skills';

// 전투력 · 스카우터.
// 전투력 = (공격 점수 ^ 0.6) × (체력 ^ 0.4) × 10
//   공격 점수 = 공격력 × 공격 속도 × 스킬 배율 (공격력·체력에는 레벨·유물·도감·환생·동료가 이미 들어 있다)
//   스킬 배율 = 장착 스킬마다 등급 가중치 × (1 + 7% × (스킬 Lv − 1)) 의 합 ÷ 기준값, 유물 공짜 스킬은 반 칸
// 권장 전투력 = 그 스테이지 몹 기준 공격·체력(액션 모드 배율의 1배)과 그 스테이지쯤의 평범한 스킬 구성으로 낸 같은 식 × 콘텐츠 배율.
// 내 전투력 ÷ 권장 전투력으로 여유 · 적정 · 도전 · 위험을 붙인다 (대충 맞추는 지표).

export const GRADE_WEIGHT: Record<Grade, number> = { S: 1.6, A: 1.35, B: 1.15, C: 1, D: 0.85 };
const SKILL_NORM = 2.4;
const SKILL_LV_STEP = 0.07;

/** 장착 스킬 하나의 값 */
const slotValue = (grade: Grade, lv: number) => GRADE_WEIGHT[grade] * (1 + SKILL_LV_STEP * (lv - 1));

/** 스킬 배율: 장착 스킬(등급·Lv) + 유물 공짜 스킬 수 */
export function skillFactor(slots: { grade: Grade; lv: number }[], freeSkills = 0) {
  const sum = slots.reduce((n, s) => n + slotValue(s.grade, s.lv), 0) + 0.5 * freeSkills;
  return Math.max(0.4, sum / SKILL_NORM);
}

/** 권장 스킬 Lv (장착 스킬 평균): 스테이지 3개마다 대략 1씩 */
export const recSkillLevel = (stage: number) => Math.max(1, Math.round(1 + stage * 0.3));
/** 그 스테이지쯤의 평범한 장착 수 (스테이지 5마다 한 칸, 최대 4) */
const recSkillCount = (stage: number) => Math.min(4, 1 + Math.floor(stage / 5));
/** 권장 스킬 배율: C급 스킬을 권장 Lv으로 평범한 수만큼 */
export const recSkillFactor = (stage: number) =>
  skillFactor(Array.from({ length: recSkillCount(stage) }, () => ({ grade: 'C' as Grade, lv: recSkillLevel(stage) })));

export const cpOf = (atkScore: number, hp: number) => Math.round(Math.pow(Math.max(1, atkScore), 0.6) * Math.pow(Math.max(1, hp), 0.4) * 10);

/** 내 전투력 */
export function myPower(st: PlayerStats, skill: number) {
  return cpOf(playerPower(st) * skill, st.hp);
}

/** 콘텐츠 종류 (권장 전투력 배율) */
export type ScoutKind = 'stage' | 'material' | 'raid' | 'infinite' | 'arena' | 'scroll';

/** 권장 전투력: 스테이지 기준 × 콘텐츠 배율. eased = 초반 쉬움 배율을 받는 판(스테이지·아레나·스크롤) */
export function recPower(stage: number, mul = 1, eased = false) {
  const boss = isBossStage(stage) ? 1.25 : 1;
  const ease = eased ? stageEase(stage) : 1;
  return Math.round(cpOf(recommendedPower(stage) * recSkillFactor(stage), recommendedHp(stage)) * boss * mul * ease);
}

export interface Verdict {
  label: string;
  color: string;
  /** 내 ÷ 권장 */
  ratio: number;
}

export function verdict(mine: number, rec: number): Verdict {
  const ratio = mine / Math.max(1, rec);
  if (ratio >= 1.3) return { label: '여유', color: '#7cf2a0', ratio };
  if (ratio >= 0.95) return { label: '적정', color: '#ffd23f', ratio };
  if (ratio >= 0.7) return { label: '도전', color: '#ffa04a', ratio };
  return { label: '위험', color: '#ff5c6c', ratio };
}
