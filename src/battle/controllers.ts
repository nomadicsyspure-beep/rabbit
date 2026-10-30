import type { Controller, Engine, Vec } from './engine';

const ZERO: Vec = { x: 0, y: 0 };

/**
 * 방치 화면(보여주기용): 화면 안을 천천히 돌아다닌다.
 * 적을 쫓거나 멈췄다 섰다 하지 않고, 방향도 부드럽게 바뀌어서 걷는 모습이 끊기지 않는다.
 * 공격은 무기가 알아서 한다.
 */
export class AutoController implements Controller {
  private readonly margin = 48;
  private readonly speed = 0.6;
  private goalX = -1;
  private goalY = -1;
  private goalT = 0;
  private vx = 0;
  private vy = 0;
  private lastTime = 0;

  getMove(engine: Engine): Vec {
    const p = engine.player;
    const b = engine.bounds;
    if (!b) return ZERO;
    const dt = Math.min(0.05, Math.max(0, engine.time - this.lastTime));
    this.lastTime = engine.time;

    this.goalT -= dt;
    const gd = Math.hypot(this.goalX - p.x, this.goalY - p.y);
    if (this.goalX < 0 || gd < 24 || this.goalT <= 0) this.pickGoal(b.w, b.h, p.x, p.y);

    const dx = this.goalX - p.x;
    const dy = this.goalY - p.y;
    const d = Math.hypot(dx, dy) || 1;
    // 목표 방향으로 서서히 돌아선다
    const k = 1 - Math.exp(-2.5 * dt);
    this.vx += ((dx / d) * this.speed - this.vx) * k;
    this.vy += ((dy / d) * this.speed - this.vy) * k;
    return { x: this.vx, y: this.vy };
  }

  /** 지금 위치에서 너무 가깝지 않은 화면 안 지점을 고른다 */
  private pickGoal(w: number, h: number, px: number, py: number) {
    const m = this.margin;
    for (let i = 0; i < 8; i++) {
      this.goalX = m + Math.random() * Math.max(1, w - m * 2);
      this.goalY = m + Math.random() * Math.max(1, h - m * 2);
      if (Math.hypot(this.goalX - px, this.goalY - py) > Math.min(w, h) * 0.35) break;
    }
    this.goalT = 4 + Math.random() * 2;
  }
}

/** AUTO로 움직일 때 속도 (최고 속도 대비). 0.8보다 낮아서 걷기 그림으로 움직인다 */
const AUTO_SPEED = 0.65;

/**
 * 스테이지 자동 플레이(AUTO): 조이스틱을 만지면 그쪽이 먼저, 손을 떼면 알아서 싸운다.
 * - 보물 상자가 보이면 주우러 간다
 * - 몹 무리 쪽으로 다가가되 너무 붙지 않고, 무리 둘레를 돌며 스킬로 쓸어 담는다
 * - 바로 옆에 붙은 몹·보스는 피한다
 */
export class AutoPilot implements Controller {
  enabled = false;
  /** 이번 프레임을 AUTO가 조종했는지 (조이스틱을 만지면 false) */
  driving = false;
  private vx = 1;
  private vy = 0;
  /** 무리 둘레를 도는 방향 (가끔 바꾼다) */
  private orbit = 1;
  private orbitT = 0;
  private lastTime = 0;

  constructor(private readonly joystick: Joystick) {}

  getMove(engine: Engine): Vec {
    const m = this.joystick.getMove();
    this.driving = this.enabled && !m.x && !m.y;
    if (!this.driving) return m;
    const dt = Math.min(0.05, Math.max(0, engine.time - this.lastTime));
    this.lastTime = engine.time;
    const p = engine.player;
    this.orbitT -= dt;
    if (this.orbitT <= 0) {
      this.orbitT = 3 + Math.random() * 3;
      if (Math.random() < 0.4) this.orbit = -this.orbit;
    }

    let ax = 0;
    let ay = 0;
    // 몹 무리의 중심 (가까울수록 무겁게)과, 바로 옆에 붙은 몹에게서 밀려나는 힘
    let cx = 0;
    let cy = 0;
    let cw = 0;
    for (const e of engine.enemies.items) {
      if (!e.active) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > 340) continue;
      const w = 1 / (40 + d);
      cx += e.x * w;
      cy += e.y * w;
      cw += w;
      const danger = e.kind === 'boss' ? 150 : 48;
      if (d < danger) {
        const k = ((danger - d) / danger) * (e.kind === 'boss' ? 5 : 3);
        ax -= (dx / d) * k;
        ay -= (dy / d) * k;
      }
    }
    if (cw > 0) {
      const tx = cx / cw - p.x;
      const ty = cy / cw - p.y;
      const d = Math.hypot(tx, ty) || 1;
      // 알맞은 거리(약 90px)를 유지하며 둘레를 돈다
      const pull = d > 110 ? 1 : d < 70 ? -0.8 : 0;
      ax += (tx / d) * pull + (-ty / d) * 0.7 * this.orbit;
      ay += (ty / d) * pull + (tx / d) * 0.7 * this.orbit;
    }
    // 보물 상자가 최우선
    let chest: { x: number; y: number } | null = null;
    let best = 500 * 500;
    for (const c of engine.chests.items) {
      if (!c.active) continue;
      const d2 = (c.x - p.x) ** 2 + (c.y - p.y) ** 2;
      if (d2 < best) {
        best = d2;
        chest = c;
      }
    }
    if (chest) {
      const dx = chest.x - p.x;
      const dy = chest.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      ax += (dx / d) * 2.5;
      ay += (dy / d) * 2.5;
    }
    // 아무것도 없으면 지금 방향에서 조금씩 꺾으며 돌아다닌다
    if (Math.hypot(ax, ay) < 0.15) {
      ax += -this.vy * 0.5 + this.vx;
      ay += this.vx * 0.5 + this.vy;
    }
    // 방향은 천천히 꺾고 속도는 조금 낮춰서 화면이 덜 흔들리게 (멀미 방지)
    const k = 1 - Math.exp(-3 * dt);
    const len = Math.hypot(ax, ay) || 1;
    this.vx += (ax / len - this.vx) * k;
    this.vy += (ay / len - this.vy) * k;
    const vl = Math.hypot(this.vx, this.vy) || 1;
    return { x: (this.vx / vl) * AUTO_SPEED, y: (this.vy / vl) * AUTO_SPEED };
  }
}

/**
 * 플로팅 조이스틱: 화면 아무 데나 누르면 그 자리에 생기고, 떼면 사라진다.
 * 한 손가락만 추적한다.
 */
export class Joystick implements Controller {
  active = false;
  ox = 0;
  oy = 0;
  x = 0;
  y = 0;
  readonly radius = 52;
  /** PC 확인용 키보드 입력 (-1, 0, 1) */
  keyX = 0;
  keyY = 0;
  private pointerId = -1;

  down(id: number, x: number, y: number) {
    if (this.active) return;
    this.active = true;
    this.pointerId = id;
    this.ox = this.x = x;
    this.oy = this.y = y;
  }

  move(id: number, x: number, y: number) {
    if (!this.active || id !== this.pointerId) return;
    this.x = x;
    this.y = y;
  }

  up(id: number) {
    if (id !== this.pointerId) return;
    this.release();
  }

  release() {
    this.active = false;
    this.pointerId = -1;
  }

  getMove(): Vec {
    if (this.keyX || this.keyY) return { x: this.keyX, y: this.keyY };
    if (!this.active) return ZERO;
    const dx = this.x - this.ox;
    const dy = this.y - this.oy;
    const d = Math.hypot(dx, dy);
    if (d < 6) return ZERO;
    const k = Math.min(1, d / this.radius);
    return { x: (dx / d) * k, y: (dy / d) * k };
  }
}
