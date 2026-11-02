// 수치 공식. 밸런스 조정은 이 파일에서만 한다.
// 스테이지는 액션 모드로 직접 깨고, 방치는 깬 최고 스테이지 기준으로 재화만 쌓인다.

/** 한 장(챕터)은 스테이지 3개: X-1 · X-2 · X-3(보스). 스테이지 번호는 안에서 1, 2, 3, 4…로 세고 화면엔 "1-1"처럼 보여 준다 */
export const STAGES_PER_CHAPTER = 3;
export const BOSS_EVERY = STAGES_PER_CHAPTER;
/** 지역(바닥·몹·재료)이 바뀌는 장 수 */
export const CHAPTERS_PER_REGION = 5;
export const STAGES_PER_REGION = STAGES_PER_CHAPTER * CHAPTERS_PER_REGION;
export const TAP_DAMAGE_MUL = 0.5;
export const OFFLINE_CAP_SEC = 8 * 60 * 60;
export const OFFLINE_EFFICIENCY = 0.5;

export const isBossStage = (stage: number) => stage % BOSS_EVERY === 0;
export const chapterOf = (stage: number) => Math.floor((Math.max(1, stage) - 1) / STAGES_PER_CHAPTER) + 1;
export const subOf = (stage: number) => ((Math.max(1, stage) - 1) % STAGES_PER_CHAPTER) + 1;
/** 화면에 보이는 스테이지 이름: 1-1, 1-2, 1-3 … */
export const stageLabel = (stage: number) => `${chapterOf(stage)}-${subOf(stage)}`;
/** 깬 보스(장) 수 */
export const chaptersCleared = (maxStage: number) => Math.floor(Math.max(0, maxStage) / STAGES_PER_CHAPTER);

// 스테이지마다 확실히 세진다: 몹 체력 ×1.4, 피해 ×1.28 (한 장이면 체력 ×2.7)
export const STAGE_HP_STEP = 1.4;
export const STAGE_DMG_STEP = 1.28;
export const enemyHp = (stage: number) => 10 * Math.pow(STAGE_HP_STEP, stage - 1);
export const enemyDmg = (stage: number) => 4 * Math.pow(STAGE_DMG_STEP, stage - 1);

/** 방치 수입은 보스(X-3)를 깰 때만 크게 뛴다: 장 하나에 ×IDLE_JUMP */
export const IDLE_JUMP = 2.4;
const IDLE_BASE = 3;
/** 방치 초당 골드 (깬 보스 수 기준). 아무것도 못 깼어도 조금은 쌓인다 */
export const idleGoldPerSec = (maxStage: number) => IDLE_BASE * Math.pow(IDLE_JUMP, chaptersCleared(maxStage));
/** 몹 한 마리 골드 기준 (그 스테이지 장의 방치 수입 기준, 장 안에서 조금씩) */
export const enemyGold = (stage: number) => IDLE_BASE * Math.pow(IDLE_JUMP, chapterOf(stage) - 1) * Math.pow(1.15, subOf(stage) - 1);
/** 스테이지 클리어 보상 (보스 스테이지는 크게) */
export const stageClearGold = (stage: number) => enemyGold(stage) * (isBossStage(stage) ? 300 : 80);

/** 맨 처음만 살짝 쉽게: 1-1은 몹 체력·피해·숫자 EASY_START배, EASY_UNTIL 스테이지부터 원래대로 */
export const EASY_START = 0.6;
export const EASY_UNTIL = 4;
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
    atk: clamp(playerPower(s) / recommendedPower(stage), 0.15, 3),
    hp: clamp(s.hp / recommendedHp(stage), 0.35, 2.5),
  };
}

export function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}
