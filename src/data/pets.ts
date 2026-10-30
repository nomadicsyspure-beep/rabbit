// 동료: 몬스터 그림(색을 바꾼 것 포함: 그림이름@색상)을 쓰는 작은 친구. PET_SLOTS마리까지 데리고 다니고, 소환으로 겹치면 레벨이 오른다.

export type PetAbility = 'magnet' | 'gold' | 'chest' | 'attack' | 'spore' | 'heal' | 'hp' | 'crit' | 'fever' | 'speed' | 'frost' | 'bolt' | 'shield' | 'bomb';

export interface PetDef {
  id: string;
  name: string;
  /** 몬스터 그림 이름 */
  skin: string;
  ability: PetAbility;
  /** 0 보통 / 1 희귀 / 2 전설 (소환 확률) */
  rarity: 0 | 1 | 2;
  /** 레벨 1 효과와 레벨당 증가 */
  base: number;
  per: number;
  desc: string;
}

export const PET_MAX = 10;
/** 같이 데리고 다니는 동료 수 */
export const PET_SLOTS = 3;
export const RARITY_NAMES = ['보통', '희귀', '전설'] as const;
export const RARITY_COLORS = ['#c9b79c', '#7ad7ff', '#ffd23f'] as const;

export const PETS: PetDef[] = [
  { id: 'slime', name: '말랑 슬라임', skin: 'slime', ability: 'magnet', rarity: 0, base: 0.4, per: 0.1, desc: '보석 끌어오는 범위' },
  { id: 'sprout', name: '새싹 동동', skin: 'sprout', ability: 'gold', rarity: 0, base: 0.1, per: 0.04, desc: '골드' },
  { id: 'snail', name: '느림보 달팽이', skin: 'snail', ability: 'chest', rarity: 0, base: 0.06, per: 0.015, desc: '좋은 상자 확률' },
  { id: 'bat', name: '꼬마 박쥐', skin: 'bat', ability: 'attack', rarity: 1, base: 0.8, per: 0.2, desc: '가까운 적을 콕콕 (공격력 배율)' },
  { id: 'mushroom', name: '포자 버섯', skin: 'mushroom', ability: 'spore', rarity: 1, base: 2, per: 0.5, desc: '3초마다 포자 폭발 (공격력 배율)' },
  { id: 'angel', name: '수호 천사', skin: 'angel', ability: 'heal', rarity: 1, base: 0.04, per: 0.006, desc: '5초마다 체력 회복' },
  { id: 'golem', name: '든든 골렘', skin: 'golem', ability: 'hp', rarity: 1, base: 0.2, per: 0.06, desc: '체력' },
  { id: 'rabbit', name: '토끼 기사', skin: 'rabbit', ability: 'crit', rarity: 2, base: 0.05, per: 0.01, desc: '치명타 확률' },
  { id: 'devil', name: '꼬마 마왕', skin: 'devil', ability: 'fever', rarity: 2, base: 0.3, per: 0.06, desc: '피버 게이지 차는 속도' },
  // 색 바꾼 친구들
  { id: 'slime_blue', name: '물방울 슬라임', skin: 'slime@200', ability: 'speed', rarity: 0, base: 0.05, per: 0.01, desc: '이동 속도' },
  { id: 'sprout_red', name: '단풍 동동', skin: 'sprout@10', ability: 'hp', rarity: 0, base: 0.1, per: 0.03, desc: '체력' },
  { id: 'bat_green', name: '풀잎 박쥐', skin: 'bat@110', ability: 'attack', rarity: 0, base: 0.5, per: 0.12, desc: '가까운 적을 콕콕 (공격력 배율)' },
  { id: 'mushroom_ice', name: '얼음 버섯', skin: 'mushroom@200', ability: 'frost', rarity: 1, base: 1, per: 0.25, desc: '4초마다 냉기: 주변 적 느리게 (공격력 배율)' },
  { id: 'slime_spark', name: '번개 슬라임', skin: 'slime@55', ability: 'bolt', rarity: 1, base: 0.8, per: 0.2, desc: '2.5초마다 번개가 적 3마리에게 (공격력 배율)' },
  { id: 'golem_crystal', name: '수정 골렘', skin: 'golem@190', ability: 'shield', rarity: 1, base: 0.08, per: 0.012, desc: '10초마다 보호막 (최대 체력 비율)' },
  { id: 'angel_gold', name: '황금 천사', skin: 'angel@45', ability: 'gold', rarity: 1, base: 0.25, per: 0.06, desc: '골드' },
  { id: 'devil_bomb', name: '폭탄 마왕', skin: 'devil@20', ability: 'bomb', rarity: 2, base: 3, per: 0.6, desc: '3초마다 폭탄 투척 (공격력 배율)' },
  { id: 'rabbit_gold', name: '황금 토끼', skin: 'rabbit@48', ability: 'chest', rarity: 2, base: 0.2, per: 0.03, desc: '좋은 상자 확률' },
];

export const PET_BY_ID = Object.fromEntries(PETS.map((p) => [p.id, p])) as Record<string, PetDef>;

export const petValue = (def: PetDef, level: number) => def.base + def.per * (level - 1);

export function petEffectText(def: PetDef, level: number) {
  const v = petValue(def, level);
  if (['attack', 'spore', 'frost', 'bolt', 'bomb'].includes(def.ability)) return `${def.desc} ×${v.toFixed(1)}`;
  return `${def.desc} +${(v * 100).toFixed(def.ability === 'heal' ? 1 : 0)}%`;
}
