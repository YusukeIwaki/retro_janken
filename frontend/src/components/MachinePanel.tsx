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
    <section
      aria-label="ジャンケンマシン"
      className={`machine-panel machine-panel--${state.phase}`}
      data-outcome={state.outcome ?? undefined}
    >
      <div className="machine-panel__display">
        <div className="machine-panel__result-lamps" aria-hidden="true">
          <span className="result-lamp result-lamp--win">かち</span>
          <span className="payout-lamp">2</span>
          <span className="result-lamp result-lamp--lose">まけ</span>
        </div>

        <div className="machine-panel__burst">
          <div className="machine-panel__callout machine-panel__callout--paper" aria-hidden="true">
            <HandSprite decorative hand="paper" size={42} />
            <span>パー</span>
          </div>
          <div className="machine-panel__callout machine-panel__callout--rock" aria-hidden="true">
            <HandSprite decorative hand="rock" size={42} />
            <span>グー</span>
          </div>
          <div className="machine-panel__callout machine-panel__callout--scissors" aria-hidden="true">
            <HandSprite decorative hand="scissors" size={42} />
            <span>チョキ</span>
          </div>

          <div className="machine-panel__jackpot-ring" aria-hidden="true">
            <span>J</span><span>A</span><span>C</span><span>K</span><span>P</span><span>O</span><span>T</span>
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
