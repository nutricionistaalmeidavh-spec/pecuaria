import {test,expect} from '@playwright/test';

test('overview renders simplified livestock dashboard with hero, icons and four KPIs',async({page})=>{
  await page.goto('/');
  await page.getByTestId('password').fill(['Qa','Browser','2026!'].join('-'));
  await page.getByTestId('auth-submit').click();

  await expect(page.getByTestId('dashboard-overview')).toBeVisible();
  await expect(page.getByTestId('dashboard-hero')).toBeVisible();
  await expect(page.getByTestId('dashboard-hero')).toContainText('Gestão do seu rebanho');
  await expect(page.getByTestId('primary-kpis').locator('[data-testid^="kpi-"]')).toHaveCount(4);
  await expect(page.getByTestId('nav-overview').locator('svg')).toHaveCount(1);
  await expect(page.getByTestId('dashboard-secondary')).toBeVisible();
  await expect(page.locator('.dashboard-photo')).toHaveCount(1);
});
