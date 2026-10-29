import { fmt } from '../core/format';

// 방치 모드와 액션 모드가 같이 쓰는 전투 엔진.
// 엔진은 "누가 조종하는지"(Controller)와 "적을 어떻게 내보내는지"(모드)를 모른다.

export type EnemyKind = 'normal' | 'fast' | 'tank' | 'boss';

export interface Enemy {
  id: number;
  active: boolean;
  kind: EnemyKind;
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  speed: number;
  dmg: number;
  gold: number;
  xp: number;
  flash: number;
  kx: number;
  ky: number;
  /** 보스 패턴용 타이머 */
  t1: number;
  t2: number;
  dashT: number;
  dashX: number;
  dashY: number;
}

export interface Projectile {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  life: number;
  pierce: number;
  hit: number[];
}

export interface EnemyBullet {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  life: number;
}

export interface Gem {
  active: boolean;
  x: number;
  y: number;
  value: number;
  pulled: boolean;
}

export interface FloatText {
  active: boolean;
  x: number;
  y: number;
  text: string;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export type EffectKind = 'ring' | 'bolt' | 'burst' | 'telegraph';

export interface Effect {
  active: boolean;
  kind: EffectKind;
  x: number;
  y: number;
  x2: number;
  y2: number;
  r: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface Orb {
  x: number;
  y: number;
  r: number;
}

export interface Player {
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  speed: number;
  regen: number;
  magnet: number;
  faceX: number;
  faceY: number;
  invuln: number;
  flash: number;
  dead: boolean;
}

export interface Vec {
  x: number;
  y: number;
}

export interface Controller {
  /** 이동 방향. 길이는 0~1 */
  getMove(engine: Engine): Vec;
}

export interface Weapon {
  id: string;
  level: number;
  update(engine: Engine, dt: number): void;
}

export class Pool<T extends { active: boolean }> {
  readonly items: T[] = [];
  constructor(
    private readonly make: () => T,
    private readonly max: number,
  ) {}

  get(): T | null {
    for (const it of this.items) if (!it.active) return it;
    if (this.items.length >= this.max) return null;
    const it = this.make();
    this.items.push(it);
    return it;
  }

  clear() {
    for (const it of this.items) it.active = false;
  }

  countActive() {
    let n = 0;
    for (const it of this.items) if (it.active) n++;
    return n;
  }
}

/** 적 충돌 판정용 격자. 매 프레임 다시 채운다. */
class Grid {
  private readonly cells = new Map<number, Enemy[]>();
  constructor(private readonly size: number) {}

  private key(cx: number, cy: number) {
    return (cx + 32768) * 65536 + (cy + 32768);
  }

  rebuild(enemies: Enemy[]) {
    for (const arr of this.cells.values()) arr.length = 0;
    for (const e of enemies) {
      if (!e.active) continue;
      const k = this.key(Math.floor(e.x / this.size), Math.floor(e.y / this.size));
      let arr = this.cells.get(k);
      if (!arr) {
        arr = [];
        this.cells.set(k, arr);
      }
      arr.push(e);
    }
  }

  query(x: number, y: number, r: number, out: Enemy[]): Enemy[] {
    out.length = 0;
    const x0 = Math.floor((x - r) / this.size);
    const x1 = Math.floor((x + r) / this.size);
    const y0 = Math.floor((y - r) / this.size);
    const y1 = Math.floor((y + r) / this.size);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const arr = this.cells.get(this.key(cx, cy));
        if (arr) for (const e of arr) if (e.active) out.push(e);
      }
    }
    return out;
  }
}

const MAX_ENEMY_R = 30;

export class Engine {
  viewW = 360;
  viewH = 300;
  camX = 0;
  camY = 0;
  /** 방치 모드: 화면 안에 묶음 / 액션 모드: null(무한 맵) */
  bounds: { w: number; h: number } | null = null;
  followCamera = false;
  dropGems = false;
  showDamageText = true;
  time = 0;

  readonly player: Player = {
    x: 0, y: 0, r: 12, hp: 100, maxHp: 100, speed: 120, regen: 0, magnet: 60,
    faceX: 1, faceY: 0, invuln: 0, flash: 0, dead: false,
  };

  readonly enemies = new Pool<Enemy>(() => ({
    id: 0, active: false, kind: 'normal', x: 0, y: 0, r: 10, hp: 1, maxHp: 1, speed: 40, dmg: 1,
    gold: 0, xp: 0, flash: 0, kx: 0, ky: 0, t1: 0, t2: 0, dashT: 0, dashX: 0, dashY: 0,
  }), 400);
  readonly projectiles = new Pool<Projectile>(() => ({
    active: false, x: 0, y: 0, vx: 0, vy: 0, r: 4, dmg: 1, life: 1, pierce: 0, hit: [],
  }), 400);
  readonly bullets = new Pool<EnemyBullet>(() => ({
    active: false, x: 0, y: 0, vx: 0, vy: 0, r: 5, dmg: 1, life: 1,
  }), 300);
  readonly gems = new Pool<Gem>(() => ({ active: false, x: 0, y: 0, value: 1, pulled: false }), 600);
  readonly texts = new Pool<FloatText>(() => ({
    active: false, x: 0, y: 0, text: '', life: 0, maxLife: 1, color: '#fff', size: 12,
  }), 80);
  readonly effects = new Pool<Effect>(() => ({
    active: false, kind: 'ring', x: 0, y: 0, x2: 0, y2: 0, r: 0, life: 0, maxLife: 1, color: '#fff',
  }), 120);

  readonly orbs: Orb[] = [];
  weapons: Weapon[] = [];
  controller: Controller = { getMove: () => ({ x: 0, y: 0 }) };

  onKill: ((e: Enemy) => void) | null = null;
  onGem: ((value: number) => void) | null = null;
  onPlayerDead: (() => void) | null = null;

  private readonly grid = new Grid(48);
  private readonly tmp: Enemy[] = [];
  private nextId = 1;

  reset() {
    this.enemies.clear();
    this.projectiles.clear();
    this.bullets.clear();
    this.gems.clear();
    this.texts.clear();
    this.effects.clear();
    this.orbs.length = 0;
    this.weapons = [];
    this.time = 0;
    const p = this.player;
    p.dead = false;
    p.invuln = 0;
    p.flash = 0;
    p.faceX = 1;
    p.faceY = 0;
  }

  spawnEnemy(init: Partial<Enemy> & Pick<Enemy, 'kind' | 'x' | 'y' | 'hp'>): Enemy | null {
    const e = this.enemies.get();
    if (!e) return null;
    Object.assign(e, {
      r: 10, speed: 40, dmg: 1, gold: 0, xp: 1, t1: 0, t2: 0, dashT: 0, dashX: 0, dashY: 0,
    }, init);
    e.id = this.nextId++;
    e.active = true;
    e.maxHp = init.maxHp ?? init.hp;
    e.flash = 0;
    e.kx = 0;
    e.ky = 0;
    return e;
  }

  get boss(): Enemy | null {
    for (const e of this.enemies.items) if (e.active && e.kind === 'boss') return e;
    return null;
  }

  queryEnemies(x: number, y: number, r: number): Enemy[] {
    return this.grid.query(x, y, r + MAX_ENEMY_R, this.tmp);
  }

  /** 기준점에서 가까운 적 n마리 (range 안) */
  nearestEnemies(x: number, y: number, n: number, range: number): Enemy[] {
    const out: Enemy[] = [];
    const dists: number[] = [];
    const r2 = range * range;
    for (const e of this.enemies.items) {
      if (!e.active) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d > r2) continue;
      let i = out.length;
      while (i > 0 && dists[i - 1] > d) i--;
      if (i >= n) continue;
      out.splice(i, 0, e);
      dists.splice(i, 0, d);
      if (out.length > n) {
        out.pop();
        dists.pop();
      }
    }
    return out;
  }

  damageEnemy(e: Enemy, dmg: number, kx = 0, ky = 0) {
    if (!e.active) return;
    e.hp -= dmg;
    e.flash = 0.08;
    if (e.kind !== 'boss') {
      e.kx += kx;
      e.ky += ky;
    }
    if (this.showDamageText) this.addText(e.x + (Math.random() - 0.5) * 8, e.y - e.r - 4, fmt(dmg), '#ffffff', 11);
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: Enemy) {
    e.active = false;
    this.addEffect('burst', e.x, e.y, e.r * 1.6, 0.25, enemyColor(e.kind));
    if (this.dropGems && e.xp > 0) {
      const g = this.gems.get();
      if (g) {
        g.active = true;
        g.x = e.x;
        g.y = e.y;
        g.value = e.xp;
        g.pulled = false;
      }
    }
    this.onKill?.(e);
  }

  damagePlayer(dmg: number) {
    const p = this.player;
    if (p.dead || p.invuln > 0) return;
    p.hp -= dmg;
    p.invuln = 0.35;
    p.flash = 0.2;
    this.addText(p.x, p.y - p.r - 6, '-' + fmt(dmg), '#ff6b6b', 12);
    if (p.hp <= 0) {
      p.hp = 0;
      p.dead = true;
      this.addEffect('burst', p.x, p.y, 40, 0.5, '#ffffff');
      this.onPlayerDead?.();
    }
  }

  fireProjectile(x: number, y: number, tx: number, ty: number, speed: number, dmg: number, range: number, pierce: number) {
    const pr = this.projectiles.get();
    if (!pr) return;
    const dx = tx - x;
    const dy = ty - y;
    const d = Math.hypot(dx, dy) || 1;
    pr.active = true;
    pr.x = x;
    pr.y = y;
    pr.vx = (dx / d) * speed;
    pr.vy = (dy / d) * speed;
    pr.r = 4;
    pr.dmg = dmg;
    pr.life = range / speed;
    pr.pierce = pierce;
    pr.hit.length = 0;
  }

  fireBullet(x: number, y: number, angle: number, speed: number, dmg: number) {
    const b = this.bullets.get();
    if (!b) return;
    b.active = true;
    b.x = x;
    b.y = y;
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
    b.r = 5;
    b.dmg = dmg;
    b.life = 5;
  }

  addText(x: number, y: number, text: string, color: string, size: number) {
    const t = this.texts.get();
    if (!t) return;
    t.active = true;
    t.x = x;
    t.y = y;
    t.text = text;
    t.color = color;
    t.size = size;
    t.life = t.maxLife = 0.7;
  }

  addEffect(kind: EffectKind, x: number, y: number, r: number, life: number, color: string, x2 = 0, y2 = 0) {
    const fx = this.effects.get();
    if (!fx) return;
    fx.active = true;
    fx.kind = kind;
    fx.x = x;
    fx.y = y;
    fx.x2 = x2;
    fx.y2 = y2;
    fx.r = r;
    fx.life = fx.maxLife = life;
    fx.color = color;
  }

  update(dt: number) {
    this.time += dt;
    const p = this.player;

    if (!p.dead) {
      const mv = this.controller.getMove(this);
      const len = Math.hypot(mv.x, mv.y);
      if (len > 0.01) {
        const k = Math.min(1, len);
        p.x += (mv.x / len) * k * p.speed * dt;
        p.y += (mv.y / len) * k * p.speed * dt;
        p.faceX = mv.x / len;
        p.faceY = mv.y / len;
      }
      if (this.bounds) {
        p.x = Math.max(p.r, Math.min(this.bounds.w - p.r, p.x));
        p.y = Math.max(p.r, Math.min(this.bounds.h - p.r, p.y));
      }
      p.hp = Math.min(p.maxHp, p.hp + p.regen * p.maxHp * dt);
    }
    p.invuln -= dt;
    p.flash -= dt;

    if (this.followCamera) {
      this.camX = p.x - this.viewW / 2;
      this.camY = p.y - this.viewH / 2;
    } else {
      this.camX = 0;
      this.camY = 0;
    }

    this.grid.rebuild(this.enemies.items);
    this.updateEnemies(dt);
    this.grid.rebuild(this.enemies.items);

    if (!p.dead) for (const w of this.weapons) w.update(this, dt);
    else this.orbs.length = 0;

    this.updateProjectiles(dt);
    this.updateBullets(dt);
    this.updateGems(dt);

    for (const t of this.texts.items) {
      if (!t.active) continue;
      t.life -= dt;
      t.y -= 28 * dt;
      if (t.life <= 0) t.active = false;
    }
    for (const fx of this.effects.items) {
      if (!fx.active) continue;
      fx.life -= dt;
      if (fx.life <= 0) fx.active = false;
    }
  }

  private updateEnemies(dt: number) {
    const p = this.player;
    for (const e of this.enemies.items) {
      if (!e.active) continue;
      e.flash -= dt;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;

      if (e.kind === 'boss') {
        this.updateBoss(e, dx / d, dy / d, dt);
      } else if (!p.dead) {
        e.x += (dx / d) * e.speed * dt;
        e.y += (dy / d) * e.speed * dt;
      }

      // 넉백
      e.x += e.kx * dt;
      e.y += e.ky * dt;
      const decay = Math.exp(-8 * dt);
      e.kx *= decay;
      e.ky *= decay;

      // 서로 겹치지 않게 밀어내기
      for (const o of this.grid.query(e.x, e.y, e.r * 2, this.tmp)) {
        if (o === e) continue;
        const ox = e.x - o.x;
        const oy = e.y - o.y;
        const od = Math.hypot(ox, oy);
        const min = e.r + o.r;
        if (od > 0 && od < min) {
          const push = ((min - od) / od) * 0.5;
          const wE = e.kind === 'boss' ? 0.1 : 1;
          e.x += ox * push * wE;
          e.y += oy * push * wE;
        }
      }

      if (!p.dead && d < e.r + p.r) this.damagePlayer(e.dmg);
    }
  }

  private updateBoss(e: Enemy, nx: number, ny: number, dt: number) {
    const enraged = e.hp < e.maxHp * 0.5;
    if (e.dashT > 0) {
      // 돌진 준비(예고선) → 돌진
      e.dashT -= dt;
      if (e.dashT < 0.5) {
        e.x += e.dashX * 300 * dt;
        e.y += e.dashY * 300 * dt;
      }
      return;
    }
    if (!this.player.dead) {
      e.x += nx * e.speed * dt;
      e.y += ny * e.speed * dt;
    }
    e.t1 += dt;
    e.t2 += dt;
    const burstCd = enraged ? 2.4 : 3.5;
    if (e.t1 >= burstCd) {
      e.t1 = 0;
      const n = enraged ? 18 : 12;
      const off = Math.random() * Math.PI;
      for (let i = 0; i < n; i++) this.fireBullet(e.x, e.y, off + (i / n) * Math.PI * 2, 110, e.dmg * 0.6);
      this.addEffect('ring', e.x, e.y, e.r * 1.8, 0.3, '#ff7aa8');
    }
    if (e.t2 >= (enraged ? 5 : 7)) {
      e.t2 = 0;
      e.dashT = 1.1;
      e.dashX = nx;
      e.dashY = ny;
      this.addEffect('telegraph', e.x, e.y, e.r, 0.6, '#ff4d6d', e.x + nx * 165, e.y + ny * 165);
    }
  }

  private updateProjectiles(dt: number) {
    for (const pr of this.projectiles.items) {
      if (!pr.active) continue;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.life -= dt;
      if (pr.life <= 0) {
        pr.active = false;
        continue;
      }
      for (const e of this.queryEnemies(pr.x, pr.y, pr.r)) {
        if (pr.hit.includes(e.id)) continue;
        if ((e.x - pr.x) ** 2 + (e.y - pr.y) ** 2 > (e.r + pr.r) ** 2) continue;
        pr.hit.push(e.id);
        const sp = Math.hypot(pr.vx, pr.vy) || 1;
        this.damageEnemy(e, pr.dmg, (pr.vx / sp) * 60, (pr.vy / sp) * 60);
        if (pr.pierce-- <= 0) {
          pr.active = false;
          break;
        }
      }
    }
  }

  private updateBullets(dt: number) {
    const p = this.player;
    for (const b of this.bullets.items) {
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) {
        b.active = false;
        continue;
      }
      if (!p.dead && (b.x - p.x) ** 2 + (b.y - p.y) ** 2 < (b.r + p.r) ** 2) {
        b.active = false;
        this.damagePlayer(b.dmg);
      }
    }
  }

  private updateGems(dt: number) {
    const p = this.player;
    for (const g of this.gems.items) {
      if (!g.active) continue;
      const dx = p.x - g.x;
      const dy = p.y - g.y;
      const d = Math.hypot(dx, dy) || 1;
      if (!p.dead && d < p.magnet) g.pulled = true;
      if (g.pulled) {
        const sp = 260 + (p.magnet - Math.min(d, p.magnet)) * 4;
        g.x += (dx / d) * sp * dt;
        g.y += (dy / d) * sp * dt;
        if (d < p.r + 4) {
          g.active = false;
          this.onGem?.(g.value);
        }
      }
    }
  }
}

export function enemyColor(kind: EnemyKind): string {
  switch (kind) {
    case 'normal':
      return '#e05a5a';
    case 'fast':
      return '#f0a040';
    case 'tank':
      return '#9a6ad8';
    case 'boss':
      return '#d04070';
  }
}
