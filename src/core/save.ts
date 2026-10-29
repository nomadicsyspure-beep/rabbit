import type { StatId } from '../data/balance';

const KEY = 'rabbit.save.v1';

export interface SaveData {
  v: 1;
  gold: number;
  /** 현재 도달한 스테이지. 보스 스테이지면 액션 모드로 클리어해야 다음으로 넘어간다. */
  stage: number;
  /** 현재 스테이지에서 잡은 수 */
  kills: number;
  levels: Record<StatId, number>;
  lastSeen: number;
  bossKills: number;
}

export function newSave(): SaveData {
  return {
    v: 1,
    gold: 0,
    stage: 1,
    kills: 0,
    levels: { atk: 1, hp: 1, aps: 1 },
    lastSeen: Date.now(),
    bossKills: 0,
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return newSave();
    const data = JSON.parse(raw) as Partial<SaveData>;
    if (data.v !== 1) return newSave();
    const base = newSave();
    return { ...base, ...data, levels: { ...base.levels, ...data.levels } };
  } catch {
    return newSave();
  }
}

export function writeSave(save: SaveData) {
  save.lastSeen = Date.now();
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // 시크릿 모드 등에서 저장이 막혀도 게임은 계속 돌아가게 둔다.
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 무시
  }
}
