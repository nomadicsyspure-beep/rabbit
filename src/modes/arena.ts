import { sfx } from '../audio/sfx';
import { fmt } from '../core/format';
import { enemyGold } from '../data/balance';
import { stageSkins } from '../data/world';
import { stageEase } from '../data/balance';
import { BoarBrain } from './boar';
import type { Enemy, Engine } from '../battle/engine';
import type { ActionMode } from './action';

// 아레나(테스트 맵): 닫힌 경기장 + 판마다 다른 사건. 모험 탭 '아레나 테스트'에서 종류를 골라 들어간다.
//  - 마지막 5초 러시: 타이머·화면 테두리가 빨갛게 맥박, 몹이 한꺼번에
//  - 돌발 이벤트(판마다 무작위, 2초 전 예고): 운석 낙하 · 좁혀 오는 독안개 · 폭주 몹 · 대행진
//  - 저주 상자: 열면 10초 동안 몹 2배, 버티면 금 상자
//  - 별 3개: 클리어 · 체력 50% 이상 유지 · 종류마다 다른 도전
//  - 종류: 일반 · 생존 · 섬멸 · 추격 · 수비, 보스는 체력 절반에서 분노

export type ArenaVariant = 'normal' | 'survive' | 'exterminate' | 'chase' | 'defend' | 'boar';
export type ArenaEvent = 'meteor' | 'poison' | 'bomb' | 'herd';

export interface ArenaVariantDef {
  id: ArenaVariant;
  name: string;
  icon: string;
  desc: string;
  /** 판 길이(초): 일반은 이 시간 뒤 보스, 나머지는 제한 시간 */
  sec: number;
  /** 세 번째 별 조건 */
  star3: string;
}

export const ARENA_VARIANTS: ArenaVariantDef[] = [
  { id: 'normal', name: '일반', icon: '🏟️', sec: 30, desc: '30초 버티면 보스. 돌발 이벤트 2번 + 저주 상자', star3: '보스를 10초 안에 처치' },
  { id: 'survive', name: '생존', icon: '🛡️', sec: 30, desc: '보스 없이 30초 버티기. 몹이 짙고 이벤트 3번', star3: '맞은 횟수 8번 이하' },
  { id: 'exterminate', name: '섬멸', icon: '💀', sec: 40, desc: '40초 안에 120마리 처치', star3: '30초 안에 달성' },
  { id: 'chase', name: '추격', icon: '🏃', sec: 30, desc: '도망치는 황금 몹을 30초 안에 잡기 (구석으로 몰아라)', star3: '15초 안에 처치' },
  { id: 'boar', name: '보스전: 태엽 멧돼지', icon: '🐗', sec: 60, desc: '엄청 빠른 돌진! 빨간 길을 피하고 돌기둥에 박게 하면 기절, 태엽이 풀리면 약점. 60초 안에 처치', star3: '40초 안에 처치' },
  { id: 'defend', name: '수비', icon: '🥚', sec: 30, desc: '가운데 알을 30초 동안 지키기 (몹 열에 넷은 알을 노린다, 알 곁에서 싸워라)', star3: '알 체력 60% 이상' },
];
export const ARENA_BY_ID = Object.fromEntries(ARENA_VARIANTS.map((v) => [v.id, v])) as Record<ArenaVariant, ArenaVariantDef>;

const EVENT_NAMES: Record<ArenaEvent, string> = {
  meteor: '☄️ 운석이 떨어진다! 빨간 원을 피해라',
  poison: '☠️ 독안개가 좁혀 온다! 원 안으로',
  bomb: '💣 폭주 몹 출현! 닿기 전에 잡아라',
  herd: '🐗 대행진! 비키거나 뚫어라',
};
const EVENT_WARN = 2;
const RUSH_SEC = 5;
const CURSE_SEC = 10;
const EXTERMINATE_GOAL = 120;
/** 태엽 멧돼지 체력·몸통 피해 (초반 쉬움 배율을 곱한다) */
const BOAR_HP = 8000;
const BOAR_DMG = 30;

/** 아레나 크기: 화면의 몇 배 */
export function arenaSize(viewW: number, viewH: number) {
  return { w: Math.round(Math.max(520, viewW * 1.6)), h: Math.round(Math.max(700, viewH * 1.15)) };
}

export interface ArenaResult {
  /** 별 기록 열쇠 (아레나는 종류 id, 스크롤은 'scroll') */
  key: string;
  name: string;
  icon: string;
  desc: string;
  stars: boolean[];
  labels: string[];
  newStars: number;
  diamonds: number;
}

export class ArenaDirector {
  variant: ArenaVariant = 'normal';
  protected events: { t: number; kind: ArenaEvent; warned: boolean; started: boolean }[] = [];
  protected meteorT = 0;
  protected meteorEnd = 0;
  protected landings: { x: number; y: number; t: number; r: number }[] = [];
  protected poisonT = -1;
  protected poisonTick = 0;
  protected rushOn = false;
  protected beatT = 0;
  /** 저주 상자: 0 = 아직 / 1 = 놓임 / 2 = 저주 중 / 3 = 끝 */
  protected curseState = 0;
  protected curseAt = 0;
  protected curseT = 0;
  protected bombs = new Set<Enemy>();
  protected target: Enemy | null = null;
  protected targetKilledAt = -1;
  protected bossAt = -1;
  protected bossKilledAt = -1;
  protected enraged = false;
  protected goalAt = -1;
  /** 별 기록: 가장 낮았던 체력 비율, 맞은 횟수 */
  minHp = 1;
  hits = 0;

  constructor(protected readonly a: ActionMode) {}

  protected get eng(): Engine {
    return this.a.engine;
  }

  get def(): ArenaVariantDef {
    return ARENA_BY_ID[this.variant];
  }

  /** 별 기록 열쇠 */
  get key(): string {
    return this.variant;
  }

  /** 시작 알림 */
  protected get title() {
    return `아레나 · ${this.def.name}`;
  }

  /** 싸우는 영역 (이벤트 위치 기준): 아레나는 경기장 */
  protected area() {
    const a = this.eng.arena!;
    return { x: 0, y: 0, w: a.w, h: a.h };
  }

  /** 나올 수 있는 돌발 이벤트 */
  protected eventPool(): ArenaEvent[] {
    return ['meteor', 'poison', 'bomb', 'herd'];
  }

  /** 경기장 만들기 (병아리 위치·장애물) */
  protected setupField() {
    const eng = this.eng;
    const size = arenaSize(eng.viewW, eng.viewH);
    eng.arena = size;
    const p = eng.player;
    p.x = size.w / 2;
    p.y = size.h / 2 + (this.variant === 'defend' ? 90 : 0);
    // 돌기둥: 막혀서 돌아가야 하고, 몹을 끼고 싸울 수 있다 (배치 셋 중 하나)
    const { w, h } = size;
    const layouts: [number, number][][] = [
      [[0.25, 0.3], [0.75, 0.3], [0.25, 0.72], [0.75, 0.72]],
      [[0.5, 0.22], [0.2, 0.5], [0.8, 0.5], [0.5, 0.8]],
      [[0.3, 0.25], [0.7, 0.4], [0.3, 0.62], [0.7, 0.8]],
    ];
    const lay = layouts[Math.floor(Math.random() * layouts.length)];
    eng.rocks = lay.map(([fx, fy]) => ({ x: fx * w, y: fy * h, r: 24 + Math.random() * 8 }));
  }

  start(variant: ArenaVariant) {
    this.variant = ARENA_BY_ID[variant] ? variant : 'normal';
    const eng = this.eng;
    this.setupField();
    // 돌발 이벤트: 판마다 무작위 (같은 건 두 번 안 나온다)
    const pool = this.eventPool();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const times = this.variant === 'boar' ? [] : this.variant === 'survive' ? [5, 13, 21] : this.variant === 'exterminate' ? [8, 22] : [7, 16];
    this.events = times.slice(0, pool.length).map((t, i) => ({ t, kind: pool[i], warned: false, started: false }));
    this.meteorEnd = 0;
    this.landings = [];
    this.poisonT = -1;
    this.rushOn = false;
    this.curseState = this.variant === 'normal' || this.variant === 'survive' || this.variant === 'exterminate' ? 0 : 3;
    this.curseAt = 9 + Math.random() * 4;
    this.curseT = 0;
    this.bombs.clear();
    this.target = null;
    this.targetKilledAt = -1;
    this.bossAt = -1;
    this.bossKilledAt = -1;
    this.enraged = false;
    this.goalAt = -1;
    this.minHp = 1;
    this.hits = 0;
    if (this.variant === 'defend') {
      const hp = eng.player.maxHp * 2;
      const ar = this.area();
      eng.lure = { x: ar.x + ar.w / 2, y: ar.y + ar.h / 2 - 10, r: 26, hp, maxHp: hp };
      // 알 자리에 돌기둥이 겹치지 않게
      eng.rocks = eng.rocks.filter((r) => Math.hypot(r.x - eng.lure!.x, r.y - eng.lure!.y) > r.r + 80);
    }
    if (this.variant === 'chase') this.spawnRunner();
    this.boar = null;
    if (this.variant === 'boar') this.spawnBoar();
    this.a.game.ui.toast(`${this.title}: ${this.def.desc}`);
  }

  /** 보스전: 태엽 멧돼지 (위쪽 울타리에서 걸어 들어온다) */
  protected boar: BoarBrain | null = null;
  protected spawnBoar() {
    const eng = this.eng;
    const ar = eng.arena!;
    const ease = stageEase(this.a.stage);
    const e = eng.spawnEnemy({
      kind: 'boss', skin: 'boar', x: ar.w / 2, y: -40, hp: BOAR_HP * ease, r: 30, speed: 0, dmg: BOAR_DMG * ease, xp: 0, elite: true, scripted: true,
    });
    if (!e) return;
    this.a.bossSpawned = true;
    this.bossAt = 0;
    this.boar = new BoarBrain(eng, e, (m) => this.a.game.ui.toast(m));
  }

  /** 몹 생성 배율 (저주·러시·종류) */
  get spawnMul() {
    let k = 1;
    if (this.variant === 'boar') k *= 0.35;
    if (this.variant === 'survive') k *= 1.4;
    if (this.variant === 'exterminate') k *= 1.8;
    if (this.variant === 'chase') k *= 0.7;
    if (this.curseState === 2) k *= 2.2;
    if (this.rushOn) k *= this.variant === 'normal' ? 2.6 : 1.6;
    return k;
  }

  /** 몹 나오는 자리 */
  spawnPos() {
    return this.edgePos();
  }

  /** 경기장 가장자리 바로 바깥 (몹이 울타리를 넘어 들어온다) */
  edgePos() {
    const a = this.eng.arena!;
    const side = Math.floor(Math.random() * 4);
    const t = Math.random();
    const o = 26;
    if (side === 0) return { x: t * a.w, y: -o };
    if (side === 1) return { x: a.w + o, y: t * a.h };
    if (side === 2) return { x: t * a.w, y: a.h + o };
    return { x: -o, y: t * a.h };
  }

  /** 새로 나온 몹 손보기 (수비: 절반은 알로) */
  decorate(e: Enemy | null) {
    if (!e || this.variant !== 'defend' || e.kind === 'boss' || e.golden) return;
    if (Math.random() < 0.4) e.toLure = true;
  }

  /** 남은 시간 (HUD) */
  get timeLeft() {
    return Math.max(0, this.def.sec - this.a.time);
  }

  /** HUD 위쪽 글: 종류와 목표 */
  get plate() {
    switch (this.variant) {
      case 'exterminate': return `섬멸 ${Math.min(this.a.kills, EXTERMINATE_GOAL)}/${EXTERMINATE_GOAL}`;
      case 'defend': return `수비 알 ${Math.round(((this.eng.lure?.hp ?? 0) / (this.eng.lure?.maxHp ?? 1)) * 100)}%`;
      case 'chase': return '추격: 황금 몹!';
      case 'survive': return '생존';
      default: return this.curseState === 2 ? `저주 ${Math.ceil(this.curseT)}초` : '아레나';
    }
  }

  get rushing() {
    return this.rushOn;
  }

  update(dt: number) {
    const a = this.a;
    const eng = this.eng;
    const p = eng.player;
    this.minHp = Math.min(this.minHp, p.hp / p.maxHp);

    // 끝나는 조건
    const t = a.time;
    this.boar?.update(dt);
    if (this.variant === 'boar') {
      if (t >= this.def.sec) return a.finish(false);
    } else if (this.variant === 'survive' || this.variant === 'defend') {
      if (t >= this.def.sec) return a.finish(true);
    } else if (this.variant === 'exterminate') {
      if (a.kills >= EXTERMINATE_GOAL) {
        this.goalAt = t;
        return a.finish(true);
      }
      if (t >= this.def.sec) return a.finish(false);
    } else if (this.variant === 'chase') {
      if (t >= this.def.sec) return a.finish(false);
    } else if (!a.bossSpawned && t >= this.def.sec) {
      a.spawnBoss();
      this.bossAt = t;
    }

    // 마지막 5초 러시 (일반은 보스 직전, 나머지는 끝나기 직전)
    const left = this.def.sec - t;
    const rush = left <= RUSH_SEC && left > 0 && !(this.variant === 'normal' && a.bossSpawned);
    if (rush && !this.rushOn) {
      this.rushOn = true;
      a.game.ui.toast(this.variant === 'normal' ? '⚠️ 보스 접근 중! 몰려온다!' : '⚠️ 마지막 5초!');
      sfx.fever();
    } else if (!rush && this.rushOn) {
      this.rushOn = false;
    }
    eng.rush = this.rushOn ? 1 : 0;
    if (this.rushOn) {
      this.beatT -= dt;
      if (this.beatT <= 0) {
        this.beatT = 0.42;
        sfx.heartbeat();
      }
    }

    // 돌발 이벤트: 2초 전 예고 → 시작
    for (const ev of this.events) {
      if (!ev.warned && t >= ev.t - EVENT_WARN) {
        ev.warned = true;
        a.game.ui.toast(`⚠️ ${EVENT_NAMES[ev.kind]}`);
        sfx.chest();
      }
      if (!ev.started && t >= ev.t) {
        ev.started = true;
        this.startEvent(ev.kind);
      }
    }
    this.updateMeteors(dt);
    this.updatePoison(dt);
    this.updateBombs();
    this.updateCurse(dt);
    this.updateRunner();
    this.updateLure(dt);
    this.updateEnrage();
  }

  protected startEvent(kind: ArenaEvent) {
    const eng = this.eng;
    const ar = this.area();
    if (kind === 'meteor') {
      this.meteorEnd = this.a.time + 5;
      this.meteorT = 0;
    } else if (kind === 'poison') {
      this.poisonT = 0;
      this.poisonTick = 0;
      eng.safe = { x: ar.x + ar.w / 2 + (Math.random() - 0.5) * ar.w * 0.3, y: ar.y + ar.h / 2 + (Math.random() - 0.5) * ar.h * 0.3, r: Math.hypot(ar.w, ar.h) };
    } else if (kind === 'bomb') {
      const s = 1 + (this.a.time / 60) * 0.6;
      for (let i = 0; i < 4; i++) {
        const pos = this.spawnPos();
        const e = this.a.spawnMob({ kind: 'fast', skin: stageSkins(this.a.stage).fast, x: pos.x, y: pos.y, hp: 14 * s, r: 13, speed: 108, dmg: 4 * s, xp: 5, tint: 'bomb' });
        if (e) this.bombs.add(e);
      }
    } else {
      // 대행진: 한쪽 울타리에서 반대쪽으로 줄지어 우르르
      const s = 1 + (this.a.time / 60) * 0.6;
      const skins = stageSkins(this.a.stage);
      const fromLeft = Math.random() < 0.5;
      const n = 36;
      for (let i = 0; i < n; i++) {
        const y = ar.y + ((i + 0.5) / n) * ar.h;
        const x = fromLeft ? ar.x - 30 - (i % 3) * 22 : ar.x + ar.w + 30 + (i % 3) * 22;
        this.a.spawnMob({
          kind: i % 6 === 0 ? 'tank' : 'normal', skin: i % 6 === 0 ? skins.tank : skins.normal, x, y,
          hp: (i % 6 === 0 ? 24 : 5) * s, r: i % 6 === 0 ? 14 : 11, speed: 150, dmg: 5 * s, xp: 1, tint: 'charge',
          move: 'charge', dashX: fromLeft ? 1 : -1, dashY: 0, t1: (ar.w + 120) / 150,
        });
      }
    }
  }

  protected updateMeteors(dt: number) {
    const eng = this.eng;
    const ar = this.area();
    const p = eng.player;
    if (this.a.time < this.meteorEnd) {
      this.meteorT -= dt;
      if (this.meteorT <= 0) {
        this.meteorT = 0.32;
        // 절반은 병아리 근처, 절반은 경기장 아무 데나
        const near = Math.random() < 0.5;
        const x = near ? p.x + (Math.random() - 0.5) * 220 : ar.x + Math.random() * ar.w;
        const y = near ? p.y + (Math.random() - 0.5) * 220 : ar.y + Math.random() * ar.h;
        const r = 44;
        eng.addHazard(x, y, r, 1.1, p.maxHp * 0.14);
        this.landings.push({ x, y, t: 1.1, r });
      }
    }
    for (let i = this.landings.length - 1; i >= 0; i--) {
      const l = this.landings[i];
      l.t -= dt;
      if (l.t > 0) continue;
      this.landings.splice(i, 1);
      // 몹도 맞는다 (불이라 기름에 불이 붙는다)
      eng.explode(l.x, l.y, l.r, this.a.power * 3, 'fire-burst');
    }
  }

  protected updatePoison(dt: number) {
    const eng = this.eng;
    if (this.poisonT < 0 || !eng.safe) return;
    this.poisonT += dt;
    const ar = this.area();
    const big = Math.hypot(ar.w, ar.h) * 0.6;
    const small = 150;
    const t = this.poisonT;
    // 6초 동안 좁혀지고, 5초 버티고, 3초에 걸쳐 풀린다
    eng.safe.r = t < 6 ? big + (small - big) * (t / 6) : t < 11 ? small : t < 14 ? small + (big - small) * ((t - 11) / 3) : big;
    if (t >= 14) {
      eng.safe = null;
      this.poisonT = -1;
      this.a.game.ui.toast('독안개가 걷혔다');
      return;
    }
    const p = eng.player;
    if (Math.hypot(p.x - eng.safe.x, p.y - eng.safe.y) > eng.safe.r) {
      this.poisonTick -= dt;
      if (this.poisonTick <= 0) {
        this.poisonTick = 0.5;
        eng.damagePlayer(p.maxHp * 0.05, undefined, undefined, false);
        eng.burst(p.x, p.y - 10, 4, ['#c78bff', '#7a3fb0'], 80, 0.4, -60, 3);
      }
    }
  }

  /** 폭주 몹: 병아리에게 닿으면 자폭 (크게 아프다), 먼저 잡으면 주변 몹까지 펑 + 보너스 */
  protected updateBombs() {
    const eng = this.eng;
    const p = eng.player;
    for (const e of this.bombs) {
      if (!e.active) {
        this.bombs.delete(e);
        continue;
      }
      if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r + 6) {
        this.bombs.delete(e);
        e.active = false;
        eng.addSprite('fire-burst', e.x, e.y - 6, 60, 0.4);
        eng.addEffect('ring', e.x, e.y, 80, 0.4, '#ff4d4d');
        eng.addShake(6);
        sfx.boom();
        eng.damagePlayer(p.maxHp * 0.22, e.x, e.y, true);
      }
    }
  }

  protected updateCurse(dt: number) {
    const a = this.a;
    const eng = this.eng;
    const ar = this.area();
    const p = eng.player;
    if (this.curseState === 0 && a.time >= this.curseAt && !a.bossSpawned) {
      // 병아리에서 떨어진 곳에 놓는다
      let x = 0;
      let y = 0;
      for (let i = 0; i < 10; i++) {
        x = ar.x + 60 + Math.random() * (ar.w - 120);
        y = ar.y + 60 + Math.random() * (ar.h - 120);
        if (Math.hypot(x - p.x, y - p.y) > 140) break;
      }
      eng.curse = { x, y };
      this.curseState = 1;
      a.game.ui.toast('😈 저주 상자! 열면 10초 동안 몹 2배, 버티면 금 상자');
    }
    if (this.curseState === 1 && eng.curse) {
      if (Math.hypot(eng.curse.x - p.x, eng.curse.y - p.y) < 26) {
        this.curseState = 2;
        this.curseT = CURSE_SEC;
        eng.addEffect('ring', eng.curse.x, eng.curse.y, 160, 0.6, '#c78bff');
        eng.burst(eng.curse.x, eng.curse.y - 10, 24, ['#c78bff', '#2a1040', '#ffffff'], 260, 0.7, 0, 3.5);
        eng.addShake(5);
        eng.curse = null;
        sfx.fever();
        a.game.ui.toast('저주 발동! 10초 버텨라!');
      }
    }
    if (this.curseState === 2) {
      this.curseT -= dt;
      if (p.dead) this.curseState = 3;
      else if (this.curseT <= 0) {
        this.curseState = 3;
        a.addChest(2);
        eng.addText(p.x, p.y - 60, '저주 극복! 금 상자', '#ffd23f', 22);
        eng.addEffect('ring', p.x, p.y, 140, 0.5, '#ffd23f');
        sfx.levelUp();
      }
    }
  }

  /** 추격: 도망치는 황금 몹 (경기장 밖으로는 못 나간다, 구석에 몰면 잡힌다) */
  protected spawnRunner() {
    const ar = this.eng.arena!;
    const s = 1 + 0.6 * 0.3;
    const e = this.a.spawnMob({
      kind: 'normal', skin: stageSkins(this.a.stage).normal, x: ar.w / 2, y: 80, hp: 420 * s, r: 22, speed: 135, dmg: 0, xp: 30,
      move: 'flee', golden: true, t1: 999,
    });
    this.target = e;
  }

  protected updateRunner() {
    const e = this.target;
    const ar = this.eng.arena;
    if (!e || !ar) return;
    if (!e.active) return;
    e.x = Math.max(e.r, Math.min(ar.w - e.r, e.x));
    e.y = Math.max(e.r, Math.min(ar.h - e.r, e.y));
  }

  protected updateLure(dt: number) {
    const eng = this.eng;
    const l = eng.lure;
    if (!l) return;
    for (const e of eng.queryEnemies(l.x, l.y, l.r + 20)) {
      if (Math.hypot(e.x - l.x, e.y - l.y) > l.r + e.r + 4) continue;
      l.hp -= e.dmg * dt * 0.6;
      if (Math.random() < dt * 6) eng.burst(l.x, l.y - 10, 2, ['#fff6e4', '#f2c14e'], 90, 0.3, 200, 2.5);
    }
    if (l.hp <= 0) {
      l.hp = 0;
      eng.addSprite('star-burst', l.x, l.y, 60, 0.5);
      eng.addShake(8);
      this.a.game.ui.toast('알이 깨졌다…');
      this.a.finish(false);
    }
  }

  /** 보스가 체력 절반 아래로: 분노 (더 빠르게, 알림) */
  protected updateEnrage() {
    if (this.enraged) return;
    const boss = this.eng.boss;
    if (!boss || boss.hp > boss.maxHp * 0.5) return;
    this.enraged = true;
    boss.speed *= 1.35;
    this.eng.addEffect('ring', boss.x, boss.y, 150, 0.6, '#ff4d6d');
    this.eng.addShake(6);
    sfx.fever();
    this.a.game.ui.toast('보스 분노! 더 빨라졌다!');
  }

  /** 처치: 폭주 몹은 주변까지 펑, 추격 목표면 승리. true면 ActionMode가 할 일 끝 */
  onKill(e: Enemy) {
    const a = this.a;
    const eng = this.eng;
    if (e.tint === 'bomb') {
      this.bombs.delete(e);
      eng.explode(e.x, e.y, 80, a.power * 4, 'fire-burst');
      const gold = enemyGold(a.stage) * 8;
      a.bonusGold += gold;
      eng.addText(e.x, e.y - 40, `폭주 몹 처치! +${fmt(gold)} G`, '#ffb347', 18);
    }
    if (e === this.target) {
      this.targetKilledAt = a.time;
      eng.addEffect('ring', e.x, e.y, 160, 0.6, '#ffe066');
      a.winSoon();
      return true;
    }
    if (e.kind === 'boss') {
      this.bossKilledAt = a.time;
      a.winSoon();
      return true;
    }
    return false;
  }

  /** 별: 클리어 · 체력 50% 이상 유지 · 종류별 도전 */
  stars(win: boolean): { got: boolean[]; labels: string[] } {
    let third = false;
    switch (this.variant) {
      case 'normal': third = win && this.bossAt >= 0 && this.bossKilledAt >= 0 && this.bossKilledAt - this.bossAt <= 10; break;
      case 'survive': third = win && this.hits <= 8; break;
      case 'exterminate': third = win && this.goalAt >= 0 && this.goalAt <= 30; break;
      case 'chase': third = win && this.targetKilledAt >= 0 && this.targetKilledAt <= 15; break;
      case 'boar': third = win && this.bossKilledAt >= 0 && this.bossKilledAt <= 40; break;
      case 'defend': third = win && !!this.eng.lure && this.eng.lure.hp / this.eng.lure.maxHp >= 0.6; break;
    }
    return {
      got: [win, win && this.minHp >= 0.5, third],
      labels: ['클리어', '체력 50% 이상 유지', this.def.star3],
    };
  }

  /** 맞은 횟수 세기 (별 조건) */
  countHit() {
    this.hits++;
  }
}
