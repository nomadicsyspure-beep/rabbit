import { fmt } from '../core/format';
import { GEAR, GEAR_MAX, SLOT_NAMES, enhanceCost, gearEffectText, type GearSlot } from '../data/gear';
import { MATS, MAT_BY_ID } from '../data/items';
import type { Game } from '../game';
import { COLLECTION_BONUS, REBIRTH_MIN_STAGE, REBIRTH_UPS, type RebirthUp } from '../game';
import { ICON_URLS, MONSTER_URLS } from '../battle/sprites';
import { ALL_MONSTERS } from '../data/world';
import { chip, coin, h, holdRepeat, icon as iconImg } from './dom';

// 장비 탭, 도감, 환생 화면.

/** 화면 쪽에서 필요한 것: 토스트, 전체 새로고침, 모달 열기/닫기 */
export interface UIHost {
  toast(msg: string): void;
  refresh(): void;
  openModal(...children: HTMLElement[]): HTMLElement;
  closeModal(): void;
  button(text: string, cls: string, fn: () => void): HTMLButtonElement;
  confirmButton(text: string, confirmText: string, fn: () => void): HTMLButtonElement;
}

/** 재료·다이아·정수 한 줄 */
export function walletBar(game: Game) {
  const bar = h('div', 'wallet');
  const refresh = () => {
    const s = game.save;
    const chips = MATS.filter((m) => (s.mats[m.id] ?? 0) > 0).map((m) => chip(m.img, fmt(s.mats[m.id] ?? 0)));
    chips.push(chip('diamond', fmt(s.diamonds)));
    if (s.essence > 0) chips.push(chip('essence', fmt(s.essence)));
    bar.replaceChildren(...chips);
  };
  return { el: bar, refresh };
}

/** 장비 탭: 부위별로 만들기 / 강화 / 착용 */
export function buildGearTab(panel: HTMLElement, game: Game, host: UIHost) {
  const wallet = walletBar(game);
  panel.append(wallet.el);
  const rows: (() => void)[] = [wallet.refresh];
  for (const slot of ['weapon', 'hat', 'back', 'acc'] as GearSlot[]) {
    panel.append(h('div', 'section-title', SLOT_NAMES[slot]));
    for (const def of GEAR.filter((g) => g.slot === slot)) {
      const card = h('div', 'card row gear-row');
      const icon = h('div', 'item-icon');
      if (ICON_URLS[`gear-${def.id}`]) icon.append(iconImg(`gear-${def.id}`));
      else icon.textContent = def.icon;
      const info = h('div', 'info');
      const name = h('div', 'title');
      const eff = h('div', 'sub');
      const cost = h('div', 'cost-line');
      info.append(name, eff, cost);
      const btns = h('div', 'skill-btns');
      const main = h('button', 'buy');
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
      const wear = h('button', 'equip');
      wear.addEventListener('click', () => {
        game.toggleWear(def.id);
        host.refresh();
      });
      btns.append(main, wear);
      card.append(icon, info, btns);
      panel.append(card);
      rows.push(() => {
        const s = game.save;
        const plus = s.gear[def.id];
        const owned = plus !== undefined;
        const worn = s.wear[def.slot] === def.id;
        card.classList.toggle('unlearned', !owned);
        card.classList.toggle('equipped', worn);
        name.textContent = owned ? `${def.name} +${plus}` : def.name;
        eff.textContent = gearEffectText(def, plus ?? 0);
        const mat = MAT_BY_ID[def.mat];
        if (!owned) {
          cost.textContent = `${mat.icon} ${def.matCost}${def.essence ? ` · 🔮 ${def.essence}` : ''} (보유 ${fmt(s.mats[def.mat] ?? 0)})`;
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
          mainSmall.textContent = '강화';
          main.disabled = !game.canEnhance(def.id);
        }
        wear.textContent = worn ? '해제' : '착용';
        wear.disabled = !owned;
      });
    }
  }
  panel.append(h('div', 'hint', '재료는 스테이지의 보물 상자에서 나와요 · 무기는 그 스킬을 공짜로 한 줄 더 쏘고, 그 스킬을 스킬북 없이 배우게 해 줘요'));
  return () => rows.forEach((r) => r());
}


/** 도감: 잡은 몬스터·만든 장비 하나마다 공격력·체력 +1% */
export function showCollection(game: Game, host: UIHost) {
  const s = game.save;
  const box = (title: string, cells: HTMLElement[]) => {
    const wrap = h('div', 'collection');
    wrap.append(h('div', 'section-title', title));
    const g = h('div', 'collection-grid pics');
    g.append(...cells);
    wrap.append(g);
    return wrap;
  };
  const monsterCell = (skin: string) => {
    const ok = s.seen.monsters.includes(skin);
    const cell = h('div', 'collection-item' + (ok ? ' ok' : ''));
    const pic = MONSTER_URLS[skin];
    if (pic) {
      const img = h('img', pic.strip ? 'strip' : '');
      img.src = pic.url;
      img.alt = '';
      cell.append(img);
    } else {
      cell.append(h('span', 'collection-emoji', skin === 'firstaid' ? '🩹' : '?'));
    }
    return cell;
  };
  const gearCell = (g: (typeof GEAR)[number]) => {
    const ok = s.seen.gear.includes(g.id);
    const cell = h('div', 'collection-item' + (ok ? ' ok' : ''));
    if (ICON_URLS[`gear-${g.id}`]) cell.append(iconImg(`gear-${g.id}`));
    else cell.append(h('span', 'collection-emoji', g.icon));
    return cell;
  };
  const scroll = (...kids: HTMLElement[]) => {
    const el = h('div', 'modal-scroll');
    el.append(...kids);
    return el;
  };
  const total = ALL_MONSTERS.length + GEAR.length;
  host.openModal(
    h('div', 'modal-title', '도감'),
    h('div', 'modal-sub', `${game.collectionCount} / ${total} · 공격력·체력 +${Math.round(game.collectionCount * COLLECTION_BONUS * 100)}% · 못 만난 건 그림자로`),
    scroll(
      box(`몬스터 ${ALL_MONSTERS.filter((m) => s.seen.monsters.includes(m)).length}/${ALL_MONSTERS.length}`, ALL_MONSTERS.map(monsterCell)),
      box(`장비 ${s.seen.gear.length}/${GEAR.length}`, GEAR.map(gearCell)),
    ),
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
