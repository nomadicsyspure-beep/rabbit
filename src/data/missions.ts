import type { SaveData } from '../core/save';
import { emptyReward, type Reward } from './items';

// 일일 미션 · 출석 · 업적 · 패스. 보상은 대부분 다이아.

export type DailyKey = 'kills' | 'plays' | 'chests' | 'fevers' | 'upgrades' | 'summons';

export interface DailyState {
  /** 이 날짜(YYYY-MM-DD)의 기록. 날짜가 바뀌면 처음부터 */
  date: string;
  counts: Record<DailyKey, number>;
  /** 받은 미션 id (all = 모두 완료 보너스) */
  claimed: string[];
  /** 오늘 본 광고 수 */
  ads: number;
}

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const emptyDaily = (): DailyState => ({
  date: today(),
  counts: { kills: 0, plays: 0, chests: 0, fevers: 0, upgrades: 0, summons: 0 },
  claimed: [],
  ads: 0,
});

/** 날짜가 바뀌었으면 일일 기록을 새로 */
export function freshDaily(save: SaveData) {
  if (save.daily.date !== today()) save.daily = emptyDaily();
  return save.daily;
}

export function addDaily(save: SaveData, key: DailyKey, n = 1) {
  freshDaily(save).counts[key] += n;
}

export interface MissionDef {
  id: DailyKey;
  name: string;
  goal: number;
  diamonds: number;
}

export const DAILY_MISSIONS: MissionDef[] = [
  { id: 'kills', name: '몹 1,000마리 처치', goal: 1000, diamonds: 20 },
  { id: 'plays', name: '스테이지 3번 도전', goal: 3, diamonds: 20 },
  { id: 'chests', name: '보물 상자 10개 열기', goal: 10, diamonds: 20 },
  { id: 'fevers', name: '피버 2번', goal: 2, diamonds: 20 },
  { id: 'upgrades', name: '강화 20번 (능력치·스킬·장비)', goal: 20, diamonds: 15 },
  { id: 'summons', name: '소환 1번', goal: 1, diamonds: 15 },
];
export const DAILY_ALL_BONUS = 60;
/** 미션 하나 받을 때 패스 경험치 */
export const MISSION_PASS_XP = 20;

// ---- 출석 (7일 반복) ----

export const ATTEND_REWARDS: { label: string; reward: () => Reward; petTicket?: number }[] = [
  { label: '💎 50', reward: () => ({ ...emptyReward(), diamonds: 50 }) },
  { label: '📕 스킬북 2', reward: () => ({ ...emptyReward(), mats: { skillbook: 2 } }) },
  { label: '💎 80', reward: () => ({ ...emptyReward(), diamonds: 80 }) },
  { label: '🪶 재료 묶음', reward: () => ({ ...emptyReward(), mats: { feather: 20, spore: 15, ice: 10 } }) },
  { label: '🐾 동료 소환권', reward: () => emptyReward(), petTicket: 1 },
  { label: '💎 120', reward: () => ({ ...emptyReward(), diamonds: 120 }) },
  { label: '💎 300', reward: () => ({ ...emptyReward(), diamonds: 300 }) },
];

export interface AttendState {
  /** 마지막으로 받은 날짜 */
  last: string;
  /** 받은 날 수 (0부터, 7일마다 반복) */
  days: number;
}

export const canAttend = (save: SaveData) => save.attend.last !== today();

// ---- 업적 (단계별) ----

export interface AchieveDef {
  id: string;
  name: string;
  value: (s: SaveData) => number;
  goals: number[];
  /** 단계마다 다이아 */
  diamonds: number;
}

export const ACHIEVEMENTS: AchieveDef[] = [
  { id: 'kills', name: '몹 처치', value: (s) => s.stats.kills, goals: [1000, 10000, 100000, 1000000], diamonds: 50 },
  { id: 'combo', name: '최고 콤보', value: (s) => s.stats.bestCombo, goals: [100, 300, 1000, 3000], diamonds: 50 },
  { id: 'stage', name: '최고 스테이지', value: (s) => Math.max(s.maxStage, s.bestStageEver), goals: [10, 25, 50, 100], diamonds: 80 },
  { id: 'clears', name: '스테이지 클리어', value: (s) => s.stats.stages, goals: [10, 50, 200, 1000], diamonds: 40 },
  { id: 'fevers', name: '피버', value: (s) => s.stats.fevers, goals: [10, 50, 200], diamonds: 40 },
  { id: 'golden', name: '황금 몹 사냥', value: (s) => s.stats.golden, goals: [5, 30, 100], diamonds: 40 },
  { id: 'chests', name: '보물 상자', value: (s) => s.stats.chests, goals: [30, 300, 2000], diamonds: 40 },
  { id: 'gear', name: '장비 수집', value: (s) => Object.keys(s.gear).length, goals: [3, 8, 17], diamonds: 60 },
  { id: 'pets', name: '동료 수집', value: (s) => Object.keys(s.pets).length, goals: [2, 5, 9], diamonds: 60 },
  { id: 'rebirth', name: '환생', value: (s) => s.rebirth.count, goals: [1, 3, 10], diamonds: 100 },
];

/** 받을 수 있는 업적 단계 수 */
export function achieveReady(save: SaveData, a: AchieveDef) {
  const got = save.achieve[a.id] ?? 0;
  if (got >= a.goals.length) return false;
  return a.value(save) >= a.goals[got];
}

// ---- 패스 ----

export const PASS_LEVELS = 30;
export const PASS_XP_PER_LEVEL = 100;
/** 스테이지 한 번 도전할 때 패스 경험치 */
export const PLAY_PASS_XP = 10;

/** 레벨 lv(1부터)의 무료 보상 */
export function passReward(lv: number): { label: string; reward: Reward } {
  const r = emptyReward();
  if (lv % 10 === 0) {
    r.diamonds = 200;
    return { label: '💎 200', reward: r };
  }
  if (lv % 5 === 0) {
    r.mats.skillbook = 2;
    return { label: '📕 2', reward: r };
  }
  if (lv % 2 === 0) {
    r.diamonds = 30;
    return { label: '💎 30', reward: r };
  }
  r.mats = { feather: 5 + lv, spore: 3 + lv };
  return { label: '🪶 재료', reward: r };
}

export const passLevel = (save: SaveData) => Math.min(PASS_LEVELS, Math.floor(save.pass.xp / PASS_XP_PER_LEVEL));
