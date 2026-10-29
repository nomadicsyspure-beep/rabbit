import { enemyColor, type Effect, type Engine, type Enemy } from './engine';
import type { Joystick } from './controllers';
import { gifFrameAt } from './gif';
import { HERO_ANIM_SPEED, HERO_FOOT, HERO_SIZE, SPRITES, heroDirIndex, isReady } from './sprites';

// 렌더러. 캐릭터는 스프라이트로 그리고, 이미지가 아직 안 불러와졌으면 도형으로 대신 그린다.

/** 쓰러진 토끼 스프라이트 높이 */
const DOWN_SPRITE_H = 36;
/** 적 반지름 대비 스프라이트 높이 */
const ENEMY_SPRITE_SCALE = 2.6;

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private dpr = 1;
  /** 지금 보여주는 8방향 인덱스. 경계에서 그림이 깜빡이지 않게 여유를 두고 바꾼다. */
  private heroDir = 2;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d not supported');
    this.ctx = ctx;
  }

  resize(w: number, h: number) {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
  }

  draw(eng: Engine, joystick: Joystick | null) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawBackground(eng);

    ctx.save();
    ctx.translate(-eng.camX, -eng.camY);

    for (const g of eng.gems.items) {
      if (!g.active) continue;
      const s = g.value >= 3 ? 5 : 3.5;
      ctx.fillStyle = g.value >= 3 ? '#7cf2a0' : '#4fd1c5';
      ctx.beginPath();
      ctx.moveTo(g.x, g.y - s);
      ctx.lineTo(g.x + s, g.y);
      ctx.lineTo(g.x, g.y + s);
      ctx.lineTo(g.x - s, g.y);
      ctx.fill();
    }

    for (const fx of eng.effects.items) {
      if (fx.active && fx.kind === 'telegraph') this.drawEffect(fx);
    }

    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (const e of eng.enemies.items) {
      if (!e.active) continue;
      ctx.beginPath();
      ctx.ellipse(e.x, e.y + e.r * 0.9, e.r * 0.9, e.r * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const e of eng.enemies.items) if (e.active) this.drawEnemy(eng, e);

    ctx.fillStyle = '#ff7aa8';
    for (const b of eng.bullets.items) {
      if (!b.active) continue;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const pr of eng.projectiles.items) if (pr.active) this.drawCarrot(pr.x, pr.y, Math.atan2(pr.vy, pr.vx));

    ctx.fillStyle = '#6fdc8c';
    for (const o of eng.orbs) {
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      ctx.fill();
    }

    this.drawPlayer(eng);

    for (const fx of eng.effects.items) {
      if (fx.active && fx.kind !== 'telegraph') this.drawEffect(fx);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of eng.texts.items) {
      if (!t.active) continue;
      ctx.globalAlpha = Math.min(1, t.life / t.maxLife * 2);
      ctx.font = `bold ${t.size}px system-ui, sans-serif`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    const boss = eng.boss;
    if (boss && eng.followCamera) this.drawBossBar(eng, boss);
    if (joystick?.active) this.drawJoystick(joystick);
  }

  private drawBackground(eng: Engine) {
    const ctx = this.ctx;
    const w = eng.viewW;
    const h = eng.viewH;
    ctx.fillStyle = '#07080c';
    ctx.fillRect(0, 0, w, h);
    if (!eng.followCamera) return;

    // 액션 모드: 움직이는 게 보이게 아주 옅은 격자
    const size = 48;
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const ox = -((eng.camX % size) + size) % size;
    const oy = -((eng.camY % size) + size) % size;
    for (let x = ox; x < w; x += size) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, h);
    }
    for (let y = oy; y < h; y += size) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
    }
    ctx.stroke();
  }

  /** 발이 (x, footY)에 닿게 스프라이트를 그린다. flash > 0이면 하얗게 번쩍인다. */
  private drawSprite(img: HTMLImageElement, x: number, footY: number, height: number, flip: boolean, flash: number) {
    const ctx = this.ctx;
    const width = (height * img.naturalWidth) / img.naturalHeight;
    ctx.save();
    ctx.translate(x, footY);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img, -width / 2, -height, width, height);
    if (flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha *= 0.6;
      ctx.drawImage(img, -width / 2, -height, width, height);
    }
    ctx.restore();
  }

  private drawEnemy(eng: Engine, e: Enemy) {
    const img = SPRITES[e.skin];
    if (isReady(img)) {
      this.drawSprite(img, e.x, e.y + e.r, e.r * ENEMY_SPRITE_SCALE, false, e.flash);
    } else {
      this.drawEnemyShape(eng, e);
    }
    const top = isReady(img) ? e.y + e.r - e.r * ENEMY_SPRITE_SCALE : e.y - e.r;
    const showBar = !eng.followCamera || (e.kind === 'tank' && e.hp < e.maxHp);
    if (showBar && e.kind !== 'boss') {
      const bw = Math.max(18, e.r * 2);
      this.bar(e.x - bw / 2, top - 6, bw, 3, e.hp / e.maxHp, '#ff5c6c');
    }
  }

  private drawEnemyShape(eng: Engine, e: Enemy) {
    const ctx = this.ctx;
    ctx.fillStyle = e.flash > 0 ? '#ffffff' : enemyColor(e.kind);
    const r = e.r;
    if (e.kind === 'fast') {
      const a = Math.atan2(eng.player.y - e.y, eng.player.x - e.x);
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const t = a + (i * Math.PI * 2) / 3;
        const rr = i === 0 ? r * 1.25 : r;
        ctx.lineTo(e.x + Math.cos(t) * rr, e.y + Math.sin(t) * rr);
      }
      ctx.closePath();
      ctx.fill();
    } else if (e.kind === 'tank') {
      ctx.fillRect(e.x - r, e.y - r, r * 2, r * 2);
    } else {
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
      ctx.fill();
      if (e.kind === 'boss') {
        ctx.strokeStyle = '#ffd0e0';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }

    // 눈 (적이 플레이어를 바라본다)
    const a = Math.atan2(eng.player.y - e.y, eng.player.x - e.x);
    const ex = Math.cos(a) * r * 0.3;
    const ey = Math.sin(a) * r * 0.3;
    ctx.fillStyle = '#1b2233';
    const er = Math.max(1.5, r * 0.14);
    ctx.beginPath();
    ctx.arc(e.x + ex - r * 0.28, e.y + ey - r * 0.1, er, 0, Math.PI * 2);
    ctx.arc(e.x + ex + r * 0.28, e.y + ey - r * 0.1, er, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawPlayer(eng: Engine) {
    const ctx = this.ctx;
    const p = eng.player;

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + p.r, p.r, p.r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    const footY = p.y + p.r + 2;
    if (p.dead) {
      if (isReady(SPRITES.rabbitDown)) this.drawSprite(SPRITES.rabbitDown, p.x, footY, DOWN_SPRITE_H, p.faceX < 0, 0);
      return;
    }

    // 이동 중: 그 방향 GIF 재생 / 멈춤: 그 방향 PNG
    const dir = this.updateHeroDir(p.faceX, p.faceY);
    const walk = p.moving ? SPRITES.heroWalk[dir] : null;
    const still = SPRITES.heroDirs[dir];
    let img: CanvasImageSource;
    let hop = 0;
    if (walk) {
      img = gifFrameAt(walk, eng.time * 1000 * HERO_ANIM_SPEED);
    } else if (isReady(still)) {
      img = still;
      // GIF를 아직 못 불러왔으면 PNG를 통통 튀게 해서 걷는 티를 낸다
      if (p.moving) hop = Math.abs(Math.sin(eng.time * 11)) * 4;
    } else {
      return this.drawPlayerShape(eng);
    }

    const blink = p.invuln > 0 && Math.floor(eng.time * 20) % 2 === 0;
    const left = p.x - HERO_SIZE / 2;
    const top = footY - hop - HERO_SIZE * HERO_FOOT;
    ctx.save();
    ctx.globalAlpha = blink ? 0.55 : 1;
    ctx.drawImage(img, left, top, HERO_SIZE, HERO_SIZE);
    if (p.flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha *= 0.6;
      ctx.drawImage(img, left, top, HERO_SIZE, HERO_SIZE);
    }
    ctx.restore();
    this.bar(p.x - 15, p.y + p.r + 5, 30, 4, p.hp / p.maxHp, '#6fdc8c');
  }

  private updateHeroDir(fx: number, fy: number) {
    const a = Math.atan2(fy, fx);
    const center = (this.heroDir * Math.PI) / 4;
    let diff = Math.abs(a - center) % (Math.PI * 2);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    // 칸 경계(22.5°)를 10° 넘게 지나야 다음 방향으로 바꾼다
    if (diff > Math.PI / 8 + 0.17) this.heroDir = heroDirIndex(fx, fy);
    return this.heroDir;
  }

  private drawPlayerShape(eng: Engine) {
    const ctx = this.ctx;
    const p = eng.player;
    const blink = p.invuln > 0 && Math.floor(eng.time * 20) % 2 === 0;
    ctx.globalAlpha = blink ? 0.5 : 1;

    const body = p.flash > 0 ? '#ff9a9a' : '#fbe9dc';
    // 귀 두 개
    ctx.fillStyle = body;
    const earTilt = p.faceX * 0.25;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(p.x + side * p.r * 0.45, p.y - p.r * 1.05, p.r * 0.3, p.r * 0.75, side * 0.25 + earTilt, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#f4a6b8';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(p.x + side * p.r * 0.45, p.y - p.r * 1.02, p.r * 0.13, p.r * 0.5, side * 0.25 + earTilt, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();

    // 바라보는 방향 표시 (코)
    ctx.fillStyle = '#4a7bd6';
    ctx.beginPath();
    ctx.arc(p.x + p.faceX * p.r * 0.55, p.y + p.faceY * p.r * 0.55 - 1, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    this.bar(p.x - 15, p.y + p.r + 5, 30, 4, p.hp / p.maxHp, '#6fdc8c');
  }

  /** 당근 다트: 진행 방향을 향한 주황 삼각형 + 초록 잎 */
  private drawCarrot(x: number, y: number, angle: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = '#ff9a3c';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -3.2);
    ctx.lineTo(-5, 3.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#6fdc8c';
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.lineTo(-9, -3);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-9, 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawEffect(fx: Effect) {
    const ctx = this.ctx;
    const t = fx.life / fx.maxLife; // 1 → 0
    ctx.globalAlpha = Math.max(0, t);
    ctx.strokeStyle = fx.color;
    ctx.fillStyle = fx.color;
    switch (fx.kind) {
      case 'ring':
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, fx.r * (1 - t * 0.6), 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'burst':
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, fx.r * (1 - t * 0.7), 0, Math.PI * 2);
        ctx.globalAlpha = t * 0.5;
        ctx.fill();
        break;
      case 'bolt': {
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(fx.x, fx.y);
        const segs = 5;
        for (let i = 1; i < segs; i++) {
          const k = i / segs;
          ctx.lineTo(fx.x + (fx.x2 - fx.x) * k + (Math.random() - 0.5) * 12, fx.y + (fx.y2 - fx.y) * k + (Math.random() - 0.5) * 12);
        }
        ctx.lineTo(fx.x2, fx.y2);
        ctx.stroke();
        break;
      }
      case 'telegraph':
        ctx.globalAlpha = 0.35 + 0.35 * Math.sin(fx.life * 30);
        ctx.lineWidth = fx.r * 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(fx.x, fx.y);
        ctx.lineTo(fx.x2, fx.y2);
        ctx.stroke();
        ctx.lineCap = 'butt';
        break;
    }
    ctx.globalAlpha = 1;
  }

  private drawBossBar(eng: Engine, boss: Enemy) {
    // 상단 HUD(경험치·타이머) 바로 아래
    this.bar(24, 92, eng.viewW - 48, 8, boss.hp / boss.maxHp, '#d04070');
  }

  private drawJoystick(j: Joystick) {
    const ctx = this.ctx;
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(j.ox, j.oy, j.radius, 0, Math.PI * 2);
    ctx.fill();
    const dx = j.x - j.ox;
    const dy = j.y - j.oy;
    const d = Math.hypot(dx, dy);
    const k = d > j.radius ? j.radius / d : 1;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(j.ox + dx * k, j.oy + dy * k, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  private bar(x: number, y: number, w: number, h: number, ratio: number, color: string) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * Math.max(0, Math.min(1, ratio)), h);
  }
}
