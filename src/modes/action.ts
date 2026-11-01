import { RAID_BOSSES, RAID_BY_ID, type RaidBossDef } from '../data/raids';
import { PLAY_PASS_XP, addDaily } from '../data/missions';
import { CRIT_CHANCE, type Enemy, type EnemyKind, type Engine, type Weapon } from '../battle/engine';
import type { SkillTree, WeaponStats } from '../battle/weapons';
import { sfx } from '../audio/sfx';
import { fmt } from '../core/format';
import {
  actionRatio, enemyGold, isBossStage, stageClearGold, type ActionRatio,
} from '../data/balance';
import { CHEST_COLORS, CHEST_NAMES, rollChest, type ChestGrade } from '../data/items';
import { regionOf, stageSkins, type MatId } from '../data/world';
import { BOOSTERS } from '../data/craft';
import { SKILL_BY_ID, createSkill, type SkillDef, type SkillId } from '../data/skills';
import type { Game } from '../game';

// 액션 모드 고정 수치. 방치 수치는 ActionRatio(배율)로만 들어온다.
// 스테이지는 30초: 시간이 다 되면 일반 스테이지는 정예 몬스터 / 보스 스테이지(10단위)는 마왕 보스. 중간에 중간 보스.
// 스테이지 1은 튜토리얼처럼 15초, 몹 아주 적고 보스도 약하다
const NORMAL_SECONDS = 30;
const BOSS_STAGE_SECONDS = 30;
const FIRST_STAGE_SECONDS = 15;
/** 중간 보스가 나오는 시각(초) */
const MID_BOSS_AT = [10, 20];
const BASE_POWER = 10;
const BASE_HP = 150;
const BASE_SPEED = 165;
const BASE_MAGNET = 75;
const MAX_ALIVE = 320;
const ELITE_HP = 1800;
/** 중간 보스 기본 체력 (일반 몹 배율 MOB_HP를 따로 곱한다) */
const MID_BOSS_HP = 520;
/** 초반 스테이지는 쉽게: 스테이지 1은 몹 체력·피해·숫자 EASY_START배, EASY_UNTIL 스테이지부터 원래대로 */
const EASY_START = 0.5;
const EASY_UNTIL = 12;
const BOSS_HP = 7000;
/** 일반 몹 난이도 배율 (체력 / 부딪힐 때 피해) */
const MOB_HP = 1.3;
const MOB_DMG = 1.5;
/** 몹 수·구성이 최대로 짙어지기까지 걸리는 시간(초) */
const RAMP_SEC = 30;
/** 피버: 게이지(처치 수, 콤보와 상관없이 쌓임)가 FEVER_NEED만큼 차면 FEVER_SEC초 동안 장착 스킬 모든 가지 +FEVER_BONUS, 몹 생성 ×FEVER_SPAWN, 이동 속도 ×FEVER_MOVE */
export const FEVER_NEED = 250;
export const FEVER_SEC = 10;
const FEVER_BONUS = 5;
const FEVER_SPAWN = 2.5;
const FEVER_MOVE = 1.7;

/** 패턴 웨이브: 첫 웨이브까지 / 웨이브 간격(초) */
const WAVE_FIRST = 5;
const WAVE_GAP = 8;
type Wave = 'ring' | 'stampede' | 'wall';
const WAVES: Wave[] = ['ring', 'stampede', 'wall'];
/** 움직이는 중 새 몹이 가는 방향 앞쪽에서 나올 확률 */
const AHEAD_RATE = 0.8;

/** 이 시간 안에 다음 처치가 없으면 콤보가 끊긴다 */
export const COMBO_SEC = 2;
/** 처치 1마리당 골드 = 그 스테이지 몹 골드 × 이 값 (이기든 지든) */
const KILL_GOLD = 0.3;
/** 재료 상자가 나오는 간격(초) */
const CHEST_SEC = 9;
/** 황금 몹: 나올 확률, 잡으면 골드 (몹 골드 × 이 값) + 다이아 + 금 상자 */
const GOLDEN_RATE = 0.003;
const GOLDEN_GOLD = 150;
const GOLDEN_DIAMONDS = 5;
/** 구급상자 몹: 나올 확률. 단단하고, 잡으면 체력 회복템 */
const FIRSTAID_RATE = 0.004;
/** 웨이브 몹(돌진·포위·벽)은 색이 다르고 더 아프다: 피하라는 신호 */
const CHARGE_DMG = 4;
const RING_DMG = 3.5;
const WALL_DMG = 1.5;
/** 몹 무리: 가끔 한꺼번에 몰려오는 무리 간격(초). 모양은 덩어리 · 부채꼴 줄 · 여러 방향 작은 무리 중 하나 */
const PACK_SEC = 4;
/** 중간 보스·스테이지 보스를 잡으면: 골드 (몹 골드 × 이 값), 다이아 */
const MIDBOSS_GOLD = 60;
const MIDBOSS_DIAMONDS = 2;
const STAGE_BOSS_GOLD = 150;
const STAGE_BOSS_DIAMONDS = 5;
/** 스테이지 보스를 잡고 결과 화면까지 기다리는 시간(초): 보상이 펑 터지는 걸 보게 */
const WIN_DELAY = 1.3;
/** 따로따로 하나씩 나오는 몹은 이만큼만 (나머지는 무리로) */
const TRICKLE = 0.55;
/** 몇 콤보마다 보석 싹쓸이 */
const VACUUM_COMBO = 100;

/** 판 종류: 스테이지 / 재료 던전 / 보스 레이드 / 무한 모드 */
export type RunKind = 'stage' | 'material' | 'raid' | 'infinite';
/** 재료 던전: 길이(초), 상자 간격(초) */
const MATERIAL_SECONDS = 45;
const MATERIAL_CHEST_SEC = 3;
/** 보스 레이드: 제한 시간(초), 보스 체력, 졸개 생성 배율(대폭 줄임) */
const RAID_SECONDS = 90;
const RAID_HP = 7000;
const RAID_SPAWN = 0.12;
/** 무한 모드: 이 시간마다 다음 지역으로, 정예 습격 간격 */
const INFINITE_REGION_SEC = 60;
const INFINITE_ELITE_SEC = 45;

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
  kind: RunKind;
  /** 레이드로 얻은 보스의 정수 */
  essence: number;
  /** 무한 모드 신기록인지 */
  best: boolean;
  /** 주운 상자 등급들 (가방에 들어갔다) */
  chests: ChestGrade[];
  /** 장착 스킬 숙련도 변화 */
  mastery: { id: SkillId; before: number; after: number; points: number }[];
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
  kind: RunKind = 'stage';
  /** 레이드에서 고른 보스 */
  raidBoss: RaidBossDef = RAID_BOSSES[0];
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
  private packT = 0;
  /** 0 이상이면 보스를 잡았다: 이 시간 뒤 결과 화면 */
  private winT = -1;
  /** 아직 안 나온 중간 보스 시각들 */
  private midBosses: number[] = [];
  private waveIdx = 0;
  private baseHp = BASE_HP;
  private endT = -1;
  private chestT = 0;
  /** 황금 몹으로 번 골드 (결과에 더한다) */
  private bonusGold = 0;
  /** 이번 판에 주운 상자 등급들 */
  private chests: ChestGrade[] = [];
  /** 유물 발동: 보호막·발자국 타이머 */
  private shieldT = 0;
  private trailT = 0;
  /** 부스터: 이번 판 골드·경험치 배율 */
  private goldMul = 1;
  private xpMul = 1;
  /** 장신구 효과: 콤보 유지 시간, 피버 게이지 배율, 좋은 상자 확률 */
  comboSec = COMBO_SEC;
  private feverMul = 1;
  private chestBonus = 0;
  /** 피버 남은 시간 / 피버 중 처치 수 (골드 2배) */
  fever = 0;
  /** 피버 게이지: 피버가 아닐 때 처치할 때마다 1씩 찬다 (콤보가 끊겨도 안 줄어든다) */
  feverGauge = 0;

  /** 피버 게이지 0~1 */
  get feverProgress() {
    return Math.min(1, this.feverGauge / FEVER_NEED);
  }
  private feverKills = 0;
  private fevers = 0;
  private goldenKills = 0;
  /** 몹 외형·바닥을 정하는 스테이지 (무한 모드는 시간이 지나면 다음 지역으로) */
  private skinStage = 1;
  private phase2 = false;
  private nextElite = 0;

  constructor(private readonly game: Game) {}

  get running() {
    return this.state === 'playing';
  }

  get isBossStage() {
    return this.kind === 'stage' && isBossStage(this.stage);
  }

  enter(stage: number, kind: RunKind = 'stage', raidId = 'devil') {
    this.raidBoss = RAID_BY_ID[raidId] ?? RAID_BOSSES[0];
    const eng = this.game.engine;
    eng.reset();
    eng.bounds = null;
    eng.followCamera = true;
    eng.dropGems = true;
    eng.showDamageText = true;
    eng.controller = this.game.pilot;
    this.game.applyControls();
    eng.onKill = (e) => this.onKill(e);
    eng.onHurt = (heavy) => sfx.hurt(heavy);
    eng.onGem = (v) => this.onGem(v);
    eng.onChest = (x, y, grade) => this.onChest(x, y, grade);
    eng.onPlayerDead = () => {
      this.endT = 0.9;
    };

    this.stage = stage;
    this.kind = kind;
    this.skinStage = stage;
    this.phase2 = false;
    this.nextElite = INFINITE_ELITE_SEC;
    this.duration = kind === 'material' ? MATERIAL_SECONDS : kind === 'raid' ? RAID_SECONDS : kind === 'infinite' ? Infinity
      : stage === 1 ? FIRST_STAGE_SECONDS : isBossStage(stage) ? BOSS_STAGE_SECONDS : NORMAL_SECONDS;
    const save = this.game.save;
    const st = this.game.stats;
    const bonus = this.game.bonus;
    this.ratio = actionRatio(st, stage);
    this.stats.power = BASE_POWER * this.ratio.atk;
    this.baseHp = BASE_HP * this.ratio.hp;

    const p = eng.player;
    p.x = 0;
    p.y = 0;
    p.regen = 0;
    p.maxHp = p.hp = this.baseHp;
    p.speed = BASE_SPEED * st.spd * (1 + bonus.speed);
    p.magnet = BASE_MAGNET * bonus.magnet;
    // 장신구 효과
    this.comboSec = COMBO_SEC + bonus.combo;
    this.feverMul = bonus.fever;
    this.chestBonus = bonus.chest;
    eng.critChance = CRIT_CHANCE + bonus.crit;
    // 유물·세트 발동 효과
    eng.procs = this.game.procs;
    eng.procPower = this.stats.power;
    this.shieldT = 1;
    this.trailT = 0;
    this.game.applyPet(this.stats.power);

    this.time = 0;
    this.kills = 0;
    this.feverKills = 0;
    this.fevers = 0;
    this.goldenKills = 0;
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
    this.packT = 1.5;
    this.winT = -1;
    this.midBosses = kind === 'stage' && stage > 1 ? [...MID_BOSS_AT] : [];
    this.waveIdx = Math.floor(Math.random() * WAVES.length);
    this.endT = -1;
    this.chestT = kind === 'material' ? 1 : kind === 'raid' ? Infinity : CHEST_SEC * 0.6;
    this.bonusGold = 0;
    this.chests = [];

    // 지역 바닥
    const region = regionOf(stage);
    eng.ground = region.ground;
    const intro = {
      stage: region.name,
      material: `재료 던전 · ${region.name}: 상자가 쏟아져요!`,
      raid: `보스 레이드: ${this.raidBoss.name}! 빨간 장판을 피해라!`,
      infinite: '무한 모드: 얼마나 버틸 수 있을까?',
    };
    this.game.ui.toast(intro[kind]);

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
    // 유물이 주는 공짜 스킬 (장착 칸을 안 쓴다, 유물 강화 단계만큼 세다)
    for (const fr of bonus.skills) {
      const plus = fr.plus;
      const tree = { dmg: plus, spd: Math.floor(plus / 3), cnt: Math.floor(plus / 5) };
      eng.weapons.push(createSkill(SKILL_BY_ID[fr.skill], this.stats, tree));
    }
    if (kind === 'raid') this.spawnRaidBoss();
    this.state = 'playing';
    // 제작한 부스터: 스테이지에서 하나씩 자동으로
    this.goldMul = 1;
    this.xpMul = 1;
    if (kind === 'stage') {
      const used = this.game.takeBoosters();
      if (used.includes('gold2')) this.goldMul = 2;
      if (used.includes('xp2')) this.xpMul = 2;
      if (used.includes('feverStart')) this.startFever();
      if (used.length) this.game.ui.toast(`부스터 사용: ${used.map((b) => `${BOOSTERS[b].icon} ${BOOSTERS[b].name}`).join(' · ')}`);
    }
  }

  /** 레이드 보스: 처음부터 나와 있다 (체력 절반에서 2페이즈) */
  private spawnRaidBoss() {
    this.bossSpawned = true;
    const p = this.game.engine.player;
    const b = this.raidBoss;
    this.game.engine.spawnEnemy({
      kind: 'boss', skin: b.skin, raid: true, elite: true, x: p.x, y: p.y - 230, hp: RAID_HP * b.hpMul, r: b.r, speed: b.speed,
      dmg: 24 * b.dmgMul, xp: 0, t1: 2, pats: b.pats, minion: b.minion,
    });
  }

  update(dt: number) {
    if (this.state !== 'playing') return;
    const eng = this.game.engine;

    if (this.endT >= 0) {
      this.endT -= dt;
      if (this.endT < 0) this.finish(false);
      return;
    }
    if (this.winT >= 0) {
      this.winT -= dt;
      if (this.winT < 0) this.finish(true);
      return;
    }

    this.time += dt;

    if (this.kind === 'stage') {
      if (!this.bossSpawned && this.time >= this.duration) this.spawnBoss();
    } else if (this.kind === 'material') {
      if (this.time >= this.duration) return this.finish(true);
    } else if (this.kind === 'raid') {
      if (this.time >= this.duration) return this.finish(false);
      this.checkPhase2();
    } else {
      this.updateInfinite();
    }

    // 초당 생성 수: 시간이 지날수록 늘어난다 (보스 스테이지가 더 빽빽하다)
    const peak = this.isBossStage ? 18 : 14;
    // 장착 스킬이 많을수록 더 많이 몰려온다 (쓸어 담을 게 끊기지 않게)
    const crowd = 1 + 0.2 * Math.max(0, this.equipped.length - 1);
    const kindRate = this.kind === 'raid' ? RAID_SPAWN : this.kind === 'infinite' ? 1 + this.time / 120 : 1;
    const rate = (this.bossSpawned ? 6 : 8 + this.ramp * peak) * crowd * kindRate * (this.fever > 0 ? FEVER_SPAWN : 1) * (0.5 + 0.5 * this.ease)
      * (this.kind === 'stage' ? TRICKLE : 1) * (this.firstStage ? 0.5 : 1);

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

    // 몹 무리: 가끔 한 덩어리로 우르르 / 도망 다니는 무리 (스테이지만)
    if (this.kind === 'stage' && !this.bossSpawned) {
      this.packT -= dt;
      if (this.packT <= 0) {
        this.packT = PACK_SEC * (0.7 + Math.random() * 0.6) * (this.firstStage ? 1.6 : 1);
        this.spawnPack();
      }
      if (this.midBosses.length > 0 && this.time >= this.midBosses[0]) {
        this.midBosses.shift();
        this.spawnMidBoss();
      }
    }

    // 패턴 웨이브: 포위 / 돌진 / 벽을 돌아가며 (한 방향으로 달린다고 벽이 생기진 않는다). 스테이지 1은 없음
    this.waveT -= dt;
    if (this.waveT <= 0 && !this.bossSpawned && !this.firstStage) {
      this.waveT = this.isBossStage ? WAVE_GAP * 0.75 : WAVE_GAP;
      const wave = WAVES[this.waveIdx++ % WAVES.length];
      this.spawnWave(wave);
    }

    // 일정 시간마다 화면 안 가까운 곳에 보물 상자
    this.chestT -= dt;
    if (this.chestT <= 0) {
      this.chestT = this.kind === 'material' ? MATERIAL_CHEST_SEC : CHEST_SEC;
      const a = Math.random() * Math.PI * 2;
      const d = 110 + Math.random() * 90;
      const p = eng.player;
      const grade = rollChest((this.fever > 0 ? 0.25 : 0) + this.chestBonus);
      eng.spawnChest(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * 0.7, grade);
      if (this.kind !== 'material') this.game.ui.toast(`${CHEST_NAMES[grade]} 등장!`);
    }

    this.updateGearProcs(dt);
    this.recycleFarEnemies();
  }

  /** 스테이지 1 (튜토리얼처럼 쉽게) */
  private get firstStage() {
    return this.kind === 'stage' && this.stage === 1;
  }

  /**
   * 몹 무리: 가끔 한꺼번에 몰려온다 (모두 병아리 쪽으로). 모양은 셋 중 하나:
   * 덩어리(한 곳에 뭉쳐서) · 부채꼴 줄(한쪽에서 넓게) · 여러 방향 작은 무리(동시에 2~3곳)
   */
  private spawnPack() {
    const s = 1 + (this.time / 60) * 0.6;
    const skins = stageSkins(this.skinStage);
    const total = Math.round((8 + 10 * this.ramp) * (this.firstStage ? 0.5 : 1));
    const p = this.game.engine.player;
    const mob = (x: number, y: number, i: number) => {
      const fast = i % 4 === 3;
      this.spawnMob({
        kind: fast ? 'fast' : 'normal', skin: fast ? skins.fast : skins.normal, x, y,
        hp: (fast ? 4 : 5) * s, r: fast ? 10 : 11, speed: fast ? 100 : 66, dmg: 3 * s, xp: 1,
      });
    };
    const style = Math.random();
    if (style < 0.45) {
      // 덩어리
      const { x, y } = this.spawnPos();
      for (let i = 0; i < total; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.sqrt(Math.random()) * 45;
        mob(x + Math.cos(a) * d, y + Math.sin(a) * d, i);
      }
    } else if (style < 0.75) {
      // 부채꼴 줄: 한쪽에서 넓게 퍼져 몰려온다
      const base = Math.random() * Math.PI * 2;
      const d = this.diag / 2 + 30;
      for (let i = 0; i < total; i++) {
        const a = base + (i / Math.max(1, total - 1) - 0.5) * 1.3;
        mob(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, i);
      }
    } else {
      // 여러 방향 작은 무리
      const groups = 2 + Math.floor(Math.random() * 2);
      const base = Math.random() * Math.PI * 2;
      for (let g = 0; g < groups; g++) {
        const { x, y } = this.spawnPos(base + (g / groups) * Math.PI * 2);
        const n = Math.ceil(total / groups);
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * 30;
          mob(x + Math.cos(a) * r, y + Math.sin(a) * r, i);
        }
      }
    }
  }

  /** 중간 보스: 크고 단단한 정예 (바닥에 붉은 오라) */
  private spawnMidBoss() {
    const pos = this.spawnPos();
    const s = 1 + (this.time / 60) * 0.6;
    const skins = stageSkins(this.skinStage);
    this.spawnMob({ kind: 'tank', skin: skins.tank, x: pos.x, y: pos.y, hp: MID_BOSS_HP * s, r: 24, speed: 52, dmg: 14 * s, xp: 25, elite: true });
    this.game.ui.toast('중간 보스 등장!');
  }

  private spawnElite() {
    const pos = this.spawnPos();
    const s = 1 + (this.time / 60) * 0.6;
    this.spawnMob({ kind: 'tank', skin: 'rabbit', x: pos.x, y: pos.y, hp: 240 * s, r: 20, speed: 60, dmg: 12 * s, xp: 15, elite: true });
    this.game.ui.toast('정예 습격!');
  }

  /** 레이드 2페이즈: 체력 절반 아래로 내려가면 한 번 알린다 (패턴은 엔진이 알아서 거세진다) */
  private checkPhase2() {
    const boss = this.game.engine.boss;
    if (this.phase2 || !boss || boss.hp > boss.maxHp * 0.5) return;
    this.phase2 = true;
    const eng = this.game.engine;
    eng.addEffect('ring', boss.x, boss.y, 200, 0.7, '#ff4d6d');
    eng.addShake(8);
    sfx.fever();
    this.game.ui.toast('2페이즈! 마왕이 분노했다!');
  }

  /** 무한 모드: 1분마다 다음 지역(몹·바닥이 바뀌고 더 세짐), 정예가 주기적으로 */
  private updateInfinite() {
    const region = Math.min(4, Math.floor(this.time / INFINITE_REGION_SEC));
    const skinStage = this.stage + region * 10;
    if (skinStage !== this.skinStage) {
      this.skinStage = skinStage;
      const r = regionOf(skinStage);
      this.game.engine.ground = r.ground;
      this.game.ui.toast(`${r.name}(으)로 들어섰다!`);
    }
    if (this.time >= this.nextElite) {
      this.nextElite += INFINITE_ELITE_SEC;
      this.spawnElite();
    }
  }

  /** 초반 스테이지 쉬움 배율 (스테이지 판에서만, 1 = 원래 난이도) */
  private get ease() {
    if (this.kind !== 'stage') return 1;
    return Math.min(1, EASY_START + ((1 - EASY_START) * (this.stage - 1)) / (EASY_UNTIL - 1));
  }

  /** 몹이 짙어지는 정도 0~1 (스테이지 길이와 상관없이 RAMP_SEC초에 걸쳐) */
  private get ramp() {
    return Math.min(1, this.time / RAMP_SEC);
  }

  private get diag() {
    const eng = this.game.engine;
    return Math.hypot(eng.viewW, eng.viewH);
  }

  private pickKind(): EnemyKind {
    const k = this.ramp;
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
    const { x, y } = this.spawnPos(angle);
    const s = 1 + (this.time / 60) * 0.6;
    const skins = stageSkins(this.skinStage);
    // 가끔 황금 몹: 도망치고, 잡으면 골드 폭죽
    if (kind === 'normal' && Math.random() < GOLDEN_RATE * this.game.goldenBoost) {
      this.spawnGolden(x, y);
      return;
    }
    if (kind === 'normal' && Math.random() < FIRSTAID_RATE) {
      this.spawnMob({ kind: 'tank', skin: 'firstaid', x, y, hp: 70 * s, r: 15, speed: 32, dmg: 2 * s, xp: 10 });
      this.game.ui.toast('구급상자 몹! 잡으면 체력 회복');
      return;
    }
    switch (kind) {
      case 'normal':
        this.spawnMob({ kind, skin: skins.normal, x, y, hp: 5 * s, r: 11, speed: 62, dmg: 3 * s, xp: 1 });
        break;
      case 'fast':
        // 빠른 몹은 가는 길목을 앞질러 막는다
        this.spawnMob({ kind, skin: skins.fast, x, y, hp: 4 * s, r: 10, speed: 115, dmg: 3 * s, xp: 1, move: 'lead' });
        break;
      case 'tank':
        this.spawnMob({ kind, skin: skins.tank, x, y, hp: 24 * s, r: 14, speed: 40, dmg: 7 * s, xp: 3 });
        break;
      case 'boss':
        break;
    }
  }

  private spawnWave(wave: Wave) {
    const eng = this.game.engine;
    const p = eng.player;
    const s = 1 + (this.time / 60) * 0.6;
    const skins = stageSkins(this.skinStage);
    const crowd = 1 + this.ramp;
    const h = this.heading ?? Math.random() * Math.PI * 2;
    switch (wave) {
      case 'ring': {
        // 사방을 둘러싸고 조여 온다: 빈틈 한 군데로 빠져나가야 한다
        const n = Math.round(44 * crowd);
        const r = this.diag / 2 + 10;
        const gap = Math.random() * Math.PI * 2;
        for (let i = 0; i < n; i++) {
          const a = gap + 0.5 + (i / n) * (Math.PI * 2 - 1);
          this.spawnMob({
            kind: 'normal', skin: skins.normal, x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r,
            hp: 5 * s, r: 11, speed: 70, dmg: 3 * s * RING_DMG, xp: 1, tint: 'ring',
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
        const n = Math.round(24 * crowd);
        for (let i = 0; i < n; i++) {
          const along = (i - (n - 1) / 2) * 22;
          // 줄을 가는 방향 쪽으로 조금 밀어서 앞길을 쓸고 지나가게
          const cx = p.x + Math.cos(side) * startD + Math.cos(h) * (along + 60);
          const cy = p.y + Math.sin(side) * startD + Math.sin(h) * (along + 60);
          this.spawnMob({
            kind: 'fast', skin: skins.fast, x: cx, y: cy, hp: 4 * s, r: 11, speed: 230, dmg: 5 * s * CHARGE_DMG, xp: 1, tint: 'charge',
            move: 'charge', dashX: dirX, dashY: dirY, t1: (startD * 2 + 80) / 230,
          });
        }
        this.game.ui.toast('돌진!');
        break;
      }
      case 'wall': {
        // 가끔 오는 벽 웨이브: 아무 쪽에서나 두 줄로 몰려온다. 앞줄은 단단한 몹이 섞이고, 뒷줄은 빠른 몹
        const wallDir = Math.random() * Math.PI * 2;
        const d = this.diag / 2 - 40;
        const n = Math.round(14 * crowd);
        const fx = Math.cos(wallDir);
        const fy = Math.sin(wallDir);
        const rows = 2;
        for (let row = 0; row < rows; row++) {
          for (let i = 0; i < n; i++) {
            const off = (i - (n - 1) / 2 + row * 0.5) * 28;
            const dd = d + row * 34;
            const tank = row % 2 === 0 && i % 3 === 1;
            const fast = row % 2 === 1;
            this.spawnMob({
              kind: tank ? 'tank' : fast ? 'fast' : 'normal',
              skin: tank ? skins.tank : fast ? skins.fast : skins.normal,
              x: p.x + fx * dd - fy * off, y: p.y + fy * dd + fx * off,
              hp: (tank ? 24 : fast ? 4 : 5) * s, r: tank ? 14 : fast ? 10 : 11,
              speed: tank ? 40 : fast ? 115 : 62, dmg: (tank ? 8 : 4) * s * WALL_DMG, xp: tank ? 3 : 1, tint: 'wall',
            });
          }
        }
        this.game.ui.toast('몹 벽이 몰려온다!');
        break;
      }
    }
  }

  /** 일반 몹 생성: 난이도 배율(MOB_HP, MOB_DMG)을 적용한다 */
  private spawnMob(init: Parameters<Engine['spawnEnemy']>[0]) {
    const ease = this.ease;
    return this.game.engine.spawnEnemy({ ...init, hp: init.hp * MOB_HP * ease, dmg: (init.dmg ?? 1) * MOB_DMG * ease });
  }

  private spawnBoss() {
    this.bossSpawned = true;
    const { x, y } = this.spawnPos();
    const eng = this.game.engine;
    if (this.isBossStage) {
      eng.spawnEnemy({ kind: 'boss', skin: 'devil', x, y, hp: BOSS_HP * this.ease, r: 32, speed: 52, dmg: 32 * this.ease, xp: 0, elite: true });
      this.game.ui.toast('마왕 등장!');
    } else {
      // 스테이지 1은 멍때려도 잡히는 약한 보스
      const k = this.firstStage ? 0.02 : this.ease;
      eng.spawnEnemy({ kind: 'boss', skin: 'rabbit', x, y, hp: ELITE_HP * k, r: 24, speed: this.firstStage ? 40 : 58, dmg: (this.firstStage ? 6 : 24) * this.ease, xp: 0, elite: true });
      this.game.ui.toast('정예 몬스터 등장!');
    }
  }

  /** 유물 발동 효과 (시간에 따라): 8초마다 보호막, 달리면 발자국 장판 */
  private updateGearProcs(dt: number) {
    const eng = this.game.engine;
    const pr = eng.procs;
    const p = eng.player;
    if (pr.shield > 0) {
      this.shieldT -= dt;
      if (this.shieldT <= 0) {
        this.shieldT = 8;
        eng.addShield(p.maxHp * pr.shield, 8);
        eng.addEffect('ring', p.x, p.y, 34, 0.4, '#9fe4ff');
      }
    }
    if ((pr.trailPoison > 0 || pr.trailIce > 0 || pr.trailFire > 0) && p.moving && !p.dead) {
      this.trailT -= dt;
      if (this.trailT <= 0) {
        this.trailT = 0.25;
        const power = this.stats.power;
        if (pr.trailFire > 0) eng.addZone(p.x, p.y + 6, 0, 0, 20, 1.6, power * pr.trailFire, 'fire-burst');
        if (pr.trailIce > 0) eng.addZone(p.x, p.y + 6, 0, 0, 22, 2, power * pr.trailIce, 'ice-crystals@190', 0, 0, 0, 1.5);
        if (pr.trailPoison > 0) eng.addZone(p.x, p.y + 6, 0, 0, 22, 2, power * pr.trailPoison, 'dust@100');
      }
    }
  }

  /** 너무 멀어진 적은 플레이어 앞쪽으로 다시 데려온다 (도망쳐도 앞에서 다시 만난다) */
  private recycleFarEnemies() {
    const eng = this.game.engine;
    const p = eng.player;
    const limit = this.diag * 0.9;
    for (const e of eng.enemies.items) {
      if (!e.active || e.kind === 'boss' || e.move === 'charge' || e.move === 'flee') continue;
      if (Math.hypot(e.x - p.x, e.y - p.y) > limit) {
        const pos = this.spawnPos();
        e.x = pos.x;
        e.y = pos.y;
      }
    }
  }

  private onKill(e: Enemy) {
    this.kills++;
    if (this.fever > 0) this.feverKills++;
    const now = this.game.engine.time;
    this.combo = now - this.lastKillAt <= this.comboSec ? this.combo + 1 : 1;
    this.game.seeMonster(e.skin);
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.lastKillAt = now;
    sfx.kill(this.combo);
    const eng = this.game.engine;
    if (e.skin === 'firstaid') eng.spawnHeal(e.x, e.y);
    // 유물: 처치 때 흡혈 / 폭발
    const pr = eng.procs;
    if (pr.lifesteal > 0) {
      const p = eng.player;
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * pr.lifesteal);
    }
    if (pr.killBlast > 0 && Math.random() < pr.killBlast) {
      eng.blast(e.x, e.y, 60, this.stats.power * 2, 120);
      eng.addEffect('burst', e.x, e.y, 60, 0.35, '#9be36a');
      eng.burst(e.x, e.y - 6, 12, ['#9be36a', '#ffe066', '#ffffff'], 200, 0.45, 0, 2.5);
    }
    if (e.golden) {
      const gold = enemyGold(this.stage) * GOLDEN_GOLD;
      this.bonusGold += gold;
      this.goldenKills++;
      this.game.save.diamonds += GOLDEN_DIAMONDS;
      eng.addText(e.x, e.y - 50, `+${fmt(gold)} G`, '#ffe066', 24);
      eng.addText(e.x, e.y - 28, `💎 +${GOLDEN_DIAMONDS}`, '#9fe4ff', 18);
      eng.addEffect('ring', e.x, e.y, 120, 0.5, '#ffe066');
      eng.addShake(5);
      // 금 상자를 떨군다 (상자 자석으로 바로 끌려온다)
      eng.spawnChest(e.x, e.y, 2);
      sfx.coin();
      this.game.ui.toast(`황금 몹 처치! 골드 폭죽 + 💎${GOLDEN_DIAMONDS} + 금 상자!`);
    }
    // 100콤보마다 축하 연출 + 맵 전체 보석 싹쓸이
    if (this.combo % VACUUM_COMBO === 0) {
      const p = eng.player;
      eng.addEffect('ring', p.x, p.y, 140, 0.45, '#ffe066');
      eng.burst(p.x, p.y - 20, 24, ['#ffe066', '#ffb347', '#ffffff'], 260, 0.7, 300, 3.5);
      eng.addText(p.x, p.y - 64, `${this.combo} COMBO! 싹쓸이!`, '#ffb347', 22);
      eng.vacuumGems();
    }
    // 피버 게이지: 다 차면 피버, 끝나면 다시 0부터
    if (this.fever <= 0 && (this.feverGauge += this.feverMul) >= FEVER_NEED) this.startFever();
    // 중간 보스: 보상이 펑 (골드·다이아·은/금 상자)
    if (e.elite && e.kind !== 'boss') this.bossReward(e, MIDBOSS_GOLD, MIDBOSS_DIAMONDS, Math.random() < 0.3 ? 2 : 1, false);
    if (e.kind === 'boss') {
      if (this.kind !== 'stage') return this.finish(true);
      // 스테이지 보스: 크게 펑 (마왕 스테이지는 2배) + 금 상자는 바로 가방으로, 잠깐 보여 주고 결과 화면
      const k = this.isBossStage ? 2 : 1;
      this.bossReward(e, STAGE_BOSS_GOLD * k, STAGE_BOSS_DIAMONDS * k, 2, true);
      this.winT = WIN_DELAY;
    }
  }

  /** 보스 보상 연출: 골드·다이아 글자, 폭죽, 상자 (inBag이면 줍지 않아도 가방으로) */
  private bossReward(e: Enemy, goldMul: number, diamonds: number, chest: ChestGrade, inBag: boolean) {
    const eng = this.game.engine;
    const gold = enemyGold(this.stage) * goldMul;
    this.bonusGold += gold;
    this.game.save.diamonds += diamonds;
    eng.addText(e.x, e.y - 60, `+${fmt(gold)} G`, '#ffe066', 28);
    eng.addText(e.x, e.y - 32, `💎 +${diamonds}`, '#9fe4ff', 20);
    eng.addEffect('ring', e.x, e.y, 160, 0.6, '#ffe066');
    eng.addEffect('ring', e.x, e.y, 90, 0.45, '#ffffff');
    eng.burst(e.x, e.y - 20, 40, ['#ffe066', '#ffb347', '#ffffff', '#9fe4ff'], 340, 0.9, 380, 4);
    eng.addShake(8);
    // 열쇠: 중간 보스는 절반 확률로 은 열쇠, 스테이지 보스는 은 열쇠 + 금 열쇠 (마왕은 확정, 정예는 30%)
    const keys: [MatId, number][] = inBag
      ? [['key_silver', 1], ['key_gold', this.isBossStage || Math.random() < 0.3 ? 1 : 0]]
      : [['key_silver', Math.random() < 0.5 ? 1 : 0]];
    keys.forEach(([k, n], i) => {
      if (!n) return;
      this.game.save.mats[k] = (this.game.save.mats[k] ?? 0) + n;
      eng.addText(e.x + (i ? 30 : -30), e.y - 110, `${k === 'key_gold' ? '🗝️ 금' : '🔑 은'} 열쇠!`, k === 'key_gold' ? '#ffd23f' : '#d8e4f0', 16);
    });
    if (inBag) {
      this.chests.push(chest);
      eng.addText(e.x, e.y - 86, `${CHEST_NAMES[chest]} 획득! (가방으로)`, '#ffd166', 18);
    } else {
      eng.spawnChest(e.x, e.y, chest);
    }
    eng.vacuumGems();
    sfx.coin();
    sfx.chest();
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
    p.speed *= FEVER_MOVE;
    eng.addSprite('pillar', p.x, p.y - 30, 60, 0.9, true);
    eng.addEffect('ring', p.x, p.y, 260, 0.7, '#ffb347');
    eng.addShake(7);
    // 피버 시작 = 맵 전체 보석 싹쓸이
    eng.vacuumGems();
    this.fevers++;
    sfx.fever();
    this.game.ui.feverStart();
  }

  private endFever() {
    this.fever = 0;
    this.feverGauge = 0;
    this.game.engine.fever = 0;
    this.game.engine.player.speed /= FEVER_MOVE;
    for (const s of this.equipped) {
      s.tree.dmg -= FEVER_BONUS;
      s.tree.spd -= FEVER_BONUS;
      s.tree.cnt -= FEVER_BONUS;
    }
  }

  /** 재료 상자: 결과 화면에서 연다 */
  /** 상자를 주우면 가방으로 (가방 탭에서 하나씩 연다) */
  private onChest(x: number, y: number, grade: ChestGrade) {
    this.chests.push(grade);
    const eng = this.game.engine;
    eng.addText(x, y - 30, `${CHEST_NAMES[grade]} 획득!`, CHEST_COLORS[grade], 16);
    eng.burst(x, y - 10, 10 + grade * 6, [CHEST_COLORS[grade], '#ffe066', '#ffffff'], 180, 0.5, 260, 2.5);
    sfx.chest();
  }

  /** 경험치 보석: 캐릭터 영구 경험치로 바로 쌓는다 */
  private onGem(gem: number) {
    const v = gem * this.xpMul;
    this.xpGained += v;
    const ups = this.game.addXp(v);
    if (ups > 0) {
      this.levelUps += ups;
      const p = this.game.engine.player;
      this.game.engine.addSprite('pillar', p.x, p.y - 20, 34, 0.8, true);
      sfx.levelUp();
      this.game.ui.toast(`레벨 업! Lv ${this.game.save.level}`);
    }
  }

  /** 황금 몹: 크고 단단하고 도망친다, 부딪히면 아프다. 잡으면 골드·다이아·금 상자 (x, y 없으면 화면 안 가까이: 튜토리얼) */
  spawnGolden(x?: number, y?: number) {
    const p = this.game.engine.player;
    if (x === undefined || y === undefined) {
      const a = Math.random() * Math.PI * 2;
      x = p.x + Math.cos(a) * 110;
      y = p.y + Math.sin(a) * 80;
    }
    const s = 1 + (this.time / 60) * 0.6;
    const skins = stageSkins(this.skinStage);
    this.spawnMob({ kind: 'normal', skin: skins.normal, x, y, hp: 80 * s, r: 22, speed: 60, dmg: 6 * s, xp: 20, move: 'flee', golden: true, t1: 18 });
    this.game.ui.toast('황금 몹이다! 잡아라!');
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
    if (win && this.kind === 'raid') gold += stageClearGold(this.stage) * 2;
    if (win && this.kind === 'stage') {
      gold += stageClearGold(this.stage);
      save.maxStage = Math.max(save.maxStage, this.stage);
      save.bestStageEver = Math.max(save.bestStageEver, save.maxStage);
      if (this.isBossStage) save.bossKills++;
      save.stats.stages++;
    }
    gold *= this.game.goldBoost * this.goldMul;
    // 레이드: 이기면 정수 3개(45초 안이면 +1), 져도 보스 체력을 절반 넘게 깎았으면 1개
    let essence = 0;
    if (this.kind === 'raid') {
      const boss = this.game.engine.boss;
      essence = win ? this.raidBoss.essence + (this.time < 45 ? 1 : 0) : boss && boss.hp <= boss.maxHp * 0.5 ? 1 : 0;
      save.essence += essence;
      if (win) {
        save.diamonds += this.raidBoss.diamonds;
        save.mats.key_gold = (save.mats.key_gold ?? 0) + 1;
      }
    }
    const best = this.kind === 'infinite' && this.time > save.infiniteBest;
    if (best) save.infiniteBest = this.time;
    // 주운 상자는 가방에 넣는다 (가방 탭에서 하나씩 연다)
    const chests = [...this.chests];
    for (const grade of chests) {
      const key = `${grade}:${this.stage}`;
      save.chestBag[key] = (save.chestBag[key] ?? 0) + 1;
    }
    save.gold += gold;
    save.stats.kills += this.kills;
    save.stats.bestCombo = Math.max(save.stats.bestCombo, this.bestCombo);
    save.stats.fevers += this.fevers;
    save.stats.golden += this.goldenKills;
    addDaily(save, 'kills', this.kills);
    addDaily(save, 'plays');
    addDaily(save, 'fevers', this.fevers);
    this.game.addPassXp(PLAY_PASS_XP + (win ? PLAY_PASS_XP : 0));
    // 숙련도: 장착하고 싸운 시간만큼 (유물 공짜 스킬은 빼고)
    const mastery = this.game.gainMastery(this.equipped.map((e) => e.def.id), Math.min(this.time, 180));
    const result: RunResult = {
      win, time: this.time, kills: this.kills, bestCombo: this.bestCombo, xp: this.xpGained, levelUps: this.levelUps,
      gold, stage: this.stage, chests, kind: this.kind, essence, best, mastery,
    };
    this.game.ui.showResult(result, () => this.game.enterIdle());
  }
}
