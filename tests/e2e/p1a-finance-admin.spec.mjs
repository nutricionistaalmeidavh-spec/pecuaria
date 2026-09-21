import {test,expect} from '@playwright/test';

const password='P1-E2E-2026!';
async function login(page){await page.goto('/');await page.getByTestId('password').fill(password);await page.getByTestId('auth-submit').click();await expect(page.getByText('Gestão Pecuária')).toBeVisible();}

test('finance keeps productive economics and exposes local administrative workspace',async({page})=>{
  await login(page);
  await page.getByTestId('nav-finance').click();
  await expect(page.getByTestId('finance-admin-workspace')).toBeVisible();
  await expect(page.getByTestId('finance-cash-summary')).toBeVisible();
  await expect(page.getByTestId('finance-titles')).toBeVisible();
  await expect(page.getByTestId('finance-forecast')).toBeVisible();
  await expect(page.getByTestId('finance-reconciliation')).toBeVisible();
  await expect(page.getByText('Previsto x realizado')).toBeVisible();
  await expect(page.locator('[data-testid="action-json"]')).toHaveCount(0);
});

test('all P1A finance actions remain typed and file adapters stay local',async({page})=>{
  await login(page);await page.getByTestId('nav-finance').click();
  const actions=['saveAccount','saveCategory','saveTitle','cancelTitle','settleTitle','reverseSettlement','importStatement','reconcileStatement','importInvoiceXml'];
  for(const action of actions){
    const button=page.getByTestId(`action-finance-${action}`);await expect(button).toBeVisible();await button.click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.locator('[data-testid="action-json"]')).toHaveCount(0);await page.getByRole('button',{name:'Fechar'}).click();
  }
  const csv=page.getByTestId('finance-import-statement').locator('input[type=file]');
  const xml=page.getByTestId('finance-import-invoice').locator('input[type=file]');
  await expect(csv).toBeVisible();await expect(xml).toBeVisible();
  await expect(csv).toHaveAttribute('accept',/csv/);await expect(xml).toHaveAttribute('accept',/xml/);
});
