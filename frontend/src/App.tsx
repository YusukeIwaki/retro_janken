import { useMemo } from 'react';
import { BrowserCamera } from './adapters/camera';
import { ClassifierApi } from './adapters/classifierApi';
import { BrowserClock, BrowserRng } from './adapters/runtime';
import { BrowserSoundPlayer } from './adapters/sound';
import { LocalStorageMedalStore } from './adapters/storage';
import { GameScreen, type GameScreenDependencies } from './components/GameScreen';

export function App() {
  const dependencies = useMemo<GameScreenDependencies>(
    () => ({
      camera: new BrowserCamera(),
      classifier: new ClassifierApi(),
      sound: new BrowserSoundPlayer(),
      rng: new BrowserRng(),
      clock: new BrowserClock(),
      medalStore: new LocalStorageMedalStore(),
    }),
    [],
  );

  return <GameScreen dependencies={dependencies} />;
}
