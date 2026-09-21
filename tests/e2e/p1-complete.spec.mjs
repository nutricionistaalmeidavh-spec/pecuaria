import {test,expect} from '@playwright/test';

const password='P1-E2E-2026!';
async function login(page){await page.goto('/');await page.getByTestId('password').fill(password);await page.getByTestId('auth-submit').click();await expect(page.getByText('Gestão Pecuária')).toBeVisible();}

test('P1 final expõe as ações aprofundadas com UI tipada e sem JSON cru',async({page})=>{
  await login(page);
  const expected={
    animals:['save','recordMilk','move','lifecycle','batchMove','batchLifecycle','recordBodyCondition','registerBirth'],
    finance:['addCost','fromTrade','saveAccount','saveCategory','saveTitle','cancelTitle','settleTitle','reverseSettlement','importStatement','reconcileStatement','importInvoiceXml'],
    traceability:['save','remove'],
    inventory:['save','adjust'],
    pastures:['save','enterLot','leaveLot','recordAssessment','saveRotationPlan'],
    nutrition:['save','consume'],
    tasks:['save','complete']
  };
  for(const [screen,actions] of Object.entries(expected)){
    await page.getByTestId('nav-'+screen).click();
    await expect(page.getByTestId('workspace-screen')).toBeVisible();
    for(const action of actions){
      const button=page.getByTestId(`action-${screen}-${action}`);
      await expect(button,`${screen}.${action}`).toBeVisible();
      await button.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.locator('[data-testid="action-json"]')).toHaveCount(0);
      await page.getByRole('button',{name:'Fechar'}).click();
    }
  }
});

test('P1 final mantém superfícies dedicadas de financeiro, pastagem e campo offline',async({page})=>{
  await login(page);
  await page.getByTestId('nav-finance').click();
  for(const id of ['finance-admin-workspace','finance-cash-summary','finance-titles','finance-forecast','finance-reconciliation'])await expect(page.getByTestId(id)).toBeVisible();
  await expect(page.getByTestId('finance-import-statement').locator('input[type=file]')).toBeVisible();
  await expect(page.getByTestId('finance-import-invoice').locator('input[type=file]')).toBeVisible();

  await page.getByTestId('nav-pastures').click();
  for(const id of ['pasture-local-map','pasture-condition','pasture-rotations','pasture-body-condition'])await expect(page.getByTestId(id)).toBeVisible();

  await page.getByTestId('nav-tasks').click();
  await expect(page.getByTestId('field-mobile-workspace')).toBeVisible();
  await expect(page.getByTestId('field-operation-switcher')).toBeVisible();
  await expect(page.getByTestId('field-secure-sync')).toBeVisible();
});

test('P1 usa seletores para referências operacionais',async({page})=>{
  await login(page);
  await page.getByTestId('nav-pastures').click();await page.getByTestId('action-pastures-enterLot').click();await expect(page.getByTestId('field-pastureId')).toHaveJSProperty('tagName','SELECT');await page.getByRole('button',{name:'Fechar'}).click();
  await page.getByTestId('nav-nutrition').click();await page.getByTestId('action-nutrition-consume').click();await expect(page.getByTestId('field-planId')).toHaveJSProperty('tagName','SELECT');await page.getByRole('button',{name:'Fechar'}).click();
  await page.getByTestId('nav-animals').click();await page.getByTestId('action-animals-recordBodyCondition').click();await expect(page.getByTestId('field-animalId')).toHaveJSProperty('tagName','SELECT');
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
