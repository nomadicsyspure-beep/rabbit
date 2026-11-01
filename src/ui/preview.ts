import { Engine } from '../battle/engine';
import { Renderer } from '../battle/renderer';
import type { SkillTree } from '../battle/weapons';
import { createSkill, type SkillDef } from '../data/skills';
import { regionOf } from '../data/world';
import { h } from './dom';

// 스킬 미리보기: 작은 캔버스에 엔진을 하나 더 띄워서, 가만히 선 병아리 둘레로 몹이 걸어오고
// 그 스킬만 실제로 발동하는 모습을 보여 준다 (창이 닫혀 캔버스가 떨어지면 멈춘다).

const W = 300;
const H = 170;
const MOBS = 9;

/** power: 실제 공격력 (피해 숫자가 스테이지와 같게). 몹 체력은 강화 전 기준이라 강화할수록 빨리 쓰러진다 */
export function skillPreview(def: SkillDef, tree: SkillTree, power = 10) {
  const canvas = h('canvas', 'preview-canvas');
  const eng = new Engine();
  const ren = new Renderer(canvas);
  ren.resize(W, H);
  eng.viewW = W;
  eng.viewH = H;
  eng.bounds = { w: W, h: H };
  eng.followCamera = false;
  eng.dropGems = false;
  eng.showDamageText = true;
  eng.autoSkills = true;
  eng.ground = regionOf(1).ground;
  const stats = { power, aps: 1 };
  // 강화 단계(피해·속도·개수)를 그대로 쓴다 (복사본: 미리보기가 저장을 건드리지 않게)
  eng.weapons = [createSkill(def, stats, { ...tree })];
  const p = eng.player;
  p.x = W / 2;
  p.y = H / 2 + 8;
  p.maxHp = p.hp = 1000;
  p.speed = 0;

  const skins = ['slime', 'sprout', 'mushroom', 'bat'] as const;
  const spawn = () => {
    const a = Math.random() * Math.PI * 2;
    const d = 90 + Math.random() * 70;
    eng.spawnEnemy({
      kind: 'normal', skin: skins[Math.floor(Math.random() * skins.length)],
      x: p.x + Math.cos(a) * d * 1.4, y: p.y + Math.sin(a) * d * 0.8,
      hp: stats.power * def.dmg * 6, r: 10, speed: 16, dmg: 0, xp: 0,
    });
  };

  let last = 0;
  let spawnT = 0;
  const tick = (t: number) => {
    if (!canvas.isConnected) return;
    const dt = last ? Math.min((t - last) / 1000, 0.05) : 0;
    last = t;
    p.invuln = 1e9;
    p.hp = p.maxHp;
    spawnT -= dt;
    if (spawnT <= 0 && eng.enemies.countActive() < MOBS) {
      spawnT = 0.25;
      spawn();
    }
    eng.update(dt);
    ren.draw(eng, null);
    requestAnimationFrame(tick);
  };
  // 창에 붙은 다음부터 돈다
  requestAnimationFrame(() => requestAnimationFrame(tick));
  return canvas;
}
