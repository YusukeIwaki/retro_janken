export const ROULETTE_PAYOUTS = [2, 4, 7, 20, 2, 4, 7, 2, 4, 20, 2, 7] as const;

export type RoulettePayout = (typeof ROULETTE_PAYOUTS)[number];

export interface RouletteResult {
  readonly index: number;
  readonly payout: RoulettePayout;
}

export function selectRoulette(value: number): RouletteResult {
  const finiteValue = Number.isFinite(value) ? value : 0;
  const normalized = Math.min(Math.max(finiteValue, 0), 0.999_999);
  const index = Math.floor(normalized * ROULETTE_PAYOUTS.length);

  return {
    index,
    payout: ROULETTE_PAYOUTS[index] ?? ROULETTE_PAYOUTS[0],
  };
}
