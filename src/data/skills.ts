import type { Weapon } from '../battle/engine';
import { DartWeapon, LightningWeapon, OrbitWeapon, PulseWeapon, type WeaponStats } from '../battle/weapons';

// 액션 모드 레벨업 카드로 나오는 스킬 목록.

export const SKILL_MAX_LEVEL = 5;

export interface SkillDef {
  id: string;
  name: string;
  color: string;
  icon: string;
  /** descs[i] = i+1 레벨이 될 때 설명 */
  descs: string[];
  createWeapon?: (stats: WeaponStats) => Weapon;
}

export const SKILLS: SkillDef[] = [
  {
    id: 'dart',
    name: '당근 다트',
    color: '#f0a040',
    icon: '➶',
    descs: ['가까운 적에게 당근을 던진다', '한 번에 2발', '피해 +30%', '3발, 적 1명 관통', '공격 간격 -20%, 피해 증가'],
    createWeapon: (s) => new DartWeapon(s),
  },
  {
    id: 'orbit',
    name: '회전 클로버',
    color: '#6fdc8c',
    icon: '✤',
    descs: ['클로버 2개가 주위를 돈다', '클로버 3개', '피해 +40%', '클로버 4개, 반경 증가', '클로버 5개, 회전 속도 증가'],
    createWeapon: (s) => new OrbitWeapon(s),
  },
  {
    id: 'pulse',
    name: '충격파',
    color: '#7ad7ff',
    icon: '◎',
    descs: ['주기적으로 주변 적을 밀쳐낸다', '범위·피해 증가', '범위·피해 증가', '범위·피해 증가', '쿨다운 감소, 피해 크게 증가'],
    createWeapon: (s) => new PulseWeapon(s),
  },
  {
    id: 'lightning',
    name: '번개',
    color: '#fff27a',
    icon: 'ϟ',
    descs: ['무작위 적에게 번개, 1번 튄다', '2번 튄다', '3번 튄다, 피해 증가', '쿨다운 감소, 피해 증가', '4번 튄다, 피해 크게 증가'],
    createWeapon: (s) => new LightningWeapon(s),
  },
  {
    id: 'swift',
    name: '날쌘 발',
    color: '#ffffff',
    icon: '»',
    descs: ['이동 속도 +12%', '이동 속도 +12%', '이동 속도 +12%', '이동 속도 +12%', '이동 속도 +12%'],
  },
  {
    id: 'magnet',
    name: '당근 자석',
    color: '#4fd1c5',
    icon: '◈',
    descs: ['경험치 획득 범위 +35%', '획득 범위 +35%', '획득 범위 +35%', '획득 범위 +35%', '획득 범위 +35%'],
  },
  {
    id: 'tough',
    name: '튼튼한 몸',
    color: '#ff8fa3',
    icon: '♥',
    descs: ['최대 체력 +20%, 30% 회복', '최대 체력 +20%, 30% 회복', '최대 체력 +20%, 30% 회복', '최대 체력 +20%, 30% 회복', '최대 체력 +20%, 30% 회복'],
  },
];

export const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s])) as Record<string, SkillDef>;
