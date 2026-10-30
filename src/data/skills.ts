import type { Weapon } from '../battle/engine';
import {
  BlackHoleWeapon, ChainWeapon, DarkOrbWeapon, EggWeapon, FeatherWeapon, FireballWeapon, FlameWeapon, HASTE, HealWeapon,
  IceWeapon, MeteorWeapon, PillarWeapon, SlashWeapon, TornadoWeapon, treeCooldown, treeDamage,
  type SkillSpec, type SkillTree, type WeaponStats,
} from '../battle/weapons';

// 스킬은 골드로 배우고, 가지(피해 / 발동 속도 / 개수)마다 따로 강화한다 (영구).
// 스테이지에서는 장착한 스킬(최대 EQUIP_SLOTS개)만 발동한다.

export const EQUIP_SLOTS = 8;

export type SkillId =
  | 'feather' | 'tornado' | 'egg' | 'flame' | 'ice' | 'heal' | 'fire' | 'dark'
  | 'slash' | 'chain' | 'blackhole' | 'meteor' | 'pillar';

export type Branch = keyof SkillTree;

export const BRANCHES: { id: Branch; name: string; max: number }[] = [
  { id: 'dmg', name: '피해', max: 30 },
  { id: 'spd', name: '발동 속도', max: 20 },
  { id: 'cnt', name: '개수', max: 10 },
];

export interface SkillDef extends SkillSpec {
  id: SkillId;
  name: string;
  /** 아이콘: UI 시트의 skill-<이름> 또는 fx:<이펙트 이름> (나무 틀 안에 그린다) */
  icon: string;
  /** 한 줄 설명 */
  blurb: string;
  /** 개수 가지가 늘리는 것 */
  countLabel: string;
  /** 개수 1레벨당 늘어나는 양 */
  countStep?: number;
  /** 피해 대신 보여 줄 이름 (치유는 회복량) */
  dmgLabel?: string;
  /** 쿨다운이 없는 스킬 (도는 구체): 발동 속도 = 회전 속도 */
  continuous?: boolean;
  /** 배우는 값 (테스트 중엔 LEARN_COST_OVERRIDE). 가지 강화 비용은 이 값에서 늘어난다 */
  learnCost: number;
  create: (stats: WeaponStats, spec: SkillSpec, tree: SkillTree) => Weapon;
}

export const SKILLS: SkillDef[] = [
  {
    id: 'feather', name: '깃털 날리기', icon: 'skill-feather', blurb: '가까운 적들에게 깃털을 날린다 (개수 3마다 관통 +1)',
    dmg: 1, cd: 0.8, count: 2, countLabel: '깃털', learnCost: 0,
    create: (s, spec, t) => new FeatherWeapon(s, spec, t),
  },
  {
    id: 'tornado', name: '회오리', icon: 'skill-tornado', blurb: '바라보는 쪽으로 회오리가 쓸고 지나간다',
    dmg: 0.6, cd: 3.2, count: 1, countLabel: '회오리', learnCost: 30,
    create: (s, spec, t) => new TornadoWeapon(s, spec, t),
  },
  {
    id: 'egg', name: '알 폭탄', icon: 'skill-egg', blurb: '적 무리에 알을 던져 펑',
    dmg: 1.4, cd: 2.4, count: 1, countLabel: '알', learnCost: 50,
    create: (s, spec, t) => new EggWeapon(s, spec, t),
  },
  {
    id: 'flame', name: '화염 폭발', icon: 'skill-flame', blurb: '주변을 불꽃으로 날려 버린다 (개수만큼 점점 크게 연속 폭발)',
    dmg: 1.2, cd: 2.6, count: 1, countLabel: '연속 폭발', learnCost: 80,
    create: (s, spec, t) => new FlameWeapon(s, spec, t),
  },
  {
    id: 'ice', name: '얼음 결정', icon: 'skill-ice', blurb: '적 발밑에 얼음이 솟아 피해 + 느려짐',
    dmg: 1.1, cd: 2.2, count: 2, countLabel: '대상', learnCost: 100,
    create: (s, spec, t) => new IceWeapon(s, spec, t),
  },
  {
    id: 'heal', name: '치유', icon: 'skill-heal', blurb: '주기적으로 체력 회복 (개수만큼 연달아)',
    dmg: 0.05, cd: 6, count: 1, countLabel: '회복 횟수', dmgLabel: '회복량', learnCost: 80,
    create: (s, spec, t) => new HealWeapon(s, spec, t),
  },
  {
    id: 'fire', name: '화염구', icon: 'skill-fire', blurb: '맞으면 터지는 화염구',
    dmg: 1.6, cd: 1.7, count: 1, countLabel: '화염구', learnCost: 150,
    create: (s, spec, t) => new FireballWeapon(s, spec, t),
  },
  {
    id: 'dark', name: '암흑 구체', icon: 'skill-dark', blurb: '주위를 도는 구체 (발동 속도 = 회전 속도)',
    dmg: 0.5, cd: 0, count: 2, countLabel: '구체', continuous: true, learnCost: 200,
    create: (s, spec, t) => new DarkOrbWeapon(s, spec, t),
  },
  {
    id: 'slash', name: '회전 베기', icon: 'fx:slash', blurb: '주변을 크게 한 바퀴 벤다 (개수만큼 연속 베기)',
    dmg: 1.3, cd: 1.6, count: 1, countLabel: '연속 베기', learnCost: 120,
    create: (s, spec, t) => new SlashWeapon(s, spec, t),
  },
  {
    id: 'chain', name: '번개 연쇄', icon: 'fx:blue-slash', blurb: '번개가 적에서 적으로 튀어 다닌다',
    dmg: 1.2, cd: 1.5, count: 4, countStep: 2, countLabel: '튀는 횟수', learnCost: 180,
    create: (s, spec, t) => new ChainWeapon(s, spec, t),
  },
  {
    id: 'blackhole', name: '블랙홀', icon: 'fx:purple-pit', blurb: '적을 빨아들이고 닫히며 대폭발',
    dmg: 1, cd: 7, count: 1, countLabel: '블랙홀', learnCost: 400,
    create: (s, spec, t) => new BlackHoleWeapon(s, spec, t),
  },
  {
    id: 'meteor', name: '별똥별', icon: 'fx:gold-sparkle', blurb: '적들 위로 별이 쏟아진다',
    dmg: 2.2, cd: 2.8, count: 3, countLabel: '별', learnCost: 300,
    create: (s, spec, t) => new MeteorWeapon(s, spec, t),
  },
  {
    id: 'pillar', name: '빛의 기둥', icon: 'fx:pillar', blurb: '무작위 적들에게 빛 기둥이 내리꽂힌다',
    dmg: 2.5, cd: 3, count: 2, countLabel: '기둥', learnCost: 250,
    create: (s, spec, t) => new PillarWeapon(s, spec, t),
  },
];

export const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s])) as Record<SkillId, SkillDef>;

export const emptyTree = (): SkillTree => ({ dmg: 0, spd: 0, cnt: 0 });

/** 테스트용: 스킬 배우는 값을 전부 이걸로 (null이면 스킬마다 정한 learnCost) */
const LEARN_COST_OVERRIDE: number | null = 1;
export const learnPrice = (def: SkillDef) => LEARN_COST_OVERRIDE ?? def.learnCost;

export const createSkill = (def: SkillDef, stats: WeaponStats, tree: SkillTree) => def.create(stats, def, tree);

/** 가지 한 단계 강화 비용. 개수는 효과가 커서 비싸다 */
export function branchCost(def: SkillDef, branch: Branch, level: number) {
  const base = Math.max(15, def.learnCost);
  if (branch === 'cnt') return base * 1.5 * Math.pow(1.7, level);
  return base * 0.4 * Math.pow(1.28, level);
}

/** 가지 값 보여 주기: 지금 레벨 기준 */
export function branchValue(def: SkillDef, branch: Branch, tree: SkillTree): string {
  switch (branch) {
    case 'dmg':
      return `${Math.round(def.dmg * treeDamage(tree) * 100)}%`;
    case 'spd':
      return def.continuous
        ? `회전 ×${(1 + 0.1 * tree.spd).toFixed(1)}`
        : `${(def.cd * (def.id === 'heal' ? 1 : HASTE) * treeCooldown(tree)).toFixed(2)}초마다`;
    case 'cnt':
      return `${def.count + tree.cnt * (def.countStep ?? 1)}${def.id === 'chain' ? '번' : '개'}`;
  }
}

/** 카드 한 줄 요약 */
export function skillSummary(def: SkillDef, tree: SkillTree) {
  return `${def.dmgLabel ?? '피해'} ${branchValue(def, 'dmg', tree)} · ${branchValue(def, 'spd', tree)} · ${def.countLabel} ${branchValue(def, 'cnt', tree)}`;
}

/** 전체 강화 단계 합 (카드에 Lv로 보여 준다) */
export const treeLevel = (t: SkillTree) => 1 + t.dmg + t.spd + t.cnt;
