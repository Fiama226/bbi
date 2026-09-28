const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
test('composite, navigation, filters, FAQ and all standalone modules', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Faites grandir vos talents');
  await expect(page.locator('section')).toHaveCount(12);
  await page.getByRole('link', { name: 'Explorer les formations' }).click();
  await expect(page).toHaveURL(/#bbi-preview-catalog$/);
  const catalog = page.locator('#bbi-preview-catalog');
  await catalog.getByRole('button', { name: 'Management', exact: true }).click();
  await expect(catalog.locator('article')).toHaveCount(1);
  await catalog.getByRole('searchbox').fill('absent');
  await expect(catalog.getByText('Aucun résultat pour ces critères.')).toBeVisible();
  await catalog.getByRole('button', { name: 'Réinitialiser les filtres' }).click();
  await expect(catalog.locator('article')).toHaveCount(4);
  await catalog.getByRole('searchbox').fill('equipe');
  await expect(catalog.locator('article')).toHaveCount(1);
  const faq = page.locator('details').first(); await faq.locator('summary').click();
  await expect(faq).toHaveAttribute('open', '');
  for (const key of ['hero','news','sessions','links','catalog','documents','directory','metrics','resources','community','trainer','support']) {
    await page.locator('#preview-toolbar select').first().selectOption(key);
    await expect(page.locator('section')).toHaveCount(1);
    await expect(page.getByText('MODE DÉMONSTRATION', { exact: false })).toBeVisible();
  }
  expect(errors).toEqual([]);
});
test('empty and error states remain explicit; retry is available', async ({ page }) => {
  await page.goto('/');
  await page.locator('#preview-toolbar select').first().selectOption('catalog');
  await page.locator('#preview-toolbar select').nth(1).selectOption('empty');
  await expect(page.getByText('Aucun contenu pour le moment.')).toBeVisible();
  await expect(page.getByText('MODE DÉMONSTRATION', { exact: false })).toHaveCount(0);
  await page.locator('#preview-toolbar select').nth(1).selectOption('error');
  await expect(page.getByRole('alert')).toContainText('HTTP 403');
  await page.getByRole('button', { name: 'Réessayer' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('article')).toHaveCount(0);
});
test('desktop and mobile have no horizontal page overflow, images load', async ({ page }) => {
  await page.goto('/');
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await expect.poll(() => page.locator('img').evaluateAll(images => images.every(img => img.complete && img.naturalWidth > 0))).toBe(true);
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
});
test('WCAG A/AA automated checks on the composite', async ({ page }) => {
  await page.goto('/');
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(result.violations).toEqual([]);
});
test('standalone webpart adapts to a narrow SharePoint column on desktop', async ({ page }) => {
  await page.goto('/');
  await page.locator('#preview-toolbar select').first().selectOption('catalog');
  await page.locator('#root > div').last().evaluate(element => { element.style.width = '340px'; });
  await expect(page.locator('article')).toHaveCount(4);
  const positions = await page.locator('article').evaluateAll(cards => cards.map(card => Math.round(card.getBoundingClientRect().left)));
  expect(new Set(positions).size).toBe(1);
});
