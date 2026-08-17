import { describe, expect, it, vi } from 'vitest';
import { BrowserSoundPlayer } from './sound';

function endingAudioFactory(sources: string[]) {
  return (source: string): HTMLAudioElement => {
    sources.push(source);
    const target = new EventTarget();
    const play = vi.fn(async () => {
      queueMicrotask(() => target.dispatchEvent(new Event('ended')));
    });
    return Object.assign(target, { play }) as unknown as HTMLAudioElement;
  };
}

describe('BrowserSoundPlayer', () => {
  it('plays the contracted voice file for a cue', async () => {
    const sources: string[] = [];
    const player = new BrowserSoundPlayer(endingAudioFactory(sources));

    await player.play('aiko');

    expect(sources).toEqual(['/audio/aiko.wav']);
  });

  it('swallows audio playback rejection so gameplay can continue', async () => {
    const target = new EventTarget();
    const audio = Object.assign(target, {
      play: vi.fn(async () => Promise.reject(new Error('not allowed'))),
    }) as unknown as HTMLAudioElement;
    const player = new BrowserSoundPlayer(() => audio);

    await expect(player.play('pon')).resolves.toBeUndefined();
  });

  it('schedules a slowing roulette tick sequence and landing jingle for win', async () => {
    const frequencies: number[] = [];
    let endedListener: EventListener | null = null;
    const oscillator = {
      type: 'sine',
      frequency: {
        setValueAtTime: vi.fn((frequency: number) => frequencies.push(frequency)),
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      addEventListener: vi.fn((event: string, listener: EventListener) => {
        if (event === 'ended') {
          endedListener = listener;
        }
      }),
    };
    const gain = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };
    const close = vi.fn(async () => undefined);
    const context = {
      currentTime: 10,
      destination: {},
      createOscillator: () => oscillator,
      createGain: () => gain,
      close,
    } as unknown as AudioContext;
    const sources: string[] = [];
    const player = new BrowserSoundPlayer(
      endingAudioFactory(sources),
      () => context,
    );

    await player.play('win');
    endedListener?.(new Event('ended'));
    await Promise.resolve();

    expect(sources).toEqual(['/audio/win.wav']);
    expect(oscillator.type).toBe('square');
    expect(frequencies.slice(0, 4)).toEqual([1046.5, 783.99, 1046.5, 783.99]);
    expect(frequencies.slice(-4)).toEqual([523.25, 659.25, 783.99, 1046.5]);
    expect(frequencies).toHaveLength(41);
    expect(oscillator.start).toHaveBeenCalledWith(10);
    expect(oscillator.stop).toHaveBeenCalledWith(14.8);
    expect(close).toHaveBeenCalledOnce();
  });
});
