import { enemyColor, type Effect, type Engine, type Enemy, type Projectile, type Zone } from './engine';
import type { Joystick } from './controllers';
import { frameAt } from './anim';
import { CHEST_COLORS, CHEST_ICONS } from '../data/items';
import { HERO_FOOT, HERO_SIZE, SPRITES, heroDirIndex, isReady } from './sprites';
import { hueRecolor, recolored, type Recolor } from './tint';
import { drawOutfitBehind, drawOutfitFront } from './outfit';
import { FX } from './weapons';
import { CHICK_SKIN_BY_ID, FX_SKIN_BY_ID, skinRecolor } from '../data/shop';

type Pic = HTMLImageElement | HTMLCanvasElement;
/** 그림의 세로/가로 비율 */
const aspect = (img: Pic) => (img instanceof HTMLImageElement ? img.naturalHeight / img.naturalWidth : img.height / img.width);
/** 동료 그림 크기 */
const PET_SIZE = 26;
/** 몹 색: 황금 몹, 웨이브 몹(돌진 빨강 / 포위 보라 / 벽 남색) */
const GOLDEN_COLOR: Recolor = { shift: 0, sat: 1.6, light: 1.25, set: 46 };
/** 웨이브 몹은 몸 색 대신 발밑 원 테두리 색으로 구분한다 */
const TINT_RINGS: Record<string, string> = { charge: '#ff3b3b', ring: '#b05cff', wall: '#4f8cff' };
/** 몹 그림 채도를 조금 낮춘다 (눈이 덜 피곤하게) */
const MOB_COLOR: Recolor = { shift: 0, sat: 0.8, light: 0.97 };

// 렌더러. 캐릭터는 스프라이트로 그리고, 이미지가 아직 안 불러와졌으면 도형으로 대신 그린다.

/** 출발해서 가속하다 지금 속도가 최고 속도의 이 비율을 넘으면 달리기 그림 (방치 화면은 천천히 걸어서 안 넘는다) */
const RUN_RATIO = 0.8;
/** 적 반지름 대비 스프라이트(정사각형 칸) 높이 */
const ENEMY_SPRITE_SCALE = 3;
/** 오른쪽을 보고 있는 몬스터: 플레이어가 왼쪽에 있으면 뒤집는다 */
const FACES_RIGHT = new Set(['rabbit', 'snail']);
/** 흙바닥 장식(돌·잎)을 놓는 칸 크기 */
const DECO_CELL = 150;
/** 보스 체력 막대 위치 (상단 HUD 아래) */
const BOSS_BAR_Y = 112;

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private dpr = 1;
  /** 지금 보여주는 8방향 인덱스. 경계에서 그림이 깜빡이지 않게 여유를 두고 바꾼다. */
  private heroDir = 2;
  /** 바닥 무늬 (색 조합마다 한 번 만들어 둔다) */
  private grounds = new Map<string, CanvasPattern | null>();
  /** 이번 프레임의 병아리 색 / 스킬 이펙트 색 (꾸미기) */
  private chickColor: Recolor | null = null;
  private fxColor: Recolor | null = null;

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
    this.chickColor = skinRecolor(CHICK_SKIN_BY_ID[eng.chickSkin], eng.time, true);
    this.fxColor = skinRecolor(FX_SKIN_BY_ID[eng.fxSkin], eng.time, false);
    this.drawBackground(eng);

    // 화면 흔들림: 카메라를 조금씩 무작위로 비튼다
    const sx = eng.shake > 0 ? (Math.random() - 0.5) * 2 * eng.shake : 0;
    const sy = eng.shake > 0 ? (Math.random() - 0.5) * 2 * eng.shake : 0;
    ctx.save();
    ctx.translate(-eng.camX + sx, -eng.camY + sy);

    this.drawDecorations(eng);
    // 배경 채도·밝기를 조금 낮춘다 (몹과 이펙트가 더 잘 보이게)
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalCompositeOperation = 'saturation';
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, eng.viewW, eng.viewH);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, eng.viewW, eng.viewH);
    ctx.restore();

    for (const g of eng.gems.items) {
      if (!g.active) continue;
      const img = SPRITES.ui[g.value >= 3 ? 'gem-green' : 'gem-blue'];
      const s = g.value >= 3 ? 13 : 10;
      if (isReady(img)) {
        ctx.drawImage(img, g.x - s / 2, g.y - s / 2, s, (s * img.naturalHeight) / img.naturalWidth);
      } else {
        ctx.fillStyle = '#4fd1c5';
        ctx.fillRect(g.x - 3, g.y - 3, 6, 6);
      }
    }

    for (const fx of eng.effects.items) {
      if (fx.active && (fx.kind === 'telegraph' || fx.kind === 'corpse')) this.drawEffect(fx);
    }

    // 레이드 경고 장판: 빨간 원 안이 차오르면 터진다
    for (const hz of eng.hazards) {
      const k = 1 - hz.t / hz.maxT;
      ctx.fillStyle = 'rgba(255,50,70,0.16)';
      ctx.beginPath();
      ctx.arc(hz.x, hz.y, hz.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,80,100,0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,50,70,0.38)';
      ctx.beginPath();
      ctx.arc(hz.x, hz.y, hz.r * k, 0, Math.PI * 2);
      ctx.fill();
    }

    // 보물 상자: 빛나는 고리 위에서 통통 튄다
    for (const c of eng.chests.items) {
      if (!c.active) continue;
      const chest = SPRITES.icons[CHEST_ICONS[c.grade]] ?? SPRITES.ui.chest;
      const glow = 0.5 + 0.5 * Math.sin(c.t * 6);
      // 등급 색 고리 (나무 갈색 / 은 / 금)
      ctx.strokeStyle = CHEST_COLORS[c.grade];
      ctx.globalAlpha = 0.45 + 0.4 * glow;
      ctx.lineWidth = 3 + c.grade;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y + 8, 24 + glow * 4, 9 + glow * 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      const hop = Math.abs(Math.sin(c.t * 4)) * 6;
      if (isReady(chest)) {
        const w = 34;
        const h = (w * chest.naturalHeight) / chest.naturalWidth;
        ctx.drawImage(chest, c.x - w / 2, c.y + 6 - h - hop, w, h);
      } else {
        ctx.fillStyle = '#c8823a';
        ctx.fillRect(c.x - 12, c.y - 14 - hop, 24, 18);
      }
    }

    // 체력 회복템: 초록 빛 위에 하트 물약이 둥실
    const healImg = SPRITES.icons.potion_heart ?? SPRITES.fx['heal-cross'];
    for (const it of eng.heals.items) {
      if (!it.active) continue;
      const bob = Math.sin(it.t * 5) * 3;
      const g = ctx.createRadialGradient(it.x, it.y - 8, 2, it.x, it.y - 8, 22);
      g.addColorStop(0, 'rgba(124,242,160,0.7)');
      g.addColorStop(1, 'rgba(124,242,160,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(it.x, it.y - 8, 22, 0, Math.PI * 2);
      ctx.fill();
      if (isReady(healImg)) ctx.drawImage(healImg, it.x - 11, it.y - 26 + bob, 22, 22 * aspect(healImg));
    }

    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (const e of eng.enemies.items) {
      if (!e.active) continue;
      ctx.beginPath();
      ctx.ellipse(e.x, e.y + e.r * 0.9, e.r * 0.9, e.r * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const z of eng.zones.items) if (z.active) this.drawZone(eng, z);
    for (const e of eng.enemies.items) if (e.active) this.drawEnemy(eng, e);

    const flame = SPRITES.fx['purple-flame'];
    for (const b of eng.bullets.items) {
      if (!b.active) continue;
      if (isReady(flame)) {
        ctx.drawImage(flame, b.x - 8, b.y - 11, 16, 19);
      } else {
        ctx.fillStyle = '#ff7aa8';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (const pr of eng.projectiles.items) if (pr.active) this.drawProjectile(pr);

    const orb = this.fx('dark-orb');
    for (const o of eng.orbs) {
      if (orb) {
        const s = o.r * 2.8;
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.rotate(eng.time * 4);
        ctx.drawImage(orb, -s / 2, -s / 2, s, s);
        ctx.restore();
      } else {
        ctx.fillStyle = '#9a6ad8';
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (eng.pet) this.drawPet(eng);
    this.drawPlayer(eng);

    for (const fx of eng.effects.items) {
      if (fx.active && fx.kind !== 'telegraph' && fx.kind !== 'corpse') this.drawEffect(fx);
    }

    // 파편: 작은 네모가 줄어들며 사라진다
    for (const pt of eng.particles.items) {
      if (!pt.active) continue;
      const k = pt.life / pt.maxLife;
      const sz = pt.size * (0.4 + 0.6 * k);
      ctx.globalAlpha = Math.min(1, k * 1.5);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - sz / 2, pt.y - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const t of eng.texts.items) {
      if (!t.active) continue;
      const k = t.life / t.maxLife;
      ctx.globalAlpha = Math.min(1, k * 2);
      // 처음 잠깐 크게 튀어나왔다가 원래 크기로
      const pop = k > 0.8 ? 1 + (k - 0.8) * 3 : 1;
      ctx.font = `900 ${Math.round(t.size * pop)}px system-ui, sans-serif`;
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#3a1d0b';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    const boss = eng.boss;
    if (eng.fog > 0) this.drawFog(eng, -eng.camX + eng.player.x, -eng.camY + eng.player.y);
    if (boss && eng.followCamera) this.drawBossBar(eng, boss);
    if (eng.followCamera) this.drawOffscreenArrows(eng);
    if (joystick?.active) this.drawJoystick(joystick);
  }

  /** 화면 밖 정예(빨강)·황금 몹(금색)·구급상자 몹(초록)을 화면 테두리 화살표로 가리킨다 */
  private drawOffscreenArrows(eng: Engine) {
    const ctx = this.ctx;
    const w = eng.viewW;
    const h = eng.viewH;
    const pad = 22;
    for (const e of eng.enemies.items) {
      if (!e.active) continue;
      const color = e.golden ? '#ffd23f' : e.elite ? '#ff3b3b' : e.skin === 'firstaid' ? '#6fdc8c' : null;
      if (!color) continue;
      const sx = e.x - eng.camX;
      const sy = e.y - eng.camY;
      if (sx > -e.r && sx < w + e.r && sy > -e.r && sy < h + e.r) continue;
      // 화면 가운데에서 몹 쪽으로 그은 선이 테두리와 만나는 곳
      const cx = w / 2;
      const cy = h / 2;
      const dx = sx - cx;
      const dy = sy - cy;
      const k = Math.min((w / 2 - pad) / Math.abs(dx || 1e-6), (h / 2 - pad) / Math.abs(dy || 1e-6));
      const ax = cx + dx * k;
      const ay = cy + dy * k;
      const a = Math.atan2(dy, dx);
      const pulse = 1 + 0.15 * Math.sin(eng.time * 8);
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(a);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = color;
      ctx.strokeStyle = '#3a1d0b';
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(13, 0);
      ctx.lineTo(-8, -10);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-8, 10);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      ctx.restore();
    }
  }

  private drawBackground(eng: Engine) {
    const ctx = this.ctx;
    const w = eng.viewW;
    const h = eng.viewH;
    const key = eng.ground.join();
    if (!this.grounds.has(key)) this.grounds.set(key, this.makeGround(eng.ground));
    ctx.save();
    ctx.translate(-eng.camX, -eng.camY);
    ctx.fillStyle = this.grounds.get(key) ?? eng.ground[0];
    ctx.fillRect(eng.camX, eng.camY, w, h);
    ctx.restore();
  }

  /** 바닥 무늬 한 칸(이음새 없이 반복). 밝고 어두운 얼룩과 작은 자갈을 흩뿌린다. colors = 바탕, 얼룩 둘, 자갈 둘 */
  private makeGround(colors: readonly string[]): CanvasPattern | null {
    const size = 256;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d')!;
    g.fillStyle = colors[0];
    g.fillRect(0, 0, size, size);
    let seed = 7;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    // 가장자리를 넘는 얼룩은 반대쪽에도 그려서 이어지게 한다
    const blob = (x: number, y: number, r: number, color: string) => {
      g.fillStyle = color;
      for (const ox of [-size, 0, size]) {
        for (const oy of [-size, 0, size]) {
          g.beginPath();
          g.ellipse(x + ox, y + oy, r, r * 0.7, 0, 0, Math.PI * 2);
          g.fill();
        }
      }
    };
    for (let i = 0; i < 26; i++) blob(rnd() * size, rnd() * size, 18 + rnd() * 34, rnd() < 0.5 ? colors[1] : colors[2]);
    for (let i = 0; i < 140; i++) blob(rnd() * size, rnd() * size, 1 + rnd() * 2.2, rnd() < 0.5 ? colors[3] : colors[4]);
    return this.ctx.createPattern(c, 'repeat');
  }

  /** 칸마다 정해진 자리에 돌·잎과 지역 장식(나무·바위·묘비 등)을 놓는다 (같은 칸은 항상 같은 장식) */
  private drawDecorations(eng: Engine) {
    const imgs = SPRITES.ground;
    const deco = eng.deco.map((n) => SPRITES.deco[n]).filter(isReady);
    if (imgs.length === 0) return;
    const ctx = this.ctx;
    const x0 = Math.floor(eng.camX / DECO_CELL) - 1;
    const y0 = Math.floor(eng.camY / DECO_CELL) - 1;
    const x1 = Math.floor((eng.camX + eng.viewW) / DECO_CELL) + 1;
    const y1 = Math.floor((eng.camY + eng.viewH) / DECO_CELL) + 1;
    ctx.globalAlpha = 0.9;
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const hsh = hash(cx, cy);
        const roll = hsh % 100;
        if (roll >= 45) continue;
        const x = cx * DECO_CELL + ((hsh >>> 12) % DECO_CELL);
        const y = cy * DECO_CELL + ((hsh >>> 20) % DECO_CELL);
        if (roll < 14 && deco.length > 0) {
          // 지역 장식: 원래 크기의 0.4~0.55배, 발이 칸 자리에 오게
          const img = deco[(hsh >>> 8) % deco.length];
          const k = 0.4 + ((hsh >>> 4) % 16) / 100;
          const w = img.naturalWidth * k;
          const h = img.naturalHeight * k;
          ctx.drawImage(img, x - w / 2, y - h, w, h);
          continue;
        }
        const img = imgs[(hsh >>> 8) % imgs.length];
        if (!isReady(img)) continue;
        const s = 14 + ((hsh >>> 4) % 10);
        ctx.drawImage(img, x - s / 2, y - s / 2, s, (s * img.naturalHeight) / img.naturalWidth);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** 발이 (x, footY)에 닿게 스프라이트를 그린다. flash > 0이면 하얗게 번쩍인다. */
  /** 발이 (x, footY)에 닿게 스프라이트를 그린다. flash > 0이면 하얗게 번쩍인다. */
  private drawSprite(img: CanvasImageSource, x: number, footY: number, width: number, height: number, flip: boolean, flash: number) {
    const ctx = this.ctx;
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
    const anim = SPRITES.monsters[e.skin];
    const size = e.r * ENEMY_SPRITE_SCALE;
    if (e.golden || e.bomb) {
      // 황금 몹은 금빛, 폭탄 몹은 붉은 기운
      const ctx = this.ctx;
      const r = e.r * 2.2 * (1 + 0.1 * Math.sin(eng.time * 10 + e.id));
      const g = ctx.createRadialGradient(e.x, e.y - e.r * 0.5, 2, e.x, e.y - e.r * 0.5, r);
      g.addColorStop(0, e.golden ? 'rgba(255,230,90,0.85)' : 'rgba(255,90,60,0.6)');
      g.addColorStop(1, e.golden ? 'rgba(255,200,0,0)' : 'rgba(255,60,30,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(e.x, e.y - e.r * 0.5, r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (e.tint) {
      // 돌진(빨강)·포위(보라)·벽(파랑) 몹: 발밑에 색 원 테두리
      const ctx = this.ctx;
      ctx.strokeStyle = TINT_RINGS[e.tint];
      ctx.globalAlpha = 0.75 + 0.25 * Math.sin(eng.time * 12 + e.id);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(e.x, e.y + e.r * 0.85, e.r * 1.2, e.r * 0.45, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (e.skin === 'firstaid') {
      this.drawFirstAid(eng, e);
    } else if (anim) {
      const frame = frameAt(anim, eng.time * 1000 + e.id * 97);
      const img = recolored(frame, e.golden ? GOLDEN_COLOR : MOB_COLOR);
      const flip = FACES_RIGHT.has(e.skin) && eng.player.x < e.x;
      // 맞으면 옆으로 퍼지고 납작해졌다가 돌아온다
      const hit = Math.max(0, e.flash) / 0.1;
      let sx = 1 + 0.18 * hit;
      let sy = 1 - 0.15 * hit;
      let s = size;
      if (SPRITES.still.has(e.skin)) {
        // 한 장짜리 그림: 여백 없이 꽉 차 있어서 조금 작게, 걷는 대신 통통 튄다
        s *= 0.78;
        const bob = Math.sin(eng.time * 11 + e.id * 1.7);
        sx *= 1 + 0.05 * bob;
        sy *= 1 - 0.07 * bob;
      }
      // 칸 아래쪽에 1px 여백이 있다
      this.drawSprite(img, e.x, e.y + e.r + 1, s * sx, s * sy, flip, e.flash);
    } else {
      this.drawEnemyShape(eng, e);
    }
    const top = anim && e.skin !== 'firstaid' ? e.y + e.r - size * 0.85 : e.y - e.r * 1.3;
    this.drawStatus(eng, e, top);
    const showBar = !eng.followCamera || ((e.kind === 'tank' || e.golden) && e.hp < e.maxHp) || e.skin === 'firstaid';
    if (showBar && e.kind !== 'boss') {
      const bw = Math.max(18, e.r * 2);
      this.bar(e.x - bw / 2, top - 6, bw, 3, e.hp / e.maxHp, '#ff5c6c');
    }
  }

  /** 구급상자 몹: 흰 상자에 빨간 십자, 통통 튄다 */
  private drawFirstAid(eng: Engine, e: Enemy) {
    const ctx = this.ctx;
    const hop = Math.abs(Math.sin(eng.time * 5 + e.id)) * 4;
    const w = e.r * 2;
    const h = e.r * 1.6;
    const x = e.x - w / 2;
    const y = e.y + e.r - h - hop;
    ctx.save();
    // 손잡이
    ctx.strokeStyle = '#3a1d0b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(e.x - w * 0.2, y - h * 0.22, w * 0.4, h * 0.3, 3);
    ctx.stroke();
    ctx.fillStyle = e.flash > 0 ? '#ffd6d6' : '#f6f6f2';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 5);
    ctx.fill();
    ctx.stroke();
    // 빨간 십자
    ctx.fillStyle = '#e8333f';
    const c = Math.min(w, h) * 0.22;
    ctx.fillRect(e.x - c / 2, y + h / 2 - c * 1.5, c, c * 3);
    ctx.fillRect(e.x - c * 1.5, y + h / 2 - c / 2, c * 3, c);
    ctx.restore();
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

    // 피버: 병아리 둘레에 금빛 기운이 일렁인다
    if (eng.fever > 0) {
      const pulse = 1 + 0.15 * Math.sin(eng.time * 16);
      const r = 46 * pulse;
      const g = ctx.createRadialGradient(p.x, p.y - 8, 4, p.x, p.y - 8, r);
      g.addColorStop(0, 'rgba(255,230,120,0.75)');
      g.addColorStop(0.5, 'rgba(255,170,40,0.35)');
      g.addColorStop(1, 'rgba(255,140,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 8, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const footY = p.y + p.r + 2;
    const dir = this.updateHeroDir(p.faceX, p.faceY);
    if (p.dead) {
      // 쓰러짐: 아래 보는 첫 프레임을 옆으로 눕힌다
      const down = SPRITES.hero.walk[2];
      if (!down) return;
      ctx.save();
      ctx.translate(p.x, footY - HERO_SIZE * 0.36);
      ctx.rotate(p.faceX < 0 ? -Math.PI / 2 : Math.PI / 2);
      ctx.globalAlpha = 0.85;
      ctx.drawImage(this.chick(down.frames[0]), -HERO_SIZE / 2, -HERO_SIZE / 2, HERO_SIZE, HERO_SIZE);
      ctx.restore();
      return;
    }

    // 이동 중: 기본은 걷기, 속도가 붙으면 달리기 / 멈춤: 걷기 첫 프레임
    // 피버 중엔 AUTO로 천천히 움직여도 달리기 그림
    const motion = p.moving && (eng.fever > 0 || p.curSpeed >= p.speed * RUN_RATIO) ? 'run' : 'walk';
    const anim = SPRITES.hero[motion][dir] ?? SPRITES.hero.walk[dir];
    if (!anim) return this.drawPlayerShape(eng);
    const frame = p.moving ? frameAt(anim, eng.time * 1000) : anim.frames[0];
    const img = this.chick(frame);

    const blink = p.invuln > 0 && Math.floor(eng.time * 20) % 2 === 0;
    const left = p.x - HERO_SIZE / 2;
    const top = footY - HERO_SIZE * HERO_FOOT;
    // 장비 겉모습: 등은 몸 뒤(위를 볼 땐 앞), 모자는 머리 위, 무기는 옆에 둥둥
    const at = { frame, dir, left, top };
    ctx.save();
    ctx.globalAlpha = blink ? 0.55 : 1;
    drawOutfitBehind(ctx, eng, at);
    ctx.drawImage(img, left, top, HERO_SIZE, HERO_SIZE);
    if (p.flash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha *= 0.6;
      ctx.drawImage(img, left, top, HERO_SIZE, HERO_SIZE);
      ctx.restore();
    }
    drawOutfitFront(ctx, eng, at);
    ctx.restore();
    this.drawBuffs(eng, footY);
    this.bar(p.x - 15, p.y + p.r + 5, 30, 4, p.hp / p.maxHp, '#6fdc8c');
  }

  /** 버프 표시 (보호막 방울, 분노·신속 등 빛 고리) + 머리 위 감정 표현 */
  private drawBuffs(eng: Engine, footY: number) {
    const ctx = this.ctx;
    const p = eng.player;
    const cy = footY - HERO_SIZE * 0.45;
    if (eng.shieldHp > 0) {
      ctx.globalAlpha = 0.35 + 0.1 * Math.sin(eng.time * 6);
      ctx.fillStyle = '#9fe4ff';
      ctx.beginPath();
      ctx.arc(p.x, cy, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#e8fbff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // 버프마다 색 고리 하나씩 (안쪽부터)
    const rings: [number, string][] = [
      [eng.buffOn('rage'), '#ff4d4d'], [eng.buffOn('haste'), '#ffd23f'], [eng.buffOn('sprint'), '#7cf2a0'],
      [eng.buffOn('thorns'), '#c78bff'], [eng.buffOn('luck'), '#ffb347'], [eng.buffOn('invuln'), '#ffffff'],
    ];
    let r = 22;
    for (const [on, color] of rings) {
      if (on <= 0) continue;
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(p.x, footY - 2, r, r * 0.38, 0, 0, Math.PI * 2);
      ctx.stroke();
      r += 4;
    }
    ctx.globalAlpha = 1;
    if (eng.emote) {
      const img = SPRITES.icons[`emote-${eng.emote.name}`];
      if (isReady(img)) {
        const pop = Math.min(1, (1.2 - eng.emote.t) * 8 + 0.3);
        const s = 20 * pop;
        ctx.drawImage(img, p.x + 8, footY - HERO_SIZE - s * 0.9, s, s * aspect(img));
      }
    }
  }

  /** 몹 디버프 표시: 기절 별, 표식, 저주 해골, 지속 피해 연기, 취약 보라 고리 */
  private drawStatus(eng: Engine, e: Enemy, top: number) {
    const ctx = this.ctx;
    if (e.weakT > 0) {
      ctx.strokeStyle = '#b05cff';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.ellipse(e.x, e.y + e.r * 0.85, e.r * 1.05, e.r * 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (e.dotT > 0 && Math.random() < 0.25) eng.burst(e.x, e.y - e.r, 1, e.dotSpread ? ['#9be36a', '#6fbf4a'] : ['#ff7a2a', '#ffd166'], 30, 0.4, -60, 2.5);
    const icon = e.stunT > 0 ? 'star' : e.markT > 0 ? 'target-red' : e.curseT > 0 ? 'skull_purple' : e.fearT > 0 ? 'emote-alert' : e.confuseT > 0 ? 'emote-dizzy' : '';
    if (!icon) return;
    const img = SPRITES.icons[icon];
    if (!isReady(img)) return;
    const s = 12;
    const spin = e.stunT > 0 ? Math.sin(eng.time * 10) * 4 : 0;
    ctx.drawImage(img, e.x - s / 2 + spin, top - 18, s, s * aspect(img));
  }

  /** 꾸미기 색을 입힌 병아리 프레임 */
  private chick(frame: HTMLCanvasElement): Pic {
    return this.chickColor ? recolored(frame, this.chickColor) : frame;
  }

  /** 스킬 이펙트 그림 (이름@색상이면 그 색으로, 그 위에 꾸미기 색). 아직 못 불러왔으면 null */
  private fx(name: string): Pic | null {
    const [base, hue] = name.split('@');
    const img = SPRITES.fx[base];
    if (!isReady(img)) return null;
    const own = hue ? recolored(img, hueRecolor(Number(hue))) : img;
    return this.fxColor ? recolored(own, this.fxColor) : own;
  }

  /** 동료: 작은 몬스터가 둥실둥실 떠서 따라온다 */
  private drawPet(eng: Engine) {
    const pet = eng.pet!;
    const ctx = this.ctx;
    const bob = Math.sin(eng.time * 5) * 3;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(pet.x, pet.y + 14, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    const anim = SPRITES.monsters[pet.skin];
    if (!anim) return;
    const img = frameAt(anim, eng.time * 1000);
    const flip = FACES_RIGHT.has(pet.skin) ? eng.player.faceX < 0 : eng.player.faceX > 0;
    this.drawSprite(img, pet.x, pet.y + 12 + bob, PET_SIZE, PET_SIZE, flip, 0);
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

  /** 깃털·화염구는 날아가는 방향으로 돌리고, 알은 포물선 높이만큼 띄워 그린다 */
  private drawProjectile(pr: Projectile) {
    const ctx = this.ctx;
    const angle = Math.atan2(pr.vy, pr.vx);
    if (pr.kind === 'meteor') {
      // 오른쪽 위 하늘에서 비스듬히 떨어진다. 떨어질 자리에 그림자가 커진다
      const t = 1 - pr.life / pr.flight;
      const k = 1 - t;
      ctx.fillStyle = `rgba(0,0,0,${0.15 + 0.25 * t})`;
      ctx.beginPath();
      ctx.ellipse(pr.x, pr.y, 8 + 10 * t, 3 + 4 * t, 0, 0, Math.PI * 2);
      ctx.fill();
      const img = this.fx('fireball');
      if (!img) return;
      const fx = pr.x + 90 * k;
      const fy = pr.y - 260 * k;
      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(Math.atan2(260, -90) + Math.PI);
      const w = 40 * FX;
      const h = w * aspect(img);
      ctx.drawImage(img, -w * 0.3, -h / 2, w, h);
      ctx.restore();
      return;
    }
    if (pr.flight > 0 && pr.kind !== 'egg') {
      // 이펙트 그림을 포물선으로 던진다 (폭죽 등)
      const t = 1 - pr.life / pr.flight;
      const lift = Math.sin(Math.PI * t) * 70;
      const img = this.fx(pr.kind);
      if (!img) return;
      const s = 22 * pr.scale;
      ctx.save();
      ctx.translate(pr.x, pr.y - lift);
      ctx.rotate(t * 10);
      ctx.drawImage(img, -s / 2, (-s * aspect(img)) / 2, s, s * aspect(img));
      ctx.restore();
      return;
    }
    if (pr.kind === 'egg') {
      const t = 1 - pr.life / pr.flight;
      const lift = Math.sin(Math.PI * t) * 46 * pr.scale;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(pr.x, pr.y + 4, 5, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(pr.x, pr.y - lift);
      ctx.rotate(t * 6);
      ctx.scale(pr.scale, pr.scale);
      ctx.fillStyle = '#fff6e4';
      ctx.strokeStyle = '#5a3a20';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 5, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      return;
    }
    const img = this.fx(pr.kind);
    if (!img) {
      ctx.fillStyle = pr.kind === 'fireball' ? '#ff7a2a' : '#ffe08a';
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.save();
    ctx.translate(pr.x, pr.y);
    if (pr.kind === 'feather') {
      // 깃털 그림은 끝이 위를 향한다
      ctx.rotate(angle + Math.PI / 2);
      const h = 22 * FX;
      const w = h / aspect(img);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    } else if (pr.kind !== 'fireball') {
      // 그 밖의 이펙트 그림: 빙글빙글 돌며 날아간다
      ctx.rotate(pr.life * 14);
      const w = pr.r * 4 * pr.scale;
      const h = w * aspect(img);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    } else {
      // 화염구 그림은 왼쪽으로 날아가는 모양
      ctx.rotate(angle + Math.PI);
      const w = 30 * FX;
      const h = w * aspect(img);
      ctx.drawImage(img, -w * 0.3, -h / 2, w, h);
    }
    ctx.restore();
  }

  private drawZone(eng: Engine, z: Zone) {
    const img = this.fx(z.sprite);
    const ctx = this.ctx;
    const fade = Math.min(1, z.life / 0.3, (z.maxLife - z.life) / 0.15);
    // 독안개 구름은 반투명 (화면을 덜 가리게)
    ctx.globalAlpha = Math.max(0, fade) * (z.sprite === 'dust' ? 0.5 : 1);
    if (img && z.pull > 0) {
      // 블랙홀: 바닥에 깔린 구멍이 맥박치듯 커졌다 작아진다
      const w = z.r * 3.2 * (1 + 0.08 * Math.sin(eng.time * 14));
      const h = w * aspect(img);
      ctx.drawImage(img, z.x - w / 2, z.y - h * 0.62, w, h);
    } else if (img) {
      const h = z.r * 2.6;
      const w = h / aspect(img);
      const wob = Math.sin(eng.time * 18 + z.x) * 2;
      ctx.drawImage(img, z.x - w / 2 + wob, z.y + z.r * 0.6 - h, w, h);
    } else {
      ctx.strokeStyle = '#ffe08a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
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
        // 번개: 같은 지그재그를 넓고 흐린 빛 + 가는 흰 심으로 두 번 긋는다
        const segs = 6;
        const pts: number[] = [fx.x, fx.y];
        for (let i = 1; i < segs; i++) {
          const k = i / segs;
          pts.push(fx.x + (fx.x2 - fx.x) * k + (Math.random() - 0.5) * 14, fx.y + (fx.y2 - fx.y) * k + (Math.random() - 0.5) * 14);
        }
        pts.push(fx.x2, fx.y2);
        ctx.lineJoin = 'round';
        for (const [w, color, a] of [[7, fx.color, 0.35], [2, '#ffffff', 1]] as const) {
          ctx.globalAlpha = Math.max(0, t) * a;
          ctx.strokeStyle = color;
          ctx.lineWidth = w;
          ctx.beginPath();
          ctx.moveTo(pts[0], pts[1]);
          for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
          ctx.stroke();
        }
        break;
      }
      case 'sprite': {
        const img = this.fx(fx.sprite);
        if (!img) break;
        // 처음엔 살짝 작게 시작해서 커지며 사라진다
        const k = 0.8 + 0.3 * (1 - t);
        const w = fx.r * 2 * k;
        const h = w * aspect(img);
        ctx.globalAlpha = Math.min(1, t * 2.5);
        ctx.drawImage(img, fx.x - w / 2, fx.y - h / 2, w, h);
        break;
      }
      case 'corpse': {
        const img = SPRITES.dead[fx.sprite];
        if (!isReady(img)) break;
        const w = fx.r * ENEMY_SPRITE_SCALE * 0.9;
        const h = (w * img.naturalHeight) / img.naturalWidth;
        ctx.globalAlpha = Math.min(1, t * 2);
        ctx.drawImage(img, fx.x - w / 2, fx.y - h, w, h);
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

  /** 안개: 플레이어 주변만 밝고 바깥은 어둡다 */
  private drawFog(eng: Engine, px: number, py: number) {
    const ctx = this.ctx;
    const g = ctx.createRadialGradient(px, py, eng.fog * 0.6, px, py, eng.fog * 1.4);
    g.addColorStop(0, 'rgba(20,16,24,0)');
    g.addColorStop(1, 'rgba(20,16,24,0.93)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, eng.viewW, eng.viewH);
  }

  private drawBossBar(eng: Engine, boss: Enemy) {
    // 상단 HUD 바로 아래
    this.bar(24, BOSS_BAR_Y, eng.viewW - 48, 8, boss.hp / boss.maxHp, '#d04070');
  }

  private drawJoystick(j: Joystick) {
    const ctx = this.ctx;
    const base = SPRITES.ui['joy-base'];
    const knob = SPRITES.ui['joy-knob'];
    const dx = j.x - j.ox;
    const dy = j.y - j.oy;
    const d = Math.hypot(dx, dy);
    const k = d > j.radius ? j.radius / d : 1;
    const kx = j.ox + dx * k;
    const ky = j.oy + dy * k;
    if (isReady(base) && isReady(knob)) {
      const bs = j.radius * 2.3;
      ctx.globalAlpha = 0.85;
      ctx.drawImage(base, j.ox - bs / 2, j.oy - bs / 2, bs, bs);
      ctx.globalAlpha = 1;
      const ks = j.radius * 1.05;
      ctx.drawImage(knob, kx - ks / 2, ky - ks / 2, ks, ks);
      return;
    }
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(j.ox, j.oy, j.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(kx, ky, 22, 0, Math.PI * 2);
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

/** 칸 좌표 → 정수 해시 (바닥 장식 배치용) */
function hash(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}
