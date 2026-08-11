import type { MedalStore } from '../game/engine';

const STORAGE_KEY = 'retro-janken-medals';

export class LocalStorageMedalStore implements MedalStore {
  constructor(private readonly storage: Storage = window.localStorage) {}

  load(): number {
    const stored = this.storage.getItem(STORAGE_KEY);
    if (stored === null) {
      return 0;
    }
    const parsed = Number.parseInt(stored, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }

  save(medals: number): void {
    this.storage.setItem(STORAGE_KEY, String(medals));
  }
}
