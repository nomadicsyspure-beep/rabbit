import type { EnemyLook } from '../battle/engine';

// 보스 레이드: 보스를 골라서 들어간다. 보스마다 그림·크기·패턴·보상이 다르다.
// 패턴 번호 (battle/engine.ts updateRaidBoss): 0 장판 · 1 나선 탄막 · 2 돌진 · 3 졸개 소환 · 4 사방 탄막

export interface RaidBossDef {
  id: string;
  name: string;
  /** 몬스터 그림 (그림이름@색상 가능) */
  skin: EnemyLook;
  desc: string;
  /** 난이도 별 (1~5) */
  stars: number;
  hpMul: number;
  dmgMul: number;
  speed: number;
  r: number;
  pats: number[];
  /** 졸개 그림 */
  minion: EnemyLook;
  /** 이기면: 보스의 정수, 다이아 */
  essence: number;
  diamonds: number;
}

export const RAID_BOSSES: RaidBossDef[] = [
  { id: 'devil', name: '꼬마 마왕', skin: 'devil', desc: '장판·나선 탄막·돌진·박쥐 소환을 골고루', stars: 1, hpMul: 1, dmgMul: 1, speed: 42, r: 38, pats: [0, 1, 2, 3], minion: 'bat', essence: 3, diamonds: 0 },
  { id: 'mushroom', name: '버섯 대왕', skin: 'mushroom@330', desc: '독 장판을 마구 깔고 새싹을 부른다', stars: 2, hpMul: 1.25, dmgMul: 1.05, speed: 36, r: 42, pats: [0, 0, 3, 4], minion: 'sprout', essence: 3, diamonds: 15 },
  { id: 'bat', name: '박쥐 여왕', skin: 'bat@300', desc: '빠르다! 나선 탄막과 돌진, 박쥐 떼', stars: 3, hpMul: 1.1, dmgMul: 1.1, speed: 75, r: 36, pats: [1, 2, 3, 2], minion: 'bat@300', essence: 4, diamonds: 20 },
  { id: 'golem', name: '바위 골렘', skin: 'golem@25', desc: '느리지만 엄청 단단하다. 낙석 장판·돌진·사방 탄막', stars: 4, hpMul: 2, dmgMul: 1.4, speed: 28, r: 50, pats: [0, 2, 4, 2], minion: 'snail', essence: 5, diamonds: 30 },
  { id: 'angel', name: '타락 천사', skin: 'angel@280', desc: '탄막 지옥. 나선·사방 탄막을 쉬지 않고', stars: 5, hpMul: 1.6, dmgMul: 1.3, speed: 48, r: 40, pats: [1, 4, 1, 3, 4], minion: 'angel@280', essence: 6, diamonds: 40 },
];

export const RAID_BY_ID = Object.fromEntries(RAID_BOSSES.map((b) => [b.id, b])) as Record<string, RaidBossDef>;
