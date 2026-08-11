import { useMemo } from 'react';
import type { PreviewCamera } from '../adapters/camera';
import {
  RESULT_DISPLAY_MS,
  type Classification,
  type Classifier,
  type Clock,
  type MedalStore,
  type Rng,
  type SoundPlayer,
} from '../game/engine';
import { GameScreen, type GameScreenDependencies } from './GameScreen';

class ReadyFakeCamera implements PreviewCamera {
  async start(video: HTMLVideoElement): Promise<void> {
    video.dataset.cameraReady = 'true';
  }

  async capture(): Promise<Blob> {
    return new Blob(['fake-jpeg'], { type: 'image/jpeg' });
  }

  stop(): void {}
}

class PaperClassifier implements Classifier {
  async classify(): Promise<Classification> {
    return { hand: 'paper', confidence: 0.98, latencyMs: 1 };
  }
}

class SilentSound implements SoundPlayer {
  async play(): Promise<void> {}
}

class ResultHoldingClock implements Clock {
  async wait(milliseconds: number): Promise<void> {
    if (milliseconds === RESULT_DISPLAY_MS) {
      await new Promise<void>(() => undefined);
    }
  }
}

class RockRng implements Rng {
  next(): number {
    return 0;
  }
}

class StartingMedals implements MedalStore {
  load(): number {
    return 2;
  }

  save(): void {}
}

export function PlayableGameHarness() {
  const dependencies = useMemo<GameScreenDependencies>(
    () => ({
      camera: new ReadyFakeCamera(),
      classifier: new PaperClassifier(),
      sound: new SilentSound(),
      clock: new ResultHoldingClock(),
      rng: new RockRng(),
      medalStore: new StartingMedals(),
    }),
    [],
  );
  return <GameScreen dependencies={dependencies} />;
}

class RejectedCamera implements PreviewCamera {
  async start(): Promise<void> {
    throw new Error('permission denied');
  }

  async capture(): Promise<Blob> {
    throw new Error('not ready');
  }

  stop(): void {}
}

export function CameraErrorHarness() {
  const dependencies = useMemo<GameScreenDependencies>(
    () => ({
      camera: new RejectedCamera(),
      classifier: new PaperClassifier(),
      sound: new SilentSound(),
      clock: new ResultHoldingClock(),
      rng: new RockRng(),
    }),
    [],
  );
  return <GameScreen dependencies={dependencies} />;
}
