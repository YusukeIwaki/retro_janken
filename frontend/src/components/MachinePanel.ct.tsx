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
    message: 'かった！',
  };
  const component = await mount(<MachinePanel state={state} />);

  await expect(component.getByRole('status')).toHaveText('かった！');
  await expect(component.getByRole('img', { name: 'マシンはグー' })).toBeVisible();
  await expect(component.getByRole('img', { name: 'あなたはパー' })).toBeVisible();
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
