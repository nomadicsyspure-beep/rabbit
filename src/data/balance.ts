// 수치 공식. 밸런스 조정은 이 파일에서만 한다.
// 스테이지는 액션 모드로 직접 깨고, 방치는 깬 최고 스테이지 기준으로 재화만 쌓인다.

export const BOSS_EVERY = 10;
export const TAP_DAMAGE_MUL = 0.5;
export const OFFLINE_CAP_SEC = 8 * 60 * 60;
export const OFFLINE_EFFICIENCY = 0.5;

export const isBossStage = (stage: number) => stage % BOSS_EVERY === 0;


export const enemyHp = (stage: number) => 10 * Math.pow(1.17, stage - 1);
export const enemyDmg = (stage: number) => 4 * Math.pow(1.13, stage - 1);
export const enemyGold = (stage: number) => 3 * Math.pow(1.15, stage - 1);

/** 방치 초당 골드. 아직 아무것도 못 깼어도 1스테이지 기준으로 조금은 쌓인다. */
export const idleGoldPerSec = (maxStage: number) => enemyGold(Math.max(1, maxStage));
/** 스테이지 첫 클리어 보상 */
export const stageClearGold = (stage: number) => enemyGold(stage) * (isBossStage(stage) ? 120 : 40);

/** 초반 스테이지는 쉽게: 스테이지 1은 몹 체력·피해·숫자 EASY_START배, EASY_UNTIL 스테이지부터 원래대로 */
export const EASY_START = 0.5;
export const EASY_UNTIL = 12;
export const stageEase = (stage: number) => Math.min(1, EASY_START + ((1 - EASY_START) * (stage - 1)) / (EASY_UNTIL - 1));

// 액션 모드 진입 시 "권장 전투력" 기준. 내 수치 ÷ 권장 수치 = 비율로 액션 밸런스를 맞춘다.
export const recommendedPower = (stage: number) => enemyHp(stage);
export const recommendedHp = (stage: number) => enemyDmg(stage) * 15;

export type StatId = 'atk' | 'hp' | 'aps' | 'spd';

export interface StatDef {
  id: StatId;
  name: string;
  value: (level: number) => number;
  cost: (level: number) => number;
  maxLevel?: number;
}

export const STATS: Record<StatId, StatDef> = {
  atk: {
    id: 'atk',
    name: '공격력',
    value: (l) => 5 * Math.pow(1.1, l - 1),
    cost: (l) => 6 * Math.pow(1.12, l - 1),
  },
  hp: {
    id: 'hp',
    name: '체력',
    value: (l) => 60 * Math.pow(1.08, l - 1),
    cost: (l) => 8 * Math.pow(1.12, l - 1),
  },
  aps: {
    id: 'aps',
    name: '공격 속도',
    value: (l) => 1 + 0.06 * (l - 1),
    cost: (l) => 20 * Math.pow(1.22, l - 1),
    maxLevel: 51,
  },
  spd: {
    id: 'spd',
    name: '이동 속도',
    value: (l) => 1 + 0.04 * (l - 1),
    cost: (l) => 15 * Math.pow(1.25, l - 1),
    maxLevel: 16,
  },
};

/** 성장 탭에 나오는 능력치 (이동 속도는 뺐다: 레벨 그대로 계산에만) */
export const STAT_ORDER: StatId[] = ['atk', 'hp', 'aps'];

// 캐릭터 레벨: 스테이지에서 모은 경험치 보석으로 영구히 오른다. 레벨마다 공격력·체력 +5%
export const xpToNext = (level: number) => Math.round(40 * Math.pow(1.2, level - 1));
export const levelBonus = (level: number) => 1 + 0.05 * (level - 1);

export interface PlayerStats {
  atk: number;
  hp: number;
  aps: number;
  /** 이동 속도 배율 */
  spd: number;
}

export function playerStats(levels: Record<StatId, number>, charLevel: number): PlayerStats {
  const bonus = levelBonus(charLevel);
  return {
    atk: STATS.atk.value(levels.atk) * bonus,
    hp: STATS.hp.value(levels.hp) * bonus,
    aps: STATS.aps.value(levels.aps),
    spd: STATS.spd.value(levels.spd),
  };
}

export const playerPower = (s: PlayerStats) => s.atk * s.aps;

export interface ActionRatio {
  atk: number;
  hp: number;
}

// 액션 모드에서 쓰는 배율. 너무 약하거나 강해도 게임이 성립하도록 범위를 묶는다.
export function actionRatio(s: PlayerStats, stage: number): ActionRatio {
  return {
    atk: clamp(playerPower(s) / recommendedPower(stage), 0.25, 4),
    hp: clamp(s.hp / recommendedHp(stage), 0.5, 3),
  };
}

export function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}
