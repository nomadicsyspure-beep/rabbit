import type { SkillId } from './skills';
import type { MatId } from './world';

// 장비: 무기 / 모자 / 등 / 장신구. 재료 + 골드로 만들고 +15까지 강화한다.
// 무기·모자·등은 병아리 몸에 보인다 (무기는 옆에 둥둥, 모자는 머리 위, 등은 몸 뒤).
// 그림이 생기기 전까지 아이콘은 임시 글자, 등 장비는 코드로 그린 모양.

export type GearSlot = 'weapon' | 'hat' | 'back' | 'acc';
export type AccEffect = 'magnet' | 'chest' | 'combo' | 'fever' | 'gold' | 'crit' | 'speed';
/** 등 장비 임시 모양 (그림이 오기 전) */
export type BackShape = 'wings' | 'cape' | 'bag';

export interface GearDef {
  id: string;
  slot: GearSlot;
  name: string;
  icon: string;
  /** 만드는 재료 (지역 재료) */
  mat: MatId;
  matCost: number;
  goldCost: number;
  /** 보스의 정수가 필요한 전설 장비 */
  essence?: number;
  /** 무기: 공격력 +%, 공짜로 같이 나가는 스킬 (장착 칸을 안 쓴다, 이 스킬은 스킬북 없이 배울 수 있다) */
  atk?: number;
  bonusSkill?: SkillId;
  /** 모자: 체력 +% */
  hp?: number;
  /** 장신구·등 장비 효과와 기본값 */
  effect?: AccEffect;
  /** 등 장비 임시 모양과 색 */
  shape?: BackShape;
  color?: string;
  value?: number;
  desc: string;
}

export const GEAR_MAX = 15;

export const GEAR: GearDef[] = [
  // 무기
  { id: 'staff_feather', slot: 'weapon', name: '깃털 지팡이', icon: '🪄', mat: 'feather', matCost: 12, goldCost: 400, atk: 0.1, bonusSkill: 'feather', desc: '깃털이 한 줄기 더' },
  { id: 'rod_fire', slot: 'weapon', name: '불꽃 막대', icon: '🔥', mat: 'spore', matCost: 15, goldCost: 1600, atk: 0.15, bonusSkill: 'fire', desc: '화염구가 저절로' },
  { id: 'fan_thunder', slot: 'weapon', name: '번개 부채', icon: '⚡', mat: 'ice', matCost: 18, goldCost: 6000, atk: 0.2, bonusSkill: 'chain', desc: '번개 연쇄가 저절로' },
  { id: 'wand_star', slot: 'weapon', name: '별의 지팡이', icon: '🌟', mat: 'lava', matCost: 21, goldCost: 24000, atk: 0.25, bonusSkill: 'meteor', desc: '별똥별이 저절로' },
  { id: 'scythe_dark', slot: 'weapon', name: '어둠의 낫', icon: '🌙', mat: 'shadow', matCost: 24, goldCost: 100000, atk: 0.3, bonusSkill: 'blackhole', desc: '블랙홀이 저절로' },
  { id: 'sword_demon', slot: 'weapon', name: '마왕의 검', icon: '🗡️', mat: 'shadow', matCost: 45, goldCost: 400000, essence: 10, atk: 0.6, bonusSkill: 'pillar', desc: '전설: 빛의 기둥이 저절로' },
  // 모자
  { id: 'hat_straw', slot: 'hat', name: '밀짚모자', icon: '👒', mat: 'feather', matCost: 9, goldCost: 300, hp: 0.15, desc: '체력' },
  { id: 'hat_mush', slot: 'hat', name: '버섯 모자', icon: '🍄', mat: 'spore', matCost: 12, goldCost: 1200, hp: 0.25, desc: '체력' },
  { id: 'hat_ice', slot: 'hat', name: '얼음 왕관', icon: '👑', mat: 'ice', matCost: 15, goldCost: 5000, hp: 0.35, desc: '체력' },
  { id: 'hat_fire', slot: 'hat', name: '불꽃 투구', icon: '⛑️', mat: 'lava', matCost: 18, goldCost: 20000, hp: 0.45, desc: '체력' },
  { id: 'hat_demon', slot: 'hat', name: '마왕의 왕관', icon: '😈', mat: 'shadow', matCost: 38, goldCost: 300000, essence: 8, hp: 0.9, desc: '전설: 체력' },
  // 등
  { id: 'bag_leather', slot: 'back', name: '가죽 가방', icon: '🎒', mat: 'feather', matCost: 9, goldCost: 400, effect: 'gold', value: 0.15, shape: 'bag', color: '#9a6a3a', desc: '골드' },
  { id: 'cape_red', slot: 'back', name: '빨간 망토', icon: '🧣', mat: 'spore', matCost: 12, goldCost: 1600, effect: 'speed', value: 0.08, shape: 'cape', color: '#d8433a', desc: '이동 속도' },
  { id: 'wings_bat', slot: 'back', name: '박쥐 날개', icon: '🦇', mat: 'ice', matCost: 15, goldCost: 7000, effect: 'crit', value: 0.06, shape: 'wings', color: '#6a4a9a', desc: '치명타 확률' },
  { id: 'wings_angel', slot: 'back', name: '천사 날개', icon: '🕊️', mat: 'lava', matCost: 18, goldCost: 24000, effect: 'speed', value: 0.14, shape: 'wings', color: '#f4f4ff', desc: '이동 속도' },
  { id: 'cape_demon', slot: 'back', name: '마왕의 망토', icon: '🦹', mat: 'shadow', matCost: 38, goldCost: 300000, essence: 6, effect: 'fever', value: 0.6, shape: 'cape', color: '#3a1a4a', desc: '전설: 피버 게이지 차는 속도' },
  // 장신구
  { id: 'acc_magnet', slot: 'acc', name: '자석 목걸이', icon: '🧲', mat: 'feather', matCost: 9, goldCost: 600, effect: 'magnet', value: 0.6, desc: '보석 끌어오는 범위' },
  { id: 'acc_clover', slot: 'acc', name: '네잎클로버', icon: '🍀', mat: 'spore', matCost: 12, goldCost: 2000, effect: 'chest', value: 0.12, desc: '좋은 상자 확률' },
  { id: 'acc_watch', slot: 'acc', name: '콤보 시계', icon: '⏱️', mat: 'ice', matCost: 15, goldCost: 8000, effect: 'combo', value: 1, desc: '콤보 유지 시간(초)' },
  { id: 'acc_eye', slot: 'acc', name: '매의 눈', icon: '🦅', mat: 'ice', matCost: 18, goldCost: 12000, effect: 'crit', value: 0.08, desc: '치명타 확률' },
  { id: 'acc_charm', slot: 'acc', name: '피버 부적', icon: '🧧', mat: 'lava', matCost: 18, goldCost: 30000, effect: 'fever', value: 0.3, desc: '피버 게이지 차는 속도' },
  { id: 'acc_coin', slot: 'acc', name: '황금 동전', icon: '🪙', mat: 'shadow', matCost: 21, goldCost: 120000, effect: 'gold', value: 0.4, desc: '골드' },
];

export const GEAR_BY_ID = Object.fromEntries(GEAR.map((g) => [g.id, g])) as Record<string, GearDef>;
export const SLOT_NAMES: Record<GearSlot, string> = { weapon: '무기 (옆에 둥둥)', hat: '모자', back: '등', acc: '장신구' };

/** 강화 단계에 따른 효과 배율 (+1마다 15%) */
export const gearScale = (plus: number) => 1 + 0.15 * plus;

/** 강화 비용 (plus → plus+1) */
export function enhanceCost(def: GearDef, plus: number) {
  return {
    mat: Math.ceil(def.matCost * 0.5 * (1 + plus * 0.6)),
    gold: def.goldCost * 0.6 * Math.pow(1.45, plus),
    essence: def.essence ? Math.ceil(plus / 5) : 0,
  };
}

/** 장비 한 줄 효과 글 */
export function gearEffectText(def: GearDef, plus: number) {
  const k = gearScale(plus);
  const pct = (v: number) => `${Math.round(v * k * 100)}%`;
  if (def.slot === 'weapon') return `공격력 +${pct(def.atk!)} · ${def.desc}`;
  if (def.slot === 'hat') return `체력 +${pct(def.hp!)}`;
  if (def.effect === 'combo') return `${def.desc} +${(def.value! * k).toFixed(1)}`;
  return `${def.desc} +${pct(def.value!)}`;
}
