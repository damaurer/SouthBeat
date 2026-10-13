import { Browser, Page, expect, test } from '@playwright/test';

/** Fails the test on any uncaught error in the page. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

async function saveFighter(page: Page, name: string): Promise<void> {
  await page.goto('/editor');
  await page.locator('fieldset input[type=text]').first().fill(name);
  await page.locator('.save').click();
  await expect(page.locator('.saved')).toBeVisible();
}

async function newPlayer(browser: Browser, name: string): Promise<{ page: Page; errors: string[] }> {
  const page = await (await browser.newContext()).newPage();
  const errors = watchErrors(page);
  await saveFighter(page, name);
  return { page, errors };
}

test('title menu leads to the screens', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'PRESS START' }).click();
  const menu = page.getByRole('navigation', { name: 'Hauptmenü' });
  for (const entry of ['Einzelspieler', 'Training', 'Kämpfer & Bestenliste', 'Online-Kampf']) await expect(menu.getByText(entry)).toBeVisible();
  await menu.getByText('Einzelspieler').click();
  await expect(page).toHaveURL(/singleplayer/);
  expect(errors).toEqual([]);
});

test('a saved fighter fights the CPU and the round starts', async ({ page }) => {
  const errors = watchErrors(page);
  await saveFighter(page, 'Smoke Test');
  await page.goto('/fight');
  await expect(page.locator('.panel .name').first()).toHaveText('Smoke Test');
  await expect(page.locator('.call')).toHaveText(/Runde 1|FIGHT!/);
  await expect(page.locator('.timer')).toContainText('99');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Pause' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('training keeps the dummy standing', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/training');
  await expect(page.locator('.timer')).toContainText('∞');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1200);
  await page.keyboard.up('KeyD');
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('KeyK');
    await page.waitForTimeout(300);
  }
  await expect(page.locator('.input-log li').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('two players meet online through the lobby list', async ({ browser }) => {
  const alice = await newPlayer(browser, 'Alice Online');
  const bob = await newPlayer(browser, 'Bob Online');
  for (const p of [alice.page, bob.page]) {
    await p.goto('/online');
    // Pick your own fighter (the first tile) on the select screen, then confirm.
    await p.getByRole('listbox', { name: 'Kämpfer' }).waitFor();
    await p.keyboard.press('KeyJ');
    await p.waitForTimeout(100);
    await p.keyboard.press('KeyJ');
  }
  await alice.page.locator('input[name=lobbyName]').fill('Smoke-Lobby');
  await alice.page.getByRole('button', { name: 'Lobby erstellen' }).click();
  await expect(alice.page.locator('.code-inline')).toBeVisible();
  await bob.page.locator('table.lobbies tr', { hasText: 'Smoke-Lobby' }).getByRole('button', { name: 'Beitreten' }).click();
  for (const p of [alice.page, bob.page]) await expect(p.locator('canvas')).toBeVisible();
  await expect(alice.page.locator('.panel .name')).toHaveText(['Alice Online (Du)', 'Bob Online']);
  expect([...alice.errors, ...bob.errors]).toEqual([]);
});

test('the fighters page lists everyone and the leaderboard', async ({ browser }) => {
  const { page, errors } = await newPlayer(browser, 'Liste Eins');
  await page.goto('/fighters?tab=all');
  await expect(page.locator('.cards li', { hasText: 'Liste Eins' })).toBeVisible();
  await page.getByRole('tab', { name: 'Bestenliste' }).click();
  await expect(page.getByRole('tabpanel')).toContainText('Online-Kämpfe');
  expect(errors).toEqual([]);
});
