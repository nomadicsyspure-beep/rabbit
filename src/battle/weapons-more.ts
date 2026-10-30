import type { Engine } from './engine';
import { RepeatWeapon, SkillWeapon, shuffle, type SkillSpec, type SkillTree, type WeaponStats } from './weapons';

// 추가 스킬 (2차). 그림은 아직 기존 이펙트 그림을 돌려 쓴다. 나중에 추려서 밸런스를 맞출 예정.

/** 바라보는(가까운 적) 방향 각도 */
function aimAngle(engine: Engine, range: number) {
  const p = engine.player;
  const t = engine.nearestEnemies(p.x, p.y, 1, range)[0];
  return t ? Math.atan2(t.y - p.y, t.x - p.x) : null;
}

/** 부메랑: 날아갔다가 돌아오며 오가는 길에 다 벤다 */
export class BoomerangWeapon extends SkillWeapon {
  readonly id = 'boomerang';

  constructor(stats: WeaponStats, spec: SkillSpec, tree: SkillTree) {
    super(stats, spec, tree, 0.5);
  }

  protected fire(engine: Engine) {
    const base = aimAngle(engine, 280);
    if (base === null) return false;
    const p = engine.player;
    const n = this.count;
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.45;
      engine.fireProjectile(p.x, p.y - 8, p.x + Math.cos(a), p.y + Math.sin(a), 560, this.power, 1500, 999, 'slash', 0, {
        back: true, r: 12, scale: 1.1,
      });
    }
    return true;
  }
}

/** 반딧불: 적을 쫓아가는 빛 구슬 */
export class FireflyWeapon extends SkillWeapon {
  readonly id = 'firefly';

  constructor(stats: WeaponStats, spec: SkillSpec, tree: SkillTree) {
    super(stats, spec, tree, 0.4);
  }

  protected fire(engine: Engine) {
    const base = aimAngle(engine, 320);
    if (base === null) return false;
    const p = engine.player;
    const n = this.count;
    for (let i = 0; i < n; i++) {
      const a = base + (Math.random() - 0.5) * 2.4;
      engine.fireProjectile(p.x, p.y - 10, p.x + Math.cos(a), p.y + Math.sin(a), 260, this.power, 700, 0, 'sparkle', 0, { home: 6, r: 6 });
    }
    return true;
  }
}

/** 독안개: 적 무리에 독 구름을 깔아 계속 피해 */
export class PoisonWeapon extends SkillWeapon {
  readonly id = 'poison';

  constructor(stats: WeaponStats, spec: SkillSpec, tree: SkillTree) {
    super(stats, spec, tree, 0.7);
  }

  protected fire(engine: Engine) {
    const p = engine.player;
    const near = engine.nearestEnemies(p.x, p.y, 40, 260);
    if (near.length === 0) return false;
    for (const t of shuffle(near).slice(0, this.count)) {
      engine.addZone(t.x, t.y, 0, 0, 40, 3, this.power * 0.35, 'dust');
      engine.burst(t.x, t.y, 8, ['#9be36a', '#6fbf4a', '#d8ff9a'], 90, 0.6, -40);
    }
    return true;
  }
}

/** 지진: 발밑에서 점점 커지는 땅울림이 연달아 */
export class QuakeWeapon extends RepeatWeapon {
  readonly id = 'quake';

  constructor(stats: WeaponStats, spec: SkillSpec, tree: SkillTree) {
    super(stats, spec, tree, 0.9);
    this.gap = 0.18;
  }

  protected fire(engine: Engine) {
    const p = engine.player;
    if (engine.nearestEnemies(p.x, p.y, 1, 150).length === 0) return false;
    return super.fire(engine);
  }

  protected hit(engine: Engine, i: number) {
    const p = engine.player;
    const r = 60 + i * 40;
    engine.addEffect('ring', p.x, p.y, r, 0.35, '#c8a070');
    engine.burst(p.x, p.y, 12, ['#8a6a4a', '#c8a070', '#5a3a20'], 160 + i * 40, 0.5, 200);
    engine.blast(p.x, p.y, r, this.power, 90);
    engine.addShake(3);
  }
}

/** 낙뢰: 하늘에서 번개가 무작위 적에게 */
export class ThunderWeapon extends SkillWeapon {
  readonly id = 'thunder';

  constructor(stats: WeaponStats, spec: SkillSpec, tree: SkillTree) {
    super(stats, spec, tree, 0.6);
  }

  protected fire(engine: Engine) {
    const p = engine.player;
    const near = engine.nearestEnemies(p.x, p.y, 60, 320);
    if (near.length === 0) return false;
    for (const t of shuffle(near).slice(0, this.count)) {
      engine.addEffect('bolt', t.x + (Math.random() - 0.5) * 60, t.y - 280, 0, 0.25, '#fff27a', t.x, t.y);
      engine.addSprite('star-burst', t.x, t.y, 26, 0.3);
      engine.blast(t.x, t.y, 34, this.power, 40);
    }
    engine.addShake(2);
    return true;
  }
}

/** 얼음 창: 일직선으로 꿰뚫는 빠른 창 */
export class LanceWeapon extends SkillWeapon {
  readonly id = 'lance';

  constructor(stats: WeaponStats, spec: SkillSpec, tree: SkillTree) {
    super(stats, spec, tree, 0.6);
  }

  protected fire(engine: Engine) {
    const base = aimAngle(engine, 360);
    if (base === null) return false;
    const p = engine.player;
    const n = this.count;
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.12;
      engine.fireProjectile(p.x, p.y - 8, p.x + Math.cos(a), p.y + Math.sin(a), 720, this.power, 480, 999, 'ice-crystals', 0, { r: 9, scale: 1.2 });
    }
    return true;
  }
}

/** 별 폭죽: 사방으로 별이 터져 나간다 */
export class NovaWeapon extends SkillWeapon {
  readonly id = 'nova';

  constructor(stats: WeaponStats, spec: SkillSpec, tree: SkillTree) {
    super(stats, spec, tree, 0.8);
  }

  protected fire(engine: Engine) {
    const p = engine.player;
    if (engine.nearestEnemies(p.x, p.y, 1, 200).length === 0) return false;
    const n = this.count;
    const off = Math.random() * Math.PI;
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * Math.PI * 2;
      engine.fireProjectile(p.x, p.y - 8, p.x + Math.cos(a), p.y + Math.sin(a), 380, this.power, 280, 1, 'star-burst', 0, { r: 7 });
    }
    engine.addEffect('ring', p.x, p.y, 50, 0.25, '#ffe08a');
    return true;
  }
}

/** 불길: 지나간 자리에 불꽃이 남는다 */
export class FireTrailWeapon extends SkillWeapon {
  readonly id = 'firetrail';

  constructor(stats: WeaponStats, spec: SkillSpec, tree: SkillTree) {
    super(stats, spec, tree, 0.2);
  }

  protected fire(engine: Engine) {
    const p = engine.player;
    if (engine.nearestEnemies(p.x, p.y, 1, 260).length === 0) return false;
    for (let i = 0; i < this.count; i++) {
      const ox = i === 0 ? 0 : (Math.random() - 0.5) * 50;
      const oy = i === 0 ? 0 : (Math.random() - 0.5) * 50;
      engine.addZone(p.x + ox, p.y + oy + 6, 0, 0, 22, 2.4, this.power, 'fire-burst');
    }
    return true;
  }
}

/** 거대 알: 아주 큰 알을 던져 크게 펑 */
export class BigEggWeapon extends SkillWeapon {
  readonly id = 'bigegg';

  constructor(stats: WeaponStats, spec: SkillSpec, tree: SkillTree) {
    super(stats, spec, tree, 1.2);
  }

  protected fire(engine: Engine) {
    const p = engine.player;
    const near = engine.nearestEnemies(p.x, p.y, 30, 280);
    if (near.length === 0) return false;
    for (let i = 0; i < this.count; i++) {
      const t = near[Math.floor(Math.random() * near.length)];
      engine.lobEgg(p.x, p.y - 10, t.x, t.y, 0.7 + i * 0.1, this.power, 115, 'egg', 2.4);
    }
    return true;
  }
}

/** 흡혈: 가까운 적의 생명력을 빨아 체력 회복 */
export class VampireWeapon extends SkillWeapon {
  readonly id = 'vampire';

  constructor(stats: WeaponStats, spec: SkillSpec, tree: SkillTree) {
    super(stats, spec, tree, 0.5);
  }

  protected fire(engine: Engine) {
    const p = engine.player;
    const targets = engine.nearestEnemies(p.x, p.y, this.count, 220);
    if (targets.length === 0) return false;
    for (const t of targets) {
      engine.addEffect('bolt', t.x, t.y, 0, 0.2, '#ff4d8d', p.x, p.y - 10);
      engine.damageEnemy(t, this.power);
    }
    const heal = p.maxHp * 0.008 * targets.length;
    if (p.hp < p.maxHp) {
      p.hp = Math.min(p.maxHp, p.hp + heal);
      engine.addText(p.x, p.y - p.r - 14, '+' + Math.ceil(heal), '#ff8db0', 12);
    }
    return true;
  }
}

/** 성스러운 십자: 십자로 빛줄기가 뻗는다 (번갈아 45° 돌려서) */
export class CrossWeapon extends RepeatWeapon {
  readonly id = 'cross';

  constructor(stats: WeaponStats, spec: SkillSpec, tree: SkillTree) {
    super(stats, spec, tree, 0.7);
    this.gap = 0.22;
  }

  protected fire(engine: Engine) {
    const p = engine.player;
    if (engine.nearestEnemies(p.x, p.y, 1, 200).length === 0) return false;
    return super.fire(engine);
  }

  protected hit(engine: Engine, i: number) {
    const p = engine.player;
    const off = (i % 2) * (Math.PI / 4);
    for (let k = 0; k < 4; k++) {
      const a = off + (k * Math.PI) / 2;
      const ex = p.x + Math.cos(a) * 230;
      const ey = p.y + Math.sin(a) * 230;
      engine.addEffect('telegraph', p.x, p.y - 6, 9, 0.25, '#fff6a0', ex, ey - 6);
      engine.lineHit(p.x, p.y, ex, ey, 14, this.power, 120);
    }
    engine.addSprite('heal-cross', p.x, p.y - 20, 30, 0.3);
  }
}

/** 중력 폭탄: 앞쪽에 소용돌이를 열어 끌어모은 뒤 대폭발 (개수 = 폭발 크기) */
export class GravityWeapon extends SkillWeapon {
  readonly id = 'gravity';

  constructor(stats: WeaponStats, spec: SkillSpec, tree: SkillTree) {
    super(stats, spec, tree, 1.2);
  }

  protected fire(engine: Engine) {
    const p = engine.player;
    const near = engine.nearestEnemies(p.x, p.y, 1, 260)[0];
    if (!near) return false;
    const blastR = 100 + this.count * 15;
    engine.addZone(near.x, near.y, 0, 0, 40, 1.1, this.power * 0.2, 'purple-pit', 320, this.power * 3, blastR);
    return true;
  }
}

/** 레이저: 가장 가까운 적 쪽으로 화면을 가르는 광선 */
export class LaserWeapon extends SkillWeapon {
  readonly id = 'laser';

  constructor(stats: WeaponStats, spec: SkillSpec, tree: SkillTree) {
    super(stats, spec, tree, 0.8);
  }

  protected fire(engine: Engine) {
    const base = aimAngle(engine, 340);
    if (base === null) return false;
    const p = engine.player;
    const n = this.count;
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.28;
      const ex = p.x + Math.cos(a) * 420;
      const ey = p.y + Math.sin(a) * 420;
      engine.addEffect('telegraph', p.x, p.y - 8, 7, 0.3, '#ff5ce0', ex, ey);
      engine.addEffect('telegraph', p.x, p.y - 8, 2, 0.3, '#ffffff', ex, ey);
      engine.lineHit(p.x, p.y, ex, ey, 12, this.power, 50);
    }
    engine.addShake(2);
    return true;
  }
}

/** 눈보라: 주변 적들에게 얼음이 다다닥 (맞으면 느려짐) */
export class BlizzardWeapon extends RepeatWeapon {
  readonly id = 'blizzard';

  constructor(stats: WeaponStats, spec: SkillSpec, tree: SkillTree) {
    super(stats, spec, tree, 0.8);
    this.gap = 0.07;
  }

  protected fire(engine: Engine) {
    const p = engine.player;
    if (engine.nearestEnemies(p.x, p.y, 1, 220).length === 0) return false;
    return super.fire(engine);
  }

  protected hit(engine: Engine) {
    const p = engine.player;
    const near = engine.nearestEnemies(p.x, p.y, 30, 220);
    const t = near[Math.floor(Math.random() * near.length)];
    if (!t) return;
    engine.addSprite('ice-crystals', t.x, t.y - 8, 22, 0.35);
    for (const e of engine.blast(t.x, t.y, 26, this.power, 0)) e.slowT = 2;
  }
}

/** 폭죽: 반짝이를 높이 던져 적 무리 위에서 터뜨린다 */
export class FireworkWeapon extends SkillWeapon {
  readonly id = 'firework';

  constructor(stats: WeaponStats, spec: SkillSpec, tree: SkillTree) {
    super(stats, spec, tree, 1);
  }

  protected fire(engine: Engine) {
    const p = engine.player;
    const near = engine.nearestEnemies(p.x, p.y, 40, 300);
    if (near.length === 0) return false;
    for (let i = 0; i < this.count; i++) {
      const t = near[Math.floor(Math.random() * near.length)];
      engine.lobEgg(p.x, p.y - 10, t.x + (Math.random() - 0.5) * 30, t.y + (Math.random() - 0.5) * 30, 0.55 + i * 0.06, this.power, 64, 'gold-sparkle', 1.4);
    }
    return true;
  }
}

/** 도깨비불: 둘레에 불꽃 고리가 생겨 바깥으로 퍼진다 */
export class WispWeapon extends SkillWeapon {
  readonly id = 'wisp';

  constructor(stats: WeaponStats, spec: SkillSpec, tree: SkillTree) {
    super(stats, spec, tree, 0.6);
  }

  protected fire(engine: Engine) {
    const p = engine.player;
    if (engine.nearestEnemies(p.x, p.y, 1, 180).length === 0) return false;
    const n = this.count;
    const off = Math.random() * Math.PI;
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * Math.PI * 2;
      engine.addZone(p.x + Math.cos(a) * 30, p.y + Math.sin(a) * 30, Math.cos(a) * 90, Math.sin(a) * 90, 16, 2, this.power, 'purple-flame');
    }
    return true;
  }
}

/** 깃털 폭풍: 사방으로 깃털이 한꺼번에 */
export class FeatherStormWeapon extends SkillWeapon {
  readonly id = 'featherstorm';

  constructor(stats: WeaponStats, spec: SkillSpec, tree: SkillTree) {
    super(stats, spec, tree, 0.7);
  }

  protected fire(engine: Engine) {
    const p = engine.player;
    if (engine.nearestEnemies(p.x, p.y, 1, 220).length === 0) return false;
    const n = this.count;
    const off = Math.random() * Math.PI;
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * Math.PI * 2;
      engine.fireProjectile(p.x, p.y - 8, p.x + Math.cos(a), p.y + Math.sin(a), 500, this.power, 320, 1, 'feather');
    }
    return true;
  }
}
