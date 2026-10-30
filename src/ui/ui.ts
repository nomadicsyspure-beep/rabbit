import { sfx } from '../audio/sfx';
import { CHEST_NAMES } from '../data/items';
import { regionOf, stageRule } from '../data/world';
import { fmt, fmtDuration, fmtTime } from '../core/format';
import {
  STATS, STAT_ORDER, actionRatio, isBossStage, playerPower, recommendedPower, stageClearGold, xpToNext,
  type StatId,
} from '../data/balance';
import {
  BRANCHES, EQUIP_SLOTS, SKILLS, SKILL_GRADE, SKILL_TYPES, branchValue, emptyTree, skillSummary, treeLevel, SKILL_BY_ID, type SkillDef,
} from '../data/skills';
import { RAID_BOSSES } from '../data/raids';
import { SKILL_BOXES, boxCost, boxesFor, oddsText, type BoxDef } from '../data/skillbox';
import { COLLECTION_BONUS, DUNGEON_DAILY, REBIRTH_MIN_STAGE, type Game, type Mode } from '../game';
import { FEVER_SEC, type RunResult } from '../modes/action';
import { UI_URLS } from '../battle/sprites';
import { art, chickPic, coin, h, holdRepeat, ibox, monsterPic, skillIcon, svgIcon } from './dom';
import { buildGearTab, showCollection, showRebirth, type UIHost } from './meta';
import { buildPetsTab, buildShopTab, showMissions } from './shop';
import { ICONS } from './icons';
import { skillPreview } from './preview';
import { Tutorial } from './tutorial';

type TabId = 'growth' | 'skill' | 'gear' | 'pets' | 'dungeon' | 'shop';

const TABS: { id: TabId; name: string; locked: boolean }[] = [
  { id: 'growth', name: '성장', locked: false },
  { id: 'skill', name: '스킬', locked: false },
  { id: 'gear', name: '가방', locked: false },
  { id: 'pets', name: '동료', locked: false },
  { id: 'dungeon', name: '던전', locked: false },
  { id: 'shop', name: '상점', locked: false },
];

/** 탭 아이콘: UI 시트에 있는 건 그 그림, 없는 건 선 아이콘 */
const TAB_ART: Partial<Record<TabId, string>> = { growth: 'icon-stats', dungeon: 'icon-map' };

const STAT_META: Record<StatId, { color: string; fmt: (v: number) => string }> = {
  atk: { color: '#e05a5a', fmt: (v) => fmt(v) },
  hp: { color: '#6fdc8c', fmt: (v) => fmt(v) },
  aps: { color: '#7ad7ff', fmt: (v) => v.toFixed(2) + '/초' },
  spd: { color: '#ffd166', fmt: (v) => Math.round(v * 100) + '%' },
};

interface StatRow {
  lv: HTMLElement;
  val: HTMLElement;
  cost: HTMLElement;
  btn: HTMLButtonElement;
}

interface SkillTile {
  def: SkillDef;
  root: HTMLElement;
  lv: HTMLElement;
}

interface SlotEl {
  root: HTMLElement;
  fill: HTMLElement;
}

export class UI implements UIHost {
  readonly battle: HTMLElement;
  readonly canvas: HTMLCanvasElement;

  private readonly app: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly tabBar: HTMLElement;
  private readonly overlay: HTMLElement;
  /** 처음 하는 사람용 튜토리얼 */
  readonly tutorial: Tutorial;
  private readonly toastEl: HTMLElement;

  // 방치 HUD
  private readonly hudIdle: HTMLElement;
  private readonly goldEl: HTMLElement;
  private readonly stageEl: HTMLElement;
  private readonly incomeEl: HTMLElement;
  private readonly challengeBtn: HTMLButtonElement;
  private readonly challengeLabel: HTMLElement;
  private readonly missionBtn: HTMLButtonElement;

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
  private readonly comboEl: HTMLElement;
  private readonly feverFill: HTMLElement;
  private readonly feverBanner: HTMLElement;
  private slots: SlotEl[] = [];
  /** 창이 닫힐 때 한 번 (스테이지 스킬 창: 전투 다시 시작) */
  private onModalClose: (() => void) | null = null;
  private slotKey = '';

  private readonly tabButtons = new Map<TabId, HTMLButtonElement>();
  private readonly statRows = new Map<StatId, StatRow>();
  private skillTiles: SkillTile[] = [];
  private skillHeader: HTMLElement | null = null;
  /** 스킬 탭 위쪽 장착 중 4칸 (장착이 바뀔 때만 다시 만든다) */
  private equipBar: HTMLElement | null = null;
  private equipKey = '';
  private boxRefresh: (() => void) | null = null;
  private powerEl: HTMLElement | null = null;
  private dungeonRefresh: (() => void) | null = null;
  /** 장비 탭 같은 추가 화면 갱신 */
  private metaRefresh: (() => void) | null = null;
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
    // 미션·출석·업적·패스 (받을 게 있으면 빨간 점)
    this.missionBtn = h('button', 'mission-btn', '📋 미션');
    this.missionBtn.addEventListener('click', () => showMissions(this.game, this));

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
    // 그림 속 얼굴 대신 실제 게임 병아리 그림
    const face = h('div', 'hud-face');
    face.append(chickPic(40));
    player.append(hpZone, this.lvEl, xpZone, face);
    const center = h('div', 'stage-box');
    this.plateEl = h('div', 'plate');
    this.timerEl = h('div', 'timer');
    // 피버 게이지: 처치로 차고, 다 차면 FEVER TIME (남은 시간이 줄어든다)
    const fever = h('div', 'fever');
    const feverTrack = h('div', 'cd-track fever-track');
    const feverZone = h('div', 'cd-zone');
    this.feverFill = h('div', 'cd-fill');
    feverZone.append(this.feverFill);
    feverTrack.append(feverZone);
    fever.append(h('span', 'fever-label', 'FEVER'), feverTrack);
    center.append(this.plateEl, this.timerEl, fever);
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
    bottom.append(this.slotsEl);
    this.comboEl = h('div', 'combo');
    this.feverBanner = h('div', 'fever-banner', 'FEVER TIME!');

    this.battle.append(this.hudIdle, this.challengeBtn, this.missionBtn, this.hudAction, bottom, this.comboEl, this.feverBanner);

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
    this.tutorial = new Tutorial(this.game, document.body, () => this.overlay.classList.contains('show'));

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

  /** 피버 시작: 큰 글자가 튀어나왔다 사라진다 */
  feverStart() {
    this.feverBanner.classList.remove('show');
    void this.feverBanner.offsetWidth; // 애니메이션 다시 시작
    this.feverBanner.classList.add('show');
  }

  /** 자동 이동 / 스킬 자동 / 가로 버튼 표시 */
  refreshToggles() {
    const save = this.game.save;
    this.rotateBtn.textContent = this.game.landscapeLocked ? '세로' : '가로';
    this.autoBtn.classList.toggle('on', save.autoMove);
  }

  /** 스테이지에서 스킬 칸을 누르면: 전투를 멈추고 그 스킬 설명·강화 창 (닫으면 이어서) */
  private openStageSkill(def: SkillDef) {
    const a = this.game.action;
    if (a.state !== 'playing') return;
    a.state = 'paused';
    this.game.joystick.release();
    this.onModalClose = () => {
      if (a.state === 'paused') a.state = 'playing';
    };
    this.showSkill(def);
  }

  /** 장착 스킬 칸을 만든다 (스테이지가 시작되어 장착 목록이 바뀌면 다시) */
  private buildSlots() {
    this.slots = this.game.action.equipped.map((s) => {
      const root = h('button', 'slot');
      // 스킬은 늘 자동. 칸을 누르면 전투를 멈추고 그 스킬 설명·강화 창
      root.addEventListener('click', (e) => {
        e.preventDefault();
        this.openStageSkill(s.def);
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
    this.panel.scrollTop = 0;
    this.statRows.clear();
    this.skillTiles = [];
    this.skillHeader = null;
    this.equipBar = null;
    this.boxRefresh = null;
    this.powerEl = null;
    this.dungeonRefresh = null;
    this.metaRefresh = null;
    const def = TABS.find((t) => t.id === id)!;
    if (def.locked) this.buildLocked(def.name);
    else if (id === 'growth') this.buildGrowth();
    else if (id === 'skill') this.buildSkills();
    else if (id === 'dungeon') this.buildDungeon();
    else if (id === 'gear') this.metaRefresh = buildGearTab(this.panel, this.game, this);
    else if (id === 'pets') this.metaRefresh = buildPetsTab(this.panel, this.game, this);
    else if (id === 'shop') this.metaRefresh = buildShopTab(this.panel, this.game, this);
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
    // 도감·환생: 능력치 줄과 같은 모양
    const g = this.game;
    const extra: [string, string, string, string, () => void][] = [
      ['📖', '도감', `${g.collectionCount}개 모음 · 공격력·체력 +${Math.round(g.collectionCount * COLLECTION_BONUS * 100)}%`, '보기', () => showCollection(g, this)],
      ['🪶', '환생', `${g.save.rebirth.count}번 · 깃털 ${g.save.rebirth.feathers}개 · 최고 스테이지 ${REBIRTH_MIN_STAGE}부터`, '열기', () => showRebirth(g, this)],
    ];
    for (const [icon, title, sub, label, fn] of extra) {
      const card = h('div', 'card row');
      const info = h('div', 'info');
      info.append(h('div', 'title', title), h('div', 'sub', sub));
      const btn = h('button', 'buy');
      btn.append(h('span', '', label));
      btn.addEventListener('click', fn);
      card.append(h('div', 'item-icon', icon), info, btn);
      this.panel.append(card);
    }
    this.panel.append(h('div', 'hint', '버튼을 누르고 있으면 연속 강화 · 전투 화면을 탭하면 추가 피해'));
  }

  /** 스킬 탭: 위에 장착 중 4칸 고정, 아래는 아이콘 격자(5줄)만 스크롤 */
  private buildSkills() {
    const top = h('div', 'skill-top');
    this.skillHeader = h('div', 'skill-top-title');
    this.equipBar = h('div', 'equip-slots');
    top.append(this.skillHeader, this.equipBar);
    this.equipKey = '';
    this.panel.append(top, this.buildBoxes());
    // 형태별로 나눠서 (공격형 · 보조형 · 디버프형 · 버프형)
    for (const type of SKILL_TYPES) {
      const head = h('div', 'skill-type-head');
      head.style.setProperty('--type', type.color);
      head.append(h('span', 'type-name', type.name), h('span', 'type-desc', type.desc));
      const grid = h('div', 'skill-grid');
      for (const def of SKILLS.filter((d) => d.type === type.id)) {
        const root = h('button', 'skill-tile');
        root.style.setProperty('--type', type.color);
        const lv = h('span', 'tile-lv');
        const grade = h('span', `tile-grade g-${SKILL_GRADE[def.id]}`, SKILL_GRADE[def.id]);
        root.append(skillIcon(def, 'tile-icon'), grade, lv, h('span', 'tile-name', def.name));
        root.addEventListener('click', () => this.showSkill(def));
        grid.append(root);
        this.skillTiles.push({ def, root, lv });
      }
      this.panel.append(head, grid);
    }
    this.panel.append(h('div', 'hint', '스킬은 상자에서 얻어요 · 겹치면 피해 +1 · 등급이 높을수록 강화가 비싸요'));
  }

  /** 보스 레이드: 보스 고르기 */
  private showRaidSelect() {
    const list = h('div', 'raid-list');
    for (const b of RAID_BOSSES) {
      const card = h('div', 'card row raid-card');
      const info = h('div', 'info');
      info.append(
        h('div', 'title', `${b.name}  ${'★'.repeat(b.stars)}${'☆'.repeat(5 - b.stars)}`),
        h('div', 'sub', b.desc),
        h('div', 'cost-line', `이기면 🔮 ${b.essence}${b.diamonds ? ` · 💎 ${b.diamonds}` : ''} · 체력 ×${b.hpMul}`),
      );
      const go = h('button', 'enter', '도전');
      go.disabled = this.game.entriesLeft('raid') <= 0;
      go.addEventListener('click', () => {
        this.closeModal();
        this.game.enterAction('raid', b.id);
      });
      card.append(ibox(monsterPic(b.skin, 44), 'big'), info, go);
      list.append(card);
    }
    this.openModal(
      h('div', 'modal-title', '😈 보스 레이드'),
      h('div', 'modal-sub', `오늘 ${this.game.entriesLeft('raid')}/${DUNGEON_DAILY.raid}회 · 별이 많을수록 세고 보상도 커요`),
      list,
      this.button('닫기', 'primary', () => this.closeModal()),
    );
  }

  /** 스킬 상자 칸: 상자마다 1회·10회 버튼과 등급 확률 */
  private buildBoxes() {
    const g = this.game;
    const wrap = h('div', 'box-list');
    const refreshers = SKILL_BOXES.map((box) => {
      const card = h('div', `card row skill-box box-${box.id}`);
      const info = h('div', 'info');
      const odds = h('div', 'box-odds');
      for (const gr of ['S', 'A', 'B', 'C', 'D'] as const) {
        const p = box.odds[gr];
        if (p) odds.append(h('span', `tile-grade g-${gr}`, `${gr} ${p}%`));
      }
      const btns = h('div', 'box-btns');
      const mk = (n: 1 | 10) => {
        const b = h('button', 'buy');
        const label = h('span');
        b.append(label, h('small', '', n === 1 ? '1회' : '10회'));
        b.addEventListener('click', () => this.openBox(box, n));
        btns.append(b);
        return { b, label, n };
      };
      const buttons = [mk(1), mk(10)];
      info.append(h('div', 'title', box.name), odds);
      card.append(h('div', 'item-icon box-icon', box.icon), info, btns);
      wrap.append(card);
      return () => {
        for (const { b, label, n } of buttons) {
          const books = g.save.mats.skillbook ?? 0;
          if (n === 1 && box.book && books > 0) label.textContent = `📕 ${books}`;
          else {
            const c = boxCost(box, n, g.save.maxStage);
            label.replaceChildren(c.gold !== undefined ? coin(fmt(c.gold)) : document.createTextNode(`💎 ${fmt(c.diamonds!)}`));
          }
          b.disabled = !g.canOpenBox(box.id, n);
        }
      };
    });
    this.boxRefresh = () => refreshers.forEach((f) => f());
    return wrap;
  }

  /** 상자 열기 결과: 카드가 하나씩 뒤집힌다 */
  private openBox(box: BoxDef, n: 1 | 10) {
    const res = this.game.openSkillBox(box.id, n);
    if (!res) return this.toast(box.goldSec ? '골드가 모자라요' : '💎 다이아가 모자라요');
    const grid = h('div', 'summon-grid');
    res.forEach((r, i) => {
      const grade = SKILL_GRADE[r.def.id];
      const card = h('div', `summon-card box-card gr-${grade}` + (r.isNew ? ' new' : ''));
      card.append(h('span', `tile-grade g-${grade}`, grade), skillIcon(r.def, 'tile-icon'), h('div', 'summon-name', r.def.name), h('div', 'summon-text', r.text));
      card.style.animationDelay = `${i * 0.08}s`;
      grid.append(card);
    });
    sfx.chest();
    this.openModal(
      h('div', 'modal-title', `${box.icon} ${box.name}!`),
      h('div', 'modal-sub', oddsText(box)),
      grid,
      this.button('한 번 더', '', () => this.openBox(box, n)),
      this.button('닫기', 'primary', () => this.closeModal()),
    );
    this.refresh();
  }

  /** 스킬 창: 설명, 배우기 또는 가지 강화, 장착·교체 */
  private showSkill(def: SkillDef) {
    const g = this.game;
    g.seeSkill(def.id);
    const head = h('div', 'tree-head');
    const title = h('div', 'info');
    const summary = h('div', 'modal-sub');
    const name = h('div', 'modal-title', def.name + ' ');
    name.append(h('span', `grade-badge g-${SKILL_GRADE[def.id]}`, `${SKILL_GRADE[def.id]}등급`));
    title.append(name, h('div', 'modal-sub', def.blurb), summary);
    // 아이콘을 누르면 실제 발동 미리보기
    const icon = skillIcon(def, 'skill-art clickable');
    const pvBox = h('div', 'preview-box');
    const pvHint = h('div', 'preview-hint', '▶ 아이콘을 누르면 발동 미리보기');
    icon.addEventListener('click', () => {
      if (pvBox.firstChild) {
        pvBox.replaceChildren();
        pvHint.textContent = '▶ 아이콘을 누르면 발동 미리보기';
      } else {
        pvBox.append(skillPreview(def, g.skillTree(def.id) ?? emptyTree()));
        pvHint.textContent = '■ 아이콘을 다시 누르면 닫기';
      }
    });
    head.append(icon, title);
    const gold = h('div', 'tree-gold');

    if (!g.skillTree(def.id)) {
      // 아직 없음: 어느 상자에서 나오는지
      const grade = SKILL_GRADE[def.id];
      const where = h('div', 'box-where');
      where.append(h('div', 'title', `${grade}등급 · 이 상자에서 나와요`));
      for (const box of boxesFor(grade)) {
        const row = h('div', 'box-where-row');
        row.append(h('span', '', `${box.icon} ${box.name}`), h('b', '', `${grade} ${box.odds[grade]}%`));
        where.append(row);
      }
      summary.textContent = skillSummary(def, emptyTree());
      this.treeRefresh = null;
      this.openModal(head, pvHint, pvBox, where, this.button('닫기', 'primary', () => this.closeModal()));
      return;
    }

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
    // 장착: 형태마다 한 칸. 같은 형태가 끼워져 있으면 바꿔 낀다
    const equipBox = h('div', 'equip-box');
    const typeName = SKILL_TYPES.find((t) => t.id === def.type)!.name;
    const renderEquip = () => {
      const on = g.save.equipped.includes(def.id);
      const cur = g.equippedOfType(def.type);
      const label = on ? `장착 해제 (${typeName} 칸)` : cur ? `${typeName} 칸 교체 (${SKILL_BY_ID[cur].name} → ${def.name})` : `${typeName} 칸에 장착`;
      equipBox.replaceChildren(this.button(label, on ? '' : 'primary', () => {
        g.toggleEquip(def.id);
        if (!on && cur) this.toast(`${SKILL_BY_ID[cur].name} → ${def.name} 교체!`);
        this.refresh();
        renderEquip();
      }));
    };
    renderEquip();
    // 스테이지 중엔 강화만 (장착 바꾸기는 메인 화면에서)
    if (g.mode === 'action') equipBox.replaceChildren(h('div', 'modal-sub', '⏸ 전투 일시정지 중 · 닫으면 이어서 싸워요'));
    this.treeRefresh = () => {
      const tree = g.skillTree(def.id) ?? emptyTree();
      summary.textContent = skillSummary(def, tree);
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
      gold.replaceChildren(coin(fmt(g.save.gold)));
    };
    this.openModal(head, pvHint, pvBox, gold, ...rows.map((r) => r.row), equipBox, this.button('닫기', 'primary', () => this.closeModal()));
    this.treeRefresh();
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

    // 재료 던전 / 보스 레이드 / 무한 모드 (최고 스테이지 난이도)
    const extra = ([
      ['material', '📦', '재료 던전', '45초 동안 3초마다 보물 상자! 지역 재료·스킬북을 쓸어 담아요'],
      ['raid', '😈', '보스 레이드', '보스 5종 중 골라서 도전 · 빨간 장판을 피하고 2페이즈를 버텨요 · 🔮 보스의 정수·💎'],
      ['infinite', '♾️', '무한 모드', '끝없이 몰려온다 · 1분마다 다음 지역 · 오래 버틸수록 기록'],
    ] as const).map(([kind, icon, name, desc]) => {
      const c = h('div', 'card dungeon');
      const info = h('div', 'info');
      const sub = h('div', 'ratio');
      info.append(h('div', 'title', name), h('div', 'sub', desc), sub);
      const enter = h('button', 'enter', '입장');
      enter.addEventListener('click', () => (kind === 'raid' ? this.showRaidSelect() : this.game.enterAction(kind)));
      c.append(h('div', 'item-icon', icon), info, enter);
      this.panel.append(c);
      return () => {
        const s = this.game.save;
        if (kind === 'infinite') {
          sub.textContent = s.infiniteBest > 0 ? `최고 기록 ${fmtTime(s.infiniteBest)}` : '기록 없음';
          return;
        }
        const left = this.game.entriesLeft(kind);
        sub.textContent = `오늘 ${left}/${DUNGEON_DAILY[kind]}회${kind === 'raid' ? ` · 🔮 보유 ${s.essence}` : ''}`;
        enter.disabled = left <= 0;
      };
    });

    this.dungeonRefresh = () => {
      extra.forEach((r) => r());
      const stage = this.game.nextStage;
      title.textContent = isBossStage(stage) ? `스테이지 ${stage} · 마왕` : `스테이지 ${stage}`;
      const rule = stageRule(stage);
      sub.textContent = `${regionOf(stage).name}${rule ? ` · 규칙: ${rule.name}` : ''} · 권장 전투력 ${fmt(recommendedPower(stage))} · 클리어 보상 ${fmt(stageClearGold(stage))}`;
      const r = actionRatio(this.game.stats, stage);
      const worst = Math.min(r.atk, r.hp);
      const [label, cls] = worst < 0.6 ? ['위험', 'bad'] : worst < 0.9 ? ['도전', 'mid'] : ['여유', 'good'];
      ratio.className = 'ratio ' + cls;
      ratio.textContent = `${label} · 공격 ×${r.atk.toFixed(2)} · 체력 ×${r.hp.toFixed(2)}`;
    };
  }

  // ---- 매 프레임 ----

  tick(dt: number) {
    this.tutorial.tick();
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
    const feverOn = a.fever > 0;
    this.app.classList.toggle('fever-on', feverOn);
    this.feverFill.style.width = `${Math.min(1, feverOn ? a.fever / FEVER_SEC : a.feverProgress) * 100}%`;
    // 콤보: 처치할 때마다 크게 튀었다가 줄어들고, 끊기기 직전엔 흐려진다
    const since = this.game.engine.time - a.lastKillAt;
    if (a.combo >= 5 && since <= a.comboSec) {
      const pop = 1 + 0.35 * Math.max(0, 1 - since / 0.15);
      this.comboEl.textContent = `${a.combo} COMBO`;
      this.comboEl.style.transform = `scale(${pop.toFixed(3)})`;
      this.comboEl.style.opacity = String(Math.min(1, (a.comboSec - since) / 0.5));
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

  refresh() {
    const g = this.game;
    const save = g.save;
    if (g.mode === 'idle') {
      this.goldEl.textContent = fmt(save.gold);
      this.stageEl.textContent = save.maxStage > 0 ? `최고 스테이지 ${save.maxStage}` : '스테이지 기록 없음';
      this.incomeEl.textContent = `초당 +${fmt(g.goldPerSec)}`;
      const next = g.nextStage;
      this.challengeLabel.textContent = isBossStage(next) ? `스테이지 ${next} 마왕 도전` : `스테이지 ${next} 도전`;
      this.challengeBtn.classList.toggle('boss', isBossStage(next));
      this.missionBtn.classList.toggle('dot', g.hasClaimable);
      // 새 스킬이 있으면 스킬 탭에 빨간 점, 안 연 상자가 있으면 가방 탭에
      this.tabButtons.get('skill')?.classList.toggle('dot', save.newSkills.length > 0);
      this.tabButtons.get('gear')?.classList.toggle('dot', g.chestCounts.some((n) => n > 0));

      const st = g.stats;
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
      this.metaRefresh?.();
    } else {
      const a = g.action;
      const p = g.engine.player;
      const hp = Math.max(0, p.hp / p.maxHp);
      this.hpLost.style.width = `${(1 - hp) * 100}%`;
      this.hpText.textContent = `${Math.ceil(Math.max(0, p.hp))} / ${Math.ceil(p.maxHp)}`;
      this.lvEl.textContent = `Lv.${save.level}`;
      this.xpFill.style.width = `${Math.min(1, save.xp / xpToNext(save.level)) * 100}%`;
      if (a.kind === 'stage') {
        this.plateEl.textContent = `STAGE ${a.stage}`;
        this.timerEl.textContent = a.bossSpawned ? (a.isBossStage ? '마왕!' : '정예!') : fmtTime(a.duration - a.time);
      } else {
        this.plateEl.textContent = { material: '재료 던전', raid: '보스 레이드', infinite: '무한 모드' }[a.kind];
        this.timerEl.textContent = fmtTime(a.kind === 'infinite' ? a.time : Math.max(0, a.duration - a.time));
      }
      this.timerEl.classList.toggle('boss', a.bossSpawned);
      this.treeRefresh?.();
      this.killsEl.textContent = String(a.kills);
    }
  }

  private refreshSkills() {
    this.treeRefresh?.();
    this.boxRefresh?.();
    if (!this.skillHeader || !this.equipBar) return;
    const g = this.game;
    const eq = g.save.equipped;
    this.skillHeader.textContent = `장착 중 ${eq.length}/${EQUIP_SLOTS} · 형태마다 한 칸`;
    const key = eq.join();
    if (key !== this.equipKey) {
      this.equipKey = key;
      const slots = SKILL_TYPES.map((type) => {
        const id = g.equippedOfType(type.id);
        const def = id ? SKILL_BY_ID[id] : null;
        const b = h('button', 'equip-slot' + (def ? '' : ' empty'));
        b.style.setProperty('--type', type.color);
        b.append(h('span', 'slot-type', type.name));
        if (def) {
          b.append(skillIcon(def, 'tile-icon'), h('span', 'tile-name', def.name));
          b.addEventListener('click', () => this.showSkill(def));
        } else {
          b.append(h('span', 'tile-plus', '+'), h('span', 'tile-name', '빈 칸'));
        }
        return b;
      });
      this.equipBar.replaceChildren(...slots);
    }
    for (const t of this.skillTiles) {
      const tree = g.skillTree(t.def.id);
      t.root.classList.toggle('unlearned', !tree);
      t.root.classList.toggle('equipped', eq.includes(t.def.id));
      t.root.classList.toggle('new', g.save.newSkills.includes(t.def.id));
      t.lv.textContent = tree ? `Lv${treeLevel(tree)}` : '';
    }
  }

  // ---- 토스트 / 모달 ----

  toast(msg: string) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    this.toastT = 2.2;
  }

  openModal(...children: HTMLElement[]) {
    const box = h('div', 'modal');
    box.append(...children);
    this.overlay.replaceChildren(box);
    this.overlay.classList.add('show');
    return box;
  }

  setModalRefresh(fn: (() => void) | null) {
    this.treeRefresh = fn;
  }

  closeModal() {
    this.treeRefresh = null;
    const after = this.onModalClose;
    this.onModalClose = null;
    after?.();
    this.overlay.classList.remove('show');
    this.overlay.replaceChildren();
  }

  button(text: string, cls: string, fn: () => void) {
    const b = h('button', 'btn ' + cls, text);
    b.addEventListener('click', fn);
    return b;
  }

  /** 두 번 눌러야 실행되는 버튼 (임베드 환경에선 confirm()이 막혀 있다) */
  confirmButton(text: string, confirmText: string, fn: () => void) {
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
    if (r.kind === 'raid') {
      line('보스의 정수', `🔮 +${r.essence}`);
      const boss = this.game.action.raidBoss;
      if (r.win && boss.diamonds) line('다이아', `💎 +${boss.diamonds}`);
    }
    let title = r.win ? `스테이지 ${r.stage} 클리어!` : '쓰러졌어요…';
    let sub = r.win ? '방치 수입이 이 스테이지 기준으로 올라가요' : '강화하고 다시 도전해 보세요';
    if (r.kind === 'material') {
      title = r.win ? '재료 던전 완료!' : '재료 던전 끝';
      sub = '주운 상자는 가방 탭에서 열어요';
    } else if (r.kind === 'raid') {
      title = r.win ? '레이드 성공!' : '레이드 실패…';
      sub = r.win ? '보스의 정수로 전설 장비를 만들어요' : '보스 체력을 절반 넘게 깎으면 정수 1개';
    } else if (r.kind === 'infinite') {
      title = r.best ? `신기록! ${fmtTime(r.time)}` : `${fmtTime(r.time)} 버텼어요`;
      sub = `최고 기록 ${fmtTime(this.game.save.infiniteBest)}`;
    }
    const parts: HTMLElement[] = [h('div', 'modal-title ' + (r.win || r.best ? 'win' : 'lose'), title), h('div', 'modal-sub', sub), stats];
    // 주운 상자는 가방으로 (가방 탭에서 한꺼번에 연다)
    if (r.chests.length > 0) {
      const n = [0, 1, 2].map((g) => r.chests.filter((c) => c === g).length);
      const text = n.map((k, g) => (k ? `${CHEST_NAMES[g]} ×${k}` : '')).filter(Boolean).join(' · ');
      stats.append(h('div', 'result-row'));
      stats.lastElementChild!.append(h('span', '', '주운 상자'), h('b', '', text));
      parts.push(h('div', 'modal-sub', '🎒 상자는 가방 탭에서 한꺼번에 열어요'));
    }
    parts.push(
      this.button('돌아가기', 'primary', () => {
        this.closeModal();
        done();
      }),
    );
    this.openModal(...parts);
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
      h('div', 'modal-sub', `프로토타입 v0.4 · 빌드 ${new Date(__BUILD_TIME__).toLocaleString('ko-KR')}`),
      this.button(document.fullscreenElement ? '전체 화면 끄기' : '전체 화면', '', () => {
        if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
        else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => this.toast('전체 화면을 켤 수 없어요'));
        else this.toast('이 브라우저는 전체 화면을 지원하지 않아요 (공유 → 홈 화면에 추가하면 전체 화면으로 열려요)');
        this.closeModal();
      }),
      this.button(g.save.sound ? '소리 끄기' : '소리 켜기', '', () => {
        g.toggleSound();
        this.closeModal();
        this.showSettings();
      }),
      this.button('테스트: 골드 지급', '', () => {
        g.save.gold += g.goldPerSec * 500;
        this.refresh();
        this.toast('골드를 지급했어요');
      }),
      this.button('테스트: 다이아 1,000 지급', '', () => {
        g.save.diamonds += 1000;
        this.refresh();
        this.toast('💎 1,000을 지급했어요');
      }),
      this.button('튜토리얼 다시 보기', '', () => {
        this.closeModal();
        if (g.mode !== 'idle') return this.toast('메인 화면에서 다시 눌러 주세요');
        this.selectTab('growth');
        this.tutorial.restart();
      }),
      this.confirmButton('저장 초기화', '한 번 더 누르면 모두 지워져요', () => g.resetSave()),
      this.button('닫기', 'primary', () => this.closeModal()),
    );
  }
}
