import type { MatId } from './world';
import { regionLap, regionOf } from './world';

// 재료와 보물 상자.

export interface MatDef {
  id: MatId;
  name: string;
  /** 그림이 생기기 전 임시 아이콘 */
  icon: string;
}

export const MATS: MatDef[] = [
  { id: 'feather', name: '깃털 조각', icon: '🪶' },
  { id: 'spore', name: '버섯 포자', icon: '🍄' },
  { id: 'ice', name: '얼음 결정', icon: '❄️' },
  { id: 'lava', name: '용암석', icon: '🔥' },
  { id: 'shadow', name: '어둠의 조각', icon: '🌑' },
  { id: 'skillbook', name: '스킬북', icon: '📕' },
];

export const MAT_BY_ID = Object.fromEntries(MATS.map((m) => [m.id, m])) as Record<MatId, MatDef>;

/** 상자 등급: 0 나무 / 1 은 / 2 금 */
export type ChestGrade = 0 | 1 | 2;
export const CHEST_NAMES = ['나무 상자', '은 상자', '금 상자'] as const;
/** 상자 테두리 빛 색 */
export const CHEST_COLORS = ['#c8823a', '#d8e4f0', '#ffd23f'] as const;

/** 상자 등급 뽑기. bonus(0~1)만큼 한 단계 위로 갈 확률이 오른다 (피버·장신구) */
export function rollChest(bonus = 0): ChestGrade {
  const r = Math.random();
  if (r < 0.06 + bonus * 0.5) return 2;
  if (r < 0.32 + bonus) return 1;
  return 0;
}

export interface Reward {
  mats: Partial<Record<MatId, number>>;
  gold: number;
  diamonds: number;
}

export const emptyReward = (): Reward => ({ mats: {}, gold: 0, diamonds: 0 });

/** 상자 하나 열기: 지역 재료 + 등급에 따라 스킬북·다이아 */
export function openChest(grade: ChestGrade, stage: number, goldBase: number): Reward {
  const mat = regionOf(stage).mat;
  const lap = 1 + regionLap(stage);
  const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
  const r = emptyReward();
  const n = [rnd(2, 4), rnd(5, 8), rnd(10, 15)][grade] * lap;
  r.mats[mat] = n;
  r.gold = goldBase * [10, 25, 60][grade];
  if (Math.random() < [0.02, 0.12, 0.35][grade]) r.mats.skillbook = 1;
  if (grade === 2) r.diamonds = 5;
  return r;
}

export function addReward(into: Reward, r: Reward) {
  for (const [k, v] of Object.entries(r.mats)) into.mats[k as MatId] = (into.mats[k as MatId] ?? 0) + (v ?? 0);
  into.gold += r.gold;
  into.diamonds += r.diamonds;
}

/** 보상 한 줄 글 (예: 🪶 깃털 조각 ×4 · 📕 스킬북 ×1) */
export function rewardText(r: Reward) {
  const parts = Object.entries(r.mats).map(([k, v]) => `${MAT_BY_ID[k as MatId].icon} ${MAT_BY_ID[k as MatId].name} ×${v}`);
  if (r.diamonds) parts.push(`💎 ×${r.diamonds}`);
  return parts.join(' · ');
}
