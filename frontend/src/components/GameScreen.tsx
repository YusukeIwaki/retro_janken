import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { PreviewCamera } from '../adapters/camera';
import { GameEngine, type GameDependencies, type GameState } from '../game/engine';
import { MachinePanel } from './MachinePanel';

export interface GameScreenDependencies extends Omit<GameDependencies, 'camera'> {
  readonly camera: PreviewCamera;
}

interface GameScreenProps {
  readonly dependencies: GameScreenDependencies;
}

type CameraStatus = 'starting' | 'ready' | 'error';

export function GameScreen({ dependencies }: GameScreenProps) {
  const engine = useMemo(() => new GameEngine(dependencies), [dependencies]);
  const subscribe = useCallback(
    (listener: (state: GameState) => void) => engine.subscribe(listener),
    [engine],
  );
  const getSnapshot = useCallback(() => engine.getState(), [engine]);
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('starting');
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    let mounted = true;
    if (video === null) {
      setCameraStatus('error');
      setCameraError('カメラ表示を初期化できません');
      return;
    }

    setCameraStatus('starting');
    setCameraError(null);
    dependencies.camera
      .start(video)
      .then(() => {
        if (mounted) {
          setCameraStatus('ready');
        }
      })
      .catch((error: unknown) => {
        if (mounted) {
          setCameraStatus('error');
          setCameraError(cameraErrorMessage(error));
        }
      });

    return () => {
      mounted = false;
      engine.cancel();
      dependencies.camera.stop();
    };
  }, [dependencies.camera, engine]);

  const startGame = useCallback(() => {
    void engine.start();
  }, [engine]);

  const canStart = cameraStatus === 'ready' && state.phase === 'idle';

  return (
    <main className="game-screen">
      <div className="crt-frame">
        <header className="game-screen__header">
          <p className="game-screen__eyebrow">VIDEO GAME</p>
          <h1>ジャンケン マシーン</h1>
        </header>

        <div className="game-screen__cabinet">
          <MachinePanel state={state} />

          <aside className="camera-panel" aria-label="カメラプレビュー">
            <div className="camera-panel__screen">
              <video
                aria-label="あなたのカメラ映像"
                autoPlay
                data-testid="camera-preview"
                muted
                playsInline
                ref={videoRef}
              />
              <div className="camera-panel__reticle" aria-hidden="true" />
              {cameraStatus === 'starting' && (
                <p className="camera-panel__notice">CAMERA START…</p>
              )}
              {cameraStatus === 'error' && (
                <p className="camera-panel__notice camera-panel__notice--error">
                  CAMERA ERROR
                </p>
              )}
            </div>
            <p className="camera-panel__instruction">
              わくの中に手を出してね
            </p>
            {cameraError !== null && (
              <p className="camera-panel__error" role="alert">
                {cameraError}
              </p>
            )}
          </aside>
        </div>

        <button
          className="start-button"
          disabled={!canStart}
          onClick={startGame}
          type="button"
        >
          {state.phase === 'idle' ? 'スタート' : 'しょうぶ中'}
        </button>
        <p className="game-screen__hint">
          カメラの使用を許可して、スタートを押してください
        </p>
      </div>
    </main>
  );
}

function cameraErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return `カメラを使用できません: ${error.message}`;
  }
  return 'カメラを使用できません。ブラウザの権限を確認してください。';
}
