import type { Enemy, Engine, Weapon } from './engine';

/** 무기가 참조하는 공용 수치. 모드가 값을 넣어 준다. */
export interface WeaponStats {
  /** 피해량 기준값 (방치: 공격력, 액션: 10 × 공격 배율) */
  power: number;
  /** 쿨다운 나누기 값 (방치: 공격 속도, 액션: 1) */
  aps: number;
}

/** 스킬 트리: 피해 / 발동 속도 / 개수. 골드로 가지마다 따로 올린다 */
export interface SkillTree {
  dmg: number;
  spd: number;
  cnt: number;
}

/** 스킬 기본값 (data/skills.ts에서 스킬마다 정한다) */
export interface SkillSpec {
  /** 공격력 대비 피해 배율 */
  dmg: number;
  /** 기본 쿨다운(초) */
  cd: number;
  /** 기본 개수 */
  count: number;
}

/** 전체 쿨다운 배율 (작을수록 자주 쏜다) */
export const HASTE = 0.55;
/** 피해 가지 1레벨당 +25% */
export const treeDamage = (t: SkillTree) => 1 + 0.25 * t.dmg;
/** 발동 속도 가지: 쿨다운 ÷ (1 + 10% × 레벨) */
export const treeCooldown = (t: SkillTree) => 1 / (1 + 0.1 * t.spd);

/** 쿨다운으로 도는 스킬 공통: 다 차면 fire()를 부르고, 쏠 대상이 없으면 기다린다 */
abstract class SkillWeapon implements Weapon {
  abstract readonly id: string;
  readonly manual = true;
  protected cd: number;
  /** 수동 모드에서 눌러 둔 발동 */
  private pending = false;

  constructor(
    protected readonly stats: WeaponStats,
    protected readonly spec: SkillSpec,
    protected readonly tree: SkillTree,
    firstDelay = 0.3,
  ) {
    this.cd = firstDelay;
  }

  protected get cooldown() {
    return (this.spec.cd * HASTE * treeCooldown(this.tree)) / this.stats.aps;
  }

  protected get power() {
    return this.stats.power * this.spec.dmg * treeDamage(this.tree);
  }

  protected get count() {
    return this.spec.count + this.tree.cnt;
  }

  update(engine: Engine, dt: number) {
    this.cd -= dt;
    if (this.cd > 0) return;
    if (!engine.autoSkills && !this.pending) return;
    if (this.fire(engine)) {
      this.cd = this.cooldown;
      this.pending = false;
    }
  }

  ready() {
    return 1 - Math.max(0, this.cd) / this.cooldown;
  }

  trigger() {
    this.pending = true;
  }

  resetCooldown() {
    this.cd = 0;
  }

  /** 발동했으면 true (대상이 없으면 false로 다음 프레임에 다시 시도) */
  protected abstract fire(engine: Engine): boolean;
}

/** 여러 번 연달아 터지는 스킬: fire()에서 burst를 정하면 gap초 간격으로 hit()를 부른다 */
abstract class RepeatWeapon extends SkillWeapon {
  private left = 0;
  private gapT = 0;
  protected gap = 0.12;

  update(engine: Engine, dt: number) {
    if (this.left > 0) {
      this.gapT -= dt;
      if (this.gapT <= 0) {
        this.left--;
        this.gapT = this.gap;
        this.hit(engine, this.count - this.left - 1);
      }
    }
    super.update(engine, dt);
  }

  protected fire(engine: Engine) {
    this.left = this.count - 1;
    this.gapT = this.gap;
    this.hit(engine, 0);
    return true;
  }

  /** i번째 (0부터) */
  protected abstract hit(engine: Engine, i: number): void;
}

function shuffle<T>(a: T[]) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 깃털 날리기: 가까운 적들에게 깃털 (개수 3레벨마다 관통 +1) */
export class FeatherWeapon extends SkillWeapon {
  readonly id = 'feather';

  constructor(stats: WeaponStats, spec: SkillSpec, tree: SkillTree, private readonly range = 300) {
    super(stats, spec, tree);
  }

  protected fire(engine: Engine) {
    const p = engine.player;
    const targets = engine.nearestEnemies(p.x, p.y, this.count, this.range);
    if (targets.length === 0) return false;
    const pierce = 1 + Math.floor(this.tree.cnt / 3);
    for (const t of targets) engine.fireProjectile(p.x, p.y - 8, t.x, t.y, 560, this.power, this.range + 60, pierce, 'feather');
    return true;
  }
}

/** 회오리: 바라보는 쪽으로 부채꼴로 나아가며 닿는 적에게 계속 피해 */
export class TornadoWeapon extends SkillWeapon {
  readonly id = 'tornado';

  constructor(stats: WeaponStats, spec: SkillSpec, tree: SkillTree) {
    super(stats, spec, tree, 0.8);
  }

  protected fire(engine: Engine) {
    const p = engine.player;
    const n = this.count;
    const base = Math.atan2(p.faceY, p.faceX);
    const spread = Math.min(0.5, (Math.PI * 2) / n);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * spread;
      engine.addZone(p.x, p.y, Math.cos(a) * 180, Math.sin(a) * 180, 26, 2, this.power, 'tornado');
    }
    return true;
  }
}

/** 알 폭탄: 적 위치로 알을 던져 떨어진 자리에서 폭발 */
export class EggWeapon extends SkillWeapon {
  readonly id = 'egg';

  constructor(stats: WeaponStats, spec: SkillSpec, tree: SkillTree) {
    super(stats, spec, tree, 1);
  }

  protected fire(engine: Engine) {
    const p = engine.player;
    const near = engine.nearestEnemies(p.x, p.y, 20, 240);
    if (near.length === 0) return false;
    for (let i = 0; i < this.count; i++) {
      const t = near[Math.floor(Math.random() * near.length)];
      engine.lobEgg(p.x, p.y - 10, t.x + (Math.random() - 0.5) * 20, t.y + (Math.random() - 0.5) * 20, 0.4, this.power, 46, 'egg');
    }
    return true;
  }
}

/** 화염 폭발: 주변 전체에 피해 + 밀어내기. 개수만큼 점점 크게 연달아 터진다 */
export class FlameWeapon extends RepeatWeapon {
  readonly id = 'flame';

  constructor(stats: WeaponStats, spec: SkillSpec, tree: SkillTree) {
    super(stats, spec, tree, 1.2);
    this.gap = 0.15;
  }

  protected hit(engine: Engine, i: number) {
    const p = engine.player;
    const radius = 70 + i * 18;
    engine.addSprite('fire-burst', p.x, p.y - 6, radius * 0.75, 0.35);
    engine.addEffect('ring', p.x, p.y, radius, 0.35, '#ff9a3c');
    engine.addShake(3);
    engine.blast(p.x, p.y, radius, this.power, 220);
  }
}

/** 얼음 결정: 무작위 적 발밑에 얼음이 솟아 피해 + 느려짐 */
export class IceWeapon extends SkillWeapon {
  readonly id = 'ice';

  constructor(stats: WeaponStats, spec: SkillSpec, tree: SkillTree) {
    super(stats, spec, tree, 0.6);
  }

  protected fire(engine: Engine) {
    const p = engine.player;
    const near = engine.nearestEnemies(p.x, p.y, 60, 260);
    if (near.length === 0) return false;
    for (const t of shuffle(near).slice(0, this.count)) {
      engine.addSprite('ice-crystals', t.x, t.y - 10, 30, 0.45);
      for (const e of engine.blast(t.x, t.y, 28, this.power, 0)) e.slowT = 1.5;
    }
    return true;
  }
}

/** 치유: 주기적으로 체력 회복 (피해 가지 = 회복량, 개수 = 연달아 회복 횟수) */
export class HealWeapon extends RepeatWeapon {
  readonly id = 'heal';

  constructor(stats: WeaponStats, spec: SkillSpec, tree: SkillTree) {
    super(stats, spec, tree, 4);
    this.gap = 0.4;
  }

  protected get cooldown() {
    return this.spec.cd * treeCooldown(this.tree);
  }

  protected fire(engine: Engine) {
    if (engine.player.hp >= engine.player.maxHp) return false;
    return super.fire(engine);
  }

  protected hit(engine: Engine) {
    const p = engine.player;
    const amount = p.maxHp * this.spec.dmg * treeDamage(this.tree);
    p.hp = Math.min(p.maxHp, p.hp + amount);
    engine.addSprite('heal-circle', p.x, p.y + 4, 34, 0.7, true);
    engine.addSprite('heal-cross', p.x, p.y - 22, 30, 0.7, true);
    engine.addText(p.x, p.y - p.r - 14, '+' + Math.round(amount), '#7cf2a0', 13);
  }
}

/** 화염구: 가까운 적에게 날아가 맞으면 터진다 */
export class FireballWeapon extends SkillWeapon {
  readonly id = 'fire';

  constructor(stats: WeaponStats, spec: SkillSpec, tree: SkillTree) {
    super(stats, spec, tree, 0.9);
  }

  protected fire(engine: Engine) {
    const p = engine.player;
    const targets = engine.nearestEnemies(p.x, p.y, this.count, 320);
    if (targets.length === 0) return false;
    for (const t of targets) engine.fireProjectile(p.x, p.y - 8, t.x, t.y, 400, this.power, 380, 0, 'fireball', 42);
    return true;
  }
}

/** 암흑 구체: 주변을 도는 구체 (발동 속도 가지 = 회전 속도) */
export class DarkOrbWeapon implements Weapon {
  readonly id = 'dark';
  private angle = 0;
  private readonly nextHit = new Map<number, number>();

  constructor(private readonly stats: WeaponStats, private readonly spec: SkillSpec, private readonly tree: SkillTree) {}

  update(engine: Engine, dt: number) {
    const p = engine.player;
    const n = this.spec.count + this.tree.cnt;
    const radius = 55 + n * 2;
    this.angle += 4.2 * (1 + 0.1 * this.tree.spd) * dt;
    const dmg = this.stats.power * this.spec.dmg * treeDamage(this.tree);
    if (this.nextHit.size > 600) this.nextHit.clear();

    engine.orbs.length = 0;
    for (let i = 0; i < n; i++) {
      const a = this.angle + (i / n) * Math.PI * 2;
      const orb = { x: p.x + Math.cos(a) * radius, y: p.y + Math.sin(a) * radius, r: 9 };
      engine.orbs.push(orb);
      for (const e of engine.queryEnemies(orb.x, orb.y, orb.r)) {
        if ((e.x - orb.x) ** 2 + (e.y - orb.y) ** 2 > (e.r + orb.r) ** 2) continue;
        if ((this.nextHit.get(e.id) ?? 0) > engine.time) continue;
        this.nextHit.set(e.id, engine.time + 0.3);
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        engine.damageEnemy(e, dmg, (dx / d) * 140, (dy / d) * 140);
      }
    }
  }

  ready() {
    return 1;
  }
}

/** 회전 베기: 주변을 한 바퀴 크게 벤다. 개수만큼 연달아 */
export class SlashWeapon extends RepeatWeapon {
  readonly id = 'slash';

  constructor(stats: WeaponStats, spec: SkillSpec, tree: SkillTree) {
    super(stats, spec, tree, 0.5);
    this.gap = 0.14;
  }

  protected fire(engine: Engine) {
    const p = engine.player;
    if (engine.nearestEnemies(p.x, p.y, 1, 110).length === 0) return false;
    return super.fire(engine);
  }

  protected hit(engine: Engine, i: number) {
    const p = engine.player;
    const r = 85;
    // 베는 방향을 번갈아 돌려 그린다
    const a = (i * Math.PI) / 2;
    engine.addSprite('slash', p.x + Math.cos(a) * 20, p.y + Math.sin(a) * 20 - 6, r, 0.22);
    engine.addEffect('ring', p.x, p.y, r, 0.2, '#ffe08a');
    engine.blast(p.x, p.y, r, this.power, 260);
    engine.addShake(1.5);
  }
}

/** 번개 연쇄: 가까운 적에게 번개가 꽂혀 옆 적으로 계속 튄다 (개수 = 튀는 횟수) */
export class ChainWeapon extends SkillWeapon {
  readonly id = 'chain';

  constructor(stats: WeaponStats, spec: SkillSpec, tree: SkillTree) {
    super(stats, spec, tree, 0.4);
  }

  protected get count() {
    return this.spec.count + this.tree.cnt * 2;
  }

  protected fire(engine: Engine) {
    const p = engine.player;
    let cur: Enemy | undefined = engine.nearestEnemies(p.x, p.y, 1, 260)[0];
    if (!cur) return false;
    const hit = new Set<number>();
    let fromX = p.x;
    let fromY = p.y - 20;
    for (let i = 0; i <= this.count && cur; i++) {
      hit.add(cur.id);
      engine.addEffect('bolt', fromX, fromY, 0, 0.22, '#9fe4ff', cur.x, cur.y);
      engine.addSprite('blue-slash', cur.x, cur.y - 6, 16, 0.2);
      fromX = cur.x;
      fromY = cur.y;
      engine.damageEnemy(cur, this.power);
      cur = engine.nearestEnemies(fromX, fromY, 8, 130).find((e) => !hit.has(e.id) && e.active);
    }
    return true;
  }
}

/** 블랙홀: 적 무리 한가운데 구멍을 열어 빨아들이며 피해, 닫힐 때 크게 폭발 */
export class BlackHoleWeapon extends SkillWeapon {
  readonly id = 'blackhole';

  constructor(stats: WeaponStats, spec: SkillSpec, tree: SkillTree) {
    super(stats, spec, tree, 1.5);
  }

  protected fire(engine: Engine) {
    const p = engine.player;
    const near = engine.nearestEnemies(p.x, p.y, 30, 260);
    if (near.length === 0) return false;
    for (let i = 0; i < this.count; i++) {
      const t = near[Math.floor(Math.random() * near.length)];
      engine.addZone(t.x, t.y, 0, 0, 34, 2.2, this.power * 0.3, 'purple-pit', 160, this.power * 3, 90);
    }
    return true;
  }
}

/** 별똥별: 주변 적들 위로 별이 쏟아져 터진다 */
export class MeteorWeapon extends SkillWeapon {
  readonly id = 'meteor';

  constructor(stats: WeaponStats, spec: SkillSpec, tree: SkillTree) {
    super(stats, spec, tree, 1);
  }

  protected fire(engine: Engine) {
    const p = engine.player;
    const near = engine.nearestEnemies(p.x, p.y, 60, 300);
    if (near.length === 0) return false;
    for (let i = 0; i < this.count; i++) {
      const t = near[Math.floor(Math.random() * near.length)];
      // 조금씩 늦게 떨어지게 해서 다다다 터지는 맛
      const delay = 0.45 + i * 0.07;
      engine.lobEgg(t.x + (Math.random() - 0.5) * 40, t.y + (Math.random() - 0.5) * 40, t.x, t.y, delay, this.power, 50, 'meteor');
    }
    return true;
  }
}

/** 빛의 기둥: 화면 안 무작위 적들에게 빛 기둥이 내리꽂힌다 */
export class PillarWeapon extends SkillWeapon {
  readonly id = 'pillar';

  constructor(stats: WeaponStats, spec: SkillSpec, tree: SkillTree) {
    super(stats, spec, tree, 0.8);
  }

  protected fire(engine: Engine) {
    const p = engine.player;
    const near = engine.nearestEnemies(p.x, p.y, 80, 320);
    if (near.length === 0) return false;
    for (const t of shuffle(near).slice(0, this.count)) {
      engine.addSprite('pillar', t.x, t.y - 34, 34, 0.4);
      engine.blast(t.x, t.y, 36, this.power, 0);
    }
    engine.addShake(2);
    return true;
  }
}
