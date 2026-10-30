import { sfx } from './audio/sfx';
import { AutoPilot, Joystick } from './battle/controllers';
import { Engine } from './battle/engine';
import { Renderer } from './battle/renderer';
import { clearSave, loadSave, writeSave, type SaveData } from './core/save';
import {
  OFFLINE_CAP_SEC, OFFLINE_EFFICIENCY, STATS, idleGoldPerSec, playerStats, xpToNext, type StatId,
} from './data/balance';
import {
  BRANCHES, EQUIP_SLOTS, SKILL_BY_ID, branchCost, emptyTree, learnPrice, type Branch, type SkillId,
} from './data/skills';
import { GEAR, GEAR_BY_ID, GEAR_MAX, enhanceCost, gearScale, type GearSlot } from './data/gear';
import { type Reward } from './data/items';
import { PET_BY_ID, PET_MAX, petValue } from './data/pets';
import { CHICK_SKIN_BY_ID, FX_SKIN_BY_ID, rollGear, rollPet, skinPrice, summonCost } from './data/shop';
import {
  ACHIEVEMENTS, ATTEND_REWARDS, DAILY_ALL_BONUS, DAILY_MISSIONS, MISSION_PASS_XP, PASS_LEVELS, achieveReady, addDaily,
  canAttend, freshDaily, passLevel, passReward, today, type DailyKey,
} from './data/missions';
import type { PetDef } from './data/pets';
import type { GearDef } from './data/gear';
import type { MatId } from './data/world';
import { ActionMode, type RunKind } from './modes/action';
import { IdleMode } from './modes/idle';
import { UI } from './ui/ui';

const AUTOSAVE_SEC = 10;
/** 도감 하나당 공격력·체력 +1% */
export const COLLECTION_BONUS = 0.01;
/** 환생 가능한 최고 스테이지 */
export const REBIRTH_MIN_STAGE = 20;
/** 환생 깃털로 올리는 영구 강화 (레벨당) */
export const REBIRTH_UPS = {
  atk: { name: '공격력', per: 0.1 },
  gold: { name: '골드', per: 0.15 },
  xp: { name: '경험치', per: 0.15 },
} as const;
export type RebirthUp = keyof typeof REBIRTH_UPS;
const OFFLINE_MIN_SEC = 60;
/** 하루 입장 횟수: 재료 던전 / 보스 레이드 */
export const DUNGEON_DAILY = { material: 2, raid: 3 } as const;

export type Mode = 'idle' | 'action';

export class Game {
  readonly engine = new Engine();
  readonly joystick = new Joystick();
  /** 스테이지 조종: 자동 이동이 켜져 있으면 손을 뗐을 때 알아서 움직인다 */
  readonly pilot = new AutoPilot(this.joystick);
  readonly save: SaveData = loadSave();
  readonly idle = new IdleMode(this);
  readonly action = new ActionMode(this);
  readonly ui: UI;
  mode: Mode = 'idle';

  private readonly renderer: Renderer;
  private readonly canvas: HTMLCanvasElement;
  private last = 0;
  private saveT = 0;
  private resetting = false;
  /** 가로 모드 버튼으로 가로 고정 중인지 */
  landscapeLocked = false;

  constructor(root: HTMLElement) {
    this.ui = new UI(this, root);
    this.canvas = this.ui.canvas;
    this.renderer = new Renderer(this.canvas);
    this.bindInput();
    sfx.setEnabled(this.save.sound);
    this.applySkins();
    // 브라우저는 첫 터치 뒤에야 소리를 낼 수 있다
    window.addEventListener('pointerdown', () => sfx.unlock(), { once: true });
    this.bindLifecycle();

    new ResizeObserver(() => this.resize()).observe(this.ui.battle);
    this.resize();
    this.idle.enter();
    this.grantOffline(this.save.lastSeen);

    requestAnimationFrame((t) => this.frame(t));
  }

  private resize() {
    const rect = this.ui.battle.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    this.engine.viewW = w;
    this.engine.viewH = h;
    this.renderer.resize(w, h);
    if (this.mode === 'idle') this.idle.resize(w, h);
  }

  /** 다음에 도전할 스테이지 */
  get nextStage() {
    return this.save.maxStage + 1;
  }

  get goldPerSec() {
    return idleGoldPerSec(this.save.maxStage) * this.bonus.gold;
  }

  private frame(t: number) {
    const dt = this.last ? Math.min((t - this.last) / 1000, 0.05) : 0;
    this.last = t;

    // 방치 수입은 어느 화면에 있든 최고 스테이지 기준으로 계속 쌓인다
    this.save.gold += this.goldPerSec * dt;

    if (this.mode === 'idle') {
      this.idle.update(dt);
      this.engine.update(dt);
    } else if (this.action.running) {
      this.action.update(dt);
      if (this.action.running) this.engine.update(dt);
    }

    this.renderer.draw(this.engine, this.mode === 'action' ? this.joystick : null);
    this.ui.tick(dt);

    this.saveT += dt;
    if (this.saveT >= AUTOSAVE_SEC) this.persist();

    requestAnimationFrame((n) => this.frame(n));
  }

  persist() {
    this.saveT = 0;
    if (!this.resetting) writeSave(this.save);
  }

  resetSave() {
    // 새로고침 직전 pagehide 저장이 지운 데이터를 되살리지 않게 막는다
    this.resetting = true;
    clearSave();
    location.reload();
  }

  // ---- 모드 전환 ----

  /** 오늘 남은 입장 횟수 */
  entriesLeft(kind: 'material' | 'raid') {
    return DUNGEON_DAILY[kind] - freshDaily(this.save).entries[kind];
  }

  /** 스테이지·던전 입장. 던전은 최고 스테이지 난이도로, 하루 횟수가 남아 있어야 한다 */
  enterAction(kind: RunKind = 'stage') {
    if ((kind === 'material' || kind === 'raid') && this.entriesLeft(kind) <= 0) {
      this.ui.toast('오늘 입장 횟수를 다 썼어요');
      return;
    }
    if (kind === 'material' || kind === 'raid') this.save.daily.entries[kind]++;
    this.persist();
    this.mode = 'action';
    this.ui.setMode('action');
    sfx.setCombat(true);
    this.resize();
    this.action.enter(kind === 'stage' ? this.nextStage : Math.max(1, this.save.maxStage), kind);
  }

  enterIdle() {
    this.exitLandscape();
    this.mode = 'idle';
    this.ui.setMode('idle');
    sfx.setCombat(false);
    this.resize();
    this.idle.enter();
    this.persist();
  }

  // ---- 강화 ----

  statCost(id: StatId) {
    return STATS[id].cost(this.save.levels[id]);
  }

  canUpgrade(id: StatId) {
    const def = STATS[id];
    const lv = this.save.levels[id];
    if (def.maxLevel && lv >= def.maxLevel) return false;
    return this.save.gold >= def.cost(lv);
  }

  upgrade(id: StatId): boolean {
    if (!this.canUpgrade(id)) return false;
    this.save.gold -= this.statCost(id);
    this.save.levels[id]++;
    addDaily(this.save, 'upgrades');
    this.idle.refreshStats();
    return true;
  }

  // ---- 장비 ----

  canCraft(id: string) {
    const def = GEAR_BY_ID[id];
    const s = this.save;
    return s.gear[id] === undefined && (s.mats[def.mat] ?? 0) >= def.matCost && s.gold >= def.goldCost && s.essence >= (def.essence ?? 0);
  }

  /** 만들기. 빈 부위면 바로 착용, 도감에 등록 */
  craftGear(id: string): boolean {
    if (!this.canCraft(id)) return false;
    const def = GEAR_BY_ID[id];
    const s = this.save;
    s.mats[def.mat] = (s.mats[def.mat] ?? 0) - def.matCost;
    s.gold -= def.goldCost;
    s.essence -= def.essence ?? 0;
    s.gear[id] = 0;
    if (!s.wear[def.slot]) s.wear[def.slot] = id;
    if (!s.seen.gear.includes(id)) s.seen.gear.push(id);
    this.applyLook();
    this.idle.refreshStats();
    return true;
  }

  canEnhance(id: string) {
    const plus = this.save.gear[id];
    if (plus === undefined || plus >= GEAR_MAX) return false;
    const def = GEAR_BY_ID[id];
    const c = enhanceCost(def, plus);
    const s = this.save;
    return (s.mats[def.mat] ?? 0) >= c.mat && s.gold >= c.gold && s.essence >= c.essence;
  }

  enhanceGear(id: string): boolean {
    if (!this.canEnhance(id)) return false;
    const def = GEAR_BY_ID[id];
    const s = this.save;
    const c = enhanceCost(def, s.gear[id]);
    s.mats[def.mat] = (s.mats[def.mat] ?? 0) - c.mat;
    s.gold -= c.gold;
    s.essence -= c.essence;
    s.gear[id]++;
    addDaily(s, 'upgrades');
    this.idle.refreshStats();
    return true;
  }

  /** 착용 / 같은 걸 다시 누르면 해제 */
  toggleWear(id: string) {
    const def = GEAR_BY_ID[id];
    if (this.save.gear[id] === undefined) return;
    this.save.wear[def.slot] = this.save.wear[def.slot] === id ? undefined : id;
    this.applyLook();
    this.idle.refreshStats();
  }

  /** 착용한 부위의 장비와 강화 단계 */
  worn(slot: GearSlot) {
    const id = this.save.wear[slot];
    return id && GEAR_BY_ID[id] ? { def: GEAR_BY_ID[id], plus: this.save.gear[id] ?? 0 } : null;
  }

  /** 장비·도감·환생을 합친 배율. 공격력/체력 배율, 장신구 효과, 무기의 공짜 스킬 */
  get bonus() {
    const s = this.save;
    const col = 1 + COLLECTION_BONUS * this.collectionCount;
    const b = {
      atk: col * (1 + REBIRTH_UPS.atk.per * s.rebirth.ups.atk),
      hp: col,
      gold: 1 + REBIRTH_UPS.gold.per * s.rebirth.ups.gold,
      magnet: 1, chest: 0, combo: 0, fever: 1, crit: 0, speed: 0,
      weapon: null as { skill: SkillId; plus: number } | null,
    };
    const w = this.worn('weapon');
    if (w) {
      b.atk *= 1 + w.def.atk! * gearScale(w.plus);
      if (w.def.bonusSkill) b.weapon = { skill: w.def.bonusSkill, plus: w.plus };
    }
    const hat = this.worn('hat');
    if (hat) b.hp *= 1 + hat.def.hp! * gearScale(hat.plus);
    // 장신구·등 장비 효과
    for (const slot of ['acc', 'back'] as const) {
      const it = this.worn(slot);
      if (!it) continue;
      const v = it.def.value! * gearScale(it.plus);
      if (it.def.effect === 'magnet') b.magnet += v;
      else if (it.def.effect === 'chest') b.chest += v;
      else if (it.def.effect === 'combo') b.combo += v;
      else if (it.def.effect === 'fever') b.fever += v;
      else if (it.def.effect === 'gold') b.gold *= 1 + v;
      else if (it.def.effect === 'crit') b.crit += v;
      else if (it.def.effect === 'speed') b.speed += v;
    }
    const pet = this.petInfo;
    if (pet) {
      const v = petValue(pet.def, pet.level);
      const a = pet.def.ability;
      if (a === 'magnet') b.magnet += v;
      else if (a === 'gold') b.gold *= 1 + v;
      else if (a === 'chest') b.chest += v;
      else if (a === 'hp') b.hp *= 1 + v;
      else if (a === 'crit') b.crit += v;
      else if (a === 'fever') b.fever += v;
    }
    return b;
  }

  /** 능력치 (강화 + 레벨 + 장비·도감·환생) */
  get stats() {
    const st = playerStats(this.save.levels, this.save.level);
    const b = this.bonus;
    return { ...st, atk: st.atk * b.atk, hp: st.hp * b.hp };
  }

  // ---- 도감 ----

  get collectionCount() {
    return this.save.seen.monsters.length + this.save.seen.gear.length;
  }

  /** 처음 잡은 몹 등록 */
  seeMonster(skin: string) {
    if (!this.save.seen.monsters.includes(skin)) {
      this.save.seen.monsters.push(skin);
      this.ui.toast(`도감 등록: 새 몬스터! (공격력·체력 +${Math.round(COLLECTION_BONUS * 100)}%)`);
    }
  }

  // ---- 환생 ----

  /** 지금 환생하면 받는 깃털 (최고 스테이지가 높을수록 많이) */
  get rebirthGain() {
    const m = this.save.maxStage;
    return m < REBIRTH_MIN_STAGE ? 0 : Math.floor(m / 5 + (m * m) / 200);
  }

  /** 환생: 골드·최고 스테이지·능력치 강화가 처음으로. 스킬·장비·재료·다이아·레벨은 남는다 */
  rebirth() {
    const gain = this.rebirthGain;
    if (gain <= 0) return false;
    const s = this.save;
    s.rebirth.count++;
    s.rebirth.feathers += gain;
    s.gold = 0;
    s.maxStage = 0;
    s.levels = { atk: 1, hp: 1, aps: 1, spd: 1 };
    this.idle.enter();
    this.persist();
    return true;
  }

  rebirthUpCost(kind: RebirthUp) {
    return this.save.rebirth.ups[kind] + 1;
  }

  upgradeRebirth(kind: RebirthUp) {
    const cost = this.rebirthUpCost(kind);
    if (this.save.rebirth.feathers < cost) return false;
    this.save.rebirth.feathers -= cost;
    this.save.rebirth.ups[kind]++;
    this.idle.refreshStats();
    return true;
  }

  // ---- 동료 ----

  /** 데리고 다니는 동료와 레벨 */
  get petInfo() {
    const id = this.save.pet;
    return id && PET_BY_ID[id] && this.save.pets[id] ? { def: PET_BY_ID[id], level: this.save.pets[id] } : null;
  }

  /** 데리고 다니기 / 같은 걸 다시 누르면 집에 두기 */
  togglePet(id: string) {
    if (!this.save.pets[id]) return;
    this.save.pet = this.save.pet === id ? null : id;
    if (this.mode === 'idle') this.idle.enter();
  }

  /** 동료 하나 얻기: 새로 얻으면 Lv 1, 겹치면 레벨 업 (최대면 다이아로) */
  private gainPet(def: PetDef) {
    const s = this.save;
    const lv = s.pets[def.id];
    if (!lv) {
      s.pets[def.id] = 1;
      if (!s.pet) s.pet = def.id;
      return { def, text: 'NEW!', isNew: true };
    }
    if (lv < PET_MAX) {
      s.pets[def.id] = lv + 1;
      return { def, text: `Lv ${lv + 1}`, isNew: false };
    }
    s.diamonds += 10;
    return { def, text: '💎 +10', isNew: false };
  }

  /** 장비 하나 얻기: 새로 얻으면 +0, 가지고 있으면 +1 (최대면 재료로) */
  private gainGear(def: GearDef) {
    const s = this.save;
    const plus = s.gear[def.id];
    if (plus === undefined) {
      s.gear[def.id] = 0;
      if (!s.wear[def.slot]) s.wear[def.slot] = def.id;
      if (!s.seen.gear.includes(def.id)) s.seen.gear.push(def.id);
      return { def, text: 'NEW!', isNew: true };
    }
    if (plus < GEAR_MAX) {
      s.gear[def.id] = plus + 1;
      return { def, text: `+${plus + 1}`, isNew: false };
    }
    s.mats[def.mat] = (s.mats[def.mat] ?? 0) + def.matCost;
    return { def, text: `재료 +${def.matCost}`, isNew: false };
  }

  /** 소환 n번. 소환권이 있으면 먼저 쓰고, 없으면 다이아. 모자라면 null */
  summon(kind: 'pet' | 'gear', n: 1 | 10) {
    const s = this.save;
    const useTicket = n === 1 && s.tickets[kind] > 0;
    const cost = summonCost(n);
    if (!useTicket && s.diamonds < cost) return null;
    if (useTicket) s.tickets[kind]--;
    else s.diamonds -= cost;
    const out = [];
    for (let i = 0; i < n; i++) out.push(kind === 'pet' ? this.gainPet(rollPet()) : this.gainGear(rollGear()));
    addDaily(s, 'summons', n);
    this.applyLook();
    if (this.mode === 'idle') this.idle.enter();
    this.persist();
    return out;
  }

  // ---- 꾸미기 ----

  buySkin(kind: 'chick' | 'fx', id: string) {
    const def = (kind === 'chick' ? CHICK_SKIN_BY_ID : FX_SKIN_BY_ID)[id];
    const s = this.save;
    if (!def || s.skins[kind].includes(id) || s.diamonds < skinPrice(def)) return false;
    s.diamonds -= skinPrice(def);
    s.skins[kind].push(id);
    this.wearSkin(kind, id);
    return true;
  }

  wearSkin(kind: 'chick' | 'fx', id: string) {
    if (!this.save.skins[kind].includes(id)) return;
    if (kind === 'chick') this.save.skins.chickOn = id;
    else this.save.skins.fxOn = id;
    this.applySkins();
  }

  /** 엔진에 몸에 보이는 장비를 알려 준다 */
  applyLook() {
    const w = this.save.wear;
    this.engine.look = { hat: w.hat ?? '', back: w.back ?? '', hand: w.weapon ?? '' };
  }

  /** 엔진에 지금 색을 알려 준다 (그리는 쪽이 읽는다) */
  applySkins() {
    this.applyLook();
    this.engine.chickSkin = this.save.skins.chickOn;
    this.engine.fxSkin = this.save.skins.fxOn;
  }

  /** 엔진에 동료를 태운다. power = 이 화면의 공격력 */
  applyPet(power: number) {
    const pet = this.petInfo;
    const p = this.engine.player;
    this.engine.pet = pet
      ? { skin: pet.def.skin, ability: pet.def.ability, value: petValue(pet.def, pet.level), power, x: p.x - 20, y: p.y, t: 1 }
      : null;
  }

  // ---- 미션 · 출석 · 업적 · 패스 ----

  missionReady(id: DailyKey | 'all') {
    const d = freshDaily(this.save);
    if (d.claimed.includes(id)) return false;
    if (id === 'all') return DAILY_MISSIONS.every((m) => d.claimed.includes(m.id));
    const m = DAILY_MISSIONS.find((x) => x.id === id)!;
    return d.counts[id] >= m.goal;
  }

  claimMission(id: DailyKey | 'all') {
    if (!this.missionReady(id)) return false;
    const d = this.save.daily;
    d.claimed.push(id);
    this.save.diamonds += id === 'all' ? DAILY_ALL_BONUS : DAILY_MISSIONS.find((x) => x.id === id)!.diamonds;
    this.addPassXp(MISSION_PASS_XP);
    return true;
  }

  claimAttend() {
    const s = this.save;
    if (!canAttend(s)) return null;
    const day = s.attend.days % ATTEND_REWARDS.length;
    const r = ATTEND_REWARDS[day];
    this.grantReward(r.reward());
    if (r.petTicket) s.tickets.pet += r.petTicket;
    s.attend.last = today();
    s.attend.days++;
    return r.label;
  }

  claimAchieve(id: string) {
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a || !achieveReady(this.save, a)) return false;
    this.save.achieve[id] = (this.save.achieve[id] ?? 0) + 1;
    this.save.diamonds += a.diamonds;
    this.addPassXp(MISSION_PASS_XP);
    return true;
  }

  addPassXp(v: number) {
    this.save.pass.xp += v;
  }

  passReady(lv: number) {
    return lv <= passLevel(this.save) && !this.save.pass.claimed.includes(lv);
  }

  claimPass(lv: number) {
    if (lv < 1 || lv > PASS_LEVELS || !this.passReady(lv)) return false;
    this.save.pass.claimed.push(lv);
    this.grantReward(passReward(lv).reward);
    return true;
  }

  /** 받을 게 있으면 미션 버튼에 빨간 점 */
  get hasClaimable() {
    const s = this.save;
    if (canAttend(s)) return true;
    if ([...DAILY_MISSIONS.map((m) => m.id), 'all' as const].some((id) => this.missionReady(id))) return true;
    if (ACHIEVEMENTS.some((a) => achieveReady(s, a))) return true;
    for (let lv = 1; lv <= passLevel(s); lv++) if (!s.pass.claimed.includes(lv)) return true;
    return false;
  }

  // ---- 보상 ----

  /** 주말 이벤트: 토·일엔 골드 2배, 황금 몹 3배 */
  get isWeekend() {
    const d = new Date().getDay();
    return d === 0 || d === 6;
  }

  /** 스테이지 골드 배율 */
  get goldBoost() {
    return (this.isWeekend ? 2 : 1) * this.bonus.gold;
  }

  /** 황금 몹 출현 배율 */
  get goldenBoost() {
    return this.isWeekend ? 3 : 1;
  }

  grantReward(r: Reward) {
    const save = this.save;
    for (const [k, v] of Object.entries(r.mats)) save.mats[k as MatId] = (save.mats[k as MatId] ?? 0) + (v ?? 0);
    save.gold += r.gold;
    save.diamonds += r.diamonds;
  }

  toggleSound() {
    this.save.sound = !this.save.sound;
    sfx.setEnabled(this.save.sound);
  }

  // ---- 스테이지 설정 ----

  /** AUTO = 플레이 전체 자동: 알아서 움직이고 스킬도 자동으로 쓴다 */
  toggleAutoMove() {
    this.save.autoMove = !this.save.autoMove;
    this.applyControls();
  }

  toggleAutoSkills() {
    this.save.autoSkills = !this.save.autoSkills;
    this.applyControls();
  }

  /** 스킬이 지금 자동으로 나가는지 (AUTO 중이면 늘 자동) */
  get skillsAuto() {
    return this.save.autoSkills || this.save.autoMove;
  }

  applyControls() {
    this.pilot.enabled = this.save.autoMove;
    this.engine.autoSkills = this.skillsAuto;
  }

  /** 지금 화면이 가로로 넓은지 (두 손 조작 배치) */
  get isLandscape() {
    return this.engine.viewW > this.engine.viewH;
  }

  /**
   * 가로 모드: 전체 화면 + 가로 고정을 요청한다 (안드로이드 크롬 등).
   * 아이폰처럼 고정을 못 하는 곳은 폰을 직접 돌리면 같은 배치가 된다.
   */
  async toggleLandscape() {
    if (this.landscapeLocked) return this.exitLandscape();
    try {
      await document.documentElement.requestFullscreen?.();
      const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      if (!o?.lock) throw new Error('no lock');
      await o.lock('landscape');
      this.landscapeLocked = true;
      this.ui.refreshToggles();
    } catch {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      this.ui.toast('폰을 가로로 돌려 주세요 (자동 회전 켜기)');
    }
  }

  exitLandscape() {
    if (!this.landscapeLocked) return;
    this.landscapeLocked = false;
    this.ui.refreshToggles();
    try {
      screen.orientation?.unlock?.();
    } catch {
      // 무시
    }
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }

  // ---- 캐릭터 레벨 ----

  /** 경험치를 더하고 오른 레벨 수를 돌려준다 */
  addXp(v: number) {
    const save = this.save;
    save.xp += v * (1 + REBIRTH_UPS.xp.per * save.rebirth.ups.xp);
    let ups = 0;
    while (save.xp >= xpToNext(save.level)) {
      save.xp -= xpToNext(save.level);
      save.level++;
      ups++;
    }
    if (ups > 0 && this.mode === 'idle') this.idle.refreshStats();
    return ups;
  }

  // ---- 스킬 ----

  skillTree(id: SkillId) {
    return this.save.skills[id];
  }

  /** 스킬북이 필요한 스킬: 그 스킬을 주는 무기를 가졌으면 책 없이 배울 수 있다 */
  needsBook(id: SkillId) {
    if (!SKILL_BY_ID[id].needsBook) return false;
    return !GEAR.some((g) => g.bonusSkill === id && this.save.gear[g.id] !== undefined);
  }

  canLearn(id: SkillId) {
    if (this.save.skills[id] || this.save.gold < learnPrice(SKILL_BY_ID[id])) return false;
    return !this.needsBook(id) || (this.save.mats.skillbook ?? 0) > 0;
  }

  /** 배우기. 빈 장착 칸이 있으면 바로 장착한다 */
  learnSkill(id: SkillId): boolean {
    if (!this.canLearn(id)) return false;
    if (this.needsBook(id)) this.save.mats.skillbook = (this.save.mats.skillbook ?? 0) - 1;
    this.save.gold -= learnPrice(SKILL_BY_ID[id]);
    this.save.skills[id] = emptyTree();
    if (this.save.equipped.length < EQUIP_SLOTS) this.save.equipped.push(id);
    return true;
  }

  /** 가지 다음 단계 비용 (최대면 null) */
  branchUpgradeCost(id: SkillId, branch: Branch) {
    const tree = this.save.skills[id];
    const max = BRANCHES.find((b) => b.id === branch)!.max;
    if (!tree || tree[branch] >= max) return null;
    return branchCost(SKILL_BY_ID[id], branch, tree[branch]);
  }

  canUpgradeBranch(id: SkillId, branch: Branch) {
    const cost = this.branchUpgradeCost(id, branch);
    return cost !== null && this.save.gold >= cost;
  }

  upgradeBranch(id: SkillId, branch: Branch): boolean {
    if (!this.canUpgradeBranch(id, branch)) return false;
    this.save.gold -= this.branchUpgradeCost(id, branch)!;
    this.save.skills[id]![branch]++;
    addDaily(this.save, 'upgrades');
    return true;
  }

  /** 장착한 스킬 하나를 다른 스킬로 바꾼다 (같은 칸 자리에) */
  replaceEquip(oldId: SkillId, newId: SkillId) {
    const eq = this.save.equipped;
    const i = eq.indexOf(oldId);
    if (i < 0 || !this.save.skills[newId] || eq.includes(newId)) return false;
    eq[i] = newId;
    return true;
  }

  /** 장착/해제. 칸이 가득 차서 못 끼우면 false */
  toggleEquip(id: SkillId): boolean {
    const eq = this.save.equipped;
    const i = eq.indexOf(id);
    if (i >= 0) {
      eq.splice(i, 1);
      return true;
    }
    if (!this.save.skills[id] || eq.length >= EQUIP_SLOTS) return false;
    eq.push(id);
    return true;
  }

  // ---- 오프라인 보상 ----

  /** 자리를 비운 시간 × 초당 골드 × 효율 */
  private grantOffline(since: number) {
    const elapsed = Math.min((Date.now() - since) / 1000, OFFLINE_CAP_SEC);
    if (elapsed < OFFLINE_MIN_SEC) return;
    const gold = elapsed * this.goldPerSec * OFFLINE_EFFICIENCY;
    this.ui.showOffline(elapsed, gold, () => {
      this.save.gold += gold;
      this.persist();
    });
  }

  // ---- 입력 ----

  private bindInput() {
    const c = this.canvas;
    const pos = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    c.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const { x, y } = pos(e);
      if (this.mode === 'idle') {
        this.idle.tap(x, y);
      } else if (this.action.running) {
        // 가로 화면은 두 손 조작: 왼쪽 절반만 조이스틱 (오른손은 스킬 칸)
        if (this.isLandscape && x > this.engine.viewW / 2) return;
        c.setPointerCapture(e.pointerId);
        this.joystick.down(e.pointerId, x, y);
      }
    });
    c.addEventListener('pointermove', (e) => {
      const { x, y } = pos(e);
      this.joystick.move(e.pointerId, x, y);
    });
    const up = (e: PointerEvent) => this.joystick.up(e.pointerId);
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);

    // PC에서 확인할 때 쓰는 키보드 이동 (WASD / 방향키)
    const keys = new Set<string>();
    const syncKeys = () => {
      const has = (...k: string[]) => k.some((x) => keys.has(x));
      this.joystick.keyX = (has('d', 'arrowright') ? 1 : 0) - (has('a', 'arrowleft') ? 1 : 0);
      this.joystick.keyY = (has('s', 'arrowdown') ? 1 : 0) - (has('w', 'arrowup') ? 1 : 0);
    };
    window.addEventListener('keydown', (e) => {
      keys.add(e.key.toLowerCase());
      syncKeys();
    });
    window.addEventListener('keyup', (e) => {
      keys.delete(e.key.toLowerCase());
      syncKeys();
    });

    // 모바일 브라우저 기본 제스처(핀치 줌, 더블탭 줌) 막기
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());
  }

  private bindLifecycle() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.mode === 'action') this.action.pause();
        this.persist();
      } else {
        // 백그라운드에 있던 시간은 오프라인 보상으로 계산
        if (this.mode === 'idle') this.grantOffline(this.save.lastSeen);
        this.last = 0;
      }
    });
    window.addEventListener('pagehide', () => this.persist());
  }
}
