import { fmt, fmtDuration, fmtTime } from '../core/format';
import {
  BOSS_EVERY, KILLS_PER_STAGE, STATS, STAT_ORDER, actionRatio, enemyGold, isBossStage, playerPower, playerStats,
  recommendedPower, type StatId,
} from '../data/balance';
import { SKILL_MAX_LEVEL } from '../data/skills';
import type { Game, Mode } from '../game';
import { RUN_SECONDS, type LevelUpCard, type RunResult } from '../modes/action';
import { ICONS } from './icons';

type TabId = 'growth' | 'gear' | 'pets' | 'dungeon' | 'shop';

const TABS: { id: TabId; name: string; locked: boolean }[] = [
  { id: 'growth', name: '성장', locked: false },
  { id: 'gear', name: '장비', locked: true },
  { id: 'pets', name: '동료', locked: true },
  { id: 'dungeon', name: '던전', locked: false },
  { id: 'shop', name: '상점', locked: true },
];

const STAT_META: Record<StatId, { color: string; fmt: (v: number) => string }> = {
  atk: { color: '#e05a5a', fmt: (v) => fmt(v) },
  hp: { color: '#6fdc8c', fmt: (v) => fmt(v) },
  aps: { color: '#7ad7ff', fmt: (v) => v.toFixed(2) + '/초' },
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

function coin(text: string) {
  const s = h('span', 'gold');
  s.append(h('i', 'coin'), document.createTextNode(text));
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
  private readonly stageBar: HTMLElement;
  private readonly bossBtn: HTMLButtonElement;

  // 액션 HUD
  private readonly hudAction: HTMLElement;
  private readonly xpFill: HTMLElement;
  private readonly lvEl: HTMLElement;
  private readonly timerEl: HTMLElement;
  private readonly killsEl: HTMLElement;
  private readonly skillsEl: HTMLElement;

  private readonly tabButtons = new Map<TabId, HTMLButtonElement>();
  private readonly statRows = new Map<StatId, StatRow>();
  private powerEl: HTMLElement | null = null;
  private dungeonRefresh: (() => void) | null = null;
  private tickT = 0;
  private toastT = 0;
  private lastSkillKey = '';

  constructor(private readonly game: Game, root: HTMLElement) {
    this.app = h('div', 'app');
    root.append(this.app);

    // ---- 전투 화면 ----
    this.battle = h('section', 'battle');
    this.canvas = h('canvas', 'view');
    this.battle.append(this.canvas);

    this.hudIdle = h('div', 'hud hud-idle');
    const goldBox = h('div', 'pill');
    this.goldEl = h('span');
    goldBox.append(h('i', 'coin'), this.goldEl);
    const stageBox = h('div', 'stage-box');
    this.stageEl = h('div', 'stage-name');
    const bar = h('div', 'stage-bar');
    this.stageBar = h('div', 'fill');
    bar.append(this.stageBar);
    stageBox.append(this.stageEl, bar);
    const settingsBtn = h('button', 'icon-btn');
    settingsBtn.innerHTML = ICONS.settings;
    settingsBtn.setAttribute('aria-label', '설정');
    settingsBtn.addEventListener('click', () => this.showSettings());
    this.hudIdle.append(goldBox, stageBox, settingsBtn);

    this.bossBtn = h('button', 'boss-btn');
    this.bossBtn.innerHTML = `${ICONS.atk}<span>보스 도전</span>`;
    this.bossBtn.addEventListener('click', () => this.game.enterAction(this.game.save.stage, false));

    this.hudAction = h('div', 'hud hud-action');
    const xpBar = h('div', 'xp-bar');
    this.xpFill = h('div', 'fill');
    xpBar.append(this.xpFill);
    const row = h('div', 'action-row');
    this.lvEl = h('div', 'pill');
    this.timerEl = h('div', 'timer');
    this.killsEl = h('div', 'pill');
    const pauseBtn = h('button', 'icon-btn', 'Ⅱ');
    pauseBtn.setAttribute('aria-label', '일시정지');
    pauseBtn.addEventListener('click', () => this.game.action.pause());
    const right = h('div', 'action-right');
    right.append(this.killsEl, pauseBtn);
    row.append(this.lvEl, this.timerEl, right);
    this.skillsEl = h('div', 'skill-icons');
    this.hudAction.append(xpBar, row);

    this.battle.append(this.hudIdle, this.bossBtn, this.hudAction, this.skillsEl);

    // ---- 하단 패널 / 탭 ----
    this.panel = h('section', 'panel');
    this.tabBar = h('nav', 'tabs');
    for (const t of TABS) {
      const b = h('button', 'tab' + (t.locked ? ' locked' : ''));
      b.innerHTML = `${ICONS[t.id]}<span>${t.name}</span>`;
      b.addEventListener('click', () => this.selectTab(t.id));
      this.tabButtons.set(t.id, b);
      this.tabBar.append(b);
    }

    this.overlay = h('div', 'overlay');
    this.toastEl = h('div', 'toast');
    this.app.append(this.battle, this.panel, this.tabBar, this.overlay, this.toastEl);

    this.selectTab('growth');
    this.setMode('idle');
  }

  setMode(mode: Mode) {
    this.app.classList.toggle('mode-action', mode === 'action');
    this.closeModal();
    this.skillsEl.replaceChildren();
    this.lastSkillKey = '';
  }

  // ---- 탭 ----

  private selectTab(id: TabId) {
    for (const [tid, b] of this.tabButtons) b.classList.toggle('active', tid === id);
    this.panel.replaceChildren();
    this.statRows.clear();
    this.powerEl = null;
    this.dungeonRefresh = null;
    const def = TABS.find((t) => t.id === id)!;
    if (def.locked) this.buildLocked(def.name);
    else if (id === 'growth') this.buildGrowth();
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

  private buildDungeon() {
    // 보스 도전
    const boss = h('div', 'card dungeon');
    const bTitle = h('div', 'title');
    const bSub = h('div', 'sub');
    const bRatio = h('div', 'ratio');
    const bBtn = h('button', 'enter', '도전');
    bBtn.addEventListener('click', () => this.game.enterAction(this.game.save.stage, false));
    const bInfo = h('div', 'info');
    bInfo.append(bTitle, bSub, bRatio);
    const bIcon = svgIcon(ICONS.boss, '#d04070');
    boss.append(bIcon, bInfo, bBtn);

    // 연습
    const practice = h('div', 'card dungeon');
    const pIcon = svgIcon(ICONS.practice, '#4a7bd6');
    const pInfo = h('div', 'info');
    pInfo.append(h('div', 'title', '연습 던전'), h('div', 'sub', '보상 없이 액션 모드를 언제든 체험'));
    const pBtn = h('button', 'enter', '입장');
    pBtn.addEventListener('click', () => this.game.enterAction(this.game.idle.farmStage, true));
    practice.append(pIcon, pInfo, pBtn);

    this.panel.append(boss, practice);
    for (const [name, sub] of [['일일 던전', '매일 초기화 · 강화석 획득'], ['주간 던전', '매주 초기화 · 스킬북 획득']]) {
      const c = h('div', 'card dungeon locked');
      const icon = svgIcon(ICONS.lock);
      const info = h('div', 'info');
      info.append(h('div', 'title', name), h('div', 'sub', sub + ' (준비 중)'));
      c.append(icon, info);
      this.panel.append(c);
    }

    this.dungeonRefresh = () => {
      const save = this.game.save;
      const gate = isBossStage(save.stage);
      const bossStage = gate ? save.stage : Math.ceil(save.stage / BOSS_EVERY) * BOSS_EVERY;
      bTitle.textContent = `스테이지 ${bossStage} 보스`;
      bSub.textContent = gate
        ? `권장 전투력 ${fmt(recommendedPower(bossStage))} · 클리어 보상 ${fmt(enemyGold(bossStage) * 60)}`
        : `스테이지 ${bossStage}에 도달하면 도전 가능`;
      const r = actionRatio(playerStats(save.levels), bossStage);
      const worst = Math.min(r.atk, r.hp);
      const [label, cls] = worst < 0.6 ? ['위험', 'bad'] : worst < 0.9 ? ['도전', 'mid'] : ['여유', 'good'];
      bRatio.className = 'ratio ' + cls;
      bRatio.textContent = `${label} · 공격 ×${r.atk.toFixed(2)} · 체력 ×${r.hp.toFixed(2)}`;
      bBtn.disabled = !gate;
    };
  }

  // ---- 매 프레임 ----

  tick(dt: number) {
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) this.toastEl.classList.remove('show');
    }
    this.tickT -= dt;
    if (this.tickT > 0) return;
    this.tickT = 0.1;
    this.refresh();
  }

  private refresh() {
    const g = this.game;
    const save = g.save;
    if (g.mode === 'idle') {
      this.goldEl.textContent = fmt(save.gold);
      const gate = isBossStage(save.stage);
      this.stageEl.textContent = gate ? `스테이지 ${save.stage} · 보스` : `스테이지 ${save.stage}`;
      this.stageBar.style.width = gate ? '100%' : `${(save.kills / KILLS_PER_STAGE) * 100}%`;
      this.stageBar.classList.toggle('boss', gate);
      this.bossBtn.classList.toggle('show', gate);

      const st = playerStats(save.levels);
      if (this.powerEl) this.powerEl.textContent = `전투력 ${fmt(playerPower(st))}  ·  보스 처치 ${save.bossKills}회`;
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
      this.dungeonRefresh?.();
    } else {
      const a = g.action;
      this.xpFill.style.width = `${(a.xp / a.xpNext) * 100}%`;
      this.lvEl.textContent = `Lv ${a.level}`;
      this.timerEl.textContent = a.bossSpawned ? '보스!' : fmtTime(RUN_SECONDS - a.time);
      this.timerEl.classList.toggle('boss', a.bossSpawned);
      this.killsEl.textContent = `처치 ${a.kills}`;

      const owned = a.ownedSkills();
      const key = owned.map(([s, l]) => s.id + l).join();
      if (key !== this.lastSkillKey) {
        this.lastSkillKey = key;
        this.skillsEl.replaceChildren(
          ...owned.map(([s, l]) => {
            const el = h('div', 'skill-icon', s.icon);
            el.style.borderColor = s.color;
            el.style.color = s.color;
            el.append(h('b', '', String(l)));
            return el;
          }),
        );
      }
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

  showLevelUp(cards: LevelUpCard[], pick: (card: LevelUpCard | null) => void) {
    const list = h('div', 'cards');
    const choose = (c: LevelUpCard | null) => {
      this.closeModal();
      pick(c);
    };
    for (const c of cards) {
      const el = h('button', 'skill-card');
      const icon = h('div', 'icon', c.skill.icon);
      icon.style.color = c.skill.color;
      icon.style.borderColor = c.skill.color;
      const info = h('div', 'info');
      const title = h('div', 'title', c.skill.name + ' ');
      title.append(h('span', c.nextLevel === 1 ? 'tag new' : 'tag', c.nextLevel === 1 ? 'NEW' : `Lv ${c.nextLevel}`));
      info.append(title, h('div', 'sub', c.skill.descs[c.nextLevel - 1]));
      if (c.nextLevel === SKILL_MAX_LEVEL) info.append(h('div', 'max', '최대 레벨'));
      el.append(icon, info);
      el.addEventListener('click', () => choose(c));
      list.append(el);
    }
    if (cards.length === 0) list.append(this.button('체력 30% 회복', 'primary', () => choose(null)));
    this.openModal(h('div', 'modal-title', '레벨 업!'), h('div', 'modal-sub', '하나를 골라 주세요'), list);
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
    line('레벨', String(r.level));
    if (!r.practice) line('보상', coin(fmt(r.gold)));
    const title = r.win ? (r.practice ? '연습 클리어!' : `스테이지 ${r.stage} 보스 처치!`) : '쓰러졌어요…';
    const sub = r.practice ? '연습 던전은 보상이 없어요' : r.win ? '다음 스테이지로 넘어갑니다' : '강화하고 다시 도전해 보세요';
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
      h('div', 'modal-sub', `자리를 비운 ${fmtDuration(sec)} 동안 토끼가 사냥했어요`),
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
      h('div', 'modal-sub', '프로토타입 v0.1'),
      this.button('테스트: 골드 지급', '', () => {
        g.save.gold += enemyGold(g.idle.farmStage) * 500;
        this.refresh();
        this.toast('골드를 지급했어요');
      }),
      this.confirmButton('저장 초기화', '한 번 더 누르면 모두 지워져요', () => g.resetSave()),
      this.button('닫기', 'primary', () => this.closeModal()),
    );
  }
}
