import {test,expect} from '@playwright/test';

const password='P1-E2E-2026!';
async function login(page){await page.goto('/');await page.getByTestId('password').fill(password);await page.getByTestId('auth-submit').click();await expect(page.getByText('Gestão Pecuária')).toBeVisible();}

test('P1 inteira está navegável e cada ação possui UI sem JSON cru',async({page})=>{
  await login(page);
  const expected={traceability:['save','remove'],inventory:['save','adjust'],pastures:['save','enterLot','leaveLot'],nutrition:['save','consume'],tasks:['save','complete']};
  for(const [screen,actions] of Object.entries(expected)){await page.getByTestId('nav-'+screen).click();await expect(page.getByTestId('workspace-screen')).toBeVisible();for(const action of actions){const button=page.getByTestId(`action-${screen}-${action}`);await expect(button).toBeVisible();await button.click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.locator('[data-testid="action-json"]')).toHaveCount(0);await page.getByRole('button',{name:'Fechar'}).click();}}
});

test('P1 usa seletores para referências operacionais',async({page})=>{
  await login(page);
  await page.getByTestId('nav-pastures').click();await page.getByTestId('action-pastures-enterLot').click();await expect(page.getByTestId('field-pastureId')).toHaveJSProperty('tagName','SELECT');await page.getByRole('button',{name:'Fechar'}).click();
  await page.getByTestId('nav-nutrition').click();await page.getByTestId('action-nutrition-consume').click();await expect(page.getByTestId('field-planId')).toHaveJSProperty('tagName','SELECT');
});

test('históricos P1 e indicadores avançados possuem superfície visual',async({page})=>{
  await login(page);
  await page.getByTestId('nav-inventory').click();await expect(page.getByTestId('secondary-inventory')).toBeVisible();
  await page.getByTestId('nav-pastures').click();await expect(page.getByTestId('secondary-pastures')).toBeVisible();
  await page.getByTestId('nav-reproduction').click();await expect(page.getByTestId('reproduction-summary')).toBeVisible();
});

test('relatórios oferecem PDF real',async({page})=>{
  await login(page);await page.getByTestId('nav-reports').click();await page.getByTestId('action-reports-issue').click();await expect(page.getByTestId('field-format').locator('option')).toHaveText(['Selecione','CSV','PDF','JSON']);
});

test('ação de PDF real está disponível na UI',async({page})=>{await login(page);await page.getByTestId('nav-reports').click();await expect(page.getByTestId('action-reports-pdf')).toBeVisible();await page.getByTestId('action-reports-pdf').click();await expect(page.getByRole('dialog',{name:'Gerar PDF'})).toBeVisible();});
