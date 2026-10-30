import { sfx } from './audio/sfx';
import { AutoPilot, Joystick } from './battle/controllers';
import { Engine } from './battle/engine';
import { Renderer } from './battle/renderer';
import { clearSave, loadSave, writeSave, type SaveData } from './core/save';
import {
  OFFLINE_CAP_SEC, OFFLINE_EFFICIENCY, STATS, idleGoldPerSec, xpToNext, type StatId,
} from './data/balance';
import {
  BRANCHES, EQUIP_SLOTS, SKILL_BY_ID, branchCost, emptyTree, learnPrice, type Branch, type SkillId,
} from './data/skills';
import { type Reward } from './data/items';
import type { MatId } from './data/world';
import { ActionMode } from './modes/action';
import { IdleMode } from './modes/idle';
import { UI } from './ui/ui';

const AUTOSAVE_SEC = 10;
const OFFLINE_MIN_SEC = 60;

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
    return idleGoldPerSec(this.save.maxStage);
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

  enterAction() {
    this.persist();
    this.mode = 'action';
    this.ui.setMode('action');
    sfx.setCombat(true);
    this.resize();
    this.action.enter(this.nextStage);
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
    this.idle.refreshStats();
    return true;
  }

  // ---- 보상 ----

  /** 주말 이벤트: 토·일엔 골드 2배, 황금 몹 3배 */
  get isWeekend() {
    const d = new Date().getDay();
    return d === 0 || d === 6;
  }

  /** 스테이지 골드 배율 */
  get goldBoost() {
    return this.isWeekend ? 2 : 1;
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
    save.xp += v;
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

  canLearn(id: SkillId) {
    return !this.save.skills[id] && this.save.gold >= learnPrice(SKILL_BY_ID[id]);
  }

  /** 배우기. 빈 장착 칸이 있으면 바로 장착한다 */
  learnSkill(id: SkillId): boolean {
    if (!this.canLearn(id)) return false;
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
