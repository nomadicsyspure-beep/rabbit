import type { Enemy, EnemyKind, Weapon } from '../battle/engine';
import type { SkillTree, WeaponStats } from '../battle/weapons';
import { fmt } from '../core/format';
import {
  actionRatio, enemyGold, isBossStage, playerStats, stageClearGold, stageSkins, type ActionRatio,
} from '../data/balance';
import { SKILL_BY_ID, createSkill, type SkillDef } from '../data/skills';
import type { Game } from '../game';

// 액션 모드 고정 수치. 방치 수치는 ActionRatio(배율)로만 들어온다.
// 일반 스테이지: 90초 버티면 정예 몬스터 / 보스 스테이지(10단위): 180초 버티면 마왕 보스
const NORMAL_SECONDS = 90;
const BOSS_STAGE_SECONDS = 180;
const BASE_POWER = 10;
const BASE_HP = 150;
const BASE_SPEED = 165;
const BASE_MAGNET = 75;
const MAX_ALIVE = 320;
const ELITE_HP = 900;
const BOSS_HP = 2600;
/** 피버: 게이지(처치 수)가 차면 FEVER_SEC초 동안 장착 스킬 모든 가지 +FEVER_BONUS, 몹 생성 ×FEVER_SPAWN */
export const FEVER_NEED = 220;
export const FEVER_SEC = 8;
const FEVER_BONUS = 5;
const FEVER_SPAWN = 1.7;

/** 패턴 웨이브: 첫 웨이브까지 / 웨이브 간격(초) */
const WAVE_FIRST = 8;
const WAVE_GAP = 11;
type Wave = 'ring' | 'stampede' | 'wall';
const WAVES: Wave[] = ['ring', 'stampede', 'wall'];
/** 움직이는 중 새 몹이 가는 방향 앞쪽에서 나올 확률 */
const AHEAD_RATE = 0.7;
/** 이 각도 안에서 이 시간 넘게 한 방향으로 달리면 앞에 벽 (재사용 대기 WALL_CD초) */
const STRAIGHT_TOLERANCE = 0.5;
const STRAIGHT_SEC = 4;
const WALL_CD = 6;

/** 이 시간 안에 다음 처치가 없으면 콤보가 끊긴다 */
export const COMBO_SEC = 2;
/** 처치 1마리당 골드 = 그 스테이지 몹 골드 × 이 값 (이기든 지든) */
const KILL_GOLD = 0.3;
/** 보물 상자가 나오는 간격(초)과 상자 하나의 골드 (몹 골드 × 이 값) */
const CHEST_SEC = 12;
const CHEST_GOLD = 25;

export interface RunResult {
  win: boolean;
  time: number;
  kills: number;
  bestCombo: number;
  /** 이번 판에 모은 경험치와 오른 캐릭터 레벨 수 */
  xp: number;
  levelUps: number;
  gold: number;
  stage: number;
}

export type RunState = 'playing' | 'paused' | 'ended';

/** HUD에 보여 줄 장착 스킬 */
export interface EquippedSkill {
  def: SkillDef;
  weapon: Weapon;
  /** 이번 판에 쓰는 트리 사본 (피버 때 잠깐 올렸다 내린다. 저장값은 안 건드린다) */
  tree: SkillTree;
}

export class ActionMode {
  state: RunState = 'ended';
  stage = 1;
  /** 이번 판에서 보스가 나오기까지 버텨야 하는 시간 */
  duration = NORMAL_SECONDS;
  ratio: ActionRatio = { atk: 1, hp: 1 };
  time = 0;
  kills = 0;
  /** 연속 처치: 마지막 처치 후 COMBO_SEC 안에 또 잡으면 이어진다 */
  combo = 0;
  bestCombo = 0;
  lastKillAt = -1;
  bossSpawned = false;
  /** 이번 판에 모은 경험치 / 오른 레벨 수 (결과 화면용) */
  xpGained = 0;
  levelUps = 0;
  equipped: EquippedSkill[] = [];

  private readonly stats: WeaponStats = { power: BASE_POWER, aps: 1 };
  private spawnAcc = 0;
  /** 다음 패턴 웨이브까지 남은 시간 / 몇 번째 패턴인지 */
  private waveT = 0;
  private waveIdx = 0;
  /** 한 방향으로 계속 가고 있는 시간 / 그 방향 / 벽 재사용 대기 */
  private straightT = 0;
  private straightDir = 0;
  private wallCd = 0;
  private baseHp = BASE_HP;
  private endT = -1;
  private chestT = 0;
  /** 보물 상자로 번 골드 (결과에 더한다) */
  private bonusGold = 0;
  /** 피버 남은 시간 / 피버 게이지(처치 수) / 피버 중 처치 수 (골드 2배) */
  fever = 0;
  feverGauge = 0;
  private feverKills = 0;

  constructor(private readonly game: Game) {}

  get running() {
    return this.state === 'playing';
  }

  get isBossStage() {
    return isBossStage(this.stage);
  }

  enter(stage: number) {
    const eng = this.game.engine;
    eng.reset();
    eng.bounds = null;
    eng.followCamera = true;
    eng.dropGems = true;
    eng.showDamageText = true;
    eng.controller = this.game.pilot;
    this.game.applyControls();
    eng.onKill = (e) => this.onKill(e);
    eng.onGem = (v) => this.onGem(v);
    eng.onChest = (x, y) => this.onChest(x, y);
    eng.onPlayerDead = () => {
      this.endT = 0.9;
    };

    this.stage = stage;
    this.duration = isBossStage(stage) ? BOSS_STAGE_SECONDS : NORMAL_SECONDS;
    const save = this.game.save;
    const st = playerStats(save.levels, save.level);
    this.ratio = actionRatio(st, stage);
    this.stats.power = BASE_POWER * this.ratio.atk;
    this.baseHp = BASE_HP * this.ratio.hp;

    const p = eng.player;
    p.x = 0;
    p.y = 0;
    p.regen = 0;
    p.maxHp = p.hp = this.baseHp;
    p.speed = BASE_SPEED * st.spd;
    p.magnet = BASE_MAGNET;

    this.time = 0;
    this.kills = 0;
    this.feverKills = 0;
    this.fever = 0;
    this.feverGauge = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.lastKillAt = -1;
    this.xpGained = 0;
    this.levelUps = 0;
    this.bossSpawned = false;
    this.spawnAcc = 0;
    this.waveT = WAVE_FIRST;
    this.straightT = 0;
    this.wallCd = 0;
    this.waveIdx = Math.floor(Math.random() * WAVES.length);
    this.endT = -1;
    this.chestT = CHEST_SEC * 0.6;
    this.bonusGold = 0;

    // 장착한 스킬만 발동한다 (레벨은 성장 탭에서 올린 그대로)
    this.equipped = [];
    for (const id of save.equipped) {
      const def = SKILL_BY_ID[id];
      const tree = save.skills[id];
      if (!def || !tree) continue;
      const runTree = { ...tree };
      const weapon = createSkill(def, this.stats, runTree);
      eng.weapons.push(weapon);
      this.equipped.push({ def, weapon, tree: runTree });
    }
    this.state = 'playing';
  }

  update(dt: number) {
    if (this.state !== 'playing') return;
    const eng = this.game.engine;

    if (this.endT >= 0) {
      this.endT -= dt;
      if (this.endT < 0) this.finish(false);
      return;
    }

    this.time += dt;

    if (!this.bossSpawned && this.time >= this.duration) this.spawnBoss();

    // 초당 생성 수: 시간이 지날수록 늘어난다 (보스 스테이지가 더 빽빽하다)
    const peak = this.isBossStage ? 18 : 14;
    // 장착 스킬이 많을수록 더 많이 몰려온다 (쓸어 담을 게 끊기지 않게)
    const crowd = 1 + 0.2 * Math.max(0, this.equipped.length - 1);
    const rate = (this.bossSpawned ? 6 : 8 + (this.time / this.duration) * peak) * crowd * (this.fever > 0 ? FEVER_SPAWN : 1);

    if (this.fever > 0) {
      this.fever -= dt;
      eng.fever = Math.max(0, this.fever);
      if (this.fever <= 0) this.endFever();
    }
    this.spawnAcc += rate * dt;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (eng.enemies.countActive() < MAX_ALIVE) this.spawnOne(this.pickKind());
    }

    // 한 방향으로만 계속 달리면 앞에 벽이 생긴다
    const h = this.heading;
    this.wallCd -= dt;
    if (h === null) {
      this.straightT = 0;
    } else {
      let diff = Math.abs(h - this.straightDir) % (Math.PI * 2);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff > STRAIGHT_TOLERANCE) {
        this.straightDir = h;
        this.straightT = 0;
      }
      this.straightT += dt;
      if (this.straightT > STRAIGHT_SEC && this.wallCd <= 0 && !this.bossSpawned) {
        this.wallCd = WALL_CD;
        this.straightT = 0;
        this.spawnWave('wall');
      }
    }

    // 패턴 웨이브: 포위 / 돌진 / 앞을 막는 벽을 돌아가며
    this.waveT -= dt;
    if (this.waveT <= 0 && !this.bossSpawned) {
      this.waveT = this.isBossStage ? WAVE_GAP * 0.75 : WAVE_GAP;
      const wave = WAVES[this.waveIdx++ % WAVES.length];
      this.spawnWave(wave);
    }

    // 일정 시간마다 화면 안 가까운 곳에 보물 상자
    this.chestT -= dt;
    if (this.chestT <= 0) {
      this.chestT = CHEST_SEC;
      const a = Math.random() * Math.PI * 2;
      const d = 110 + Math.random() * 90;
      const p = eng.player;
      eng.spawnChest(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * 0.7);
      this.game.ui.toast('보물 상자 등장!');
    }

    this.recycleFarEnemies();
  }

  private get diag() {
    const eng = this.game.engine;
    return Math.hypot(eng.viewW, eng.viewH);
  }

  private pickKind(): EnemyKind {
    const k = this.time / this.duration;
    const r = Math.random();
    const tankW = k > 0.33 ? 0.15 + (k - 0.33) * 0.3 : 0;
    const fastW = k > 0.14 ? 0.25 : 0;
    if (r < tankW) return 'tank';
    if (r < tankW + fastW) return 'fast';
    return 'normal';
  }

  /** 플레이어가 가는 방향 (멈춰 있으면 null) */
  private get heading() {
    const p = this.game.engine.player;
    return p.moving && p.curSpeed > 40 ? Math.atan2(p.faceY, p.faceX) : null;
  }

  /**
   * 화면 밖 생성 위치. 각도를 안 주면 움직이는 중엔 절반 넘게 가는 방향 앞쪽(±70°)에서 나온다:
   * 한 방향으로만 달리면 계속 몹 떼에 부딪히게.
   */
  private spawnPos(angle?: number) {
    const p = this.game.engine.player;
    const h = this.heading;
    let a = angle;
    if (a === undefined) {
      a = h !== null && Math.random() < AHEAD_RATE ? h + (Math.random() - 0.5) * 2.4 : Math.random() * Math.PI * 2;
    }
    const d = this.diag / 2 + 30;
    return { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d };
  }

  private spawnOne(kind: EnemyKind, angle?: number) {
    const eng = this.game.engine;
    const { x, y } = this.spawnPos(angle);
    const s = 1 + (this.time / 60) * 0.6;
    const skins = stageSkins(this.stage);
    switch (kind) {
      case 'normal':
        eng.spawnEnemy({ kind, skin: skins.normal, x, y, hp: 5 * s, r: 11, speed: 62, dmg: 3 * s, xp: 1 });
        break;
      case 'fast':
        // 빠른 몹은 가는 길목을 앞질러 막는다
        eng.spawnEnemy({ kind, skin: skins.fast, x, y, hp: 4 * s, r: 10, speed: 115, dmg: 3 * s, xp: 1, move: 'lead' });
        break;
      case 'tank':
        eng.spawnEnemy({ kind, skin: skins.tank, x, y, hp: 24 * s, r: 14, speed: 40, dmg: 7 * s, xp: 3 });
        break;
      case 'boss':
        break;
    }
  }

  private spawnWave(wave: Wave) {
    const eng = this.game.engine;
    const p = eng.player;
    const s = 1 + (this.time / 60) * 0.6;
    const skins = stageSkins(this.stage);
    const crowd = 1 + Math.min(1, this.time / this.duration);
    const h = this.heading ?? Math.random() * Math.PI * 2;
    switch (wave) {
      case 'ring': {
        // 사방을 둘러싸고 조여 온다: 빈틈 한 군데로 빠져나가야 한다
        const n = Math.round(28 * crowd);
        const r = this.diag / 2 + 10;
        const gap = Math.random() * Math.PI * 2;
        for (let i = 0; i < n; i++) {
          const a = gap + 0.5 + (i / n) * (Math.PI * 2 - 1);
          eng.spawnEnemy({
            kind: 'normal', skin: skins.normal, x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r,
            hp: 5 * s, r: 11, speed: 70, dmg: 3 * s, xp: 1,
          });
        }
        this.game.ui.toast('포위당했다!');
        break;
      }
      case 'stampede': {
        // 옆에서 한 줄로 우르르 가로질러 돌진 (따라오지 않고 지나간다)
        const side = h + (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
        const dirX = -Math.cos(side);
        const dirY = -Math.sin(side);
        const startD = this.diag / 2 + 20;
        const n = Math.round(14 * crowd);
        for (let i = 0; i < n; i++) {
          const along = (i - (n - 1) / 2) * 26;
          // 줄을 가는 방향 쪽으로 조금 밀어서 앞길을 쓸고 지나가게
          const cx = p.x + Math.cos(side) * startD + Math.cos(h) * (along + 60);
          const cy = p.y + Math.sin(side) * startD + Math.sin(h) * (along + 60);
          eng.spawnEnemy({
            kind: 'fast', skin: skins.fast, x: cx, y: cy, hp: 4 * s, r: 10, speed: 230, dmg: 5 * s, xp: 1,
            move: 'charge', dashX: dirX, dashY: dirY, t1: (startD * 2 + 80) / 230,
          });
        }
        this.game.ui.toast('돌진!');
        break;
      }
      case 'wall': {
        // 가는 방향 앞에 단단한 몹으로 벽을 세운다
        const d = this.diag / 2 - 20;
        const n = Math.round(12 * crowd);
        const fx = Math.cos(h);
        const fy = Math.sin(h);
        for (let i = 0; i < n; i++) {
          const off = (i - (n - 1) / 2) * 30;
          const tank = i % 3 === 1;
          eng.spawnEnemy({
            kind: tank ? 'tank' : 'normal', skin: tank ? skins.tank : skins.normal,
            x: p.x + fx * d - fy * off, y: p.y + fy * d + fx * off,
            hp: (tank ? 24 : 5) * s, r: tank ? 14 : 11, speed: tank ? 40 : 62, dmg: (tank ? 7 : 3) * s, xp: tank ? 3 : 1,
          });
        }
        this.game.ui.toast('앞을 막는다!');
        break;
      }
    }
  }

  private spawnBoss() {
    this.bossSpawned = true;
    const { x, y } = this.spawnPos();
    const eng = this.game.engine;
    if (this.isBossStage) {
      eng.spawnEnemy({ kind: 'boss', skin: 'devil', x, y, hp: BOSS_HP, r: 30, speed: 50, dmg: 22, xp: 0 });
      this.game.ui.toast('마왕 등장!');
    } else {
      eng.spawnEnemy({ kind: 'boss', skin: 'rabbit', x, y, hp: ELITE_HP, r: 22, speed: 55, dmg: 16, xp: 0 });
      this.game.ui.toast('정예 몬스터 등장!');
    }
  }

  /** 너무 멀어진 적은 플레이어 앞쪽으로 다시 데려온다 (도망쳐도 앞에서 다시 만난다) */
  private recycleFarEnemies() {
    const eng = this.game.engine;
    const p = eng.player;
    const limit = this.diag * 0.9;
    for (const e of eng.enemies.items) {
      if (!e.active || e.kind === 'boss' || e.move === 'charge') continue;
      if (Math.hypot(e.x - p.x, e.y - p.y) > limit) {
        const pos = this.spawnPos();
        e.x = pos.x;
        e.y = pos.y;
      }
    }
  }

  private onKill(e: Enemy) {
    this.kills++;
    if (this.fever > 0) {
      this.feverKills++;
    } else if (++this.feverGauge >= FEVER_NEED) {
      this.startFever();
    }
    const now = this.game.engine.time;
    this.combo = now - this.lastKillAt <= COMBO_SEC ? this.combo + 1 : 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.lastKillAt = now;
    if (e.kind === 'boss') this.finish(true);
  }

  /** 피버: 장착 스킬의 모든 가지 +FEVER_BONUS, 쿨다운 즉시 충전, 몹 더 많이 */
  private startFever() {
    const eng = this.game.engine;
    this.fever = FEVER_SEC;
    eng.fever = FEVER_SEC;
    for (const s of this.equipped) {
      s.tree.dmg += FEVER_BONUS;
      s.tree.spd += FEVER_BONUS;
      s.tree.cnt += FEVER_BONUS;
      s.weapon.resetCooldown?.();
    }
    const p = eng.player;
    eng.addSprite('pillar', p.x, p.y - 30, 60, 0.9, true);
    eng.addEffect('ring', p.x, p.y, 260, 0.7, '#ffb347');
    eng.addShake(7);
    this.game.ui.feverStart();
  }

  private endFever() {
    this.fever = 0;
    this.feverGauge = 0;
    this.game.engine.fever = 0;
    for (const s of this.equipped) {
      s.tree.dmg -= FEVER_BONUS;
      s.tree.spd -= FEVER_BONUS;
      s.tree.cnt -= FEVER_BONUS;
    }
  }

  /** 보물 상자: 보석은 엔진이 다 끌어오고, 여기선 골드 보너스 */
  private onChest(x: number, y: number) {
    const gold = enemyGold(this.stage) * CHEST_GOLD;
    this.bonusGold += gold;
    this.game.engine.addText(x, y - 30, `+${fmt(gold)} G`, '#ffe066', 18);
    this.game.ui.toast('싹쓸이!');
  }

  /** 경험치 보석: 캐릭터 영구 경험치로 바로 쌓는다 */
  private onGem(v: number) {
    this.xpGained += v;
    const ups = this.game.addXp(v);
    if (ups > 0) {
      this.levelUps += ups;
      const p = this.game.engine.player;
      this.game.engine.addSprite('pillar', p.x, p.y - 20, 34, 0.8, true);
      this.game.ui.toast(`레벨 업! Lv ${this.game.save.level}`);
    }
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.game.joystick.release();
    this.game.ui.showPause(
      () => {
        this.state = 'playing';
      },
      () => this.finish(false),
    );
  }

  private finish(win: boolean) {
    if (this.state === 'ended') return;
    this.state = 'ended';
    this.game.joystick.release();
    const save = this.game.save;
    // 잡은 만큼 골드 + 이기면 클리어 보상
    // 피버 중 처치는 골드 2배
    let gold = (this.kills + this.feverKills) * enemyGold(this.stage) * KILL_GOLD + this.bonusGold;
    if (win) {
      gold += stageClearGold(this.stage);
      save.maxStage = Math.max(save.maxStage, this.stage);
      if (this.isBossStage) save.bossKills++;
    }
    save.gold += gold;
    const result: RunResult = {
      win, time: this.time, kills: this.kills, bestCombo: this.bestCombo, xp: this.xpGained, levelUps: this.levelUps, gold, stage: this.stage,
    };
    this.game.ui.showResult(result, () => this.game.enterIdle());
  }
}
