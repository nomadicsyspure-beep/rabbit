import type { Engine, Weapon } from './engine';

/** 무기가 참조하는 공용 수치. 모드가 값을 넣어 준다. */
export interface WeaponStats {
  /** 피해량 기준값 (방치: 공격력, 액션: 10 × 공격 배율) */
  power: number;
  /** 쿨다운 나누기 값 (방치: 공격 속도, 액션: 1) */
  aps: number;
}

const lv = <T>(table: T[], level: number) => table[Math.min(level, table.length) - 1];

/** 기본 무기: 가장 가까운 적에게 당근 다트 발사 */
export class DartWeapon implements Weapon {
  id = 'dart';
  level = 1;
  private cd = 0;
  static readonly COUNT = [1, 2, 2, 3, 3];
  static readonly DMG = [1, 1, 1.3, 1.3, 1.6];
  static readonly PIERCE = [0, 0, 0, 1, 1];
  static readonly CD = [0.8, 0.8, 0.7, 0.7, 0.55];

  constructor(private readonly stats: WeaponStats, private readonly range = 260) {}

  update(engine: Engine, dt: number) {
    this.cd -= dt;
    if (this.cd > 0) return;
    const p = engine.player;
    const targets = engine.nearestEnemies(p.x, p.y, lv(DartWeapon.COUNT, this.level), this.range);
    if (targets.length === 0) return;
    this.cd = lv(DartWeapon.CD, this.level) / this.stats.aps;
    const dmg = this.stats.power * lv(DartWeapon.DMG, this.level);
    for (const t of targets) {
      engine.fireProjectile(p.x, p.y, t.x, t.y, 380, dmg, this.range + 40, lv(DartWeapon.PIERCE, this.level));
    }
  }
}

/** 회전 클로버: 주변을 도는 구체 */
export class OrbitWeapon implements Weapon {
  id = 'orbit';
  level = 1;
  private angle = 0;
  private readonly nextHit = new Map<number, number>();
  static readonly COUNT = [2, 3, 3, 4, 5];
  static readonly DMG = [0.5, 0.5, 0.7, 0.7, 0.9];
  static readonly RADIUS = [48, 48, 52, 60, 64];
  static readonly SPEED = [3, 3, 3.3, 3.6, 4.2];

  constructor(private readonly stats: WeaponStats) {}

  update(engine: Engine, dt: number) {
    const p = engine.player;
    const n = lv(OrbitWeapon.COUNT, this.level);
    const radius = lv(OrbitWeapon.RADIUS, this.level);
    this.angle += lv(OrbitWeapon.SPEED, this.level) * dt;
    const dmg = this.stats.power * lv(OrbitWeapon.DMG, this.level);
    if (this.nextHit.size > 600) this.nextHit.clear();

    engine.orbs.length = 0;
    for (let i = 0; i < n; i++) {
      const a = this.angle + (i / n) * Math.PI * 2;
      const orb = { x: p.x + Math.cos(a) * radius, y: p.y + Math.sin(a) * radius, r: 7 };
      engine.orbs.push(orb);
      for (const e of engine.queryEnemies(orb.x, orb.y, orb.r)) {
        if ((e.x - orb.x) ** 2 + (e.y - orb.y) ** 2 > (e.r + orb.r) ** 2) continue;
        if ((this.nextHit.get(e.id) ?? 0) > engine.time) continue;
        this.nextHit.set(e.id, engine.time + 0.4);
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        engine.damageEnemy(e, dmg, (dx / d) * 90, (dy / d) * 90);
      }
    }
  }
}

/** 충격파: 주기적으로 주변 전체에 피해 + 밀어내기 */
export class PulseWeapon implements Weapon {
  id = 'pulse';
  level = 1;
  private cd = 1;
  static readonly CD = [2.6, 2.4, 2.2, 2, 1.6];
  static readonly RADIUS = [64, 72, 80, 88, 100];
  static readonly DMG = [1, 1.2, 1.4, 1.7, 2];

  constructor(private readonly stats: WeaponStats) {}

  update(engine: Engine, dt: number) {
    this.cd -= dt;
    if (this.cd > 0) return;
    this.cd = lv(PulseWeapon.CD, this.level) / this.stats.aps;
    const p = engine.player;
    const radius = lv(PulseWeapon.RADIUS, this.level);
    const dmg = this.stats.power * lv(PulseWeapon.DMG, this.level);
    engine.addEffect('ring', p.x, p.y, radius, 0.35, '#7ad7ff');
    for (const e of [...engine.queryEnemies(p.x, p.y, radius)]) {
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > radius + e.r) continue;
      engine.damageEnemy(e, dmg, (dx / d) * 220, (dy / d) * 220);
    }
  }
}

/** 번개: 범위 안 무작위 적을 치고 옆 적으로 튄다 */
export class LightningWeapon implements Weapon {
  id = 'lightning';
  level = 1;
  private cd = 0.5;
  static readonly CD = [1.8, 1.6, 1.4, 1.3, 1.1];
  static readonly CHAINS = [1, 2, 3, 3, 4];
  static readonly DMG = [1.5, 1.6, 1.8, 2.1, 2.5];

  constructor(private readonly stats: WeaponStats) {}

  update(engine: Engine, dt: number) {
    this.cd -= dt;
    if (this.cd > 0) return;
    const p = engine.player;
    const inRange = engine.nearestEnemies(p.x, p.y, 40, 230);
    if (inRange.length === 0) return;
    this.cd = lv(LightningWeapon.CD, this.level) / this.stats.aps;
    const dmg = this.stats.power * lv(LightningWeapon.DMG, this.level);

    let cur = inRange[Math.floor(Math.random() * inRange.length)];
    const hit = new Set<number>();
    let fromX = p.x;
    let fromY = p.y - 40;
    for (let i = 0; i <= lv(LightningWeapon.CHAINS, this.level); i++) {
      hit.add(cur.id);
      engine.addEffect('bolt', fromX, fromY, 0, 0.18, '#fff27a', cur.x, cur.y);
      fromX = cur.x;
      fromY = cur.y;
      engine.damageEnemy(cur, dmg);
      const next = engine.nearestEnemies(fromX, fromY, 6, 100).find((e) => !hit.has(e.id));
      if (!next) break;
      cur = next;
    }
  }
}
