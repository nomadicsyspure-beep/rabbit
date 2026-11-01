import { fmt } from '../core/format';
import {
  REGIONS, REGION_NAMES, RELICS, RELIC_BY_ID, RELIC_MAX, RELIC_RARITY_COLORS, RELIC_RARITY_NAMES, RELIC_SLOTS, SETS, SLOT_UNLOCK, enhanceCost, relicEffectText,
  type RelicDef,
} from '../data/relics';
import { CHEST_NAMES, MATS, MAT_BY_ID, addReward, emptyReward, rewardText, type ChestGrade } from '../data/items';
import { sfx } from '../audio/sfx';
import type { Game } from '../game';
import { BOOSTERS, RECIPES, type BoosterId } from '../data/craft';
import type { MatId } from '../data/world';
import { COLLECTION_BONUS, REBIRTH_MIN_STAGE, REBIRTH_UPS, type RebirthUp } from '../game';
import { chickPic, coin, h, holdRepeat, ibox } from './dom';

// 가방 탭(유물 6칸 + 인벤토리), 제작 탭, 도감, 환생 화면.

/** 화면 쪽에서 필요한 것: 토스트, 전체 새로고침, 모달 열기/닫기 */
export interface UIHost {
  toast(msg: string): void;
  refresh(): void;
  openModal(...children: HTMLElement[]): HTMLElement;
  closeModal(): void;
  button(text: string, cls: string, fn: () => void): HTMLButtonElement;
  /** 열린 창을 화면 새로고침 때마다 다시 그린다 (창이 닫히면 풀린다) */
  setModalRefresh(fn: (() => void) | null): void;
  confirmButton(text: string, confirmText: string, fn: () => void): HTMLButtonElement;
}

/** 재료·다이아·정수 한 줄 */
export function walletBar(game: Game) {
  const bar = h('div', 'wallet');
  const refresh = () => {
    const s = game.save;
    const chips = MATS.filter((m) => (s.mats[m.id] ?? 0) > 0).map((m) => h('span', 'chip', `${m.icon} ${fmt(s.mats[m.id] ?? 0)}`));
    chips.push(h('span', 'chip', `💎 ${fmt(s.diamonds)}`));
    if (s.essence > 0) chips.push(h('span', 'chip', `🔮 ${fmt(s.essence)}`));
    bar.replaceChildren(...chips);
  };
  return { el: bar, refresh };
}

type InvTab = 'all' | 'chest' | 'relic' | 'mat';
const INV_TABS: [InvTab, string][] = [['all', '전체'], ['chest', '상자'], ['relic', '유물'], ['mat', '재료']];
const CHEST_ICONS = ['📦', '🎁', '💛'];
/** 인벤토리 칸 수 (최소, 한 줄 5칸) */
const INV_MIN_CELLS = 20;

/** 인벤토리 한 칸 */
interface InvItem {
  kind: InvTab;
  icon: string;
  count: string;
  name: string;
  cls?: string;
  onClick: () => void;
}

/** 유물 아이콘 틀 (등급 색) */
function relicBox(def: RelicDef, cls = '') {
  return ibox(def.icon, `rar-${def.rarity}` + (cls ? ' ' + cls : ''));
}

/** 가진 유물 (등급 높은 순) */
const ownedRelics = (game: Game) => RELICS.filter((r) => game.save.relics[r.id] !== undefined).sort((a, b) => b.rarity - a.rarity);

/**
 * 가방 탭: 위에 병아리 + 유물 6칸 고정 (왼쪽 3칸 · 오른쪽 3칸, 칸은 스테이지 따라 열린다),
 * 칸을 누르면 그 유물 (빈 칸이면 고르기), 꾹 누르면 바꾸기. 아래는 인벤토리 (상자·유물·재료, 상자는 눌러서 하나씩 연다)
 */
export function buildBagTab(panel: HTMLElement, game: Game, host: UIHost) {
  const top = h('div', 'skill-top gear-top');
  const left = h('div', 'gear-col');
  const right = h('div', 'gear-col');
  const mid = h('div', 'gear-mid');
  const statLine = h('div', 'gear-stats');
  mid.append(chickPic(92, true), statLine);
  top.append(left, mid, right);
  panel.append(top, h('div', 'hint gear-hint', '칸을 누르면 유물 보기 · 꾹 누르면 바꾸기 · 같은 지역 유물 2·4·6개 = 세트'));
  const slotEls = Array.from({ length: RELIC_SLOTS }, (_, i) => {
    const b = h('button', 'gear-slot');
    const tapSlot = () => {
      if (!game.slotUnlocked(i)) return host.toast(`🔒 스테이지 ${SLOT_UNLOCK[i]}을 깨면 열려요`);
      const id = game.save.relicSlots[i];
      if (id) showRelic(game, host, RELIC_BY_ID[id]);
      else showSlotPicker(game, host, i);
    };
    longPress(b, () => (game.slotUnlocked(i) ? showSlotPicker(game, host, i) : tapSlot()), tapSlot);
    (i < 3 ? left : right).append(b);
    return b;
  });
  let key = '';
  const refreshTop = () => {
    const s = game.save;
    const k = s.relicSlots.map((id, i) => `${game.slotUnlocked(i)}${id ?? ''}+${id ? s.relics[id] : ''}`).join();
    if (k !== key) {
      key = k;
      slotEls.forEach((b, i) => {
        const id = s.relicSlots[i];
        const def = id ? RELIC_BY_ID[id] : null;
        if (!game.slotUnlocked(i)) {
          b.replaceChildren(ibox('🔒', 'big empty'), h('span', 'tile-name', `스테이지 ${SLOT_UNLOCK[i]}`));
        } else if (!def) {
          b.replaceChildren(ibox('➕', 'big empty'), h('span', 'tile-name', '빈 칸'));
        } else {
          const box = relicBox(def, 'big');
          box.append(h('span', 'ibox-lv', `+${s.relics[def.id] ?? 0}`));
          b.replaceChildren(box, h('span', 'tile-name', def.name));
        }
      });
    }
    const bo = game.bonus;
    const st = game.stats;
    // 켜진 세트 (같은 지역 유물 2·4·6개)
    const sets = game.relicSets.map((set) => h('div', 'gear-set-line', `🔗 ${set.name} ${set.count}/6 · ${set.active.map((b) => b.text).join(' · ')}`));
    statLine.replaceChildren(
      h('div', '', `❤️ 체력 ${fmt(st.hp)}`),
      h('div', '', `⚔️ 공격력 ${fmt(st.atk)}`),
      h('div', '', `🎯 치명타 +${Math.round(bo.crit * 100)}% · 👟 +${Math.round(bo.speed * 100)}%`),
      ...sets,
    );
  };

  // ---- 인벤토리 ----
  const inv = h('div', 'card inventory');
  const tabs = h('div', 'seg inv-tabs');
  const grid = h('div', 'inv-grid');
  inv.append(h('div', 'inv-title', '🎒 인벤토리'), tabs, grid);
  panel.append(inv);
  let tab: InvTab = 'all';
  const tabBtns = INV_TABS.map(([id, name]) => {
    const b = h('button', 'seg-btn', name);
    b.addEventListener('click', () => {
      tab = id;
      invKey = '';
      refreshInv();
    });
    tabs.append(b);
    return { id, b };
  });
  const items = (): InvItem[] => {
    const s = game.save;
    const out: InvItem[] = [];
    game.chestCounts.forEach((n, g) => {
      if (n > 0) out.push({ kind: 'chest', icon: CHEST_ICONS[g], count: `×${n}`, name: CHEST_NAMES[g], cls: `chest-${g}`, onClick: () => showChestOpen(game, host, g as ChestGrade, 1) });
    });
    for (const def of ownedRelics(game)) {
      const on = game.isRelicOn(def.id);
      out.push({ kind: 'relic', icon: def.icon, count: `+${s.relics[def.id]}`, name: def.name, cls: `rar-${def.rarity}` + (on ? ' on' : ''), onClick: () => showRelic(game, host, def) });
    }
    for (const m of MATS) {
      const n = s.mats[m.id] ?? 0;
      if (n > 0) out.push({ kind: 'mat', icon: m.icon, count: fmt(n), name: m.name, onClick: () => host.toast(`${m.icon} ${m.name} ${fmt(n)}개 · ${m.id === 'skillbook' ? '스킬 은 상자 1회' : '유물 제작·강화 재료'}`) });
    }
    if (s.shards > 0) out.push({ kind: 'mat', icon: '🧩', count: fmt(s.shards), name: '스킬 조각', onClick: () => host.toast('🧩 스킬 조각: 스킬 탭 조각 교환에서 원하는 스킬과 바꿔요') });
    for (const [b, n] of Object.entries(s.boosters)) {
      const def = BOOSTERS[b as BoosterId];
      if (n && def) out.push({ kind: 'mat', icon: def.icon, count: `×${n}`, name: def.name, onClick: () => host.toast(`${def.icon} ${def.name}: ${def.desc} (스테이지에 들어가면 자동으로)`) });
    }
    if (s.essence > 0) out.push({ kind: 'mat', icon: '🔮', count: fmt(s.essence), name: '보스의 정수', onClick: () => host.toast('🔮 보스의 정수: 전설 유물 재료 (보스 레이드)') });
    if (s.tickets.pet > 0) out.push({ kind: 'mat', icon: '🐾', count: `×${s.tickets.pet}`, name: '동료 소환권', onClick: () => host.toast('상점 동료 소환에 먼저 써요') });
    if (s.tickets.relic > 0) out.push({ kind: 'mat', icon: '🎟️', count: `×${s.tickets.relic}`, name: '유물 소환권', onClick: () => host.toast('상점 유물 소환에 먼저 써요') });
    return out.filter((it) => tab === 'all' || it.kind === tab);
  };
  let invKey = '';
  const refreshInv = () => {
    for (const t of tabBtns) t.b.classList.toggle('on', t.id === tab);
    const list = items();
    const k = tab + '|' + list.map((it) => it.name + it.count + it.cls).join();
    if (k === invKey) return;
    invKey = k;
    const cells: HTMLElement[] = list.map((it) => {
      const c = h('button', 'inv-cell');
      const box = ibox(it.icon, it.cls ?? '');
      box.append(h('span', 'ibox-lv', it.count));
      c.append(box, h('span', 'tile-name', it.name));
      c.addEventListener('click', it.onClick);
      return c;
    });
    const empty = Math.max(INV_MIN_CELLS - cells.length, (5 - (cells.length % 5)) % 5);
    for (let i = 0; i < empty; i++) {
      const c = h('div', 'inv-cell');
      c.append(ibox('', 'blank'));
      cells.push(c);
    }
    grid.replaceChildren(...cells);
  };
  return () => {
    refreshTop();
    refreshInv();
  };
}

/** 제작 탭: 위에 재료, 레시피, 아래 지역(세트)별 유물 격자 (누르면 만들기·강화·끼우기 창). 초록 점 = 지금 만들 수 있음 */
export function buildCraftTab(panel: HTMLElement, game: Game, host: UIHost) {
  const wallet = walletBar(game);
  panel.append(wallet.el);
  const tiles: (() => void)[] = [wallet.refresh];
  // 레시피: 재료 → 열쇠 · 스킬 조각 · 부스터 (부스터는 다음 스테이지에 자동으로)
  const rhead = h('div', 'skill-type-head');
  rhead.style.setProperty('--type', '#7cf2a0');
  rhead.append(h('span', 'type-name', '🧪 레시피'), h('span', 'type-desc', '재료로 열쇠·조각·부스터 만들기'));
  const rlist = h('div', 'recipe-list');
  for (const r of RECIPES) {
    const card = h('div', 'card recipe');
    const info = h('div', 'info');
    const owned = h('span', 'recipe-owned');
    const name = h('div', 'title', `${r.icon} ${r.name} `);
    name.append(owned);
    const cost = h('div', 'sub');
    info.append(name, h('div', 'recipe-desc', r.desc), cost);
    const btn = h('button', 'buy');
    btn.append(h('span', '', '만들기'));
    holdRepeat(btn, () => {
      const ok = game.craftRecipe(r);
      if (ok) {
        host.toast(`${r.icon} ${r.name} 제작!`);
        host.refresh();
      }
      return ok;
    });
    card.append(info, btn);
    rlist.append(card);
    tiles.push(() => {
      const s = game.save;
      cost.replaceChildren(...Object.entries(r.cost).map(([m, n]) => {
        const have = s.mats[m as MatId] ?? 0;
        return h('span', 'recipe-cost' + (have >= (n ?? 0) ? '' : ' lack'), `${MAT_BY_ID[m as MatId].icon} ${fmt(have)}/${n}`);
      }));
      const b = r.gives.booster;
      owned.textContent = b ? `보유 ${s.boosters[b] ?? 0}` : r.gives.shards ? `보유 🧩 ${fmt(s.shards)}` : r.gives.mats ? `보유 ${Object.keys(r.gives.mats).map((m) => s.mats[m as MatId] ?? 0).join('')}` : '';
      btn.disabled = !game.canCraftRecipe(r);
    });
  }
  panel.append(rhead, rlist);
  const ghead = h('div', 'skill-type-head');
  ghead.style.setProperty('--type', '#c78bff');
  ghead.append(h('span', 'type-name', '🔮 유물 제작'), h('span', 'type-desc', '지역 재료로 · 같은 지역 2·4·6개 = 세트'));
  panel.append(ghead);
  for (const region of REGIONS) {
    const mat = MAT_BY_ID[region];
    const relics = RELICS.filter((r) => r.region === region);
    const head = h('div', 'skill-type-head');
    head.style.setProperty('--type', RELIC_RARITY_COLORS[relics[0].rarity]);
    const setCount = h('span', 'type-desc');
    head.append(h('span', 'type-name', `${mat.icon} ${SETS[region].name}`), setCount);
    const grid = h('div', 'skill-grid');
    for (const def of relics) {
      const t = h('button', 'skill-tile');
      const lv = h('span', 'tile-lv');
      t.append(relicBox(def), lv, h('span', 'tile-name', def.name));
      t.addEventListener('click', () => showRelic(game, host, def));
      grid.append(t);
      tiles.push(() => {
        const plus = game.save.relics[def.id];
        const owned = plus !== undefined;
        t.classList.toggle('unlearned', !owned);
        t.classList.toggle('equipped', game.isRelicOn(def.id));
        t.classList.toggle('can-make', !owned && game.canCraftRelic(def.id));
        lv.textContent = owned ? `+${plus}` : '';
      });
    }
    tiles.push(() => {
      const have = relics.filter((r) => game.save.relics[r.id] !== undefined).length;
      setCount.textContent = `${REGION_NAMES[region]} 유물 ${have}/6 · ${mat.icon} ${fmt(game.save.mats[region] ?? 0)}`;
    });
    panel.append(head, grid);
  }
  panel.append(h('div', 'hint', '재료는 스테이지 보물 상자·재료 던전에서 · 초록 점 = 지금 만들 수 있음 · 끼우기는 가방 탭에서도'));
  return () => tiles.forEach((f) => f());
}

/** 꾹 누르면 long, 짧게 누르면 tap */
function longPress(el: HTMLElement, long: () => void, tap: () => void) {
  let t = 0;
  let fired = false;
  el.addEventListener('pointerdown', () => {
    fired = false;
    t = window.setTimeout(() => {
      fired = true;
      long();
    }, 450);
  });
  const cancel = () => clearTimeout(t);
  el.addEventListener('pointerleave', cancel);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('click', () => {
    clearTimeout(t);
    if (!fired) tap();
  });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

/** 칸에 끼울 유물 고르기: 가진 유물 격자 (누르면 그 칸에 끼운다) */
function showSlotPicker(game: Game, host: UIHost, slot: number) {
  const grid = h('div', 'skill-grid');
  const cur = game.save.relicSlots[slot];
  const list = ownedRelics(game);
  for (const def of list) {
    const t = h('button', 'skill-tile');
    t.append(relicBox(def), h('span', 'tile-lv', `+${game.save.relics[def.id]}`), h('span', 'tile-name', def.name));
    t.classList.toggle('equipped', game.isRelicOn(def.id));
    t.addEventListener('click', () => {
      if (def.id !== cur) game.equipRelic(def.id, slot);
      host.closeModal();
      host.toast(`${def.icon} ${def.name} 끼움`);
      host.refresh();
    });
    grid.append(t);
  }
  const btns: HTMLElement[] = [];
  if (cur) {
    btns.push(host.button('이 칸 비우기', '', () => {
      game.unequipRelic(cur);
      host.closeModal();
      host.refresh();
    }));
  }
  host.openModal(
    h('div', 'modal-title', `유물 칸 ${slot + 1}`),
    h('div', 'modal-sub', list.length ? '누르면 이 칸에 끼워요 · 테두리 = 다른 칸에 끼운 것 (옮겨요)' : '아직 유물이 없어요 · 제작 탭에서 만들거나 상점 유물 소환으로 얻어요'),
    grid,
    ...btns,
    host.button('닫기', 'primary', () => host.closeModal()),
  );
}

/** 칸이 다 찼을 때: 어느 칸과 바꿀지 고르기 */
function showReplacePicker(game: Game, host: UIHost, def: RelicDef) {
  const grid = h('div', 'skill-grid');
  game.equippedRelics.forEach((r) => {
    const t = h('button', 'skill-tile');
    t.append(relicBox(r.def), h('span', 'tile-lv', `+${r.plus}`), h('span', 'tile-name', r.def.name));
    t.addEventListener('click', () => {
      game.equipRelic(def.id, r.slot);
      host.closeModal();
      host.toast(`${r.def.name} → ${def.name}`);
      host.refresh();
    });
    grid.append(t);
  });
  host.openModal(
    h('div', 'modal-title', `${def.icon} ${def.name} 끼우기`),
    h('div', 'modal-sub', '칸이 다 찼어요 · 뺄 유물을 고르세요'),
    grid,
    host.button('닫기', 'primary', () => host.closeModal()),
  );
}

/** 유물 창: 효과, 지역 세트, 제작 / 강화, 끼우기 / 빼기 */
function showRelic(game: Game, host: UIHost, def: RelicDef) {
  const head = h('div', 'tree-head');
  const info = h('div', 'info');
  const name = h('div', 'modal-title');
  const eff = h('div', 'modal-sub');
  const cost = h('div', 'modal-sub');
  const tag = h('div', 'modal-sub relic-tag', `${RELIC_RARITY_NAMES[def.rarity]} · ${REGION_NAMES[def.region]} 유물`);
  tag.style.color = RELIC_RARITY_COLORS[def.rarity];
  info.append(name, tag, h('div', 'modal-sub relic-lore', `“${def.lore}”`), eff, cost);
  head.append(relicBox(def, 'huge'), info);
  // 이 유물의 지역 세트: 같은 지역 유물을 몇 개 꼈는지, 켜진 효과
  const setInfo = h('div', 'gear-set');
  const set = SETS[def.region];
  const renderSet = () => {
    const on = game.equippedRelics.filter((r) => r.def.region === def.region).length;
    setInfo.replaceChildren(h('div', 'title', `🔗 ${set.name} (지금 ${on}개)`));
    for (const b of set.bonuses) setInfo.append(h('div', 'gear-set-row' + (on >= b.need ? ' on' : ''), `${b.need}개: ${b.text}`));
  };
  const main = h('button', 'buy wide');
  const mainLabel = h('span');
  const mainSmall = h('small');
  main.append(mainLabel, mainSmall);
  holdRepeat(main, () => {
    const owned = game.save.relics[def.id] !== undefined;
    const ok = owned ? game.enhanceRelic(def.id) : game.craftRelic(def.id);
    if (ok && !owned) {
      sfx.chest();
      host.toast(`${def.icon} ${def.name} 제작!`);
    }
    if (ok) host.refresh();
    return ok && owned;
  });
  const wear = host.button('', 'primary', () => {
    if (game.isRelicOn(def.id)) game.unequipRelic(def.id);
    else if (!game.equipRelic(def.id)) return showReplacePicker(game, host, def);
    host.refresh();
  });
  const render = () => {
    const s = game.save;
    const plus = s.relics[def.id];
    const owned = plus !== undefined;
    const mat = MAT_BY_ID[def.region];
    name.textContent = owned ? `${def.name} +${plus}` : def.name;
    eff.textContent = owned && plus < RELIC_MAX
      ? `${relicEffectText(def, plus)}  →  +${plus + 1}: ${relicEffectText(def, plus + 1)}`
      : relicEffectText(def, plus ?? 0);
    if (!owned) {
      cost.textContent = `제작: ${mat.icon} ${def.matCost}${def.essence ? ` · 🔮 ${def.essence}` : ''} (보유 ${fmt(s.mats[def.region] ?? 0)})`;
      mainLabel.replaceChildren(coin(fmt(def.goldCost)));
      mainSmall.textContent = '제작';
      main.disabled = !game.canCraftRelic(def.id);
    } else if (plus >= RELIC_MAX) {
      cost.textContent = '최대 강화';
      mainLabel.textContent = 'MAX';
      mainSmall.textContent = '';
      main.disabled = true;
    } else {
      const c = enhanceCost(def, plus);
      cost.textContent = `강화: ${mat.icon} ${c.mat}${c.essence ? ` · 🔮 ${c.essence}` : ''} (보유 ${fmt(s.mats[def.region] ?? 0)}) · 효과 +15%`;
      mainLabel.replaceChildren(coin(fmt(c.gold)));
      mainSmall.textContent = '강화 (누르고 있으면 연속)';
      main.disabled = !game.canEnhanceRelic(def.id);
    }
    const on = game.isRelicOn(def.id);
    const free = s.relicSlots.some((x, i) => !x && game.slotUnlocked(i));
    wear.textContent = on ? '빼기' : free ? '끼우기' : '바꿔 끼우기';
    wear.disabled = !owned;
    renderSet();
  };
  render();
  host.openModal(head, setInfo, main, wear, host.button('닫기', '', () => host.closeModal()));
  host.setModalRefresh(render);
}

const MONSTER_NAMES: Record<string, string> = {
  slime: '슬라임', sprout: '새싹', mushroom: '버섯', bat: '박쥐', angel: '천사 유령',
  golem: '돌 골렘', snail: '달팽이 토끼', rabbit: '토끼 전사', devil: '악마 마왕', firstaid: '구급상자',
};

/** 도감: 잡은 몬스터·얻은 유물 하나마다 공격력·체력 +1% */
export function showCollection(game: Game, host: UIHost) {
  const s = game.save;
  const grid = (title: string, items: [string, boolean][]) => {
    const box = h('div', 'collection');
    box.append(h('div', 'section-title', title));
    const g = h('div', 'collection-grid');
    for (const [label, ok] of items) g.append(h('div', 'collection-item' + (ok ? ' ok' : ''), ok ? label : '???'));
    box.append(g);
    return box;
  };
  const total = Object.keys(MONSTER_NAMES).length + RELICS.length;
  host.openModal(
    h('div', 'modal-title', '도감'),
    h('div', 'modal-sub', `${game.collectionCount} / ${total} · 공격력·체력 +${Math.round(game.collectionCount * COLLECTION_BONUS * 100)}%`),
    grid('몬스터', Object.entries(MONSTER_NAMES).map(([k, v]) => [v, s.seen.monsters.includes(k)])),
    grid('유물', RELICS.map((g) => [`${g.icon} ${g.name}`, s.seen.relics.includes(g.id)])),
    host.button('닫기', 'primary', () => host.closeModal()),
  );
}

/** 환생: 깃털을 받고 처음부터, 깃털로 영구 강화 */
export function showRebirth(game: Game, host: UIHost) {
  const s = game.save;
  const info = h('div', 'result-stats');
  const ups = h('div', 'cards');
  const render = () => {
    info.replaceChildren(
      h('div', 'result-row', `환생 ${s.rebirth.count}번 · 환생 깃털 ${s.rebirth.feathers}개`),
      h('div', 'result-row', game.rebirthGain > 0
        ? `지금 환생하면 깃털 +${game.rebirthGain} (최고 스테이지 ${s.maxStage})`
        : `최고 스테이지 ${REBIRTH_MIN_STAGE}부터 환생할 수 있어요 (지금 ${s.maxStage})`),
    );
    ups.replaceChildren(
      ...(Object.keys(REBIRTH_UPS) as RebirthUp[]).map((k) => {
        const up = REBIRTH_UPS[k];
        const lv = s.rebirth.ups[k];
        const row = h('div', 'tree-row');
        const text = h('div', 'info');
        text.append(h('div', 'title', `${up.name} Lv ${lv}`), h('div', 'sub', `+${Math.round(up.per * lv * 100)}% → +${Math.round(up.per * (lv + 1) * 100)}%`));
        const btn = h('button', 'buy');
        btn.append(h('span', '', `🪶 ${game.rebirthUpCost(k)}`), h('small', '', '강화'));
        btn.disabled = s.rebirth.feathers < game.rebirthUpCost(k);
        btn.addEventListener('click', () => {
          if (game.upgradeRebirth(k)) render();
        });
        row.append(text, btn);
        return row;
      }),
    );
  };
  render();
  host.openModal(
    h('div', 'modal-title', '환생'),
    h('div', 'modal-sub', '골드·최고 스테이지·능력치 강화가 처음으로 돌아가요. 스킬·유물·재료·다이아·레벨은 그대로'),
    info,
    ups,
    host.confirmButton('환생하기', '정말 환생? 한 번 더 누르세요', () => {
      if (game.rebirth()) {
        host.toast('환생했어요! 깃털로 영구 강화를 올려 보세요');
        host.closeModal();
        host.refresh();
      } else host.toast(`최고 스테이지 ${REBIRTH_MIN_STAGE}부터 환생할 수 있어요`);
    }),
    host.button('닫기', 'primary', () => host.closeModal()),
  );
}

/** 가방 상자 열기: 그 등급 상자를 n개 열고, 상자가 흔들리다 펑 (보상은 이미 받은 상태). 남았으면 이어서 열기 */
function showChestOpen(game: Game, host: UIHost, grade: ChestGrade, n: number) {
  const res = game.openChests(grade, n);
  if (res.length === 0) return host.closeModal();
  const row = h('div', 'chest-row');
  const total = emptyReward();
  res.forEach((c, i) => {
    addReward(total, c.reward);
    const el = h('div', `chest-item grade-${c.grade} shake`);
    el.append(h('span', 'chest-emoji', CHEST_ICONS[c.grade]), h('span', '', CHEST_NAMES[c.grade]));
    setTimeout(() => {
      el.classList.remove('shake');
      el.classList.add('opened');
    }, 350 + i * 70);
    row.append(el);
  });
  sfx.chest();
  const left = game.chestCounts[grade];
  const more: HTMLElement[] = [];
  if (left > 0) {
    more.push(host.button(`하나 더 열기 (남은 ${left}개)`, '', () => showChestOpen(game, host, grade, 1)));
    if (left > 1) more.push(host.button(`${Math.min(10, left)}개 열기`, '', () => showChestOpen(game, host, grade, 10)));
  }
  host.openModal(
    h('div', 'modal-title win', `${CHEST_NAMES[grade]} ${res.length > 1 ? `${res.length}개 ` : ''}열기!`),
    row,
    h('div', 'chest-total', `얻은 것: ${[rewardText(total), `🪙 ${fmt(total.gold)}`].filter(Boolean).join(' · ')}`),
    ...more,
    host.button('닫기', 'primary', () => host.closeModal()),
  );
  host.refresh();
}
