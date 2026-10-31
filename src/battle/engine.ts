import { sfx } from '../audio/sfx';
import { fmt } from '../core/format';

// 방치 모드와 액션 모드가 같이 쓰는 전투 엔진.
// 엔진은 "누가 조종하는지"(Controller)와 "적을 어떻게 내보내는지"(모드)를 모른다.

export type EnemyKind = 'normal' | 'fast' | 'tank' | 'boss';
/**
 * 움직임: chase = 지그재그로 흔들리며 쫓기 / lead = 가는 방향을 앞질러 막기 /
 * charge = 정한 방향으로 곧장 돌진하고 사라짐 (dashX·dashY 방향, t1초 뒤) /
 * flee = 플레이어에게서 도망치다 t1초 뒤 사라짐 (황금 몹)
 */
export type EnemyMove = 'chase' | 'lead' | 'charge' | 'flee';

/** 그릴 때 쓰는 외형(src/assets/monsters). 행동(kind)과 따로 둔다. */
/** firstaid = 구급상자 몹 (그림 없이 코드로 그린다. 잡으면 체력 회복템) */
export type EnemySkin = 'slime' | 'mushroom' | 'sprout' | 'bat' | 'angel' | 'golem' | 'snail' | 'rabbit' | 'devil' | 'firstaid';
/** 몹 그림: 이름, 또는 이름@색상 (색 바꾼 몹) */
export type EnemyLook = EnemySkin | `${EnemySkin}@${number}`;

export interface Enemy {
  id: number;
  active: boolean;
  kind: EnemyKind;
  skin: EnemyLook;
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
  move: EnemyMove;
  /** 지그재그 위상 (몹마다 다르게) */
  phase: number;
  /** 황금 몹: 도망치고, 잡으면 골드 폭죽 */
  golden: boolean;
  /** 레이드 보스: 경고 장판·나선 탄막·돌진·소환을 돌아가며 쓴다 */
  raid: boolean;
  /** 레이드 보스 패턴 목록과 졸개 그림 */
  pats: number[];
  minion: EnemyLook;
  /** 레이드 보스가 몇 번째 패턴인지 */
  step: number;
  /** 웨이브 몹 색 (돌진·포위·벽) */
  tint: EnemyTint;
  /** 정예·마왕 (화면 밖에 있으면 빨간 화살표로 알려 준다) */
  elite: boolean;
  /** 디버프 남은 시간: 기절(멈춤) / 공포(도망) / 혼란(갈팡질팡) / 취약(받는 피해 ×1.5) / 표식(치명타 확정) */
  stunT: number;
  fearT: number;
  confuseT: number;
  weakT: number;
  markT: number;
  /** 지속 피해 (화상·독·동상): 남은 시간, 초당 피해, 다음 틱까지, 쓰러지면 옆으로 옮는지 */
  dotT: number;
  dotDps: number;
  dotTick: number;
  dotSpread: boolean;
  /** 저주: 걸린 채 쓰러지면 이 피해로 폭발 */
  curseT: number;
  curseDmg: number;
  /** 보스 패턴용 타이머 */
  t1: number;
  t2: number;
  dashT: number;
  dashX: number;
  dashY: number;
}

/**
 * 날아가는 것의 그림. feather·fireball은 방향대로 돌려 그리고, egg·meteor는 던지는(떨어지는) 것,
 * 그 밖의 이름은 이펙트 그림(fx) 이름이고 빙글빙글 돌며 날아간다
 */
export type ProjectileKind = string;
/** 레이드·웨이브 몹 색: 돌진(빨강) / 포위(보라) / 벽(남색) */
export type EnemyTint = '' | 'charge' | 'ring' | 'wall';

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
  /** 0보다 크면 가까운 적 쪽으로 이 속도(라디안/초)로 꺾는다 (유도) */
  home: number;
  /** 부메랑: 플레이어 쪽으로 계속 끌려와 되돌아온다 (돌아오는 길에 한 번 더 맞힌다) */
  back: boolean;
  turned: boolean;
  /** 그림 크기 배율 */
  scale: number;
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
  /** 0보다 크면 장판 안의 적을 이 시간(초)만큼 느리게 */
  slow: number;
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
  /** 보물 상자로 빨려 오는 중 (아주 빠르게) */
  vacuum: boolean;
}

/** 보물 상자: 주우면 맵 전체 보석을 한 번에 끌어온다 */
export interface Chest {
  active: boolean;
  x: number;
  y: number;
  /** 0 나무 / 1 은 / 2 금 */
  grade: 0 | 1 | 2;
  /** 나타난 뒤 지난 시간 (통통 튀는 연출) */
  t: number;
  /** 플레이어 쪽으로 끌려오는 중 */
  pulled: boolean;
}

/** 버프 스킬 효과: 분노(피해) / 신속(스킬 쿨) / 질주(이동) / 가시(부딪힌 적에게 피해) / 재생 / 행운(치명타) / 자석 / 무적 */
export type BuffId = 'rage' | 'haste' | 'sprint' | 'thorns' | 'regen' | 'luck' | 'magnet' | 'invuln';
export const BUFF_IDS: BuffId[] = ['rage', 'haste', 'sprint', 'thorns', 'regen', 'luck', 'magnet', 'invuln'];

/** 체력 회복템 (구급상자 몹이 떨군다). 상자처럼 멀리서도 끌려온다 */
export interface HealItem {
  active: boolean;
  x: number;
  y: number;
  t: number;
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

/** 작은 파편 (맞을 때 불꽃, 쓰러질 때 조각, 보석 반짝임, 투사체 꼬리) */
export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  /** 아래로 끌리는 힘 (px/초²). 0이면 둥둥 */
  grav: number;
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

/** 따라다니는 동료 (몬스터 그림). 공격·포자·회복은 여기서, 나머지 효과는 능력치에 이미 들어 있다 */
export interface Pet {
  skin: string;
  ability: string;
  /** 능력 값 (공격 배율·회복 비율 등) */
  value: number;
  /** 이 화면의 공격력 */
  power: number;
  x: number;
  y: number;
  /** 다음 능력까지 남은 시간 */
  t: number;
  /** 몇 번째 동료 (따라오는 자리) */
  idx: number;
}

/** 경고 장판: 바닥에 빨간 원이 차오르다가 터진다. 안에 있으면 아프다 */
export interface Hazard {
  x: number;
  y: number;
  r: number;
  t: number;
  maxT: number;
  dmg: number;
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
  /** 쿨다운을 바로 채운다 (피버 시작) */
  resetCooldown?(): void;
}

export class Pool<T extends { active: boolean }> {
  readonly items: T[] = [];
  /** 다음에 빈칸을 찾기 시작할 자리 (매번 처음부터 훑지 않게) */
  private cursor = 0;
  constructor(
    private readonly make: () => T,
    private readonly max: number,
  ) {}

  get(): T | null {
    const n = this.items.length;
    for (let k = 0; k < n; k++) {
      const i = (this.cursor + k) % n;
      if (!this.items[i].active) {
        this.cursor = (i + 1) % n;
        return this.items[i];
      }
    }
    if (n >= this.max) return null;
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
/** 치명타 기본 확률·배율 (숫자가 크게 주황색으로) */
export const CRIT_CHANCE = 0.15;
const CRIT_MUL = 2;
/** 몬스터 외형별 쓰러질 때 튀는 조각 색 */
const BURST_COLOR: Record<EnemySkin, string[]> = {
  slime: ['#8bd34b', '#c8f07a', '#5aa62e'],
  mushroom: ['#e8743b', '#ffd0a8', '#b84a22'],
  sprout: ['#c9a46a', '#7cc35a', '#f2d69a'],
  bat: ['#7b4fb3', '#b48be0', '#4a2a78'],
  angel: ['#9fd8ff', '#ffffff', '#5aa8e6'],
  golem: ['#8a7a6a', '#b8a896', '#5e5246'],
  snail: ['#e0b37a', '#8a5a32', '#f6dcb0'],
  rabbit: ['#f2d6c0', '#ffffff', '#c9a48a'],
  devil: ['#8a3fc8', '#c47aff', '#ff5a8a'],
  firstaid: ['#ffffff', '#ff4d5e', '#f2f2f2'],
};
/** 체력 회복템: 회복 비율(최대 체력 대비) */
const HEAL_ITEM = 0.35;
/** 출발 속도(목표 속도 대비)와 가속 세기. 0.45 → 0.8까지 약 0.4초 */
const START_SPEED = 0.85;
const ACCEL = 6;
/** 화면 흔들림 최대(px) */
const MAX_SHAKE = 7;
/** 황금 몹이 도망치기 시작하는 거리(px) */
const GOLDEN_FLEE_DIST = 170;
/** 상자를 끌어오는 거리(px). 보석 자석보다 훨씬 넓다 */
const CHEST_MAGNET = 240;

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
  /** 피버 남은 시간(초). 0보다 크면 화면이 금빛으로 들뜬다 */
  fever = 0;
  /** 치명타 확률 (장신구로 오른다) */
  critChance = CRIT_CHANCE;
  /** 바닥 색 (지역마다 다르다): 바탕 / 큰 얼룩 둘 / 작은 자갈 둘 */
  ground: readonly string[] = ['#7f5a3a', 'rgba(98,68,42,0.2)', 'rgba(150,112,74,0.15)', 'rgba(60,40,24,0.45)', 'rgba(186,150,108,0.45)'];
  time = 0;
  /** 화면 흔들림 세기(px). 폭발·피격 때 올라가고 금방 줄어든다 */
  shake = 0;

  readonly player: Player = {
    x: 0, y: 0, r: 12, hp: 100, maxHp: 100, speed: 120, regen: 0, magnet: 60,
    faceX: 1, faceY: 0, invuln: 0, flash: 0, dead: false, moving: false, moveK: 0, curSpeed: 0,
  };

  readonly enemies = new Pool<Enemy>(() => ({
    id: 0, active: false, kind: 'normal', skin: 'slime', x: 0, y: 0, r: 10, hp: 1, maxHp: 1, speed: 40, dmg: 1,
    gold: 0, xp: 0, flash: 0, kx: 0, ky: 0, slowT: 0, move: 'chase', phase: 0, golden: false, raid: false, pats: [], minion: 'bat', step: 0, tint: '', elite: false,
    stunT: 0, fearT: 0, confuseT: 0, weakT: 0, markT: 0, dotT: 0, dotDps: 0, dotTick: 0, dotSpread: false, curseT: 0, curseDmg: 0,
    t1: 0, t2: 0, dashT: 0, dashX: 0, dashY: 0,
  }), 500);
  readonly projectiles = new Pool<Projectile>(() => ({
    active: false, kind: 'feather', x: 0, y: 0, vx: 0, vy: 0, r: 4, dmg: 1, life: 1, pierce: 0, hit: [], blast: 0, flight: 0,
    home: 0, back: false, turned: false, scale: 1,
  }), 500);
  readonly zones = new Pool<Zone>(() => ({
    active: false, x: 0, y: 0, vx: 0, vy: 0, r: 20, dmg: 1, life: 0, maxLife: 1, sprite: '', nextHit: new Map(),
    pull: 0, blast: 0, blastR: 0, slow: 0,
  }), 60);
  readonly bullets = new Pool<EnemyBullet>(() => ({
    active: false, x: 0, y: 0, vx: 0, vy: 0, r: 5, dmg: 1, life: 1,
  }), 300);
  readonly gems = new Pool<Gem>(() => ({ active: false, x: 0, y: 0, value: 1, pulled: false, vacuum: false }), 900);
  readonly heals = new Pool<HealItem>(() => ({ active: false, x: 0, y: 0, t: 0, pulled: false }), 10);
  readonly chests = new Pool<Chest>(() => ({ active: false, x: 0, y: 0, grade: 0, t: 0, pulled: false }), 12);
  readonly texts = new Pool<FloatText>(() => ({
    active: false, x: 0, y: 0, text: '', life: 0, maxLife: 1, color: '#fff', size: 12,
  }), 70);
  readonly effects = new Pool<Effect>(() => ({
    active: false, kind: 'ring', x: 0, y: 0, x2: 0, y2: 0, r: 0, life: 0, maxLife: 1, color: '#fff', sprite: '', follow: false,
  }), 500);

  readonly particles = new Pool<Particle>(() => ({
    active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff', grav: 0,
  }), 360);
  readonly orbs: Orb[] = [];
  pets: Pet[] = [];
  /** 버프: 남은 시간 t, 값 v */
  readonly buffs = Object.fromEntries(BUFF_IDS.map((id) => [id, { t: 0, v: 0 }])) as Record<BuffId, { t: number; v: number }>;
  /** 보호막: 남은 흡수량 / 남은 시간 */
  shieldHp = 0;
  shieldT = 0;
  readonly hazards: Hazard[] = [];
  /** 몸에 보이는 장비 id (모자 / 등 / 옆에 둥둥 뜨는 무기). 없으면 '' */
  look = { hat: '', back: '', hand: '' };
  /** 꾸미기: 병아리 색 / 스킬 이펙트 색 (그리는 쪽이 읽는다) */
  chickSkin = 'basic';
  fxSkin = 'basic';
  weapons: Weapon[] = [];
  controller: Controller = { getMove: () => ({ x: 0, y: 0 }) };

  onKill: ((e: Enemy) => void) | null = null;
  onGem: ((value: number) => void) | null = null;
  onChest: ((x: number, y: number, grade: 0 | 1 | 2) => void) | null = null;
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
    this.chests.clear();
    this.heals.clear();
    this.texts.clear();
    this.effects.clear();
    this.particles.clear();
    this.orbs.length = 0;
    this.hazards.length = 0;
    for (const id of BUFF_IDS) this.buffs[id].t = 0;
    this.shieldHp = 0;
    this.shieldT = 0;
    this.dashT = 0;
    this.weapons = [];
    this.time = 0;
    this.shake = 0;
    this.fever = 0;
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
      skin: DEFAULT_SKIN[init.kind], r: 10, speed: 40, dmg: 1, gold: 0, xp: 1, slowT: 0, move: 'chase',
      phase: Math.random() * Math.PI * 2, golden: false, raid: false, pats: [], minion: 'bat', step: 0, tint: '', elite: false, stunT: 0, fearT: 0, confuseT: 0, weakT: 0, markT: 0, dotT: 0, dotDps: 0, dotTick: 0, dotSpread: false, curseT: 0, curseDmg: 0,
      t1: 0, t2: 0, dashT: 0, dashX: 0, dashY: 0,
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

  /** 돌진 남은 시간과 속도 */
  private dashT = 0;
  private dashVX = 0;
  private dashVY = 0;

  /** 돌진 (버프형 '돌진'): 바라보는 쪽으로 dist만큼 순식간에, 지나간 길의 적에게 피해 + 밀치기, 그동안 무적 */
  dashPlayer(dist: number, dmg: number, color: string) {
    const p = this.player;
    const dx = p.faceX;
    const dy = p.faceY;
    const ex = p.x + dx * dist;
    const ey = p.y + dy * dist;
    this.lineHit(p.x, p.y, ex, ey, 22, dmg, 160);
    this.addEffect('bolt', p.x, p.y - 8, 0, 0.3, color, ex, ey - 8);
    this.burst(p.x, p.y - 8, 10, [color, '#ffffff'], 140, 0.4, 0, 2.5);
    const T = 0.16;
    this.dashT = T;
    this.dashVX = (dx * dist) / T;
    this.dashVY = (dy * dist) / T;
    p.invuln = Math.max(p.invuln, T + 0.15);
  }

  /** 주변 적을 바깥으로 밀쳐 낸다 (함성 등) */
  pushAway(x: number, y: number, r: number, force: number) {
    for (const e of this.nearestEnemies(x, y, 200, r)) {
      if (e.kind === 'boss') continue;
      const d = Math.hypot(e.x - x, e.y - y) || 1;
      e.kx += ((e.x - x) / d) * force;
      e.ky += ((e.y - y) / d) * force;
    }
  }

  /** 버프 걸기 (더 긴 시간 / 더 큰 값으로) */
  buff(id: BuffId, t: number, v: number) {
    const b = this.buffs[id];
    b.v = Math.max(b.t > 0 ? b.v : 0, v);
    b.t = Math.max(b.t, t);
  }

  buffOn(id: BuffId) {
    return this.buffs[id].t > 0 ? this.buffs[id].v : 0;
  }

  /** 스킬 쿨다운이 줄어드는 속도 (신속 버프) */
  get skillHaste() {
    return 1 + this.buffOn('haste');
  }

  /** 보호막 (이만큼 피해를 먼저 흡수) */
  addShield(amount: number, t: number) {
    this.shieldHp = Math.max(this.shieldHp, amount);
    this.shieldT = Math.max(this.shieldT, t);
  }

  /** 지속 피해 걸기 (더 센 쪽으로) */
  addDot(e: Enemy, dps: number, t: number, spread = false) {
    if (dps >= e.dotDps || e.dotT <= 0) e.dotDps = dps;
    e.dotT = Math.max(e.dotT, t);
    e.dotSpread = e.dotSpread || spread;
  }

  damageEnemy(e: Enemy, dmg: number, kx = 0, ky = 0) {
    if (!e.active) return;
    // 분노 버프, 취약 디버프
    dmg *= 1 + this.buffOn('rage');
    if (e.weakT > 0) dmg *= 1.5;
    const crit = e.markT > 0 || Math.random() < this.critChance + this.buffOn('luck');
    if (crit) dmg *= CRIT_MUL;
    e.hp -= dmg;
    e.flash = 0.1;
    if (e.kind !== 'boss') {
      e.kx += kx * (crit ? 1.6 : 1);
      e.ky += ky * (crit ? 1.6 : 1);
    }
    if (crit) sfx.crit();
    else sfx.hit();
    // 맞은 자리에 작은 불꽃
    this.burst(e.x, e.y - e.r * 0.4, crit ? 5 : 2, crit ? ['#ffb347', '#fff3a0'] : ['#fff3a0', '#ffffff'], 120, 0.22, 0);
    if (this.showDamageText) {
      const x = e.x + (Math.random() - 0.5) * 8;
      if (crit) this.addText(x, e.y - e.r - 8, fmt(dmg) + '!', '#ff8a3c', 17);
      else this.addText(x, e.y - e.r - 4, fmt(dmg), '#ffe066', 12);
    }
    if (e.hp <= 0) this.killEnemy(e);
  }

  /** 파편 n개를 사방으로 튀긴다 */
  burst(x: number, y: number, n: number, colors: string[], speed: number, life: number, grav: number, size = 2.5) {
    for (let i = 0; i < n; i++) {
      const pt = this.particles.get();
      if (!pt) return;
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      pt.active = true;
      pt.x = x;
      pt.y = y;
      pt.vx = Math.cos(a) * v;
      pt.vy = Math.sin(a) * v - grav * 0.25;
      pt.life = pt.maxLife = life * (0.7 + Math.random() * 0.6);
      pt.size = size * (0.7 + Math.random() * 0.6);
      pt.color = colors[i % colors.length];
      pt.grav = grav;
    }
  }

  private killEnemy(e: Enemy) {
    e.active = false;
    if (e.curseT > 0) {
      // 저주: 보라색으로 터져 옆 몹까지
      this.addSprite('purple-burst', e.x, e.y - 6, 40, 0.35);
      this.blast(e.x, e.y, 50, e.curseDmg, 80);
    }
    if (e.dotT > 0 && e.dotSpread) {
      // 맹독: 쓰러지면 가까운 몹 둘에게 옮는다
      for (const o of this.nearestEnemies(e.x, e.y, 3, 90)) if (o !== e) this.addDot(o, e.dotDps, 3, true);
    }
    const fx = this.addEffect('corpse', e.x, e.y + e.r, e.r, 0.6, '#fff');
    if (fx) fx.sprite = e.skin;
    this.addSprite('dust', e.x, e.y + e.r * 0.4, e.r * 1.3, 0.35);
    this.addSprite('sparkle', e.x, e.y - e.r * 0.3, e.r * 0.9, 0.2);
    // 몸 색 조각이 튀어 오른다
    this.burst(e.x, e.y - e.r * 0.3, e.kind === 'boss' ? 30 : e.kind === 'tank' ? 10 : 7, BURST_COLOR[e.skin.split('@')[0] as EnemySkin], e.kind === 'boss' ? 260 : 170, 0.5, 420, e.kind === 'boss' ? 4 : 3);
    this.addShake(e.kind === 'boss' ? MAX_SHAKE : 0.8);
    if (e.golden) this.burst(e.x, e.y - e.r, 26, ['#ffe066', '#ffd23f', '#fff6c8'], 300, 0.8, 380, 3.5);
    if (this.dropGems && e.xp > 0) {
      const g = this.gems.get();
      if (g) {
        g.active = true;
        g.x = e.x;
        g.y = e.y;
        g.value = e.xp;
        g.pulled = false;
        g.vacuum = false;
      }
    }
    this.onKill?.(e);
  }

  damagePlayer(dmg: number) {
    const p = this.player;
    if (p.dead || p.invuln > 0 || dmg <= 0 || this.buffOn('invuln') > 0) return;
    // 보호막이 먼저 막는다
    if (this.shieldHp > 0) {
      const absorbed = Math.min(this.shieldHp, dmg);
      this.shieldHp -= absorbed;
      dmg -= absorbed;
      this.addEffect('ring', p.x, p.y, 26, 0.25, '#9fe4ff');
      if (dmg <= 0) {
        p.invuln = 0.3;
        return;
      }
    }
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
    kind: ProjectileKind = 'feather', blast = 0, opts: { home?: number; back?: boolean; scale?: number; r?: number } = {},
  ) {
    const pr = this.projectiles.get();
    if (!pr) return;
    pr.home = opts.home ?? 0;
    pr.back = opts.back ?? false;
    pr.turned = false;
    pr.scale = opts.scale ?? 1;
    const dx = tx - x;
    const dy = ty - y;
    const d = Math.hypot(dx, dy) || 1;
    pr.active = true;
    pr.kind = kind;
    pr.x = x;
    pr.y = y;
    pr.vx = (dx / d) * speed;
    pr.vy = (dy / d) * speed;
    pr.r = opts.r ?? (kind === 'fireball' ? 7 : 5);
    pr.dmg = dmg;
    pr.life = range / speed;
    pr.pierce = pierce;
    pr.hit.length = 0;
    pr.blast = blast;
    pr.flight = 0;
  }

  /**
   * 던지기: (tx, ty)에 flight초 뒤 떨어져 blast 반경으로 폭발. 날아가는 동안은 아무것도 맞히지 않는다.
   * egg = 알, meteor = 하늘에서 떨어지는 불덩이, 그 밖엔 이펙트 그림이 포물선으로
   */
  lobEgg(x: number, y: number, tx: number, ty: number, flight: number, dmg: number, blast: number, kind: ProjectileKind, scale = 1) {
    const pr = this.projectiles.get();
    if (!pr) return;
    pr.home = 0;
    pr.back = false;
    pr.turned = false;
    pr.scale = scale;
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
    sfx.boom();
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

  spawnChest(x: number, y: number, grade: 0 | 1 | 2 = 0) {
    const c = this.chests.get();
    if (!c) return;
    c.active = true;
    c.x = x;
    c.y = y;
    c.grade = grade;
    c.t = 0;
    c.pulled = false;
  }

  spawnHeal(x: number, y: number) {
    const it = this.heals.get();
    if (!it) return;
    it.active = true;
    it.x = x;
    it.y = y;
    it.t = 0;
    it.pulled = false;
  }

  private updateHeals(dt: number) {
    const p = this.player;
    for (const it of this.heals.items) {
      if (!it.active) continue;
      it.t += dt;
      if (p.dead) continue;
      const dx = p.x - it.x;
      const dy = p.y - it.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < Math.max(CHEST_MAGNET, p.magnet * 3)) it.pulled = true;
      if (it.pulled) {
        const sp = 280 + d * 2;
        it.x += (dx / d) * Math.min(d, sp * dt);
        it.y += (dy / d) * Math.min(d, sp * dt);
      }
      if (d > p.r + 14) continue;
      it.active = false;
      const v = p.maxHp * HEAL_ITEM;
      p.hp = Math.min(p.maxHp, p.hp + v);
      this.addText(p.x, p.y - 34, `+${Math.ceil(v)}`, '#6fdc8c', 18);
      this.addSprite('heal-circle', p.x, p.y + 4, 34, 0.7, true);
      this.burst(p.x, p.y - 10, 12, ['#7cf2a0', '#ffffff', '#ff6b7a'], 160, 0.5, 0, 3);
      sfx.levelUp();
    }
  }

  /** 맵에 떨어진 보석을 전부 끌어온다 */
  vacuumGems() {
    const p = this.player;
    for (const g of this.gems.items) {
      if (!g.active) continue;
      g.pulled = true;
      g.vacuum = true;
    }
    this.addEffect('ring', p.x, p.y, 220, 0.6, '#ffe066');
    this.addSprite('gold-sparkle', p.x, p.y - 10, 70, 0.6, true);
    this.addShake(6);
  }

  addShake(v: number) {
    this.shake = Math.min(MAX_SHAKE, Math.max(this.shake, v));
  }

  addZone(
    x: number, y: number, vx: number, vy: number, r: number, life: number, dmg: number, sprite: string,
    pull = 0, blast = 0, blastR = 0, slow = 0,
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
    z.slow = slow;
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

  /** 동료: 병아리 뒤를 둥실둥실 따라오며 능력을 쓴다 */
  private updatePet(pet: Pet, dt: number) {
    const p = this.player;
    // 병아리 뒤쪽에 부채꼴로 나란히
    const back = Math.atan2(-p.faceY, -p.faceX) + (pet.idx === 0 ? 0 : pet.idx === 1 ? 0.9 : -0.9);
    const tx = p.x + Math.cos(back) * 28;
    const ty = p.y + Math.sin(back) * 20 - 10;
    const k = 1 - Math.exp(-5 * dt);
    pet.x += (tx - pet.x) * k;
    pet.y += (ty - pet.y) * k;
    if (p.dead) return;
    pet.t -= dt;
    if (pet.t > 0) return;
    if (pet.ability === 'attack') {
      const e = this.nearestEnemies(pet.x, pet.y, 1, 170)[0];
      pet.t = 0.45;
      if (!e) return;
      this.addEffect('bolt', pet.x, pet.y, 0, 0.15, '#c78bff', e.x, e.y);
      this.damageEnemy(e, pet.power * pet.value);
    } else if (pet.ability === 'spore') {
      pet.t = 3;
      if (this.nearestEnemies(pet.x, pet.y, 1, 90).length === 0) {
        pet.t = 0.5;
        return;
      }
      this.blast(pet.x, pet.y, 85, pet.power * pet.value, 60);
      this.addEffect('burst', pet.x, pet.y, 85, 0.4, '#9be36a');
      this.burst(pet.x, pet.y, 14, ['#9be36a', '#d8ff9a', '#6fbf4a'], 140, 0.6, 0);
    } else if (pet.ability === 'heal') {
      pet.t = 5;
      if (p.hp >= p.maxHp) return;
      const v = p.maxHp * pet.value;
      p.hp = Math.min(p.maxHp, p.hp + v);
      this.addText(p.x, p.y - 30, `+${Math.ceil(v)}`, '#6fdc8c', 14);
      this.addEffect('ring', p.x, p.y, 34, 0.4, '#a8ffb8');
    } else if (pet.ability === 'frost') {
      pet.t = 4;
      const hit = this.nearestEnemies(pet.x, pet.y, 40, 110);
      if (hit.length === 0) {
        pet.t = 0.5;
        return;
      }
      for (const e of hit) {
        e.slowT = Math.max(e.slowT, 2);
        this.damageEnemy(e, pet.power * pet.value);
      }
      this.addEffect('ring', pet.x, pet.y, 110, 0.45, '#bfe8ff');
      this.burst(pet.x, pet.y, 12, ['#bfe8ff', '#ffffff'], 150, 0.5, 0);
    } else if (pet.ability === 'bolt') {
      pet.t = 2.5;
      const hit = this.nearestEnemies(pet.x, pet.y, 3, 220);
      if (hit.length === 0) {
        pet.t = 0.5;
        return;
      }
      let fx = pet.x;
      let fy = pet.y;
      for (const e of hit) {
        this.addEffect('bolt', fx, fy, 0, 0.18, '#fff27a', e.x, e.y);
        this.damageEnemy(e, pet.power * pet.value);
        fx = e.x;
        fy = e.y;
      }
    } else if (pet.ability === 'shield') {
      pet.t = 10;
      this.addShield(p.maxHp * pet.value, 4);
      this.addEffect('ring', p.x, p.y, 36, 0.4, '#9fe4ff');
    } else if (pet.ability === 'bomb') {
      pet.t = 3;
      const e = this.nearestEnemies(pet.x, pet.y, 6, 240);
      if (e.length === 0) {
        pet.t = 0.5;
        return;
      }
      const t = e[Math.floor(Math.random() * e.length)];
      this.lobEgg(pet.x, pet.y, t.x, t.y, 0.55, pet.power * pet.value, 70, 'egg', 1.1);
    } else {
      pet.t = 999;
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
      const target = p.speed * p.moveK * (1 + this.buffOn('sprint'));
      if (!p.moving) p.curSpeed = 0;
      else if (p.curSpeed < target * START_SPEED) p.curSpeed = target * START_SPEED;
      else if (p.curSpeed > target) p.curSpeed = target;
      else p.curSpeed += (target - p.curSpeed) * (1 - Math.exp(-ACCEL * dt));
      if (this.dashT > 0) {
        // 돌진 중: 정해진 방향으로 쭉 (조종은 잠깐 무시)
        this.dashT -= dt;
        p.x += this.dashVX * dt;
        p.y += this.dashVY * dt;
      } else if (p.moving) {
        p.x += (mv.x / len) * p.curSpeed * dt;
        p.y += (mv.y / len) * p.curSpeed * dt;
        p.faceX = mv.x / len;
        p.faceY = mv.y / len;
      }
      if (this.bounds) {
        p.x = Math.max(p.r, Math.min(this.bounds.w - p.r, p.x));
        p.y = Math.max(p.r, Math.min(this.bounds.h - p.r, p.y));
      }
      p.hp = Math.min(p.maxHp, p.hp + (p.regen + this.buffOn('regen')) * p.maxHp * dt);
    }
    p.invuln -= dt;
    p.flash -= dt;
    for (const id of BUFF_IDS) this.buffs[id].t -= dt;
    this.shieldT -= dt;
    if (this.shieldT <= 0) this.shieldHp = 0;
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
    for (const pet of this.pets) this.updatePet(pet, dt);
    this.updateHazards(dt);

    this.updateProjectiles(dt);
    this.updateZones(dt);
    this.updateBullets(dt);
    this.updateGems(dt);
    this.updateChests(dt);
    this.updateHeals(dt);

    for (const pt of this.particles.items) {
      if (!pt.active) continue;
      pt.life -= dt;
      if (pt.life <= 0) {
        pt.active = false;
        continue;
      }
      pt.vy += pt.grav * dt;
      pt.vx *= 1 - 2 * dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
    }

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

      const slow = e.slowT > 0 ? 0.5 : 1;
      // 디버프 시간 줄이기 + 지속 피해
      e.weakT -= dt;
      e.markT -= dt;
      e.curseT -= dt;
      if (e.dotT > 0) {
        e.dotT -= dt;
        e.dotTick -= dt;
        if (e.dotTick <= 0) {
          e.dotTick = 0.5;
          this.damageEnemy(e, e.dotDps * 0.5);
          if (!e.active) continue;
        }
      }
      // 보스는 기절·공포·혼란에 안 걸린다
      const stunned = e.kind !== 'boss' && e.stunT > 0;
      const feared = e.kind !== 'boss' && e.fearT > 0;
      const confused = e.kind !== 'boss' && e.confuseT > 0;
      e.stunT -= dt;
      e.fearT -= dt;
      e.confuseT -= dt;
      if (stunned) {
        // 기절: 제자리 (밀려나는 것만)
      } else if (feared || confused) {
        // 공포: 플레이어 반대쪽으로 / 혼란: 이리저리
        const a = feared ? Math.atan2(-dy, -dx) : e.phase + this.time * 3;
        e.x += Math.cos(a) * e.speed * slow * (feared ? 1.1 : 0.7) * dt;
        e.y += Math.sin(a) * e.speed * slow * (feared ? 1.1 : 0.7) * dt;
      } else if (e.kind === 'boss') {
        this.updateBoss(e, dx / d, dy / d, dt);
      } else if (e.move === 'charge') {
        // 돌진: 플레이어와 상관없이 곧장 지나가고 시간이 다 되면 사라진다
        e.x += e.dashX * e.speed * slow * dt;
        e.y += e.dashY * e.speed * slow * dt;
        e.t1 -= dt;
        if (e.t1 <= 0) {
          e.active = false;
          continue;
        }
      } else if (e.move === 'flee') {
        // 황금 몹: 가까이 오면 도망치고, 멀면 느릿느릿 어슬렁거린다. 시간이 지나면 사라진다
        if (d < GOLDEN_FLEE_DIST) {
          const wob = Math.sin(this.time * 4 + e.phase) * 0.8;
          const ux = -dx / d - (dy / d) * wob;
          const uy = -dy / d + (dx / d) * wob;
          const ul = Math.hypot(ux, uy) || 1;
          e.x += (ux / ul) * e.speed * slow * dt;
          e.y += (uy / ul) * e.speed * slow * dt;
        } else {
          const a = e.phase + this.time * 0.6;
          e.x += Math.cos(a) * e.speed * 0.3 * dt;
          e.y += Math.sin(a) * e.speed * 0.3 * dt;
        }
        if (Math.random() < 0.3) this.trail(e.x, e.y - e.r, ['#ffe066', '#fff6c8'], 0.4, 2.5);
        e.t1 -= dt;
        if (e.t1 <= 0) {
          e.active = false;
          continue;
        }
      } else if (!p.dead) {
        let tx = dx;
        let ty = dy;
        if (e.move === 'lead') {
          // 플레이어가 가는 쪽을 앞질러 막는다 (멀수록 더 앞을 노린다)
          const ahead = Math.min(1.4, d / Math.max(1, e.speed));
          const sp = p.moving ? p.curSpeed : 0;
          tx += p.faceX * sp * ahead;
          ty += p.faceY * sp * ahead;
        }
        const td = Math.hypot(tx, ty) || 1;
        // 옆으로 살짝 흔들리며 다가온다 (가까우면 곧장)
        const weave = d > 60 ? Math.sin(this.time * 3 + e.phase) * 0.45 : 0;
        const ux = tx / td - (ty / td) * weave;
        const uy = ty / td + (tx / td) * weave;
        const ul = Math.hypot(ux, uy) || 1;
        e.x += (ux / ul) * e.speed * slow * dt;
        e.y += (uy / ul) * e.speed * slow * dt;
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

      if (!p.dead && d < e.r + p.r) {
        if (!stunned) this.damagePlayer(e.dmg);
        // 가시 갑옷: 부딪힌 몹에게 되돌려 준다
        const thorns = this.buffOn('thorns');
        if (thorns > 0 && (e.flash <= 0 || e.kind === 'boss')) this.damageEnemy(e, thorns, (-dx / d) * 200, (-dy / d) * 200);
      }
    }
  }

  private updateHazards(dt: number) {
    const p = this.player;
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const hz = this.hazards[i];
      hz.t -= dt;
      if (hz.t > 0) continue;
      this.hazards.splice(i, 1);
      this.addEffect('burst', hz.x, hz.y, hz.r, 0.35, '#ff4d6d');
      this.burst(hz.x, hz.y, 10, ['#ff4d6d', '#ffb347', '#3a1d0b'], 200, 0.5, 0, 3);
      this.addShake(2);
      if (!p.dead && Math.hypot(p.x - hz.x, p.y - hz.y) < hz.r + p.r * 0.5) this.damagePlayer(hz.dmg);
    }
  }

  addHazard(x: number, y: number, r: number, t: number, dmg: number) {
    this.hazards.push({ x, y, r, t, maxT: t, dmg });
  }

  /**
   * 레이드 보스: 패턴을 돌아가며 쓴다. 체력 절반 아래(2페이즈)면 더 빠르고 더 많이.
   * 장판(바닥 경고 원) → 나선 탄막 → 돌진 → 졸개 소환
   */
  private updateRaidBoss(e: Enemy, nx: number, ny: number, dt: number) {
    const p = this.player;
    const enraged = e.hp < e.maxHp * 0.5;
    if (e.dashT > 0) {
      e.dashT -= dt;
      if (e.dashT < 0.55) {
        e.x += e.dashX * (enraged ? 560 : 460) * dt;
        e.y += e.dashY * (enraged ? 560 : 460) * dt;
      }
      return;
    }
    // 나선 탄막: 제자리에서 빙글빙글 쏜다
    if (e.t2 > 0) {
      e.t2 -= dt;
      e.phase += dt;
      const gap = enraged ? 0.06 : 0.09;
      while (e.phase >= gap) {
        e.phase -= gap;
        const arms = enraged ? 3 : 2;
        const base = this.time * (enraged ? 3.4 : 2.6);
        for (let k = 0; k < arms; k++) this.fireBullet(e.x, e.y, base + (k / arms) * Math.PI * 2, 170, e.dmg * 0.45);
      }
      return;
    }
    if (!p.dead) {
      e.x += nx * e.speed * dt;
      e.y += ny * e.speed * dt;
    }
    e.t1 -= dt;
    if (e.t1 > 0) return;
    e.t1 = enraged ? 2.1 : 3;
    // 장판 → 탄막 → 돌진 → 소환 순서로 (2페이즈에선 무작위)
    const pats = e.pats.length ? e.pats : [0, 1, 2, 3];
    const pattern = enraged ? pats[Math.floor(Math.random() * pats.length)] : pats[e.step++ % pats.length];
    if (pattern === 0) {
      // 장판: 플레이어 발밑 하나 + 주변 여러 개
      const n = enraged ? 7 : 4;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = i === 0 ? 0 : 50 + Math.random() * 120;
        this.addHazard(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 58, enraged ? 1.0 : 1.3, e.dmg * 1.8);
      }
    } else if (pattern === 1) {
      e.t2 = enraged ? 2.6 : 2;
      e.phase = 0;
      this.addEffect('ring', e.x, e.y, e.r * 2.2, 0.4, '#c78bff');
    } else if (pattern === 2) {
      e.dashT = enraged ? 1.0 : 1.2;
      e.dashX = nx;
      e.dashY = ny;
      this.addEffect('telegraph', e.x, e.y, e.r, 0.65, '#ff4d6d', e.x + nx * 300, e.y + ny * 300);
    } else if (pattern === 4) {
      // 사방 탄막: 두 겹으로 퍼진다
      const n = enraged ? 20 : 14;
      const off = Math.random() * Math.PI;
      for (let i = 0; i < n; i++) {
        this.fireBullet(e.x, e.y, off + (i / n) * Math.PI * 2, 150, e.dmg * 0.5);
        this.fireBullet(e.x, e.y, off + ((i + 0.5) / n) * Math.PI * 2, 105, e.dmg * 0.5);
      }
      this.addEffect('ring', e.x, e.y, e.r * 1.8, 0.3, '#ff7aa8');
    } else {
      // 졸개 소환: 보스 둘레에 졸개 떼
      const n = enraged ? 12 : 8;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        this.spawnEnemy({
          kind: 'fast', skin: e.minion, x: e.x + Math.cos(a) * 60, y: e.y + Math.sin(a) * 60,
          hp: e.maxHp * 0.002, r: 10, speed: 120, dmg: e.dmg * 0.25, xp: 1, move: 'lead',
        });
      }
      this.addEffect('ring', e.x, e.y, 90, 0.4, '#9a6ad8');
    }
  }

  private updateBoss(e: Enemy, nx: number, ny: number, dt: number) {
    if (e.raid) return this.updateRaidBoss(e, nx, ny, dt);
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
      if (pr.home > 0) this.steerHoming(pr, dt);
      if (pr.back) {
        // 부메랑: 플레이어 쪽으로 끌려온다. 돌아서면 맞은 목록을 비워 한 번 더 맞힌다
        const p = this.player;
        const dx = p.x - pr.x;
        const dy = p.y - pr.y;
        const d = Math.hypot(dx, dy) || 1;
        pr.vx += (dx / d) * 900 * dt;
        pr.vy += (dy / d) * 900 * dt;
        // 막 던졌을 땐(발밑) 돌아섰다고 보지 않는다: 아래로 던지면 바로 사라지던 문제
        if (!pr.turned && d > 30 && pr.vx * dx + pr.vy * dy > 0) {
          pr.turned = true;
          pr.hit.length = 0;
        }
        if (pr.turned && d < 18) pr.active = false;
      }
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      // 꼬리: 화염구는 불씨, 깃털은 빛 가루
      if (pr.kind === 'fireball' && Math.random() < 0.8) this.trail(pr.x, pr.y, ['#ff7a2a', '#ffd166'], 0.3, 3);
      else if (pr.kind === 'feather' && Math.random() < 0.35) this.trail(pr.x, pr.y, ['#fff3a0'], 0.2, 2);
      pr.life -= dt;
      if (pr.life <= 0) {
        pr.active = false;
        if (pr.flight > 0) this.explode(pr.x, pr.y, pr.blast, pr.dmg, pr.kind === 'meteor' ? 'fire-burst' : 'star-burst');
        continue;
      }
      if (pr.flight > 0) continue;
      for (const e of this.queryEnemies(pr.x, pr.y, pr.r)) {
        if (pr.hit.includes(e.id)) continue;
        if ((e.x - pr.x) ** 2 + (e.y - pr.y) ** 2 > (e.r + pr.r) ** 2) continue;
        if (pr.blast > 0) {
          pr.active = false;
          this.explode(pr.x, pr.y, pr.blast, pr.dmg, pr.kind === 'fireball' ? 'fire-burst' : 'purple-burst');
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

  /** 유도: 가까운 적 쪽으로 조금씩 꺾는다 */
  private steerHoming(pr: Projectile, dt: number) {
    const t = this.nearestEnemies(pr.x, pr.y, 1, 260)[0];
    if (!t) return;
    const sp = Math.hypot(pr.vx, pr.vy) || 1;
    const cur = Math.atan2(pr.vy, pr.vx);
    let diff = Math.atan2(t.y - pr.y, t.x - pr.x) - cur;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const a = cur + Math.max(-pr.home * dt, Math.min(pr.home * dt, diff));
    pr.vx = Math.cos(a) * sp;
    pr.vy = Math.sin(a) * sp;
  }

  /** 선분 (x1,y1)→(x2,y2)에서 width 안의 모든 적에게 피해 (레이저·십자) */
  lineHit(x1: number, y1: number, x2: number, y2: number, width: number, dmg: number, knock = 0): Enemy[] {
    const hit: Enemy[] = [];
    const lx = x2 - x1;
    const ly = y2 - y1;
    const len2 = lx * lx + ly * ly || 1;
    const len = Math.sqrt(len2);
    for (const e of this.enemies.items) {
      if (!e.active) continue;
      const t = Math.max(0, Math.min(1, ((e.x - x1) * lx + (e.y - y1) * ly) / len2));
      const dx = e.x - (x1 + lx * t);
      const dy = e.y - (y1 + ly * t);
      if (dx * dx + dy * dy > (width + e.r) ** 2) continue;
      hit.push(e);
    }
    for (const e of hit) this.damageEnemy(e, dmg, (lx / len) * knock, (ly / len) * knock);
    return hit;
  }

  private trail(x: number, y: number, colors: string[], life: number, size: number) {
    const pt = this.particles.get();
    if (!pt) return;
    pt.active = true;
    pt.x = x + (Math.random() - 0.5) * 4;
    pt.y = y + (Math.random() - 0.5) * 4;
    pt.vx = (Math.random() - 0.5) * 20;
    pt.vy = -10 - Math.random() * 15;
    pt.life = pt.maxLife = life;
    pt.size = size;
    pt.color = colors[Math.floor(Math.random() * colors.length)];
    pt.grav = 0;
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
        if (z.slow > 0) e.slowT = Math.max(e.slowT, z.slow);
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
      const magnet = p.magnet * (1 + this.buffOn('magnet'));
      if (!p.dead && d < magnet) g.pulled = true;
      if (g.pulled) {
        const sp = g.vacuum ? 900 + d * 1.5 : 260 + (magnet - Math.min(d, magnet)) * 4;
        g.x += (dx / d) * sp * dt;
        g.y += (dy / d) * sp * dt;
        if (d < p.r + 4) {
          g.active = false;
          this.burst(g.x, g.y, 2, g.value >= 3 ? ['#7cf2a0', '#ffffff'] : ['#7ad7ff', '#ffffff'], 60, 0.25, 0, 2);
          sfx.gem();
          this.onGem?.(g.value);
        }
      }
    }
  }

  private updateChests(dt: number) {
    const p = this.player;
    for (const c of this.chests.items) {
      if (!c.active) continue;
      c.t += dt;
      if (p.dead) continue;
      // 상자는 보석보다 훨씬 멀리서 끌려온다 (웬만하면 안 놓치게)
      const dx = p.x - c.x;
      const dy = p.y - c.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < Math.max(CHEST_MAGNET, p.magnet * 3)) c.pulled = true;
      if (c.pulled) {
        const sp = 280 + d * 2;
        c.x += (dx / d) * Math.min(d, sp * dt);
        c.y += (dy / d) * Math.min(d, sp * dt);
      }
      if ((c.x - p.x) ** 2 + (c.y - p.y) ** 2 > (p.r + 18) ** 2) continue;
      c.active = false;
      this.addSprite('star-burst', c.x, c.y - 10, 40, 0.4);
      this.burst(c.x, c.y - 10, 16, ['#ffe066', '#ffffff', '#c8823a'], 220, 0.6, 300, 3);
      sfx.chest();
      this.onChest?.(c.x, c.y, c.grade);
    }
  }
}
