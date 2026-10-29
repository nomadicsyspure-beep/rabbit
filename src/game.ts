import { Joystick } from './battle/controllers';
import { Engine } from './battle/engine';
import { Renderer } from './battle/renderer';
import { clearSave, loadSave, writeSave, type SaveData } from './core/save';
import {
  OFFLINE_CAP_SEC, OFFLINE_EFFICIENCY, STATS, enemyGold, enemyHp, playerPower, playerStats, type StatId,
} from './data/balance';
import { ActionMode } from './modes/action';
import { IdleMode } from './modes/idle';
import { UI } from './ui/ui';

const AUTOSAVE_SEC = 10;
const OFFLINE_MIN_SEC = 60;

export type Mode = 'idle' | 'action';

export class Game {
  readonly engine = new Engine();
  readonly joystick = new Joystick();
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

  constructor(root: HTMLElement) {
    this.ui = new UI(this, root);
    this.canvas = this.ui.canvas;
    this.renderer = new Renderer(this.canvas);
    this.bindInput();
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

  private frame(t: number) {
    const dt = this.last ? Math.min((t - this.last) / 1000, 0.05) : 0;
    this.last = t;

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

  enterAction(stage: number, practice: boolean) {
    this.persist();
    this.mode = 'action';
    this.ui.setMode('action');
    this.resize();
    this.action.enter(stage, practice);
  }

  enterIdle() {
    this.mode = 'idle';
    this.ui.setMode('idle');
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

  // ---- 오프라인 보상 ----

  /** 자리를 비운 시간 × 예상 초당 골드 × 효율 */
  private grantOffline(since: number) {
    const elapsed = Math.min((Date.now() - since) / 1000, OFFLINE_CAP_SEC);
    if (elapsed < OFFLINE_MIN_SEC) return;
    const stage = this.idle.farmStage;
    const killsPerSec = Math.min(playerPower(playerStats(this.save.levels)) / enemyHp(stage), 1.5);
    const gold = elapsed * killsPerSec * enemyGold(stage) * OFFLINE_EFFICIENCY;
    if (gold <= 0) return;
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
