import type { SkillId } from './skills';
import type { MatId } from './world';

// 장비 6칸: 무기 / 모자 / 장갑 / 신발 / 가방 / 장신구. 재료 + 골드로 만들고 +15까지 강화한다.
// 몸에는 무기만 보인다 (옆에 둥둥). 그림이 생기기 전까지 아이콘은 임시 글자.

export type GearSlot = 'weapon' | 'hat' | 'gloves' | 'shoes' | 'bag' | 'acc';
/** 장비 칸 순서 (장비 탭: 왼쪽 3칸 · 오른쪽 3칸) */
export const GEAR_SLOTS: GearSlot[] = ['weapon', 'gloves', 'shoes', 'hat', 'bag', 'acc'];
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
  // 장갑: 치명타 확률
  { id: 'glove_cotton', slot: 'gloves', name: '면장갑', icon: '🧤', mat: 'feather', matCost: 9, goldCost: 300, effect: 'crit', value: 0.03, desc: '치명타 확률' },
  { id: 'glove_leather', slot: 'gloves', name: '가죽 장갑', icon: '🥊', mat: 'spore', matCost: 12, goldCost: 1400, effect: 'crit', value: 0.05, desc: '치명타 확률' },
  { id: 'glove_frost', slot: 'gloves', name: '서리 장갑', icon: '❄️', mat: 'ice', matCost: 15, goldCost: 5600, effect: 'crit', value: 0.07, desc: '치명타 확률' },
  { id: 'glove_flame', slot: 'gloves', name: '화염 건틀릿', icon: '🔥', mat: 'lava', matCost: 18, goldCost: 22000, effect: 'crit', value: 0.09, desc: '치명타 확률' },
  { id: 'glove_demon', slot: 'gloves', name: '마왕의 건틀릿', icon: '🖐️', mat: 'shadow', matCost: 38, goldCost: 300000, essence: 8, effect: 'crit', value: 0.18, desc: '전설: 치명타 확률' },
  // 신발: 이동 속도
  { id: 'shoe_straw', slot: 'shoes', name: '짚신', icon: '🩴', mat: 'feather', matCost: 9, goldCost: 300, effect: 'speed', value: 0.04, desc: '이동 속도' },
  { id: 'shoe_sneaker', slot: 'shoes', name: '운동화', icon: '👟', mat: 'spore', matCost: 12, goldCost: 1400, effect: 'speed', value: 0.07, desc: '이동 속도' },
  { id: 'shoe_boot', slot: 'shoes', name: '눈길 장화', icon: '🥾', mat: 'ice', matCost: 15, goldCost: 5600, effect: 'speed', value: 0.1, desc: '이동 속도' },
  { id: 'shoe_wing', slot: 'shoes', name: '날개 신발', icon: '🪽', mat: 'lava', matCost: 18, goldCost: 22000, effect: 'speed', value: 0.13, desc: '이동 속도' },
  { id: 'shoe_demon', slot: 'shoes', name: '마왕의 부츠', icon: '👢', mat: 'shadow', matCost: 38, goldCost: 300000, essence: 6, effect: 'speed', value: 0.22, desc: '전설: 이동 속도' },
  // 가방: 골드·자석·상자·피버
  { id: 'bag_leather', slot: 'bag', name: '가죽 가방', icon: '🎒', mat: 'feather', matCost: 9, goldCost: 400, effect: 'gold', value: 0.15, desc: '골드' },
  { id: 'bag_pouch', slot: 'bag', name: '보석 주머니', icon: '👝', mat: 'spore', matCost: 12, goldCost: 1600, effect: 'magnet', value: 0.6, desc: '보석 끌어오는 범위' },
  { id: 'bag_lucky', slot: 'bag', name: '행운 보따리', icon: '🛍️', mat: 'ice', matCost: 15, goldCost: 7000, effect: 'chest', value: 0.12, desc: '좋은 상자 확률' },
  { id: 'bag_gold', slot: 'bag', name: '황금 자루', icon: '💰', mat: 'lava', matCost: 18, goldCost: 24000, effect: 'gold', value: 0.3, desc: '골드' },
  { id: 'bag_demon', slot: 'bag', name: '마왕의 보물 자루', icon: '👜', mat: 'shadow', matCost: 38, goldCost: 300000, essence: 6, effect: 'fever', value: 0.6, desc: '전설: 피버 게이지 차는 속도' },
  // 장신구
  { id: 'acc_magnet', slot: 'acc', name: '자석 목걸이', icon: '🧲', mat: 'feather', matCost: 9, goldCost: 600, effect: 'magnet', value: 0.6, desc: '보석 끌어오는 범위' },
  { id: 'acc_clover', slot: 'acc', name: '네잎클로버', icon: '🍀', mat: 'spore', matCost: 12, goldCost: 2000, effect: 'chest', value: 0.12, desc: '좋은 상자 확률' },
  { id: 'acc_watch', slot: 'acc', name: '콤보 시계', icon: '⏱️', mat: 'ice', matCost: 15, goldCost: 8000, effect: 'combo', value: 1, desc: '콤보 유지 시간(초)' },
  { id: 'acc_eye', slot: 'acc', name: '매의 눈', icon: '🦅', mat: 'ice', matCost: 18, goldCost: 12000, effect: 'crit', value: 0.08, desc: '치명타 확률' },
  { id: 'acc_charm', slot: 'acc', name: '피버 부적', icon: '🧧', mat: 'lava', matCost: 18, goldCost: 30000, effect: 'fever', value: 0.3, desc: '피버 게이지 차는 속도' },
  { id: 'acc_coin', slot: 'acc', name: '황금 동전', icon: '🪙', mat: 'shadow', matCost: 21, goldCost: 120000, effect: 'gold', value: 0.4, desc: '골드' },
];

export const GEAR_BY_ID = Object.fromEntries(GEAR.map((g) => [g.id, g])) as Record<string, GearDef>;
export const SLOT_NAMES: Record<GearSlot, string> = { weapon: '무기', hat: '모자', gloves: '장갑', shoes: '신발', bag: '가방', acc: '장신구' };
/** 칸이 비었을 때 보여 줄 글자 */
export const SLOT_ICONS: Record<GearSlot, string> = { weapon: '🗡️', hat: '🎩', gloves: '🧤', shoes: '👟', bag: '🎒', acc: '💍' };

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
