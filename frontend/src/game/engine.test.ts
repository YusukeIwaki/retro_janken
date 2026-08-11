import { describe, expect, it } from 'vitest';
import {
  GameEngine,
  type Camera,
  type Classification,
  type Classifier,
  type Clock,
  type GameDependencies,
  type GameState,
  type MedalStore,
  type Rng,
  type SoundCue,
  type SoundPlayer,
} from './engine';

class FakeCamera implements Camera {
  captures = 0;

  async capture(): Promise<Blob> {
    this.captures += 1;
    return new Blob([`capture-${this.captures}`], { type: 'image/jpeg' });
  }
}

class QueueClassifier implements Classifier {
  constructor(private readonly queue: (Classification | Error)[]) {}

  async classify(): Promise<Classification> {
    const next = this.queue.shift();
    if (next === undefined) {
      throw new Error('No fake classification remains');
    }
    if (next instanceof Error) {
      throw next;
    }
    return next;
  }
}

class RecordingSound implements SoundPlayer {
  readonly cues: SoundCue[] = [];

  async play(cue: SoundCue): Promise<void> {
    this.cues.push(cue);
  }
}

class ImmediateClock implements Clock {
  readonly waits: number[] = [];

  async wait(milliseconds: number): Promise<void> {
    this.waits.push(milliseconds);
  }
}

class SequenceRng implements Rng {
  constructor(private readonly values: number[]) {}

  next(): number {
    return this.values.shift() ?? 0;
  }
}

class MemoryMedals implements MedalStore {
  saved: number[] = [];

  constructor(private medals: number) {}

  load(): number {
    return this.medals;
  }

  save(medals: number): void {
    this.medals = medals;
    this.saved.push(medals);
  }
}

function setup(
  classifications: (Classification | Error)[],
  rngValues: number[] = [0],
  initialMedals = 0,
) {
  const camera = new FakeCamera();
  const sound = new RecordingSound();
  const clock = new ImmediateClock();
  const medalStore = new MemoryMedals(initialMedals);
  const dependencies: GameDependencies = {
    camera,
    classifier: new QueueClassifier(classifications),
    sound,
    clock,
    rng: new SequenceRng(rngValues),
    medalStore,
  };
  const engine = new GameEngine(dependencies);
  const history: GameState[] = [];
  engine.subscribe((state) => history.push(state));
  return { engine, history, camera, sound, clock, medalStore };
}

describe('GameEngine', () => {
  it('runs idle -> calling -> capturing -> judging -> result -> idle and saves a win', async () => {
    const game = setup([{ hand: 'paper', confidence: 0.95 }], [0], 4);

    await game.engine.start();

    expect(game.history.map((state) => state.phase)).toEqual([
      'idle',
      'calling',
      'calling',
      'capturing',
      'judging',
      'result',
      'idle',
    ]);
    const result = game.history.find((state) => state.phase === 'result');
    expect(result).toMatchObject({ outcome: 'win', medals: 5, message: 'かった！' });
    expect(game.medalStore.saved).toEqual([5]);
    expect(game.sound.cues).toEqual(['janken', 'pon', 'win']);
  });

  it('loops through aiko directly back to capturing before resolving the game', async () => {
    const game = setup(
      [
        { hand: 'rock', confidence: 0.99 },
        { hand: 'paper', confidence: 0.97 },
      ],
      [0, 0],
    );

    await game.engine.start();

    const phases = game.history.map((state) => state.phase);
    expect(phases).toContain('aiko');
    expect(phases.filter((phase) => phase === 'capturing')).toHaveLength(2);
    expect(phases.slice(phases.indexOf('aiko'), phases.indexOf('aiko') + 2)).toEqual([
      'aiko',
      'capturing',
    ]);
    expect(game.camera.captures).toBe(2);
    expect(game.sound.cues).toEqual(['janken', 'pon', 'aiko', 'win']);
  });

  it('returns to calling and retries when confidence is below 0.6', async () => {
    const game = setup(
      [
        { hand: 'paper', confidence: 0.59 },
        { hand: 'paper', confidence: 0.6 },
      ],
      [0, 0],
    );

    await game.engine.start();

    const retry = game.history.find(
      (state) => state.phase === 'calling' && state.retryCount === 1,
    );
    expect(retry).toMatchObject({ message: 'もういっかい！' });
    expect(retry?.error).toContain('信頼度 0.59');
    expect(game.camera.captures).toBe(2);
    expect(game.sound.cues).toEqual(['janken', 'pon', 'janken', 'pon', 'win']);
  });

  it('recovers from a classifier API error and can then lose normally', async () => {
    const game = setup(
      [new Error('API unavailable'), { hand: 'scissors', confidence: 0.91 }],
      [0, 0],
      3,
    );

    await game.engine.start();

    expect(game.history.some((state) => state.error === 'API unavailable')).toBe(true);
    const result = game.history.find((state) => state.phase === 'result');
    expect(result).toMatchObject({ outcome: 'lose', medals: 3, message: 'まけた！' });
    expect(game.medalStore.saved).toEqual([3]);
    expect(game.sound.cues.at(-1)).toBe('lose');
  });

  it('continues even when every sound playback rejects', async () => {
    const camera = new FakeCamera();
    const rejectingSound: SoundPlayer = {
      async play(): Promise<void> {
        throw new Error('autoplay denied');
      },
    };
    const engine = new GameEngine({
      camera,
      classifier: new QueueClassifier([{ hand: 'paper', confidence: 0.9 }]),
      sound: rejectingSound,
      clock: new ImmediateClock(),
      rng: new SequenceRng([0]),
    });

    await expect(engine.start()).resolves.toBeUndefined();
    expect(engine.getState().phase).toBe('idle');
  });
});
