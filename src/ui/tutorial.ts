import { BOX_BY_ID, boxCost } from '../data/skillbox';
import type { Game } from '../game';
import { chickPic, h } from './dom';

// 처음 하는 사람용 튜토리얼: 눌러야 할 곳만 밝게 뚫어 두고 나머지는 어둡게 막는다.
// 그곳을 눌러야 다음으로 넘어간다 (글만 있는 단계는 말풍선 버튼).
// 단계마다 보여 줄 조건(when)이 있어서, 조건이 안 맞으면 막지 않고 기다린다 (예: 결과 화면이 닫힐 때까지).

interface Step {
  /** 이 단계를 보여 줄 때 (아니면 기다린다) */
  when: () => boolean;
  /** 밝게 뚫어 둘 곳 (없으면 글만) */
  target?: () => HTMLElement | null;
  text: string;
  /** 글만 있는 단계의 버튼 글자 */
  button?: string;
  /** 보여 주는 동안 전투를 멈춘다 */
  freeze?: boolean;
  /** 단계 시작 때 한 번 (재화 채워 주기 등) */
  enter?: () => void;
}

const $ = (sel: string) => document.querySelector<HTMLElement>(sel);

export class Tutorial {
  private readonly root = h('div', 'tut');
  private readonly blockers = [0, 1, 2, 3].map(() => h('div', 'tut-block'));
  private readonly full = h('div', 'tut-block');
  private readonly ring = h('div', 'tut-ring');
  private readonly bubble = h('div', 'tut-bubble');
  private readonly text = h('div', 'tut-text');
  private readonly btn = h('button', 'btn primary tut-btn');
  private readonly steps: Step[];
  private entered = -1;
  private shown = false;
  /** 전투 멈춤 (Game이 읽는다) */
  freeze = false;

  constructor(private readonly game: Game, host: HTMLElement, modalOpen: () => boolean) {
    const idle = () => game.mode === 'idle' && !modalOpen();
    const action = () => game.mode === 'action' && game.action.state === 'playing';
    // 튜토리얼 상자는 나무 상자 1회 값만큼 골드를 채워 준다
    const fillWood = () => {
      const s = game.save;
      const c = boxCost(BOX_BY_ID.wood, 1, s.maxStage).gold ?? 0;
      if (s.gold < c) s.gold = c;
      $('.box-wood')?.scrollIntoView({ block: 'center' });
    };
    const tab = (name: string) => () => [...document.querySelectorAll<HTMLElement>('.tab')].find((t) => t.textContent?.includes(name)) ?? null;
    this.steps = [
      { when: idle, text: '삐요! 나는 병아리 용사야. 몬스터를 물리치고 쑥쑥 강해지자!', button: '좋아!' },
      { when: idle, target: () => $('.challenge-btn'), text: '먼저 스테이지에 도전해 보자! 도전 버튼을 눌러 봐' },
      { when: action, freeze: true, text: '화면을 끌면 병아리가 움직여. 스킬은 저절로 나가! 1분이 지나면 보스가 나타나는데, 그 보스를 쓰러뜨리면 스테이지 클리어야', button: '알겠어!' },
      { when: action, freeze: true, target: () => $('.auto-btn'), text: '귀찮으면 AUTO! 누르면 알아서 싸워 (조이스틱을 쓰면 그동안은 직접)' },
      {
        when: action, freeze: true, target: () => $('.hud-action .fever'), button: '좋아!',
        text: '몹을 잡을수록 FEVER 게이지가 차! 가득 차면 10초 동안 피버 타임: 스킬이 엄청 세지고 골드도 2배야',
      },
      {
        when: action, freeze: true, button: '잡으러 가자!',
        text: '반짝이는 황금 몹이 나타났어! 도망 다니지만 잡으면 골드·다이아·금 상자를 줘. 화면 밖에 있으면 금색 화살표가 가리켜',
        enter: () => game.action.spawnGolden(),
      },
      { when: idle, target: tab('스킬'), text: '잘했어! 이제 스킬을 얻으러 가자. 스킬 탭을 눌러 봐' },
      {
        when: idle, target: () => $('.box-wood .box-btns .buy'), text: '스킬은 상자를 까서 얻어! 나무 상자를 열어 보자 (이번엔 골드를 채워 줄게)',
        enter: fillWood,
      },
      { when: () => modalOpen(), target: () => $('.modal .btn.primary'), text: '새 스킬 획득! 새 스킬은 비어 있는 칸에 바로 장착돼. 비싼 상자일수록 좋은 등급이 잘 나와' },
      {
        when: idle, target: () => $('.box-wood .box-btns .buy'), text: '한 번 더 열어 보자! 이미 가진 스킬이 또 나오면 그 스킬의 ⭐스킬 포인트를 줘',
        enter: fillWood,
      },
      { when: () => modalOpen(), target: () => $('.modal .btn.primary'), text: '같은 스킬이 겹쳤어! ⭐스킬 포인트 +1. 이제 포인트를 찍으러 가자' },
      {
        when: idle, target: () => $('.equip-slot:not(.empty)'), text: '포인트를 받은 공격형 스킬을 눌러 봐',
        enter: () => $('.panel')?.scrollTo({ top: 0 }),
      },
      { when: () => modalOpen(), target: () => $('.modal .tree-row .buy'), text: '피해·발동 속도·개수 중 골라서 포인트를 찍어 (개수는 2점). 피해를 올려 보자!' },
      { when: () => modalOpen(), target: () => $('.modal .skill-art'), text: '스킬 아이콘을 누르면 어떻게 나가는지 미리 볼 수 있어' },
      { when: () => modalOpen(), target: () => $('.modal .btn.primary:last-child'), text: '스킬은 골드로 못 올려. 상자를 많이 까서 포인트를 모으자! 이제 닫아 보자' },
      { when: idle, target: tab('성장'), text: '성장 탭에서는 병아리 능력치를 올려' },
      {
        when: idle, target: () => $('.panel .card.row .buy'), text: '공격력을 한 번 올려 보자! (누르고 있으면 연속 강화)',
        enter: () => {
          const s = game.save;
          const c = game.statCost('atk');
          if (s.gold < c) s.gold = c;
        },
      },
      { when: idle, target: () => $('.mission-btn'), text: '미션·출석 보상으로 다이아를 모아서 좋은 상자를 열자. 이제 마음껏 강해져 봐!', button: '시작하기' },
    ];
    this.root.append(...this.blockers, this.full, this.ring, this.bubble);
    const face = h('div', 'tut-face');
    face.append(chickPic(46));
    const body = h('div', 'tut-body');
    body.append(h('div', 'tut-name', '삐요'), this.text, this.btn);
    this.bubble.append(face, body);
    this.btn.addEventListener('click', () => this.advance());
    host.append(this.root);
    // 뚫어 둔 곳에서 손을 떼면 (원래 동작이 먼저 돈 다음) 다음 단계로.
    // 누르고 있는 버튼(연속 강화)은 click이 안 나와서 pointerup으로 본다
    document.addEventListener('pointerup', (e) => {
      const st = this.current;
      if (!st || !this.shown || !st.target || st.button) return;
      const el = st.target();
      if (!el || !(e.target instanceof Node) || !el.contains(e.target)) return;
      const at = this.game.save.tutorial;
      setTimeout(() => {
        if (this.game.save.tutorial === at) this.advance();
      }, 0);
    }, true);
  }

  get active() {
    return this.game.save.tutorial >= 0 && this.game.save.tutorial < this.steps.length;
  }

  private get current() {
    return this.active ? this.steps[this.game.save.tutorial] : null;
  }

  restart() {
    this.game.save.tutorial = 0;
    this.entered = -1;
  }

  private advance() {
    const s = this.game.save;
    s.tutorial++;
    if (s.tutorial >= this.steps.length) s.tutorial = -1;
    this.game.persist();
    this.hide();
  }

  private hide() {
    this.shown = false;
    this.freeze = false;
    this.root.classList.remove('show');
  }

  /** 매 프레임: 지금 단계 조건을 보고 막을 곳을 다시 잡는다 (요소가 움직이거나 다시 만들어져도 따라간다) */
  tick() {
    const st = this.current;
    if (!st || !st.when()) return this.hide();
    if (this.entered !== this.game.save.tutorial) {
      this.entered = this.game.save.tutorial;
      st.enter?.();
    }
    const el = st.target?.() ?? null;
    if (st.target && (!el || el.getClientRects().length === 0)) return this.hide();
    this.shown = true;
    this.freeze = !!st.freeze;
    this.root.classList.add('show');
    this.text.textContent = st.text;
    this.btn.textContent = st.button ?? '';
    this.btn.style.display = st.button ? '' : 'none';
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!el) {
      this.full.style.display = '';
      for (const b of this.blockers) b.style.display = 'none';
      this.ring.style.display = 'none';
      this.place(this.bubble, null, vh);
      return;
    }
    this.full.style.display = 'none';
    const r = el.getBoundingClientRect();
    const pad = 6;
    const x0 = Math.max(0, r.left - pad);
    const y0 = Math.max(0, r.top - pad);
    const x1 = Math.min(vw, r.right + pad);
    const y1 = Math.min(vh, r.bottom + pad);
    const set = (b: HTMLElement, l: number, t: number, w: number, hh: number) => {
      b.style.display = '';
      b.style.left = `${l}px`;
      b.style.top = `${t}px`;
      b.style.width = `${Math.max(0, w)}px`;
      b.style.height = `${Math.max(0, hh)}px`;
    };
    const [top, bottom, left, right] = this.blockers;
    set(top, 0, 0, vw, y0);
    set(bottom, 0, y1, vw, vh - y1);
    set(left, 0, y0, x0, y1 - y0);
    set(right, x1, y0, vw - x1, y1 - y0);
    this.ring.style.display = '';
    set(this.ring, x0, y0, x1 - x0, y1 - y0);
    this.place(this.bubble, { top: y0, bottom: y1 }, vh);
  }

  /** 말풍선: 뚫린 곳이 위쪽이면 그 아래에, 아래쪽이면 그 위에 */
  private place(b: HTMLElement, hole: { top: number; bottom: number } | null, vh: number) {
    if (!hole) {
      b.style.top = `${vh * 0.12}px`;
      b.style.bottom = '';
      return;
    }
    if ((hole.top + hole.bottom) / 2 < vh / 2) {
      b.style.top = `${hole.bottom + 14}px`;
      b.style.bottom = '';
    } else {
      b.style.top = '';
      b.style.bottom = `${vh - hole.top + 14}px`;
    }
  }
}
