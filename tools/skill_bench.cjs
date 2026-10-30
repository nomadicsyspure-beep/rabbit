// 스킬 밸런스 테스트: 모든 스킬을 같은 판·같은 난수로 돌려 bench.json에 기록한다.
//   npm run build && npx vite preview --port 4199   (다른 창에서)
//   node tools/skill_ids.cjs > skill_ids.json && STAGE=13 ATK=10 HP=10 node tools/skill_bench.cjs
//   python3 tools/skill_rank.py   → 형태별 순서·점수 (src/data/skills.ts의 RANKING에 옮긴다)
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e)));
  await pg.addInitScript(() => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); } });
  await pg.goto(process.env.URL || 'http://localhost:4199/'); await pg.waitForTimeout(1500);
  await pg.evaluate((cfg) => { window.__cfg = cfg; }, { stage: +(process.env.STAGE || 13), atk: +(process.env.ATK || 10), hp: +(process.env.HP || 10) });
  await pg.evaluate(() => {
    window.__sim = (ids, seed, secs, invuln) => {
      let a = seed >>> 0;
      const rnd = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      const realRandom = Math.random; Math.random = rnd;
      const g = window.rabbit;
      g.save.autoMove = true; g.save.maxStage = window.__cfg.stage; g.save.level = 1;
      g.save.levels = { atk: window.__cfg.atk, hp: window.__cfg.hp, aps: 5, spd: 5 };
      g.save.equipped = [];
      for (const [id, t] of ids) { g.save.skills[id] = { ...t }; g.save.equipped.push(id); }
      g.enterAction();
      const e = g.engine, A = g.action, p = e.player;
      let dmg = 0, taken = 0, healed = 0, deaths = 0;
      const origD = e.damageEnemy;
      e.damageEnemy = function (en, d, kx, ky) { const before = en.active ? en.hp : 0; origD.call(this, en, d, kx, ky); dmg += Math.max(0, before - Math.max(0, en.hp)); };
      const origP = e.damagePlayer;
      e.damagePlayer = function (d) { const before = p.hp; origP.call(this, d); taken += Math.max(0, before - p.hp); };
      e.onPlayerDead = () => { deaths++; p.dead = false; p.hp = p.maxHp; p.invuln = 1; };
      const dt = 1 / 60;
      for (let i = 0; i < secs * 60; i++) {
        if (invuln) p.invuln = 1e9;
        const hp0 = p.hp; const d0 = deaths; const t0 = taken;
        A.update(dt); e.update(dt);
        if (deaths === d0) { const gain = p.hp - hp0 + (taken - t0); if (gain > 0) healed += gain; }
      }
      const out = { dmg: Math.round(dmg), kills: A.kills, taken: Math.round(taken), healed: Math.round(healed), deaths };
      delete e.damageEnemy; delete e.damagePlayer;
      A.state = 'ended';
      g.enterIdle();
      Math.random = realRandom;
      return out;
    };
  });
  const T = { dmg: 2, spd: 1, cnt: 1 };
  const B = { dmg: 2, spd: 1, cnt: 1 };
  const ids = JSON.parse(fs.readFileSync('skill_ids.json', 'utf8'));
  const res = { T, B, rows: [] };
  const base = [];
  for (const seed of [11, 22, 33, 44, 55, 66, 77, 88]) base.push(await pg.evaluate(([s]) => window.__sim([['slash', { dmg: 2, spd: 1, cnt: 1 }], ['feather', { dmg: 2, spd: 1, cnt: 1 }]], s, 40, false), [seed]));
  res.base = base;
  console.log('base', JSON.stringify(base));
  for (const { id, type } of (process.env.ONLY ? ids.filter((x) => x.id === process.env.ONLY) : ids)) {
    const runs = [];
    if (type === 'attack' || type === 'target') {
      for (const seed of [11, 22, 33, 44]) runs.push(await pg.evaluate(([id, s, T]) => window.__sim([[id, T]], s, 40, true), [id, seed, T]));
    } else {
      for (const seed of [11, 22, 33, 44, 55, 66, 77, 88]) runs.push(await pg.evaluate(([id, s, T, B]) => window.__sim([['slash', B], ['feather', B], [id, T]], s, 40, false), [id, seed, T, B]));
    }
    res.rows.push({ id, type, runs });
    console.log(id, type, JSON.stringify(runs));
    fs.writeFileSync('bench.json', JSON.stringify(res));
  }
  console.log('errors', errs.slice(0, 3));
  await b.close();
})();
