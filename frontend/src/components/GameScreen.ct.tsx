import { expect, test } from '@playwright/experimental-ct-react';
import { CameraErrorHarness, PlayableGameHarness } from './GameScreen.story';

test('plays a complete injected game and awards a medal', async ({ mount }) => {
  const component = await mount(<PlayableGameHarness />);
  const start = component.getByRole('button', { name: 'スタート' });

  await expect(start).toBeEnabled();
  await start.click();

  await expect(component.getByRole('status')).toHaveText('かった！');
  await expect(component.getByRole('img', { name: 'マシンはグー' })).toBeVisible();
  await expect(component.getByRole('img', { name: 'あなたはパー' })).toBeVisible();
  await expect(component.getByTestId('medal-count')).toHaveText('003');
});

test('shows a camera permission error and prevents starting', async ({ mount }) => {
  const component = await mount(<CameraErrorHarness />);

  await expect(component.getByRole('alert')).toContainText('permission denied');
  await expect(component.getByRole('button', { name: 'スタート' })).toBeDisabled();
});
