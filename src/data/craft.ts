import type { MatId } from './world';

// 제작 레시피: 스테이지 상자에서 나온 재료로 열쇠·스킬 조각·부스터를 만든다.
// 부스터는 다음 스테이지 한 판에 자동으로 쓴다 (스테이지 시작 때 하나씩).

export type BoosterId = 'gold2' | 'xp2' | 'feverStart';

export const BOOSTERS: Record<BoosterId, { name: string; icon: string; desc: string }> = {
  gold2: { name: '황금 바람', icon: '💰', desc: '다음 스테이지 골드 2배' },
  xp2: { name: '지혜의 깃털', icon: '📚', desc: '다음 스테이지 경험치 2배' },
  feverStart: { name: '피버 폭죽', icon: '🎆', desc: '다음 스테이지를 피버로 시작' },
};

export interface RecipeDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  cost: Partial<Record<MatId, number>>;
  gives: { mats?: Partial<Record<MatId, number>>; shards?: number; booster?: BoosterId };
}

export const RECIPES: RecipeDef[] = [
  { id: 'key_silver', name: '은 열쇠', icon: '🔑', desc: '스킬 은 상자 1회', cost: { feather: 25 }, gives: { mats: { key_silver: 1 } } },
  { id: 'key_gold', name: '금 열쇠', icon: '🗝️', desc: '스킬 금 상자 1회', cost: { spore: 20, ice: 10 }, gives: { mats: { key_gold: 1 } } },
  { id: 'shard_s', name: '스킬 조각 ×5', icon: '🧩', desc: '모아서 원하는 스킬과 교환', cost: { feather: 15 }, gives: { shards: 5 } },
  { id: 'shard_l', name: '스킬 조각 ×30', icon: '🧩', desc: '모아서 원하는 스킬과 교환', cost: { lava: 10, shadow: 5 }, gives: { shards: 30 } },
  { id: 'gold2', name: '황금 바람', icon: '💰', desc: '다음 스테이지 골드 2배', cost: { feather: 20 }, gives: { booster: 'gold2' } },
  { id: 'xp2', name: '지혜의 깃털', icon: '📚', desc: '다음 스테이지 경험치 2배', cost: { spore: 15 }, gives: { booster: 'xp2' } },
  { id: 'feverStart', name: '피버 폭죽', icon: '🎆', desc: '다음 스테이지를 피버로 시작', cost: { ice: 15 }, gives: { booster: 'feverStart' } },
];
