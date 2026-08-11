import { expect, test } from '@playwright/experimental-ct-react';
import { HandSprite } from './HandSprite';

test('renders each hand from inline pixel data', async ({ mount }) => {
  const component = await mount(
    <div>
      <HandSprite hand="rock" />
      <HandSprite hand="scissors" />
      <HandSprite hand="paper" />
    </div>,
  );

  await expect(component.getByRole('img', { name: 'グー' })).toBeVisible();
  await expect(component.getByRole('img', { name: 'チョキ' })).toBeVisible();
  await expect(component.getByRole('img', { name: 'パー' })).toBeVisible();
  await expect(component.locator('svg[data-hand="rock"] rect')).not.toHaveCount(0);
});
