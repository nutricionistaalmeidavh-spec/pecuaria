import {test,expect} from '@playwright/test';

const password='UI-Polish-2026!';
async function login(page){
  await page.goto('/');
  await page.getByTestId('password').fill(password);
  await page.getByTestId('auth-submit').click();
  await expect(page.getByText('Gestão Pecuária')).toBeVisible();
}

test('finance uses human money fields and contextual settlement without technical ids',async({page})=>{
  await login(page);
  const nav=page.getByTestId('nav-finance');
  await expect(nav).toContainText('Financeiro');
  await nav.click();

  await page.getByTestId('action-finance-saveTitle').click();
  const dialog=page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId('field-id')).toHaveCount(0);
  await expect(page.getByTestId('field-operationId')).toHaveCount(0);
  await expect(dialog.getByText('Valor (R$)',{exact:true})).toBeVisible();
  await page.getByTestId('field-direction').selectOption('payable');
  await page.getByTestId('field-description').fill('Ração contextual');
  await page.getByTestId('field-originalAmountMinor').fill('100,00');
  await page.getByTestId('field-issuedAt').fill('2026-09-21');
  await page.getByTestId('field-dueAt').fill('2026-09-30');
  await page.getByTestId('action-submit').click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId('finance-titles')).toContainText('Ração contextual');

  await page.getByTestId('finance-titles').getByRole('button',{name:'Baixar'}).first().click();
  const contextual=page.getByTestId('finance-context-settle');
  await expect(contextual.getByText('Valor (R$)',{exact:true})).toBeVisible();
  await contextual.getByLabel('Valor (R$)').fill('25,00');
  await contextual.getByRole('button',{name:'Confirmar baixa'}).click();
  await expect(page.getByTestId('finance-titles')).toContainText('Parcial');
});

test('domain tables expose local filter and sorting controls',async({page})=>{
  await login(page);
  await page.getByTestId('nav-data').click();
  await page.getByTestId('action-data-saveFarmUnit').click();
  await page.getByTestId('field-id').fill('farm-ui-polish');
  await page.getByTestId('field-name').fill('Fazenda Busca Local');
  await page.getByTestId('action-submit').click();
  await expect(page.getByTestId('domain-table-search')).toBeVisible();
  await expect(page.getByTestId('domain-table-sort')).toBeVisible();
  await page.getByTestId('domain-table-search').fill('Busca Local');
  await expect(page.getByTestId('data-table')).toContainText('Fazenda Busca Local');
});
