import { sfx } from '../audio/sfx';
import { CHEST_NAMES, MAT_BY_ID, type ChestGrade } from '../data/items';
import { regionOf } from '../data/world';
import { fmt, fmtDuration, fmtTime } from '../core/format';
import {
  STATS, STAT_ORDER, actionRatio, isBossStage, playerPower, recommendedPower, stageClearGold, xpToNext,
  type StatId,
} from '../data/balance';
import {
  BRANCHES, EQUIP_SLOTS, SKILLS, SKILL_GRADE, SKILL_TYPES, branchValue, emptyTree, skillSummary, treeLevel, SKILL_BY_ID, type Grade, type SkillDef,
} from '../data/skills';
import { RAID_BOSSES } from '../data/raids';
import { SHARD_COST, SKILL_BOXES, boxCost, boxesFor, weeklyPickup, type BoxDef } from '../data/skillbox';
import { COLLECTION_BONUS, DUNGEON_DAILY, REBIRTH_MIN_STAGE, type Game, type Mode } from '../game';
import { FEVER_SEC, type RunResult } from '../modes/action';
import { UI_URLS } from '../battle/sprites';
import { art, chickPic, coin, h, holdRepeat, ibox, monsterPic, skillIcon, svgIcon } from './dom';
import { buildCraftTab, buildBagTab, showCollection, showRebirth, type UIHost } from './meta';
import { buildShopTab, showMissions } from './shop';
import { ICONS } from './icons';
import { skillPreview } from './preview';
import { Tutorial } from './tutorial';

/** 매 프레임 바뀌는 화면 값: 진짜 바뀔 때만 DOM에 쓴다 (같은 값을 계속 쓰면 폰에서 스타일 계산이 쌓인다) */
const lastStyle = new WeakMap<HTMLElement, Record<string, string>>();
function setStyle(el: HTMLElement, prop: 'width' | 'transform' | 'opacity', v: string) {
  let m = lastStyle.get(el);
  if (!m) lastStyle.set(el, (m = {}));
  if (m[prop] === v) return;
  m[prop] = v;
  el.style[prop] = v;
}
function setText(el: HTMLElement, v: string) {
  if (el.textContent !== v) el.textContent = v;
}

/** 스킬 탭에서 보고 있는 형태 (탭을 옮겨 다녀도 기억) */
let skillTypeView: SkillDef['type'] = 'attack';

/** 자동 진행: 결과 화면에서 이만큼(초) 기다린 뒤 다음 스테이지 */
const AUTO_NEXT_SEC = 3;

type TabId = 'growth' | 'skill' | 'gear' | 'craft' | 'dungeon' | 'shop';

const TABS: { id: TabId; name: string; locked: boolean }[] = [
  { id: 'growth', name: '성장', locked: false },
  { id: 'skill', name: '스킬', locked: false },
  { id: 'gear', name: '가방', locked: false },
  { id: 'craft', name: '제작', locked: false },
  { id: 'dungeon', name: '모험', locked: false },
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
  /** 성장 탭이 아닐 때 위에 뜨는 얇은 줄 (골드·다이아·설정): 방치 화면은 접는다 */
  private readonly miniHud: HTMLElement;
  private readonly miniGold: HTMLElement;
  private readonly miniDia: HTMLElement;
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
  /** 스테이지를 깨면 다음 스테이지 자동 진행 켜기/끄기 */
  private readonly autoNextBtn: HTMLButtonElement;
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
  private currentTab: TabId = 'growth';
  private powerEl: HTMLElement | null = null;
  private dungeonRefresh: (() => void) | null = null;
  /** 가방 탭 같은 추가 화면 갱신 */
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
    const left = h('div', 'action-left');
    left.append(player);
    this.autoNextBtn = h('button', 'text-btn auto-next');
    this.autoNextBtn.addEventListener('click', () => {
      this.game.save.autoNext = !this.game.save.autoNext;
      this.toast(this.game.save.autoNext ? '자동 진행 켜짐: 깨면 다음 스테이지로 바로' : '자동 진행 꺼짐');
      this.refreshToggles();
    });
    const right = h('div', 'action-right');
    right.append(kills, pauseBtn, this.autoNextBtn);
    this.hudAction.append(left, center, right);

    // 하단: 스킬 칸 (수동일 땐 눌러서 발동) + 스킬 자동/수동 전환
    const bottom = h('div', 'action-bottom');
    this.slotsEl = h('div', 'skill-slots');
    // 오른쪽 아래: 스킬 칸 + AUTO (엄지로 누르기 좋게)
    const bottomRow = h('div', 'bottom-row');
    bottomRow.append(this.slotsEl, this.autoBtn);
    bottom.append(bottomRow);
    this.comboEl = h('div', 'combo');
    this.feverBanner = h('div', 'fever-banner', 'FEVER TIME!');

    this.battle.append(this.hudIdle, this.challengeBtn, this.missionBtn, this.hudAction, bottom, this.comboEl, this.feverBanner);

    // 성장 탭이 아닐 때: 방치 화면 대신 얇은 줄
    this.miniHud = h('div', 'mini-hud');
    this.miniGold = h('span', 'mini-chip');
    this.miniDia = h('span', 'mini-chip');
    const miniSettings = h('button', 'art-btn mini-settings');
    miniSettings.append(art('btn-gear'));
    miniSettings.setAttribute('aria-label', '설정');
    miniSettings.addEventListener('click', () => this.showSettings());
    this.miniHud.append(this.miniGold, this.miniDia, miniSettings);

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
    this.app.append(this.battle, this.miniHud, this.panel, this.tabBar, this.overlay, this.toastEl);
    this.tutorial = new Tutorial(this.game, document.body, () => this.overlay.classList.contains('show'));
    // 모든 버튼: 누르는 순간 짧은 소리와 진동 (눌린 게 확실히 느껴지게)
    document.addEventListener('pointerdown', (e) => {
      const b = e.target instanceof Element ? e.target.closest('button') : null;
      if (!b || b.disabled) return;
      sfx.click();
      if (this.game.save.sound) navigator.vibrate?.(8);
    }, true);

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
    this.autoBtn.classList.toggle('on', save.autoMove);
    this.autoNextBtn.textContent = save.autoNext ? '자동 진행 ON' : '자동 진행 OFF';
    this.autoNextBtn.classList.toggle('on', save.autoNext);
  }

  /** 스테이지에서 스킬 칸을 누르면: 전투를 멈추고 그 스킬 설명만 (강화는 메인 화면에서, 닫으면 이어서) */
  private openStageSkill(def: SkillDef) {
    const a = this.game.action;
    if (a.state !== 'playing') return;
    a.state = 'paused';
    this.game.joystick.release();
    this.onModalClose = () => {
      if (a.state === 'paused') a.state = 'playing';
    };
    const type = SKILL_TYPES.find((t) => t.id === def.type)!;
    const grade = SKILL_GRADE[def.id];
    const tree = this.game.skillTree(def.id) ?? emptyTree();
    const head = h('div', 'tree-head');
    const info = h('div', 'info');
    const name = h('div', 'modal-title', def.name + ' ');
    name.append(h('span', `grade-badge g-${grade}`, `${grade}등급`));
    const kind = h('div', 'modal-sub', `${type.name} · Lv ${treeLevel(tree)}`);
    kind.style.color = type.color;
    info.append(name, kind, h('div', 'modal-sub', def.blurb), h('div', 'modal-sub', skillSummary(def, tree)));
    head.append(skillIcon(def, 'skill-art'), info);
    this.openModal(
      head,
      h('div', 'modal-sub', '⏸ 전투 일시정지 중 · 스킬 강화는 메인 화면 스킬 탭에서'),
      this.button('계속 싸우기', 'primary', () => this.closeModal()),
    );
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
    // 방치 화면은 메인(성장 탭)에서만, 나머지 탭은 아래 내용이 화면을 꽉 채운다
    this.app.classList.toggle('compact', id !== 'growth');
    this.currentTab = id;
    if (id === 'skill') this.game.seeSkillTab();
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
    else if (id === 'gear') this.metaRefresh = buildBagTab(this.panel, this.game, this);
    else if (id === 'craft') this.metaRefresh = buildCraftTab(this.panel, this.game, this);
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
    // 능력치 4개를 2×2 작은 칸으로 (스크롤 없이 한 화면에)
    const grid = h('div', 'stat-grid');
    for (const id of STAT_ORDER) {
      const def = STATS[id];
      const meta = STAT_META[id];
      const card = h('div', 'card stat-card');
      const icon = svgIcon(ICONS[id], meta.color);
      const name = h('div', 'title', def.name + ' ');
      const lv = h('span', 'lv');
      name.append(lv);
      const head = h('div', 'stat-head');
      head.append(icon, name);
      const val = h('div', 'sub');
      const btn = h('button', 'buy');
      const cost = h('span');
      btn.append(cost, h('small', '', '강화'));
      holdRepeat(btn, () => {
        const ok = this.game.upgrade(id);
        if (ok) this.refresh();
        return ok;
      });
      card.append(head, val, btn);
      grid.append(card);
      this.statRows.set(id, { lv, val, cost, btn });
    }
    this.panel.append(grid);
    this.panel.append(h('div', 'hint', '버튼을 누르고 있으면 연속 강화 · 전투 화면을 탭하면 추가 피해 · 도감·환생은 모험 탭에'));
  }

  /** 스킬 탭: 위에 장착 중 4칸 고정, 아래는 아이콘 격자(5줄)만 스크롤 */
  private buildSkills() {
    const top = h('div', 'skill-top');
    this.skillHeader = h('div', 'skill-top-title');
    this.equipBar = h('div', 'equip-slots');
    top.append(this.skillHeader, this.equipBar);
    this.equipKey = '';
    this.panel.append(top, this.buildBoxes());
    // 형태별 탭 (공격형 · 보조형 · 디버프형 · 버프형): 한 번에 한 형태만
    const seg = h('div', 'seg skill-type-seg');
    const desc = h('div', 'skill-type-desc');
    const grid = h('div', 'skill-grid');
    const btns = SKILL_TYPES.map((type) => {
      const b = h('button', 'seg-btn', type.name);
      b.style.setProperty('--type', type.color);
      b.addEventListener('click', () => {
        skillTypeView = type.id;
        render();
        this.refresh();
      });
      seg.append(b);
      return { type, b };
    });
    const render = () => {
      const type = SKILL_TYPES.find((t) => t.id === skillTypeView)!;
      for (const x of btns) x.b.classList.toggle('on', x.type.id === type.id);
      desc.textContent = type.desc;
      desc.style.color = type.color;
      this.skillTiles = [];
      grid.replaceChildren();
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
    };
    render();
    this.panel.append(seg, desc, grid);
    this.panel.append(h('div', 'hint', '스킬은 상자에서 얻어요 · 겹쳐 나오면 그 스킬 포인트 +1 · 스킬 창에서 피해·속도·개수 중 골라 찍어요'));
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

  /** 스킬 상자 칸: 주간 픽업 띠 + 상자 5종 + 조각 교환 (2열). 상자를 누르면 확률 */
  private buildBoxes() {
    const g = this.game;
    const wrap = h('div', 'box-area');
    // 이번 주 픽업
    const up = weeklyPickup();
    const banner = h('button', 'pickup-banner');
    banner.append(h('span', 'pickup-title', '⭐ 이번 주 픽업'));
    for (const d of [...up.S, ...up.A]) {
      const chip = h('span', 'pickup-chip');
      chip.append(skillIcon(d, 'pickup-icon'), h('span', `tile-grade g-${SKILL_GRADE[d.id]}`, SKILL_GRADE[d.id]));
      banner.append(chip);
    }
    banner.addEventListener('click', () => this.openModal(
      h('div', 'modal-title', '⭐ 이번 주 픽업'),
      h('div', 'modal-sub', '금·전설·형태 선택 상자에서 S·A급이 나오면 절반 확률로 이 스킬이에요 (매주 바뀜)'),
      ...[...up.S, ...up.A].map((d) => {
        const row = h('div', 'box-where-row');
        row.append(h('span', '', `${d.name}`), h('b', `tile-grade g-${SKILL_GRADE[d.id]} odds-grade`, `${SKILL_GRADE[d.id]}급`));
        return row;
      }),
      this.button('닫기', 'primary', () => this.closeModal()),
    ));
    const list = h('div', 'box-list');
    wrap.append(banner, list);
    const refreshers = SKILL_BOXES.map((box) => {
      // 작은 칸: 위에 상자(누르면 확률), 천장까지 남은 횟수, 아래 1회·10회
      const card = h('div', `card skill-box box-${box.id}`);
      const head = h('button', 'box-head');
      head.append(h('span', 'box-icon', box.icon), h('span', 'title', box.name), h('span', 'box-info', 'ⓘ'));
      head.addEventListener('click', () => this.showBoxOdds(box));
      const pity = h('div', 'box-pity');
      const btns = h('div', 'box-btns');
      const mk = (n: 1 | 10) => {
        const b = h('button', 'buy');
        const label = h('span');
        b.append(label, h('small', '', n === 1 ? '1회' : '10회'));
        b.addEventListener('click', () => (box.pick ? this.pickType(box, n) : this.openBox(box, n)));
        btns.append(b);
        return { b, label, n };
      };
      const buttons = [mk(1), mk(10)];
      card.append(head, pity, btns);
      list.append(card);
      return () => {
        const left = g.pityLeft(box.id);
        setText(pity, left !== null && box.pity ? `${box.pity.grade}급 확정까지 ${left}회` : '');
        for (const { b, label, n } of buttons) {
          const key = n === 1 ? g.boxKey(box.id) : null;
          if (n === 1 && box.id === 'silver' && g.freeBoxReady) label.textContent = '🎁 무료!';
          else if (key) label.textContent = `${MAT_BY_ID[key].icon} ${g.save.mats[key]}`;
          else {
            const c = boxCost(box, n, g.save.maxStage);
            label.replaceChildren(c.gold !== undefined ? coin(fmt(c.gold)) : document.createTextNode(`💎 ${fmt(c.diamonds!)}`));
          }
          b.disabled = !g.canOpenBox(box.id, n);
        }
      };
    });
    // 조각 교환 칸
    const shardCard = h('div', 'card skill-box box-shard');
    const shardHead = h('div', 'box-head');
    shardHead.append(h('span', 'box-icon', '🧩'), h('span', 'title', '조각 교환'));
    const shardLine = h('div', 'box-pity');
    const shardBtn = this.button('원하는 스킬로', 'primary', () => this.showShardShop());
    shardCard.append(shardHead, shardLine, shardBtn);
    list.append(shardCard);
    refreshers.push(() => setText(shardLine, `보유 🧩 ${fmt(g.save.shards)} · 겹치면 쌓여요`));
    this.boxRefresh = () => refreshers.forEach((f) => f());
    return wrap;
  }

  /** 형태 선택 상자: 형태 고르기 */
  private pickType(box: BoxDef, n: 1 | 10) {
    if (!this.game.canOpenBox(box.id, n)) return this.toast('💎 다이아가 모자라요');
    this.openModal(
      h('div', 'modal-title', `${box.icon} 어떤 형태로 뽑을까요?`),
      h('div', 'modal-sub', '고른 형태의 스킬만 나와요'),
      ...SKILL_TYPES.map((t) => {
        const b = this.button(`${t.name} · ${t.desc}`, '', () => this.openBox(box, n, t.id));
        b.style.color = t.color;
        return b;
      }),
      this.button('닫기', 'primary', () => this.closeModal()),
    );
  }

  /** 조각 교환: 형태별로 스킬과 조각 값, 누르면 교환 (없으면 배우기, 있으면 포인트 +1) */
  private showShardShop(type: SkillDef['type'] = skillTypeView) {
    const g = this.game;
    const seg = h('div', 'seg skill-type-seg');
    for (const t of SKILL_TYPES) {
      const b = h('button', 'seg-btn' + (t.id === type ? ' on' : ''), t.name);
      b.style.setProperty('--type', t.color);
      b.addEventListener('click', () => this.showShardShop(t.id));
      seg.append(b);
    }
    const grid = h('div', 'skill-grid shard-grid');
    for (const def of SKILLS.filter((d) => d.type === type)) {
      const grade = SKILL_GRADE[def.id];
      const cost = SHARD_COST[grade];
      const t = h('button', 'skill-tile');
      const owned = !!g.skillTree(def.id);
      t.classList.toggle('unlearned', !owned);
      t.append(skillIcon(def, 'tile-icon'), h('span', `tile-grade g-${grade}`, grade), h('span', 'tile-lv', `🧩${cost}`), h('span', 'tile-name', def.name));
      t.disabled = g.save.shards < cost;
      t.addEventListener('click', () => {
        if (!g.exchangeShards(def.id)) return this.toast('🧩 조각이 모자라요');
        sfx.chest();
        this.toast(owned ? `${def.name} 스킬 포인트 +1` : `${def.name} 획득!`);
        this.refresh();
        this.showShardShop(type);
      });
      grid.append(t);
    }
    this.openModal(
      h('div', 'modal-title', '🧩 조각 교환'),
      h('div', 'modal-sub', `보유 🧩 ${fmt(g.save.shards)} · 없는 스킬은 배우고, 있는 스킬은 스킬 포인트 +1`),
      seg,
      grid,
      this.button('닫기', 'primary', () => this.closeModal()),
    );
  }

  /** 상자 확률 창 */
  private showBoxOdds(box: BoxDef) {
    const list = h('div', 'box-where');
    for (const gr of ['S', 'A', 'B', 'C', 'D'] as const) {
      const p = box.odds[gr];
      if (!p) continue;
      const row = h('div', 'box-where-row');
      row.append(h('span', `tile-grade g-${gr} odds-grade`, `${gr}급`), h('b', '', `${p}%`));
      list.append(row);
    }
    this.openModal(
      h('div', 'modal-title', `${box.icon} ${box.name}`),
      h('div', 'modal-sub', '등급별 확률 · 같은 등급 안에선 스킬이 고르게 나와요'),
      list,
      this.button('닫기', 'primary', () => this.closeModal()),
    );
  }

  /** 상자 열기 결과: 카드가 하나씩 뒤집힌다 */
  /** 상자 열기: 상자가 흔들리다 (가장 좋은 등급 색으로 빛나며) 펑 → 카드가 뒤집힌다. A급 이상은 반짝, S급은 무지개 */
  private openBox(box: BoxDef, n: 1 | 10, type?: SkillDef['type']) {
    const res = this.game.openSkillBox(box.id, n, type);
    if (!res) return this.toast(box.goldSec ? '골드가 모자라요' : '💎 다이아가 모자라요');
    const order: Grade[] = ['S', 'A', 'B', 'C', 'D'];
    const best = order.find((gr) => res.some((r) => SKILL_GRADE[r.def.id] === gr)) ?? 'D';
    const reveal = h('div', `box-reveal glow-${best}`);
    reveal.append(h('div', 'reveal-box', box.icon));
    const grid = h('div', 'summon-grid');
    res.forEach((r, i) => {
      const grade = SKILL_GRADE[r.def.id];
      const card = h('div', `summon-card box-card gr-${grade}` + (r.isNew ? ' new' : '') + (grade === 'S' || grade === 'A' ? ' shine' : ''));
      card.append(h('span', `tile-grade g-${grade}`, grade), skillIcon(r.def, 'tile-icon'), h('div', 'summon-name', r.def.name), h('div', 'summon-text', r.pity ? '천장!' : r.text));
      card.style.animationDelay = `${i * 0.08}s`;
      grid.append(card);
    });
    const again = this.button('한 번 더', '', () => (type ? this.openBox(box, n, type) : this.openBox(box, n)));
    const close = this.button('닫기', 'primary', () => this.closeModal());
    this.openModal(h('div', 'modal-title', `${box.icon} ${box.name}!`), reveal);
    sfx.chest();
    setTimeout(() => {
      if (!reveal.isConnected) return;
      if (best === 'S') sfx.fever();
      else sfx.chest();
      this.openModal(h('div', 'modal-title', `${box.icon} ${box.name}!`), grid, again, close);
    }, 750);
    this.refresh();
  }


  /** 스킬 발동 미리보기 창: 돌아가기 = 그 스킬 창으로 */
  private showSkillPreview(def: SkillDef) {
    this.openModal(
      h('div', 'modal-title', `${def.name} 미리보기`),
      h('div', 'modal-sub', def.blurb),
      skillPreview(def, this.game.skillTree(def.id) ?? emptyTree()),
      this.button('돌아가기', 'primary', () => this.showSkill(def)),
    );
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
    // 이름은 맨 위, 아이콘·설명 묶음은 장착 버튼 바로 위 (가지 찍기 칸이 위로 오게)
    title.append(h('div', 'modal-sub', def.blurb), summary);
    // 아이콘을 누르면 실제 발동 미리보기 (따로 창, '돌아가기'로 이 창에 돌아온다)
    const icon = skillIcon(def, 'skill-art clickable');
    const pvHint = h('div', 'preview-hint', '▶ 아이콘을 누르면 발동 미리보기');
    icon.addEventListener('click', () => this.showSkillPreview(def));
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
      this.openModal(name, head, pvHint, where, this.button('닫기', 'primary', () => this.closeModal()));
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
      btn.append(cost, h('small', '', '찍기'));
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
        r.cost.textContent = c === null ? 'MAX' : `⭐ ${c}`;
        r.btn.disabled = !g.canUpgradeBranch(def.id, r.br.id);
      }
      gold.textContent = `⭐ 스킬 포인트 ${g.save.skillPoints[def.id] ?? 0} (상자에서 겹치면 +1)`;
    };
    this.openModal(name, gold, ...rows.map((r) => r.row), head, pvHint, equipBox, this.button('닫기', 'primary', () => this.closeModal()));
    this.treeRefresh();
  }

  /** 모험 탭: 큰 아이콘 + 제목 타일 2열 (한 화면에 6개). 누르면 설명·입장 창 */
  private buildDungeon() {
    const g = this.game;
    interface Tile {
      icon: string;
      title: () => string;
      status: () => string;
      /** 설명 창 내용 */
      desc: () => string[];
      action: string;
      go: () => void;
      disabled?: () => boolean;
    }
    const stageInfo = () => {
      const stage = g.nextStage;
      const r = actionRatio(g.stats, stage);
      const worst = Math.min(r.atk, r.hp);
      const label = worst < 0.6 ? '위험' : worst < 0.9 ? '도전' : '여유';
      return { stage, r, label };
    };
    const left = (k: 'material' | 'raid') => `오늘 ${g.entriesLeft(k)}/${DUNGEON_DAILY[k]}회`;
    const tiles: Tile[] = [
      {
        icon: '⚔️',
        title: () => (isBossStage(g.nextStage) ? `스테이지 ${g.nextStage} 마왕` : `스테이지 ${g.nextStage}`),
        status: () => stageInfo().label,
        desc: () => {
          const { stage, r, label } = stageInfo();
          return [`${regionOf(stage).name} · 30초 버티면 ${isBossStage(stage) ? '마왕' : '정예'} 등장, 잡으면 클리어`, `권장 전투력 ${fmt(recommendedPower(stage))} · 클리어 보상 🪙 ${fmt(stageClearGold(stage))}`, `${label} · 공격 ×${r.atk.toFixed(2)} · 체력 ×${r.hp.toFixed(2)}`];
        },
        action: '도전',
        go: () => g.enterAction(),
      },
      {
        icon: '📦', title: () => '재료 던전', status: () => left('material'),
        desc: () => ['45초 동안 3초마다 보물 상자!', '지역 재료·스킬북을 쓸어 담아요', left('material')],
        action: '입장', go: () => g.enterAction('material'), disabled: () => g.entriesLeft('material') <= 0,
      },
      {
        icon: '😈', title: () => '보스 레이드', status: () => left('raid'),
        desc: () => ['보스 5종 중 골라서 도전', '빨간 장판을 피하고 2페이즈를 버텨요', `🔮 보스의 정수·💎 · 보유 🔮 ${g.save.essence}`, left('raid')],
        action: '보스 고르기', go: () => this.showRaidSelect(), disabled: () => g.entriesLeft('raid') <= 0,
      },
      {
        icon: '♾️', title: () => '무한 모드', status: () => (g.save.infiniteBest > 0 ? `최고 ${fmtTime(g.save.infiniteBest)}` : '기록 없음'),
        desc: () => ['끝없이 몰려온다 · 1분마다 다음 지역', '오래 버틸수록 기록', g.save.infiniteBest > 0 ? `최고 기록 ${fmtTime(g.save.infiniteBest)}` : '기록 없음'],
        action: '입장', go: () => g.enterAction('infinite'),
      },
      {
        icon: '📖', title: () => '도감', status: () => `${g.collectionCount}개`,
        desc: () => ['처음 잡은 몬스터·처음 얻은 유물이 모여요', `하나마다 공격력·체력 +1% (지금 +${Math.round(g.collectionCount * COLLECTION_BONUS * 100)}%)`],
        action: '보기', go: () => showCollection(g, this),
      },
      {
        icon: '🪶', title: () => '환생', status: () => `${g.save.rebirth.count}번`,
        desc: () => [`최고 스테이지 ${REBIRTH_MIN_STAGE}부터 환생 → 환생 깃털로 영구 강화`, `환생 ${g.save.rebirth.count}번 · 깃털 ${g.save.rebirth.feathers}개`],
        action: '열기', go: () => showRebirth(g, this),
      },
    ];
    const grid = h('div', 'adv-grid');
    const refreshers = tiles.map((t) => {
      const b = h('button', 'card adv-tile');
      const titleEl = h('div', 'adv-title');
      const statusEl = h('div', 'adv-status');
      b.append(h('div', 'adv-icon', t.icon), titleEl, statusEl);
      b.addEventListener('click', () => {
        const go = this.button(t.action, 'primary', () => {
          this.closeModal();
          t.go();
        });
        go.disabled = t.disabled?.() ?? false;
        this.openModal(
          h('div', 'modal-title', `${t.icon} ${t.title()}`),
          ...t.desc().map((line) => h('div', 'modal-sub', line)),
          go,
          this.button('닫기', '', () => this.closeModal()),
        );
      });
      grid.append(b);
      return () => {
        setText(titleEl, t.title());
        setText(statusEl, t.status());
        b.classList.toggle('dim', t.disabled?.() ?? false);
      };
    });
    this.panel.append(grid);
    this.dungeonRefresh = () => refreshers.forEach((f) => f());
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
    setStyle(this.feverFill, 'width', `${(Math.min(1, feverOn ? a.fever / FEVER_SEC : a.feverProgress) * 100).toFixed(1)}%`);
    // 콤보: 처치할 때마다 크게 튀었다가 줄어들고, 끊기기 직전엔 흐려진다
    const since = this.game.engine.time - a.lastKillAt;
    if (a.combo >= 5 && since <= a.comboSec) {
      const pop = 1 + 0.35 * Math.max(0, 1 - since / 0.15);
      setText(this.comboEl, `${a.combo} COMBO`);
      setStyle(this.comboEl, 'transform', `scale(${pop.toFixed(2)})`);
      setStyle(this.comboEl, 'opacity', Math.min(1, (a.comboSec - since) / 0.5).toFixed(2));
      this.comboEl.classList.toggle('hot', a.combo >= 100);
    } else {
      setStyle(this.comboEl, 'opacity', '0');
    }
    const eq = a.equipped;
    const key = eq.map((s) => s.def.id).join();
    if (key !== this.slotKey) {
      this.slotKey = key;
      this.buildSlots();
    }
    for (let i = 0; i < this.slots.length; i++) {
      const ready = eq[i]?.weapon.ready?.() ?? 1;
      setStyle(this.slots[i].fill, 'width', `${(Math.max(0, Math.min(1, ready)) * 100).toFixed(0)}%`);
      this.slots[i].root.classList.toggle('ready', ready >= 1);
    }
  }

  refresh() {
    const g = this.game;
    const save = g.save;
    if (g.mode === 'idle') {
      this.goldEl.textContent = fmt(save.gold);
      this.miniGold.replaceChildren(coin(fmt(save.gold)));
      this.miniDia.textContent = `💎 ${fmt(save.diamonds)}`;
      this.stageEl.textContent = save.maxStage > 0 ? `최고 스테이지 ${save.maxStage}` : '스테이지 기록 없음';
      setText(this.incomeEl, `마리당 +${fmt(g.goldPerKill)}`);
      const next = g.nextStage;
      this.challengeLabel.textContent = isBossStage(next) ? `스테이지 ${next} 마왕 도전` : `스테이지 ${next} 도전`;
      this.challengeBtn.classList.toggle('boss', isBossStage(next));
      this.missionBtn.classList.toggle('dot', g.hasClaimable);
      // 새 스킬이 있으면 스킬 탭에 빨간 점, 안 연 상자가 있으면 가방 탭에
      this.tabButtons.get('gear')?.classList.toggle('dot', g.chestCounts.some((n) => n > 0));
      // 스킬 탭을 한 번 둘러보면 꺼진다 (NEW 배지는 스킬 창을 열 때까지 그대로). 보고 있는 동안 생긴 것도 본 것으로
      if (this.currentTab === 'skill') g.seeSkillTab();
      this.tabButtons.get('skill')?.classList.toggle('dot', g.skillTabUnseen);

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
      setStyle(this.hpLost, 'width', `${((1 - hp) * 100).toFixed(1)}%`);
      setText(this.hpText, `${Math.ceil(Math.max(0, p.hp))} / ${Math.ceil(p.maxHp)}`);
      setText(this.lvEl, `Lv.${save.level}`);
      setStyle(this.xpFill, 'width', `${(Math.min(1, save.xp / xpToNext(save.level)) * 100).toFixed(1)}%`);
      if (a.kind === 'stage') {
        setText(this.plateEl, `STAGE ${a.stage}`);
        setText(this.timerEl, a.bossSpawned ? (a.isBossStage ? '마왕!' : '정예!') : fmtTime(a.duration - a.time));
      } else {
        setText(this.plateEl, { material: '재료 던전', raid: '보스 레이드', infinite: '무한 모드' }[a.kind]);
        setText(this.timerEl, fmtTime(a.kind === 'infinite' ? a.time : Math.max(0, a.duration - a.time)));
      }
      this.timerEl.classList.toggle('boss', a.bossSpawned);
      setText(this.killsEl, String(a.kills));
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
      // 찍을 수 있는 포인트가 있으면 별 표시
      const pts = g.save.skillPoints[t.def.id] ?? 0;
      t.root.classList.toggle('has-pts', pts > 0 && !!tree && BRANCHES.some((b) => g.canUpgradeBranch(t.def.id, b.id)));
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
      this.button('⚙️ 설정', '', () => this.showSettings(() => this.showPause(resume, giveUp))),
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
    // 기록(시간·처치·콤보)은 빼고 받은 것만
    line('골드', coin(fmt(r.gold)));
    if (r.levelUps > 0) line('레벨 업', `Lv ${this.game.save.level}!`);
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
      sub = r.win ? '보스의 정수로 전설 유물을 만들어요' : '보스 체력을 절반 넘게 깎으면 정수 1개';
    } else if (r.kind === 'infinite') {
      title = r.best ? `신기록! ${fmtTime(r.time)}` : `${fmtTime(r.time)} 버텼어요`;
      sub = `최고 기록 ${fmtTime(this.game.save.infiniteBest)}`;
    }
    const parts: HTMLElement[] = [h('div', 'modal-title ' + (r.win || r.best ? 'win' : 'lose'), title), h('div', 'modal-sub', sub), stats];
    // 주운 상자: 하나씩 튀어나오는 연출만 (가방에 들어갔다)
    if (r.chests.length > 0) parts.push(this.chestShow(r.chests));
    // 자동 진행: 스테이지를 깼으면 몇 초 뒤 다음 스테이지 (지거나 다른 판이면 멈춘다)
    let timer = 0;
    const g = this.game;
    if (r.win && r.kind === 'stage' && g.save.autoNext) {
      let left = AUTO_NEXT_SEC;
      const count = h('div', 'auto-next-count');
      const tick = () => {
        count.textContent = `⏩ ${left}초 뒤 스테이지 ${g.nextStage} 자동 시작`;
        if (left-- <= 0) {
          this.closeModal();
          g.enterAction();
          return;
        }
        timer = window.setTimeout(tick, 1000);
      };
      tick();
      parts.push(
        count,
        this.button('자동 진행 멈추기', '', () => {
          clearTimeout(timer);
          g.save.autoNext = false;
          this.refreshToggles();
          count.textContent = '자동 진행을 껐어요';
        }),
      );
    } else if (r.kind === 'stage') {
      const label = () => `자동 진행 ${g.save.autoNext ? 'ON' : 'OFF'} (깨면 다음 스테이지로)`;
      const toggle = this.button(label(), '', () => {
        g.save.autoNext = !g.save.autoNext;
        this.refreshToggles();
        toggle.textContent = label();
      });
      parts.push(toggle);
    }
    parts.push(
      this.button('돌아가기', 'primary', () => {
        clearTimeout(timer);
        this.closeModal();
        done();
      }),
    );
    this.openModal(...parts);
  }

  /** 결과 화면 상자: 먹은 상자가 하나씩 통통 튀어나와 반짝인다 (가방에 들어갔고, 가방 탭에서 하나씩 연다) */
  private chestShow(chests: ChestGrade[]) {
    const box = h('div', 'chests');
    const row = h('div', 'chest-row');
    // 좋은 상자부터
    [...chests].sort((a, b) => b - a).forEach((grade, i) => {
      const el = h('div', `chest-item grade-${grade} pop`);
      el.style.animationDelay = `${0.15 + i * 0.12}s`;
      el.append(art('chest'), h('span', '', CHEST_NAMES[grade]));
      row.append(el);
    });
    const n = [2, 1, 0].map((g) => [g, chests.filter((c) => c === g).length] as const).filter(([, k]) => k > 0);
    box.append(
      h('div', 'chests-title', `🎉 상자 ${chests.length}개 획득!`),
      row,
      h('div', 'chest-hint', `${n.map(([g, k]) => `${CHEST_NAMES[g]} ×${k}`).join(' · ')}  →  🎒 가방에 쏙! (가방 탭에서 열어요)`),
    );
    setTimeout(() => sfx.chest(), 150);
    return box;
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

  /** 설정 창. back이 있으면 (일시정지 창에서 왔으면) 닫을 때 그리로 돌아간다 */
  private showSettings(back?: () => void) {
    const g = this.game;
    const close = () => (back ? back() : this.closeModal());
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
        this.showSettings(back);
      }),
      // 가로 모드: 스테이지에서만 (켜 두면 스테이지에 들어갈 때 가로로)
      this.button(`스테이지 가로 모드: ${g.save.landscape ? 'ON' : 'OFF'}`, '', () => {
        g.save.landscape = !g.save.landscape;
        if (g.mode === 'action') {
          if (g.save.landscape) void g.toggleLandscape();
          else g.exitLandscape();
        }
        this.toast(g.save.landscape ? '가로 모드 켜짐: 스테이지에서 가로로 (왼손 조이스틱 · 오른손 스킬)' : '가로 모드 꺼짐');
        this.showSettings(back);
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
      this.button(back ? '돌아가기' : '닫기', 'primary', close),
    );
  }
}
