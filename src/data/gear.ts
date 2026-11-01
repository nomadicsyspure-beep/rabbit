import type { SkillId } from './skills';
import type { MatId } from './world';

// 장비 6칸: 무기 / 모자 / 장갑 / 신발 / 망토 / 장신구. 재료 + 골드로 만들고 +15까지 강화한다.
// 몸에는 무기만 보인다 (옆에 둥둥). 그래서 나머지는 수치만이 아니라 전투에서 눈에 보이는 발동 효과(proc)를 준다:
// 모자 = 지키기(회피·보호막·냉기), 장갑 = 공격 때(번개·처치 폭발·빙결), 신발 = 달릴 때(발자국 장판), 망토 = 맞거나 잡을 때(흡혈·반격 폭발).
// 같은 지역 재료로 만든 장비를 2·4·6개 끼면 세트 효과 (SETS).

export type GearSlot = 'weapon' | 'hat' | 'gloves' | 'shoes' | 'cape' | 'acc';
/** 장비 칸 순서 (장비 탭: 왼쪽 3칸 · 오른쪽 3칸) */
export const GEAR_SLOTS: GearSlot[] = ['weapon', 'gloves', 'shoes', 'hat', 'cape', 'acc'];
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
  /** 발동 효과 (강화하면 값이 오른다) */
  proc?: { kind: ProcKind; v: number };
  desc: string;
}

/**
 * 발동 효과. v는 +0 기준 값 (강화 배율을 곱한다).
 * dodge 회피 확률 · shield 8초마다 보호막(최대 체력 비율) · frostHurt 맞으면 주변 적 느리게(초) · hurtBlast 맞으면 주변 폭발(공격력 배율, 3초마다)
 * critBolt 치명타 때 번개 확률 · critFreeze 치명타 맞은 적 빙결(초) · killBlast 처치 때 폭발 확률 · lifesteal 처치 때 체력 회복(최대 체력 비율)
 * trailPoison·trailIce·trailFire 달리면 발자국 장판 (공격력 배율)
 */
export type ProcKind = 'dodge' | 'shield' | 'frostHurt' | 'hurtBlast' | 'critBolt' | 'critFreeze' | 'killBlast' | 'lifesteal' | 'trailPoison' | 'trailIce' | 'trailFire';

/** 발동 효과 묶음 (장비·세트를 합친 것, 엔진이 읽는다) */
export interface Procs {
  dodge: number;
  shield: number;
  frostHurt: number;
  hurtBlast: number;
  critBolt: number;
  critFreeze: number;
  killBlast: number;
  lifesteal: number;
  trailPoison: number;
  trailIce: number;
  trailFire: number;
}

export const emptyProcs = (): Procs => ({
  dodge: 0, shield: 0, frostHurt: 0, hurtBlast: 0, critBolt: 0, critFreeze: 0, killBlast: 0, lifesteal: 0, trailPoison: 0, trailIce: 0, trailFire: 0,
});

/** 발동 효과 한 줄 글 */
export function procText(kind: ProcKind, v: number) {
  const pct = (x: number, d = 0) => `${(x * 100).toFixed(d)}%`;
  switch (kind) {
    case 'dodge': return `${pct(v)} 확률로 공격 회피`;
    case 'shield': return `8초마다 보호막 (최대 체력 ${pct(v)})`;
    case 'frostHurt': return `맞으면 주변 적 ${v.toFixed(1)}초 느리게`;
    case 'hurtBlast': return `맞으면 주변 폭발 (공격력 ×${v.toFixed(1)}, 3초마다)`;
    case 'critBolt': return `치명타 때 ${pct(v)} 확률로 번개 (3마리)`;
    case 'critFreeze': return `치명타 맞은 적 ${v.toFixed(1)}초 빙결`;
    case 'killBlast': return `처치 때 ${pct(v)} 확률로 폭발`;
    case 'lifesteal': return `처치 때 체력 ${pct(v, 1)} 회복`;
    case 'trailPoison': return `달리면 독 발자국 (공격력 ×${v.toFixed(2)})`;
    case 'trailIce': return `달리면 얼음 발자국: 느리게 (공격력 ×${v.toFixed(2)})`;
    case 'trailFire': return `달리면 불길 발자국 (공격력 ×${v.toFixed(2)})`;
  }
}

/** 지역 세트: 같은 재료로 만든 장비 n개 이상 끼면 (무기 포함, 최대 6) */
export interface SetBonus {
  need: number;
  text: string;
  atk?: number;
  hp?: number;
  speed?: number;
  crit?: number;
  fever?: number;
  proc?: { kind: ProcKind; v: number };
}

export const SETS: Partial<Record<MatId, { name: string; bonuses: SetBonus[] }>> = {
  feather: { name: '들판 세트', bonuses: [
    { need: 2, text: '이동 속도 +5%', speed: 0.05 },
    { need: 4, text: '처치 때 체력 0.3% 회복', proc: { kind: 'lifesteal', v: 0.003 } },
    { need: 6, text: '공격력 +20%', atk: 0.2 },
  ] },
  spore: { name: '버섯 숲 세트', bonuses: [
    { need: 2, text: '체력 +10%', hp: 0.1 },
    { need: 4, text: '처치 때 10% 확률로 포자 폭발', proc: { kind: 'killBlast', v: 0.1 } },
    { need: 6, text: '공격력 +25%', atk: 0.25 },
  ] },
  ice: { name: '얼음 세트', bonuses: [
    { need: 2, text: '치명타 확률 +3%', crit: 0.03 },
    { need: 4, text: '달리면 얼음 발자국', proc: { kind: 'trailIce', v: 0.3 } },
    { need: 6, text: '공격력 +30%', atk: 0.3 },
  ] },
  lava: { name: '용암 세트', bonuses: [
    { need: 2, text: '공격력 +8%', atk: 0.08 },
    { need: 4, text: '맞으면 주변 폭발', proc: { kind: 'hurtBlast', v: 2 } },
    { need: 6, text: '공격력 +35%', atk: 0.35 },
  ] },
  shadow: { name: '마왕 세트', bonuses: [
    { need: 2, text: '피버 게이지 +20%', fever: 0.2 },
    { need: 4, text: '치명타 때 30% 확률로 번개', proc: { kind: 'critBolt', v: 0.3 } },
    { need: 6, text: '공격력 +50%', atk: 0.5 },
  ] },
};

export const GEAR_MAX = 15;

export const GEAR: GearDef[] = [
  // 무기
  { id: 'staff_feather', slot: 'weapon', name: '깃털 지팡이', icon: '🪄', mat: 'feather', matCost: 12, goldCost: 400, atk: 0.1, bonusSkill: 'feather', desc: '깃털이 한 줄기 더' },
  { id: 'rod_fire', slot: 'weapon', name: '불꽃 막대', icon: '🔥', mat: 'spore', matCost: 15, goldCost: 1600, atk: 0.15, bonusSkill: 'fire', desc: '화염구가 저절로' },
  { id: 'fan_thunder', slot: 'weapon', name: '번개 부채', icon: '⚡', mat: 'ice', matCost: 18, goldCost: 6000, atk: 0.2, bonusSkill: 'chain', desc: '번개 연쇄가 저절로' },
  { id: 'wand_star', slot: 'weapon', name: '별의 지팡이', icon: '🌟', mat: 'lava', matCost: 21, goldCost: 24000, atk: 0.25, bonusSkill: 'meteor', desc: '별똥별이 저절로' },
  { id: 'scythe_dark', slot: 'weapon', name: '어둠의 낫', icon: '🌙', mat: 'shadow', matCost: 24, goldCost: 100000, atk: 0.3, bonusSkill: 'blackhole', desc: '블랙홀이 저절로' },
  { id: 'sword_demon', slot: 'weapon', name: '마왕의 검', icon: '🗡️', mat: 'shadow', matCost: 45, goldCost: 400000, essence: 10, atk: 0.6, bonusSkill: 'pillar', desc: '전설: 빛의 기둥이 저절로' },
  // 모자: 체력 + 지키는 효과
  { id: 'hat_straw', slot: 'hat', name: '밀짚모자', icon: '👒', mat: 'feather', matCost: 9, goldCost: 300, hp: 0.15, proc: { kind: 'dodge', v: 0.05 }, desc: '체력' },
  { id: 'hat_mush', slot: 'hat', name: '버섯 모자', icon: '🍄', mat: 'spore', matCost: 12, goldCost: 1200, hp: 0.25, proc: { kind: 'shield', v: 0.08 }, desc: '체력' },
  { id: 'hat_ice', slot: 'hat', name: '얼음 왕관', icon: '👑', mat: 'ice', matCost: 15, goldCost: 5000, hp: 0.35, proc: { kind: 'frostHurt', v: 1.5 }, desc: '체력' },
  { id: 'hat_fire', slot: 'hat', name: '불꽃 투구', icon: '⛑️', mat: 'lava', matCost: 18, goldCost: 20000, hp: 0.45, proc: { kind: 'dodge', v: 0.1 }, desc: '체력' },
  { id: 'hat_demon', slot: 'hat', name: '마왕의 왕관', icon: '😈', mat: 'shadow', matCost: 38, goldCost: 300000, essence: 8, hp: 0.9, proc: { kind: 'shield', v: 0.15 }, desc: '전설: 체력' },
  // 장갑: 공격할 때 터지는 효과
  { id: 'glove_cotton', slot: 'gloves', name: '면장갑', icon: '🧤', mat: 'feather', matCost: 9, goldCost: 300, proc: { kind: 'critBolt', v: 0.15 }, desc: '' },
  { id: 'glove_leather', slot: 'gloves', name: '가죽 장갑', icon: '🥊', mat: 'spore', matCost: 12, goldCost: 1400, proc: { kind: 'killBlast', v: 0.1 }, desc: '' },
  { id: 'glove_frost', slot: 'gloves', name: '서리 장갑', icon: '❄️', mat: 'ice', matCost: 15, goldCost: 5600, proc: { kind: 'critFreeze', v: 0.8 }, desc: '' },
  { id: 'glove_flame', slot: 'gloves', name: '화염 건틀릿', icon: '🔥', mat: 'lava', matCost: 18, goldCost: 22000, proc: { kind: 'killBlast', v: 0.25 }, desc: '' },
  { id: 'glove_demon', slot: 'gloves', name: '마왕의 건틀릿', icon: '🖐️', mat: 'shadow', matCost: 38, goldCost: 300000, essence: 8, effect: 'crit', value: 0.1, proc: { kind: 'critBolt', v: 0.4 }, desc: '전설: 치명타 확률' },
  // 신발: 달리면 생기는 효과
  { id: 'shoe_straw', slot: 'shoes', name: '짚신', icon: '🩴', mat: 'feather', matCost: 9, goldCost: 300, effect: 'speed', value: 0.04, proc: { kind: 'trailPoison', v: 0.25 }, desc: '이동 속도' },
  { id: 'shoe_sneaker', slot: 'shoes', name: '운동화', icon: '👟', mat: 'spore', matCost: 12, goldCost: 1400, effect: 'speed', value: 0.08, desc: '이동 속도' },
  { id: 'shoe_boot', slot: 'shoes', name: '눈길 장화', icon: '🥾', mat: 'ice', matCost: 15, goldCost: 5600, effect: 'speed', value: 0.05, proc: { kind: 'trailIce', v: 0.4 }, desc: '이동 속도' },
  { id: 'shoe_wing', slot: 'shoes', name: '날개 신발', icon: '🪽', mat: 'lava', matCost: 18, goldCost: 22000, effect: 'speed', value: 0.14, desc: '이동 속도' },
  { id: 'shoe_demon', slot: 'shoes', name: '마왕의 부츠', icon: '👢', mat: 'shadow', matCost: 38, goldCost: 300000, essence: 6, effect: 'speed', value: 0.15, proc: { kind: 'trailFire', v: 0.9 }, desc: '전설: 이동 속도' },
  // 망토: 맞거나 잡을 때 생기는 효과
  { id: 'cape_cloth', slot: 'cape', name: '천 망토', icon: '🧣', mat: 'feather', matCost: 9, goldCost: 400, proc: { kind: 'lifesteal', v: 0.004 }, desc: '' },
  { id: 'cape_star', slot: 'cape', name: '별빛 망토', icon: '✨', mat: 'spore', matCost: 12, goldCost: 1600, effect: 'magnet', value: 0.6, desc: '보석 끌어오는 범위' },
  { id: 'cape_rainbow', slot: 'cape', name: '무지개 망토', icon: '🌈', mat: 'ice', matCost: 15, goldCost: 7000, effect: 'chest', value: 0.12, desc: '좋은 상자 확률' },
  { id: 'cape_gold', slot: 'cape', name: '황금 망토', icon: '🌟', mat: 'lava', matCost: 18, goldCost: 24000, proc: { kind: 'hurtBlast', v: 3 }, desc: '' },
  { id: 'cape_demon', slot: 'cape', name: '마왕의 망토', icon: '🦇', mat: 'shadow', matCost: 38, goldCost: 300000, essence: 6, effect: 'fever', value: 0.6, proc: { kind: 'lifesteal', v: 0.01 }, desc: '전설: 피버 게이지 차는 속도' },
  // 장신구: 살림 효과
  { id: 'acc_magnet', slot: 'acc', name: '자석 목걸이', icon: '🧲', mat: 'feather', matCost: 9, goldCost: 600, effect: 'magnet', value: 0.6, desc: '보석 끌어오는 범위' },
  { id: 'acc_clover', slot: 'acc', name: '네잎클로버', icon: '🍀', mat: 'spore', matCost: 12, goldCost: 2000, effect: 'chest', value: 0.12, desc: '좋은 상자 확률' },
  { id: 'acc_watch', slot: 'acc', name: '콤보 시계', icon: '⏱️', mat: 'ice', matCost: 15, goldCost: 8000, effect: 'combo', value: 1, desc: '콤보 유지 시간(초)' },
  { id: 'acc_eye', slot: 'acc', name: '매의 눈', icon: '🦅', mat: 'ice', matCost: 18, goldCost: 12000, effect: 'crit', value: 0.08, desc: '치명타 확률' },
  { id: 'acc_charm', slot: 'acc', name: '피버 부적', icon: '🧧', mat: 'lava', matCost: 18, goldCost: 30000, effect: 'fever', value: 0.3, desc: '피버 게이지 차는 속도' },
  { id: 'acc_coin', slot: 'acc', name: '황금 동전', icon: '🪙', mat: 'shadow', matCost: 21, goldCost: 120000, effect: 'gold', value: 0.4, desc: '골드' },
];

/** 옛 저장의 장비 id (가방 → 망토) */
export const OLD_GEAR_IDS: Record<string, string> = {
  bag_leather: 'cape_cloth', bag_pouch: 'cape_star', bag_lucky: 'cape_rainbow', bag_gold: 'cape_gold', bag_demon: 'cape_demon',
};

export const GEAR_BY_ID = Object.fromEntries(GEAR.map((g) => [g.id, g])) as Record<string, GearDef>;
export const SLOT_NAMES: Record<GearSlot, string> = { weapon: '무기', hat: '모자', gloves: '장갑', shoes: '신발', cape: '망토', acc: '장신구' };
/** 칸이 비었을 때 보여 줄 글자 */
export const SLOT_ICONS: Record<GearSlot, string> = { weapon: '🗡️', hat: '🎩', gloves: '🧤', shoes: '👟', cape: '🧣', acc: '💍' };

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
  const parts: string[] = [];
  if (def.hp) parts.push(`체력 +${pct(def.hp)}`);
  if (def.effect === 'combo') parts.push(`${def.desc} +${(def.value! * k).toFixed(1)}`);
  else if (def.effect) parts.push(`${def.desc} +${pct(def.value!)}`);
  if (def.proc) parts.push(procText(def.proc.kind, def.proc.v * k));
  return parts.join(' · ');
}
