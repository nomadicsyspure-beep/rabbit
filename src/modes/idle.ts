import { AutoController } from '../battle/controllers';
import type { EnemyKind } from '../battle/engine';
import { DartWeapon, type WeaponStats } from '../battle/weapons';
import { TAP_DAMAGE_MUL, playerStats } from '../data/balance';
import type { Game } from '../game';

// 방치 화면은 보여주기용이다. 수입은 Game이 최고 스테이지 기준으로 따로 계산하고,
// 여기서는 토끼가 알아서 싸우는 모습만 돌린다 (적은 플레이어를 다치게 하지 않는다).

const MAX_ALIVE = 6;
const SPAWN_SEC = 0.7;

export class IdleMode {
  private readonly controller = new AutoController();
  private readonly stats: WeaponStats = { power: 1, aps: 1 };
  private spawnT = 0;
  private lastTap = 0;

  constructor(private readonly game: Game) {}

  enter() {
    const eng = this.game.engine;
    eng.reset();
    eng.bounds = { w: eng.viewW, h: eng.viewH };
    eng.followCamera = false;
    eng.dropGems = false;
    eng.showDamageText = true;
    eng.controller = this.controller;
    eng.weapons = [new DartWeapon(this.stats)];
    eng.onKill = (e) => eng.addEffect('burst', e.x, e.y, 14, 0.35, '#ffd166');
    eng.onGem = null;
    eng.onPlayerDead = null;

    const p = eng.player;
    p.x = eng.viewW / 2;
    p.y = eng.viewH / 2;
    p.speed = 90;
    p.regen = 0;
    p.magnet = 0;
    this.refreshStats();
    p.hp = p.maxHp;
    this.spawnT = 0.3;
  }

  resize(w: number, h: number) {
    this.game.engine.bounds = { w, h };
  }

  /** 강화 후 호출: 공격력·공격 속도를 화면에 반영 */
  refreshStats() {
    const st = playerStats(this.game.save.levels);
    this.stats.power = st.atk;
    this.stats.aps = st.aps;
    const p = this.game.engine.player;
    p.maxHp = p.hp = st.hp;
  }

  update(dt: number) {
    const eng = this.game.engine;
    this.spawnT -= dt;
    if (this.spawnT <= 0 && eng.enemies.countActive() < MAX_ALIVE) {
      this.spawnT = SPAWN_SEC;
      this.spawn();
    }
  }

  private spawn() {
    const eng = this.game.engine;
    const w = eng.viewW;
    const h = eng.viewH;
    const side = Math.floor(Math.random() * 4);
    const t = Math.random();
    const x = side === 0 ? -14 : side === 1 ? w + 14 : t * w;
    const y = side === 2 ? -14 : side === 3 ? h + 14 : t * h;

    const roll = Math.random();
    const kind: EnemyKind = roll < 0.15 ? 'tank' : roll < 0.4 ? 'fast' : 'normal';
    // 체력은 내 공격력 기준 몇 대 맞으면 쓰러지게: 강해질수록 숫자만 커진다
    const hits = kind === 'tank' ? 5 : kind === 'fast' ? 1.5 : 2.5;
    const hp = this.stats.power * hits;
    const r = kind === 'tank' ? 13 : kind === 'fast' ? 10 : 11;
    const speed = kind === 'tank' ? 18 : kind === 'fast' ? 46 : 28;
    eng.spawnEnemy({ kind, x, y, hp, r, speed, dmg: 0 });
  }

  /** 화면 탭: 탭한 곳 근처 적(없으면 가장 가까운 적)에게 추가 피해 */
  tap(x: number, y: number) {
    const eng = this.game.engine;
    const now = performance.now();
    if (now - this.lastTap < 50) return;
    this.lastTap = now;
    eng.addEffect('burst', x, y, 16, 0.2, '#ffd166');
    const target = eng.nearestEnemies(x, y, 1, 70)[0] ?? eng.nearestEnemies(eng.player.x, eng.player.y, 1, Infinity)[0];
    if (target) eng.damageEnemy(target, this.stats.power * TAP_DAMAGE_MUL);
  }
}
