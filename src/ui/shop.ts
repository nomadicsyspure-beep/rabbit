import { sfx } from '../audio/sfx';
import { SPRITES } from '../battle/sprites';
import { recolored } from '../battle/tint';
import { fmt } from '../core/format';
import {
  ACHIEVEMENTS, ATTEND_REWARDS, DAILY_ALL_BONUS, DAILY_MISSIONS, PASS_LEVELS, PASS_XP_PER_LEVEL, achieveReady, canAttend,
  freshDaily, passLevel, passReward,
} from '../data/missions';
import { PETS, PET_BY_ID, PET_MAX, PET_SLOTS, RARITY_COLORS, RARITY_NAMES, petEffectText, type PetDef } from '../data/pets';
import { CHICK_SKINS, FX_SKINS, skinPrice, summonCost, type SkinDef } from '../data/shop';
import type { Game } from '../game';
import { h, ibox, monsterPic } from './dom';
import type { UIHost } from './meta';

// 동료 탭, 상점 탭, 미션 창(일일·출석·업적·패스).

/** 다이아·소환권 한 줄 */
function diamondBar(game: Game) {
  const bar = h('div', 'wallet');
  const refresh = () => {
    const s = game.save;
    const chips = [h('span', 'chip', `💎 ${fmt(s.diamonds)}`)];
    if (s.tickets.pet > 0) chips.push(h('span', 'chip', `🐾 소환권 ${s.tickets.pet}`));
    if (s.tickets.gear > 0) chips.push(h('span', 'chip', `🎟️ 장비 소환권 ${s.tickets.gear}`));
    bar.replaceChildren(...chips);
  };
  return { el: bar, refresh };
}

/** 소환 결과: 카드가 하나씩 뒤집힌다 */
function showSummon(game: Game, host: UIHost, kind: 'pet' | 'gear', n: 1 | 10) {
  const res = game.summon(kind, n);
  if (!res) return host.toast('💎 다이아가 모자라요 (미션·출석으로 모아요)');
  const grid = h('div', 'summon-grid');
  res.forEach((r, i) => {
    const card = h('div', 'summon-card' + (r.isNew ? ' new' : ''));
    if ('skin' in r.def) {
      card.style.setProperty('--rar', RARITY_COLORS[r.def.rarity]);
      card.append(monsterPic(r.def.skin, 40));
    } else {
      card.append(h('div', 'summon-emoji', r.def.icon));
    }
    card.append(h('div', 'summon-name', r.def.name), h('div', 'summon-text', r.text));
    card.style.animationDelay = `${i * 0.08}s`;
    grid.append(card);
  });
  sfx.chest();
  host.openModal(
    h('div', 'modal-title', kind === 'pet' ? '동료 소환!' : '장비 소환!'),
    grid,
    host.button('한 번 더', '', () => showSummon(game, host, kind, n)),
    host.button('닫기', 'primary', () => host.closeModal()),
  );
  host.refresh();
}

function summonCard(game: Game, host: UIHost, kind: 'pet' | 'gear') {
  const card = h('div', 'card row summon-box');
  const title = kind === 'pet' ? '🐾 동료 소환' : '⚔️ 장비 소환';
  const sub = kind === 'pet' ? '보통 70% · 희귀 26% · 전설 4% · 겹치면 레벨 업' : '전설 제외 장비 · 겹치면 +1 강화';
  const info = h('div', 'info');
  info.append(h('div', 'title', title), h('div', 'sub', sub));
  const one = h('button', 'buy');
  const oneLabel = h('span');
  one.append(oneLabel, h('small', '', '1회'));
  one.addEventListener('click', () => showSummon(game, host, kind, 1));
  const ten = h('button', 'buy');
  ten.append(h('span', '', `💎 ${summonCost(10)}`), h('small', '', '10회'));
  ten.addEventListener('click', () => showSummon(game, host, kind, 10));
  const btns = h('div', 'skill-btns');
  btns.append(one, ten);
  card.append(info, btns);
  const refresh = () => {
    const t = game.save.tickets[kind];
    oneLabel.textContent = t > 0 ? `🎟️ ${t}` : `💎 ${summonCost(1)}`;
    one.disabled = t <= 0 && game.save.diamonds < summonCost(1);
    ten.disabled = game.save.diamonds < summonCost(10);
  };
  return { el: card, refresh };
}

/** 동료 보기 (상점 탭 안): 위에 함께하는 동료 칸 고정, 아래는 소환 + 동료 격자 (등급별) */
export function buildPetsTab(panel: HTMLElement, game: Game, host: UIHost) {
  const top = h('div', 'skill-top');
  const title = h('div', 'skill-top-title');
  const bar = h('div', 'equip-slots pet-slots');
  top.append(title, bar);
  const wallet = diamondBar(game);
  const summon = summonCard(game, host, 'pet');
  panel.append(top, wallet.el, summon.el);
  // null = 아직 안 그림 (동료가 하나도 없을 때도 빈 칸 3개는 그려야 한다)
  let key: string | null = null;
  const refreshTop = () => {
    const on = game.save.petsOn;
    title.textContent = `함께하는 동료 ${on.length}/${PET_SLOTS} · 방치·스테이지 둘 다 따라다녀요`;
    const k = on.join();
    if (k === key) return;
    key = k;
    const slots = [];
    for (let i = 0; i < PET_SLOTS; i++) {
      const def = PET_BY_ID[on[i]];
      const b = h('button', 'equip-slot' + (def ? '' : ' empty'));
      if (def) {
        const box = ibox(monsterPic(def.skin, 40), 'big');
        box.style.setProperty('--rar', RARITY_COLORS[def.rarity]);
        b.append(box, h('span', 'tile-name', def.name));
        b.addEventListener('click', () => showPet(game, host, def));
      } else {
        b.append(ibox('+', 'big empty'), h('span', 'tile-name', '빈 칸'));
      }
      slots.push(b);
    }
    bar.replaceChildren(...slots);
  };
  const tiles: (() => void)[] = [];
  for (const rarity of [2, 1, 0] as const) {
    const head = h('div', 'skill-type-head');
    head.style.setProperty('--type', RARITY_COLORS[rarity]);
    head.append(h('span', 'type-name', RARITY_NAMES[rarity]), h('span', 'type-desc', ['소환 70%', '소환 26%', '소환 4%'][rarity]));
    const grid = h('div', 'skill-grid');
    for (const def of PETS.filter((p) => p.rarity === rarity)) {
      const t = h('button', 'skill-tile');
      const box = ibox(monsterPic(def.skin, 38));
      box.style.setProperty('--rar', RARITY_COLORS[def.rarity]);
      const lv = h('span', 'tile-lv');
      t.append(box, lv, h('span', 'tile-name', def.name));
      t.addEventListener('click', () => showPet(game, host, def));
      grid.append(t);
      tiles.push(() => {
        const l = game.save.pets[def.id];
        t.classList.toggle('unlearned', !l);
        t.classList.toggle('equipped', game.save.petsOn.includes(def.id));
        lv.textContent = l ? `Lv${l}` : '';
      });
    }
    panel.append(head, grid);
  }
  panel.append(h('div', 'hint', `동료는 ${PET_SLOTS}마리까지 데리고 다녀요 · 소환에서 겹치면 레벨 업`));
  return () => {
    refreshTop();
    wallet.refresh();
    summon.refresh();
    tiles.forEach((f) => f());
  };
}

/** 동료 창: 효과, 데려가기 / 집에 두기 (칸이 가득이면 바꿀 동료 고르기) */
function showPet(game: Game, host: UIHost, def: PetDef) {
  const s = game.save;
  const lv = s.pets[def.id];
  const head = h('div', 'tree-head');
  const box = ibox(monsterPic(def.skin, 56), 'huge');
  box.style.setProperty('--rar', RARITY_COLORS[def.rarity]);
  const info = h('div', 'info');
  const name = h('div', 'modal-title', `${def.name} `);
  const rar = h('span', 'grade-badge', RARITY_NAMES[def.rarity]);
  rar.style.background = RARITY_COLORS[def.rarity];
  name.append(rar);
  info.append(
    name,
    h('div', 'modal-sub', lv ? `Lv ${lv}${lv >= PET_MAX ? ' (최대)' : ''}` : '아직 없음 · 소환에서 만나요'),
    h('div', 'modal-sub', petEffectText(def, lv || 1) + (lv && lv < PET_MAX ? `  →  Lv ${lv + 1}: ${petEffectText(def, lv + 1)}` : '')),
  );
  head.append(box, info);
  const btns: HTMLElement[] = [];
  const on = s.petsOn.includes(def.id);
  const done = (msg: string) => {
    host.toast(msg);
    host.refresh();
    host.closeModal();
  };
  if (lv && on) btns.push(host.button('집에 두기', '', () => game.togglePet(def.id) && done(`${def.name} 집에 두기`)));
  else if (lv && s.petsOn.length < PET_SLOTS) btns.push(host.button('데려가기', 'primary', () => game.togglePet(def.id) && done(`${def.name} 함께해요!`)));
  else if (lv) {
    btns.push(h('div', 'modal-sub', '칸이 가득 찼어요 · 누구와 바꿀까요?'));
    for (const id of s.petsOn) {
      const old = PET_BY_ID[id];
      if (old) btns.push(host.button(`${old.name} 대신`, '', () => game.togglePet(def.id, id) && done(`${old.name} → ${def.name}`)));
    }
  }
  host.openModal(head, ...btns, host.button('닫기', 'primary', () => host.closeModal()));
}

/** 꾸미기 미리보기: 병아리는 색 입힌 첫 프레임, 스킬 색은 화염구 */
function skinPreview(kind: 'chick' | 'fx', skin: SkinDef) {
  const box = h('div', 'skin-pic');
  box.style.background = skin.swatch;
  const src = kind === 'chick' ? SPRITES.hero.walk[2]?.frames[0] : SPRITES.fx.fireball;
  if (!src || (src instanceof HTMLImageElement && !src.complete)) return box;
  const c = h('canvas');
  c.width = c.height = 96;
  const ctx = c.getContext('2d')!;
  const rc = skin.recolor === 'rainbow' ? { shift: 160, sat: 1.1, light: 1, window: kind === 'chick' ? ([28, 62] as const) : undefined } : skin.recolor;
  const img = rc ? recolored(src, rc) : src;
  const w = src instanceof HTMLImageElement ? src.naturalWidth : src.width;
  const hgt = src instanceof HTMLImageElement ? src.naturalHeight : src.height;
  const k = Math.min(96 / w, 96 / hgt) * 0.9;
  ctx.drawImage(img, (96 - w * k) / 2, (96 - hgt * k) / 2, w * k, hgt * k);
  box.style.background = 'rgba(0,0,0,0.25)';
  box.style.borderBottom = `4px solid`;
  box.style.borderImage = `${skin.swatch.startsWith('linear') ? skin.swatch : `linear-gradient(${skin.swatch},${skin.swatch})`} 1`;
  box.append(c);
  return box;
}

function skinSection(panel: HTMLElement, game: Game, host: UIHost, kind: 'chick' | 'fx') {
  panel.append(h('div', 'section-title', kind === 'chick' ? '🐤 병아리 색' : '✨ 스킬 이펙트 색'));
  const grid = h('div', 'skin-grid');
  panel.append(grid);
  const list = kind === 'chick' ? CHICK_SKINS : FX_SKINS;
  const rows = list.map((skin) => {
    const card = h('button', 'skin-card');
    const label = h('div', 'skin-price');
    card.append(skinPreview(kind, skin), h('div', 'skin-name', skin.name), label);
    card.addEventListener('click', () => {
      const s = game.save;
      if (s.skins[kind].includes(skin.id)) game.wearSkin(kind, skin.id);
      else if (game.buySkin(kind, skin.id)) {
        host.toast(`${skin.name} 구매!`);
        sfx.coin();
      } else return host.toast('💎 다이아가 모자라요');
      host.refresh();
    });
    grid.append(card);
    return () => {
      const s = game.save;
      const owned = s.skins[kind].includes(skin.id);
      const on = (kind === 'chick' ? s.skins.chickOn : s.skins.fxOn) === skin.id;
      card.classList.toggle('on', on);
      label.textContent = on ? '사용 중' : owned ? '사용하기' : `💎 ${skinPrice(skin)}`;
    };
  });
  return () => rows.forEach((r) => r());
}

/** 상점 탭: 소환, 꾸미기, 다이아 충전(출시 때) */
/** 상점 탭 안의 보기: 상점 / 동료 (탭을 옮겨 다녀도 마지막 보기를 기억) */
type ShopView = 'pets' | 'summon' | 'deco';
let shopView: ShopView = 'pets';

/** 상점 탭: 위에 '동료 · 소환 · 치장' 고르기, 아래 그 내용 (마지막 보기를 기억) */
export function buildShopTab(panel: HTMLElement, game: Game, host: UIHost) {
  const seg = h('div', 'seg shop-seg');
  const body = h('div', 'shop-body');
  panel.append(seg, body);
  let inner: () => void = () => {};
  const btns = ([['pets', '🐾 동료'], ['summon', '🎲 소환'], ['deco', '✨ 치장']] as const).map(([id, name]) => {
    const b = h('button', 'seg-btn', name);
    b.addEventListener('click', () => {
      shopView = id;
      render();
    });
    seg.append(b);
    return { id, b };
  });
  const render = () => {
    for (const x of btns) x.b.classList.toggle('on', x.id === shopView);
    body.replaceChildren();
    panel.scrollTop = 0;
    inner = shopView === 'pets' ? buildPetsTab(body, game, host) : shopView === 'summon' ? buildSummonBody(body, game, host) : buildDecoBody(body, game, host);
    host.refresh();
  };
  render();
  return () => inner();
}

/** 소환 보기: 동료·장비 소환, 다이아 충전 */
function buildSummonBody(panel: HTMLElement, game: Game, host: UIHost) {
  const wallet = diamondBar(game);
  panel.append(wallet.el);

  const pet = summonCard(game, host, 'pet');
  const gear = summonCard(game, host, 'gear');
  panel.append(pet.el, gear.el);

  panel.append(h('div', 'section-title', '💎 다이아 충전'));
  const packs = h('div', 'skin-grid');
  for (const [d, won] of [[300, '1,200원'], [1500, '5,900원'], [4000, '14,000원']] as const) {
    const b = h('button', 'skin-card locked');
    b.append(h('div', 'skin-pic pack', '💎'), h('div', 'skin-name', `다이아 ${fmt(d)}`), h('div', 'skin-price', won));
    b.addEventListener('click', () => host.toast('결제는 출시 때 열려요'));
    packs.append(b);
  }
  panel.append(packs, h('div', 'hint', '결제는 출시 때 연결돼요 · 테스트 중엔 설정에서 다이아를 받을 수 있어요'));

  return () => {
    wallet.refresh();
    pet.refresh();
    gear.refresh();
  };
}

/** 치장 보기: 스킬 이펙트 색 */
function buildDecoBody(panel: HTMLElement, game: Game, host: UIHost) {
  const wallet = diamondBar(game);
  panel.append(wallet.el);
  const fx = skinSection(panel, game, host, 'fx');
  return () => {
    wallet.refresh();
    fx();
  };
}

type MissionTab = 'daily' | 'attend' | 'achieve' | 'pass';

/** 미션 창: 일일 미션 / 출석 / 업적 / 패스 */
export function showMissions(game: Game, host: UIHost, tab: MissionTab = 'daily') {
  const s = game.save;
  const tabs = h('div', 'seg');
  const body = h('div', 'mission-body');
  const names: [MissionTab, string][] = [['daily', '일일'], ['attend', '출석'], ['achieve', '업적'], ['pass', '패스']];
  const render = () => {
    tabs.replaceChildren(
      ...names.map(([id, name]) => {
        const b = h('button', 'seg-btn' + (id === tab ? ' on' : ''), name);
        b.addEventListener('click', () => {
          tab = id;
          render();
        });
        return b;
      }),
    );
    body.replaceChildren(...renderTab());
  };
  const claimBtn = (ready: boolean, done: boolean, label: string, fn: () => void) => {
    const b = h('button', 'claim' + (ready ? ' ready' : ''), done ? '완료' : label);
    b.disabled = !ready;
    b.addEventListener('click', () => {
      fn();
      sfx.coin();
      render();
      host.refresh();
    });
    return b;
  };
  const row = (title: string, sub: string, progress: number, btn: HTMLElement) => {
    const r = h('div', 'mission-row');
    const info = h('div', 'info');
    const bar = h('div', 'mission-bar');
    const fill = h('div', 'mission-fill');
    fill.style.width = `${Math.min(1, progress) * 100}%`;
    bar.append(fill);
    info.append(h('div', 'title', title), h('div', 'sub', sub), bar);
    r.append(info, btn);
    return r;
  };
  const renderTab = (): HTMLElement[] => {
    if (tab === 'daily') {
      const d = freshDaily(s);
      const out = DAILY_MISSIONS.map((m) =>
        row(m.name, `${fmt(Math.min(d.counts[m.id], m.goal))} / ${fmt(m.goal)} · 💎 ${m.diamonds}`, d.counts[m.id] / m.goal,
          claimBtn(game.missionReady(m.id), d.claimed.includes(m.id), '받기', () => game.claimMission(m.id))),
      );
      const doneN = DAILY_MISSIONS.filter((m) => d.claimed.includes(m.id)).length;
      out.push(row('모든 미션 완료', `${doneN} / ${DAILY_MISSIONS.length} · 💎 ${DAILY_ALL_BONUS}`, doneN / DAILY_MISSIONS.length,
        claimBtn(game.missionReady('all'), d.claimed.includes('all'), '받기', () => game.claimMission('all'))));
      out.push(h('div', 'hint', '매일 자정에 초기화 · 받을 때마다 패스 경험치 +20'));
      return out;
    }
    if (tab === 'attend') {
      const grid = h('div', 'attend-grid');
      const got = s.attend.days % ATTEND_REWARDS.length;
      const can = canAttend(s);
      ATTEND_REWARDS.forEach((r, i) => {
        // 이번 주기에서 이미 받은 날 (오늘 받았으면 7일째가 끝나도 다 받음 표시)
        const done = i < got || (!can && got === 0 && s.attend.days > 0);
        const today = can && i === got;
        grid.append(h('div', 'attend-day' + (done ? ' done' : '') + (today ? ' today' : ''), `${i + 1}일\n${r.label}`));
      });
      return [
        grid,
        claimBtn(can, false, can ? '오늘 출석 보상 받기' : '내일 또 와요', () => {
          const label = game.claimAttend();
          if (label) host.toast(`출석 보상: ${label}`);
        }),
        h('div', 'hint', `누적 출석 ${s.attend.days}일 · 7일마다 반복`),
      ];
    }
    if (tab === 'achieve') {
      return ACHIEVEMENTS.map((a) => {
        const got = s.achieve[a.id] ?? 0;
        const all = got >= a.goals.length;
        const goal = a.goals[Math.min(got, a.goals.length - 1)];
        const v = a.value(s);
        return row(`${a.name} ${'★'.repeat(got)}${'☆'.repeat(a.goals.length - got)}`, all ? '모두 달성!' : `${fmt(Math.min(v, goal))} / ${fmt(goal)} · 💎 ${a.diamonds}`,
          all ? 1 : v / goal, claimBtn(achieveReady(s, a), all, '받기', () => game.claimAchieve(a.id)));
      });
    }
    // 패스
    const lv = passLevel(s);
    const head = row(`패스 Lv ${lv} / ${PASS_LEVELS}`, lv >= PASS_LEVELS ? '최대 레벨!' : `다음 레벨까지 ${PASS_XP_PER_LEVEL - (s.pass.xp % PASS_XP_PER_LEVEL)} · 스테이지 도전·미션으로 올라요`,
      lv >= PASS_LEVELS ? 1 : (s.pass.xp % PASS_XP_PER_LEVEL) / PASS_XP_PER_LEVEL, h('span'));
    const list = h('div', 'pass-list');
    for (let i = 1; i <= PASS_LEVELS; i++) {
      const r = h('div', 'pass-row' + (i <= lv ? ' open' : ''));
      const free = passReward(i);
      const prem = h('div', 'pass-cell premium', `👑 ${i % 5 === 0 ? '💎 300' : '💎 50'}`);
      r.append(
        h('div', 'pass-lv', String(i)),
        claimBtn(game.passReady(i), s.pass.claimed.includes(i), free.label, () => game.claimPass(i)),
        prem,
      );
      list.append(r);
    }
    const premBtn = host.button('👑 프리미엄 패스 (결제 준비 중)', '', () => host.toast('결제는 출시 때 열려요'));
    return [head, premBtn, list];
  };
  render();
  host.openModal(h('div', 'modal-title', '미션'), tabs, body, host.button('닫기', 'primary', () => host.closeModal()));
}
