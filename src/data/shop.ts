import type { Recolor } from '../battle/tint';
import { GEAR, type GearDef } from './gear';
import { PETS, type PetDef } from './pets';

// 상점: 다이아 소환(동료·장비), 병아리 색, 스킬 색, 광고 보상(지금은 광고 없이 바로 지급).

export const SUMMON_COST = { one: 50, ten: 450 };
/** 광고 보상: 하루 횟수와 다이아 */
export const AD_DAILY = 10;
export const AD_DIAMONDS = 30;

/** 동료 소환: 보통 70% / 희귀 26% / 전설 4% */
export function rollPet(): PetDef {
  const r = Math.random();
  const rarity = r < 0.04 ? 2 : r < 0.3 ? 1 : 0;
  const pool = PETS.filter((p) => p.rarity === rarity);
  return pool[Math.floor(Math.random() * pool.length)];
}

/** 장비 소환: 전설(정수 필요한 것) 빼고, 비싼 장비일수록 드물게 */
export function rollGear(): GearDef {
  const pool = GEAR.filter((g) => !g.essence);
  const weights = pool.map((g) => 1 / Math.sqrt(g.goldCost));
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[0];
}

export interface SkinDef {
  id: string;
  name: string;
  price: number;
  /** null = 원래 색, 'rainbow' = 시간에 따라 색이 돈다 */
  recolor: Recolor | 'rainbow' | null;
  /** 상점 미리보기 색 */
  swatch: string;
}

/** 병아리 몸통(노랑, 색상 28~62°)만 바꾼다 */
const BODY = [28, 62] as const;
const body = (target: number, sat = 1, light = 1): Recolor => ({ shift: target - 45, sat, light, window: BODY });

export const CHICK_SKINS: SkinDef[] = [
  { id: 'basic', name: '기본 노랑', price: 0, recolor: null, swatch: '#ffd84a' },
  { id: 'pink', name: '딸기 분홍', price: 100, recolor: body(335, 0.9, 1.05), swatch: '#ff8fc0' },
  { id: 'sky', name: '하늘 파랑', price: 100, recolor: body(200, 0.9, 1.05), swatch: '#7cc8ff' },
  { id: 'mint', name: '민트', price: 100, recolor: body(150, 0.8, 1.05), swatch: '#7fe0b4' },
  { id: 'grape', name: '포도 보라', price: 150, recolor: body(275, 0.85), swatch: '#b48cff' },
  { id: 'snow', name: '눈송이', price: 200, recolor: { shift: 0, sat: 0.12, light: 1.35, window: BODY }, swatch: '#f4f4f8' },
  { id: 'crow', name: '까마귀', price: 200, recolor: { shift: 220, sat: 0.2, light: 0.55, window: BODY }, swatch: '#4a4a5a' },
  { id: 'rainbow', name: '무지개', price: 500, recolor: 'rainbow', swatch: 'linear-gradient(90deg,#ff6b6b,#ffd93d,#6bff8f,#6bc5ff,#c56bff)' },
];

export const FX_SKINS: SkinDef[] = [
  { id: 'basic', name: '기본', price: 0, recolor: null, swatch: '#ff9a3a' },
  { id: 'frost', name: '서리빛', price: 150, recolor: { shift: 180, sat: 1, light: 1.05 }, swatch: '#6fd6ff' },
  { id: 'poison', name: '독안개', price: 150, recolor: { shift: 95, sat: 1.1, light: 1 }, swatch: '#7dff6a' },
  { id: 'sakura', name: '벚꽃', price: 200, recolor: { shift: 300, sat: 0.8, light: 1.15 }, swatch: '#ffa4d8' },
  { id: 'void', name: '심연', price: 250, recolor: { shift: 240, sat: 1.2, light: 0.8 }, swatch: '#7a4dff' },
  { id: 'rainbow', name: '무지개', price: 600, recolor: 'rainbow', swatch: 'linear-gradient(90deg,#ff6b6b,#ffd93d,#6bff8f,#6bc5ff,#c56bff)' },
];

export const CHICK_SKIN_BY_ID = Object.fromEntries(CHICK_SKINS.map((s) => [s.id, s])) as Record<string, SkinDef>;
export const FX_SKIN_BY_ID = Object.fromEntries(FX_SKINS.map((s) => [s.id, s])) as Record<string, SkinDef>;

/** 무지개: 0.12초마다 30°씩 돈다 (12가지 색만 만들어 둔다) */
export function rainbowRecolor(time: number, window?: readonly [number, number]): Recolor {
  const step = Math.floor(time / 0.12) % 12;
  return { shift: step * 30, sat: 1.1, light: 1, window };
}

/** 지금 시각에 쓸 색 (없으면 null) */
export function skinRecolor(skin: SkinDef | undefined, time: number, chick: boolean): Recolor | null {
  if (!skin?.recolor) return null;
  if (skin.recolor === 'rainbow') return rainbowRecolor(time, chick ? BODY : undefined);
  return skin.recolor;
}
