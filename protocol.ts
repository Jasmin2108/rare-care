/** Official Generations schedule from rarefriends.com/docs/generations (preview display + session sim). */

export const HARDWIRE_RF: Record<number, number> = {
  1: 100_000, 2: 10_000, 3: 1_000, 4: 100, 5: 10, 6: 1,
};

export const PROMOTE_RF: Record<number, number> = {
  6: 9, 5: 90, 4: 900, 3: 9_000, 2: 90_000,
};

export const UPGRADE_RF: Record<number, readonly [number, number, number, number]> = {
  1: [50_000, 75_000, 112_500, 168_750],
  2: [5_000, 7_500, 11_250, 16_875],
  3: [500, 750, 1_125, 1_687.5],
  4: [50, 75, 112.5, 168.75],
  5: [5, 7.5, 11.25, 16.875],
  6: [0.5, 0.75, 1.125, 1.6875],
};

export const WEIGHT: Record<number, readonly [number, number, number, number, number]> = {
  1: [175_000, 270_000, 416_250, 641_250, 987_187.5],
  2: [16_000, 24_375, 37_125, 56_531.25, 86_062.5],
  3: [1_450, 2_212.5, 3_375, 5_146.875, 7_846.875],
  4: [130, 198.75, 303.75, 464.0625, 708.75],
  5: [12, 18.375, 28.125, 43.03125, 65.8125],
  6: [1.1, 1.6875, 2.5875, 3.965625, 6.075],
};

export const PREVIEW_WETH_PER_RF = 0.001;
export const PREVIEW_NETWORK_WEIGHT = 20_000_000;

export function clampGen(value: number) {
  return Math.max(1, Math.min(6, Math.round(value)));
}

export function clampTier(value: number) {
  return Math.max(0, Math.min(4, Math.round(value)));
}

export function rewardWeight(generation: number, tier: number) {
  const row = WEIGHT[clampGen(generation)];
  return row?.[clampTier(tier)] ?? 1.1;
}

export function promoteCost(fromGeneration: number) {
  return PROMOTE_RF[clampGen(fromGeneration)] ?? null;
}

export function upgradeCost(generation: number, fromTier: number) {
  if (fromTier < 0 || fromTier >= 4) return null;
  return UPGRADE_RF[clampGen(generation)]?.[fromTier] ?? null;
}

export function reactivateCost(generation: number) {
  return HARDWIRE_RF[clampGen(generation)] * 0.1;
}

export function formatWeight(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

export function formatToken(value: number, digits = 4) {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return value.toFixed(digits).replace(/\.?0+$/, "") || "0";
}
