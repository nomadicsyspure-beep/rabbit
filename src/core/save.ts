import type { SkillTree } from '../battle/weapons';
import type { StatId } from '../data/balance';
import { EQUIP_SLOTS, SKILL_BY_ID, emptyTree, type SkillId } from '../data/skills';

const KEY = 'rabbit.save.v1';

export interface SaveData {
  v: 4;
  gold: number;
  /** 직접 클리어한 최고 스테이지 (0 = 아직 없음). 방치 수입은 이 값으로 정해진다. */
  maxStage: number;
  levels: Record<StatId, number>;
  lastSeen: number;
  bossKills: number;
  /** 캐릭터 레벨과 그 레벨 안에서 모은 경험치 (스테이지의 경험치 보석) */
  level: number;
  xp: number;
  /** 배운 스킬의 가지별 강화 단계 (없으면 아직 안 배움) */
  skills: Partial<Record<SkillId, SkillTree>>;
  /** 장착한 스킬 (최대 EQUIP_SLOTS개). 스테이지에서는 이것만 발동한다 */
  equipped: SkillId[];
}

export function newSave(): SaveData {
  return {
    v: 4,
    gold: 0,
    maxStage: 0,
    levels: { atk: 1, hp: 1, aps: 1, spd: 1 },
    lastSeen: Date.now(),
    bossKills: 0,
    level: 1,
    xp: 0,
    skills: { feather: emptyTree() },
    equipped: ['feather'],
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return newSave();
    const data = JSON.parse(raw) as Partial<Omit<SaveData, 'v' | 'skills'>> & {
      v?: number;
      stage?: number;
      skills?: Record<string, SkillTree | number>;
    };
    // v1은 방치 모드가 스테이지를 올렸다. 현재 스테이지 바로 전까지 깬 것으로 본다.
    if (data.v === 1) data.maxStage = Math.max(0, (data.stage ?? 1) - 1);
    else if (data.v !== 2 && data.v !== 3 && data.v !== 4) return newSave();
    const base = newSave();
    const skills: SaveData['skills'] = { ...base.skills };
    for (const [id, v] of Object.entries(data.skills ?? {})) {
      if (!SKILL_BY_ID[id as SkillId]) continue;
      // v3는 스킬마다 레벨 하나였다: 그만큼 피해 가지로 옮긴다
      if (typeof v === 'number') {
        if (v > 0) skills[id as SkillId] = { ...emptyTree(), dmg: v - 1 };
      } else {
        skills[id as SkillId] = { ...emptyTree(), ...v };
      }
    }
    const equipped = (data.equipped ?? base.equipped)
      .filter((id) => SKILL_BY_ID[id] && skills[id])
      .slice(0, EQUIP_SLOTS);
    return {
      ...base,
      gold: data.gold ?? 0,
      maxStage: data.maxStage ?? 0,
      levels: { ...base.levels, ...data.levels },
      lastSeen: data.lastSeen ?? base.lastSeen,
      bossKills: data.bossKills ?? 0,
      level: data.level ?? 1,
      xp: data.xp ?? 0,
      skills,
      equipped,
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
