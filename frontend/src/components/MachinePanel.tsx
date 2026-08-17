import type { CSSProperties } from 'react';
import type { GameState } from '../game/engine';
import type { Hand } from '../game/judge';
import { ROULETTE_PAYOUTS } from '../game/roulette';
import { HandSprite } from './HandSprite';

interface MachinePanelProps {
  readonly state: GameState;
}

const HANDS: readonly Hand[] = ['rock', 'scissors', 'paper'];

export function MachinePanel({ state }: MachinePanelProps) {
  const isCycling = state.phase === 'calling';
  const shownHand = state.machineHand ?? 'rock';
  const isWinning = state.phase === 'result' && state.outcome === 'win';
  const payoutIndex = state.payoutIndex ?? 0;
  const stopAngle = payoutIndex * (360 / ROULETTE_PAYOUTS.length);
  const rouletteStyle = {
    '--roulette-stop-angle': `${stopAngle}deg`,
  } as CSSProperties;

  return (
    <section
      aria-label="ジャンケンマシン"
      className={`machine-panel machine-panel--${state.phase}`}
      data-outcome={state.outcome ?? undefined}
    >
      <div className="machine-panel__display">
        <div className="machine-panel__result-lamps" aria-hidden="true">
          <span className="result-lamp result-lamp--win">かち</span>
          <span
            aria-label={state.payout === null ? '配当 未決定' : `配当 ${state.payout}枚`}
            className="payout-lamp"
            data-testid="payout-count"
          >
            {state.payout ?? '—'}
          </span>
          <span className="result-lamp result-lamp--lose">まけ</span>
        </div>

        <div className="machine-panel__burst">
          <div
            aria-label={isWinning ? `配当ルーレット、${state.payout ?? 2}枚に決定` : '配当ルーレット'}
            className="roulette-wheel"
            role="img"
            style={rouletteStyle}
          >
            <div aria-hidden="true" className="roulette-wheel__slots">
              {ROULETTE_PAYOUTS.map((payout, index) => {
                const angle = index * (360 / ROULETTE_PAYOUTS.length);
                const slotStyle = {
                  '--roulette-angle': `${angle}deg`,
                  '--roulette-label-angle': `${-angle}deg`,
                } as CSSProperties;
                const selected = isWinning && index === payoutIndex;

                return (
                  <span
                    className={`roulette-wheel__slot${selected ? ' roulette-wheel__slot--selected' : ''}`}
                    key={`${payout}-${index}`}
                    style={slotStyle}
                  >
                    {payout}
                  </span>
                );
              })}
              {isWinning && <span className="roulette-wheel__runner" />}
            </div>
          </div>

          <div className="machine-panel__hand-window">
            {isCycling ? (
              <div
                aria-label="マシンの手をシャッフル中"
                className="machine-panel__cycling-hands"
                role="img"
              >
                {HANDS.map((hand, index) => (
                  <HandSprite
                    className={`machine-panel__cycle-hand machine-panel__cycle-hand--${index + 1}`}
                    decorative
                    hand={hand}
                    key={hand}
                  />
                ))}
              </div>
            ) : (
              <HandSprite hand={shownHand} label={`マシンは${handName(shownHand)}`} />
            )}
          </div>
        </div>

        <div className="led-display" role="status" aria-live="polite">
          {state.message}
        </div>
        {state.error !== null && (
          <p className="machine-panel__retry-detail">{state.error}</p>
        )}

        {state.playerHand !== null && (
          <div className="machine-panel__versus">
            <span>あなたの て</span>
            <HandSprite
              hand={state.playerHand}
              label={`あなたは${handName(state.playerHand)}`}
              size={58}
            />
            <strong>{handName(state.playerHand)}</strong>
          </div>
        )}
      </div>

      <div className="machine-panel__footer">
        <div className="medal-counter" aria-label={`メダル ${state.medals}枚`}>
          <span aria-hidden="true" className="medal-counter__coin">★</span>
          <span>メダル</span>
          <strong data-testid="medal-count">{String(state.medals).padStart(3, '0')}</strong>
        </div>
        <div className="coin-slot" aria-hidden="true">
          <span />
          メダル いりぐち
        </div>
      </div>
    </section>
  );
}

function handName(hand: Hand): string {
  switch (hand) {
    case 'rock':
      return 'グー';
    case 'scissors':
      return 'チョキ';
    case 'paper':
      return 'パー';
  }
}
