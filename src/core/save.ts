import type { SkillTree } from '../battle/weapons';
import type { StatId } from '../data/balance';
import { EQUIP_SLOTS, SKILL_BY_ID, emptyTree, type SkillId } from '../data/skills';
import type { GearSlot } from '../data/gear';
import type { MatId } from '../data/world';
import { emptyDaily, type AttendState, type DailyState } from '../data/missions';

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
  /** 스테이지 설정: 자동 이동 / 스킬 자동 발동 (끄면 스킬 칸을 눌러 쓴다) */
  autoMove: boolean;
  autoSkills: boolean;
  /** 재료 (보물 상자에서) */
  mats: Partial<Record<MatId, number>>;
  /** 다이아 (고급 재화: 금 상자·황금 몹·미션) */
  diamonds: number;
  /** 누적 기록 (업적·미션용) */
  stats: { kills: number; bestCombo: number; fevers: number; chests: number; golden: number; stages: number };
  sound: boolean;
  /** 가진 장비 → 강화 단계 / 착용 중인 장비 */
  gear: Record<string, number>;
  wear: Partial<Record<GearSlot, string>>;
  /** 도감: 처음 잡은 몹 외형, 처음 만든 장비 */
  seen: { monsters: string[]; gear: string[] };
  /** 환생: 횟수, 남은 환생 깃털, 깃털로 올린 영구 강화 */
  rebirth: { count: number; feathers: number; ups: { atk: number; gold: number; xp: number } };
  /** 보스의 정수 (보스 레이드) */
  essence: number;
  /** 환생해도 남는 역대 최고 스테이지 (업적용) */
  bestStageEver: number;
  /** 동료: 가진 동료 → 레벨 / 데리고 다니는 동료 */
  pets: Record<string, number>;
  petsOn: string[];
  /** 소환권 (출석 보상) */
  tickets: { pet: number; gear: number };
  /** 꾸미기: 가진 색과 쓰는 색 */
  skins: { chick: string[]; fx: string[]; chickOn: string; fxOn: string };
  daily: DailyState;
  attend: AttendState;
  /** 업적 id → 받은 단계 수 */
  achieve: Record<string, number>;
  /** 패스: 경험치, 무료 보상 받은 레벨 */
  pass: { xp: number; claimed: number[] };
  /** 무한 모드 최고 기록(초) */
  infiniteBest: number;
  /** 튜토리얼 단계 (-1 = 끝) */
  tutorial: number;
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
    autoMove: false,
    autoSkills: true,
    mats: {},
    diamonds: 0,
    stats: { kills: 0, bestCombo: 0, fevers: 0, chests: 0, golden: 0, stages: 0 },
    sound: true,
    gear: {},
    wear: {},
    seen: { monsters: [], gear: [] },
    rebirth: { count: 0, feathers: 0, ups: { atk: 0, gold: 0, xp: 0 } },
    essence: 0,
    bestStageEver: 0,
    pets: {},
    petsOn: [],
    tickets: { pet: 0, gear: 0 },
    skins: { chick: ['basic'], fx: ['basic'], chickOn: 'basic', fxOn: 'basic' },
    daily: emptyDaily(),
    attend: { last: '', days: 0 },
    achieve: {},
    pass: { xp: 0, claimed: [] },
    infiniteBest: 0,
    tutorial: 0,
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
    // 형태마다 한 칸 (예전 저장은 같은 형태가 여럿일 수 있어서 처음 것만 남긴다)
    const seenType = new Set<string>();
    const equipped = (data.equipped ?? base.equipped)
      .filter((id) => SKILL_BY_ID[id] && skills[id])
      .filter((id) => !seenType.has(SKILL_BY_ID[id].type) && !!seenType.add(SKILL_BY_ID[id].type))
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
      autoMove: data.autoMove ?? base.autoMove,
      autoSkills: data.autoSkills ?? base.autoSkills,
      mats: { ...data.mats },
      diamonds: data.diamonds ?? 0,
      stats: { ...base.stats, ...data.stats },
      sound: data.sound ?? true,
      gear: { ...data.gear },
      wear: { ...data.wear },
      seen: { monsters: [...(data.seen?.monsters ?? [])], gear: [...(data.seen?.gear ?? [])] },
      rebirth: { ...base.rebirth, ...data.rebirth, ups: { ...base.rebirth.ups, ...data.rebirth?.ups } },
      essence: data.essence ?? 0,
      bestStageEver: Math.max(data.bestStageEver ?? 0, data.maxStage ?? 0),
      pets: { ...data.pets },
      petsOn: [...(data.petsOn ?? ((data as { pet?: string }).pet ? [(data as { pet?: string }).pet!] : []))],
      tickets: { ...base.tickets, ...data.tickets },
      skins: { ...base.skins, ...data.skins },
      daily: data.daily
        ? { ...base.daily, ...data.daily, counts: { ...base.daily.counts, ...data.daily.counts }, entries: { ...base.daily.entries, ...data.daily.entries } }
        : base.daily,
      attend: { ...base.attend, ...data.attend },
      achieve: { ...data.achieve },
      pass: { ...base.pass, ...data.pass },
      infiniteBest: data.infiniteBest ?? 0,
      // 이미 하던 사람은 튜토리얼 없이
      tutorial: data.tutorial ?? ((data.maxStage ?? 0) > 0 ? -1 : 0),
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
