import { enemyColor, type Effect, type Engine, type Enemy } from './engine';
import type { Joystick } from './controllers';

// 임시 도형으로 그리는 렌더러. 나중에 스프라이트를 넣을 땐 이 파일만 바꾸면 된다.

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private dpr = 1;

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

    ctx.fillStyle = '#ffd166';
    for (const pr of eng.projectiles.items) {
      if (!pr.active) continue;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2);
      ctx.fill();
    }

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
    ctx.fillStyle = '#1b2233';
    ctx.fillRect(0, 0, w, h);

    const size = 48;
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
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

    // 가장자리 어둡게
    const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  private drawEnemy(eng: Engine, e: Enemy) {
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

    const showBar = !eng.followCamera || ((e.kind === 'tank') && e.hp < e.maxHp);
    if (showBar && e.kind !== 'boss') {
      const bw = Math.max(18, r * 2);
      this.bar(e.x - bw / 2, e.y - r - 8, bw, 3, e.hp / e.maxHp, '#ff5c6c');
    }
  }

  private drawPlayer(eng: Engine) {
    const ctx = this.ctx;
    const p = eng.player;
    if (p.dead) return;
    const blink = p.invuln > 0 && Math.floor(eng.time * 20) % 2 === 0;
    ctx.globalAlpha = blink ? 0.5 : 1;

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + p.r, p.r, p.r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

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
