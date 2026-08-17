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

const LOSE_NOTES = [392, 349.23, 293.66, 196] as const;

const ROULETTE_TICKS = [
  0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1,
  1.05, 1.1, 1.15, 1.2, 1.25, 1.3, 1.35, 1.44, 1.53, 1.62, 1.71,
  1.8, 1.89, 1.98, 2.07, 2.23, 2.39, 2.55, 2.71, 2.87, 3.03, 3.31,
  3.59, 3.87, 4.15,
] as const;

const WIN_LANDING_NOTES = [523.25, 659.25, 783.99, 1046.5] as const;
const WIN_SEQUENCE_DURATION = 4.8;

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
      const startAt = context.currentTime;

      oscillator.type = 'square';
      const duration = cue === 'win'
        ? this.scheduleWinRoulette(oscillator, gain, startAt)
        : this.scheduleLoseJingle(oscillator, gain, startAt);
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
      oscillator.stop(startAt + duration);
    } catch {
      // Web Audio is optional (older browsers and test environments may omit it).
    }
  }

  private scheduleWinRoulette(
    oscillator: OscillatorNode,
    gain: GainNode,
    startAt: number,
  ): number {
    gain.gain.setValueAtTime(0.0001, startAt);
    ROULETTE_TICKS.forEach((offset, index) => {
      const tickAt = startAt + offset;
      oscillator.frequency.setValueAtTime(index % 2 === 0 ? 1046.5 : 783.99, tickAt);
      gain.gain.setValueAtTime(0.0001, tickAt);
      gain.gain.exponentialRampToValueAtTime(0.11, tickAt + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, tickAt + 0.045);
    });

    const landingAt = startAt + 4.22;
    WIN_LANDING_NOTES.forEach((frequency, index) => {
      const noteAt = landingAt + index * 0.14;
      oscillator.frequency.setValueAtTime(frequency, noteAt);
      gain.gain.setValueAtTime(0.0001, noteAt);
      gain.gain.exponentialRampToValueAtTime(0.16, noteAt + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteAt + 0.11);
    });

    return WIN_SEQUENCE_DURATION;
  }

  private scheduleLoseJingle(
    oscillator: OscillatorNode,
    gain: GainNode,
    startAt: number,
  ): number {
    const noteLength = 0.14;
    LOSE_NOTES.forEach((frequency, index) => {
      oscillator.frequency.setValueAtTime(frequency, startAt + index * noteLength);
    });
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.14, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      startAt + LOSE_NOTES.length * noteLength,
    );

    return LOSE_NOTES.length * noteLength;
  }
}
