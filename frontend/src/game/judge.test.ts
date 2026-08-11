import { describe, expect, it } from 'vitest';
import { judge, type Hand, type Outcome } from './judge';

describe('judge', () => {
  const cases: readonly (readonly [Hand, Hand, Outcome])[] = [
    ['rock', 'rock', 'draw'],
    ['scissors', 'scissors', 'draw'],
    ['paper', 'paper', 'draw'],
    ['rock', 'scissors', 'win'],
    ['scissors', 'paper', 'win'],
    ['paper', 'rock', 'win'],
    ['rock', 'paper', 'lose'],
    ['scissors', 'rock', 'lose'],
    ['paper', 'scissors', 'lose'],
  ];

  it.each(cases)('%s vs %s is %s', (player, machine, expected) => {
    expect(judge(player, machine)).toBe(expected);
  });
});
