import { sfx } from '../audio/sfx';
import type { Enemy, Engine } from '../battle/engine';

// 아레나 보스전: 태엽 멧돼지. 빠르고 아프다. 대신 틈이 있다.
//  - 평소엔 5~8초쯤 경기장을 어슬렁거리다가, 갑자기 조준(빨간 길 표시) → 빠른 돌진을 1~2번(분노 2~3번)
//  - 울타리에 부딪히면 잠깐 멈칫 + 톱니 사방 발사
//  - 돌기둥에 정면으로 박으면 기절 2.2초: 받는 피해 2.5배 (스치면 미끄러져 계속 달린다)
//  - 돌진 3번(분노 4번)마다 태엽이 풀려 2.8초 멈춤: 받는 피해 2배 → 다시 감으며 톱니 나선 탄막
//  - 체력 절반 아래: 분노 (더 빠른 조준·돌진, 울타리에 한 번 튕겨 다시 노림)

type Phase = 'intro' | 'roam' | 'aim' | 'charge' | 'recover' | 'stun' | 'unwound' | 'rewind';

const AIM = 0.62;
const AIM_RAGE = 0.42;
const CHARGE_SPEED = 640;
const CHARGE_SPEED_RAGE = 790;
/** 어슬렁: 최소 시간 + 랜덤 */
const ROAM_MIN = 5;
const ROAM_RAND = 3;
const ROAM_RAND_RAGE = 1.5;
const ROAM_SPEED = 95;
const ROAM_SPEED_RAGE = 130;
/** 돌기둥 중심이 돌진 선에서 이만큼(돌 반지름 배수) 안쪽이면 정면 충돌 → 기절 */
const SQUARE_HIT = 0.5;
const STUN = 2.2;
const UNWOUND = 2.8;

export class BoarBrain {
  private phase: Phase = 'intro';
  private t = 0;
  private dx = 0;
  private dy = 1;
  private charges = 0;
  /** 이번 돌진 묶음에서 남은 돌진 수 */
  private combo = 0;
  private wx = 0;
  private wy = 0;
  private wpT = 0;
  private bounced = false;
  private rage = false;
  private gearT = 0;
  private spin = 0;
  /** 돌진 피해 / 평소 몸통 피해 */
  private hitDmg = 1;
  private bodyDmg = 1;

  constructor(private readonly eng: Engine, private readonly boss: Enemy, private readonly toast: (msg: string) => void) {
    this.bodyDmg = boss.dmg;
    this.hitDmg = boss.dmg * 1.6;
    this.t = 1.4;
    boss.dashX = 0;
    boss.dashY = 1;
  }

  update(dt: number) {
    const e = this.boss;
    const eng = this.eng;
    if (!e.active) return;
    const p = eng.player;
    const ar = eng.arena!;
    if (!this.rage && e.hp < e.maxHp * 0.5) {
      this.rage = true;
      this.toast('🐗 태엽 멧돼지 분노! 더 빨라졌다!');
      eng.addEffect('ring', e.x, e.y, 170, 0.6, '#ff4d4d');
      eng.addShake(7);
      sfx.fever();
    }
    this.t -= dt;
    const face = (x: number, y: number) => {
      const d = Math.hypot(x, y) || 1;
      e.dashX = x / d;
      e.dashY = y / d;
    };
    switch (this.phase) {
      case 'intro':
        // 위에서 걸어 들어온다
        e.y += 120 * dt;
        face(0, 1);
        if (this.t <= 0) this.startRoam();
        break;
      case 'roam': {
        // 경기장을 어슬렁: 아무 데나 골라 걸어가고, 닿으면 다음 자리
        const mx = this.wx - e.x;
        const my = this.wy - e.y;
        const md = Math.hypot(mx, my);
        this.wpT -= dt;
        if (md < 20 || this.wpT <= 0) this.pickWaypoint();
        else {
          e.x += (mx / md) * e.speed * dt;
          e.y += (my / md) * e.speed * dt;
          face(mx, my);
        }
        if (this.t <= 0) {
          this.combo = this.rage ? 2 + (Math.random() < 0.4 ? 1 : 0) : 1 + (Math.random() < 0.45 ? 1 : 0);
          this.startAim();
        }
        break;
      }
      case 'aim': {
        // 병아리를 노리며 발을 구른다 (조준선은 시작할 때 한 번 그린다)
        face(p.x - e.x, p.y - e.y);
        e.x += (Math.random() - 0.5) * 3;
        if (Math.random() < 0.4) eng.burst(e.x - e.dashX * e.r, e.y + e.r * 0.6, 1, ['#a07850', '#d8c0a0'], 80, 0.4, 0, 3);
        if (this.t <= 0) {
          this.dx = e.dashX;
          this.dy = e.dashY;
          this.phase = 'charge';
          this.bounced = false;
          e.speed = this.rage ? CHARGE_SPEED_RAGE : CHARGE_SPEED;
          e.dmg = this.hitDmg;
          sfx.boom();
        }
        break;
      }
      case 'charge': {
        e.x += this.dx * e.speed * dt;
        e.y += this.dy * e.speed * dt;
        face(this.dx, this.dy);
        if (Math.random() < 0.8) eng.burst(e.x - this.dx * e.r, e.y + e.r * 0.7, 2, ['#a07850', '#d8c0a0'], 120, 0.4, 0, 3.5);
        // 돌기둥: 정면으로 박으면 기절, 스치면 옆으로 미끄러져 계속 달린다
        for (const rk of eng.rocks) {
          const rx = e.x - rk.x;
          const ry = e.y - rk.y;
          const rd = Math.hypot(rx, ry) || 1;
          const min = rk.r + e.r * 0.8;
          if (rd >= min) continue;
          const off = Math.abs(rx * this.dy - ry * this.dx);
          if (off < rk.r * SQUARE_HIT) {
            e.x = rk.x - this.dx * (rk.r + e.r * 0.85);
            e.y = rk.y - this.dy * (rk.r + e.r * 0.85);
            this.startStun();
            return;
          }
          e.x = rk.x + (rx / rd) * min;
          e.y = rk.y + (ry / rd) * min;
        }
        // 울타리
        const hitX = e.x < e.r || e.x > ar.w - e.r;
        const hitY = e.y < e.r || e.y > ar.h - e.r;
        if (hitX || hitY) {
          e.x = Math.max(e.r, Math.min(ar.w - e.r, e.x));
          e.y = Math.max(e.r, Math.min(ar.h - e.r, e.y));
          eng.addShake(5);
          eng.addEffect('ring', e.x, e.y, 70, 0.3, '#ffb347');
          this.ring(10, 230, 0);
          if (this.rage && !this.bounced) {
            // 분노: 한 번 튕겨서 곧바로 다시 노린다
            this.bounced = true;
            const tx = p.x - e.x;
            const ty = p.y - e.y;
            const d = Math.hypot(tx, ty) || 1;
            this.dx = tx / d;
            this.dy = ty / d;
            eng.warns.push({ x1: e.x, y1: e.y, x2: e.x + this.dx * 1400, y2: e.y + this.dy * 1400, w: e.r * 1.4, t: 0.22, maxT: 0.22, color: '#ff3b3b' });
            return;
          }
          this.phase = 'recover';
          this.t = 0.55;
          e.speed = 0;
          e.dmg = this.bodyDmg;
          this.charges++;
          this.combo--;
        }
        break;
      }
      case 'recover':
        face(p.x - e.x, p.y - e.y);
        if (this.t <= 0) this.next();
        break;
      case 'stun':
        e.stunT = this.t;
        if (this.t <= 0) {
          e.dmgTaken = 1;
          e.stunT = 0;
          e.dmg = this.bodyDmg;
          this.charges++;
          this.combo = 0;
          this.next();
        }
        break;
      case 'unwound':
        // 태엽이 풀려 털썩: 약점
        if (Math.random() < 0.15) eng.burst(e.x, e.y - e.r * 1.6, 1, ['#ffd23f', '#b07a40'], 60, 0.5, -40, 3);
        if (this.t <= 0) {
          this.phase = 'rewind';
          this.t = 1.1;
          e.dmgTaken = 1;
          e.dmg = this.bodyDmg;
          this.gearT = 0;
          this.spin = Math.random() * Math.PI * 2;
          this.toast('끼릭끼릭… 태엽을 다시 감는다! 톱니를 피해라');
        }
        break;
      case 'rewind':
        // 태엽을 감으며 나선으로 톱니를 뿌린다
        this.gearT -= dt;
        while (this.gearT <= 0) {
          this.gearT += this.rage ? 0.05 : 0.07;
          this.spin += 0.55;
          for (let k = 0; k < (this.rage ? 3 : 2); k++) eng.fireBullet(e.x, e.y - 10, this.spin + (k / (this.rage ? 3 : 2)) * Math.PI * 2, 190, this.bodyDmg * 0.35);
        }
        if (this.t <= 0) {
          this.charges = 0;
          this.startRoam();
        }
        break;
    }
  }

  /** 돌진이 끝난 뒤: 태엽 풀림 → 남은 돌진 → 어슬렁 */
  private next() {
    if (this.charges >= (this.rage ? 4 : 3)) this.startUnwound();
    else if (this.combo > 0) this.startAim();
    else this.startRoam();
  }

  private startRoam() {
    const e = this.boss;
    this.phase = 'roam';
    this.t = ROAM_MIN + Math.random() * (this.rage ? ROAM_RAND_RAGE : ROAM_RAND);
    e.speed = this.rage ? ROAM_SPEED_RAGE : ROAM_SPEED;
    e.dmg = this.bodyDmg;
    this.pickWaypoint();
  }

  /** 어슬렁 목적지: 울타리 안쪽, 돌기둥 위는 피한다 */
  private pickWaypoint() {
    const ar = this.eng.arena!;
    const m = 70;
    this.wpT = 2.5;
    for (let i = 0; i < 8; i++) {
      const x = m + Math.random() * (ar.w - m * 2);
      const y = m + Math.random() * (ar.h - m * 2);
      if (this.eng.rocks.every((rk) => Math.hypot(x - rk.x, y - rk.y) > rk.r + 50)) {
        this.wx = x;
        this.wy = y;
        return;
      }
    }
    this.wx = ar.w / 2;
    this.wy = ar.h / 2;
  }

  private startAim() {
    const e = this.boss;
    const p = this.eng.player;
    this.phase = 'aim';
    this.t = this.rage ? AIM_RAGE : AIM;
    e.speed = 0;
    e.dmg = this.bodyDmg;
    // 조준선: 병아리 쪽으로 경기장 끝까지
    const tx = p.x - e.x;
    const ty = p.y - e.y;
    const d = Math.hypot(tx, ty) || 1;
    e.dashX = tx / d;
    e.dashY = ty / d;
    this.eng.warns.push({ x1: e.x, y1: e.y, x2: e.x + (tx / d) * 1400, y2: e.y + (ty / d) * 1400, w: e.r * 1.4, t: this.t, maxT: this.t, color: '#ff3b3b' });
  }

  private startStun() {
    const e = this.boss;
    const eng = this.eng;
    this.phase = 'stun';
    this.t = STUN;
    e.speed = 0;
    e.dmg = this.bodyDmg * 0.3;
    e.dmgTaken = 2.5;
    eng.addShake(9);
    eng.addSprite('star-burst', e.x, e.y - e.r, 70, 0.4);
    eng.burst(e.x, e.y - e.r, 24, ['#9a8f84', '#5c5048', '#ffe066'], 300, 0.6, 400, 4);
    eng.addText(e.x, e.y - e.r * 2.4, '쾅! 기절 · 약점 ×2.5', '#ffe066', 20);
    sfx.boom();
    this.toast('돌기둥에 박았다! 지금 때려라!');
  }

  private startUnwound() {
    const e = this.boss;
    this.phase = 'unwound';
    this.t = UNWOUND;
    e.speed = 0;
    e.dmg = this.bodyDmg * 0.3;
    e.dmgTaken = 2;
    this.eng.addText(e.x, e.y - e.r * 2.4, '태엽이 풀렸다! 약점 ×2', '#ffd23f', 20);
    this.toast('태엽이 풀렸다! 약점 노출');
  }

  /** 톱니 사방 발사 */
  private ring(n: number, speed: number, off: number) {
    const e = this.boss;
    for (let i = 0; i < n; i++) this.eng.fireBullet(e.x, e.y - 10, off + (i / n) * Math.PI * 2, speed, this.bodyDmg * 0.35);
  }
}
