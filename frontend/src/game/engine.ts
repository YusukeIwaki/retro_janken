import { judge, type Hand, type Outcome } from './judge';
import { selectRoulette, type RoulettePayout } from './roulette';

export type GamePhase =
  | 'idle'
  | 'calling'
  | 'capturing'
  | 'judging'
  | 'aiko'
  | 'result';

export interface GameState {
  readonly phase: GamePhase;
  readonly medals: number;
  readonly machineHand: Hand | null;
  readonly playerHand: Hand | null;
  readonly confidence: number | null;
  readonly outcome: Outcome | null;
  readonly payout: RoulettePayout | null;
  readonly payoutIndex: number | null;
  readonly message: string;
  readonly retryCount: number;
  readonly error: string | null;
}

export interface Classification {
  readonly hand: Hand;
  readonly confidence: number;
  readonly latencyMs?: number;
}

export interface Camera {
  capture(): Promise<Blob>;
}

export interface Classifier {
  classify(image: Blob): Promise<Classification>;
}

export type SoundCue = 'janken' | 'pon' | 'aiko' | 'win' | 'lose';

export interface SoundPlayer {
  play(cue: SoundCue): Promise<void>;
}

export interface Rng {
  next(): number;
}

export interface Clock {
  wait(milliseconds: number): Promise<void>;
}

export interface MedalStore {
  load(): number;
  save(medals: number): void;
}

export interface GameDependencies {
  readonly camera: Camera;
  readonly classifier: Classifier;
  readonly sound: SoundPlayer;
  readonly rng: Rng;
  readonly clock: Clock;
  readonly medalStore?: MedalStore;
}

export type GameEvent =
  | { readonly type: 'START' }
  | { readonly type: 'CALLING'; readonly message?: string }
  | { readonly type: 'CAPTURE'; readonly machineHand: Hand }
  | { readonly type: 'CLASSIFIED'; readonly classification: Classification }
  | {
      readonly type: 'JUDGED';
      readonly outcome: Outcome;
      readonly roulette: ReturnType<typeof selectRoulette> | null;
    }
  | { readonly type: 'RETRY'; readonly reason: string }
  | { readonly type: 'RESET' }
  | { readonly type: 'CANCEL' };

export const CONFIDENCE_THRESHOLD = 0.6;
export const CALLING_MINIMUM_MS = 900;
export const RETRY_MESSAGE_MS = 650;
export const JUDGING_MS = 300;
export const RESULT_DISPLAY_MS = 5_200;

const HANDS: readonly Hand[] = ['rock', 'scissors', 'paper'];

export function createInitialState(medals = 0): GameState {
  return {
    phase: 'idle',
    medals: normalizeMedals(medals),
    machineHand: null,
    playerHand: null,
    confidence: null,
    outcome: null,
    payout: null,
    payoutIndex: null,
    message: 'コインをいれてね',
    retryCount: 0,
    error: null,
  };
}

export function gameReducer(state: GameState, event: GameEvent): GameState {
  switch (event.type) {
    case 'START':
      if (state.phase !== 'idle') {
        return state;
      }
      return {
        ...state,
        phase: 'calling',
        machineHand: null,
        playerHand: null,
        confidence: null,
        outcome: null,
        payout: null,
        payoutIndex: null,
        message: 'ジャンケン…',
        retryCount: 0,
        error: null,
      };
    case 'CALLING':
      if (state.phase !== 'calling') {
        return state;
      }
      return {
        ...state,
        machineHand: null,
        playerHand: null,
        confidence: null,
        outcome: null,
        payout: null,
        payoutIndex: null,
        message: event.message ?? 'ジャンケン…',
      };
    case 'CAPTURE':
      if (state.phase !== 'calling' && state.phase !== 'aiko') {
        return state;
      }
      return {
        ...state,
        phase: 'capturing',
        machineHand: event.machineHand,
        playerHand: null,
        confidence: null,
        outcome: null,
        payout: null,
        payoutIndex: null,
        message: 'ポン！ カメラ判定中',
        error: null,
      };
    case 'CLASSIFIED':
      if (state.phase !== 'capturing') {
        return state;
      }
      return {
        ...state,
        phase: 'judging',
        playerHand: event.classification.hand,
        confidence: event.classification.confidence,
        message: 'しょうぶ！',
      };
    case 'JUDGED': {
      if (state.phase !== 'judging') {
        return state;
      }
      if (event.outcome === 'draw') {
        return {
          ...state,
          phase: 'aiko',
          outcome: 'draw',
          payout: null,
          payoutIndex: null,
          message: 'あいこでしょ！',
        };
      }
      const roulette = event.outcome === 'win'
        ? (event.roulette ?? selectRoulette(0))
        : null;
      return {
        ...state,
        phase: 'result',
        medals: state.medals + (roulette?.payout ?? 0),
        outcome: event.outcome,
        payout: roulette?.payout ?? null,
        payoutIndex: roulette?.index ?? null,
        message: event.outcome === 'win' ? 'かった！' : 'まけた！',
      };
    }
    case 'RETRY':
      if (state.phase !== 'capturing') {
        return state;
      }
      return {
        ...state,
        phase: 'calling',
        machineHand: null,
        playerHand: null,
        confidence: null,
        outcome: null,
        payout: null,
        payoutIndex: null,
        message: 'もういっかい！',
        retryCount: state.retryCount + 1,
        error: event.reason,
      };
    case 'RESET':
      if (state.phase !== 'result') {
        return state;
      }
      return createInitialState(state.medals);
    case 'CANCEL':
      return createInitialState(state.medals);
  }
}

export class GameEngine {
  private state: GameState;
  private readonly dependencies: GameDependencies;
  private readonly listeners = new Set<(state: GameState) => void>();
  private operationId = 0;
  private running = false;

  constructor(dependencies: GameDependencies) {
    this.dependencies = dependencies;
    this.state = createInitialState(this.loadMedals());
  }

  getState(): GameState {
    return this.state;
  }

  subscribe(listener: (state: GameState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async start(): Promise<void> {
    if (this.running || this.state.phase !== 'idle') {
      return;
    }

    this.running = true;
    const operationId = ++this.operationId;
    this.dispatch({ type: 'START' });

    try {
      await this.playCalling(operationId);

      while (this.isActive(operationId)) {
        const machineHand = this.chooseMachineHand();
        this.dispatch({ type: 'CAPTURE', machineHand });

        let classification: Classification;
        try {
          const image = await this.dependencies.camera.capture();
          if (!this.isActive(operationId)) {
            return;
          }
          classification = await this.dependencies.classifier.classify(image);
        } catch (error: unknown) {
          if (!this.isActive(operationId)) {
            return;
          }
          await this.retry(operationId, errorMessage(error));
          continue;
        }

        if (!this.isActive(operationId)) {
          return;
        }
        if (classification.confidence < CONFIDENCE_THRESHOLD) {
          await this.retry(
            operationId,
            `手を認識できませんでした（信頼度 ${classification.confidence.toFixed(2)}）`,
          );
          continue;
        }

        this.dispatch({ type: 'CLASSIFIED', classification });
        await this.dependencies.clock.wait(JUDGING_MS);
        if (!this.isActive(operationId)) {
          return;
        }

        const outcome = judge(classification.hand, machineHand);
        const roulette = outcome === 'win'
          ? selectRoulette(this.dependencies.rng.next())
          : null;
        this.dispatch({ type: 'JUDGED', outcome, roulette });

        if (outcome === 'draw') {
          await this.safePlay('aiko');
          continue;
        }

        this.saveMedals(this.state.medals);
        await this.safePlay(outcome === 'win' ? 'win' : 'lose');
        await this.dependencies.clock.wait(RESULT_DISPLAY_MS);
        if (this.isActive(operationId)) {
          this.dispatch({ type: 'RESET' });
        }
        return;
      }
    } finally {
      if (operationId === this.operationId) {
        this.running = false;
      }
    }
  }

  cancel(): void {
    this.operationId += 1;
    this.running = false;
    this.dispatch({ type: 'CANCEL' });
  }

  private async playCalling(operationId: number): Promise<void> {
    this.dispatch({ type: 'CALLING' });
    await Promise.all([
      this.safePlay('janken'),
      this.dependencies.clock.wait(CALLING_MINIMUM_MS),
    ]);
    if (this.isActive(operationId)) {
      await this.safePlay('pon');
    }
  }

  private async retry(operationId: number, reason: string): Promise<void> {
    this.dispatch({ type: 'RETRY', reason });
    await this.dependencies.clock.wait(RETRY_MESSAGE_MS);
    if (this.isActive(operationId)) {
      await this.playCalling(operationId);
    }
  }

  private async safePlay(cue: SoundCue): Promise<void> {
    try {
      await this.dependencies.sound.play(cue);
    } catch {
      // Audio is decorative; unavailable files or autoplay restrictions never stop play.
    }
  }

  private chooseMachineHand(): Hand {
    const value = this.dependencies.rng.next();
    const finiteValue = Number.isFinite(value) ? value : 0;
    const normalized = Math.min(Math.max(finiteValue, 0), 0.999_999);
    return HANDS[Math.floor(normalized * HANDS.length)] ?? 'rock';
  }

  private isActive(operationId: number): boolean {
    return this.running && operationId === this.operationId;
  }

  private dispatch(event: GameEvent): void {
    const nextState = gameReducer(this.state, event);
    if (nextState === this.state) {
      return;
    }
    this.state = nextState;
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private loadMedals(): number {
    try {
      return this.dependencies.medalStore?.load() ?? 0;
    } catch {
      return 0;
    }
  }

  private saveMedals(medals: number): void {
    try {
      this.dependencies.medalStore?.save(medals);
    } catch {
      // Storage can be disabled (for example in private mode); gameplay continues.
    }
  }
}

function normalizeMedals(medals: number): number {
  if (!Number.isFinite(medals) || medals < 0) {
    return 0;
  }
  return Math.floor(medals);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return '判定に失敗しました';
}
