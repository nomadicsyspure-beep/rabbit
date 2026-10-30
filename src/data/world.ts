import type { EnemySkin } from '../battle/engine';
import { BOSS_EVERY } from './balance';

// 지역(10스테이지마다)과 스테이지 규칙.

export type MatId = 'feather' | 'spore' | 'ice' | 'lava' | 'shadow' | 'skillbook';

export interface Region {
  name: string;
  /** 바닥 색: 바탕 / 큰 얼룩 두 가지 / 작은 자갈 두 가지 */
  ground: [string, string, string, string, string];
  /** 지역 몹 (스테이지마다 돌아가며 고른다) */
  normal: EnemySkin[];
  fast: EnemySkin[];
  tank: EnemySkin[];
  /** 정예 몬스터 / 마왕(10스테이지마다) 외형 */
  elite: EnemySkin;
  boss: EnemySkin;
  /** 바닥 장식 (src/assets/deco) */
  deco: string[];
  /** 이 지역 상자에서 나오는 재료 */
  mat: MatId;
}

export const REGIONS: Region[] = [
  {
    name: '흙길 들판',
    ground: ['#7f5a3a', 'rgba(98,68,42,0.2)', 'rgba(150,112,74,0.15)', 'rgba(60,40,24,0.45)', 'rgba(186,150,108,0.45)'],
    normal: ['slime', 'sprout', 'slime_blue', 'leaf_slime', 'duck'],
    fast: ['bat', 'rabbit_sword', 'fox', 'duck_sword'],
    tank: ['snail', 'boar', 'turtle', 'rabbit_shield'],
    elite: 'rabbit_king', boss: 'boss_boar_king',
    deco: ['rock', 'rocks_moss', 'grass', 'bush', 'flowers', 'flower_orange', 'stump', 'log', 'fence', 'sign', 'grass_patch', 'flower_patch', 'tree'],
    mat: 'feather',
  },
  {
    name: '버섯 숲',
    ground: ['#5c6b34', 'rgba(40,60,20,0.25)', 'rgba(120,140,70,0.18)', 'rgba(30,45,15,0.5)', 'rgba(170,190,110,0.4)'],
    normal: ['mushroom', 'mush_red', 'mush_orange', 'flower_slime', 'bush_slime'],
    fast: ['mush_blue', 'hedgehog', 'bee', 'moth', 'angel'],
    tank: ['mush_big', 'stump_walker', 'flytrap', 'tree_sprite', 'golem'],
    elite: 'mush_wizard', boss: 'boss_ent',
    deco: ['mushroom_red', 'mushroom_blue', 'mushroom_orange', 'tree', 'tree_autumn', 'stump2', 'bush2', 'flowers_blue', 'pine', 'log', 'puddle_poison', 'grass'],
    mat: 'spore',
  },
  {
    name: '눈 덮인 언덕',
    ground: ['#c9d3de', 'rgba(150,170,195,0.25)', 'rgba(255,255,255,0.3)', 'rgba(120,140,170,0.45)', 'rgba(255,255,255,0.6)'],
    normal: ['ice_blob', 'penguin', 'cloud', 'slime_blue'],
    fast: ['penguin_hat', 'wolf', 'fairy_blue', 'cloud_ghost'],
    tank: ['sheep', 'deer_white', 'crystal_beast', 'ice_beast'],
    elite: 'deer', boss: 'boss_ice_golem',
    deco: ['crystal_ice', 'crystal_big', 'crystal_blue', 'snow_patch', 'ice_patch', 'pine2', 'rock2', 'boulder', 'pine'],
    mat: 'ice',
  },
  {
    name: '불타는 화산',
    ground: ['#5a2e22', 'rgba(30,10,5,0.3)', 'rgba(160,60,20,0.2)', 'rgba(255,120,30,0.5)', 'rgba(20,8,4,0.6)'],
    normal: ['fire_spirit', 'wisp_fire', 'slime_yellow', 'fruit_slime'],
    fast: ['fox_fire', 'imp', 'boar_red', 'demon_bat'],
    tank: ['lava_bear', 'turtle_fire', 'rock_beast', 'flytrap_fire'],
    elite: 'imp_spear', boss: 'boss_golem',
    deco: ['lava_crack', 'crack', 'boulder', 'rock2', 'torch', 'tree_dead', 'bone', 'crystal_purple'],
    mat: 'lava',
  },
  {
    name: '어둠의 성',
    ground: ['#3a2d48', 'rgba(20,10,35,0.3)', 'rgba(110,70,150,0.2)', 'rgba(160,100,220,0.45)', 'rgba(15,8,25,0.6)'],
    normal: ['skeleton', 'shadow_blob', 'ghost_purple', 'slime_violet', 'wisp_purple'],
    fast: ['bat_purple', 'bat_horn', 'demon_bat2', 'shadow_cat'],
    tank: ['skeleton_shield', 'skeleton_helm', 'witch_skull', 'shadow_spike', 'pumpkin'],
    elite: 'reaper', boss: 'boss_demon_king',
    deco: ['tomb', 'tomb2', 'obelisk_purple', 'pillar_broken', 'ruin_pillar', 'ruin', 'portal_purple', 'skull_bush', 'candle', 'bone', 'puddle_purple', 'pillar_moss'],
    mat: 'shadow',
  },
];

/** 보스 레이드 마왕: 요일마다 바뀐다 (이름과 외형) */
export const RAID_BOSSES: { skin: EnemySkin; name: string }[] = [
  { skin: 'boss_dark_dragon', name: '어둠의 용' },
  { skin: 'boss_slime_king', name: '슬라임 대왕' },
  { skin: 'boss_turtle', name: '숲거북 대왕' },
  { skin: 'boss_blue_dragon', name: '푸른 용' },
  { skin: 'boss_green_dragon', name: '초록 용' },
  { skin: 'boss_white_dragon', name: '서리 용' },
  { skin: 'boss_demon_king', name: '병아리 마왕' },
];
export const raidBossToday = () => RAID_BOSSES[new Date().getDay() % RAID_BOSSES.length];

/** 도감에 나오는 몬스터 전부 (지역 몹 + 정예 + 마왕 + 레이드 + 특수) */
export const ALL_MONSTERS: EnemySkin[] = [
  ...new Set([
    ...REGIONS.flatMap((r) => [...r.normal, ...r.fast, ...r.tank, r.elite, r.boss]),
    ...RAID_BOSSES.map((b) => b.skin),
    'firstaid',
  ]),
];

/** 스테이지 → 지역 번호 (지역 5개를 계속 돈다) */
export const regionIndex = (stage: number) => Math.floor((Math.max(1, stage) - 1) / BOSS_EVERY) % REGIONS.length;
export const regionOf = (stage: number) => REGIONS[regionIndex(stage)];
/** 지역을 몇 바퀴 돌았나 (재료 양 등에 쓴다) */
export const regionLap = (stage: number) => Math.floor((Math.max(1, stage) - 1) / (BOSS_EVERY * REGIONS.length));

const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];

/** 스테이지 몹 외형 (일반 / 빠른 / 단단한). 부를 때마다 지역 몹 중에서 무작위로 */
export function stageSkins(stage: number): Record<'normal' | 'fast' | 'tank', EnemySkin> {
  const r = regionOf(stage);
  return { normal: pick(r.normal), fast: pick(r.fast), tank: pick(r.tank) };
}

// ---- 스테이지 규칙: 3스테이지마다 하나 붙는다 (마왕 스테이지 제외) ----

export type RuleId = 'swift' | 'horde' | 'armored' | 'elite' | 'fog' | 'bomb';

export interface RuleDef {
  id: RuleId;
  name: string;
  desc: string;
}

export const RULES: RuleDef[] = [
  { id: 'swift', name: '질풍', desc: '몹이 1.4배 빠르다' },
  { id: 'horde', name: '대군', desc: '약한 몹이 1.6배 많이 몰려온다' },
  { id: 'armored', name: '철갑', desc: '단단한 몹이 잔뜩' },
  { id: 'elite', name: '정예 습격', desc: '중간중간 정예 몬스터가 나타난다' },
  { id: 'fog', name: '안개', desc: '주변밖에 안 보인다' },
  { id: 'bomb', name: '폭탄 몹', desc: '쓰러진 몹이 터진다 (옆 몹도 같이, 가까우면 나도 아프다)' },
];

export function stageRule(stage: number): RuleDef | null {
  if (stage % BOSS_EVERY === 0 || stage % 3 !== 0) return null;
  return RULES[Math.floor(stage / 3) % RULES.length];
}
