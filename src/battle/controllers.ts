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

/**
 * 스테이지 자동 이동: 조이스틱을 만지면 그쪽이 먼저, 손을 떼면 알아서 움직인다.
 * 가까운 몹은 피하고, 경험치 보석을 주우며, 아무것도 없으면 크게 원을 그리며 돈다.
 */
export class AutoPilot implements Controller {
  enabled = false;
  private vx = 1;
  private vy = 0;
  private lastTime = 0;

  constructor(private readonly joystick: Joystick) {}

  getMove(engine: Engine): Vec {
    const m = this.joystick.getMove();
    if (!this.enabled || m.x || m.y) return m;
    const dt = Math.min(0.05, Math.max(0, engine.time - this.lastTime));
    this.lastTime = engine.time;
    const p = engine.player;

    // 몹에게서 멀어지는 힘 (가까울수록 세게)
    let ax = 0;
    let ay = 0;
    for (const e of engine.enemies.items) {
      if (!e.active) continue;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d2 = dx * dx + dy * dy;
      const reach = e.kind === 'boss' ? 200 : 110;
      if (d2 > reach * reach || d2 < 1) continue;
      const d = Math.sqrt(d2);
      const w = ((reach - d) / reach) * (e.kind === 'boss' ? 4 : 1);
      ax += (dx / d) * w;
      ay += (dy / d) * w;
    }
    // 가까운 보석 쪽으로
    let best = 260 * 260;
    let gx = 0;
    let gy = 0;
    for (const g of engine.gems.items) {
      if (!g.active || g.pulled) continue;
      const d2 = (g.x - p.x) ** 2 + (g.y - p.y) ** 2;
      if (d2 < best) {
        best = d2;
        gx = g.x - p.x;
        gy = g.y - p.y;
      }
    }
    const gd = Math.hypot(gx, gy);
    if (gd > 0) {
      ax += (gx / gd) * 0.8;
      ay += (gy / gd) * 0.8;
    }
    // 할 일이 없으면 지금 방향에서 조금씩 꺾으며 원을 그린다
    if (Math.hypot(ax, ay) < 0.2) {
      ax += -this.vy * 0.6 + this.vx;
      ay += this.vx * 0.6 + this.vy;
    }
    const k = 1 - Math.exp(-6 * dt);
    const len = Math.hypot(ax, ay) || 1;
    this.vx += (ax / len - this.vx) * k;
    this.vy += (ay / len - this.vy) * k;
    const vl = Math.hypot(this.vx, this.vy) || 1;
    return { x: this.vx / vl, y: this.vy / vl };
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
