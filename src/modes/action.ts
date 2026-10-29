import type { Enemy, EnemyKind, Weapon } from '../battle/engine';
import type { WeaponStats } from '../battle/weapons';
import { actionRatio, enemyGold, isBossStage, playerStats, stageClearGold, type ActionRatio } from '../data/balance';
import { SKILLS, SKILL_BY_ID, SKILL_MAX_LEVEL, type SkillDef } from '../data/skills';
import type { Game } from '../game';

// 액션 모드 고정 수치. 방치 수치는 ActionRatio(배율)로만 들어온다.
// 일반 스테이지: 90초 버티면 정예 몬스터 / 보스 스테이지(10단위): 180초 버티면 마왕 보스
const NORMAL_SECONDS = 90;
const BOSS_STAGE_SECONDS = 180;
const BASE_POWER = 10;
const BASE_HP = 100;
const BASE_SPEED = 110;
const BASE_MAGNET = 55;
const MAX_ALIVE = 170;
const ELITE_HP = 900;
const BOSS_HP = 2600;

export interface LevelUpCard {
  skill: SkillDef;
  /** 고른 뒤의 레벨 (1이면 새로 얻음) */
  nextLevel: number;
}

export interface RunResult {
  win: boolean;
  time: number;
  kills: number;
  level: number;
  gold: number;
  stage: number;
}

export type RunState = 'playing' | 'levelup' | 'paused' | 'ended';

export class ActionMode {
  state: RunState = 'ended';
  stage = 1;
  /** 이번 판에서 보스가 나오기까지 버텨야 하는 시간 */
  duration = NORMAL_SECONDS;
  ratio: ActionRatio = { atk: 1, hp: 1 };
  time = 0;
  level = 1;
  xp = 0;
  kills = 0;
  bossSpawned = false;

  private readonly stats: WeaponStats = { power: BASE_POWER, aps: 1 };
  private readonly owned = new Map<string, number>();
  private readonly weapons = new Map<string, Weapon>();
  private pendingLevelUps = 0;
  private spawnAcc = 0;
  private swarms: number[] = [];
  private baseHp = BASE_HP;
  private endT = -1;

  constructor(private readonly game: Game) {}

  get xpNext() {
    return 5 + (this.level - 1) * 4;
  }

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
    eng.controller = this.game.joystick;
    eng.onKill = (e) => this.onKill(e);
    eng.onGem = (v) => this.onGem(v);
    eng.onPlayerDead = () => {
      this.endT = 0.9;
    };

    this.stage = stage;
    this.duration = isBossStage(stage) ? BOSS_STAGE_SECONDS : NORMAL_SECONDS;
    this.ratio = actionRatio(playerStats(this.game.save.levels), stage);
    this.stats.power = BASE_POWER * this.ratio.atk;
    this.baseHp = BASE_HP * this.ratio.hp;

    const p = eng.player;
    p.x = 0;
    p.y = 0;
    p.regen = 0;
    p.maxHp = p.hp = this.baseHp;
    p.speed = BASE_SPEED;
    p.magnet = BASE_MAGNET;

    this.time = 0;
    this.level = 1;
    this.xp = 0;
    this.kills = 0;
    this.bossSpawned = false;
    this.pendingLevelUps = 0;
    this.spawnAcc = 0;
    // 몰려오기 이벤트: 일반 스테이지는 후반 한 번, 보스 스테이지는 두 번
    this.swarms = this.isBossStage ? [60, 120] : [(this.duration * 2) / 3];
    this.endT = -1;
    this.owned.clear();
    this.weapons.clear();
    this.applySkill('dart');
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
    const peak = this.isBossStage ? 5.5 : 3.5;
    const rate = this.bossSpawned ? 1 : 1.2 + (this.time / this.duration) * peak;
    this.spawnAcc += rate * dt;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (eng.enemies.countActive() < MAX_ALIVE) this.spawnOne(this.pickKind());
    }

    if (this.swarms.length > 0 && this.time >= this.swarms[0]) {
      this.swarms.shift();
      this.spawnSwarm(20);
      this.game.ui.toast('몰려온다!');
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

  private spawnPos(angle = Math.random() * Math.PI * 2) {
    const p = this.game.engine.player;
    const d = this.diag / 2 + 30;
    return { x: p.x + Math.cos(angle) * d, y: p.y + Math.sin(angle) * d };
  }

  private spawnOne(kind: EnemyKind, angle?: number) {
    const eng = this.game.engine;
    const { x, y } = this.spawnPos(angle);
    const s = 1 + (this.time / 60) * 0.6;
    switch (kind) {
      case 'normal':
        eng.spawnEnemy({ kind, x, y, hp: 10 * s, r: 11, speed: 42, dmg: 5 * s, xp: 1 });
        break;
      case 'fast':
        eng.spawnEnemy({ kind, x, y, hp: 6 * s, r: 10, speed: 78, dmg: 4 * s, xp: 1 });
        break;
      case 'tank':
        eng.spawnEnemy({ kind, x, y, hp: 45 * s, r: 14, speed: 26, dmg: 10 * s, xp: 3 });
        break;
      case 'boss':
        break;
    }
  }

  private spawnSwarm(n: number) {
    const off = Math.random();
    for (let i = 0; i < n; i++) this.spawnOne('normal', ((i + off) / n) * Math.PI * 2);
  }

  private spawnBoss() {
    this.bossSpawned = true;
    const { x, y } = this.spawnPos();
    const eng = this.game.engine;
    if (this.isBossStage) {
      eng.spawnEnemy({ kind: 'boss', skin: 'demon', x, y, hp: BOSS_HP, r: 30, speed: 34, dmg: 22, xp: 0 });
      this.game.ui.toast('마왕 등장!');
    } else {
      eng.spawnEnemy({ kind: 'boss', skin: 'slime', x, y, hp: ELITE_HP, r: 22, speed: 38, dmg: 16, xp: 0 });
      this.game.ui.toast('정예 몬스터 등장!');
    }
  }

  /** 너무 멀어진 적은 플레이어 주변으로 다시 데려온다 (뱀서 방식) */
  private recycleFarEnemies() {
    const eng = this.game.engine;
    const p = eng.player;
    const limit = this.diag * 0.9;
    for (const e of eng.enemies.items) {
      if (!e.active || e.kind === 'boss') continue;
      if (Math.hypot(e.x - p.x, e.y - p.y) > limit) {
        const pos = this.spawnPos();
        e.x = pos.x;
        e.y = pos.y;
      }
    }
  }

  private onKill(e: Enemy) {
    this.kills++;
    if (e.kind === 'boss') this.finish(true);
  }

  private onGem(v: number) {
    this.xp += v;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.pendingLevelUps++;
    }
    if (this.pendingLevelUps > 0 && this.state === 'playing') this.openLevelUp();
  }

  private openLevelUp() {
    this.pendingLevelUps--;
    this.state = 'levelup';
    this.game.joystick.release();
    this.game.ui.showLevelUp(this.rollCards(), (card) => {
      if (card) this.applySkill(card.skill.id);
      else this.healPercent(0.3);
      if (this.pendingLevelUps > 0) this.openLevelUp();
      else this.state = 'playing';
    });
  }

  rollCards(): LevelUpCard[] {
    const pool = SKILLS.filter((s) => (this.owned.get(s.id) ?? 0) < SKILL_MAX_LEVEL);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 3).map((skill) => ({ skill, nextLevel: (this.owned.get(skill.id) ?? 0) + 1 }));
  }

  private applySkill(id: string) {
    const def = SKILL_BY_ID[id];
    const level = (this.owned.get(id) ?? 0) + 1;
    this.owned.set(id, level);
    const p = this.game.engine.player;

    if (def.createWeapon) {
      let w = this.weapons.get(id);
      if (!w) {
        w = def.createWeapon(this.stats);
        this.weapons.set(id, w);
        this.game.engine.weapons.push(w);
      }
      w.level = level;
      return;
    }
    switch (id) {
      case 'swift':
        p.speed = BASE_SPEED * (1 + 0.12 * level);
        break;
      case 'magnet':
        p.magnet = BASE_MAGNET * (1 + 0.35 * level);
        break;
      case 'tough': {
        const ratio = p.hp / p.maxHp;
        p.maxHp = this.baseHp * (1 + 0.2 * level);
        p.hp = ratio * p.maxHp;
        this.healPercent(0.3);
        break;
      }
    }
  }

  private healPercent(k: number) {
    const p = this.game.engine.player;
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * k);
  }

  ownedSkills(): [SkillDef, number][] {
    return [...this.owned].map(([id, lv]) => [SKILL_BY_ID[id], lv]);
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
    let gold: number;
    if (win) {
      gold = stageClearGold(this.stage);
      save.maxStage = Math.max(save.maxStage, this.stage);
      if (this.isBossStage) save.bossKills++;
    } else {
      // 실패해도 잡은 만큼은 조금 준다
      gold = this.kills * enemyGold(this.stage) * 0.1;
    }
    save.gold += gold;
    const result: RunResult = {
      win, time: this.time, kills: this.kills, level: this.level, gold, stage: this.stage,
    };
    this.game.ui.showResult(result, () => this.game.enterIdle());
  }
}
