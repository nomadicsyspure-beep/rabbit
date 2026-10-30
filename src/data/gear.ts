import type { SkillId } from './skills';
import type { MatId } from './world';

// 장비: 무기 / 모자 / 장신구. 재료 + 골드로 만들고 +15까지 강화한다.
// 그림이 생기기 전까지 아이콘은 임시 글자.

export type GearSlot = 'weapon' | 'hat' | 'acc';
export type AccEffect = 'magnet' | 'chest' | 'combo' | 'fever' | 'gold' | 'crit';

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
  /** 장신구 효과와 기본값 */
  effect?: AccEffect;
  value?: number;
  desc: string;
}

export const GEAR_MAX = 15;

export const GEAR: GearDef[] = [
  // 무기
  { id: 'staff_feather', slot: 'weapon', name: '깃털 지팡이', icon: '🪄', mat: 'feather', matCost: 8, goldCost: 200, atk: 0.1, bonusSkill: 'feather', desc: '깃털이 한 줄기 더' },
  { id: 'rod_fire', slot: 'weapon', name: '불꽃 막대', icon: '🔥', mat: 'spore', matCost: 10, goldCost: 800, atk: 0.15, bonusSkill: 'fire', desc: '화염구가 저절로' },
  { id: 'fan_thunder', slot: 'weapon', name: '번개 부채', icon: '⚡', mat: 'ice', matCost: 12, goldCost: 3000, atk: 0.2, bonusSkill: 'chain', desc: '번개 연쇄가 저절로' },
  { id: 'wand_star', slot: 'weapon', name: '별의 지팡이', icon: '🌟', mat: 'lava', matCost: 14, goldCost: 12000, atk: 0.25, bonusSkill: 'meteor', desc: '별똥별이 저절로' },
  { id: 'scythe_dark', slot: 'weapon', name: '어둠의 낫', icon: '🌙', mat: 'shadow', matCost: 16, goldCost: 50000, atk: 0.3, bonusSkill: 'blackhole', desc: '블랙홀이 저절로' },
  { id: 'sword_demon', slot: 'weapon', name: '마왕의 검', icon: '🗡️', mat: 'shadow', matCost: 30, goldCost: 200000, essence: 10, atk: 0.6, bonusSkill: 'pillar', desc: '전설: 빛의 기둥이 저절로' },
  // 모자
  { id: 'hat_straw', slot: 'hat', name: '밀짚모자', icon: '👒', mat: 'feather', matCost: 6, goldCost: 150, hp: 0.15, desc: '체력' },
  { id: 'hat_mush', slot: 'hat', name: '버섯 모자', icon: '🍄', mat: 'spore', matCost: 8, goldCost: 600, hp: 0.25, desc: '체력' },
  { id: 'hat_ice', slot: 'hat', name: '얼음 왕관', icon: '👑', mat: 'ice', matCost: 10, goldCost: 2500, hp: 0.35, desc: '체력' },
  { id: 'hat_fire', slot: 'hat', name: '불꽃 투구', icon: '⛑️', mat: 'lava', matCost: 12, goldCost: 10000, hp: 0.45, desc: '체력' },
  { id: 'hat_demon', slot: 'hat', name: '마왕의 왕관', icon: '😈', mat: 'shadow', matCost: 25, goldCost: 150000, essence: 8, hp: 0.9, desc: '전설: 체력' },
  // 장신구
  { id: 'acc_magnet', slot: 'acc', name: '자석 목걸이', icon: '🧲', mat: 'feather', matCost: 6, goldCost: 300, effect: 'magnet', value: 0.6, desc: '보석 끌어오는 범위' },
  { id: 'acc_clover', slot: 'acc', name: '네잎클로버', icon: '🍀', mat: 'spore', matCost: 8, goldCost: 1000, effect: 'chest', value: 0.12, desc: '좋은 상자 확률' },
  { id: 'acc_watch', slot: 'acc', name: '콤보 시계', icon: '⏱️', mat: 'ice', matCost: 10, goldCost: 4000, effect: 'combo', value: 1, desc: '콤보 유지 시간(초)' },
  { id: 'acc_eye', slot: 'acc', name: '매의 눈', icon: '🦅', mat: 'ice', matCost: 12, goldCost: 6000, effect: 'crit', value: 0.08, desc: '치명타 확률' },
  { id: 'acc_charm', slot: 'acc', name: '피버 부적', icon: '🧧', mat: 'lava', matCost: 12, goldCost: 15000, effect: 'fever', value: 0.3, desc: '피버 게이지 차는 속도' },
  { id: 'acc_coin', slot: 'acc', name: '황금 동전', icon: '🪙', mat: 'shadow', matCost: 14, goldCost: 60000, effect: 'gold', value: 0.4, desc: '골드' },
];

export const GEAR_BY_ID = Object.fromEntries(GEAR.map((g) => [g.id, g])) as Record<string, GearDef>;
export const SLOT_NAMES: Record<GearSlot, string> = { weapon: '무기', hat: '모자', acc: '장신구' };

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
