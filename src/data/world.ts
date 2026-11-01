import type { EnemySkin } from '../battle/engine';
import { BOSS_EVERY } from './balance';

// 지역(10스테이지마다).

export type MatId = 'feather' | 'spore' | 'ice' | 'lava' | 'shadow' | 'skillbook' | 'key_silver' | 'key_gold';

export interface Region {
  name: string;
  /** 바닥 색: 바탕 / 큰 얼룩 두 가지 / 작은 자갈 두 가지 */
  ground: [string, string, string, string, string];
  /** 지역 몹 (스테이지마다 돌아가며 고른다) */
  normal: EnemySkin[];
  fast: EnemySkin[];
  tank: EnemySkin[];
  /** 이 지역 상자에서 나오는 재료 */
  mat: MatId;
}

export const REGIONS: Region[] = [
  {
    name: '흙길 들판',
    ground: ['#7f5a3a', 'rgba(98,68,42,0.2)', 'rgba(150,112,74,0.15)', 'rgba(60,40,24,0.45)', 'rgba(186,150,108,0.45)'],
    normal: ['slime', 'sprout'], fast: ['bat'], tank: ['snail'], mat: 'feather',
  },
  {
    name: '버섯 숲',
    ground: ['#5c6b34', 'rgba(40,60,20,0.25)', 'rgba(120,140,70,0.18)', 'rgba(30,45,15,0.5)', 'rgba(170,190,110,0.4)'],
    normal: ['mushroom', 'sprout'], fast: ['bat', 'angel'], tank: ['golem'], mat: 'spore',
  },
  {
    name: '눈 덮인 언덕',
    ground: ['#c9d3de', 'rgba(150,170,195,0.25)', 'rgba(255,255,255,0.3)', 'rgba(120,140,170,0.45)', 'rgba(255,255,255,0.6)'],
    normal: ['slime'], fast: ['angel'], tank: ['golem'], mat: 'ice',
  },
  {
    name: '불타는 화산',
    ground: ['#5a2e22', 'rgba(30,10,5,0.3)', 'rgba(160,60,20,0.2)', 'rgba(255,120,30,0.5)', 'rgba(20,8,4,0.6)'],
    normal: ['mushroom'], fast: ['bat'], tank: ['golem', 'snail'], mat: 'lava',
  },
  {
    name: '어둠의 성',
    ground: ['#3a2d48', 'rgba(20,10,35,0.3)', 'rgba(110,70,150,0.2)', 'rgba(160,100,220,0.45)', 'rgba(15,8,25,0.6)'],
    normal: ['sprout', 'slime'], fast: ['angel', 'bat'], tank: ['golem'], mat: 'shadow',
  },
];

/** 스테이지 → 지역 번호 (지역 5개를 계속 돈다) */
export const regionIndex = (stage: number) => Math.floor((Math.max(1, stage) - 1) / BOSS_EVERY) % REGIONS.length;
export const regionOf = (stage: number) => REGIONS[regionIndex(stage)];
/** 지역을 몇 바퀴 돌았나 (재료 양 등에 쓴다) */
export const regionLap = (stage: number) => Math.floor((Math.max(1, stage) - 1) / (BOSS_EVERY * REGIONS.length));

/** 스테이지 몹 외형 (일반 / 빠른 / 단단한) */
export function stageSkins(stage: number): Record<'normal' | 'fast' | 'tank', EnemySkin> {
  const r = regionOf(stage);
  const i = Math.max(1, stage) - 1;
  return { normal: r.normal[i % r.normal.length], fast: r.fast[i % r.fast.length], tank: r.tank[i % r.tank.length] };
}
