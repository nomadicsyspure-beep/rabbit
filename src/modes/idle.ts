import { AutoController } from '../battle/controllers';
import type { EnemyKind } from '../battle/engine';
import { FeatherWeapon, type WeaponStats } from '../battle/weapons';
import { TAP_DAMAGE_MUL, playerStats, stageSkins } from '../data/balance';
import type { Game } from '../game';

// 방치 화면은 보여주기용이다. 수입은 Game이 최고 스테이지 기준으로 따로 계산하고,
// 여기서는 병아리가 알아서 싸우는 모습만 돌린다 (적은 플레이어를 다치게 하지 않는다).

const MAX_ALIVE = 7;
const SPAWN_SEC = 0.35;
/** 깃털 사거리를 짧게 해서 몹이 조금 걸어 들어온 뒤에 쓰러지게 한다 */
const FEATHER_RANGE = 120;

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
    eng.weapons = [new FeatherWeapon(this.stats, 1, FEATHER_RANGE)];
    eng.onKill = null;
    eng.onGem = null;
    eng.onPlayerDead = null;

    const p = eng.player;
    p.x = eng.viewW / 2;
    p.y = eng.viewH / 2;
    p.speed = 120;
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
    const save = this.game.save;
    const st = playerStats(save.levels, save.level);
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
    const kind: Exclude<EnemyKind, 'boss'> = roll < 0.15 ? 'tank' : roll < 0.4 ? 'fast' : 'normal';
    // 깃털 한 방(탭도 한 번)이면 쓰러진다. 숫자는 내 공격력만큼 커진다
    const hp = this.stats.power * TAP_DAMAGE_MUL;
    const r = kind === 'tank' ? 13 : kind === 'fast' ? 10 : 11;
    const speed = kind === 'tank' ? 26 : kind === 'fast' ? 64 : 40;
    // 다음에 도전할 스테이지의 몬스터가 나온다
    const skin = stageSkins(this.game.nextStage)[kind];
    eng.spawnEnemy({ kind, skin, x, y, hp, r, speed, dmg: 0 });
  }

  /** 화면 탭: 탭한 곳 근처 적(없으면 가장 가까운 적)에게 추가 피해 */
  tap(x: number, y: number) {
    const eng = this.game.engine;
    const now = performance.now();
    if (now - this.lastTap < 50) return;
    this.lastTap = now;
    eng.addSprite('sparkle', x, y, 12, 0.25);
    const target = eng.nearestEnemies(x, y, 1, 70)[0] ?? eng.nearestEnemies(eng.player.x, eng.player.y, 1, Infinity)[0];
    if (target) eng.damageEnemy(target, this.stats.power * TAP_DAMAGE_MUL);
  }
}
