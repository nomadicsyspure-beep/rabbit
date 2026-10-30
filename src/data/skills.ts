import type { Weapon } from '../battle/engine';
import {
  BlackHoleWeapon, ChainWeapon, DarkOrbWeapon, EggWeapon, FeatherWeapon, FireballWeapon, FlameWeapon, HASTE, HealWeapon,
  IceWeapon, MeteorWeapon, PillarWeapon, SlashWeapon, TornadoWeapon, treeCooldown, treeDamage,
  type SkillSpec, type SkillTree, type WeaponStats,
} from '../battle/weapons';
import {
  BigEggWeapon, BlizzardWeapon, BoomerangWeapon, CrossWeapon, FeatherStormWeapon, FireTrailWeapon, FireflyWeapon, FireworkWeapon,
  GravityWeapon, LanceWeapon, LaserWeapon, NovaWeapon, PoisonWeapon, QuakeWeapon, ThunderWeapon, VampireWeapon, WispWeapon,
  BuffSkill, DebuffSkill, PulseSkill, ShotSkill, StrikeSkill, ZoneSkill,
} from '../battle/weapons-more';

// 스킬은 골드로 배우고, 가지(피해 / 발동 속도 / 개수)마다 따로 강화한다 (영구).
// 스테이지에서는 장착한 스킬(최대 EQUIP_SLOTS개)만 발동한다.

export const EQUIP_SLOTS = 4;

export type SkillId =
  | 'feather' | 'tornado' | 'egg' | 'flame' | 'ice' | 'heal' | 'fire' | 'dark'
  | 'slash' | 'chain' | 'blackhole' | 'meteor' | 'pillar'
  | 'boomerang' | 'firefly' | 'poison' | 'quake' | 'thunder' | 'lance' | 'nova' | 'firetrail' | 'bigegg'
  | 'vampire' | 'cross' | 'gravity' | 'laser' | 'blizzard' | 'firework' | 'wisp' | 'featherstorm'
  | 'shuriken' | 'bubble' | 'petal' | 'acid' | 'windblade' | 'note' | 'skullfire' | 'iceorb' | 'candy' | 'phoenix' | 'arrowrain' | 'eruption' | 'frostspike' | 'shadowhand' | 'poisonbolt' | 'holymark' | 'shockwave' | 'pollen' | 'frostwave' | 'tornadoring' | 'swamp' | 'firepillar' | 'vortex' | 'icetrail' | 'starfall' | 'heartbeam'
  | 'flash' | 'roar' | 'dizzy' | 'sleepdust' | 'weaken' | 'hex' | 'huntmark' | 'ignite' | 'frostbite' | 'venom' | 'plague' | 'curse' | 'terror' | 'timestop' | 'shield' | 'rage' | 'berserk' | 'haste' | 'overdrive' | 'sprint' | 'thorns' | 'regen' | 'luck' | 'magnetstorm' | 'invincible' | 'bless' | 'sunflare' | 'darkwave' | 'emberring' | 'shadowbolt' | 'icemeteor' | 'goldspear';

export type Branch = keyof SkillTree;

export const BRANCHES: { id: Branch; name: string; max: number }[] = [
  { id: 'dmg', name: '피해', max: 30 },
  { id: 'spd', name: '발동 속도', max: 20 },
  { id: 'cnt', name: '개수', max: 10 },
];

/** 스킬 형태: 공격형(주변 광역) / 타겟형(적을 골라 맞힘) / 디버프형(상태 이상) / 버프형(나를 강화). 형태마다 장착 칸 하나 */
export type SkillType = 'attack' | 'target' | 'debuff' | 'buff';
export const SKILL_TYPES: { id: SkillType; name: string; color: string; desc: string }[] = [
  { id: 'attack', name: '공격형', color: '#ff7a4a', desc: '주변을 넓게 휩쓴다' },
  { id: 'target', name: '타겟형', color: '#ffd23f', desc: '적을 골라 맞힌다' },
  { id: 'debuff', name: '디버프형', color: '#c78bff', desc: '적을 멈추게·약하게·태우게' },
  { id: 'buff', name: '버프형', color: '#6fdc8c', desc: '병아리를 강하게' },
];

export interface SkillDef extends SkillSpec {
  id: SkillId;
  type: SkillType;
  name: string;
  /** 아이콘: UI 시트의 skill-<이름> 또는 fx:<이펙트 이름> (나무 틀 안에 그린다) */
  icon: string;
  /** 한 줄 설명 */
  blurb: string;
  /** 개수 가지가 늘리는 것 */
  countLabel: string;
  /** 개수 1레벨당 늘어나는 양 */
  countStep?: number;
  /** 개수 단위 (기본 '개', 버프 지속 시간은 '초') */
  countUnit?: string;
  /** 피해 대신 보여 줄 이름 (치유는 회복량) */
  dmgLabel?: string;
  /** 쿨다운이 없는 스킬 (도는 구체): 발동 속도 = 회전 속도 */
  continuous?: boolean;
  /** 스킬북이 있어야 배운다 (이 스킬을 주는 무기가 있으면 책 없이) */
  needsBook?: boolean;
  /** 배우는 값 (테스트 중엔 COST_OVERRIDE). 가지 강화 비용은 이 값에서 늘어난다 */
  learnCost: number;
  create: (stats: WeaponStats, spec: SkillSpec, tree: SkillTree) => Weapon;
}

export const SKILLS: SkillDef[] = [
  {
    id: 'feather', type: 'target', name: '깃털 날리기', icon: 'skill-feather', blurb: '가까운 적들에게 깃털을 날린다 (개수 3마다 관통 +1)',
    dmg: 1, cd: 0.8, count: 2, countLabel: '깃털', learnCost: 0,
    create: (s, spec, t) => new FeatherWeapon(s, spec, t),
  },
  {
    id: 'tornado', type: 'attack', name: '회오리', icon: 'skill-tornado', blurb: '바라보는 쪽으로 회오리가 쓸고 지나간다',
    dmg: 0.6, cd: 3.2, count: 1, countLabel: '회오리', learnCost: 30,
    create: (s, spec, t) => new TornadoWeapon(s, spec, t),
  },
  {
    id: 'egg', type: 'target', name: '알 폭탄', icon: 'skill-egg', blurb: '적 무리에 알을 던져 펑',
    dmg: 1.4, cd: 2.4, count: 1, countLabel: '알', learnCost: 50,
    create: (s, spec, t) => new EggWeapon(s, spec, t),
  },
  {
    id: 'flame', type: 'attack', name: '화염 폭발', icon: 'skill-flame', blurb: '주변을 불꽃으로 날려 버린다 (개수만큼 점점 크게 연속 폭발)',
    dmg: 1.2, cd: 2.6, count: 1, countLabel: '연속 폭발', learnCost: 80,
    create: (s, spec, t) => new FlameWeapon(s, spec, t),
  },
  {
    id: 'ice', type: 'debuff', name: '얼음 결정', icon: 'skill-ice', blurb: '적 발밑에 얼음이 솟아 피해 + 느려짐',
    dmg: 1.1, cd: 2.2, count: 2, countLabel: '대상', learnCost: 100,
    create: (s, spec, t) => new IceWeapon(s, spec, t),
  },
  {
    id: 'heal', type: 'buff', name: '치유', icon: 'skill-heal', blurb: '주기적으로 체력 회복 (개수만큼 연달아)',
    dmg: 0.05, cd: 6, count: 1, countLabel: '회복 횟수', dmgLabel: '회복량', learnCost: 80,
    create: (s, spec, t) => new HealWeapon(s, spec, t),
  },
  {
    id: 'fire', type: 'target', name: '화염구', icon: 'skill-fire', blurb: '맞으면 터지는 화염구',
    dmg: 1.6, cd: 1.7, count: 1, countLabel: '화염구', learnCost: 150,
    create: (s, spec, t) => new FireballWeapon(s, spec, t),
  },
  {
    id: 'dark', type: 'attack', name: '암흑 구체', icon: 'skill-dark', blurb: '주위를 도는 구체 (발동 속도 = 회전 속도)',
    dmg: 0.5, cd: 0, count: 2, countLabel: '구체', continuous: true, learnCost: 200,
    create: (s, spec, t) => new DarkOrbWeapon(s, spec, t),
  },
  {
    id: 'slash', type: 'attack', name: '회전 베기', icon: 'fx:slash', blurb: '주변을 크게 한 바퀴 벤다 (개수만큼 연속 베기)',
    dmg: 1.3, cd: 1.6, count: 1, countLabel: '연속 베기', learnCost: 120,
    create: (s, spec, t) => new SlashWeapon(s, spec, t),
  },
  {
    id: 'chain', type: 'target', name: '번개 연쇄', icon: 'fx:blue-slash', blurb: '번개가 적에서 적으로 튀어 다닌다',
    dmg: 1.2, cd: 1.5, count: 4, countStep: 2, countLabel: '튀는 횟수', learnCost: 180,
    create: (s, spec, t) => new ChainWeapon(s, spec, t),
  },
  {
    id: 'blackhole', type: 'debuff', name: '블랙홀', icon: 'fx:purple-pit', blurb: '적을 빨아들이고 닫히며 대폭발',
    dmg: 1, cd: 7, count: 1, countLabel: '블랙홀', learnCost: 400,
    create: (s, spec, t) => new BlackHoleWeapon(s, spec, t),
  },
  {
    id: 'meteor', type: 'target', name: '별똥별', icon: 'fx:gold-sparkle', blurb: '적들 위로 별이 쏟아진다',
    dmg: 2.2, cd: 2.8, count: 3, countLabel: '별', learnCost: 300,
    create: (s, spec, t) => new MeteorWeapon(s, spec, t),
  },
  {
    id: 'pillar', type: 'target', name: '빛의 기둥', icon: 'fx:pillar', blurb: '무작위 적들에게 빛 기둥이 내리꽂힌다',
    dmg: 2.5, cd: 3, count: 2, countLabel: '기둥', learnCost: 250,
    create: (s, spec, t) => new PillarWeapon(s, spec, t),
  },
  // ---- 추가 스킬 (나중에 추려서 밸런스 조정) ----
  {
    id: 'boomerang', type: 'attack', name: '부메랑', icon: 'fx:slash', blurb: '날아갔다 돌아오며 오가는 길의 적을 전부 벤다',
    dmg: 1.1, cd: 1.8, count: 1, countLabel: '부메랑', learnCost: 90,
    create: (s, spec, t) => new BoomerangWeapon(s, spec, t),
  },
  {
    id: 'firefly', type: 'target', name: '반딧불', icon: 'fx:sparkle', blurb: '적을 끝까지 쫓아가는 빛 구슬',
    dmg: 0.9, cd: 1.4, count: 3, countLabel: '구슬', learnCost: 70,
    create: (s, spec, t) => new FireflyWeapon(s, spec, t),
  },
  {
    id: 'poison', type: 'debuff', name: '독안개', icon: 'fx:dust', blurb: '적 무리에 독 구름을 깔아 계속 피해',
    dmg: 1, cd: 3, count: 2, countLabel: '독 구름', learnCost: 110,
    create: (s, spec, t) => new PoisonWeapon(s, spec, t),
  },
  {
    id: 'quake', type: 'attack', name: '지진', icon: 'fx:star-burst', blurb: '발밑에서 점점 커지는 땅울림 (개수만큼 연달아)',
    dmg: 1.1, cd: 2.6, count: 3, countLabel: '울림', learnCost: 140,
    create: (s, spec, t) => new QuakeWeapon(s, spec, t),
  },
  {
    id: 'thunder', type: 'target', name: '낙뢰', icon: 'fx:blue-slash', blurb: '하늘에서 번개가 무작위 적에게 내리꽂힌다',
    dmg: 2, cd: 2.2, count: 3, countLabel: '번개', learnCost: 260,
    create: (s, spec, t) => new ThunderWeapon(s, spec, t),
  },
  {
    id: 'lance', type: 'target', name: '얼음 창', icon: 'fx:ice-crystals', blurb: '일직선으로 모두 꿰뚫는 빠른 창',
    dmg: 1.5, cd: 1.6, count: 1, countLabel: '창', learnCost: 130,
    create: (s, spec, t) => new LanceWeapon(s, spec, t),
  },
  {
    id: 'nova', type: 'attack', name: '별 폭죽', icon: 'fx:star-burst', blurb: '사방으로 별이 터져 나간다',
    dmg: 0.9, cd: 2, count: 6, countStep: 2, countLabel: '별 줄기', learnCost: 100,
    create: (s, spec, t) => new NovaWeapon(s, spec, t),
  },
  {
    id: 'firetrail', type: 'attack', name: '불길', icon: 'fx:fire-burst', blurb: '지나간 자리에 불꽃이 남아 밟는 적을 태운다',
    dmg: 0.5, cd: 0.5, count: 1, countLabel: '불꽃', learnCost: 120,
    create: (s, spec, t) => new FireTrailWeapon(s, spec, t),
  },
  {
    id: 'bigegg', type: 'target', name: '거대 알', icon: 'skill-egg', blurb: '집채만 한 알을 던져 화면이 흔들리게 펑',
    dmg: 4, cd: 4.5, count: 1, countLabel: '거대 알', learnCost: 350,
    create: (s, spec, t) => new BigEggWeapon(s, spec, t),
  },
  {
    id: 'vampire', type: 'buff', name: '흡혈', icon: 'fx:purple-burst', blurb: '가까운 적의 생명력을 빨아 체력 회복',
    dmg: 0.8, cd: 1.6, count: 2, countLabel: '대상', learnCost: 160,
    create: (s, spec, t) => new VampireWeapon(s, spec, t),
  },
  {
    id: 'cross', type: 'attack', name: '성스러운 십자', icon: 'fx:heal-cross', blurb: '십자로 빛줄기가 뻗는다 (번갈아 돌려서 연달아)',
    dmg: 1.3, cd: 2.4, count: 2, countLabel: '십자', learnCost: 180,
    create: (s, spec, t) => new CrossWeapon(s, spec, t),
  },
  {
    id: 'gravity', type: 'debuff', name: '중력 폭탄', icon: 'fx:purple-pit', blurb: '적을 한곳에 끌어모은 뒤 대폭발',
    dmg: 1, cd: 5, count: 1, countLabel: '폭발 크기', learnCost: 380,
    create: (s, spec, t) => new GravityWeapon(s, spec, t),
  },
  {
    id: 'laser', type: 'target', name: '레이저', icon: 'fx:pillar', blurb: '화면을 가르는 광선이 한 줄을 통째로 지운다',
    dmg: 1.8, cd: 2.2, count: 1, countLabel: '광선', learnCost: 320,
    create: (s, spec, t) => new LaserWeapon(s, spec, t),
  },
  {
    id: 'blizzard', type: 'debuff', name: '눈보라', icon: 'fx:ice-crystals', blurb: '주변 적들에게 얼음이 다다닥 (느려짐)',
    dmg: 0.8, cd: 3, count: 8, countStep: 2, countLabel: '얼음', learnCost: 200,
    create: (s, spec, t) => new BlizzardWeapon(s, spec, t),
  },
  {
    id: 'firework', type: 'target', name: '폭죽', icon: 'fx:gold-sparkle', blurb: '반짝이를 높이 던져 적 무리 위에서 펑펑',
    dmg: 1.7, cd: 2.6, count: 4, countLabel: '폭죽', learnCost: 280,
    create: (s, spec, t) => new FireworkWeapon(s, spec, t),
  },
  {
    id: 'wisp', type: 'attack', name: '도깨비불', icon: 'fx:purple-flame', blurb: '둘레에 생긴 불꽃 고리가 바깥으로 퍼진다',
    dmg: 0.7, cd: 2.2, count: 4, countStep: 2, countLabel: '불꽃', learnCost: 150,
    create: (s, spec, t) => new WispWeapon(s, spec, t),
  },
  {
    id: 'featherstorm', type: 'attack', name: '깃털 폭풍', icon: 'skill-feather', blurb: '사방으로 깃털이 한꺼번에 쏟아진다',
    dmg: 0.8, cd: 2, count: 10, countStep: 3, countLabel: '깃털', learnCost: 90,
    create: (s, spec, t) => new FeatherStormWeapon(s, spec, t),
  },
  // ---- 설정으로 만든 스킬 (그림 이름@색상) ----
  {
    id: 'shuriken', type: 'target', name: '수리검', icon: 'fx:slash@200', blurb: '빙글빙글 도는 표창이 적 둘을 꿰뚫는다',
    dmg: 1.0, cd: 1.3, count: 3, countLabel: '표창', learnCost: 80,
    create: (s, spec, t) => new ShotSkill(s, spec, t, { id: 'shuriken', sprite: 'slash@200', speed: 520, range: 360, pierce: 2, pattern: 'fan', gap: 0.25, r: 9, scale: 0.8 }),
  },
  {
    id: 'bubble', type: 'target', name: '물방울', icon: 'fx:sparkle@195', blurb: '둥실둥실 적을 따라가는 물방울',
    dmg: 0.9, cd: 1.4, count: 4, countLabel: '물방울', learnCost: 70,
    create: (s, spec, t) => new ShotSkill(s, spec, t, { id: 'bubble', sprite: 'sparkle@195', speed: 200, range: 520, pierce: 0, pattern: 'random', home: 3, r: 8, scale: 1.2 }),
  },
  {
    id: 'petal', type: 'attack', name: '꽃잎 폭풍', icon: 'fx:feather@330', blurb: '사방으로 꽃잎이 흩날린다',
    dmg: 0.7, cd: 1.8, count: 10, countStep: 3, countLabel: '꽃잎', learnCost: 90,
    create: (s, spec, t) => new ShotSkill(s, spec, t, { id: 'petal', sprite: 'feather@330', speed: 420, range: 300, pierce: 1, pattern: 'ring', r: 6 }),
  },
  {
    id: 'acid', type: 'target', name: '산성 침', icon: 'fx:purple-flame@100', blurb: '맞으면 터지는 산성 침',
    dmg: 1.3, cd: 1.6, count: 2, countLabel: '침', learnCost: 110,
    create: (s, spec, t) => new ShotSkill(s, spec, t, { id: 'acid', sprite: 'purple-flame@100', speed: 320, range: 360, pierce: 0, pattern: 'fan', gap: 0.3, r: 8, blast: 40 }),
  },
  {
    id: 'windblade', type: 'attack', name: '바람 칼날', icon: 'fx:blue-slash@160', blurb: '일직선으로 모두 베고 지나가는 바람',
    dmg: 1.1, cd: 1.5, count: 2, countLabel: '칼날', learnCost: 120,
    create: (s, spec, t) => new ShotSkill(s, spec, t, { id: 'windblade', sprite: 'blue-slash@160', speed: 620, range: 320, pierce: 999, pattern: 'fan', gap: 0.35, r: 12, scale: 1.3 }),
  },
  {
    id: 'note', type: 'target', name: '음표', icon: 'fx:sparkle@280', blurb: '통통 튀며 적을 쫓아가는 음표',
    dmg: 0.8, cd: 1.2, count: 3, countLabel: '음표', learnCost: 80,
    create: (s, spec, t) => new ShotSkill(s, spec, t, { id: 'note', sprite: 'sparkle@280', speed: 260, range: 520, pierce: 0, pattern: 'random', home: 5, r: 7 }),
  },
  {
    id: 'skullfire', type: 'target', name: '도깨비 해골불', icon: 'fx:purple-flame', blurb: '느리게 쫓아가며 셋을 꿰뚫는 저주의 불',
    dmg: 1.2, cd: 2, count: 2, countLabel: '해골불', learnCost: 150,
    create: (s, spec, t) => new ShotSkill(s, spec, t, { id: 'skullfire', sprite: 'purple-flame', speed: 190, range: 520, pierce: 2, pattern: 'random', home: 3, r: 10, scale: 1.2 }),
  },
  {
    id: 'iceorb', type: 'target', name: '얼음 구슬', icon: 'fx:dark-orb@190', blurb: '맞으면 차갑게 터지는 구슬',
    dmg: 1.4, cd: 1.8, count: 1, countLabel: '구슬', learnCost: 130,
    create: (s, spec, t) => new ShotSkill(s, spec, t, { id: 'iceorb', sprite: 'dark-orb@190', speed: 260, range: 380, pierce: 0, pattern: 'fan', gap: 0.3, r: 10, blast: 50 }),
  },
  {
    id: 'candy', type: 'target', name: '별사탕', icon: 'fx:star-burst@300', blurb: '사방으로 퍼졌다가 적을 쫓아가는 별사탕',
    dmg: 0.7, cd: 1.6, count: 6, countStep: 2, countLabel: '별사탕', learnCost: 100,
    create: (s, spec, t) => new ShotSkill(s, spec, t, { id: 'candy', sprite: 'star-burst@300', speed: 300, range: 420, pierce: 0, pattern: 'ring', home: 3, r: 7 }),
  },
  {
    id: 'phoenix', type: 'attack', name: '불사조', icon: 'fx:fireball@25', blurb: '크게 돌아오는 불새 부메랑',
    dmg: 1.6, cd: 2.6, count: 1, countLabel: '불새', learnCost: 260,
    create: (s, spec, t) => new ShotSkill(s, spec, t, { id: 'phoenix', sprite: 'fireball@25', speed: 620, range: 1600, pierce: 999, pattern: 'fan', gap: 0.5, back: true, r: 16, scale: 1.6 }),
  },
  {
    id: 'arrowrain', type: 'target', name: '화살비', icon: 'fx:feather@40', blurb: '하늘에서 화살이 우수수',
    dmg: 1.0, cd: 1.8, count: 6, countStep: 2, countLabel: '화살', learnCost: 100,
    create: (s, spec, t) => new StrikeSkill(s, spec, t, { id: 'arrowrain', sprite: 'feather@40', radius: 24, size: 30 }),
  },
  {
    id: 'eruption', type: 'target', name: '화산 분출', icon: 'fx:fire-burst', blurb: '적 발밑에서 용암이 솟구친다',
    dmg: 2.0, cd: 2.8, count: 3, countLabel: '분출', learnCost: 200,
    create: (s, spec, t) => new StrikeSkill(s, spec, t, { id: 'eruption', sprite: 'fire-burst', radius: 44, knock: 160, shake: 3 }),
  },
  {
    id: 'frostspike', type: 'debuff', name: '서리 가시', icon: 'fx:ice-crystals@205', blurb: '얼음 가시가 솟아 꽁꽁 (느려짐)',
    dmg: 1.2, cd: 2, count: 4, countLabel: '가시', learnCost: 140,
    create: (s, spec, t) => new StrikeSkill(s, spec, t, { id: 'frostspike', sprite: 'ice-crystals@205', radius: 30, slow: 2 }),
  },
  {
    id: 'shadowhand', type: 'debuff', name: '그림자 손', icon: 'fx:purple-burst', blurb: '바닥에서 그림자 손이 움켜쥔다',
    dmg: 1.6, cd: 2.2, count: 3, countLabel: '손', learnCost: 170,
    create: (s, spec, t) => new StrikeSkill(s, spec, t, { id: 'shadowhand', sprite: 'purple-burst', radius: 36, knock: -80 }),
  },
  {
    id: 'poisonbolt', type: 'debuff', name: '독번개', icon: 'fx:dust@100', blurb: '초록 번개가 내리쳐 독을 뿌린다',
    dmg: 1.5, cd: 2.2, count: 3, countLabel: '번개', learnCost: 190,
    create: (s, spec, t) => new StrikeSkill(s, spec, t, { id: 'poisonbolt', sprite: 'dust@100', radius: 34, bolt: '#9be36a' }),
  },
  {
    id: 'holymark', type: 'target', name: '신성 낙인', icon: 'fx:heal-cross@50', blurb: '금빛 십자가 적에게 내리꽂힌다',
    dmg: 1.8, cd: 2.4, count: 3, countLabel: '낙인', learnCost: 210,
    create: (s, spec, t) => new StrikeSkill(s, spec, t, { id: 'holymark', sprite: 'heal-cross@50', radius: 32, bolt: '#fff6a0', shake: 1.5 }),
  },
  {
    id: 'shockwave', type: 'attack', name: '충격파', icon: 'fx:blue-slash', blurb: '발밑에서 충격파가 연달아 퍼진다',
    dmg: 1.0, cd: 2.2, count: 2, countLabel: '파동', learnCost: 120,
    create: (s, spec, t) => new PulseSkill(s, spec, t, { id: 'shockwave', color: '#9fe4ff', radius: 60, step: 35, knock: 220 }),
  },
  {
    id: 'pollen', type: 'attack', name: '꽃가루 폭발', icon: 'fx:gold-sparkle@320', blurb: '달콤한 꽃가루가 펑펑',
    dmg: 0.9, cd: 2, count: 3, countLabel: '폭발', learnCost: 110,
    create: (s, spec, t) => new PulseSkill(s, spec, t, { id: 'pollen', color: '#ffb3e6', radius: 50, step: 25, sprite: 'gold-sparkle@320', knock: 60 }),
  },
  {
    id: 'frostwave', type: 'debuff', name: '얼음 파동', icon: 'fx:ice-crystals', blurb: '차가운 파동이 퍼져 주변을 느리게',
    dmg: 0.8, cd: 2.6, count: 2, countLabel: '파동', learnCost: 150,
    create: (s, spec, t) => new PulseSkill(s, spec, t, { id: 'frostwave', color: '#bfe8ff', radius: 70, step: 30, knock: 40, slow: 2.5 }),
  },
  {
    id: 'tornadoring', type: 'attack', name: '회오리 군단', icon: 'fx:tornado@200', blurb: '둘레에서 회오리들이 퍼져 나간다',
    dmg: 0.7, cd: 2.8, count: 4, countLabel: '회오리', learnCost: 180,
    create: (s, spec, t) => new ZoneSkill(s, spec, t, { id: 'tornadoring', sprite: 'tornado@200', r: 22, life: 1.8, at: 'ring', speed: 130 }),
  },
  {
    id: 'swamp', type: 'debuff', name: '늪', icon: 'fx:dust@60', blurb: '적 무리 밑에 끈적한 늪',
    dmg: 0.4, cd: 3.2, count: 2, countLabel: '늪', learnCost: 120,
    create: (s, spec, t) => new ZoneSkill(s, spec, t, { id: 'swamp', sprite: 'dust@60', r: 50, life: 4, at: 'enemy', pull: 30 }),
  },
  {
    id: 'firepillar', type: 'target', name: '불기둥', icon: 'fx:fire-burst@10', blurb: '적 자리에 불기둥이 잠깐 솟는다',
    dmg: 1.2, cd: 2, count: 3, countLabel: '불기둥', learnCost: 160,
    create: (s, spec, t) => new ZoneSkill(s, spec, t, { id: 'firepillar', sprite: 'fire-burst@10', r: 26, life: 1.4, at: 'enemy' }),
  },
  {
    id: 'vortex', type: 'debuff', name: '작은 소용돌이', icon: 'fx:purple-pit@200', blurb: '적을 빨아들이는 작은 소용돌이',
    dmg: 0.5, cd: 3, count: 2, countLabel: '소용돌이', learnCost: 200,
    create: (s, spec, t) => new ZoneSkill(s, spec, t, { id: 'vortex', sprite: 'purple-pit@200', r: 30, life: 2.2, at: 'enemy', pull: 140 }),
  },
  {
    id: 'icetrail', type: 'debuff', name: '얼음길', icon: 'fx:ice-crystals@190', blurb: '지나간 자리에 얼음 결정이 남는다',
    dmg: 0.6, cd: 0.6, count: 1, countLabel: '얼음', learnCost: 110,
    create: (s, spec, t) => new ZoneSkill(s, spec, t, { id: 'icetrail', sprite: 'ice-crystals@190', r: 22, life: 2.2, at: 'player' }),
  },
  {
    id: 'starfall', type: 'attack', name: '별무리', icon: 'fx:star-burst@50', blurb: '작은 별들이 사방으로 튕겨 나간다',
    dmg: 0.8, cd: 1.6, count: 8, countStep: 2, countLabel: '별', learnCost: 120,
    create: (s, spec, t) => new ShotSkill(s, spec, t, { id: 'starfall', sprite: 'star-burst@50', speed: 360, range: 300, pierce: 1, pattern: 'ring', r: 7 }),
  },
  {
    id: 'heartbeam', type: 'target', name: '하트 광선', icon: 'fx:heal-cross@340', blurb: '하트가 날아가 적에게 펑',
    dmg: 1.3, cd: 1.6, count: 2, countLabel: '하트', learnCost: 140,
    create: (s, spec, t) => new ShotSkill(s, spec, t, { id: 'heartbeam', sprite: 'heal-cross@340', speed: 380, range: 380, pierce: 0, pattern: 'fan', gap: 0.3, home: 2, r: 9, blast: 36 }),
  },
  // ---- 디버프 · 버프 · 추가 (기존 그림 색만 바꿔서) ----
  {
    id: 'flash', type: 'debuff', name: '섬광', icon: 'fx:star-burst@55', blurb: '눈부신 빛으로 주변 적을 기절시킨다',
    dmg: 0.3, cd: 4, count: 2, countLabel: '범위', learnCost: 160,
    create: (s, spec, t) => new DebuffSkill(s, spec, t, { id: 'flash', kind: 'stun', t: 1.4, area: 90, sprite: 'star-burst@55', color: '#fff6a0' }),
  },
  {
    id: 'roar', type: 'debuff', name: '공포의 외침', icon: 'fx:purple-burst@20', blurb: '크게 울어서 주변 적이 겁먹고 도망친다',
    dmg: 0.2, cd: 5, count: 2, countLabel: '범위', learnCost: 140,
    create: (s, spec, t) => new DebuffSkill(s, spec, t, { id: 'roar', kind: 'fear', t: 2.5, area: 100, sprite: 'purple-burst@20', color: '#ff8a5c' }),
  },
  {
    id: 'dizzy', type: 'debuff', name: '혼란의 가루', icon: 'fx:sparkle@320', blurb: '가루를 뿌려 적들이 갈팡질팡',
    dmg: 0.3, cd: 3.5, count: 4, countLabel: '대상', learnCost: 120,
    create: (s, spec, t) => new DebuffSkill(s, spec, t, { id: 'dizzy', kind: 'confuse', t: 3, sprite: 'sparkle@320', color: '#ffb3e6' }),
  },
  {
    id: 'sleepdust', type: 'debuff', name: '수면 가루', icon: 'fx:sparkle@240', blurb: '잠 가루를 뿌려 적 몇 마리를 재운다',
    dmg: 0.2, cd: 4, count: 3, countLabel: '대상', learnCost: 130,
    create: (s, spec, t) => new DebuffSkill(s, spec, t, { id: 'sleepdust', kind: 'stun', t: 2.2, sprite: 'sparkle@240', color: '#9fb4ff' }),
  },
  {
    id: 'weaken', type: 'debuff', name: '약화의 저주', icon: 'fx:dark-orb@290', blurb: '적이 받는 피해 1.5배 (4초)',
    dmg: 0.3, cd: 3, count: 4, countLabel: '대상', learnCost: 170,
    create: (s, spec, t) => new DebuffSkill(s, spec, t, { id: 'weaken', kind: 'weak', t: 4, sprite: 'dark-orb@290', color: '#b05cff' }),
  },
  {
    id: 'hex', type: 'debuff', name: '약화의 고리', icon: 'fx:purple-pit@300', blurb: '주변 적 전부 받는 피해 1.5배',
    dmg: 0.2, cd: 5, count: 2, countLabel: '범위', learnCost: 210,
    create: (s, spec, t) => new DebuffSkill(s, spec, t, { id: 'hex', kind: 'weak', t: 3.5, area: 90, sprite: 'purple-pit@300', color: '#d07aff' }),
  },
  {
    id: 'huntmark', type: 'debuff', name: '사냥꾼의 표식', icon: 'fx:blue-slash@0', blurb: '표식이 붙은 적은 모든 공격이 치명타',
    dmg: 0.3, cd: 3, count: 3, countLabel: '대상', learnCost: 180,
    create: (s, spec, t) => new DebuffSkill(s, spec, t, { id: 'huntmark', kind: 'mark', t: 4, sprite: 'blue-slash@0', color: '#ff3b3b' }),
  },
  {
    id: 'ignite', type: 'debuff', name: '점화', icon: 'fx:fire-burst', blurb: '적에게 불을 붙여 계속 태운다',
    dmg: 0.8, cd: 2.4, count: 3, countLabel: '대상', learnCost: 130,
    create: (s, spec, t) => new DebuffSkill(s, spec, t, { id: 'ignite', kind: 'burn', t: 4, sprite: 'fire-burst', color: '#ff7a2a' }),
  },
  {
    id: 'frostbite', type: 'debuff', name: '동상', icon: 'fx:ice-crystals@210', blurb: '얼려서 계속 피해 + 느려짐',
    dmg: 0.6, cd: 2.6, count: 3, countLabel: '대상', learnCost: 140,
    create: (s, spec, t) => new DebuffSkill(s, spec, t, { id: 'frostbite', kind: 'chill', t: 3.5, sprite: 'ice-crystals@210', color: '#9fe4ff' }),
  },
  {
    id: 'venom', type: 'debuff', name: '맹독', icon: 'fx:dust@100', blurb: '독에 걸린 적이 쓰러지면 옆으로 옮는다',
    dmg: 0.6, cd: 3, count: 2, countLabel: '대상', learnCost: 190,
    create: (s, spec, t) => new DebuffSkill(s, spec, t, { id: 'venom', kind: 'venom', t: 5, sprite: 'dust@100', color: '#9be36a' }),
  },
  {
    id: 'plague', type: 'debuff', name: '역병 안개', icon: 'fx:dust@80', blurb: '주변 적 전부에게 옮는 독',
    dmg: 0.4, cd: 5, count: 2, countLabel: '범위', learnCost: 230,
    create: (s, spec, t) => new DebuffSkill(s, spec, t, { id: 'plague', kind: 'venom', t: 4, area: 80, sprite: 'dust@80', color: '#b8e36a' }),
  },
  {
    id: 'curse', type: 'debuff', name: '저주 폭탄', icon: 'fx:purple-burst', blurb: '저주받은 적이 쓰러지면 보라색으로 폭발',
    dmg: 1.0, cd: 3, count: 3, countLabel: '대상', learnCost: 200,
    create: (s, spec, t) => new DebuffSkill(s, spec, t, { id: 'curse', kind: 'curse', t: 5, sprite: 'purple-burst', color: '#9a6ad8' }),
  },
  {
    id: 'terror', type: 'debuff', name: '공포의 그림자', icon: 'fx:purple-flame@0', blurb: '그림자가 덮쳐 적 몇 마리가 겁먹는다',
    dmg: 0.4, cd: 3, count: 3, countLabel: '대상', learnCost: 150,
    create: (s, spec, t) => new DebuffSkill(s, spec, t, { id: 'terror', kind: 'fear', t: 3, sprite: 'purple-flame@0', color: '#ff6b6b' }),
  },
  {
    id: 'timestop', type: 'debuff', name: '시간 정지', icon: 'fx:gold-sparkle@200', blurb: '화면의 모든 적이 잠깐 멈춘다',
    dmg: 0.1, cd: 12, count: 1, countLabel: '정지', learnCost: 300,
    create: (s, spec, t) => new DebuffSkill(s, spec, t, { id: 'timestop', kind: 'timestop', t: 2, sprite: 'gold-sparkle@200', color: '#bfe8ff' }),
  },
  {
    id: 'shield', type: 'buff', name: '보호막', icon: 'fx:heal-circle@195', blurb: '피해를 막아 주는 방울 보호막',
    dmg: 1, cd: 6, count: 4, countStep: 0.5, countLabel: '지속', countUnit: '초', learnCost: 150,
    create: (s, spec, t) => new BuffSkill(s, spec, t, { id: 'shield', buff: 'shield', v: 0.25, color: '#9fe4ff' }),
  },
  {
    id: 'rage', type: 'buff', name: '분노', icon: 'fx:fire-burst@0', blurb: '잠깐 동안 모든 피해 증가',
    dmg: 1, cd: 7, count: 4, countStep: 0.5, countLabel: '지속', countUnit: '초', learnCost: 170,
    create: (s, spec, t) => new BuffSkill(s, spec, t, { id: 'rage', buff: 'rage', v: 0.35, sprite: 'fire-burst@0', color: '#ff4d4d' }),
  },
  {
    id: 'berserk', type: 'buff', name: '광폭화', icon: 'fx:slash@0', blurb: '짧고 강하게: 피해 크게 증가',
    dmg: 1, cd: 10, count: 2.5, countStep: 0.25, countLabel: '지속', countUnit: '초', learnCost: 240,
    create: (s, spec, t) => new BuffSkill(s, spec, t, { id: 'berserk', buff: 'rage', v: 0.7, sprite: 'slash@0', color: '#ff2a2a' }),
  },
  {
    id: 'haste', type: 'buff', name: '신속', icon: 'fx:gold-sparkle', blurb: '잠깐 동안 스킬이 더 빨리 돈다',
    dmg: 1, cd: 8, count: 4, countStep: 0.5, countLabel: '지속', countUnit: '초', learnCost: 200,
    create: (s, spec, t) => new BuffSkill(s, spec, t, { id: 'haste', buff: 'haste', v: 0.6, sprite: 'gold-sparkle', color: '#ffd23f' }),
  },
  {
    id: 'overdrive', type: 'buff', name: '과부하', icon: 'fx:blue-slash@50', blurb: '짧고 강하게: 스킬 쿨 크게 감소',
    dmg: 1, cd: 11, count: 2.5, countStep: 0.25, countLabel: '지속', countUnit: '초', learnCost: 260,
    create: (s, spec, t) => new BuffSkill(s, spec, t, { id: 'overdrive', buff: 'haste', v: 1.2, color: '#ffe066' }),
  },
  {
    id: 'sprint', type: 'buff', name: '질주', icon: 'fx:feather@120', blurb: '잠깐 동안 이동 속도 증가',
    dmg: 1, cd: 6, count: 3, countStep: 0.5, countLabel: '지속', countUnit: '초', learnCost: 110,
    create: (s, spec, t) => new BuffSkill(s, spec, t, { id: 'sprint', buff: 'sprint', v: 0.45, color: '#7cf2a0' }),
  },
  {
    id: 'thorns', type: 'buff', name: '가시 갑옷', icon: 'fx:purple-burst@280', blurb: '부딪힌 적에게 피해를 되돌려 준다',
    dmg: 1.5, cd: 7, count: 4, countStep: 0.5, countLabel: '지속', countUnit: '초', learnCost: 160,
    create: (s, spec, t) => new BuffSkill(s, spec, t, { id: 'thorns', buff: 'thorns', v: 1, color: '#c78bff' }),
  },
  {
    id: 'regen', type: 'buff', name: '재생', icon: 'fx:heal-circle', blurb: '잠깐 동안 체력이 계속 찬다',
    dmg: 1, cd: 8, count: 5, countStep: 0.5, countLabel: '지속', countUnit: '초', learnCost: 140,
    create: (s, spec, t) => new BuffSkill(s, spec, t, { id: 'regen', buff: 'regen', v: 0.025, sprite: 'heal-circle', color: '#7cf2a0' }),
  },
  {
    id: 'luck', type: 'buff', name: '행운', icon: 'fx:sparkle@40', blurb: '잠깐 동안 치명타 확률 크게 증가',
    dmg: 1, cd: 7, count: 4, countStep: 0.5, countLabel: '지속', countUnit: '초', learnCost: 150,
    create: (s, spec, t) => new BuffSkill(s, spec, t, { id: 'luck', buff: 'luck', v: 0.3, sprite: 'sparkle@40', color: '#ffb347' }),
  },
  {
    id: 'magnetstorm', type: 'buff', name: '자석 폭풍', icon: 'fx:gold-sparkle@50', blurb: '보석을 전부 끌어오고 자석 범위 증가',
    dmg: 1, cd: 9, count: 4, countStep: 0.5, countLabel: '지속', countUnit: '초', learnCost: 120,
    create: (s, spec, t) => new BuffSkill(s, spec, t, { id: 'magnetstorm', buff: 'magnet', v: 2, color: '#ffe066' }),
  },
  {
    id: 'invincible', type: 'buff', name: '무적', icon: 'fx:pillar@50', blurb: '잠깐 동안 아무 피해도 안 받는다',
    dmg: 1, cd: 14, count: 1.5, countStep: 0.25, countLabel: '지속', countUnit: '초', learnCost: 280,
    create: (s, spec, t) => new BuffSkill(s, spec, t, { id: 'invincible', buff: 'invuln', v: 1, sprite: 'pillar@50', color: '#ffffff' }),
  },
  {
    id: 'bless', type: 'buff', name: '축복', icon: 'fx:pillar@300', blurb: '다른 스킬의 쿨다운을 즉시 채운다',
    dmg: 1, cd: 9, count: 1, countLabel: '축복', learnCost: 260,
    create: (s, spec, t) => new BuffSkill(s, spec, t, { id: 'bless', buff: 'bless', v: 1, sprite: 'pillar@300', color: '#ffb3e6' }),
  },
  {
    id: 'sunflare', type: 'attack', name: '태양 폭발', icon: 'fx:fire-burst@45', blurb: '발밑에서 금빛 폭발이 연달아',
    dmg: 1.1, cd: 2.4, count: 2, countLabel: '폭발', learnCost: 160,
    create: (s, spec, t) => new PulseSkill(s, spec, t, { id: 'sunflare', color: '#ffd23f', radius: 60, step: 30, sprite: 'fire-burst@45', knock: 160 }),
  },
  {
    id: 'darkwave', type: 'attack', name: '암흑 파동', icon: 'fx:purple-burst', blurb: '보랏빛 파동이 퍼져 나간다',
    dmg: 1.0, cd: 2.2, count: 2, countLabel: '파동', learnCost: 150,
    create: (s, spec, t) => new PulseSkill(s, spec, t, { id: 'darkwave', color: '#b05cff', radius: 55, step: 35, sprite: 'purple-burst', knock: 120 }),
  },
  {
    id: 'emberring', type: 'attack', name: '불씨 고리', icon: 'fx:fire-burst@20', blurb: '둘레에서 불씨들이 퍼져 나간다',
    dmg: 0.8, cd: 2.4, count: 6, countStep: 2, countLabel: '불씨', learnCost: 140,
    create: (s, spec, t) => new ZoneSkill(s, spec, t, { id: 'emberring', sprite: 'fire-burst@20', r: 16, life: 1.6, at: 'ring', speed: 140 }),
  },
  {
    id: 'shadowbolt', type: 'target', name: '그림자 화살', icon: 'fx:dark-orb@270', blurb: '적을 쫓아가 터지는 그림자 구슬',
    dmg: 1.3, cd: 1.6, count: 2, countLabel: '구슬', learnCost: 150,
    create: (s, spec, t) => new ShotSkill(s, spec, t, { id: 'shadowbolt', sprite: 'dark-orb@270', speed: 260, range: 520, pierce: 0, pattern: 'random', home: 5, r: 9, blast: 36 }),
  },
  {
    id: 'icemeteor', type: 'target', name: '얼음 운석', icon: 'fx:ice-crystals@190', blurb: '얼음덩이가 떨어져 주변을 얼린다',
    dmg: 1.6, cd: 2.4, count: 3, countLabel: '운석', learnCost: 180,
    create: (s, spec, t) => new StrikeSkill(s, spec, t, { id: 'icemeteor', sprite: 'ice-crystals@190', radius: 40, slow: 1.5, shake: 2 }),
  },
  {
    id: 'goldspear', type: 'target', name: '황금 창', icon: 'fx:feather@45', blurb: '일직선으로 다 꿰뚫는 황금 창',
    dmg: 1.4, cd: 1.5, count: 2, countLabel: '창', learnCost: 160,
    create: (s, spec, t) => new ShotSkill(s, spec, t, { id: 'goldspear', sprite: 'feather@45', speed: 720, range: 460, pierce: 999, pattern: 'fan', gap: 0.15, r: 9, scale: 1.4 }),
  },
];

export const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s])) as Record<SkillId, SkillDef>;

export const emptyTree = (): SkillTree => ({ dmg: 0, spd: 0, cnt: 0 });

/** 테스트용: 스킬 배우기·가지 강화 값을 전부 이걸로 (null이면 원래 값) */
const COST_OVERRIDE: number | null = 1;
export const learnPrice = (def: SkillDef) => COST_OVERRIDE ?? def.learnCost;

export const createSkill = (def: SkillDef, stats: WeaponStats, tree: SkillTree) => def.create(stats, def, tree);

/** 가지 한 단계 강화 비용. 개수는 효과가 커서 비싸다 */
export function branchCost(def: SkillDef, branch: Branch, level: number) {
  if (COST_OVERRIDE !== null) return COST_OVERRIDE;
  const base = Math.max(15, def.learnCost);
  if (branch === 'cnt') return base * 1.5 * Math.pow(1.7, level);
  return base * 0.4 * Math.pow(1.28, level);
}

/** 가지 값 보여 주기: 지금 레벨 기준 */
export function branchValue(def: SkillDef, branch: Branch, tree: SkillTree): string {
  switch (branch) {
    case 'dmg':
      return `${Math.round(def.dmg * treeDamage(tree) * 100)}%`;
    case 'spd':
      return def.continuous
        ? `회전 ×${(1 + 0.1 * tree.spd).toFixed(1)}`
        : `${(def.cd * (def.id === 'heal' ? 1 : HASTE) * treeCooldown(tree)).toFixed(2)}초마다`;
    case 'cnt':
      return `${+(def.count + tree.cnt * (def.countStep ?? 1)).toFixed(2)}${def.countUnit ?? (def.id === 'chain' ? '번' : '개')}`;
  }
}

/** 카드 한 줄 요약 */
export function skillSummary(def: SkillDef, tree: SkillTree) {
  return `${def.dmgLabel ?? '피해'} ${branchValue(def, 'dmg', tree)} · ${branchValue(def, 'spd', tree)} · ${def.countLabel} ${branchValue(def, 'cnt', tree)}`;
}

/** 전체 강화 단계 합 (카드에 Lv로 보여 준다) */
export const treeLevel = (t: SkillTree) => 1 + t.dmg + t.spd + t.cnt;
