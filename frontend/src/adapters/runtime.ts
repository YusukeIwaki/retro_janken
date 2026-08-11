import type { Clock, Rng } from '../game/engine';

export class BrowserClock implements Clock {
  async wait(milliseconds: number): Promise<void> {
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, milliseconds);
    });
  }
}

export class BrowserRng implements Rng {
  next(): number {
    return Math.random();
  }
}
