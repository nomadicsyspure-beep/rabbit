// 방치 모드 수치 공식. 밸런스 조정은 이 파일에서만 한다.

export const KILLS_PER_STAGE = 10;
export const BOSS_EVERY = 10;
export const TAP_DAMAGE_MUL = 0.5;
export const IDLE_REGEN = 0.04; // 초당 최대 체력 비율
export const OFFLINE_CAP_SEC = 8 * 60 * 60;
export const OFFLINE_EFFICIENCY = 0.5;

export const isBossStage = (stage: number) => stage % BOSS_EVERY === 0;

export const enemyHp = (stage: number) => 10 * Math.pow(1.17, stage - 1);
export const enemyDmg = (stage: number) => 4 * Math.pow(1.13, stage - 1);
export const enemyGold = (stage: number) => 3 * Math.pow(1.15, stage - 1);

// 액션 모드 진입 시 "권장 전투력" 기준. 내 수치 ÷ 권장 수치 = 비율로 액션 밸런스를 맞춘다.
export const recommendedPower = (stage: number) => enemyHp(stage);
export const recommendedHp = (stage: number) => enemyDmg(stage) * 15;

export type StatId = 'atk' | 'hp' | 'aps';

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
};

export const STAT_ORDER: StatId[] = ['atk', 'hp', 'aps'];

export interface PlayerStats {
  atk: number;
  hp: number;
  aps: number;
}

export function playerStats(levels: Record<StatId, number>): PlayerStats {
  return {
    atk: STATS.atk.value(levels.atk),
    hp: STATS.hp.value(levels.hp),
    aps: STATS.aps.value(levels.aps),
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
