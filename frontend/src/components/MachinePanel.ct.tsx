import { expect, test } from '@playwright/experimental-ct-react';
import { createInitialState, type GameState } from '../game/engine';
import { MachinePanel } from './MachinePanel';

test('shows the LED message, selected hands, and medal counter', async ({ mount }) => {
  const state: GameState = {
    ...createInitialState(7),
    phase: 'result',
    machineHand: 'rock',
    playerHand: 'paper',
    confidence: 0.93,
    outcome: 'win',
    payout: 7,
    payoutIndex: 2,
    message: 'かった！',
  };
  const component = await mount(<MachinePanel state={state} />);

  await expect(component.getByRole('status')).toHaveText('かった！');
  await expect(component.getByRole('img', { name: 'マシンはグー' })).toBeVisible();
  await expect(component.getByRole('img', { name: 'あなたはパー' })).toBeVisible();
  await expect(
    component.getByRole('img', { name: '配当ルーレット、7枚に決定' }),
  ).toBeVisible();
  await expect(component.getByTestId('payout-count')).toHaveText('7');
  await expect(component.getByTestId('medal-count')).toHaveText('007');
});

test('shows the CSS pixel-hand cycle while calling', async ({ mount }) => {
  const state: GameState = {
    ...createInitialState(),
    phase: 'calling',
    message: 'ジャンケン…',
  };
  const component = await mount(<MachinePanel state={state} />);

  await expect(
    component.getByRole('img', { name: 'マシンの手をシャッフル中' }),
  ).toBeVisible();
});

test('moves the roulette runner only at discrete lamp boundaries', async ({ mount }) => {
  const state: GameState = {
    ...createInitialState(),
    phase: 'result',
    machineHand: 'rock',
    outcome: 'win',
    payout: 2,
    payoutIndex: 0,
    message: 'かった！',
  };
  const component = await mount(<MachinePanel state={state} />);
  const runner = component.locator('.roulette-wheel__runner');

  const transforms = await runner.evaluate((element) => {
    const spin = element.getAnimations().find((animation) => {
      const effect = animation.effect;
      return effect instanceof KeyframeEffect && effect.getKeyframes().length > 10;
    });
    if (spin === undefined) {
      return null;
    }

    const sample = (milliseconds: number): string => {
      spin.currentTime = milliseconds;
      return getComputedStyle(element).transform;
    };

    spin.pause();
    return [sample(520), sample(540), sample(560)];
  });

  expect(transforms).not.toBeNull();
  expect(transforms?.[0]).toBe(transforms?.[1]);
  expect(transforms?.[1]).not.toBe(transforms?.[2]);
});
