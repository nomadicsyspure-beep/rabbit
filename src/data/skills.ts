import type { Weapon } from '../battle/engine';
import {
  DarkOrbWeapon, EggWeapon, FeatherWeapon, FireballWeapon, FlameWeapon, HealWeapon, IceWeapon, TornadoWeapon,
  every, skillPower, type WeaponStats,
} from '../battle/weapons';

// 스킬은 골드로 배우고 강화한다 (영구). 스테이지에서는 장착한 스킬(최대 4개)만 발동한다.

export const SKILL_MAX_LEVEL = 20;
export const EQUIP_SLOTS = 4;

export type SkillId = 'feather' | 'tornado' | 'egg' | 'flame' | 'ice' | 'heal' | 'fire' | 'dark';

export interface SkillDef {
  id: SkillId;
  name: string;
  /** src/assets/ui/skill-<icon>.png */
  icon: string;
  /** 레벨별 설명 */
  desc: (level: number) => string;
  /** 0레벨(미습득)에서 배우는 값. 강화 비용은 여기서 늘어난다 */
  learnCost: number;
  createWeapon: (stats: WeaponStats, level: number) => Weapon;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

export const SKILLS: SkillDef[] = [
  {
    id: 'feather',
    name: '깃털 날리기',
    icon: 'feather',
    desc: (l) => `가까운 적에게 깃털 ${1 + every(l, 5)}개 · 피해 ${pct(skillPower(l))}`,
    learnCost: 0,
    createWeapon: (s, l) => new FeatherWeapon(s, l),
  },
  {
    id: 'tornado',
    name: '회오리',
    icon: 'tornado',
    desc: (l) => `바라보는 쪽으로 회오리 ${1 + every(l, 7)}개 · 지나가며 계속 피해 ${pct(0.6 * skillPower(l))}`,
    learnCost: 40,
    createWeapon: (s, l) => new TornadoWeapon(s, l),
  },
  {
    id: 'egg',
    name: '알 폭탄',
    icon: 'egg',
    desc: (l) => `적 무리에 알 ${1 + every(l, 6)}개를 던져 폭발 · 피해 ${pct(1.4 * skillPower(l))}`,
    learnCost: 80,
    createWeapon: (s, l) => new EggWeapon(s, l),
  },
  {
    id: 'flame',
    name: '화염 폭발',
    icon: 'flame',
    desc: (l) => `주변을 불꽃으로 밀어낸다 · 범위 ${60 + 3 * l} · 피해 ${pct(1.2 * skillPower(l))}`,
    learnCost: 120,
    createWeapon: (s, l) => new FlameWeapon(s, l),
  },
  {
    id: 'ice',
    name: '얼음 결정',
    icon: 'ice',
    desc: (l) => `적 ${2 + every(l, 5)}마리 발밑에 얼음 · 피해 ${pct(1.1 * skillPower(l))}, 느려짐`,
    learnCost: 200,
    createWeapon: (s, l) => new IceWeapon(s, l),
  },
  {
    id: 'heal',
    name: '치유',
    icon: 'heal',
    desc: (l) => `6초마다 최대 체력의 ${(4 + 0.5 * l).toFixed(1)}% 회복`,
    learnCost: 150,
    createWeapon: (s, l) => new HealWeapon(s, l),
  },
  {
    id: 'fire',
    name: '화염구',
    icon: 'fire',
    desc: (l) => `맞으면 터지는 화염구 ${1 + every(l, 8)}개 · 피해 ${pct(1.6 * skillPower(l))}`,
    learnCost: 300,
    createWeapon: (s, l) => new FireballWeapon(s, l),
  },
  {
    id: 'dark',
    name: '암흑 구체',
    icon: 'dark',
    desc: (l) => `주위를 도는 구체 ${2 + every(l, 5)}개 · 피해 ${pct(0.5 * skillPower(l))}`,
    learnCost: 500,
    createWeapon: (s, l) => new DarkOrbWeapon(s, l),
  },
];

export const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s])) as Record<SkillId, SkillDef>;

/** level → level+1 비용 (0 → 1은 배우기) */
export function skillCost(def: SkillDef, level: number) {
  if (level === 0) return def.learnCost;
  return Math.max(10, def.learnCost) * 0.6 * Math.pow(1.3, level - 1);
}
