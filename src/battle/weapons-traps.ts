import type { Engine, Enemy } from './engine';
import { FX, SkillWeapon, shuffle, type SkillSpec, type SkillTree, type WeaponStats } from './weapons';

// 5차 스킬: 설치형(벼락 막대 · 깃털 지뢰 · 알 함정), 끈적 기름(불이 닿으면 불바다), 연타 쪼기, 팔방 부메랑.

/** 벼락 막대: 내 자리(와 적 무리 쪽)에 막대를 꽂으면 잠깐 뒤 벼락이 떨어져 주변을 지지고 기절 */
export class RodWeapon extends SkillWeapon {
  readonly id = 'rod';

  constructor(stats: WeaponStats, spec: SkillSpec, tree: SkillTree) {
    super(stats, spec, tree, 0.6);
  }

  protected fire(engine: Engine) {
    const p = engine.player;
    const near = engine.nearestEnemies(p.x, p.y, 20, 220);
    if (near.length === 0) return false;
    const r = 80 * FX;
    // 첫 막대는 내 자리, 나머지는 가까운 적 무리 자리
    engine.addTrap('rod', p.x, p.y + 4, this.power, r, r, 1.3);
    for (const t of shuffle(near).slice(0, this.count - 1)) engine.addTrap('rod', t.x, t.y, this.power, r, r, 1.3 + Math.random() * 0.3);
    return true;
  }
}

/** 깃털 지뢰: 발밑에 지뢰를 깔아 둔다. 몹이 밟으면 펑 (불 폭발이라 기름에 불이 붙는다) */
export class MineWeapon extends SkillWeapon {
  readonly id = 'mine';

  constructor(stats: WeaponStats, spec: SkillSpec, tree: SkillTree) {
    super(stats, spec, tree, 0.4);
  }

  protected fire(engine: Engine) {
    const p = engine.player;
    if (engine.nearestEnemies(p.x, p.y, 1, 300).length === 0) return false;
    for (let i = 0; i < this.count; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = i === 0 ? 0 : 14 + Math.random() * 22;
      engine.addTrap('mine', p.x + Math.cos(a) * d, p.y + 6 + Math.sin(a) * d * 0.6, this.power, 12, 58 * FX, 0.35, 10);
    }
    return true;
  }
}

/** 알 함정: 적이 오는 길목에 알을 떨어뜨려 둔다. 밟으면 펑 */
export class EggTrapWeapon extends SkillWeapon {
  readonly id = 'eggtrap';

  constructor(stats: WeaponStats, spec: SkillSpec, tree: SkillTree) {
    super(stats, spec, tree, 0.5);
  }

  protected fire(engine: Engine) {
    const p = engine.player;
    const near = engine.nearestEnemies(p.x, p.y, 12, 280);
    if (near.length === 0) return false;
    for (let i = 0; i < this.count; i++) {
      const t = near[i % near.length];
      // 적과 나 사이, 적 쪽에 가깝게 (적이 다가오며 밟게)
      const k = 0.55 + Math.random() * 0.2;
      const x = p.x + (t.x - p.x) * k + (Math.random() - 0.5) * 24;
      const y = p.y + (t.y - p.y) * k + (Math.random() - 0.5) * 24;
      engine.addTrap('egg', x, y, this.power, 14, 50 * FX, 0.45, 9);
    }
    return true;
  }
}

/** 끈적 기름: 적 무리 밑에 기름을 뿌려 느리게. 화염 폭발·불 장판·지뢰가 닿으면 불바다 */
export class OilWeapon extends SkillWeapon {
  readonly id = 'oil';

  constructor(stats: WeaponStats, spec: SkillSpec, tree: SkillTree) {
    super(stats, spec, tree, 0.6);
  }

  protected fire(engine: Engine) {
    const p = engine.player;
    const near = engine.nearestEnemies(p.x, p.y, 30, 260);
    if (near.length === 0) return false;
    for (const t of shuffle(near).slice(0, this.count)) {
      const z = engine.addZone(t.x, t.y, 0, 0, 46 * FX, 4.5, this.power, 'oil', 0, 0, 0, 1.6);
      if (z) z.oil = true;
      engine.burst(t.x, t.y - 4, 5, ['#1d1712', '#3a2c20', '#8a7cff'], 120, 0.35, 300, 3);
    }
    return true;
  }
}

/** 연타 쪼기: 가까운 적에게 콩 뛰어들어 세 번 연달아 쪼고, 세 번째는 크게 들어가며 밀쳐 낸다 */
export class PeckWeapon extends SkillWeapon {
  readonly id = 'peck';
  private targets: Enemy[] = [];
  private step = 0;
  private stepT = 0;

  constructor(stats: WeaponStats, spec: SkillSpec, tree: SkillTree) {
    super(stats, spec, tree, 0.3);
  }

  update(engine: Engine, dt: number) {
    if (this.step > 0) {
      this.stepT -= dt;
      if (this.stepT <= 0) {
        this.stepT = 0.13;
        this.hit(engine, this.step);
        this.step = this.step >= 2 ? 0 : this.step + 1;
      }
    }
    super.update(engine, dt);
  }

  protected fire(engine: Engine) {
    if (this.step > 0) return false;
    const p = engine.player;
    this.targets = engine.nearestEnemies(p.x, p.y, this.count, 170);
    if (this.targets.length === 0) return false;
    // 멀면 첫 대상 쪽으로 콩 뛰어든다
    const t = this.targets[0];
    const d = Math.hypot(t.x - p.x, t.y - p.y);
    if (d > 50) engine.hopPlayer(t.x, t.y, Math.min(d - 35, 110));
    this.hit(engine, 0);
    this.step = 1;
    this.stepT = 0.13;
    return true;
  }

  private hit(engine: Engine, i: number) {
    const p = engine.player;
    const last = i === 2;
    for (const e of this.targets) {
      if (!e.active) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const knock = last ? 280 : 40;
      // 쪼는 자리: 적 몸 앞쪽에 작은 베기, 마지막은 별 터짐
      const hx = e.x - (dx / d) * e.r * 0.5;
      const hy = e.y - e.r * 0.3 - (dy / d) * e.r * 0.3;
      engine.addSprite(last ? 'star-burst' : 'slash', hx, hy, last ? 30 : 16 + i * 4, last ? 0.25 : 0.15);
      engine.damageEnemy(e, this.power * (last ? 2.2 : 0.6), (dx / d) * knock, (dy / d) * knock);
      if (last) {
        engine.burst(hx, hy, 8, ['#ffe066', '#ffffff', '#ffb347'], 220, 0.3, 200, 3);
        engine.blast(e.x, e.y, 26, this.power * 0.6, 120);
      }
    }
    if (last) engine.addShake(1.5);
  }
}

/** 팔방 부메랑: 하나를 던져 맞힌 적 자리에서 부메랑이 팔방으로 퍼졌다가 그 자리로 돌아온다 */
export class BurstBoomerangWeapon extends SkillWeapon {
  readonly id = 'burstrang';

  constructor(stats: WeaponStats, spec: SkillSpec, tree: SkillTree) {
    super(stats, spec, tree, 0.5);
  }

  protected fire(engine: Engine) {
    const p = engine.player;
    const t = engine.nearestEnemies(p.x, p.y, 1, 320)[0];
    if (!t) return false;
    engine.fireProjectile(p.x, p.y - 8, t.x, t.y, 420, this.power * 1.5, 360, 0, 'blue-slash', 0, {
      r: 9, scale: 1.1, burst: Math.round(this.count), burstDmg: this.power,
    });
    return true;
  }
}
