import type { StatId } from '../data/balance';

const KEY = 'rabbit.save.v1';

export interface SaveData {
  v: 2;
  gold: number;
  /** 직접 클리어한 최고 스테이지 (0 = 아직 없음). 방치 수입은 이 값으로 정해진다. */
  maxStage: number;
  levels: Record<StatId, number>;
  lastSeen: number;
  bossKills: number;
}

export function newSave(): SaveData {
  return {
    v: 2,
    gold: 0,
    maxStage: 0,
    levels: { atk: 1, hp: 1, aps: 1 },
    lastSeen: Date.now(),
    bossKills: 0,
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return newSave();
    const data = JSON.parse(raw) as Partial<Omit<SaveData, 'v'>> & { v?: number; stage?: number };
    // v1은 방치 모드가 스테이지를 올렸다. 현재 스테이지 바로 전까지 깬 것으로 본다.
    if (data.v === 1) data.maxStage = Math.max(0, (data.stage ?? 1) - 1);
    else if (data.v !== 2) return newSave();
    const base = newSave();
    return {
      ...base,
      gold: data.gold ?? 0,
      maxStage: data.maxStage ?? 0,
      levels: { ...base.levels, ...data.levels },
      lastSeen: data.lastSeen ?? base.lastSeen,
      bossKills: data.bossKills ?? 0,
    };
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
