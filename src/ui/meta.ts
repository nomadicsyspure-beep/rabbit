import { fmt } from '../core/format';
import { GEAR, GEAR_BY_ID, GEAR_MAX, GEAR_SLOTS, SLOT_ICONS, SLOT_NAMES, enhanceCost, gearEffectText, type GearDef, type GearSlot } from '../data/gear';
import { CHEST_NAMES, MATS, MAT_BY_ID, addReward, emptyReward, rewardText, type ChestGrade, type Reward } from '../data/items';
import { sfx } from '../audio/sfx';
import type { Game } from '../game';
import { COLLECTION_BONUS, REBIRTH_MIN_STAGE, REBIRTH_UPS, type RebirthUp } from '../game';
import { chickPic, coin, h, holdRepeat, ibox } from './dom';

// 가방 탭(장비 6칸 + 인벤토리), 도감, 환생 화면.

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

type InvTab = 'all' | 'gear' | 'mat' | 'chest';
const INV_TABS: [InvTab, string][] = [['all', '전체'], ['gear', '장비'], ['mat', '재료'], ['chest', '상자']];
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

/**
 * 가방 탭: 위에 병아리 + 장비 6칸 고정 (왼쪽 무기·장갑·신발 / 오른쪽 모자·망토·장신구),
 * 칸을 누르면 그 장비 (빈 칸이면 고르기), 꾹 누르면 바꾸기. 아래는 인벤토리 (장비·재료·상자, 상자는 한꺼번에 열기)
 */
export function buildGearTab(panel: HTMLElement, game: Game, host: UIHost) {
  const top = h('div', 'skill-top gear-top');
  const left = h('div', 'gear-col');
  const right = h('div', 'gear-col');
  const mid = h('div', 'gear-mid');
  const statLine = h('div', 'gear-stats');
  mid.append(chickPic(92, true), statLine);
  top.append(left, mid, right);
  panel.append(top, h('div', 'hint gear-hint', '칸을 누르면 장비 보기 · 꾹 누르면 바꾸기'));
  const slotEls = GEAR_SLOTS.map((slot, i) => {
    const b = h('button', 'gear-slot');
    longPress(b, () => showSlotPicker(game, host, slot), () => {
      const w = game.worn(slot);
      if (w) showGear(game, host, w.def);
      else showSlotPicker(game, host, slot);
    });
    (i < 3 ? left : right).append(b);
    return { slot, b };
  });
  let key = '';
  const refreshTop = () => {
    const s = game.save;
    const k = GEAR_SLOTS.map((sl) => `${s.wear[sl] ?? ''}+${s.gear[s.wear[sl] ?? ''] ?? ''}`).join();
    if (k !== key) {
      key = k;
      for (const { slot, b } of slotEls) {
        const w = game.worn(slot);
        const box = ibox(w ? w.def.icon : SLOT_ICONS[slot], 'big' + (w ? '' : ' empty'));
        if (w?.def.essence) box.classList.add('legend');
        if (w) box.append(h('span', 'ibox-lv', `+${w.plus}`));
        b.replaceChildren(box, h('span', 'tile-name', w ? w.def.name : SLOT_NAMES[slot]));
      }
    }
    const bo = game.bonus;
    const st = game.stats;
    statLine.replaceChildren(
      h('div', '', `❤️ 체력 ${fmt(st.hp)}`),
      h('div', '', `⚔️ 공격력 ${fmt(st.atk)}`),
      h('div', '', `🎯 치명타 +${Math.round(bo.crit * 100)}% · 👟 +${Math.round(bo.speed * 100)}%`),
    );
  };

  // ---- 인벤토리 ----
  const inv = h('div', 'card inventory');
  const tabs = h('div', 'seg inv-tabs');
  const openAll = host.button('', 'primary', () => {
    const res = game.openAllChests();
    if (res.length === 0) return;
    showChestOpen(host, res);
    host.refresh();
  });
  const grid = h('div', 'inv-grid');
  inv.append(h('div', 'inv-title', '🎒 인벤토리'), tabs, openAll, grid);
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
      if (n > 0) out.push({ kind: 'chest', icon: CHEST_ICONS[g], count: `×${n}`, name: CHEST_NAMES[g], cls: `chest-${g}`, onClick: () => host.toast(`${CHEST_NAMES[g]} ${n}개 · 위의 '상자 모두 열기'로 열어요`) });
    });
    for (const def of GEAR) {
      const plus = s.gear[def.id];
      if (plus === undefined) continue;
      out.push({ kind: 'gear', icon: def.icon, count: `+${plus}`, name: def.name, cls: def.essence ? 'legend' : '', onClick: () => showGear(game, host, def) });
    }
    for (const m of MATS) {
      const n = s.mats[m.id] ?? 0;
      if (n > 0) out.push({ kind: 'mat', icon: m.icon, count: fmt(n), name: m.name, onClick: () => host.toast(`${m.icon} ${m.name} ${fmt(n)}개 · ${m.id === 'skillbook' ? '스킬 은 상자 1회' : '장비 제작·강화 재료'}`) });
    }
    if (s.essence > 0) out.push({ kind: 'mat', icon: '🔮', count: fmt(s.essence), name: '보스의 정수', onClick: () => host.toast('🔮 보스의 정수: 전설 장비 재료 (보스 레이드)') });
    if (s.tickets.pet > 0) out.push({ kind: 'mat', icon: '🐾', count: `×${s.tickets.pet}`, name: '동료 소환권', onClick: () => host.toast('동료 탭에서 소환할 때 먼저 써요') });
    if (s.tickets.gear > 0) out.push({ kind: 'mat', icon: '🎟️', count: `×${s.tickets.gear}`, name: '장비 소환권', onClick: () => host.toast('상점 장비 소환에 먼저 써요') });
    return out.filter((it) => tab === 'all' || it.kind === tab);
  };
  let invKey = '';
  const refreshInv = () => {
    for (const t of tabBtns) t.b.classList.toggle('on', t.id === tab);
    const n = game.chestCounts.reduce((a, b) => a + b, 0);
    openAll.textContent = n > 0 ? `상자 모두 열기 (${n}개)` : '열 상자가 없어요';
    openAll.disabled = n === 0;
    const list = items();
    const k = tab + '|' + list.map((it) => it.name + it.count).join();
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

/** 제작 탭: 위에 재료, 아래 부위별 장비 격자 (누르면 만들기·강화·착용 창). 초록 점 = 지금 만들 수 있음 */
export function buildCraftTab(panel: HTMLElement, game: Game, host: UIHost) {
  const wallet = walletBar(game);
  panel.append(wallet.el);
  const tiles: (() => void)[] = [wallet.refresh];
  for (const slot of GEAR_SLOTS) {
    const head = h('div', 'skill-type-head');
    head.style.setProperty('--type', '#ffd166');
    head.append(h('span', 'type-name', `${SLOT_ICONS[slot]} ${SLOT_NAMES[slot]}`));
    const grid = h('div', 'skill-grid');
    for (const def of GEAR.filter((g) => g.slot === slot)) {
      const t = h('button', 'skill-tile');
      const lv = h('span', 'tile-lv');
      t.append(ibox(def.icon, def.essence ? 'legend' : ''), lv, h('span', 'tile-name', def.name));
      t.addEventListener('click', () => showGear(game, host, def));
      grid.append(t);
      tiles.push(() => {
        const plus = game.save.gear[def.id];
        const owned = plus !== undefined;
        t.classList.toggle('unlearned', !owned);
        t.classList.toggle('equipped', game.save.wear[slot] === def.id);
        t.classList.toggle('can-make', !owned && game.canCraft(def.id));
        lv.textContent = owned ? `+${plus}` : '';
      });
    }
    panel.append(head, grid);
  }
  panel.append(h('div', 'hint', '재료는 스테이지 보물 상자·재료 던전에서 · 초록 점 = 지금 만들 수 있음 · 착용은 가방 탭에서도'));
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

/** 장비 칸 바꾸기: 그 부위 장비 격자 (누르면 장비 창) */
function showSlotPicker(game: Game, host: UIHost, slot: GearSlot) {
  const grid = h('div', 'skill-grid');
  for (const def of GEAR.filter((g) => g.slot === slot)) {
    const t = h('button', 'skill-tile');
    const plus = game.save.gear[def.id];
    const box = ibox(def.icon, def.essence ? 'legend' : '');
    t.append(box, h('span', 'tile-lv', plus !== undefined ? `+${plus}` : ''), h('span', 'tile-name', def.name));
    t.classList.toggle('unlearned', plus === undefined);
    t.classList.toggle('equipped', game.save.wear[slot] === def.id);
    t.classList.toggle('can-make', plus === undefined && game.canCraft(def.id));
    t.addEventListener('click', () => showGear(game, host, def));
    grid.append(t);
  }
  host.openModal(
    h('div', 'modal-title', `${SLOT_ICONS[slot]} ${SLOT_NAMES[slot]} 바꾸기`),
    h('div', 'modal-sub', '장비를 눌러 만들기·강화·착용 · 초록 점 = 지금 만들 수 있음'),
    grid,
    host.button('닫기', 'primary', () => host.closeModal()),
  );
}

/** 상자 열기 연출: 상자가 흔들리다 펑 (보상은 이미 받은 상태) */
function showChestOpen(host: UIHost, chests: { grade: ChestGrade; reward: Reward }[]) {
  const row = h('div', 'chest-row');
  const total = emptyReward();
  chests.forEach((c, i) => {
    addReward(total, c.reward);
    const el = h('div', `chest-item grade-${c.grade}`);
    el.append(h('span', 'chest-emoji', CHEST_ICONS[c.grade]), h('span', '', CHEST_NAMES[c.grade]));
    el.classList.add('shake');
    setTimeout(() => {
      el.classList.remove('shake');
      el.classList.add('opened');
    }, 300 + i * 60);
    row.append(el);
  });
  sfx.chest();
  host.openModal(
    h('div', 'modal-title win', `상자 ${chests.length}개 열기!`),
    row,
    h('div', 'chest-total', `얻은 것: ${rewardText(total) || '골드'}  ·  ` + `골드 +${fmt(total.gold)}`),
    host.button('닫기', 'primary', () => host.closeModal()),
  );
}

/** 장비 창: 효과, 제작 / 강화, 착용 / 해제 */
function showGear(game: Game, host: UIHost, def: GearDef) {
  const head = h('div', 'tree-head');
  const info = h('div', 'info');
  const name = h('div', 'modal-title');
  const eff = h('div', 'modal-sub');
  const cost = h('div', 'modal-sub');
  info.append(name, h('div', 'modal-sub', SLOT_NAMES[def.slot] + (def.essence ? ' · 전설' : '')), eff, cost);
  head.append(ibox(def.icon, 'huge' + (def.essence ? ' legend' : '')), info);
  const main = h('button', 'buy wide');
  const mainLabel = h('span');
  const mainSmall = h('small');
  main.append(mainLabel, mainSmall);
  holdRepeat(main, () => {
    const owned = game.save.gear[def.id] !== undefined;
    const ok = owned ? game.enhanceGear(def.id) : game.craftGear(def.id);
    if (ok && !owned) host.toast(`${def.name} 제작!`);
    if (ok) host.refresh();
    return ok && owned;
  });
  const wear = host.button('', 'primary', () => {
    game.toggleWear(def.id);
    host.refresh();
  });
  const render = () => {
    const s = game.save;
    const plus = s.gear[def.id];
    const owned = plus !== undefined;
    const mat = MAT_BY_ID[def.mat];
    name.textContent = owned ? `${def.name} +${plus}` : def.name;
    eff.textContent = owned && plus < GEAR_MAX
      ? `${gearEffectText(def, plus)}  →  +${plus + 1}: ${gearEffectText(def, plus + 1)}`
      : gearEffectText(def, plus ?? 0);
    if (!owned) {
      cost.textContent = `제작: ${mat.icon} ${def.matCost}${def.essence ? ` · 🔮 ${def.essence}` : ''} (보유 ${fmt(s.mats[def.mat] ?? 0)})`;
      mainLabel.replaceChildren(coin(fmt(def.goldCost)));
      mainSmall.textContent = '제작';
      main.disabled = !game.canCraft(def.id);
    } else if (plus >= GEAR_MAX) {
      cost.textContent = '최대 강화';
      mainLabel.textContent = 'MAX';
      mainSmall.textContent = '';
      main.disabled = true;
    } else {
      const c = enhanceCost(def, plus);
      cost.textContent = `강화: ${mat.icon} ${c.mat}${c.essence ? ` · 🔮 ${c.essence}` : ''} (보유 ${fmt(s.mats[def.mat] ?? 0)})`;
      mainLabel.replaceChildren(coin(fmt(c.gold)));
      mainSmall.textContent = '강화 (누르고 있으면 연속)';
      main.disabled = !game.canEnhance(def.id);
    }
    const worn = s.wear[def.slot] === def.id;
    const cur = s.wear[def.slot] ? GEAR_BY_ID[s.wear[def.slot]!] : null;
    wear.textContent = worn ? '해제' : cur ? `착용 (${cur.name} → ${def.name})` : '착용';
    wear.disabled = !owned;
  };
  render();
  host.openModal(head, main, wear, host.button('닫기', '', () => host.closeModal()));
  host.setModalRefresh(render);
}

const MONSTER_NAMES: Record<string, string> = {
  slime: '슬라임', sprout: '새싹', mushroom: '버섯', bat: '박쥐', angel: '천사 유령',
  golem: '돌 골렘', snail: '달팽이 토끼', rabbit: '토끼 전사', devil: '악마 마왕', firstaid: '구급상자',
};

/** 도감: 잡은 몬스터·만든 장비 하나마다 공격력·체력 +1% */
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
  const total = Object.keys(MONSTER_NAMES).length + GEAR.length;
  host.openModal(
    h('div', 'modal-title', '도감'),
    h('div', 'modal-sub', `${game.collectionCount} / ${total} · 공격력·체력 +${Math.round(game.collectionCount * COLLECTION_BONUS * 100)}%`),
    grid('몬스터', Object.entries(MONSTER_NAMES).map(([k, v]) => [v, s.seen.monsters.includes(k)])),
    grid('장비', GEAR.map((g) => [`${g.icon} ${g.name}`, s.seen.gear.includes(g.id)])),
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
    h('div', 'modal-sub', '골드·최고 스테이지·능력치 강화가 처음으로 돌아가요. 스킬·장비·재료·다이아·레벨은 그대로'),
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
