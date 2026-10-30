import type { Engine, Weapon } from './engine';

/** 레벨에 따른 피해 배율 (스킬 공통) */
export const skillPower = (level: number) => 1 + 0.18 * (level - 1);
/** n레벨마다 1씩 늘어나는 개수 보너스 */
export const every = (level: number, n: number) => Math.floor(level / n);

/** 무기가 참조하는 공용 수치. 모드가 값을 넣어 준다. */
export interface WeaponStats {
  /** 피해량 기준값 (방치: 공격력, 액션: 10 × 공격 배율) */
  power: number;
  /** 쿨다운 나누기 값 (방치: 공격 속도, 액션: 1) */
  aps: number;
}

/** 쿨다운으로 도는 무기 공통: 다 차면 fire()를 부르고, 쏠 대상이 없으면 기다린다 */
abstract class CooldownWeapon implements Weapon {
  abstract readonly id: string;
  protected cd: number;

  constructor(protected readonly stats: WeaponStats, public level: number, protected readonly baseCd: number, firstDelay = 0.3) {
    this.cd = firstDelay;
  }

  /** 레벨이 오를수록 쿨다운이 조금씩 준다 (최대 25%) */
  protected get cooldown() {
    return (this.baseCd * Math.max(0.75, 1 - 0.015 * (this.level - 1))) / this.stats.aps;
  }

  protected get power() {
    return this.stats.power * skillPower(this.level);
  }

  update(engine: Engine, dt: number) {
    this.cd -= dt;
    if (this.cd > 0) return;
    if (this.fire(engine)) this.cd = this.cooldown;
  }

  ready() {
    return 1 - Math.max(0, this.cd) / this.cooldown;
  }

  /** 발동했으면 true (대상이 없으면 false로 다음 프레임에 다시 시도) */
  protected abstract fire(engine: Engine): boolean;
}

/** 깃털 날리기: 가까운 적에게 깃털 */
export class FeatherWeapon extends CooldownWeapon {
  readonly id = 'feather';

  constructor(stats: WeaponStats, level: number, private readonly range = 260) {
    super(stats, level, 0.8);
  }

  protected fire(engine: Engine) {
    const p = engine.player;
    const targets = engine.nearestEnemies(p.x, p.y, 1 + every(this.level, 5), this.range);
    if (targets.length === 0) return false;
    const pierce = this.level >= 8 ? 1 : 0;
    for (const t of targets) engine.fireProjectile(p.x, p.y - 8, t.x, t.y, 380, this.power, this.range + 40, pierce, 'feather');
    return true;
  }
}

/** 회오리: 바라보는 쪽으로 천천히 나아가며 닿는 적에게 계속 피해 */
export class TornadoWeapon extends CooldownWeapon {
  readonly id = 'tornado';

  constructor(stats: WeaponStats, level: number) {
    super(stats, level, 3.2, 0.8);
  }

  protected fire(engine: Engine) {
    const p = engine.player;
    const n = 1 + every(this.level, 7);
    const base = Math.atan2(p.faceY, p.faceX);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.5;
      engine.addZone(p.x, p.y, Math.cos(a) * 120, Math.sin(a) * 120, 22 + this.level, 2.4, this.power * 0.6, 'tornado');
    }
    return true;
  }
}

/** 알 폭탄: 적 위치로 알을 던져 떨어진 자리에서 폭발 */
export class EggWeapon extends CooldownWeapon {
  readonly id = 'egg';

  constructor(stats: WeaponStats, level: number) {
    super(stats, level, 2.4, 1);
  }

  protected fire(engine: Engine) {
    const p = engine.player;
    const near = engine.nearestEnemies(p.x, p.y, 12, 230);
    if (near.length === 0) return false;
    const n = 1 + every(this.level, 6);
    for (let i = 0; i < n; i++) {
      const t = near[Math.floor(Math.random() * near.length)];
      engine.lobEgg(p.x, p.y - 10, t.x, t.y, 0.55, this.power * 1.4, 38 + 1.5 * this.level);
    }
    return true;
  }
}

/** 화염 폭발: 주기적으로 주변 전체에 피해 + 밀어내기 */
export class FlameWeapon extends CooldownWeapon {
  readonly id = 'flame';

  constructor(stats: WeaponStats, level: number) {
    super(stats, level, 2.6, 1.2);
  }

  protected fire(engine: Engine) {
    const p = engine.player;
    const radius = 60 + 3 * this.level;
    engine.addSprite('fire-burst', p.x, p.y - 6, radius * 0.75, 0.35);
    engine.addEffect('ring', p.x, p.y, radius, 0.35, '#ff9a3c');
    for (const e of [...engine.queryEnemies(p.x, p.y, radius)]) {
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > radius + e.r) continue;
      engine.damageEnemy(e, this.power * 1.2, (dx / d) * 220, (dy / d) * 220);
    }
    return true;
  }
}

/** 얼음 결정: 무작위 적 발밑에 얼음이 솟아 피해 + 느려짐 */
export class IceWeapon extends CooldownWeapon {
  readonly id = 'ice';

  constructor(stats: WeaponStats, level: number) {
    super(stats, level, 2.2, 0.6);
  }

  protected fire(engine: Engine) {
    const p = engine.player;
    const near = engine.nearestEnemies(p.x, p.y, 30, 240);
    if (near.length === 0) return false;
    const n = Math.min(near.length, 2 + every(this.level, 5));
    for (let i = near.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [near[i], near[j]] = [near[j], near[i]];
    }
    for (const t of near.slice(0, n)) {
      engine.addSprite('ice-crystals', t.x, t.y - 10, 30, 0.45);
      for (const e of [...engine.queryEnemies(t.x, t.y, 26)]) {
        if (Math.hypot(e.x - t.x, e.y - t.y) > 26 + e.r) continue;
        e.slowT = 1.5;
        engine.damageEnemy(e, this.power * 1.1);
      }
    }
    return true;
  }
}

/** 치유: 주기적으로 체력 회복 */
export class HealWeapon extends CooldownWeapon {
  readonly id = 'heal';

  constructor(stats: WeaponStats, level: number) {
    super(stats, level, 6, 6);
  }

  protected get cooldown() {
    return this.baseCd;
  }

  protected fire(engine: Engine) {
    const p = engine.player;
    if (p.hp >= p.maxHp) return false;
    const amount = p.maxHp * (0.04 + 0.005 * this.level);
    p.hp = Math.min(p.maxHp, p.hp + amount);
    engine.addSprite('heal-circle', p.x, p.y + 4, 34, 0.7, true);
    engine.addSprite('heal-cross', p.x, p.y - 22, 30, 0.7, true);
    engine.addText(p.x, p.y - p.r - 14, '+' + Math.round(amount), '#7cf2a0', 12);
    return true;
  }
}

/** 화염구: 가까운 적에게 날아가 맞으면 터진다 */
export class FireballWeapon extends CooldownWeapon {
  readonly id = 'fire';

  constructor(stats: WeaponStats, level: number) {
    super(stats, level, 1.7, 0.9);
  }

  protected fire(engine: Engine) {
    const p = engine.player;
    const targets = engine.nearestEnemies(p.x, p.y, 1 + every(this.level, 8), 300);
    if (targets.length === 0) return false;
    for (const t of targets) {
      engine.fireProjectile(p.x, p.y - 8, t.x, t.y, 260, this.power * 1.6, 340, 0, 'fireball', 34 + this.level);
    }
    return true;
  }
}

/** 암흑 구체: 주변을 도는 구체 */
export class DarkOrbWeapon implements Weapon {
  readonly id = 'dark';
  private angle = 0;
  private readonly nextHit = new Map<number, number>();

  constructor(private readonly stats: WeaponStats, public level: number) {}

  update(engine: Engine, dt: number) {
    const p = engine.player;
    const n = 2 + every(this.level, 5);
    const radius = 50 + this.level;
    this.angle += (3 + 0.06 * this.level) * dt;
    const dmg = this.stats.power * 0.5 * skillPower(this.level);
    if (this.nextHit.size > 600) this.nextHit.clear();

    engine.orbs.length = 0;
    for (let i = 0; i < n; i++) {
      const a = this.angle + (i / n) * Math.PI * 2;
      const orb = { x: p.x + Math.cos(a) * radius, y: p.y + Math.sin(a) * radius, r: 9 };
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

  ready() {
    return 1;
  }
}
