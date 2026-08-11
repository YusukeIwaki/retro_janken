export type Hand = 'rock' | 'scissors' | 'paper';

export type Outcome = 'win' | 'lose' | 'draw';

const BEATS: Readonly<Record<Hand, Hand>> = {
  rock: 'scissors',
  scissors: 'paper',
  paper: 'rock',
};

export function judge(player: Hand, machine: Hand): Outcome {
  if (player === machine) {
    return 'draw';
  }

  return BEATS[player] === machine ? 'win' : 'lose';
}

export function isHand(value: unknown): value is Hand {
  return value === 'rock' || value === 'scissors' || value === 'paper';
}
