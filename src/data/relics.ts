import { SKILL_BY_ID, type SkillId } from './skills';
import type { MatId } from './world';

// 유물: 병아리가 지니는 신비한 물건. 6칸 어디에나 끼운다 (같은 유물은 하나만).
// 칸은 최고 스테이지에 따라 열린다. 유물마다 눈에 보이는 발동 효과나 수치, 공짜 스킬이 있다.
// 지역(재료)마다 유물 6개 = 한 세트: 같은 지역 유물을 2·4·6개 끼면 세트 효과.
// 얻는 법: 제작 탭에서 지역 재료로 만들기, 상점 유물 소환 (겹치면 +1 강화). 강화는 재료 + 골드로 +15까지.

export type Region = 'feather' | 'spore' | 'ice' | 'lava' | 'shadow';
/** 0 일반 · 1 희귀 · 2 영웅 · 3 전설 */
export type RelicRarity = 0 | 1 | 2 | 3;
export const RELIC_RARITY_NAMES = ['일반', '희귀', '영웅', '전설'] as const;
export const RELIC_RARITY_COLORS = ['#c9b79c', '#7ad7ff', '#c78bff', '#ffd23f'] as const;

/** 수치 효과 */
export type StatKind = 'magnet' | 'chest' | 'combo' | 'fever' | 'gold' | 'crit' | 'speed';
const STAT_NAMES: Record<StatKind, string> = {
  magnet: '보석 끌어오는 범위', chest: '좋은 상자 확률', combo: '콤보 유지 시간(초)', fever: '피버 게이지 차는 속도',
  gold: '골드', crit: '치명타 확률', speed: '이동 속도',
};

/**
 * 발동 효과. v는 +0 기준 값 (강화 배율을 곱한다).
 * dodge 회피 확률 · shield 8초마다 보호막(최대 체력 비율) · frostHurt 맞으면 주변 적 느리게(초) · hurtBlast 맞으면 주변 폭발(공격력 배율, 3초마다)
 * critBolt 치명타 때 번개 확률 · critFreeze 치명타 맞은 적 빙결(초) · killBlast 처치 때 폭발 확률 · lifesteal 처치 때 체력 회복(최대 체력 비율)
 * trailPoison·trailIce·trailFire 달리면 발자국 장판 (공격력 배율)
 */
export type ProcKind = 'dodge' | 'shield' | 'frostHurt' | 'hurtBlast' | 'critBolt' | 'critFreeze' | 'killBlast' | 'lifesteal' | 'trailPoison' | 'trailIce' | 'trailFire';

export interface RelicDef {
  id: string;
  name: string;
  icon: string;
  region: Region;
  rarity: RelicRarity;
  /** 만드는 값: 지역 재료 · 골드 · 보스의 정수(전설) */
  matCost: number;
  goldCost: number;
  essence?: number;
  /** 공격력 +% · 체력 +% */
  atk?: number;
  hp?: number;
  /** 공짜로 같이 나가는 스킬 (장착 칸을 안 쓴다, 강화 단계만큼 세다) */
  bonusSkill?: SkillId;
  stat?: { kind: StatKind; v: number };
  proc?: { kind: ProcKind; v: number };
  /** 한 줄 이야기 */
  lore: string;
}

export const RELIC_SLOTS = 6;
/** 칸이 열리는 최고 스테이지 (0 = 처음부터) */
export const SLOT_UNLOCK = [0, 0, 5, 10, 20, 30];
export const RELIC_MAX = 15;

export const RELICS: RelicDef[] = [
  // 들판 (깃털 조각) · 일반
  { id: 'r_feather_pendant', name: '깃털 펜던트', icon: '📿', region: 'feather', rarity: 0, matCost: 12, goldCost: 400, atk: 0.1, bonusSkill: 'feather', lore: '깃털이 한 줄기 더 날아간다' },
  { id: 'r_flower_crown', name: '들꽃 화관', icon: '🌼', region: 'feather', rarity: 0, matCost: 9, goldCost: 300, hp: 0.15, proc: { kind: 'dodge', v: 0.05 }, lore: '꽃향기에 몹이 헛손질한다' },
  { id: 'r_wind_bell', name: '바람 방울', icon: '🎐', region: 'feather', rarity: 0, matCost: 9, goldCost: 300, stat: { kind: 'speed', v: 0.05 }, proc: { kind: 'trailPoison', v: 0.25 }, lore: '달리면 풀독 먼지가 인다' },
  { id: 'r_horseshoe', name: '행운 말굽', icon: '🧲', region: 'feather', rarity: 0, matCost: 9, goldCost: 300, stat: { kind: 'magnet', v: 0.6 }, lore: '보석이 저절로 끌려온다' },
  { id: 'r_sparrow_pin', name: '참새 깃 장식', icon: '🐦', region: 'feather', rarity: 0, matCost: 10, goldCost: 350, proc: { kind: 'critBolt', v: 0.15 }, lore: '치명타에 번개가 튄다' },
  { id: 'r_reed_pipe', name: '풀피리', icon: '🎋', region: 'feather', rarity: 0, matCost: 10, goldCost: 350, proc: { kind: 'lifesteal', v: 0.004 }, lore: '쓰러뜨릴 때마다 기운이 돈다' },
  // 버섯 숲 (버섯 포자) · 희귀
  { id: 'r_ember_shroom', name: '불씨 버섯', icon: '🍄', region: 'spore', rarity: 1, matCost: 15, goldCost: 1600, atk: 0.15, bonusSkill: 'fire', lore: '화염구가 저절로 날아간다' },
  { id: 'r_spore_pouch', name: '포자 주머니', icon: '👝', region: 'spore', rarity: 1, matCost: 12, goldCost: 1400, proc: { kind: 'killBlast', v: 0.1 }, lore: '쓰러진 몹이 펑 터진다' },
  { id: 'r_shroom_lantern', name: '버섯 등불', icon: '🏮', region: 'spore', rarity: 1, matCost: 12, goldCost: 1400, hp: 0.15, proc: { kind: 'shield', v: 0.08 }, lore: '은은한 빛이 보호막이 된다' },
  { id: 'r_moss_ring', name: '이끼 반지', icon: '💍', region: 'spore', rarity: 1, matCost: 12, goldCost: 1200, hp: 0.3, lore: '숲의 생명력' },
  { id: 'r_clover', name: '네잎클로버', icon: '🍀', region: 'spore', rarity: 1, matCost: 12, goldCost: 2000, stat: { kind: 'chest', v: 0.12 }, lore: '좋은 상자가 잘 나온다' },
  { id: 'r_mycelium', name: '균사 실타래', icon: '🧶', region: 'spore', rarity: 1, matCost: 12, goldCost: 1400, stat: { kind: 'combo', v: 1 }, lore: '콤보가 쉽게 끊기지 않는다' },
  // 얼음 (얼음 결정) · 희귀
  { id: 'r_thunder_crystal', name: '번개 결정', icon: '⚡', region: 'ice', rarity: 1, matCost: 18, goldCost: 6000, atk: 0.2, bonusSkill: 'chain', lore: '번개 연쇄가 저절로' },
  { id: 'r_frost_heart', name: '서리 심장', icon: '💠', region: 'ice', rarity: 1, matCost: 15, goldCost: 5600, proc: { kind: 'critFreeze', v: 0.8 }, lore: '치명타 맞은 적이 얼어붙는다' },
  { id: 'r_ice_mirror', name: '얼음 거울', icon: '🪞', region: 'ice', rarity: 1, matCost: 15, goldCost: 5000, hp: 0.2, proc: { kind: 'frostHurt', v: 1.5 }, lore: '맞으면 냉기가 퍼진다' },
  { id: 'r_snowflake', name: '눈송이 부적', icon: '❄️', region: 'ice', rarity: 1, matCost: 15, goldCost: 5600, proc: { kind: 'trailIce', v: 0.4 }, lore: '지나간 자리가 얼어붙는다' },
  { id: 'r_hawk_eye', name: '매의 눈', icon: '🦅', region: 'ice', rarity: 1, matCost: 18, goldCost: 12000, stat: { kind: 'crit', v: 0.08 }, lore: '약점이 보인다' },
  { id: 'r_hourglass', name: '얼음 모래시계', icon: '⏳', region: 'ice', rarity: 1, matCost: 15, goldCost: 8000, stat: { kind: 'fever', v: 0.25 }, lore: '피버가 빨리 찬다' },
  // 용암 (용암석) · 영웅
  { id: 'r_meteor_shard', name: '유성 조각', icon: '☄️', region: 'lava', rarity: 2, matCost: 21, goldCost: 24000, atk: 0.25, bonusSkill: 'meteor', lore: '별똥별이 저절로 떨어진다' },
  { id: 'r_lava_heart', name: '용암 심장', icon: '❤️‍🔥', region: 'lava', rarity: 2, matCost: 18, goldCost: 24000, hp: 0.25, proc: { kind: 'hurtBlast', v: 3 }, lore: '맞으면 용암이 터진다' },
  { id: 'r_flame_horn', name: '화염 뿔피리', icon: '📯', region: 'lava', rarity: 2, matCost: 18, goldCost: 22000, proc: { kind: 'killBlast', v: 0.25 }, lore: '쓰러진 몹이 크게 터진다' },
  { id: 'r_phoenix_plume', name: '불사조 깃털', icon: '🔥', region: 'lava', rarity: 2, matCost: 18, goldCost: 20000, proc: { kind: 'dodge', v: 0.1 }, lore: '불꽃처럼 피한다' },
  { id: 'r_fever_charm', name: '피버 부적', icon: '🧧', region: 'lava', rarity: 2, matCost: 18, goldCost: 30000, stat: { kind: 'fever', v: 0.3 }, lore: '피버 게이지가 빨리 찬다' },
  { id: 'r_gold_scale', name: '황금 저울', icon: '⚖️', region: 'lava', rarity: 2, matCost: 18, goldCost: 24000, stat: { kind: 'gold', v: 0.3 }, lore: '골드가 더 들어온다' },
  // 마왕 (어둠의 조각) · 전설
  { id: 'r_demon_sword', name: '마왕의 검', icon: '🗡️', region: 'shadow', rarity: 3, matCost: 30, goldCost: 200000, essence: 10, atk: 0.6, bonusSkill: 'pillar', lore: '빛의 기둥이 저절로' },
  { id: 'r_void_orb', name: '공허의 구슬', icon: '🔮', region: 'shadow', rarity: 3, matCost: 24, goldCost: 100000, atk: 0.3, bonusSkill: 'blackhole', lore: '블랙홀이 저절로' },
  { id: 'r_demon_crown', name: '마왕의 왕관', icon: '😈', region: 'shadow', rarity: 3, matCost: 38, goldCost: 300000, essence: 8, hp: 0.9, proc: { kind: 'shield', v: 0.15 }, lore: '어둠이 몸을 감싼다' },
  { id: 'r_dark_gauntlet', name: '어둠의 손아귀', icon: '🖐️', region: 'shadow', rarity: 3, matCost: 38, goldCost: 300000, essence: 8, stat: { kind: 'crit', v: 0.1 }, proc: { kind: 'critBolt', v: 0.4 }, lore: '치명타에 검은 번개' },
  { id: 'r_hellfire_boots', name: '지옥불 발자국', icon: '👢', region: 'shadow', rarity: 3, matCost: 38, goldCost: 300000, essence: 6, stat: { kind: 'speed', v: 0.15 }, proc: { kind: 'trailFire', v: 0.9 }, lore: '걷는 길마다 불길' },
  { id: 'r_bat_cloak', name: '박쥐 망토', icon: '🦇', region: 'shadow', rarity: 3, matCost: 38, goldCost: 300000, essence: 6, stat: { kind: 'fever', v: 0.6 }, proc: { kind: 'lifesteal', v: 0.01 }, lore: '쓰러뜨린 몹의 기운을 빨아들인다' },
];

export const RELIC_BY_ID = Object.fromEntries(RELICS.map((r) => [r.id, r])) as Record<string, RelicDef>;
export const REGION_NAMES: Record<Region, string> = { feather: '들판', spore: '버섯 숲', ice: '얼음', lava: '용암', shadow: '마왕' };
export const REGIONS: Region[] = ['feather', 'spore', 'ice', 'lava', 'shadow'];

/** 강화 단계에 따른 효과 배율 (+1마다 15%) */
export const relicScale = (plus: number) => 1 + 0.15 * plus;

/** 강화 비용 (plus → plus+1) */
export function enhanceCost(def: RelicDef, plus: number) {
  return {
    mat: Math.ceil(def.matCost * 0.5 * (1 + plus * 0.6)),
    gold: def.goldCost * 0.6 * Math.pow(1.45, plus),
    essence: def.essence ? Math.ceil(plus / 5) : 0,
  };
}

/** 발동 효과 묶음 (유물·세트를 합친 것, 엔진이 읽는다) */
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

/** 유물 효과 글 (강화 단계 반영) */
export function relicEffectText(def: RelicDef, plus: number) {
  const k = relicScale(plus);
  const pct = (v: number) => `${Math.round(v * k * 100)}%`;
  const parts: string[] = [];
  if (def.atk) parts.push(`공격력 +${pct(def.atk)}`);
  if (def.hp) parts.push(`체력 +${pct(def.hp)}`);
  if (def.bonusSkill) parts.push(`${SKILL_BY_ID[def.bonusSkill].name} 자동 발동 (+${plus} 강화)`);
  if (def.stat) parts.push(def.stat.kind === 'combo' ? `${STAT_NAMES.combo} +${(def.stat.v * k).toFixed(1)}` : `${STAT_NAMES[def.stat.kind]} +${pct(def.stat.v)}`);
  if (def.proc) parts.push(procText(def.proc.kind, def.proc.v * k));
  return parts.join(' · ');
}

/** 지역 세트: 같은 지역 유물을 n개 이상 끼면 */
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

export const SETS: Record<Region, { name: string; bonuses: SetBonus[] }> = {
  feather: { name: '들판의 노래', bonuses: [
    { need: 2, text: '이동 속도 +5%', speed: 0.05 },
    { need: 4, text: '처치 때 체력 0.3% 회복', proc: { kind: 'lifesteal', v: 0.003 } },
    { need: 6, text: '공격력 +20%', atk: 0.2 },
  ] },
  spore: { name: '버섯 숲의 축복', bonuses: [
    { need: 2, text: '체력 +10%', hp: 0.1 },
    { need: 4, text: '처치 때 10% 확률로 포자 폭발', proc: { kind: 'killBlast', v: 0.1 } },
    { need: 6, text: '공격력 +25%', atk: 0.25 },
  ] },
  ice: { name: '얼음 왕국', bonuses: [
    { need: 2, text: '치명타 확률 +3%', crit: 0.03 },
    { need: 4, text: '달리면 얼음 발자국', proc: { kind: 'trailIce', v: 0.3 } },
    { need: 6, text: '공격력 +30%', atk: 0.3 },
  ] },
  lava: { name: '용암의 분노', bonuses: [
    { need: 2, text: '공격력 +8%', atk: 0.08 },
    { need: 4, text: '맞으면 주변 폭발', proc: { kind: 'hurtBlast', v: 2 } },
    { need: 6, text: '공격력 +35%', atk: 0.35 },
  ] },
  shadow: { name: '마왕의 유산', bonuses: [
    { need: 2, text: '피버 게이지 +20%', fever: 0.2 },
    { need: 4, text: '치명타 때 30% 확률로 번개', proc: { kind: 'critBolt', v: 0.3 } },
    { need: 6, text: '공격력 +50%', atk: 0.5 },
  ] },
};

/** 유물 소환: 전설(정수 필요) 빼고, 일반 60% · 희귀 30% · 영웅 10% */
export function rollRelic(): RelicDef {
  const r = Math.random();
  const rarity = r < 0.1 ? 2 : r < 0.4 ? 1 : 0;
  const pool = RELICS.filter((x) => x.rarity === rarity && !x.essence);
  return pool[Math.floor(Math.random() * pool.length)];
}

/** 예전 장비(재료·골드)를 돌려받을 값: id → [재료, 개수, 골드] (유물로 바뀌면서 돌려준다) */
export const OLD_GEAR_REFUND: Record<string, [MatId, number, number]> = {
  staff_feather: ['feather', 12, 400], rod_fire: ['spore', 15, 1600], fan_thunder: ['ice', 18, 6000], wand_star: ['lava', 21, 24000],
  scythe_dark: ['shadow', 24, 100000], sword_demon: ['shadow', 45, 400000],
  hat_straw: ['feather', 9, 300], hat_mush: ['spore', 12, 1200], hat_ice: ['ice', 15, 5000], hat_fire: ['lava', 18, 20000], hat_demon: ['shadow', 38, 300000],
  glove_cotton: ['feather', 9, 300], glove_leather: ['spore', 12, 1400], glove_frost: ['ice', 15, 5600], glove_flame: ['lava', 18, 22000], glove_demon: ['shadow', 38, 300000],
  shoe_straw: ['feather', 9, 300], shoe_sneaker: ['spore', 12, 1400], shoe_boot: ['ice', 15, 5600], shoe_wing: ['lava', 18, 22000], shoe_demon: ['shadow', 38, 300000],
  cape_cloth: ['feather', 9, 400], cape_star: ['spore', 12, 1600], cape_rainbow: ['ice', 15, 7000], cape_gold: ['lava', 18, 24000], cape_demon: ['shadow', 38, 300000],
  bag_leather: ['feather', 9, 400], bag_pouch: ['spore', 12, 1600], bag_lucky: ['ice', 15, 7000], bag_gold: ['lava', 18, 24000], bag_demon: ['shadow', 38, 300000],
  acc_magnet: ['feather', 9, 600], acc_clover: ['spore', 12, 2000], acc_watch: ['ice', 15, 8000], acc_eye: ['ice', 18, 12000], acc_charm: ['lava', 18, 30000], acc_coin: ['shadow', 21, 120000],
};
