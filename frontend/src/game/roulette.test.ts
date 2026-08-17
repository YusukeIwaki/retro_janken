import { describe, expect, it } from 'vitest';
import { ROULETTE_PAYOUTS, selectRoulette } from './roulette';

describe('selectRoulette', () => {
  it('selects a deterministic payout from an injected RNG value', () => {
    expect(selectRoulette(0)).toEqual({ index: 0, payout: 2 });
    expect(selectRoulette(0.51)).toEqual({ index: 6, payout: 7 });
    expect(selectRoulette(0.8)).toEqual({ index: 9, payout: 20 });
  });

  it('clamps invalid and out-of-range values to a valid slot', () => {
    expect(selectRoulette(Number.NaN)).toEqual({ index: 0, payout: 2 });
    expect(selectRoulette(-1)).toEqual({ index: 0, payout: 2 });
    expect(selectRoulette(2)).toEqual({
      index: ROULETTE_PAYOUTS.length - 1,
      payout: 7,
    });
  });
});
