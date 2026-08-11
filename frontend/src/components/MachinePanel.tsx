import type { GameState } from '../game/engine';
import type { Hand } from '../game/judge';
import { HandSprite } from './HandSprite';

interface MachinePanelProps {
  readonly state: GameState;
}

const HANDS: readonly Hand[] = ['rock', 'scissors', 'paper'];

export function MachinePanel({ state }: MachinePanelProps) {
  const isCycling = state.phase === 'calling';
  const shownHand = state.machineHand ?? 'rock';

  return (
    <section className="machine-panel" aria-label="ジャンケンマシン">
      <div className="machine-panel__marquee" aria-hidden="true">
        ★ ジャンケン ★
      </div>

      <div className="machine-panel__display">
        <div className="led-display" role="status" aria-live="polite">
          {state.message}
        </div>
        {state.error !== null && (
          <p className="machine-panel__retry-detail">{state.error}</p>
        )}

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

        {state.playerHand !== null && (
          <div className="machine-panel__versus">
            <span>あなた</span>
            <HandSprite
              hand={state.playerHand}
              label={`あなたは${handName(state.playerHand)}`}
              size={72}
            />
          </div>
        )}
      </div>

      <div className="machine-panel__footer">
        <div className="medal-counter" aria-label={`メダル ${state.medals}枚`}>
          <span aria-hidden="true" className="medal-counter__coin">●</span>
          <span>MEDAL</span>
          <strong data-testid="medal-count">{String(state.medals).padStart(3, '0')}</strong>
        </div>
        <div className="coin-slot" aria-hidden="true">
          <span />
          COIN
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
