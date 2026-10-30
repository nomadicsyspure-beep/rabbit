import { fmt } from '../core/format';

// 방치 모드와 액션 모드가 같이 쓰는 전투 엔진.
// 엔진은 "누가 조종하는지"(Controller)와 "적을 어떻게 내보내는지"(모드)를 모른다.

export type EnemyKind = 'normal' | 'fast' | 'tank' | 'boss';
/** 그릴 때 쓰는 외형(src/assets/monsters). 행동(kind)과 따로 둔다. */
export type EnemySkin = 'slime' | 'mushroom' | 'sprout' | 'bat' | 'angel' | 'golem' | 'snail' | 'rabbit' | 'devil';

export interface Enemy {
  id: number;
  active: boolean;
  kind: EnemyKind;
  skin: EnemySkin;
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
  /** 남은 느려짐 시간 (얼음) */
  slowT: number;
  /** 보스 패턴용 타이머 */
  t1: number;
  t2: number;
  dashT: number;
  dashX: number;
  dashY: number;
}

export type ProjectileKind = 'feather' | 'fireball' | 'egg' | 'meteor';

export interface Projectile {
  active: boolean;
  kind: ProjectileKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  life: number;
  pierce: number;
  hit: number[];
  /** 0보다 크면 맞거나(알은 떨어지면) 이 반경으로 폭발 */
  blast: number;
  /** 던진 알·떨어지는 별: 날아가는 전체 시간 (그릴 때 높이 계산용) */
  flight: number;
}

/** 움직이며 닿는 적에게 계속 피해를 주는 장판 (회오리) */
export interface Zone {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  life: number;
  maxLife: number;
  sprite: string;
  nextHit: Map<number, number>;
  /** 0보다 크면 반경 3배 안의 적을 이 속도(px/초)로 빨아들인다 (블랙홀) */
  pull: number;
  /** 사라질 때 이 피해로 blastR 반경 폭발 */
  blast: number;
  blastR: number;
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

/** sprite: src/assets/fx 그림 / corpse: 쓰러진 몬스터 그림 */
export type EffectKind = 'ring' | 'bolt' | 'burst' | 'telegraph' | 'sprite' | 'corpse';

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
  /** sprite: 이펙트 이름 / corpse: 몬스터 외형 */
  sprite: string;
  /** 플레이어를 따라다니는 이펙트 (치유) */
  follow: boolean;
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
  moving: boolean;
  /** 이번 프레임 이동 세기 0~1 (조이스틱을 얼마나 밀었나). 목표 속도 = speed × moveK */
  moveK: number;
  /** 지금 실제 속도(px/초). 출발하면 목표 속도의 일부에서 시작해 가속한다 */
  curSpeed: number;
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
  update(engine: Engine, dt: number): void;
  /** 쿨다운 진행도 0~1 (1 = 준비됨). HUD 막대용 */
  ready?(): number;
  /** 수동 발동: 다음에 준비되면(지금 준비됐으면 바로) 쓴다 */
  trigger?(): void;
  /** 수동 발동이 필요한 스킬인지 (도는 구체처럼 늘 켜진 건 false) */
  manual?: boolean;
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
/** 출발 속도(목표 속도 대비)와 가속 세기. 0.45 → 0.8까지 약 0.4초 */
const START_SPEED = 0.45;
const ACCEL = 2.5;
/** 화면 흔들림 최대(px) */
const MAX_SHAKE = 7;

const DEFAULT_SKIN: Record<EnemyKind, EnemySkin> = {
  normal: 'slime',
  fast: 'bat',
  tank: 'golem',
  boss: 'devil',
};

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
  /** false면 스킬은 trigger()로 눌렀을 때만 나간다 */
  autoSkills = true;
  time = 0;
  /** 화면 흔들림 세기(px). 폭발·피격 때 올라가고 금방 줄어든다 */
  shake = 0;

  readonly player: Player = {
    x: 0, y: 0, r: 12, hp: 100, maxHp: 100, speed: 120, regen: 0, magnet: 60,
    faceX: 1, faceY: 0, invuln: 0, flash: 0, dead: false, moving: false, moveK: 0, curSpeed: 0,
  };

  readonly enemies = new Pool<Enemy>(() => ({
    id: 0, active: false, kind: 'normal', skin: 'slime', x: 0, y: 0, r: 10, hp: 1, maxHp: 1, speed: 40, dmg: 1,
    gold: 0, xp: 0, flash: 0, kx: 0, ky: 0, slowT: 0, t1: 0, t2: 0, dashT: 0, dashX: 0, dashY: 0,
  }), 500);
  readonly projectiles = new Pool<Projectile>(() => ({
    active: false, kind: 'feather', x: 0, y: 0, vx: 0, vy: 0, r: 4, dmg: 1, life: 1, pierce: 0, hit: [], blast: 0, flight: 0,
  }), 400);
  readonly zones = new Pool<Zone>(() => ({
    active: false, x: 0, y: 0, vx: 0, vy: 0, r: 20, dmg: 1, life: 0, maxLife: 1, sprite: '', nextHit: new Map(),
    pull: 0, blast: 0, blastR: 0,
  }), 60);
  readonly bullets = new Pool<EnemyBullet>(() => ({
    active: false, x: 0, y: 0, vx: 0, vy: 0, r: 5, dmg: 1, life: 1,
  }), 300);
  readonly gems = new Pool<Gem>(() => ({ active: false, x: 0, y: 0, value: 1, pulled: false }), 900);
  readonly texts = new Pool<FloatText>(() => ({
    active: false, x: 0, y: 0, text: '', life: 0, maxLife: 1, color: '#fff', size: 12,
  }), 160);
  readonly effects = new Pool<Effect>(() => ({
    active: false, kind: 'ring', x: 0, y: 0, x2: 0, y2: 0, r: 0, life: 0, maxLife: 1, color: '#fff', sprite: '', follow: false,
  }), 500);

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
    this.zones.clear();
    this.bullets.clear();
    this.gems.clear();
    this.texts.clear();
    this.effects.clear();
    this.orbs.length = 0;
    this.weapons = [];
    this.time = 0;
    this.shake = 0;
    const p = this.player;
    p.dead = false;
    p.curSpeed = 0;
    p.invuln = 0;
    p.flash = 0;
    p.faceX = 1;
    p.faceY = 0;
  }

  spawnEnemy(init: Partial<Enemy> & Pick<Enemy, 'kind' | 'x' | 'y' | 'hp'>): Enemy | null {
    const e = this.enemies.get();
    if (!e) return null;
    Object.assign(e, {
      skin: DEFAULT_SKIN[init.kind], r: 10, speed: 40, dmg: 1, gold: 0, xp: 1, slowT: 0, t1: 0, t2: 0, dashT: 0, dashX: 0, dashY: 0,
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
    if (this.showDamageText) this.addText(e.x + (Math.random() - 0.5) * 8, e.y - e.r - 4, fmt(dmg), '#ffe066', 12);
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: Enemy) {
    e.active = false;
    const fx = this.addEffect('corpse', e.x, e.y + e.r, e.r, 0.6, '#fff');
    if (fx) fx.sprite = e.skin;
    this.addSprite('dust', e.x, e.y + e.r * 0.4, e.r * 1.3, 0.35);
    this.addSprite('sparkle', e.x, e.y - e.r * 0.3, e.r * 0.9, 0.2);
    this.addShake(e.kind === 'boss' ? MAX_SHAKE : 0.8);
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
    if (p.dead || p.invuln > 0 || dmg <= 0) return;
    p.hp -= dmg;
    p.invuln = 0.5;
    p.flash = 0.2;
    this.addShake(4);
    this.addText(p.x, p.y - p.r - 6, '-' + fmt(dmg), '#ff6b6b', 12);
    if (p.hp <= 0) {
      p.hp = 0;
      p.dead = true;
      this.addEffect('burst', p.x, p.y, 40, 0.5, '#ffffff');
      this.onPlayerDead?.();
    }
  }

  fireProjectile(
    x: number, y: number, tx: number, ty: number, speed: number, dmg: number, range: number, pierce: number,
    kind: ProjectileKind = 'feather', blast = 0,
  ) {
    const pr = this.projectiles.get();
    if (!pr) return;
    const dx = tx - x;
    const dy = ty - y;
    const d = Math.hypot(dx, dy) || 1;
    pr.active = true;
    pr.kind = kind;
    pr.x = x;
    pr.y = y;
    pr.vx = (dx / d) * speed;
    pr.vy = (dy / d) * speed;
    pr.r = kind === 'fireball' ? 7 : 5;
    pr.dmg = dmg;
    pr.life = range / speed;
    pr.pierce = pierce;
    pr.hit.length = 0;
    pr.blast = blast;
    pr.flight = 0;
  }

  /** 알 던지기·별똥별: (tx, ty)에 flight초 뒤 떨어져 blast 반경으로 폭발. 날아가는 동안은 아무것도 맞히지 않는다 */
  lobEgg(x: number, y: number, tx: number, ty: number, flight: number, dmg: number, blast: number, kind: 'egg' | 'meteor') {
    const pr = this.projectiles.get();
    if (!pr) return;
    pr.active = true;
    pr.kind = kind;
    pr.x = x;
    pr.y = y;
    pr.vx = (tx - x) / flight;
    pr.vy = (ty - y) / flight;
    pr.r = 5;
    pr.dmg = dmg;
    pr.life = pr.flight = flight;
    pr.pierce = 0;
    pr.hit.length = 0;
    pr.blast = blast;
  }

  /** 폭발 그림 + 반경 피해 */
  explode(x: number, y: number, r: number, dmg: number, sprite: string) {
    this.addSprite(sprite, x, y, r, 0.35);
    this.addShake(2.5);
    this.blast(x, y, r, dmg, 120);
  }

  /** 반경 안 모든 적에게 피해 + 바깥으로 knock만큼 밀기. 맞은 적을 돌려준다 */
  blast(x: number, y: number, r: number, dmg: number, knock: number): Enemy[] {
    const hit: Enemy[] = [];
    for (const e of [...this.queryEnemies(x, y, r)]) {
      const dx = e.x - x;
      const dy = e.y - y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > r + e.r) continue;
      hit.push(e);
      this.damageEnemy(e, dmg, (dx / d) * knock, (dy / d) * knock);
    }
    return hit;
  }

  addShake(v: number) {
    this.shake = Math.min(MAX_SHAKE, Math.max(this.shake, v));
  }

  addZone(
    x: number, y: number, vx: number, vy: number, r: number, life: number, dmg: number, sprite: string,
    pull = 0, blast = 0, blastR = 0,
  ) {
    const z = this.zones.get();
    if (!z) return;
    z.active = true;
    z.x = x;
    z.y = y;
    z.vx = vx;
    z.vy = vy;
    z.r = r;
    z.life = z.maxLife = life;
    z.dmg = dmg;
    z.sprite = sprite;
    z.nextHit.clear();
    z.pull = pull;
    z.blast = blast;
    z.blastR = blastR;
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
    if (!fx) return null;
    fx.active = true;
    fx.sprite = '';
    fx.follow = false;
    fx.kind = kind;
    fx.x = x;
    fx.y = y;
    fx.x2 = x2;
    fx.y2 = y2;
    fx.r = r;
    fx.life = fx.maxLife = life;
    fx.color = color;
    return fx;
  }

  /** src/assets/fx 그림 이펙트. r = 그림 반지름(px). follow면 플레이어 기준 위치로 따라다닌다 */
  addSprite(name: string, x: number, y: number, r: number, life: number, follow = false) {
    const fx = this.addEffect('sprite', x, y, r, life, '#fff');
    if (!fx) return;
    fx.sprite = name;
    fx.follow = follow;
    if (follow) {
      fx.x2 = x - this.player.x;
      fx.y2 = y - this.player.y;
    }
  }

  update(dt: number) {
    this.time += dt;
    const p = this.player;

    if (!p.dead) {
      const mv = this.controller.getMove(this);
      const len = Math.hypot(mv.x, mv.y);
      p.moving = len > 0.01;
      p.moveK = p.moving ? Math.min(1, len) : 0;
      // 출발은 느리게, 계속 움직이면 목표 속도까지 가속 (멈추거나 덜 밀면 바로 줄어든다)
      const target = p.speed * p.moveK;
      if (!p.moving) p.curSpeed = 0;
      else if (p.curSpeed < target * START_SPEED) p.curSpeed = target * START_SPEED;
      else if (p.curSpeed > target) p.curSpeed = target;
      else p.curSpeed += (target - p.curSpeed) * (1 - Math.exp(-ACCEL * dt));
      if (p.moving) {
        p.x += (mv.x / len) * p.curSpeed * dt;
        p.y += (mv.y / len) * p.curSpeed * dt;
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
    this.shake = Math.max(0, this.shake - 30 * dt);

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
    this.updateZones(dt);
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
      else if (fx.follow) {
        fx.x = p.x + fx.x2;
        fx.y = p.y + fx.y2;
      }
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
        const slow = e.slowT > 0 ? 0.5 : 1;
        e.x += (dx / d) * e.speed * slow * dt;
        e.y += (dy / d) * e.speed * slow * dt;
      }
      e.slowT -= dt;

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
        e.x += e.dashX * 420 * dt;
        e.y += e.dashY * 420 * dt;
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
      for (let i = 0; i < n; i++) this.fireBullet(e.x, e.y, off + (i / n) * Math.PI * 2, 150, e.dmg * 0.6);
      this.addEffect('ring', e.x, e.y, e.r * 1.8, 0.3, '#ff7aa8');
    }
    if (e.t2 >= (enraged ? 5 : 7)) {
      e.t2 = 0;
      e.dashT = 1.1;
      e.dashX = nx;
      e.dashY = ny;
      this.addEffect('telegraph', e.x, e.y, e.r, 0.6, '#ff4d6d', e.x + nx * 230, e.y + ny * 230);
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
        if (pr.kind === 'egg') this.explode(pr.x, pr.y, pr.blast, pr.dmg, 'star-burst');
        else if (pr.kind === 'meteor') this.explode(pr.x, pr.y, pr.blast, pr.dmg, 'fire-burst');
        continue;
      }
      if (pr.kind === 'egg' || pr.kind === 'meteor') continue;
      for (const e of this.queryEnemies(pr.x, pr.y, pr.r)) {
        if (pr.hit.includes(e.id)) continue;
        if ((e.x - pr.x) ** 2 + (e.y - pr.y) ** 2 > (e.r + pr.r) ** 2) continue;
        if (pr.blast > 0) {
          pr.active = false;
          this.explode(pr.x, pr.y, pr.blast, pr.dmg, 'fire-burst');
          break;
        }
        pr.hit.push(e.id);
        const sp = Math.hypot(pr.vx, pr.vy) || 1;
        this.damageEnemy(e, pr.dmg, (pr.vx / sp) * 130, (pr.vy / sp) * 130);
        if (pr.pierce-- <= 0) {
          pr.active = false;
          break;
        }
      }
    }
  }

  private updateZones(dt: number) {
    for (const z of this.zones.items) {
      if (!z.active) continue;
      z.x += z.vx * dt;
      z.y += z.vy * dt;
      z.life -= dt;
      if (z.life <= 0) {
        z.active = false;
        if (z.blast > 0) this.explode(z.x, z.y, z.blastR, z.blast, 'purple-burst');
        continue;
      }
      if (z.pull > 0) {
        for (const e of this.queryEnemies(z.x, z.y, z.r * 3)) {
          if (e.kind === 'boss') continue;
          const dx = z.x - e.x;
          const dy = z.y - e.y;
          const d = Math.hypot(dx, dy);
          if (d < 4 || d > z.r * 3) continue;
          const step = Math.min(d, z.pull * dt);
          e.x += (dx / d) * step;
          e.y += (dy / d) * step;
        }
      }
      for (const e of [...this.queryEnemies(z.x, z.y, z.r)]) {
        if ((e.x - z.x) ** 2 + (e.y - z.y) ** 2 > (e.r + z.r) ** 2) continue;
        if ((z.nextHit.get(e.id) ?? 0) > this.time) continue;
        z.nextHit.set(e.id, this.time + 0.35);
        const sp = Math.hypot(z.vx, z.vy) || 1;
        this.damageEnemy(e, z.dmg, (z.vx / sp) * 80, (z.vy / sp) * 80);
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
