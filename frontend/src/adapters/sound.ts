import type { SoundCue, SoundPlayer } from '../game/engine';

type AudioFactory = (source: string) => HTMLAudioElement;
type AudioContextFactory = () => AudioContext;

const AUDIO_PATHS: Readonly<Record<SoundCue, string>> = {
  janken: '/audio/janken.wav',
  pon: '/audio/pon.wav',
  aiko: '/audio/aiko.wav',
  win: '/audio/win.wav',
  lose: '/audio/lose.wav',
};

const JINGLE_NOTES: Readonly<Record<'win' | 'lose', readonly number[]>> = {
  win: [523.25, 659.25, 783.99, 1046.5],
  lose: [392, 349.23, 293.66, 196],
};

export class BrowserSoundPlayer implements SoundPlayer {
  constructor(
    private readonly audioFactory: AudioFactory = (source) => new Audio(source),
    private readonly contextFactory: AudioContextFactory = () => {
      const Context = window.AudioContext;
      return new Context();
    },
  ) {}

  async play(cue: SoundCue): Promise<void> {
    const tasks: Promise<void>[] = [this.playAudio(AUDIO_PATHS[cue])];
    if (cue === 'win' || cue === 'lose') {
      tasks.push(this.playSynthesizedJingle(cue));
    }
    await Promise.all(tasks);
  }

  private async playAudio(source: string): Promise<void> {
    try {
      const audio = this.audioFactory(source);
      await new Promise<void>((resolve) => {
        let settled = false;
        const finish = (): void => {
          if (settled) {
            return;
          }
          settled = true;
          audio.removeEventListener('ended', finish);
          audio.removeEventListener('error', finish);
          resolve();
        };

        audio.addEventListener('ended', finish, { once: true });
        audio.addEventListener('error', finish, { once: true });
        try {
          const playback = audio.play();
          playback.catch(finish);
        } catch {
          finish();
        }
      });
    } catch {
      // Missing placeholder files and browser autoplay restrictions are non-fatal.
    }
  }

  private async playSynthesizedJingle(cue: 'win' | 'lose'): Promise<void> {
    try {
      const context = this.contextFactory();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const noteLength = 0.12;
      const startAt = context.currentTime;

      oscillator.type = 'square';
      JINGLE_NOTES[cue].forEach((frequency, index) => {
        oscillator.frequency.setValueAtTime(
          frequency,
          startAt + index * noteLength,
        );
      });
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.16, startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        startAt + JINGLE_NOTES[cue].length * noteLength,
      );
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.addEventListener(
        'ended',
        () => {
          void context.close().catch(() => undefined);
        },
        { once: true },
      );
      oscillator.start(startAt);
      oscillator.stop(startAt + JINGLE_NOTES[cue].length * noteLength);
    } catch {
      // Web Audio is optional (older browsers and test environments may omit it).
    }
  }
}
