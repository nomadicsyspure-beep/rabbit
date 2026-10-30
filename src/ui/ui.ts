import { FX_URLS, UI_URLS } from '../battle/sprites';
import { fmt, fmtDuration, fmtTime } from '../core/format';
import {
  STATS, STAT_ORDER, actionRatio, isBossStage, playerPower, playerStats, recommendedPower, stageClearGold, xpToNext,
  type StatId,
} from '../data/balance';
import {
  BRANCHES, EQUIP_SLOTS, SKILLS, branchValue, emptyTree, learnPrice, skillSummary, treeLevel, type SkillDef, type SkillId,
} from '../data/skills';
import type { Game, Mode } from '../game';
import { COMBO_SEC, type RunResult } from '../modes/action';
import { ICONS } from './icons';

type TabId = 'growth' | 'skill' | 'gear' | 'pets' | 'dungeon' | 'shop';

const TABS: { id: TabId; name: string; locked: boolean }[] = [
  { id: 'growth', name: '성장', locked: false },
  { id: 'skill', name: '스킬', locked: false },
  { id: 'gear', name: '장비', locked: true },
  { id: 'pets', name: '동료', locked: true },
  { id: 'dungeon', name: '던전', locked: false },
  { id: 'shop', name: '상점', locked: true },
];

/** 탭 아이콘: UI 시트에 있는 건 그 그림, 없는 건 선 아이콘 */
const TAB_ART: Partial<Record<TabId, string>> = { growth: 'icon-stats', dungeon: 'icon-map' };

const STAT_META: Record<StatId, { color: string; fmt: (v: number) => string }> = {
  atk: { color: '#e05a5a', fmt: (v) => fmt(v) },
  hp: { color: '#6fdc8c', fmt: (v) => fmt(v) },
  aps: { color: '#7ad7ff', fmt: (v) => v.toFixed(2) + '/초' },
  spd: { color: '#ffd166', fmt: (v) => Math.round(v * 100) + '%' },
};

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text) el.textContent = text;
  return el;
}

function svgIcon(svg: string, color?: string) {
  const el = h('div', 'icon');
  el.innerHTML = svg;
  if (color) el.style.background = color;
  return el;
}

/** UI 시트 그림 한 장 */
function art(name: string, cls = '') {
  const img = h('img', cls);
  img.src = UI_URLS[name] ?? '';
  img.alt = '';
  img.draggable = false;
  return img;
}

/** 스킬 아이콘: UI 시트 그림, 또는 이펙트 그림을 나무 틀 안에 */
function skillIcon(def: SkillDef, cls: string): HTMLElement {
  if (!def.icon.startsWith('fx:')) return art(def.icon, cls);
  const box = h('div', cls + ' fx-icon');
  const img = h('img');
  img.src = FX_URLS[def.icon.slice(3)] ?? '';
  img.alt = '';
  img.draggable = false;
  box.append(img);
  return box;
}

function coin(text: string) {
  const s = h('span', 'gold');
  s.append(art('coin', 'coin'), document.createTextNode(text));
  return s;
}

/** 누르고 있으면 반복 실행 (강화 버튼용) */
function holdRepeat(el: HTMLElement, fn: () => boolean) {
  let delay = 0;
  let timer = 0;
  const stop = () => {
    clearTimeout(delay);
    clearInterval(timer);
  };
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    stop();
    if (!fn()) return;
    delay = window.setTimeout(() => {
      timer = window.setInterval(() => {
        if (!fn()) stop();
      }, 90);
    }, 350);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel'] as const) el.addEventListener(ev, stop);
}

interface StatRow {
  lv: HTMLElement;
  val: HTMLElement;
  cost: HTMLElement;
  btn: HTMLButtonElement;
}

interface SkillRow {
  def: SkillDef;
  card: HTMLElement;
  lv: HTMLElement;
  desc: HTMLElement;
  buy: HTMLButtonElement;
  equip: HTMLButtonElement;
}

interface SlotEl {
  root: HTMLElement;
  fill: HTMLElement;
}

export class UI {
  readonly battle: HTMLElement;
  readonly canvas: HTMLCanvasElement;

  private readonly app: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly tabBar: HTMLElement;
  private readonly overlay: HTMLElement;
  private readonly toastEl: HTMLElement;

  // 방치 HUD
  private readonly hudIdle: HTMLElement;
  private readonly goldEl: HTMLElement;
  private readonly stageEl: HTMLElement;
  private readonly incomeEl: HTMLElement;
  private readonly challengeBtn: HTMLButtonElement;
  private readonly challengeLabel: HTMLElement;

  // 액션 HUD
  private readonly hudAction: HTMLElement;
  private readonly hpLost: HTMLElement;
  private readonly hpText: HTMLElement;
  private readonly lvEl: HTMLElement;
  private readonly xpFill: HTMLElement;
  private readonly plateEl: HTMLElement;
  private readonly timerEl: HTMLElement;
  private readonly killsEl: HTMLElement;
  private readonly slotsEl: HTMLElement;
  private readonly autoBtn: HTMLButtonElement;
  private readonly rotateBtn: HTMLButtonElement;
  private readonly skillModeBtn: HTMLButtonElement;
  private readonly comboEl: HTMLElement;
  private slots: SlotEl[] = [];
  private slotKey = '';

  private readonly tabButtons = new Map<TabId, HTMLButtonElement>();
  private readonly statRows = new Map<StatId, StatRow>();
  private skillRows: SkillRow[] = [];
  private skillHeader: HTMLElement | null = null;
  private powerEl: HTMLElement | null = null;
  private dungeonRefresh: (() => void) | null = null;
  /** 열려 있는 스킬 트리 창 갱신 */
  private treeRefresh: (() => void) | null = null;
  private tickT = 0;
  private toastT = 0;

  constructor(private readonly game: Game, root: HTMLElement) {
    this.app = h('div', 'app');
    root.append(this.app);

    // ---- 전투 화면 ----
    this.battle = h('section', 'battle');
    this.canvas = h('canvas', 'view');
    this.battle.append(this.canvas);

    this.hudIdle = h('div', 'hud hud-idle');
    const goldBox = h('div', 'pill-art pill-coin');
    this.goldEl = h('span', 'pill-text');
    goldBox.append(this.goldEl);
    const stageBox = h('div', 'stage-box');
    this.stageEl = h('div', 'plate');
    this.incomeEl = h('div', 'income');
    stageBox.append(this.stageEl, this.incomeEl);
    const settingsBtn = h('button', 'art-btn');
    settingsBtn.append(art('btn-gear'));
    settingsBtn.setAttribute('aria-label', '설정');
    settingsBtn.addEventListener('click', () => this.showSettings());
    this.hudIdle.append(goldBox, stageBox, settingsBtn);

    this.challengeBtn = h('button', 'challenge-btn');
    this.challengeBtn.innerHTML = ICONS.atk;
    this.challengeLabel = h('span');
    this.challengeBtn.append(this.challengeLabel);
    this.challengeBtn.addEventListener('click', () => this.game.enterAction());

    // 액션 HUD: 왼쪽 위 초상화+체력+레벨, 가운데 스테이지·시간, 오른쪽 처치 수·일시정지
    this.hudAction = h('div', 'hud hud-action');
    // 그림 속 체력 막대·경험치 칸 위치에 맞춘 영역 (style.css의 .hp-zone, .xp-zone)
    const player = h('div', 'hud-player');
    const hpZone = h('div', 'hp-zone');
    this.hpLost = h('div', 'hp-lost');
    this.hpText = h('div', 'hp-text');
    hpZone.append(this.hpLost, this.hpText);
    this.lvEl = h('div', 'lv-text');
    const xpZone = h('div', 'xp-zone');
    this.xpFill = h('div', 'xp-fill');
    xpZone.append(this.xpFill);
    player.append(hpZone, this.lvEl, xpZone);
    const center = h('div', 'stage-box');
    this.plateEl = h('div', 'plate');
    this.timerEl = h('div', 'timer');
    center.append(this.plateEl, this.timerEl);
    const kills = h('div', 'pill-art pill-skull');
    this.killsEl = h('span', 'pill-text');
    kills.append(this.killsEl);
    const pauseBtn = h('button', 'art-btn round');
    pauseBtn.append(art('pause'));
    pauseBtn.setAttribute('aria-label', '일시정지');
    pauseBtn.addEventListener('click', () => this.game.action.pause());
    // 자동 이동 (UI 시트의 AUTO 버튼), 가로 모드
    this.autoBtn = h('button', 'art-btn auto-btn');
    this.autoBtn.append(art('btn-auto'));
    this.autoBtn.setAttribute('aria-label', '자동 플레이');
    this.autoBtn.addEventListener('click', () => {
      this.game.toggleAutoMove();
      this.toast(this.game.save.autoMove ? 'AUTO 켜짐: 알아서 싸워요 (조이스틱을 쓰면 그동안은 직접 조종)' : 'AUTO 꺼짐');
      this.refreshToggles();
    });
    this.rotateBtn = h('button', 'text-btn', '가로');
    this.rotateBtn.setAttribute('aria-label', '가로 모드');
    this.rotateBtn.addEventListener('click', () => void this.game.toggleLandscape());
    const rotateBtn = this.rotateBtn;
    const left = h('div', 'action-left');
    left.append(player, this.autoBtn);
    const right = h('div', 'action-right');
    right.append(kills, pauseBtn, rotateBtn);
    this.hudAction.append(left, center, right);

    // 하단: 스킬 칸 (수동일 땐 눌러서 발동) + 스킬 자동/수동 전환
    const bottom = h('div', 'action-bottom');
    this.slotsEl = h('div', 'skill-slots');
    this.skillModeBtn = h('button', 'text-btn skill-mode');
    this.skillModeBtn.addEventListener('click', () => {
      this.game.toggleAutoSkills();
      this.refreshToggles();
    });
    bottom.append(this.slotsEl, this.skillModeBtn);
    this.comboEl = h('div', 'combo');

    this.battle.append(this.hudIdle, this.challengeBtn, this.hudAction, bottom, this.comboEl);

    // ---- 하단 패널 / 탭 ----
    this.panel = h('section', 'panel');
    this.tabBar = h('nav', 'tabs');
    for (const t of TABS) {
      const b = h('button', 'tab' + (t.locked ? ' locked' : ''));
      const pic = TAB_ART[t.id];
      if (pic) b.append(art(pic, 'tab-art'));
      else b.insertAdjacentHTML('beforeend', ICONS[t.id]);
      b.append(h('span', '', t.name));
      b.addEventListener('click', () => this.selectTab(t.id));
      this.tabButtons.set(t.id, b);
      this.tabBar.append(b);
    }

    this.overlay = h('div', 'overlay');
    this.toastEl = h('div', 'toast');
    this.app.append(this.battle, this.panel, this.tabBar, this.overlay, this.toastEl);

    // 시트 그림은 CSS 변수로 넘겨 배경·테두리에 쓴다
    for (const [name, url] of Object.entries(UI_URLS)) this.app.style.setProperty(`--art-${name}`, `url("${url}")`);

    this.selectTab('growth');
    this.setMode('idle');
  }

  setMode(mode: Mode) {
    this.app.classList.toggle('mode-action', mode === 'action');
    this.closeModal();
    this.refreshToggles();
  }

  /** 자동 이동 / 스킬 자동 / 가로 버튼 표시 */
  refreshToggles() {
    const save = this.game.save;
    this.rotateBtn.textContent = this.game.landscapeLocked ? '세로' : '가로';
    this.autoBtn.classList.toggle('on', save.autoMove);
    // AUTO 중엔 스킬도 늘 자동
    this.skillModeBtn.textContent = save.autoMove ? '스킬 자동 (AUTO)' : save.autoSkills ? '스킬 자동' : '스킬 수동';
    this.skillModeBtn.disabled = save.autoMove;
    this.skillModeBtn.classList.toggle('on', this.game.skillsAuto);
    this.app.classList.toggle('manual-skills', !this.game.skillsAuto);
  }

  /** 장착 스킬 칸을 만든다 (스테이지가 시작되어 장착 목록이 바뀌면 다시) */
  private buildSlots() {
    this.slots = this.game.action.equipped.map((s) => {
      const root = h('button', 'slot');
      // 수동 모드: 누르면 그 스킬을 쓴다 (쿨다운 중이면 준비되는 대로)
      root.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (this.game.engine.autoSkills || !s.weapon.trigger) return;
        s.weapon.trigger();
        root.classList.add('pressed');
        setTimeout(() => root.classList.remove('pressed'), 120);
      });
      const icon = skillIcon(s.def, 'slot-icon');
      const track = h('div', 'cd-track');
      const zone = h('div', 'cd-zone');
      const fill = h('div', 'cd-fill');
      zone.append(fill);
      track.append(zone);
      root.append(icon, track);
      return { root, fill };
    });
    this.slotsEl.replaceChildren(...this.slots.map((s) => s.root));
  }

  // ---- 탭 ----

  private selectTab(id: TabId) {
    for (const [tid, b] of this.tabButtons) b.classList.toggle('active', tid === id);
    this.panel.replaceChildren();
    this.statRows.clear();
    this.skillRows = [];
    this.skillHeader = null;
    this.powerEl = null;
    this.dungeonRefresh = null;
    const def = TABS.find((t) => t.id === id)!;
    if (def.locked) this.buildLocked(def.name);
    else if (id === 'growth') this.buildGrowth();
    else if (id === 'skill') this.buildSkills();
    else if (id === 'dungeon') this.buildDungeon();
    this.refresh();
  }

  private buildLocked(name: string) {
    const box = h('div', 'card locked-card');
    const lock = h('div', 'lock-icon');
    lock.innerHTML = ICONS.lock;
    box.append(lock, h('div', 'title', `${name} — 준비 중`), h('div', 'sub', '다음 단계에서 추가될 예정이에요'));
    this.panel.append(box);
  }

  private buildGrowth() {
    this.powerEl = h('div', 'summary');
    this.panel.append(this.powerEl);
    for (const id of STAT_ORDER) {
      const def = STATS[id];
      const meta = STAT_META[id];
      const card = h('div', 'card row');
      const icon = svgIcon(ICONS[id], meta.color);
      const info = h('div', 'info');
      const name = h('div', 'title', def.name + ' ');
      const lv = h('span', 'lv');
      name.append(lv);
      const val = h('div', 'sub');
      info.append(name, val);
      const btn = h('button', 'buy');
      const cost = h('span');
      btn.append(cost, h('small', '', '강화'));
      holdRepeat(btn, () => {
        const ok = this.game.upgrade(id);
        if (ok) this.refresh();
        return ok;
      });
      card.append(icon, info, btn);
      this.panel.append(card);
      this.statRows.set(id, { lv, val, cost, btn });
    }
    this.panel.append(h('div', 'hint', '버튼을 누르고 있으면 연속 강화 · 전투 화면을 탭하면 추가 피해'));
  }

  private buildSkills() {
    this.skillHeader = h('div', 'summary');
    this.panel.append(this.skillHeader);
    for (const def of SKILLS) {
      const card = h('div', 'card row skill-row');
      const icon = skillIcon(def, 'skill-art');
      const info = h('div', 'info');
      const name = h('div', 'title', def.name + ' ');
      const lv = h('span', 'lv');
      name.append(lv);
      const desc = h('div', 'sub');
      info.append(name, desc);
      const btns = h('div', 'skill-btns');
      const buy = h('button', 'buy');
      buy.addEventListener('click', () => {
        if (this.game.skillTree(def.id)) return this.showTree(def);
        if (this.game.learnSkill(def.id)) {
          this.toast(`${def.name} 습득!`);
          this.refresh();
        }
      });
      const equip = h('button', 'equip');
      equip.addEventListener('click', () => this.toggleEquip(def.id));
      btns.append(buy, equip);
      card.append(icon, info, btns);
      // 배운 스킬은 카드를 눌러도 트리가 열린다
      info.addEventListener('click', () => {
        if (this.game.skillTree(def.id)) this.showTree(def);
      });
      this.panel.append(card);
      this.skillRows.push({ def, card, lv, desc, buy, equip });
    }
    this.panel.append(h('div', 'hint', `스테이지에서는 장착한 스킬(최대 ${EQUIP_SLOTS}개)만 발동해요 · 강화는 계속 유지돼요`));
  }

  /** 스킬 트리 창: 피해 / 발동 속도 / 개수를 따로 강화 */
  private showTree(def: SkillDef) {
    const g = this.game;
    const head = h('div', 'tree-head');
    const title = h('div', 'info');
    title.append(h('div', 'modal-title', def.name), h('div', 'modal-sub', def.blurb));
    head.append(skillIcon(def, 'skill-art'), title);
    const rows = BRANCHES.map((br) => {
      const row = h('div', 'tree-row');
      const info = h('div', 'info');
      const name = h('div', 'title', '');
      const val = h('div', 'sub');
      info.append(name, val);
      const btn = h('button', 'buy');
      const cost = h('span');
      btn.append(cost, h('small', '', '강화'));
      holdRepeat(btn, () => {
        const ok = g.upgradeBranch(def.id, br.id);
        if (ok) this.refresh();
        return ok;
      });
      row.append(info, btn);
      return { br, row, name, val, cost, btn };
    });
    const equip = this.button('', '', () => this.toggleEquip(def.id));
    this.treeRefresh = () => {
      const tree = g.skillTree(def.id) ?? emptyTree();
      for (const r of rows) {
        const lv = tree[r.br.id];
        const maxed = lv >= r.br.max;
        const label = r.br.id === 'dmg' ? (def.dmgLabel ?? '피해') : r.br.id === 'cnt' ? def.countLabel : r.br.name;
        r.name.textContent = `${label}  Lv ${lv}/${r.br.max}`;
        const next = { ...tree, [r.br.id]: lv + 1 };
        r.val.textContent = maxed ? `${branchValue(def, r.br.id, tree)} (최대)` : `${branchValue(def, r.br.id, tree)} → ${branchValue(def, r.br.id, next)}`;
        const c = g.branchUpgradeCost(def.id, r.br.id);
        r.cost.replaceChildren(c === null ? document.createTextNode('MAX') : coin(fmt(c)));
        r.btn.disabled = !g.canUpgradeBranch(def.id, r.br.id);
      }
      const on = g.save.equipped.includes(def.id);
      equip.textContent = on ? `장착 해제 (${g.save.equipped.length}/${EQUIP_SLOTS})` : `장착하기 (${g.save.equipped.length}/${EQUIP_SLOTS})`;
    };
    const gold = h('div', 'tree-gold');
    const goldRefresh = this.treeRefresh;
    this.treeRefresh = () => {
      goldRefresh();
      gold.replaceChildren(coin(fmt(g.save.gold)));
    };
    this.openModal(head, gold, ...rows.map((r) => r.row), equip, this.button('닫기', 'primary', () => this.closeModal()));
    this.treeRefresh();
  }

  private toggleEquip(id: SkillId) {
    if (!this.game.toggleEquip(id)) this.toast(`장착 칸(${EQUIP_SLOTS}개)이 가득 찼어요. 하나를 먼저 해제하세요`);
    this.refresh();
  }

  private buildDungeon() {
    // 다음 스테이지 도전
    const card = h('div', 'card dungeon');
    const icon = svgIcon(ICONS.boss, '#d04070');
    const title = h('div', 'title');
    const sub = h('div', 'sub');
    const ratio = h('div', 'ratio');
    const info = h('div', 'info');
    info.append(title, sub, ratio);
    const btn = h('button', 'enter', '도전');
    btn.addEventListener('click', () => this.game.enterAction());
    card.append(icon, info, btn);
    this.panel.append(card);

    for (const [name, desc] of [['일일 던전', '매일 초기화 · 강화석 획득'], ['주간 던전', '매주 초기화 · 스킬북 획득']]) {
      const c = h('div', 'card dungeon locked');
      const info = h('div', 'info');
      info.append(h('div', 'title', name), h('div', 'sub', desc + ' (준비 중)'));
      c.append(svgIcon(ICONS.lock), info);
      this.panel.append(c);
    }

    this.dungeonRefresh = () => {
      const save = this.game.save;
      const stage = this.game.nextStage;
      title.textContent = isBossStage(stage) ? `스테이지 ${stage} · 마왕` : `스테이지 ${stage}`;
      sub.textContent = `권장 전투력 ${fmt(recommendedPower(stage))} · 클리어 보상 ${fmt(stageClearGold(stage))}`;
      const r = actionRatio(playerStats(save.levels, save.level), stage);
      const worst = Math.min(r.atk, r.hp);
      const [label, cls] = worst < 0.6 ? ['위험', 'bad'] : worst < 0.9 ? ['도전', 'mid'] : ['여유', 'good'];
      ratio.className = 'ratio ' + cls;
      ratio.textContent = `${label} · 공격 ×${r.atk.toFixed(2)} · 체력 ×${r.hp.toFixed(2)}`;
    };
  }

  // ---- 매 프레임 ----

  tick(dt: number) {
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) this.toastEl.classList.remove('show');
    }
    if (this.game.mode === 'action') this.refreshSlots();
    this.tickT -= dt;
    if (this.tickT > 0) return;
    this.tickT = 0.1;
    this.refresh();
  }

  /** 쿨다운 막대는 부드럽게 보이도록 매 프레임 */
  private refreshSlots() {
    const a = this.game.action;
    // 콤보: 처치할 때마다 크게 튀었다가 줄어들고, 끊기기 직전엔 흐려진다
    const since = this.game.engine.time - a.lastKillAt;
    if (a.combo >= 5 && since <= COMBO_SEC) {
      const pop = 1 + 0.35 * Math.max(0, 1 - since / 0.15);
      this.comboEl.textContent = `${a.combo} COMBO`;
      this.comboEl.style.transform = `scale(${pop.toFixed(3)})`;
      this.comboEl.style.opacity = String(Math.min(1, (COMBO_SEC - since) / 0.5));
      this.comboEl.classList.toggle('hot', a.combo >= 100);
    } else {
      this.comboEl.style.opacity = '0';
    }
    const eq = a.equipped;
    const key = eq.map((s) => s.def.id).join();
    if (key !== this.slotKey) {
      this.slotKey = key;
      this.buildSlots();
    }
    for (let i = 0; i < this.slots.length; i++) {
      const ready = eq[i]?.weapon.ready?.() ?? 1;
      this.slots[i].fill.style.width = `${Math.max(0, Math.min(1, ready)) * 100}%`;
      this.slots[i].root.classList.toggle('ready', ready >= 1);
    }
  }

  private refresh() {
    const g = this.game;
    const save = g.save;
    if (g.mode === 'idle') {
      this.goldEl.textContent = fmt(save.gold);
      this.stageEl.textContent = save.maxStage > 0 ? `최고 스테이지 ${save.maxStage}` : '스테이지 기록 없음';
      this.incomeEl.textContent = `초당 +${fmt(g.goldPerSec)}`;
      const next = g.nextStage;
      this.challengeLabel.textContent = isBossStage(next) ? `스테이지 ${next} 마왕 도전` : `스테이지 ${next} 도전`;
      this.challengeBtn.classList.toggle('boss', isBossStage(next));

      const st = playerStats(save.levels, save.level);
      if (this.powerEl) {
        this.powerEl.textContent = `Lv ${save.level} (경험치 ${Math.floor(save.xp)}/${xpToNext(save.level)})  ·  전투력 ${fmt(playerPower(st))}  ·  마왕 처치 ${save.bossKills}회`;
      }
      for (const [id, row] of this.statRows) {
        const def = STATS[id];
        const meta = STAT_META[id];
        const lv = save.levels[id];
        const maxed = def.maxLevel !== undefined && lv >= def.maxLevel;
        row.lv.textContent = `Lv ${lv}`;
        row.val.textContent = maxed ? `${meta.fmt(def.value(lv))} (최대)` : `${meta.fmt(def.value(lv))} → ${meta.fmt(def.value(lv + 1))}`;
        row.cost.replaceChildren(maxed ? document.createTextNode('MAX') : coin(fmt(def.cost(lv))));
        row.btn.disabled = !g.canUpgrade(id);
      }
      this.refreshSkills();
      this.dungeonRefresh?.();
    } else {
      const a = g.action;
      const p = g.engine.player;
      const hp = Math.max(0, p.hp / p.maxHp);
      this.hpLost.style.width = `${(1 - hp) * 100}%`;
      this.hpText.textContent = `${Math.ceil(Math.max(0, p.hp))} / ${Math.ceil(p.maxHp)}`;
      this.lvEl.textContent = `Lv.${save.level}`;
      this.xpFill.style.width = `${Math.min(1, save.xp / xpToNext(save.level)) * 100}%`;
      this.plateEl.textContent = `STAGE ${a.stage}`;
      this.timerEl.textContent = a.bossSpawned ? (a.isBossStage ? '마왕!' : '정예!') : fmtTime(a.duration - a.time);
      this.timerEl.classList.toggle('boss', a.bossSpawned);
      this.killsEl.textContent = String(a.kills);
    }
  }

  private refreshSkills() {
    this.treeRefresh?.();
    if (!this.skillHeader) return;
    const g = this.game;
    const eq = g.save.equipped;
    this.skillHeader.textContent = `장착 ${eq.length}/${EQUIP_SLOTS}  ·  배운 스킬을 눌러 피해·속도·개수를 강화해요`;
    for (const row of this.skillRows) {
      const id = row.def.id;
      const tree = g.skillTree(id);
      row.card.classList.toggle('unlearned', !tree);
      row.card.classList.toggle('equipped', eq.includes(id));
      row.lv.textContent = tree ? `Lv ${treeLevel(tree)}` : '미습득';
      row.desc.textContent = tree ? skillSummary(row.def, tree) : row.def.blurb;
      if (tree) {
        row.buy.replaceChildren(h('span', '', '스킬 트리'), h('small', '', '강화'));
        row.buy.disabled = false;
      } else {
        row.buy.replaceChildren(coin(fmt(learnPrice(row.def))), h('small', '', '배우기'));
        row.buy.disabled = !g.canLearn(id);
      }
      row.equip.textContent = eq.includes(id) ? '해제' : '장착';
      row.equip.disabled = !tree;
    }
  }

  // ---- 토스트 / 모달 ----

  toast(msg: string) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    this.toastT = 2.2;
  }

  private openModal(...children: HTMLElement[]) {
    const box = h('div', 'modal');
    box.append(...children);
    this.overlay.replaceChildren(box);
    this.overlay.classList.add('show');
    return box;
  }

  private closeModal() {
    this.treeRefresh = null;
    this.overlay.classList.remove('show');
    this.overlay.replaceChildren();
  }

  private button(text: string, cls: string, fn: () => void) {
    const b = h('button', 'btn ' + cls, text);
    b.addEventListener('click', fn);
    return b;
  }

  /** 두 번 눌러야 실행되는 버튼 (임베드 환경에선 confirm()이 막혀 있다) */
  private confirmButton(text: string, confirmText: string, fn: () => void) {
    let armed = false;
    const b = this.button(text, 'danger', () => {
      if (armed) return fn();
      armed = true;
      b.textContent = confirmText;
      b.classList.add('armed');
    });
    return b;
  }

  showPause(resume: () => void, giveUp: () => void) {
    this.openModal(
      h('div', 'modal-title', '일시정지'),
      this.button('계속하기', 'primary', () => {
        this.closeModal();
        resume();
      }),
      this.button('포기하기', '', () => {
        this.closeModal();
        giveUp();
      }),
    );
  }

  showResult(r: RunResult, done: () => void) {
    const stats = h('div', 'result-stats');
    const line = (k: string, v: string | HTMLElement) => {
      const row = h('div', 'result-row');
      row.append(h('span', '', k), typeof v === 'string' ? h('b', '', v) : v);
      stats.append(row);
    };
    line('생존 시간', fmtTime(r.time));
    line('처치', String(r.kills));
    line('최고 콤보', String(r.bestCombo));
    line('경험치', `+${r.xp}` + (r.levelUps > 0 ? ` (레벨 업 ${r.levelUps}번!)` : ''));
    line('보상', coin(fmt(r.gold)));
    const title = r.win ? `스테이지 ${r.stage} 클리어!` : '쓰러졌어요…';
    const sub = r.win ? '방치 수입이 이 스테이지 기준으로 올라가요' : '강화하고 다시 도전해 보세요';
    this.openModal(
      h('div', 'modal-title ' + (r.win ? 'win' : 'lose'), title),
      h('div', 'modal-sub', sub),
      stats,
      this.button('돌아가기', 'primary', () => {
        this.closeModal();
        done();
      }),
    );
  }

  showOffline(sec: number, gold: number, claim: () => void) {
    const reward = h('div', 'big-reward');
    reward.append(coin(fmt(gold)));
    this.openModal(
      h('div', 'modal-title', '돌아오셨군요!'),
      h('div', 'modal-sub', `자리를 비운 ${fmtDuration(sec)} 동안 병아리가 사냥했어요`),
      reward,
      this.button('받기', 'primary', () => {
        this.closeModal();
        claim();
      }),
    );
  }

  private showSettings() {
    const g = this.game;
    this.openModal(
      h('div', 'modal-title', '설정'),
      h('div', 'modal-sub', '프로토타입 v0.3'),
      this.button('테스트: 골드 지급', '', () => {
        g.save.gold += g.goldPerSec * 500;
        this.refresh();
        this.toast('골드를 지급했어요');
      }),
      this.confirmButton('저장 초기화', '한 번 더 누르면 모두 지워져요', () => g.resetSave()),
      this.button('닫기', 'primary', () => this.closeModal()),
    );
  }
}
