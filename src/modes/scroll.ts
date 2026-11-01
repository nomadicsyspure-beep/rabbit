import { ArenaDirector, type ArenaEvent, type ArenaVariantDef } from './arena';

// 스크롤 테스트(B): 화면이 천천히 위로 흘러가고, 병아리는 화면 안에서만 움직인다.
// 몹은 주로 위에서(가끔 양옆에서) 내려오고, 길목에 가시덤불이 나온다. 아래로 흘러간 몹은 다시 위로.
// 아레나와 같은 러시·돌발 이벤트(운석·폭주 몹·대행진)·저주 상자·별·보스 분노를 쓴다 (독안개는 빼고).

export const SCROLL_DEF: ArenaVariantDef = {
  id: 'normal', name: '스크롤', icon: '📜', sec: 30,
  desc: '화면이 위로 흘러간다. 위에서 내려오는 몹과 가시덤불을 피해 30초 버티면 보스',
  star3: '가시덤불에 3번 이하로 닿기',
};

/** 위로 흐르는 속도(px/초) */
const SCROLL_SPEED = 40;
const THORN_GAP = 1.5;
const THORN_HIT_GAP = 0.6;

export class ScrollDirector extends ArenaDirector {
  private thornT = 0;
  private thornHitT = 0;
  thornHits = 0;

  get def(): ArenaVariantDef {
    return SCROLL_DEF;
  }

  get key() {
    return 'scroll';
  }

  protected get title() {
    return '스크롤 테스트';
  }

  /** 지금 보이는 화면 (HUD 아래·스킬 버튼 위) */
  protected area() {
    const eng = this.eng;
    return { x: eng.camX + 20, y: eng.camY + 110, w: eng.viewW - 40, h: eng.viewH - 240 };
  }

  protected eventPool(): ArenaEvent[] {
    return ['meteor', 'bomb', 'herd'];
  }

  protected setupField() {
    const eng = this.eng;
    eng.fixedCam = true;
    eng.viewClamp = true;
    eng.camX = -eng.viewW / 2;
    eng.camY = -eng.viewH / 2;
    const p = eng.player;
    p.x = 0;
    p.y = eng.camY + eng.viewH * 0.68;
    eng.thorns = [];
    this.thornT = 0.8;
    this.thornHitT = 0;
    this.thornHits = 0;
  }

  /** 몹: 대부분 위에서, 가끔 양옆 위쪽에서 */
  spawnPos() {
    const eng = this.eng;
    if (Math.random() < 0.72) return { x: eng.camX + Math.random() * eng.viewW, y: eng.camY - 30 - Math.random() * 40 };
    const left = Math.random() < 0.5;
    return { x: left ? eng.camX - 30 : eng.camX + eng.viewW + 30, y: eng.camY + Math.random() * eng.viewH * 0.5 };
  }

  update(dt: number) {
    const eng = this.eng;
    const p = eng.player;
    // 보스가 나와 있으면 멈추고, 러시 때는 빨라진다
    const speed = this.a.bossSpawned ? 0 : SCROLL_SPEED * (this.rushing ? 1.5 : 1);
    eng.camY -= speed * dt;
    // 화면 아래 끝에 걸리면 같이 밀려 올라간다 (eng.viewClamp가 처리)

    // 가시덤불: 위쪽 화면 밖에 생겨서 흘러 내려온다(화면이 올라가니까)
    this.thornT -= dt;
    if (this.thornT <= 0 && !this.a.bossSpawned) {
      this.thornT = THORN_GAP * (0.7 + Math.random() * 0.6);
      const n = Math.random() < 0.35 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        eng.thorns.push({ x: eng.camX + 30 + Math.random() * (eng.viewW - 60), y: eng.camY - 50 - i * 40, r: 20 + Math.random() * 14 });
      }
    }
    eng.thorns = eng.thorns.filter((t) => t.y < eng.camY + eng.viewH + 100);
    // 닿으면 따끔 (0.6초마다)
    this.thornHitT -= dt;
    for (const t of eng.thorns) {
      if (Math.hypot(p.x - t.x, p.y - t.y) > t.r + p.r * 0.7) continue;
      if (this.thornHitT > 0) break;
      this.thornHitT = THORN_HIT_GAP;
      if (eng.damagePlayer(p.maxHp * 0.07, t.x, t.y, false)) {
        this.thornHits++;
        eng.burst(p.x, p.y - 8, 5, ['#2f5a2a', '#e8e0c0'], 120, 0.3, 200, 2.5);
      }
      break;
    }

    // 아래로 흘러간 몹은 다시 위로 (보스 빼고)
    for (const e of eng.enemies.items) {
      if (!e.active || e.kind === 'boss' || e.move === 'charge') continue;
      if (e.y > eng.camY + eng.viewH + 120) {
        const pos = this.spawnPos();
        e.x = pos.x;
        e.y = pos.y;
      }
    }
    // 저주 상자가 화면 아래로 흘러가 버리면 끝
    if (eng.curse && eng.curse.y > eng.camY + eng.viewH + 40) eng.curse = null;

    super.update(dt);
  }

  stars(win: boolean) {
    const base = super.stars(win);
    return {
      got: [base.got[0], base.got[1], win && this.thornHits <= 3],
      labels: [base.labels[0], base.labels[1], SCROLL_DEF.star3],
    };
  }
}
