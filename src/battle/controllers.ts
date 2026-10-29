import type { Controller, Engine, Vec } from './engine';

const ZERO: Vec = { x: 0, y: 0 };

/** 방치 모드: 가까운 적과 거리를 유지하며 알아서 움직인다. */
export class AutoController implements Controller {
  private readonly preferred = 100;

  getMove(engine: Engine): Vec {
    const p = engine.player;
    const b = engine.bounds;
    const target = engine.nearestEnemies(p.x, p.y, 1, Infinity)[0];
    let mx = 0;
    let my = 0;

    if (target) {
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > this.preferred + 30) {
        mx = dx / d;
        my = dy / d;
      } else if (d < 55) {
        mx = -dx / d;
        my = -dy / d;
      }
    } else if (b) {
      // 적이 없으면 가운데로 돌아간다
      const dx = b.w / 2 - p.x;
      const dy = b.h / 2 - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 8) return ZERO;
      mx = dx / d;
      my = dy / d;
    }

    // 벽에 몰리지 않게 가운데 쪽으로 살짝 당긴다
    if (b) {
      const margin = 40;
      if (p.x < margin) mx += 0.8;
      if (p.x > b.w - margin) mx -= 0.8;
      if (p.y < margin) my += 0.8;
      if (p.y > b.h - margin) my -= 0.8;
    }
    return { x: mx * 0.7, y: my * 0.7 };
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
