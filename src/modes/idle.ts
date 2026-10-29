import { AutoController } from '../battle/controllers';
import type { Enemy, EnemyKind } from '../battle/engine';
import { DartWeapon, type WeaponStats } from '../battle/weapons';
import { fmt } from '../core/format';
import {
  IDLE_REGEN, KILLS_PER_STAGE, TAP_DAMAGE_MUL, enemyDmg, enemyGold, enemyHp, isBossStage, playerStats,
} from '../data/balance';
import type { Game } from '../game';

const RESPAWN_SEC = 2;

export class IdleMode {
  private readonly controller = new AutoController();
  private readonly stats: WeaponStats = { power: 1, aps: 1 };
  private spawnT = 0;
  private respawnT = 0;
  private lastTap = 0;

  constructor(private readonly game: Game) {}

  /** 보스 스테이지에 막혀 있으면 바로 전 스테이지를 계속 돈다. */
  get farmStage() {
    const s = this.game.save.stage;
    return isBossStage(s) ? s - 1 : s;
  }

  enter() {
    const eng = this.game.engine;
    eng.reset();
    eng.bounds = { w: eng.viewW, h: eng.viewH };
    eng.followCamera = false;
    eng.dropGems = false;
    eng.showDamageText = true;
    eng.controller = this.controller;
    eng.weapons = [new DartWeapon(this.stats)];
    eng.onKill = (e) => this.onKill(e);
    eng.onGem = null;
    eng.onPlayerDead = () => {
      this.respawnT = RESPAWN_SEC;
      this.game.ui.toast('쓰러졌어요! 체력을 강화해 보세요');
    };

    const p = eng.player;
    p.x = eng.viewW / 2;
    p.y = eng.viewH / 2;
    p.speed = 90;
    p.regen = IDLE_REGEN;
    p.magnet = 0;
    this.refreshStats();
    p.hp = p.maxHp;
    this.spawnT = 0.3;
  }

  resize(w: number, h: number) {
    const eng = this.game.engine;
    eng.bounds = { w, h };
  }

  /** 강화 후 호출: 수치를 엔진에 반영 */
  refreshStats() {
    const st = playerStats(this.game.save.levels);
    this.stats.power = st.atk;
    this.stats.aps = st.aps;
    const p = this.game.engine.player;
    const ratio = p.maxHp > 0 ? p.hp / p.maxHp : 1;
    p.maxHp = st.hp;
    p.hp = Math.min(p.maxHp, Math.max(ratio, 0) * p.maxHp);
  }

  update(dt: number) {
    const eng = this.game.engine;
    const p = eng.player;

    if (p.dead) {
      this.respawnT -= dt;
      if (this.respawnT <= 0) {
        eng.enemies.clear();
        eng.bullets.clear();
        p.dead = false;
        p.hp = p.maxHp;
        p.x = eng.viewW / 2;
        p.y = eng.viewH / 2;
        this.game.save.kills = 0;
      }
      return;
    }

    const stage = this.farmStage;
    const maxAlive = Math.min(4 + Math.floor(stage / 5), 7);
    this.spawnT -= dt;
    if (this.spawnT <= 0 && eng.enemies.countActive() < maxAlive) {
      this.spawnT = 0.6;
      this.spawn(stage);
    }
  }

  private spawn(stage: number) {
    const eng = this.game.engine;
    const w = eng.viewW;
    const h = eng.viewH;
    const side = Math.floor(Math.random() * 4);
    const t = Math.random();
    const x = side === 0 ? -12 : side === 1 ? w + 12 : t * w;
    const y = side === 2 ? -12 : side === 3 ? h + 12 : t * h;

    const roll = Math.random();
    let kind: EnemyKind = 'normal';
    if (stage >= 4 && roll < Math.min(0.2, stage * 0.01)) kind = 'tank';
    else if (stage >= 2 && roll > 0.8) kind = 'fast';

    const hp = enemyHp(stage);
    const dmg = enemyDmg(stage);
    const gold = enemyGold(stage);
    switch (kind) {
      case 'normal':
        eng.spawnEnemy({ kind, x, y, hp, dmg, gold, r: 10, speed: 28 });
        break;
      case 'fast':
        eng.spawnEnemy({ kind, x, y, hp: hp * 0.6, dmg, gold: gold * 0.8, r: 9, speed: 48 });
        break;
      case 'tank':
        eng.spawnEnemy({ kind, x, y, hp: hp * 2.5, dmg: dmg * 1.5, gold: gold * 2.5, r: 13, speed: 18 });
        break;
    }
  }

  private onKill(e: Enemy) {
    const save = this.game.save;
    save.gold += e.gold;
    this.game.engine.addText(e.x, e.y - 14, '+' + fmt(e.gold), '#ffd166', 12);
    if (isBossStage(save.stage)) return;
    save.kills++;
    if (save.kills >= KILLS_PER_STAGE) {
      save.stage++;
      save.kills = 0;
      if (isBossStage(save.stage)) this.game.ui.toast(`스테이지 ${save.stage} 보스 등장! 직접 도전하세요`);
    }
  }

  /** 화면 탭: 탭한 곳 근처 적(없으면 가장 가까운 적)에게 추가 피해 */
  tap(x: number, y: number) {
    const eng = this.game.engine;
    if (eng.player.dead) return;
    const now = performance.now();
    if (now - this.lastTap < 50) return;
    this.lastTap = now;
    eng.addEffect('burst', x, y, 16, 0.2, '#ffd166');
    const target = eng.nearestEnemies(x, y, 1, 70)[0] ?? eng.nearestEnemies(eng.player.x, eng.player.y, 1, Infinity)[0];
    if (target) eng.damageEnemy(target, this.stats.power * TAP_DAMAGE_MUL);
  }
}
